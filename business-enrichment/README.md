# Texas Business Data Enrichment Pipeline

Enriches Texas Comptroller taxpayer files (`.xlsx` / `.csv`) with NAICS
codes and total employee counts via a waterfall of firmographic sources:

| Order | Source | Notes |
|-------|--------|-------|
| 1 | NAICS Association [BizAPI](https://www.naics.com/bizapi-documents-v2/) | Basic auth, 3 req/sec cap |
| 2 | [Explorium](https://developers.explorium.ai) firmographics | Free tier ~500 enrichments/mo, capped automatically |
| 3 | [Apify](https://apify.com/memo23/dnb-scraper) D&B directory scraper | Employees + DUNS only. Batch mode: chunked queries per async actor run after each file |
| 4 | [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) | **Free, no key.** NAICS only (tag→NAICS map), 1 req/sec, disk-cached |

The waterfall uses **field completion**: each accepted source fills
whichever fields (NAICS, employees) are still missing, so a partial match
never blocks a richer lookup downstream. Sources without credentials are
skipped automatically; `osm` always runs when enabled since it needs no key.

API candidates are accepted only when the fuzzy name similarity
(`thefuzz` token-set ratio, legal suffixes stripped) reaches
`MATCH_THRESHOLD` (default 85); a ZIP-5 match adds `ZIP_MATCH_BONUS` points.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit .env
```

Input files go in `input_data/` (already populated with the Cameron
County city files). Run:

```bash
python pipeline.py            # uses .env settings (mock mode by default)
python pipeline.py --max-records 25 --file "Active Businesses Bayview.xlsx"
```

## Mock mode

`MOCK_MODE=true` (the default) makes all three sources return
deterministic simulated responses — success, no-match, wrong-ZIP, and
transient-error outcomes — so the full pipeline and tests run with **zero
API credits**. Set `MOCK_MODE=false` and fill in credentials for real runs.
Sources without credentials are skipped automatically.

## Outputs (in `output_data/`)

- `<original filename>` — input rows plus `Query_String`,
  `NAICS_Code_Enriched`, `NAICS_Source`, `Employee_Count`,
  `Employee_Count_Source`, `Match_Confidence`.
- `enrichment_summary.csv` — per-file and total counts: records processed,
  enrichments per source, employee counts filled, failures.
- `failed_lookups.csv` — every failed API event (query string + error) for
  manual review.
- `.explorium_usage.json` — persisted monthly Explorium call counter.
- `../cache/osm_cache.json` — persisted Nominatim results so interrupted
  or repeated runs never re-query OSM for the same business.

## Behavior notes

- Rows that already report a `NAICS Code` keep it
  (`NAICS_Source=reported`); APIs are still consulted for employee counts
  unless `LOOKUP_EMPLOYEES_WHEN_NAICS_PRESENT=false`.
- Transient errors (timeouts, 429, 5xx) retry with exponential backoff
  (`RETRY_ATTEMPTS`, `tenacity`); auth/400 errors fail fast to the next
  source.
- `MAX_API_CALLS_PER_RUN` bounds total spend per run;
  `MAX_RECORDS_PER_FILE` is handy for smoke-testing real APIs.

## Tests

```bash
pytest tests/ -v
```
