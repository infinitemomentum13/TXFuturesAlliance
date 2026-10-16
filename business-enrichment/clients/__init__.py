"""Enrichment source clients and factory."""

import logging

from .apify_dnb import ApifyDNBClient
from .base import BaseClient, Candidate, ClientError, RateLimiter, TransientError
from .bizapi import BizAPIClient
from .explorium import ExploriumClient
from .name_rules import NameRulesClient
from .osm_nominatim import OSMNominatimClient
from .sec_edgar import SECEdgarClient

logger = logging.getLogger(__name__)

REAL_CLIENTS = {
    "sec_edgar": SECEdgarClient,
    "bizapi": BizAPIClient,
    "explorium": ExploriumClient,
    "name_rule": NameRulesClient,
    "osm": OSMNominatimClient,
    "apify_dnb": ApifyDNBClient,
}

_RATE_LIMITS = {
    "sec_edgar": lambda s: 0,    # local index — no rate limit
    "bizapi": lambda s: s.bizapi_rate_limit_rps,
    "explorium": lambda s: s.explorium_rate_limit_rps,
    "name_rule": lambda s: 0,    # local keyword inference
    "osm": lambda s: s.osm_rate_limit_rps,  # Nominatim policy: max 1 req/s
    "apify_dnb": lambda s: 0.5,  # scraper runs are heavyweight; be gentle
}


def build_clients(settings):
    """Instantiate enabled clients in waterfall order.

    In mock mode every source is enabled with its mock implementation;
    otherwise only sources with credentials are enabled.
    """
    if settings.mock_mode:
        from .mock import MOCK_CLIENTS

        registry = MOCK_CLIENTS
    else:
        registry = REAL_CLIENTS

    clients = []
    for source in settings.enabled_sources():
        cls = registry[source]
        if source == "osm":
            client = cls(settings, cache_file=settings.resolve(settings.osm_cache_file))
        else:
            client = cls(settings)
        client.rate_limiter = RateLimiter(_RATE_LIMITS[source](settings))
        clients.append(client)
    if not clients:
        logger.warning(
            "No enrichment sources enabled. Set API credentials in .env "
            "or run with MOCK_MODE=true."
        )
    return clients
