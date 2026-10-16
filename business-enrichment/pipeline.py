"""Texas Business Data Enrichment Pipeline.

Reads Excel/CSV files of Texas Comptroller taxpayer records, then enriches
each business with a NAICS code and total employee count via a waterfall of
firmographic sources:

    1. NAICS Association BizAPI (primary)
    2. Explorium firmographics (secondary; capped free tier)
    3. Apify D&B directory scraper (tertiary fallback)

Usage:
    python pipeline.py                    # run with .env settings
    python pipeline.py --mock             # force mock mode (no API credits)
    python pipeline.py --max-records 25   # only process first N rows/file
"""

import argparse
import csv
import logging
import re
import sys
import time
from pathlib import Path

import pandas as pd

from clients import ClientError, TransientError, build_clients
from config import Settings, load_settings
from matching import extract_zip5, normalize_name, pick_best_candidate

logger = logging.getLogger(__name__)

ENRICHMENT_COLUMNS = [
    "Query_String",
    "NAICS_Code_Enriched",
    "NAICS_Title",
    "NAICS_Source",
    "Employee_Count",
    "Employee_Count_Source",
    "Employee_Estimate",
    "Employee_Estimate_Source",
    "Match_Confidence",
]

_NAICS_TITLES = None


def naics_titles():
    """code -> title lookup: official 2022 census table plus a small 2017
    supplement for codes retired by the 2022 revision."""
    global _NAICS_TITLES
    if _NAICS_TITLES is None:
        root = Path(__file__).resolve().parent
        _NAICS_TITLES = {}
        for fname in ("naics_titles_2017supplement.csv", "naics_titles_2022.csv"):
            path = root / fname
            if path.exists():
                table = pd.read_csv(path, dtype=str)
                for code, title in zip(table["code"], table["title"]):
                    _NAICS_TITLES.setdefault(str(code).strip(), str(title).strip())
    return _NAICS_TITLES


def naics_title(code):
    if not code:
        return ""
    titles = naics_titles()
    if code in titles:
        return titles[code]
    # fall back to the parent (5-, 4-, 3-, then 2-digit) when the exact
    # 6-digit code isn't in the table
    for length in (5, 4, 3, 2):
        parent = code[:length]
        if parent in titles:
            return titles[parent]
    return ""

# Canonical column lookup: normalized name -> logical field. Normalization
# lowercases and strips non-alphanumerics, so 'Secretary of State (SOS) or
# COA File Number' and 'SOS or COA File Number' both resolve via contains().
COLUMN_PATTERNS = {
    "taxpayer_number": ["taxpayer number"],
    "name": ["taxpayer name"],
    "address": ["taxpayer address"],
    "city": ["taxpayer city"],
    "state": ["taxpayer state"],
    "zip": ["taxpayer zip"],
    "naics": ["naics code", "naics"],
    "county": ["taxpayer county code", "county code"],
}
REQUIRED_FIELDS = ["name", "address", "city", "state", "zip"]

INPUT_GLOBS = ("*.xlsx", "*.xls", "*.csv")
FAILED_LOOKUPS_FILE = "failed_lookups.csv"
SUMMARY_FILE = "enrichment_summary.csv"


def _canon(col):
    return re.sub(r"[^a-z0-9]+", "", str(col).lower())


def map_columns(df):
    """Map a dataframe's columns to logical fields; rename to canonical
    snake_case along the way. Raises ValueError if a required column is
    missing."""
    canon_to_col = {}
    for c in df.columns:
        canon_to_col.setdefault(_canon(c), c)

    mapping = {}
    for field_name, patterns in COLUMN_PATTERNS.items():
        for pat in patterns:
            target = _canon(pat)
            hit = next(
                (orig for canon, orig in canon_to_col.items() if canon == target),
                None,
            ) or next(
                (
                    orig
                    for canon, orig in canon_to_col.items()
                    if canon.startswith(target)
                ),
                None,
            )
            if hit:
                mapping[field_name] = hit
                break

    missing = [f for f in REQUIRED_FIELDS if f not in mapping]
    if missing:
        raise ValueError(
            "Missing required column(s) for fields {}. Found columns: {}".format(
                missing, list(df.columns)
            )
        )
    return mapping


