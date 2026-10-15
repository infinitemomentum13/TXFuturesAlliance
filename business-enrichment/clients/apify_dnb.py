"""Tertiary source: D&B business-directory scraper on Apify.

Default actor ``memo23~dnb-scraper`` searches the D&B directory by company
name + region/city and returns DUNS, employee counts, industry text and
address. (The older ``epctex~dnb-scraper`` keyword search returns empty
results as of Oct 2026 -- avoid it.)

D&B scraping is slow (~minutes per actor run), so this client is
**batch-oriented**: the pipeline collects pending records per input file
and submits chunked ``queries`` in async actor runs rather than one
synchronous call per record.
"""

import logging
import time

from .base import BaseClient, Candidate, ClientError, TransientError, pick, to_int

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"


class ApifyDNBClient(BaseClient):
    name = "apify_dnb"
    provides = ("employees",)   # D&B directory yields no NAICS code
    batch_only = True           # too slow for the sequential waterfall

    def __init__(self, settings):
        super().__init__(settings)
        self.queries_used = 0

    def queries_remaining(self):
        cap = self.settings.apify_max_queries_per_run
        return max(0, cap - self.queries_used) if cap else float("inf")

    # ---- sequential lookup (unused; batch_only=True) --------------------

    def lookup(self, record):
        return []

    # ---- batch API ------------------------------------------------------

    def run_queries(self, queries, city=None, state=None):
        """Run the actor asynchronously for a list of company names.

        Returns the raw dataset items written by the run. Raises
        ClientError on input/auth/quota problems and TransientError on
        timeouts so the caller can decide how to log/skip.
        """
        body = {
            "queries": queries,
            "country": "us",
            "scrapeCompanyProfiles": True,
        }
        if state:
            body["region"] = str(state).strip().lower()
        if city:
            body["city"] = str(city).strip().lower().replace(" ", "_")

        # 1. submit async run; if the city slug is rejected, retry without it
        try:
            resp = self._post(
                "{}/acts/{}/runs".format(APIFY_BASE, self.settings.apify_dnb_actor),
                params={"token": self.settings.apify_token},
                json=body,
            )
        except ClientError:
            if "city" not in body:
                raise
            logger.info("Apify rejected city=%s; retrying without it", city)
            body.pop("city", None)
            resp = self._post(
                "{}/acts/{}/runs".format(APIFY_BASE, self.settings.apify_dnb_actor),
                params={"token": self.settings.apify_token},
                json=body,
            )
        try:
            run_id = resp.json()["data"]["id"]
        except (ValueError, KeyError):
            raise ClientError("Apify: could not start actor run")
        self.queries_used += len(queries)
        self.calls_made += 1

        # 2. poll until terminal state
        deadline = time.monotonic() + self.settings.apify_run_timeout
        status_url = "{}/actor-runs/{}".format(APIFY_BASE, run_id)
        while time.monotonic() < deadline:
            time.sleep(10)
            try:
                run = self.session.get(
                    status_url,
                    params={"token": self.settings.apify_token},
                    timeout=30,
                ).json()["data"]
            except Exception as e:
                logger.warning("Apify poll error on %s: %s", run_id, e)
                continue
            status = run.get("status")
            if status == "SUCCEEDED":
                items = self.session.get(
                    "{}/dataset/items".format(status_url),
                    params={"token": self.settings.apify_token},
                    timeout=60,
                ).json()
                return items if isinstance(items, list) else []
            if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                raise ClientError("Apify run {} ended {}".format(run_id, status))
        raise ClientError(
            "Apify run {} exceeded {}s timeout".format(
                run_id, self.settings.apify_run_timeout
            )
        )

    # ---- item mapping ---------------------------------------------------

    def to_candidates(self, item):
        """One Apify dataset item -> list of Candidates. Emits an extra
        candidate for trade-style names (e.g. legal 'ES TRADING
        INTERNATIONAL' doing business as 'Taco Palenque')."""
        if not isinstance(item, dict):
            return []
        employees = pick(
            item,
            "employeesThisSite", "employeesConsolidated", "employees",
            "employeeCount", "numberOfEmployees", "employee_count",
        )
        naics = pick(item, "naicsCode", "naics_code", "naics")
        location = item.get("Location") if isinstance(item.get("Location"), dict) else {}
        address = item.get("address") if isinstance(item.get("address"), dict) else {}
        # memo23 returns "address" as a plain string street line
        street_raw = item.get("address") if isinstance(item.get("address"), str) else ""

        names = []
        for k in ("companyName", "Company Name", "name", "title"):
            v = item.get(k)
            if v and str(v) not in names:
                names.append(str(v))
        trade = item.get("tradeStyleNames")
        if isinstance(trade, list):
            names += [str(t) for t in trade if t]
        elif trade:
            names.append(str(trade))

        def _mk(name):
            return Candidate(
                name=name,
                naics_code=str(naics) if naics else None,
                employees=to_int(employees),
                street=str(
                    street_raw or pick(item, "street")
                    or pick(location, "Street Address") or ""
                ),
                city=str(
                    pick(item, "city") or pick(location, "City")
                    or pick(address, "city") or ""
                ),
                state=str(
                    pick(item, "state") or pick(location, "Region")
                    or pick(address, "state") or ""
                ),
                zip=str(
                    pick(item, "zipCode", "zip", "postalCode")
                    or pick(location, "Postal Code")
                    or pick(address, "postalCode") or ""
                ),
                duns=pick(item, "duns", "dunsNumber", "duns_number", "DUNS #"),
                raw=item,
            )

        return [_mk(n) for n in names] or []
