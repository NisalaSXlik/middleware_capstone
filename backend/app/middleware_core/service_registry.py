"""
service_registry.py  –  Member 1 (Architecture Lead)
Lightweight in-memory Service Registry and Discovery component.

In production this would integrate with Consul, Eureka, or etcd.
The registry stores the base URLs and health status of all
internal and external services so the middleware can locate them
dynamically without hard-coding endpoints throughout the codebase.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class ServiceEntry:
    name: str
    url: str
    protocol: str          # "http", "soap", "tcp"
    healthy: bool = True
    last_check: Optional[datetime] = None
    metadata: Dict = field(default_factory=dict)


class ServiceRegistry:
    """
    Central registry for all services in the SwiftTrack ecosystem.

    Architectural pattern: Service Registry (microservices pattern)
    All service-to-service communication goes through this registry so
    that discovery, load-balancing, and health checks are centralised.
    """

    _instance: Optional["ServiceRegistry"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._services: Dict[str, ServiceEntry] = {}
        return cls._instance

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, name: str, url: str, protocol: str = "http",
                 metadata: dict | None = None) -> ServiceEntry:
        entry = ServiceEntry(
            name=name,
            url=url,
            protocol=protocol,
            metadata=metadata or {},
        )
        self._services[name] = entry
        logger.info("[Registry] Registered service '%s' at %s (%s)", name, url, protocol)
        return entry

    def deregister(self, name: str) -> None:
        self._services.pop(name, None)
        logger.info("[Registry] Deregistered service '%s'", name)

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def get(self, name: str) -> Optional[ServiceEntry]:
        return self._services.get(name)

    def get_url(self, name: str) -> str:
        entry = self.get(name)
        if entry is None:
            raise LookupError(f"Service '{name}' not found in registry")
        if not entry.healthy:
            logger.warning("[Registry] Service '%s' is marked unhealthy", name)
        return entry.url

    def list_services(self) -> Dict[str, dict]:
        return {
            name: {
                "url": e.url,
                "protocol": e.protocol,
                "healthy": e.healthy,
                "last_check": e.last_check.isoformat() if e.last_check else None,
            }
            for name, e in self._services.items()
        }

    # ------------------------------------------------------------------
    # Health Checks (HTTP services only in prototype)
    # ------------------------------------------------------------------

    async def health_check(self, name: str) -> bool:
        entry = self._services.get(name)
        if entry is None:
            return False
        if entry.protocol != "http":
            entry.healthy = True          # assume healthy for non-HTTP mocks
            return True
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{entry.url}/health")
                entry.healthy = r.status_code == 200
        except Exception:
            entry.healthy = False
        entry.last_check = datetime.utcnow()
        return entry.healthy

    async def health_check_all(self) -> Dict[str, bool]:
        results = {}
        for name in list(self._services):
            results[name] = await self.health_check(name)
        return results

    async def periodic_health_check(self, interval_seconds: int = 30) -> None:
        """Background task: poll all registered services every N seconds."""
        while True:
            await asyncio.sleep(interval_seconds)
            results = await self.health_check_all()
            for name, healthy in results.items():
                status = "UP" if healthy else "DOWN"
                logger.info("[Registry] %s -> %s", name, status)


# Singleton accessor
registry = ServiceRegistry()
