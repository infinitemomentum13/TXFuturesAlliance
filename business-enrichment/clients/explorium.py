"""Secondary source: Explorium firmographics (free tier ~500 enrichments/mo).

Two-step flow per https://developers.explorium.ai:
  1. POST {base}/businesses/match            -> business_id
  2. POST {base}/businesses/firmographics/enrich  -> firmographic signals

Auth via `api_key` header. A monthly usage counter is persisted in the
output directory so the free-tier cap is not exceeded across runs.
"""

import json
import logging
import os
from datetime import datetime

from .base import BaseClient, Candidate, ClientError, pick, to_int

logger = logging.getLogger(__name__)


class ExploriumClient(BaseClient):
    name = "explorium"

    def __init__(self, settings, usage_file=None):
        super().__init__(settings)
        self.base_url = settings.explorium_base_url.rstrip("/")
        self.usage_file = usage_file or (
            settings.output_path / ".explorium_usage.json"
        )

    # ---- monthly quota bookkeeping -------------------------------------

    def _load_usage(self):
        try:
            with open(self.usage_file) as f:
                data = json.load(f)
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def _usage_this_month(self):
        return int(self._load_usage().get(datetime.now().strftime("%Y-%m"), 0))

    def _record_enrichment(self):
        self.usage_file.parent.mkdir(parents=True, exist_ok=True)
        data = self._load_usage()
        key = datetime.now().strftime("%Y-%m")
        data[key] = int(data.get(key, 0)) + 1
        tmp = str(self.usage_file) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, self.usage_file)

    def quota_remaining(self):
        return max(
            0, self.settings.explorium_monthly_limit - self._usage_this_month()
        )

    # ---- API calls ------------------------------------------------------

    def lookup(self, record):
        if self.quota_remaining() <= 0:
            raise ClientError(
                "Explorium monthly limit of {} reached".format(
                    self.settings.explorium_monthly_limit
                )
            )

        headers = {"api_key": self.settings.explorium_api_key}
        match_body = {
            "businesses_to_match": [
                {"name": record["name"], "country": "us"}
            ]
        }
        resp = self._post(
            self.base_url + "/businesses/match", json=match_body, headers=headers
        )
        business_id, matched_name, matched_zip = self._parse_match(resp)
        if not business_id:
            return []

        self._record_enrichment()
        enrich_body = {"business_id": business_id}
        resp = self._post(
            self.base_url + "/businesses/firmographics/enrich",
            json=enrich_body,
            headers=headers,
        )
        cand = self._parse_enrich(resp)
        if cand is not None:
            if not cand.name:
                cand.name = matched_name
            if not cand.zip:
                cand.zip = matched_zip
            return [cand]
        return []

    @staticmethod
    def _parse_match(resp):
        try:
            payload = resp.json()
        except ValueError:
            raise ClientError("Explorium match returned non-JSON response")
        items = (
            payload.get("matched_businesses")
            or payload.get("businesses")
            or payload.get("matches")
            or (payload.get("data") if isinstance(payload.get("data"), list) else [])
        )
        if not items:
            return None, "", ""
        first = items[0] or {}
        return (
            first.get("business_id") or first.get("id"),
            pick(first, "company_name", "name", "site_name") or "",
            pick(first, "zip", "postal_code", "zip_code") or "",
        )

    @staticmethod
    def _parse_enrich(resp):
        try:
            payload = resp.json()
        except ValueError:
            raise ClientError("Explorium enrich returned non-JSON response")
        data = (
            payload.get("firmographics")
            or payload.get("data")
            or payload.get("response")
            or payload
        )
        if isinstance(data, list):
            data = data[0] if data else {}
        if not isinstance(data, dict) or not data:
            return None
        return Candidate(
            name=str(pick(data, "company_name", "name", "business_name") or ""),
            naics_code=pick(data, "naics_code", "naics", "primary_naics_code"),
            employees=to_int(
                pick(
                    data,
                    "number_of_employees",
                    "employees",
                    "employee_count",
                    "company_size",
                    "employees_range",
                )
            ),
            street=str(pick(data, "address", "street") or ""),
            city=str(pick(data, "city") or ""),
            state=str(pick(data, "state", "region") or ""),
            zip=str(pick(data, "zip", "postal_code", "zip_code") or ""),
            raw=data,
        )
