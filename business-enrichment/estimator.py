"""Census County Business Patterns (CBP) employee estimates.

Provides average-employees-per-establishment by NAICS x county for
Cameron (FIPS 48061) and Hidalgo (48215) counties, built from the 2022
CBP county file (cbp22co.txt, www2.census.gov/programs-surveys/cbp).

Used to fill `Employee_Estimate` when no source supplies a real employee
count. Clearly labeled — these are industry averages, not actuals.
"""

import csv
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

CBP_TABLE = Path(__file__).resolve().parent / "cache" / "cbp_2022_cameron_hidalgo.csv"

# Comptroller county codes are the alphabetical Texas county numbering
# (1-254); FIPS county codes are 2*n - 1 (e.g. Cameron 31 -> 48061).
def county_fips(code):
    digits = re.sub(r"\D", "", str(code or ""))
    if not digits:
        return None
    n = int(digits)
    if 1 <= n <= 254:
        return "48{:03d}".format(n * 2 - 1)
    return None

# CBP rolls some sectors into combined codes.
_SECTOR_GROUPS = {
    "31": "31-33", "32": "31-33", "33": "31-33",
    "44": "44-45", "45": "44-45",
    "48": "48-49", "49": "48-49",
}

_TABLE = None


def _norm_naics(code):
    """'11411/' -> '11411', '11----' -> '11', keep '31-33'."""
    code = str(code).strip()
    if "-" in code:
        return code
    return re.sub(r"[^\d]", "", code)


def load_table():
    """{(fips, naics): avg_employees_per_establishment}"""
    global _TABLE
    if _TABLE is not None:
        return _TABLE
    _TABLE = {}
    if not CBP_TABLE.exists():
        logger.warning("CBP table missing at %s — estimates disabled", CBP_TABLE)
        return _TABLE
    with open(CBP_TABLE, newline="") as f:
        for row in csv.DictReader(f):
            naics = _norm_naics(row["naics"])
            try:
                emp, est = float(row["emp"]), float(row["est"])
            except (TypeError, ValueError):
                continue
            if est > 0 and emp > 0:
                _TABLE[(row["fipscty"], naics)] = emp / est
                _TABLE[("48" + row["fipscty"], naics)] = emp / est
    logger.info("CBP table loaded: %d county/NAICS cells", len(_TABLE))
    return _TABLE


def estimate(naics, fips):
    """Average employees/establishment for this NAICS in this county.

    Falls back from the 6-digit code up through parent levels, then to
    CBP's combined sector codes (31-33 etc.). Returns int or None.
    """
    if not naics:
        return None
    table = load_table()
    code = re.sub(r"[^\d]", "", str(naics))[:6]
    fips = str(fips)[-3:] if fips else None
    for key in (fips, "061", "215"):  # record county, then either county
        if not key:
            continue
        for length in (6, 5, 4, 3, 2):
            parent = code[:length]
            ratio = table.get((key, parent))
            if ratio is None and length == 2:
                ratio = table.get((key, _SECTOR_GROUPS.get(parent, parent)))
            if ratio:
                return max(1, round(ratio))
    return None
