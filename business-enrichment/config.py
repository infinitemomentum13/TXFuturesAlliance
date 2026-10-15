"""Configuration for the Texas business enrichment pipeline.

All settings are loaded from environment variables (optionally via a `.env`
file in the project root). See `.env.example` for documentation of each
variable.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _get_bool(key, default=False):
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "y", "on")


def _get_int(key, default):
    val = os.getenv(key)
    if val is None or val.strip() == "":
        return default
    return int(val)


def _get_float(key, default):
    val = os.getenv(key)
    if val is None or val.strip() == "":
        return default
    return float(val)


@dataclass
class Settings:
    # Mode
    mock_mode: bool = field(default_factory=lambda: _get_bool("MOCK_MODE", True))

    # Paths (resolved relative to the project root, i.e. this file's dir)
    input_dir: str = field(default_factory=lambda: os.getenv("INPUT_DIR", "input_data"))
    output_dir: str = field(default_factory=lambda: os.getenv("OUTPUT_DIR", "output_data"))

    # NAICS Association BizAPI (primary source)
    bizapi_url: str = field(
        default_factory=lambda: os.getenv(
            "BIZAPI_URL", "https://naics.com/wp-json/naicsapi/v2/cosearch"
        )
    )
    bizapi_username: str = field(default_factory=lambda: os.getenv("BIZAPI_USERNAME", ""))
    bizapi_password: str = field(default_factory=lambda: os.getenv("BIZAPI_PASSWORD", ""))
    bizapi_rate_limit_rps: float = field(
        default_factory=lambda: _get_float("BIZAPI_RATE_LIMIT_RPS", 3.0)
    )

    # Explorium firmographics (secondary, limited free tier)
    explorium_api_key: str = field(default_factory=lambda: os.getenv("EXPLORIUM_API_KEY", ""))
    explorium_base_url: str = field(
        default_factory=lambda: os.getenv("EXPLORIUM_BASE_URL", "https://api.explorium.ai/v1")
    )
    explorium_monthly_limit: int = field(
        default_factory=lambda: _get_int("EXPLORIUM_MONTHLY_LIMIT", 500)
    )
    explorium_rate_limit_rps: float = field(
        default_factory=lambda: _get_float("EXPLORIUM_RATE_LIMIT_RPS", 1.0)
    )

    # Apify D&B scraper (tertiary, batch mode — actor runs take minutes)
    apify_token: str = field(default_factory=lambda: os.getenv("APIFY_TOKEN", ""))
    apify_dnb_actor: str = field(
        default_factory=lambda: os.getenv("APIFY_DNB_ACTOR", "memo23~dnb-scraper")
    )
    apify_batch_size: int = field(
        default_factory=lambda: _get_int("APIFY_BATCH_SIZE", 25)
    )
    apify_max_queries_per_run: int = field(
        default_factory=lambda: _get_int("APIFY_MAX_QUERIES_PER_RUN", 1000)
    )
    apify_max_queries_per_file: int = field(
        default_factory=lambda: _get_int("APIFY_MAX_QUERIES_PER_FILE", 50)
    )
    apify_run_timeout: int = field(
        default_factory=lambda: _get_int("APIFY_RUN_TIMEOUT", 900)
    )

    # SEC EDGAR bulk registrant index (free, no key, local lookups)
    # Provides NAICS via SIC crosswalk for entities that ever filed with
    # the SEC. Build once with scripts/build_edgar_index.py.
    edgar_enabled: bool = field(default_factory=lambda: _get_bool("EDGAR_ENABLED", True))

    # OpenStreetMap Nominatim (free backstop: NAICS only, no key required)
    osm_enabled: bool = field(default_factory=lambda: _get_bool("OSM_ENABLED", True))
    osm_user_agent: str = field(
        default_factory=lambda: os.getenv(
            "OSM_USER_AGENT",
            "texas-biz-enrichment/1.0 (NAICS enrichment research; contact: local)",
        )
    )
    osm_rate_limit_rps: float = field(
        default_factory=lambda: _get_float("OSM_RATE_LIMIT_RPS", 1.0)
    )
    osm_cache_file: str = field(
        default_factory=lambda: os.getenv("OSM_CACHE_FILE", "cache/osm_cache.json")
    )

    # Matching
    match_threshold: int = field(default_factory=lambda: _get_int("MATCH_THRESHOLD", 85))
    zip_match_bonus: int = field(default_factory=lambda: _get_int("ZIP_MATCH_BONUS", 5))

    # Behavior / safety knobs
    request_timeout: int = field(default_factory=lambda: _get_int("REQUEST_TIMEOUT", 30))
    retry_attempts: int = field(default_factory=lambda: _get_int("RETRY_ATTEMPTS", 4))
    max_api_calls_per_run: int = field(default_factory=lambda: _get_int("MAX_API_CALLS_PER_RUN", 0))
    max_records_per_file: int = field(default_factory=lambda: _get_int("MAX_RECORDS_PER_FILE", 0))
    lookup_when_naics_present: bool = field(
        default_factory=lambda: _get_bool("LOOKUP_EMPLOYEES_WHEN_NAICS_PRESENT", True)
    )
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    def resolve(self, path_str):
        """Resolve a configured path relative to the project root."""
        p = Path(path_str).expanduser()
        if not p.is_absolute():
            p = Path(__file__).resolve().parent / p
        return p

    @property
    def input_path(self):
        return self.resolve(self.input_dir)

    @property
    def output_path(self):
        return self.resolve(self.output_dir)

    def enabled_sources(self):
        """Ordered list of source names that are configured to run.

        Order is the waterfall order: richest sources first, free OSM
        backstop last so it can rescue records the paid sources missed.
        """
        if self.mock_mode:
            return ["sec_edgar", "bizapi", "explorium", "apify_dnb", "osm"]
        sources = []
        if self.edgar_enabled:
            sources.append("sec_edgar")  # local index — free, instant, no key
        if self.bizapi_username and self.bizapi_password:
            sources.append("bizapi")
        if self.explorium_api_key:
            sources.append("explorium")
        if self.apify_token:
            sources.append("apify_dnb")
        if self.osm_enabled:
            sources.append("osm")
        return sources


def load_settings():
    return Settings()
