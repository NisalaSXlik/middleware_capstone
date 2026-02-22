"""
ros_service.py  –  Member 3 (ROS Integration)
Mock Route Optimisation System (ROS) – simulates the third-party cloud REST API.

The real ROS would be called via httpx (see protocol_adapter.call_ros_rest).
This module provides an in-process mock so the prototype runs standalone.

Algorithm (mock): assigns the nearest available driver using Haversine distance.
"""

import asyncio
import logging
import math
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# In-memory store of mock routes
_routes: Dict[str, Dict] = {}

# Mock driver pool with approximate Colombo-area coordinates
_mock_drivers = [
    {"driver_id": "drv-001", "name": "Kasun Perera",   "lat": 6.9271, "lng": 79.8612},
    {"driver_id": "drv-002", "name": "Priya Fernando",  "lat": 6.9000, "lng": 79.8500},
    {"driver_id": "drv-003", "name": "Amal Jayasinghe", "lat": 6.9500, "lng": 79.8700},
]


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in km between two (lat, lng) points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _find_nearest_driver(lat: float, lng: float) -> Dict:
    if lat is None or lng is None:
        return _mock_drivers[0]
    return min(
        _mock_drivers,
        key=lambda d: _haversine(lat, lng, d["lat"], d["lng"]),
    )


async def ros_optimise_route(order) -> Dict[str, Any]:
    """
    Simulate the ROS OptimiseRoute REST call.
    Returns a route plan with assigned driver and waypoints.
    """
    await asyncio.sleep(0.15)   # simulate cloud API latency

    route_id = f"ROS-{str(uuid.uuid4())[:8].upper()}"
    driver = _find_nearest_driver(order.lat, order.lng)

    route = {
        "route_id": route_id,
        "assigned_driver_id": driver["driver_id"],
        "assigned_driver_name": driver["name"],
        "waypoints": [
            {
                "order_id": order.id,
                "address": order.delivery_address,
                "lat": order.lat,
                "lng": order.lng,
                "sequence": 1,
                "estimated_arrival": "2026-02-22T09:30:00Z",
            }
        ],
        "total_distance_km": round(
            _haversine(driver["lat"], driver["lng"],
                       order.lat or driver["lat"],
                       order.lng or driver["lng"]), 2),
        "status": "OPTIMISED",
    }

    _routes[route_id] = route
    logger.info("[ROS Mock] Route optimised – route_id=%s, driver=%s",
                route_id, driver["name"])
    return route


async def ros_cancel_route(route_id: Optional[str]) -> None:
    """Compensating transaction: cancel route plan in ROS."""
    await asyncio.sleep(0.05)
    if route_id and route_id in _routes:
        _routes[route_id]["status"] = "CANCELLED"
    logger.info("[ROS Mock] Route %s cancelled (compensation)", route_id)


async def ros_update_route(route_id: str, new_points: list) -> Dict[str, Any]:
    """Push a route update (e.g. new high-priority delivery for a driver)."""
    await asyncio.sleep(0.1)
    if route_id not in _routes:
        raise KeyError(f"Route {route_id} not found")
    _routes[route_id]["waypoints"].extend(new_points)
    _routes[route_id]["status"] = "UPDATED"
    return _routes[route_id]


def get_route(route_id: str) -> Optional[Dict[str, Any]]:
    return _routes.get(route_id)


def get_all_routes() -> Dict[str, Dict]:
    return _routes
