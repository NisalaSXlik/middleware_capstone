"""
wms_service.py  –  Member 4 (WMS / Async Integration)
Mock Warehouse Management System (WMS) – simulates the proprietary TCP/IP service.

The real WMS is accessed via asyncio TCP sockets (see protocol_adapter.call_wms_tcp).
This module provides an in-process mock, and also starts an actual asyncio TCP
server on 127.0.0.1:9000 so the TCP path in the protocol adapter can be tested
end-to-end within the same process.

Proprietary protocol frame:
  [SWIFT][type:1B][length:4B][json_payload]
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional

from app.middleware_core.protocol_adapter import (
    WMS_HEADER, WMS_MSG_REGISTER, WMS_MSG_ACK, WMS_MSG_ERROR,
    decode_wms_message, encode_wms_message,
)

logger = logging.getLogger(__name__)

WMS_TCP_HOST = "127.0.0.1"
WMS_TCP_PORT = 9000

# In-memory warehouse package store
_packages: Dict[str, Dict] = {}


# ---------------------------------------------------------------------------
# High-level service functions called by the Saga
# ---------------------------------------------------------------------------

async def wms_register_package(order) -> Dict[str, Any]:
    """
    Register a new package in the WMS.
    Uses the in-process mock; to use the real TCP server set USE_TCP_WMS=True.
    """
    await asyncio.sleep(0.1)   # simulate processing delay

    package_id = f"WMS-{str(uuid.uuid4())[:8].upper()}"
    _packages[package_id] = {
        "package_id": package_id,
        "order_id": order.id,
        "status": "RECEIVED",
        "location": "INTAKE_DOCK",
        "cms_order_id": order.cms_order_id,
    }
    logger.info("[WMS Mock] Package registered – package_id=%s", package_id)

    # Demonstrate encoding/decoding of the proprietary TCP frame
    payload = {"order_id": order.id, "recipient": order.recipient_name}
    encoded = encode_wms_message(WMS_MSG_REGISTER, payload)
    _, decoded = decode_wms_message(encoded)
    logger.debug("[WMS Mock] TCP frame round-trip OK: %s", decoded)

    return {"status": "ACK", "package_id": package_id}


async def wms_cancel_package(package_id: Optional[str]) -> None:
    """Compensating transaction: remove/cancel package from WMS."""
    await asyncio.sleep(0.05)
    if package_id and package_id in _packages:
        _packages[package_id]["status"] = "CANCELLED"
    logger.info("[WMS Mock] Package %s cancelled (compensation)", package_id)


async def wms_update_status(package_id: str, status: str,
                            location: str = "") -> Dict[str, Any]:
    """Update package status (e.g. LOADED_ON_VEHICLE, DELIVERED)."""
    if package_id not in _packages:
        raise KeyError(f"Package {package_id} not found in WMS")
    _packages[package_id]["status"] = status
    if location:
        _packages[package_id]["location"] = location
    logger.info("[WMS Mock] Package %s -> %s", package_id, status)
    return _packages[package_id]


def get_package(package_id: str) -> Optional[Dict]:
    return _packages.get(package_id)


def get_all_packages() -> Dict[str, Dict]:
    return _packages


# ---------------------------------------------------------------------------
# asyncio TCP server (demonstrates real TCP path, optional)
# ---------------------------------------------------------------------------

async def _handle_wms_client(reader: asyncio.StreamReader,
                              writer: asyncio.StreamWriter) -> None:
    """Handle a single TCP connection from the protocol adapter."""
    addr = writer.get_extra_info("peername")
    logger.debug("[WMS TCP] Connection from %s", addr)
    try:
        data = await asyncio.wait_for(reader.read(4096), timeout=5)
        msg_type, payload = decode_wms_message(data)

        if msg_type == WMS_MSG_REGISTER:
            package_id = f"WMS-TCP-{str(uuid.uuid4())[:6].upper()}"
            _packages[package_id] = {
                "package_id": package_id,
                "order_id": payload.get("order_id"),
                "status": "RECEIVED",
                "location": "INTAKE_DOCK",
            }
            response = encode_wms_message(WMS_MSG_ACK, {"package_id": package_id})
            logger.info("[WMS TCP] Registered package %s via TCP", package_id)
        else:
            response = encode_wms_message(
                WMS_MSG_ERROR, {"error": "Unknown message type"})

        writer.write(response)
        await writer.drain()
    except Exception as exc:
        logger.error("[WMS TCP] Error: %s", exc)
        err = encode_wms_message(WMS_MSG_ERROR, {"error": str(exc)})
        writer.write(err)
        await writer.drain()
    finally:
        writer.close()


async def start_wms_tcp_server() -> asyncio.AbstractServer:
    """Start the mock WMS TCP server. Called at app startup."""
    server = await asyncio.start_server(
        _handle_wms_client, WMS_TCP_HOST, WMS_TCP_PORT)
    logger.info("[WMS TCP] Mock server listening on %s:%d",
                WMS_TCP_HOST, WMS_TCP_PORT)
    return server
