"""Free, no-key source: OpenStreetMap Nominatim POI lookup.

Searches OSM for the business name near its city/state and maps the result's
OSM tags (shop=*, amenity=*, office=*, etc.) to an approximate 6-digit NAICS
code. Provides NAICS only -- OSM carries no employee data.

Policy notes (https://operations.osmfoundation.org/policies/nominatim/):
  - Max 1 request/second (enforced via the client rate limiter).
  - A descriptive User-Agent is required.
  - Results are cached on disk so re-runs never re-hit the service.
"""

import hashlib
import json
import logging
import os
from pathlib import Path

from .base import BaseClient, Candidate, ClientError
from matching import normalize_name

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# OSM tag -> approximate NAICS-2017 6-digit code. The Comptroller's NAICS
# values follow NAICS 2017 conventions, so we use those where they diverge
# from 2022. These are best-effort category mappings, not D&B-grade codes.
TAG_TO_NAICS = {
    # --- amenity=* ---
    ("amenity", "restaurant"): "722511",
    ("amenity", "fast_food"): "722513",
    ("amenity", "cafe"): "722515",
    ("amenity", "ice_cream"): "722515",
    ("amenity", "bar"): "722410",
    ("amenity", "pub"): "722410",
    ("amenity", "biergarten"): "722410",
    ("amenity", "nightclub"): "722410",
    ("amenity", "food_court"): "722514",
    ("amenity", "pharmacy"): "446110",
    ("amenity", "doctors"): "621111",
    ("amenity", "dentist"): "621210",
    ("amenity", "clinic"): "621498",
    ("amenity", "veterinary"): "541940",
    ("amenity", "hospital"): "622110",
    ("amenity", "bank"): "522110",
    ("amenity", "fuel"): "447110",
    ("amenity", "car_wash"): "811192",
    ("amenity", "car_rental"): "532111",
    ("amenity", "school"): "611110",
    ("amenity", "college"): "611310",
    ("amenity", "university"): "611310",
    ("amenity", "childcare"): "624410",
    ("amenity", "kindergarten"): "624410",
    ("amenity", "driving_school"): "611692",
    ("amenity", "place_of_worship"): "813110",
    ("amenity", "funeral_hall"): "812210",
    ("amenity", "crematorium"): "812220",
    ("amenity", "payment_centre"): "522390",
    ("amenity", "money_transfer"): "522390",
    # --- shop=* ---
    ("shop", "supermarket"): "445110",
    ("shop", "grocery"): "445110",
    ("shop", "convenience"): "445120",
    ("shop", "bakery"): "445291",
    ("shop", "butcher"): "445210",
    ("shop", "greengrocer"): "445230",
    ("shop", "alcohol"): "445310",
    ("shop", "beverages"): "445310",
    ("shop", "wine"): "445310",
    ("shop", "car"): "441110",
    ("shop", "car_repair"): "811111",
    ("shop", "car_parts"): "441310",
    ("shop", "tyres"): "441320",
    ("shop", "motorcycle"): "441221",
    ("shop", "clothes"): "448140",
    ("shop", "shoes"): "448210",
    ("shop", "jewelry"): "448310",
    ("shop", "furniture"): "442110",
    ("shop", "electronics"): "443142",
    ("shop", "computer"): "443142",
    ("shop", "mobile_phone"): "443142",
    ("shop", "hardware"): "444130",
    ("shop", "doityourself"): "444110",
    ("shop", "paint"): "444120",
    ("shop", "florist"): "453110",
    ("shop", "gift"): "453220",
    ("shop", "beauty"): "446120",
    ("shop", "hairdresser"): "812112",
    ("shop", "laundry"): "812310",
    ("shop", "dry_cleaning"): "812320",
    ("shop", "tattoo"): "812199",
    ("shop", "pet"): "453910",
    ("shop", "optician"): "446130",
    ("shop", "medical_supply"): "446199",
    ("shop", "department_store"): "452210",
    ("shop", "variety_store"): "452319",
    ("shop", "pawnbroker"): "522298",
    ("shop", "video"): "532282",
    ("shop", "massage"): "812199",
    ("shop", "storage_rental"): "531130",
    # --- office=* ---
    ("office", "insurance"): "524210",
    ("office", "lawyer"): "541110",
    ("office", "notary"): "541120",
    ("office", "accountant"): "541211",
    ("office", "tax_preparation"): "541213",
    ("office", "real_estate"): "531210",
    ("office", "estate_agent"): "531210",
    ("office", "property_management"): "531311",
    ("office", "travel_agent"): "561510",
    ("office", "employment_agency"): "561311",
    ("office", "financial_advisor"): "523930",
    ("office", "architect"): "541310",
    ("office", "engineer"): "541330",
    ("office", "surveyor"): "541370",
    ("office", "company"): "541990",  # generic services office
    # --- craft=* ---
    ("craft", "electrician"): "238210",
    ("craft", "plumber"): "238220",
    ("craft", "hvac"): "238220",
    ("craft", "carpenter"): "238350",
    ("craft", "painter"): "238320",
    ("craft", "roofer"): "238160",
    ("craft", "locksmith"): "561622",
    # --- tourism=* ---
    ("tourism", "hotel"): "721110",
    ("tourism", "motel"): "721110",
    ("tourism", "guest_house"): "721199",
    # --- leisure=* ---
    ("leisure", "fitness_centre"): "713940",
    # --- healthcare=* ---
    ("healthcare", "physiotherapist"): "621340",
    ("healthcare", "optometrist"): "621320",
    ("healthcare", "pharmacy"): "446110",
    ("healthcare", "doctor"): "621111",
    ("healthcare", "dentist"): "621210",
}

