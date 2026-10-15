"""Fuzzy name/ZIP matching between input records and API candidates."""

import re
import warnings

# thefuzz emits a speed warning when python-Levenshtein is missing; harmless.
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from thefuzz import fuzz

# Common legal-entity suffixes stripped before comparing names.
_ENTITY_SUFFIXES = {
    "llc", "llp", "lp", "ltd", "inc", "co", "corp", "corporation", "company",
    "pllc", "pc", "pa", "pllp", "dba", "lc", "gmbh", "sa", "the",
}

_POSSESSIVE_RE = re.compile(r"['\u2019]s\b")
_APOSTROPHE_RE = re.compile(r"['\u2019]")
_PERIOD_RE = re.compile(r"\.")
_PUNCT_RE = re.compile(r"[^a-z0-9 ]+")
_WS_RE = re.compile(r"\s+")
_DIGITS_RE = re.compile(r"\D")


def normalize_name(name):
    """Uppercase-insensitive normalization: lowercase, drop possessives and
    periods (so 'L.L.C.' -> 'llc' and \"Joe's\" -> 'joe'), strip remaining
    punctuation, drop common legal suffixes, collapse whitespace."""
    if name is None:
        return ""
    text = str(name).lower()
    text = _POSSESSIVE_RE.sub("", text)
    text = _APOSTROPHE_RE.sub("", text)
    text = _PERIOD_RE.sub("", text)
    text = _PUNCT_RE.sub(" ", text)
    tokens = [t for t in _WS_RE.split(text) if t and t not in _ENTITY_SUFFIXES]
    return " ".join(tokens)


def extract_zip5(zip_value):
    """Extract a 5-digit ZIP string from values like 78566, '78566-1234',
    78566.0 (Excel float), or ' 78566 '. Returns '' when unavailable."""
    if zip_value is None:
        return ""
    text = str(zip_value).strip()
    if not text or text.lower() == "nan":
        return ""
    # Handle floats read from Excel, e.g. "78566.0"
    if re.fullmatch(r"\d+\.0+", text):
        text = text.split(".")[0]
    digits = _DIGITS_RE.sub("", text)
    if len(digits) >= 5:
        return digits[:5]
    return digits


def name_similarity(query_name, candidate_name):
    """Fuzzy similarity 0-100 between a taxpayer name and an API-returned
    company name, using normalized token-set ratio."""
    q = normalize_name(query_name)
    c = normalize_name(candidate_name)
    if not q or not c:
        return 0
    return fuzz.token_set_ratio(q, c)


def score_candidate(query_name, query_zip, candidate, zip_bonus=5):
    """Score a candidate against the query record.

    Base score is the fuzzy name similarity; a ZIP-5 match adds ``zip_bonus``
    (capped at 100) so address-aligned candidates win ties.

    ``candidate`` may be a Candidate dataclass or any object/dict with
    ``name`` and ``zip`` attributes/keys.
    """
    if isinstance(candidate, dict):
        cand_name = candidate.get("name") or ""
        cand_zip = candidate.get("zip") or candidate.get("postal_code") or ""
    else:
        cand_name = getattr(candidate, "name", "") or ""
        cand_zip = getattr(candidate, "zip", "") or getattr(candidate, "postal_code", "") or ""

    score = name_similarity(query_name, cand_name)
    qz, cz = extract_zip5(query_zip), extract_zip5(cand_zip)
    if qz and cz and qz == cz:
        score = min(100, score + zip_bonus)
    return score


def _raw_score(query_name, query_zip, candidate, zip_bonus):
    """Uncapped score used only for ranking, so the ZIP bonus can break
    ties between candidates that both reach 100 on name alone."""
    if isinstance(candidate, dict):
        cand_name = candidate.get("name") or ""
        cand_zip = candidate.get("zip") or candidate.get("postal_code") or ""
    else:
        cand_name = getattr(candidate, "name", "") or ""
        cand_zip = getattr(candidate, "zip", "") or getattr(candidate, "postal_code", "") or ""
    score = name_similarity(query_name, cand_name)
    qz, cz = extract_zip5(query_zip), extract_zip5(cand_zip)
    if qz and cz and qz == cz:
        score += zip_bonus
    return score


def pick_best_candidate(query_name, query_zip, candidates, zip_bonus=5):
    """Return (candidate, score) for the highest-scoring candidate, or
    (None, 0) when no candidates were returned. The returned score is
    capped at 100; ranking uses the uncapped score so ZIP-aligned
    candidates win ties."""
    best, best_score = None, 0
    for cand in candidates or []:
        s = _raw_score(query_name, query_zip, cand, zip_bonus)
        if s > best_score:
            best, best_score = cand, s
    return best, min(100, best_score)
