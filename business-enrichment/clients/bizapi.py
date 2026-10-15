"""Primary source: NAICS Association BizAPI.

Docs: https://www.naics.com/bizapi-documents-v2/
POST {BIZAPI_URL} with HTTP Basic auth. Body carries a "Standard Match"
(company name + street + city + state + ZIP). Limited to 3 requests per
rolling second; billed per successful match.
"""

import logging

from .base import BaseClient, Candidate, ClientError, pick, to_int

logger = logging.getLogger(__name__)


class BizAPIClient(BaseClient):
    name = "bizapi"

    def lookup(self, record):
        body = {
            "companyName": record["name"],
            "address": record["address"],
            "city": record["city"],
            "state": record["state"] or "TX",
            "postalCode": record["zip"],
            "country": "US",
        }
        resp = self._post(
            self.settings.bizapi_url,
            json=body,
            auth=(self.settings.bizapi_username, self.settings.bizapi_password),
        )
        try:
            payload = resp.json()
        except ValueError:
            raise ClientError("BizAPI returned non-JSON response")
        return self._parse(payload)

    @staticmethod
    def _parse(payload):
        if not isinstance(payload, dict):
            return []
        # A successful v1/v2 match nests data under "Matching Data"; the
        # OpenAPI-style layout returns flat snake_case fields. A failed
        # match echoes "Search Terms" only.
        data = payload.get("Matching Data") or payload.get("matching_data") or payload
        results = []
        if isinstance(data, dict):
            results = [data]
        elif isinstance(data, list):
            results = data

        candidates = []
        for item in results:
            name = pick(item, "Company Name", "company_name", "name", "business_name")
            naics = pick(
                item,
                "naics_code_6",
                "NAICS Code",
                "Primary NAICS Code",
                "naics",
                "naics_code",
            )
            employees = pick(
                item,
                "total_employees",
                "Total Employees",
                "Employees Total",
                "employees",
                "employee_count",
                "Employees",
            )
            if not name and not naics and employees is None:
                continue
            candidates.append(
                Candidate(
                    name=str(name or ""),
                    naics_code=str(naics) if naics is not None else None,
                    employees=to_int(employees),
                    street=str(pick(item, "Street Address", "street", "address") or ""),
                    city=str(pick(item, "City", "city") or ""),
                    state=str(pick(item, "State/Province", "State", "state") or ""),
                    zip=str(pick(item, "Zip Code", "zip", "postal_code", "postalCode") or ""),
                    duns=pick(item, "DUNS #", "duns_number", "duns"),
                    raw=item,
                )
            )
        return candidates