def iter_input_files(input_dir):
    files = []
    for pattern in INPUT_GLOBS:
        files.extend(sorted(Path(input_dir).glob(pattern)))
    # Skip Excel lock files and hidden files
    return [f for f in files if not f.name.startswith(("~$", "."))]


def read_input(path):
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path, dtype=str)
    return pd.read_excel(path, dtype=str)


def build_query_string(row, mapping):
    parts = [
        row.get(mapping["name"]),
        row.get(mapping["address"]),
        row.get(mapping["city"]),
        row.get(mapping["state"]),
        extract_zip5(row.get(mapping["zip"])),
    ]
    return ", ".join(str(p).strip() for p in parts if p and str(p).strip())


def row_to_record(row, mapping):
    return {
        "taxpayer_number": str(row.get(mapping.get("taxpayer_number", ""), "") or ""),
        "name": str(row.get(mapping["name"], "") or "").strip(),
        "address": str(row.get(mapping["address"], "") or "").strip(),
        "city": str(row.get(mapping["city"], "") or "").strip(),
        "state": str(row.get(mapping["state"], "") or "").strip(),
        "zip": extract_zip5(row.get(mapping["zip"])),
        "county_code": str(row.get(mapping.get("county", ""), "") or ""),
        "reported_naics": clean_naics(row.get(mapping.get("naics", ""))),
        "query_string": "",  # filled by caller
    }


