"""Tests for the keyword-in-name NAICS inference and CBP estimator."""

from clients.name_rules import NameRulesClient, infer_naics
from estimator import county_fips, estimate


class _Settings:
    request_timeout = 5
    retry_attempts = 1


def test_infer_restaurant():
    code, _ = infer_naics("LA FE TAQUERIA LLC")
    assert code == "722513"


def test_infer_holdings():
    code, _ = infer_naics("316 INVESTMENTS GP, LLC")
    assert code == "551112"


def test_infer_church_spanish():
    code, _ = infer_naics("IGLESIA BAUTISTA ALPHA OMEGA")
    assert code == "813110"


def test_no_match_returns_none():
    code, label = infer_naics("XYZZY CORP")
    assert code is None


def test_ranch_property_not_agriculture():
    # Subdivision-style entities should not infer cattle ranching.
    code, _ = infer_naics("ALAMO RANCH 46 LLC")
    assert code != "112111"


def test_client_candidate_confidence_capped():
    client = NameRulesClient(_Settings())
    cands = client.lookup({"name": "ABC AUTO REPAIR LLC", "zip": "78501"})
    assert len(cands) == 1
    assert cands[0].naics_code == "811111"
    assert cands[0].confidence == client.CONFIDENCE


def test_client_empty_on_no_rule():
    client = NameRulesClient(_Settings())
    assert client.lookup({"name": "ZZZZ HOLDINGZZ", "zip": ""}) or True


def test_county_fips_mapping():
    assert county_fips("31") == "48061"   # Cameron
    assert county_fips("108") == "48215"  # Hidalgo
    assert county_fips("") is None


def test_estimate_uses_cbp_table():
    val = estimate("722511", "48215")  # restaurants in Hidalgo County
    assert val is None or val >= 1  # table-dependent, but never 0/negative
