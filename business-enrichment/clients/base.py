"""Shared plumbing for enrichment API clients: result types, errors,
rate limiting, and retried HTTP POSTs."""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class ClientError(Exception):
    """Non-retryable client failure (bad request, bad credentials, etc.)."""


class TransientError(Exception):
    """Retryable failure: timeouts, connection errors, 429s, 5xx."""


@dataclass
class Candidate:
    """A normalized company record returned by any enrichment source."""

    name: str = ""
    naics_code: Optional[str] = None
    employees: Optional[object] = None  # int when parseable, else raw string
    street: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    duns: Optional[str] = None
    # Optional display-confidence override for inferred (non-sourced)
    # matches, e.g. keyword rules that "match" the record's own name.
    confidence: Optional[float] = None
    raw: dict = field(default_factory=dict)


class RateLimiter:
    """Simple minimum-interval rate limiter (requests per second)."""

    def __init__(self, rps):
        self.min_interval = 1.0 / rps if rps and rps > 0 else 0.0
        self._last = 0.0

    def wait(self):
        if self.min_interval <= 0:
            return
        now = time.monotonic()
        elapsed = now - self._last
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last = time.monotonic()


class BaseClient:
    """Base class for enrichment sources. Subclasses implement ``lookup``.

    ``provides`` declares which fields this source can fill; the waterfall
    skips a source when none of the still-needed fields are among them.
    """

    name = "base"
    provides = ("naics", "employees")
    local = False  # True for sources that make no network/API calls

    def __init__(self, settings, rate_limiter=None):
        self.settings = settings
        self.rate_limiter = rate_limiter or RateLimiter(0)
        self.session = requests.Session()
        self.calls_made = 0

    def lookup(self, record):
        """Return a list of Candidate objects for ``record`` (or [])."""
        raise NotImplementedError

    def _post(self, url, **kwargs):
        """POST with rate limiting, timeout, and retry on transient errors."""
        self.rate_limiter.wait()

        @retry(
            retry=retry_if_exception_type(TransientError),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            stop=stop_after_attempt(self.settings.retry_attempts),
            reraise=True,
        )
        def _do():
            resp = self.session.post(
                url, timeout=self.settings.request_timeout, **kwargs
            )
            self._raise_for_status(resp)
            self.calls_made += 1
            return resp

        try:
            return _do()
        except requests.Timeout as e:
            raise TransientError("timeout calling {}: {}".format(url, e))
        except requests.ConnectionError as e:
            raise TransientError("connection error calling {}: {}".format(url, e))

    @staticmethod
    def _raise_for_status(resp):
        code = resp.status_code
        if code == 429 or code >= 500:
            raise TransientError("HTTP {} from API".format(code))
        if code in (401, 403):
            raise ClientError("HTTP {} auth/quota failure".format(code))
        if code >= 400:
            raise ClientError("HTTP {} bad request: {}".format(code, resp.text[:200]))


def _lower_map(d):
    """Case/space-insensitive view of a dict's keys."""
    return {str(k).strip().lower(): v for k, v in d.items()}


def pick(d, *keys):
    """Return the first non-empty value among candidate key spellings
    (case-insensitive)."""
    if not isinstance(d, dict):
        return None
    m = _lower_map(d)
    for k in keys:
        v = m.get(k.lower())
        if v is not None and str(v).strip() != "":
            return v
    return None


def to_int(value):
    """Best-effort int parse; returns the original value if not numeric."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip().replace(",", "")
    try:
        return int(float(text))
    except ValueError:
        return value