def clean_naics(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ("nan", "nat", "none"):
        return None
    digits = re.sub(r"\D", "", text.split(".")[0])
    return digits or None


class FailureLogger:
    """Appends failed lookups to failed_lookups.csv in the output dir."""

    HEADER = ["timestamp", "source_file", "taxpayer_number", "query_string", "api", "error"]

    def __init__(self, output_dir):
        self.path = Path(output_dir) / FAILED_LOOKUPS_FILE
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            with open(self.path, "w", newline="") as f:
                csv.writer(f).writerow(self.HEADER)
        self.count = 0

    def log(self, source_file, record, api, error):
        with open(self.path, "a", newline="") as f:
            csv.writer(f).writerow(
                [
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                    source_file,
                    record.get("taxpayer_number", ""),
                    record.get("query_string", ""),
                    api,
                    str(error).replace("\n", " ")[:500],
                ]
            )
        self.count += 1


def enrich_record(record, clients, settings, budget):
    """Run the waterfall for one record with field completion.

    Sources are tried in order; each accepted match fills whichever fields
    (NAICS, employees) are still missing, so a partial result from one
    source never blocks a richer lookup downstream. Stops early once both
    fields are filled or the API budget runs out.

    Returns (result_dict, errors) where result_dict has keys
    naics/naics_source/employees/employees_source/confidence/
    contributed_sources/matched_any.
    """
    result = {
        "naics": None,
        "naics_source": None,
        "employees": None,
        "employees_source": None,
        "confidence": None,
        "contributed_sources": [],
        "matched_any": False,
    }
    errors = []
    need_naics = record["reported_naics"] is None
    need_employees = True

    for client in clients:
        if not (need_naics or need_employees):
            break
        if getattr(client, "batch_only", False):
            continue  # handled by the per-file batch pass
        # Skip sources that can't supply any still-needed field (e.g. OSM
        # provides NAICS only — useless when just employees are missing).
        provides = set(getattr(client, "provides", ("naics", "employees")))
        needed = set()
        if need_naics:
            needed.add("naics")
        if need_employees:
            needed.add("employees")
        if not provides & needed:
            continue
        if not getattr(client, "local", False):
            if budget["remaining"] <= 0:
                errors.append(
                    ("pipeline", "MAX_API_CALLS_PER_RUN budget exhausted")
                )
                break
            budget["remaining"] -= 1

        try:
            candidates = client.lookup(record)
        except (ClientError, TransientError) as e:
            errors.append((client.name, str(e)))
            continue
        except Exception as e:  # unexpected parser bug — don't kill the run
            errors.append((client.name, "unexpected: {}".format(e)))
            continue

        best, score = pick_best_candidate(
            record["name"], record["zip"], candidates, settings.zip_match_bonus
        )
        if best is None or score < settings.match_threshold:
            errors.append(
                (
                    client.name,
                    "no match returned" if not candidates
                    else "best candidate below threshold (score={})".format(score),
                )
            )
            continue

        result["matched_any"] = True
        contributed = False
        if need_naics and getattr(best, "naics_code", None):
            result["naics"] = best.naics_code
            result["naics_source"] = client.name
            need_naics = False
            contributed = True
        if need_employees and getattr(best, "employees", None) not in (None, ""):
            result["employees"] = best.employees
            result["employees_source"] = client.name
            need_employees = False
            contributed = True
        if contributed:
            result["contributed_sources"].append(client.name)
            # Inferred sources may cap display confidence below the raw
            # similarity score (e.g. name_rule self-matches at ~100).
            shown = getattr(best, "confidence", None) or score
            result["confidence"] = max(shown, result["confidence"] or 0)
        else:
            errors.append(
                (client.name, "matched but added no new fields")
            )
    return result, errors


def process_file(path, clients, settings, failures, budget):
    """Enrich one input file; returns per-file stats dict."""
    df = read_input(path)
    mapping = map_columns(df)
    if settings.max_records_per_file:
        df = df.head(settings.max_records_per_file)

    stats = {
        "file": path.name,
        "records_processed": 0,
        "naics_already_reported": 0,
        "enriched_bizapi": 0,
        "enriched_explorium": 0,
        "enriched_apify_dnb": 0,
        "enriched_osm": 0,
        "enriched_sec_edgar": 0,
        "enriched_name_rule": 0,
        "employees_enriched": 0,
        "employee_estimates": 0,
        "match_failures": 0,
        "api_errors": 0,
        "skipped_budget": 0,
    }

    out_rows = {c: [] for c in ENRICHMENT_COLUMNS}
    row_counties = []  # comptroller county code per output row
    pending_batch = []  # (row_position, record) still missing fields
    for idx, row in df.iterrows():
        stats["records_processed"] += 1
        record = row_to_record(row, mapping)
        record["query_string"] = build_query_string(row, mapping)

        naics_enriched = record["reported_naics"]
        naics_source = "reported" if naics_enriched else ""
        employees = ""
        employees_source = ""
        confidence = ""

        if naics_enriched:
            stats["naics_already_reported"] += 1

        needs_api = (not naics_enriched) or settings.lookup_when_naics_present
        if needs_api:
            if budget["remaining"] <= 0:
                stats["skipped_budget"] += 1
                failures.log(path.name, record, "pipeline",
                             "skipped: MAX_API_CALLS_PER_RUN budget exhausted")
            else:
                result, errors = enrich_record(record, clients, settings, budget)
                for src in result["contributed_sources"]:
                    stats["enriched_{}".format(src)] = (
                        stats.get("enriched_{}".format(src), 0) + 1
                    )
                if not result["contributed_sources"]:
                    stats["match_failures"] += 1
                if result["naics"] and not naics_enriched:
                    naics_enriched = result["naics"]
                    naics_source = result["naics_source"]
                if result["employees"] is not None and result["employees"] != "":
                    employees = result["employees"]
                    employees_source = result["employees_source"]
                    stats["employees_enriched"] += 1
                if result["confidence"]:
                    confidence = result["confidence"]
                for api, err in errors:
                    stats["api_errors"] += 1
                    failures.log(path.name, record, api, err)
                # Queue for batch sources (Apify D&B) if fields still missing.
                if not employees or (not naics_enriched):
                    pending_batch.append((len(out_rows["Query_String"]), record))

        out_rows["Query_String"].append(record["query_string"])
        out_rows["NAICS_Code_Enriched"].append(naics_enriched or "")
        out_rows["NAICS_Title"].append(naics_title(naics_enriched or ""))
        out_rows["NAICS_Source"].append(naics_source)
        out_rows["Employee_Count"].append(employees)
        out_rows["Employee_Count_Source"].append(employees_source)
        out_rows["Employee_Estimate"].append("")
        out_rows["Employee_Estimate_Source"].append("")
        out_rows["Match_Confidence"].append(confidence)
        row_counties.append(record["county_code"])

        if stats["records_processed"] % 100 == 0:
            logger.info(
                "%s: %d/%d rows processed",
                path.name, stats["records_processed"], len(df),
            )

    # ---- batch-source pass (e.g. Apify D&B actor runs) ------------------
    batch_clients = [c for c in clients if getattr(c, "batch_only", False)]
    if batch_clients and pending_batch:
        run_batch_pass(
            batch_clients, pending_batch, out_rows, stats,
            settings, failures, path.name,
        )

    # ---- employee-estimate pass (Census CBP county averages) ----------
    # Only fills Employee_Estimate for rows with a NAICS but no real
    # employee count. Clearly labeled as an estimate.
    if settings.employee_estimates_enabled:
        from estimator import county_fips, estimate
        for i in range(len(out_rows["Employee_Count"])):
            if out_rows["Employee_Count"][i] not in ("", None):
                continue
            naics = out_rows["NAICS_Code_Enriched"][i]
            if not naics:
                continue
            val = estimate(naics, county_fips(row_counties[i]))
            if val is not None:
                out_rows["Employee_Estimate"][i] = val
                out_rows["Employee_Estimate_Source"][i] = "cbp2022_county_avg"
                stats["employee_estimates"] += 1

    for col, values in out_rows.items():
        df[col] = values
    return df, stats


def run_batch_pass(batch_clients, pending_batch, out_rows, stats,
                   settings, failures, filename):
    """Submit records still missing fields to batch-oriented sources.

    Actor runs take minutes each, so records are grouped by city and sent
    in chunked ``queries`` lists per run — honoring per-file and per-run
    query caps. Returned items are fuzzy-matched back to records.
    """
    for client in batch_clients:
        quota = settings.apify_max_queries_per_file or float("inf")
        remaining_fn = getattr(client, "queries_remaining", None)
        if callable(remaining_fn):
            quota = min(quota, remaining_fn())
        if quota <= 0:
            continue

        groups = {}
        for pos, record in pending_batch:
            key = (record["city"], record["state"] or "TX")
            groups.setdefault(key, []).append((pos, record))

        for (city, state), entries in groups.items():
            i = 0
            while i < len(entries) and quota > 0:
                chunk = entries[i:i + settings.apify_batch_size][:int(quota)]
                queries = [
                    normalize_name(r["name"]).title() or r["name"]
                    for _, r in chunk
                ]
                logger.info(
                    "%s: %s batch — %d queries for %s, %s",
                    filename, client.name, len(queries), city, state,
                )
                try:
                    items = client.run_queries(queries, city=city, state=state)
                except (ClientError, TransientError) as e:
                    stats["api_errors"] += 1
                    for _, rec in chunk:
                        failures.log(filename, rec, client.name, str(e))
                    quota -= len(chunk)
                    i += len(chunk)
                    continue
                quota -= len(chunk)
                i += len(chunk)

                candidates = []
                for item in items:
                    candidates.extend(client.to_candidates(item))

                for pos, record in chunk:
                    best, score = pick_best_candidate(
                        record["name"], record["zip"], candidates,
                        settings.zip_match_bonus,
                    )
                    if best is None or score < settings.match_threshold:
                        stats["api_errors"] += 1
                        failures.log(
                            filename, record, client.name,
                            "no acceptable batch match (score={})".format(score),
                        )
                        continue
                    filled = False
                    if (not out_rows["NAICS_Code_Enriched"][pos]
                            and getattr(best, "naics_code", None)):
                        out_rows["NAICS_Code_Enriched"][pos] = best.naics_code
                        out_rows["NAICS_Title"][pos] = naics_title(best.naics_code)
                        out_rows["NAICS_Source"][pos] = client.name
                        filled = True
                    if (out_rows["Employee_Count"][pos] in ("", None)
                            and getattr(best, "employees", None) not in (None, "")):
                        out_rows["Employee_Count"][pos] = best.employees
                        out_rows["Employee_Count_Source"][pos] = client.name
                        stats["employees_enriched"] += 1
                        filled = True
                    if filled:
                        stats["enriched_{}".format(client.name)] = (
                            stats.get("enriched_{}".format(client.name), 0) + 1
                        )
                        existing = out_rows["Match_Confidence"][pos] or 0
                        out_rows["Match_Confidence"][pos] = max(score, int(existing))
                        # batch rescued a row the waterfall failed
                        if stats["match_failures"] > 0:
                            stats["match_failures"] -= 1
                    else:
                        stats["api_errors"] += 1
                        failures.log(
                            filename, record, client.name,
                            "batch match added no new fields",
                        )


def write_output(df, input_path, output_dir):
    out_path = Path(output_dir) / input_path.name
    if input_path.suffix.lower() == ".csv":
        df.to_csv(out_path, index=False)
    else:
        df.to_excel(out_path, index=False)
    return out_path


def run_pipeline(settings, only_file=None):
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    input_dir, output_dir = settings.input_path, settings.output_path
    output_dir.mkdir(parents=True, exist_ok=True)

    if settings.mock_mode:
        logger.info("MOCK_MODE enabled — no real API calls will be made.")

    files = iter_input_files(input_dir)
    if only_file:
        files = [f for f in files if f.name == only_file]
    if not files:
        logger.error("No input files found in %s", input_dir)
        return []

    clients = build_clients(settings)
    failures = FailureLogger(output_dir)
    budget = {
        "remaining": settings.max_api_calls_per_run or float("inf")
    }

    all_stats = []
    for path in files:
        logger.info("Processing %s ...", path.name)
        try:
            df, stats = process_file(path, clients, settings, failures, budget)
        except Exception:
            logger.exception("Failed to process %s", path.name)
            all_stats.append({"file": path.name, "records_processed": 0,
                              "naics_already_reported": 0, "enriched_bizapi": 0,
                              "enriched_explorium": 0, "enriched_apify_dnb": 0,
                              "enriched_osm": 0, "enriched_sec_edgar": 0,
                              "enriched_name_rule": 0,
                              "employees_enriched": 0, "employee_estimates": 0,
                              "match_failures": 0, "api_errors": 0,
                              "skipped_budget": 0})
            continue
        # Flush any client-side caches after each file so progress survives
        # interruptions (matters for slow free sources like Nominatim).
        for client in clients:
            flush = getattr(client, "flush", None)
            if callable(flush):
                flush()

        out_path = write_output(df, path, output_dir)
        all_stats.append(stats)
        matched = sum(
            v for k, v in stats.items()
            if k.startswith("enriched_") and isinstance(v, int)
        )
        logger.info(
            "%s -> %s | %d rows, %d enrichments, %d failures",
            path.name, out_path.name, stats["records_processed"],
            matched, stats["match_failures"],
        )

    write_summary(all_stats, output_dir)
    logger.info("Done. %d failed API events logged to %s",
                failures.count, failures.path)
    return all_stats


def write_summary(all_stats, output_dir):
    cols = [
        "file", "records_processed", "naics_already_reported",
        "enriched_sec_edgar",
        "enriched_bizapi", "enriched_explorium", "enriched_name_rule",
        "enriched_osm", "enriched_apify_dnb",
        "employees_enriched", "employee_estimates",
        "match_failures", "api_errors", "skipped_budget",
    ]
    total = {"file": "TOTAL"}
    for c in cols[1:]:
        total[c] = sum(int(s.get(c, 0)) for s in all_stats)
    summary = pd.DataFrame(all_stats + [total], columns=cols)
    summary.to_csv(Path(output_dir) / SUMMARY_FILE, index=False)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mock", action="store_true",
                        help="Force mock mode regardless of .env")
    parser.add_argument("--real", action="store_true",
                        help="Force real API mode regardless of .env")
    parser.add_argument("--input-dir", help="Override INPUT_DIR")
    parser.add_argument("--output-dir", help="Override OUTPUT_DIR")
    parser.add_argument("--max-records", type=int, default=None,
                        help="Process at most N records per file")
    parser.add_argument("--file", help="Process only this filename")
    args = parser.parse_args(argv)

    settings = load_settings()
    if args.mock:
        settings.mock_mode = True
    if args.real:
        settings.mock_mode = False
    if args.input_dir:
        settings.input_dir = args.input_dir
    if args.output_dir:
        settings.output_dir = args.output_dir
    if args.max_records is not None:
        settings.max_records_per_file = args.max_records

    stats = run_pipeline(settings, only_file=args.file)
    return 0 if stats is not None else 1


if __name__ == "__main__":
    sys.exit(main())
