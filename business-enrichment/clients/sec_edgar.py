"""Free, no-key source: SEC EDGAR bulk registrant data.

Uses the EDGAR submissions bulk download
(``Archives/edgar/daily-index/bulkdata/submissions.zip``) — one JSON file
per filer containing name, SIC code, state of incorporation and business
address ZIP. The zip is converted once by ``scripts/build_edgar_index.py``
into ``cache/edgar_index.csv``; lookups are then instant local dictionary
hits — no HTTP, no rate limits, no credits.

Coverage is limited to entities that ever filed with the SEC (public
companies, funds, Form D issuers). SIC -> NAICS-2022 via the bundled
``sic_to_naics_2022.csv`` crosswalk.
"""

import csv
import logging
from pathlib import Path

from .base import BaseClient, Candidate, ClientError
from matching import normalize_name

logger = logging.getLogger(__name__)


def _load_sic_crosswalk(path):
    mapping = {}
    try:
        with open(path, newline="") as f:
            for row in csv.DictReader(f):
                sic = (row.get("sic1987") or "").strip()
                naics = (row.get("naics2022") or "").strip()
                if sic and naics and sic not in mapping:
                    mapping[sic] = naics  # first (primary) mapping wins
    except OSError:
        logger.warning("SIC crosswalk %s not found", path)
    return mapping


class SECEdgarClient(BaseClient):
    name = "sec_edgar"
    provides = ("naics",)  # EDGAR carries no employee data
    local = True

    def __init__(self, settings, index_file=None, crosswalk_file=None):
        super().__init__(settings)
        root = Path(__file__).resolve().parent.parent
        self.index_file = Path(
            index_file or settings.resolve("cache/edgar_index.csv")
        )
        self.crosswalk = _load_sic_crosswalk(
            crosswalk_file or root / "sic_to_naics_2022.csv"
        )
        self._index = None  # normalized_name -> [ {name,cik,sic,state,zip} ]

    def _ensure_index(self):
        if self._index is None:
            if not self.index_file.exists():
                raise ClientError(
                    "EDGAR index missing: run "
                    "scripts/build_edgar_index.py first "
                    "(downloads ~1.6GB submissions.zip once)"
                )
            idx = {}
            with open(self.index_file, newline="") as f:
                for row in csv.DictReader(f):
                    idx.setdefault(row["norm"], []).append(
                        {
                            "name": row["name"],
                            "cik": row["cik"],
                            "sic": row["sic"],
                            "state": row["state"],
                            "zip": row["zip"],
                        }
                    )
            self._index = idx
            logger.info("EDGAR index loaded: %d distinct names", len(idx))

    def lookup(self, record):
        self._ensure_index()
        hits = self._index.get(normalize_name(record["name"])) or []
        candidates = []
        for h in hits:
            naics = self.crosswalk.get(str(h["sic"]).strip())
            if not naics:
                continue  # SIC missing or unmappable — nothing to contribute
            candidates.append(
                Candidate(
                    name=h["name"],
                    naics_code=naics,
                    employees=None,
                    state=h["state"],
                    zip=h["zip"],
                    duns=None,
                    raw=h,
                )
            )
        return candidates
