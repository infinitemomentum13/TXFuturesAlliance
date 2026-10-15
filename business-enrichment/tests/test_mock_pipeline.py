"""End-to-end test of the pipeline in mock mode (no API credits used)."""

import pandas as pd
import pytest

from config import Settings
from pipeline import (
    ENRICHMENT_COLUMNS,
    clean_naics,
    map_columns,
    run_pipeline,
)

COLUMNS = [
    "Taxpayer Number", "Taxpayer Name", "Taxpayer Address", "Taxpayer City",
    "Taxpayer State", "Taxpayer Zip", "Taxpayer County Code",
    "Taxpayer Organizational Type", "Record Type Code",
    "Responsibility Beginning Date", "SOS or COA File Number",
    "SOS Charter Date", "SOS Status Date", "SOS Status Code",
    "Right to Transact Business Code", "Current Exempt Reason Code",
    "Exempt Begin Date", "NAICS Code",
]

ROWS = [
    ["32044263823", "PURO PINCHE FIESTA, L.L.C.", "129 N VALENCIA",
     "BAYVIEW", "TX", "78566", "31", "CL", "U", "2011-05-17", "801426587",
     "2011-05-17", "2011-05-17", "A", "A", None, None, None],
    ["32015528949", "EXPRESS PET SPA, LLC", "611 BAYVIEW DR", "EL LAGO",
     "TX", "77586", "101", "CL", "U", "2004-07-30", "800371829",
     "2004-07-30", "2010-05-05", "R", "A", None, None, None],
    ["32072667119", "BAYVIEW CONSULTING CORP.", "11020 ARGAL CT", "EL PASO",
     "TX", "79935", "71", "CT", "U", "2019-11-27", "803480366",
     "2019-11-27", "2019-11-27", "A", "A", None, None, "722511"],
]


def _settings(tmp_path):
    inp = tmp_path / "in"
    out = tmp_path / "out"
    inp.mkdir()
    return Settings(
        mock_mode=True,
        input_dir=str(inp),
        output_dir=str(out),
        retry_attempts=2,
    )


def _write_input(settings):
    df = pd.DataFrame(ROWS, columns=COLUMNS)
    path = settings.input_path / "test businesses.xlsx"
    df.to_excel(path, index=False)
    return path


def test_map_columns_handles_variant_headers():
    df = pd.DataFrame(ROWS, columns=COLUMNS)
    mapping = map_columns(df)
    for field_name in ("name", "address", "city", "state", "zip", "naics"):
        assert field_name in mapping
    assert mapping["name"] == "Taxpayer Name"


def test_clean_naics():
    assert clean_naics("722511") == "722511"
    assert clean_naics("722511.0") == "722511"
    assert clean_naics(None) is None
    assert clean_naics("NaN") is None


def test_mock_pipeline_end_to_end(tmp_path):
    settings = _settings(tmp_path)
    _write_input(settings)

    stats = run_pipeline(settings)
    assert len(stats) == 1
    s = stats[0]
    assert s["records_processed"] == 3

    out = settings.output_path / "test businesses.xlsx"
    assert out.exists()
    result = pd.read_excel(out, dtype=str)
    for col in ENRICHMENT_COLUMNS:
        assert col in result.columns

    # The row with a reported NAICS keeps it and is flagged 'reported'.
    reported = result[result["Taxpayer Name"] == "BAYVIEW CONSULTING CORP."].iloc[0]
    assert reported["NAICS_Code_Enriched"] == "722511"
    assert reported["NAICS_Source"] == "reported"

    # Summary + failed-lookups artifacts are produced.
    assert (settings.output_path / "enrichment_summary.csv").exists()
    assert (settings.output_path / "failed_lookups.csv").exists()
    summary = pd.read_csv(settings.output_path / "enrichment_summary.csv")
    assert summary.iloc[-1]["file"] == "TOTAL"


def test_mock_determinism(tmp_path):
    """Same input -> same enriched values across runs."""
    settings = _settings(tmp_path)
    _write_input(settings)
    run_pipeline(settings)
    first = pd.read_excel(settings.output_path / "test businesses.xlsx", dtype=str)
    run_pipeline(settings)
    second = pd.read_excel(settings.output_path / "test businesses.xlsx", dtype=str)
    pd.testing.assert_frame_equal(first, second)


def test_budget_cap_skips_api(tmp_path):
    settings = _settings(tmp_path)
    settings.max_api_calls_per_run = 1
    _write_input(settings)
    stats = run_pipeline(settings)
    s = stats[0]
    # One row got API calls, the rest were skipped by the budget.
    assert s["skipped_budget"] == 2
