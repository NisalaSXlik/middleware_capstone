"""
cms_service.py  –  Member 2 (CMS Integration)
Mock Client Management System (CMS) – simulates the legacy SOAP/XML API.

In production this module calls the real CMS SOAP endpoint.
For the prototype the responses are generated in-process so the
platform runs without a separate CMS server.

The SOAP XML structures are built correctly (matching the protocol
adapter's parser) so the CMS integration code path is fully exercised.
"""

import asyncio
import logging
import uuid
from typing import Any, Dict, Optional

from app.middleware_core.protocol_adapter import (
    build_soap_create_order,
    parse_soap_response,
    canonical_order,
)

logger = logging.getLogger(__name__)

# Simulated CMS order store (in production this lives in the CMS database)
_cms_orders: Dict[str, Dict] = {}


def _generate_cms_soap_response(cms_order_id: str, status: str = "CREATED") -> str:
    """
    Generate a realistic SOAP XML response as the CMS would return.
    The Saga's CMS step calls this through the protocol adapter during tests.
    """
    return f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cms="http://swiftlogistics.lk/cms">
  <soap:Header/>
  <soap:Body>
    <cms:CreateOrderResponse>
      <cms:cmsOrderId>{cms_order_id}</cms:cmsOrderId>
      <cms:status>{status}</cms:status>
      <cms:message>Order registered successfully in CMS</cms:message>
    </cms:CreateOrderResponse>
  </soap:Body>
</soap:Envelope>"""


async def cms_create_order(order) -> Dict[str, Any]:
    """
    Simulate the CMS CreateOrder SOAP call.
    Accepts an ORM Order object; converts to canonical dict then to SOAP XML.
    Returns parsed response as a Python dict.
    """
    await asyncio.sleep(0.1)   # simulate network round-trip

    cms_order_id = f"CMS-{str(uuid.uuid4())[:8].upper()}"

    # Build canonical message and SOAP XML (exercises the adapter code path)
    canonical = canonical_order(
        order_id=order.id,
        client_id=order.client_id,
        recipient=order.recipient_name,
        address=order.delivery_address,
        lat=order.lat,
        lng=order.lng,
        notes=order.notes,
    )
    soap_xml = build_soap_create_order(canonical)
    logger.debug("[CMS Mock] SOAP Request:\n%s", soap_xml)

    # Simulate CMS storing the order
    _cms_orders[cms_order_id] = {
        "order_id": order.id,
        "client_id": order.client_id,
        "status": "ACTIVE",
    }

    # Parse the mock SOAP response (exercises parse_soap_response)
    response_xml = _generate_cms_soap_response(cms_order_id)
    result = parse_soap_response(response_xml)
    logger.info("[CMS Mock] Order created – cmsOrderId=%s", cms_order_id)
    return result


async def cms_cancel_order(cms_order_id: Optional[str]) -> None:
    """Compensating transaction: cancel order in CMS."""
    await asyncio.sleep(0.05)
    if cms_order_id and cms_order_id in _cms_orders:
        _cms_orders[cms_order_id]["status"] = "CANCELLED"
    logger.info("[CMS Mock] Order %s cancelled (compensation)", cms_order_id)


async def cms_get_order(cms_order_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve order details from CMS (used by portal status queries)."""
    await asyncio.sleep(0.05)
    return _cms_orders.get(cms_order_id)


def get_all_cms_orders() -> Dict[str, Dict]:
    """Return all mock CMS orders (health/diagnostics endpoint)."""
    return _cms_orders
