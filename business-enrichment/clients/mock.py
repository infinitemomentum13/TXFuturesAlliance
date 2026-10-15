"""Deterministic mock implementations used when MOCK_MODE=true.

Each mock subclasses its real client and only replaces the HTTP ``_post``
call, so the pipeline exercises the genuine request-building and
response-parsing code paths without consuming API credits.

Outcomes are derived from a SHA-256 hash of ``source|taxpayer_name`` so
they are stable across runs and vary per source -- which exercises the
waterfall (a record that fails on BizAPI may still match on Explorium).

Bucket layout per (source, record):
  0-14   transient HTTP 503     -> retried, then logged, falls through
  15-34  empty result / no match -> falls through to next source
  35-54  match, wrong ZIP        -> only accepted above threshold via
                                    name score (exercises ZIP bonus path)
  55-79  match, employees only   -> no NAICS from API
  80-99  full match              -> NAICS + employees, matching ZIP
"""

import hashlib
import logging
from unittest.mock import Mock

from .apify_dnb import ApifyDNBClient
from .base import TransientError
from .bizapi import BizAPIClient
from .explorium import ExploriumClient
from .osm_nominatim import OSMNominatimClient

logger = logging.getLogger(__name__)

_MOCK_NAICS = [
    "722511", "445110", "621111", "531210", "541110",
    "236118", "811111", "453998", "524210", "447110",
]


def _bucket(source, name):
    h = hashlib.sha256("{}|{}".format(source, name).encode()).hexdigest()
    return int(h, 16) % 100


def _mock_identity(record, source, bucket):
    """Return (name, employees, naics, zip) for a synthetic match."""
    # Slightly restyle the name (drop punctuation/case) so fuzzy matching
    # still has to do real work.
    name = str(record["name"]).replace(",", "").title()
    h = int(
        hashlib.sha256("{}|{}|emp".format(source, record["name"]).encode()).hexdigest(),
        16,
    )
    employees = (h % 90) + 1
    naics = _MOCK_NAICS[h % len(_MOCK_NAICS)]
    zip_code = record["zip"]
    if 35 <= bucket < 55:
        zip_code = "00000"
    if 55 <= bucket < 80:
        naics = None
    return name, employees, naics, zip_code


def _fake_response(payload):
    resp = Mock()
    resp.status_code = 200
    resp.text = str(payload)
    resp.json.return_value = payload
    return resp


class _MockMixin:
    """Shared outcome logic; ``_source`` set by each subclass."""

    def _outcome(self, record):
        return _bucket(self._source, str(record["name"]))


class MockBizAPIClient(_MockMixin, BizAPIClient):
    _source = "bizapi"
    name = "bizapi"

    def _post(self, url, **kwargs):
        record = self._current_record
        bucket = self._outcome(record)
        if bucket < 15:
            raise TransientError("simulated HTTP 503 (mock)")
        if 15 <= bucket < 35:
            return _fake_response(
                {"Search Terms": {"Company Name": record["name"]}}
            )
        name, employees, naics, zip_code = _mock_identity(record, self._source, bucket)
        return _fake_response(
            {
                "Matching Data": {
                    "Company Name": name,
                    "NAICS Code": naics,
                    "Total Employees": employees,
                    "City": record["city"],
                    "State": record["state"] or "TX",
                    "Zip Code": zip_code,
                    "DUNS #": "{:09d}".format(bucket * 111111 % 999999999),
                }
            }
        )

    def lookup(self, record):
        self._current_record = record
        return super().lookup(record)


class MockExploriumClient(_MockMixin, ExploriumClient):
    _source = "explorium"
    name = "explorium"

    # Mock mode must not consume or record real quota.
    def quota_remaining(self):
        return self.settings.explorium_monthly_limit

    def _record_enrichment(self):
        pass

    def _post(self, url, **kwargs):
        record = self._current_record
        bucket = self._outcome(record)
        if url.endswith("/businesses/match"):
            if bucket < 15:
                raise TransientError("simulated HTTP 503 (mock)")
            if 15 <= bucket < 35:
                return _fake_response({"matched_businesses": []})
            name, _, _, zip_code = _mock_identity(record, self._source, bucket)
            return _fake_response(
                {
                    "matched_businesses": [
                        {
                            "business_id": "mock-{:032d}".format(bucket),
                            "company_name": name,
                            "zip": zip_code,
                        }
                    ]
                }
            )
        # firmographics/enrich
        name, employees, naics, zip_code = _mock_identity(record, self._source, bucket)
        return _fake_response(
            {
                "firmographics": {
                    "company_name": name,
                    "naics_code": naics,
                    "number_of_employees": employees,
                    "city": record["city"],
                    "state": record["state"] or "TX",
                    "zip": zip_code,
                }
            }
        )

    def lookup(self, record):
        self._current_record = record
        return super().lookup(record)


class MockApifyDNBClient(_MockMixin, ApifyDNBClient):
    _source = "apify_dnb"
    name = "apify_dnb"

    def run_queries(self, queries, city=None, state=None):
        """Simulate a batch actor run: one synthetic item per query."""
        items = []
        for q in queries:
            bucket = _bucket(self._source, q)
            self.queries_used += 1
            if bucket < 35:  # transient/no-match buckets produce nothing
                continue
            fake_record = {"name": q, "city": city or "", "state": state or "TX"}
            name, employees, naics, zip_code = _mock_identity(
                fake_record, self._source, bucket
            )
            items.append(
                {
                    "companyName": name,
                    "duns": "{:09d}".format(bucket * 222222 % 999999999),
                    "employeesThisSite": employees,
                    "city": city or "",
                    "state": state or "TX",
                    "zipCode": zip_code,
                }
            )
        return items


class MockOSMClient(_MockMixin, OSMNominatimClient):
    _source = "osm"
    name = "osm"

    # OSM yields NAICS only -- mocks never produce employees.
    _OSM_TAGS = [
        ("amenity", "restaurant"), ("shop", "supermarket"),
        ("amenity", "doctors"), ("shop", "car_repair"),
        ("office", "insurance"), ("shop", "beauty"),
    ]

    def _post_or_get(self, query):
        record = self._current_record
        bucket = self._outcome(record)
        if bucket < 15:
            raise TransientError("simulated HTTP 503 (mock)")
        if 15 <= bucket < 35:
            return []
        name, _, _, zip_code = _mock_identity(record, self._source, bucket)
        cat, tag = self._OSM_TAGS[bucket % len(self._OSM_TAGS)]
        return [
            {
                "display_name": "{}, {}, {}".format(
                    name, record["city"], record["state"] or "TX"
                ),
                "name": name,
                "category": cat,
                "type": tag,
                "extratags": {cat: tag},
                "address": {"postcode": zip_code, "city": record["city"]},
            }
        ]

    def lookup(self, record):
        # Bypass the real client's disk cache — mock results must never
        # be persisted where a real run could read them.
        self._current_record = record
        items = self._post_or_get(
            "{}, {}, {}".format(record["name"], record["city"],
                                record["state"] or "TX")
        )
        return self._parse(items if isinstance(items, list) else [])


MOCK_CLIENTS = {
    "bizapi": MockBizAPIClient,
    "explorium": MockExploriumClient,
    "apify_dnb": MockApifyDNBClient,
    "osm": MockOSMClient,
}
