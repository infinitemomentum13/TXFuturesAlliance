"""Build the local EDGAR filer index used by clients/sec_edgar.py.

Streams the SEC EDGAR submissions bulk zip (downloaded once to
cache/submissions.zip — ~1.6GB) and emits a slim CSV index:
  norm_name, cik, name, sic, state, zip

Usage:
    python scripts/build_edgar_index.py            # download + build
    python scripts/build_edgar_index.py --build-only   # zip already present
"""

import csv
import json
import logging
import sys
import zipfile
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from matching import normalize_name  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ZIP_PATH = ROOT / "cache" / "submissions.zip"
OUT_PATH = ROOT / "cache" / "edgar_index.csv"
URL = "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip"
UA = {"User-Agent": "TexasBizEnrichment/1.0 (admin@txfuturesalliance.org)"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("edgar_index")


def download():
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    log.info("Downloading %s (~1.6GB) ...", URL)
    with requests.get(URL, headers=UA, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(ZIP_PATH, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    log.info("Download complete: %s", ZIP_PATH)


def build():
    log.info("Building index from %s ...", ZIP_PATH)
    n = written = 0
    with zipfile.ZipFile(ZIP_PATH) as z, open(OUT_PATH, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["norm", "cik", "name", "sic", "state", "zip"])
        for member in z.namelist():
            if not member.endswith(".json"):
                continue
            n += 1
            try:
                rec = json.loads(z.read(member))
            except (ValueError, KeyError):
                continue
            name = rec.get("name")
            if not name:
                continue
            biz = (rec.get("addresses") or {}).get("business") or {}
            w.writerow(
                [
                    normalize_name(name),
                    rec.get("cik") or "",
                    name,
                    rec.get("sic") or "",
                    rec.get("stateOfIncorporation") or "",
                    biz.get("zip1") or "",
                ]
            )
            written += 1
            if n % 50000 == 0:
                log.info("  %d members scanned, %d indexed", n, written)
    log.info("Done: %d filers indexed -> %s", written, OUT_PATH)


if __name__ == "__main__":
    if "--build-only" not in sys.argv:
        download()
    build()
