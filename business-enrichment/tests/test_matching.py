"""Unit tests for fuzzy matching logic."""

import pytest

from matching import (
    extract_zip5,
    name_similarity,
    normalize_name,
    pick_best_candidate,
    score_candidate,
)


class TestNormalizeName:
    def test_lowercases_and_strips_punctuation(self):
        assert normalize_name("Express Pet Spa, LLC") == "express pet spa"

    def test_strips_legal_suffixes(self):
        assert normalize_name("BAYVIEW CONSULTING CORP.") == "bayview consulting"
        assert normalize_name("Puro Pinche Fiesta, L.L.C.") == "puro pinche fiesta"

    def test_none_and_empty(self):
        assert normalize_name(None) == ""
        assert normalize_name("") == ""

    def test_collapses_whitespace(self):
        assert normalize_name("Joe's   Auto   Repair  INC") == "joe auto repair"


class TestExtractZip5:
    def test_plain_zip(self):
        assert extract_zip5("78566") == "78566"

    def test_zip_plus_four(self):
        assert extract_zip5("78566-1234") == "78566"

    def test_excel_float_zip(self):
        assert extract_zip5("78566.0") == "78566"
        assert extract_zip5(78566.0) == "78566"

    def test_numeric_zip(self):
        assert extract_zip5(78566) == "78566"

    def test_missing(self):
        assert extract_zip5(None) == ""
        assert extract_zip5("") == ""
        assert extract_zip5("nan") == ""


class TestNameSimilarity:
    def test_identical_names_score_100(self):
        assert name_similarity("EXPRESS PET SPA, LLC", "Express Pet Spa") == 100

    def test_different_companies_score_low(self):
        score = name_similarity("EXPRESS PET SPA, LLC", "BROWNSVILLE TIRE SHOP")
        assert score < 50

    def test_reordered_tokens_still_match(self):
        score = name_similarity("GARCIA FAMILY RESTAURANT LLC",
                                "Garcia Restaurant Family")
        assert score >= 90


class TestScoreCandidate:
    def test_exact_match_accepted(self):
        cand = {"name": "Express Pet Spa", "zip": "78566"}
        assert score_candidate("EXPRESS PET SPA, LLC", "78566", cand) == 100

    def test_wrong_company_rejected(self):
        cand = {"name": "Totally Different Corp", "zip": "78566"}
        assert score_candidate("EXPRESS PET SPA, LLC", "78566", cand) < 85

    def test_zip_bonus_pushes_borderline_over_threshold(self):
        # A partial name match alone should score below 85...
        cand = {"name": "BAYVIEW CONSULTING GROUP", "zip": "79935"}
        score_no_zip = score_candidate("BAYVIEW CONSULTING CORP.", "78566", cand)
        cand_same_zip = {"name": "BAYVIEW CONSULTING GROUP", "zip": "78566"}
        score_with_zip = score_candidate(
            "BAYVIEW CONSULTING CORP.", "78566", cand_same_zip
        )
        assert score_with_zip == min(100, score_no_zip + 5)

    def test_score_capped_at_100(self):
        cand = {"name": "Express Pet Spa", "zip": "78566"}
        assert score_candidate("Express Pet Spa", "78566", cand) == 100


class TestPickBestCandidate:
    def test_prefers_zip_aligned_candidate(self):
        cands = [
            {"name": "Express Pet Spa", "zip": "79935"},
            {"name": "Express Pet Spa", "zip": "78566"},
        ]
        best, score = pick_best_candidate("EXPRESS PET SPA", "78566", cands)
        assert best["zip"] == "78566"

    def test_empty_candidates(self):
        best, score = pick_best_candidate("ANY", "78566", [])
        assert best is None and score == 0

    def test_highest_score_wins(self):
        cands = [
            {"name": "Something Else Entirely", "zip": "78566"},
            {"name": "Express Pet Spa LLC", "zip": "78566"},
        ]
        best, score = pick_best_candidate("EXPRESS PET SPA", "78566", cands)
        assert "Pet Spa" in best["name"]


class TestOSMMapping:
    def test_common_tags_map(self):
        from clients.osm_nominatim import naics_from_tags
        assert naics_from_tags({"amenity": "restaurant"}) == "722511"
        assert naics_from_tags({"shop": "supermarket"}) == "445110"
        assert naics_from_tags({"office": "insurance"}) == "524210"
        assert naics_from_tags({"amenity": "fuel"}) == "447110"

    def test_unmapped_tag_returns_none(self):
        from clients.osm_nominatim import naics_from_tags
        assert naics_from_tags({"amenity": "bench"}) is None
        assert naics_from_tags({}) is None

    def test_parse_extracts_naics_candidate(self):
        from clients.osm_nominatim import OSMNominatimClient
        items = [{
            "display_name": "Taco Place, 100 Main St, Edinburg, TX",
            "name": "Taco Place",
            "category": "amenity",
            "type": "restaurant",
            "extratags": {"amenity": "restaurant", "cuisine": "mexican"},
            "address": {"postcode": "78539", "city": "Edinburg"},
        }]
        cands = OSMNominatimClient._parse(items)
        assert len(cands) == 1
        assert cands[0].naics_code == "722511"
        assert cands[0].zip == "78539"
        assert cands[0].employees is None