_TAG_KEYS = ("shop", "amenity", "office", "craft", "tourism", "leisure", "healthcare")


def naics_from_tags(tags):
    """Map OSM tags to a NAICS code, or None when unmapped."""
    for key in _TAG_KEYS:
        val = (tags.get(key) or "").strip().lower()
        if val and (key, val) in TAG_TO_NAICS:
            return TAG_TO_NAICS[(key, val)]
    # jsonv2 'category'/'type' land in extratags too, but check generic
    # top-level fallback
    for key in ("class", "category"):
        val = (tags.get(key) or "").strip().lower()
        t = (tags.get("type") or "").strip().lower()
        if val and t and (val, t) in TAG_TO_NAICS:
            return TAG_TO_NAICS[(val, t)]
    return None


class OSMNominatimClient(BaseClient):
    name = "osm"
    provides = ("naics",)  # OSM carries no employee data

    def __init__(self, settings, cache_file=None):
        super().__init__(settings)
        self.cache_file = Path(
            cache_file or settings.resolve("cache/osm_cache.json")
        )
        self._cache = self._load_cache()
        self._dirty = 0

    # ---- persistent disk cache ------------------------------------------

    def _load_cache(self):
        try:
            with open(self.cache_file) as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def flush(self):
        if not self._dirty:
            return
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = str(self.cache_file) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self._cache, f)
        os.replace(tmp, self.cache_file)
        self._dirty = 0

    def _cache_key(self, query):
        return hashlib.sha1(query.lower().encode()).hexdigest()

    # ---- API ------------------------------------------------------------

    def lookup(self, record):
        # OSM POI names never carry legal suffixes — search the normalized
        # name (e.g. "CLARK HONDA, LLC" -> "Clark Honda").
        query = "{}, {}, {}".format(
            normalize_name(record["name"]).title() or record["name"],
            record["city"],
            record["state"] or "TX",
        )
        key = self._cache_key(query)
        if key in self._cache:
            items = self._cache[key]["items"]
        else:
            resp = self._post_or_get(query)
            items = resp if isinstance(resp, list) else []
            self._cache[key] = {"items": items}
            self._dirty += 1
            if self._dirty >= 20:
                self.flush()
        return self._parse(items)

    def _post_or_get(self, query):
        # Nominatim is a GET API; reuse the retried request path manually.
        self.rate_limiter.wait()
        from tenacity import (
            retry, retry_if_exception_type, stop_after_attempt,
            wait_exponential,
        )
        from .base import TransientError
        import requests

        @retry(
            retry=retry_if_exception_type(TransientError),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            stop=stop_after_attempt(self.settings.retry_attempts),
            reraise=True,
        )
        def _do():
            resp = self.session.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "extratags": 1,
                    "namedetails": 1,
                    "countrycodes": "us",
                    "limit": 5,
                },
                headers={"User-Agent": self.settings.osm_user_agent},
                timeout=self.settings.request_timeout,
            )
            self._raise_for_status(resp)
            self.calls_made += 1
            return resp

        try:
            return _do().json()
        except requests.Timeout as e:
            raise TransientError("timeout calling Nominatim: {}".format(e))
        except requests.ConnectionError as e:
            raise TransientError("connection error calling Nominatim: {}".format(e))
        except ValueError:
            raise ClientError("Nominatim returned non-JSON response")

    @staticmethod
    def _parse(items):
        candidates = []
        for item in items:
            tags = dict(item.get("extratags") or {})
            # promote category/type so naics_from_tags sees them
            for k in ("category", "class", "type"):
                if item.get(k):
                    tags.setdefault(k, item[k])
            naics = naics_from_tags(tags)
            if not naics:
                continue  # candidate carries no useful data
            display = item.get("display_name", "")
            name = item.get("name") or display.split(",")[0]
            address = item.get("address") or {}
            candidates.append(
                Candidate(
                    name=str(name or ""),
                    naics_code=naics,
                    employees=None,
                    city=str(address.get("city") or address.get("town") or ""),
                    state=str(address.get("state") or ""),
                    zip=str(address.get("postcode") or ""),
                    raw=item,
                )
            )
        return candidates
