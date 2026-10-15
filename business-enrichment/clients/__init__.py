"""Enrichment source clients and factory."""

import logging

from .apify_dnb import ApifyDNBClient
from .base import BaseClient, Candidate, ClientError, RateLimiter, TransientError
from .bizapi import BizAPIClient
from .explorium import ExploriumClient
from .osm_nominatim import OSMNominatimClient

logger = logging.getLogger(__name__)

REAL_CLIENTS = {
    "bizapi": BizAPIClient,
    "explorium": ExploriumClient,
    "apify_dnb": ApifyDNBClient,
    "osm": OSMNominatimClient,
}

_RATE_LIMITS = {
    "bizapi": lambda s: s.bizapi_rate_limit_rps,
    "explorium": lambda s: s.explorium_rate_limit_rps,
    "apify_dnb": lambda s: 0.5,  # scraper runs are heavyweight; be gentle
    "osm": lambda s: s.osm_rate_limit_rps,  # Nominatim policy: max 1 req/s
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
