"""
protocol_adapter.py  –  Member 2 (CMS) + Member 4 (WMS)
Protocol and data-format translation layer.

Handles three heterogeneous systems:
  • CMS  – SOAP/XML  (Member 2)
  • ROS  – REST/JSON (Member 3 – trivial, just httpx)
  • WMS  – Proprietary TCP/IP messaging (Member 4)

Architectural pattern: Adapter / Message Translator
Each adapter converts the SwiftTrack internal canonical format
to/from the protocol expected by the external system.
"""

import asyncio
import json
import logging
import xml.etree.ElementTree as ET
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)


# ===========================================================================
# Canonical message format (internal representation)
# ===========================================================================

def canonical_order(order_id: str, client_id: str, recipient: str,
                    address: str, lat: float | None, lng: float | None,
                    notes: str | None = None) -> Dict[str, Any]:
    return {
        "order_id": order_id,
        "client_id": client_id,
        "recipient": recipient,
        "address": address,
        "lat": lat,
        "lng": lng,
        "notes": notes or "",
    }


# ===========================================================================
# SOAP / XML Adapter  –  CMS Integration  (Member 2)
# ===========================================================================

CMS_SOAP_ENVELOPE = """\
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:cms="http://swiftlogistics.lk/cms">
  <soap:Header/>
  <soap:Body>
    <cms:{operation}>
      {body}
    </cms:{operation}>
  </soap:Body>
</soap:Envelope>"""


def build_soap_create_order(order: Dict[str, Any]) -> str:
    """Convert canonical order to CMS SOAP CreateOrder request XML."""
    body = (
        f"<cms:orderId>{order['order_id']}</cms:orderId>"
        f"<cms:clientId>{order['client_id']}</cms:clientId>"
        f"<cms:recipientName>{order['recipient']}</cms:recipientName>"
        f"<cms:deliveryAddress>{order['address']}</cms:deliveryAddress>"
        f"<cms:notes>{order['notes']}</cms:notes>"
    )
    return CMS_SOAP_ENVELOPE.format(operation="CreateOrder", body=body)


def parse_soap_response(xml_text: str) -> Dict[str, Any]:
    """Parse a SOAP response envelope and return the body content as a dict."""
    try:
        root = ET.fromstring(xml_text)
        ns = {
            "soap": "http://schemas.xmlsoap.org/soap/envelope/",
            "cms": "http://swiftlogistics.lk/cms",
        }
        body = root.find("soap:Body", ns)
        if body is None:
            return {"error": "No SOAP Body found"}
        result = {}
        for child in list(body)[0]:  # first element under Body
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            result[tag] = child.text
        return result
    except ET.ParseError as exc:
        logger.error("[SOAP Adapter] XML parse error: %s", exc)
        return {"error": str(exc)}


async def call_cms_soap(cms_url: str, action: str,
                        order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Send SOAP request to CMS endpoint and return parsed response dict.
    SOAPAction header identifies the operation.
    """
    xml_payload = build_soap_create_order(order)
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": f'"http://swiftlogistics.lk/cms/{action}"',
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(cms_url, content=xml_payload.encode(),
                                     headers=headers)
            resp.raise_for_status()
            return parse_soap_response(resp.text)
    except httpx.RequestError as exc:
        logger.error("[SOAP Adapter] Request failed: %s", exc)
        raise


# ===========================================================================
# REST / JSON Adapter  –  ROS Integration  (Member 3)
# ===========================================================================

def build_ros_route_request(order: Dict[str, Any], driver_ids: list) -> Dict:
    """Convert canonical order to ROS REST route-optimisation request."""
    return {
        "delivery_points": [
            {
                "order_id": order["order_id"],
                "address": order["address"],
                "lat": order["lat"],
                "lng": order["lng"],
            }
        ],
        "available_drivers": driver_ids,
    }


async def call_ros_rest(ros_url: str, order: Dict[str, Any],
                        driver_ids: list) -> Dict[str, Any]:
    """POST to ROS REST API and return JSON route plan."""
    payload = build_ros_route_request(order, driver_ids)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{ros_url}/routes/optimise", json=payload)
            resp.raise_for_status()
            return resp.json()
    except httpx.RequestError as exc:
        logger.error("[REST Adapter] ROS request failed: %s", exc)
        raise


# ===========================================================================
# TCP / Proprietary Adapter  –  WMS Integration  (Member 4)
# ===========================================================================

WMS_MSG_REGISTER  = 0x01
WMS_MSG_STATUS    = 0x02
WMS_MSG_ACK       = 0x10
WMS_MSG_ERROR     = 0xFF

WMS_HEADER = b"SWIFT"     # 5-byte magic


def encode_wms_message(msg_type: int, payload: Dict[str, Any]) -> bytes:
    """
    Encode a proprietary WMS TCP message.
    Frame: [SWIFT][type:1][length:4][json_payload]
    """
    body = json.dumps(payload).encode()
    header = WMS_HEADER + bytes([msg_type]) + len(body).to_bytes(4, "big")
    return header + body


def decode_wms_message(data: bytes) -> tuple[int, Dict[str, Any]]:
    """Decode a WMS TCP frame back to (msg_type, payload_dict)."""
    if not data.startswith(WMS_HEADER):
        raise ValueError("Invalid WMS magic header")
    msg_type = data[5]
    length = int.from_bytes(data[6:10], "big")
    payload = json.loads(data[10:10 + length].decode())
    return msg_type, payload


async def call_wms_tcp(host: str, port: int,
                       order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Open a TCP connection to WMS and send a RegisterPackage message.
    Returns the decoded ACK payload.
    Falls back to mock response if host is 'mock'.
    """
    if host == "mock":
        # Inline mock – no real TCP needed for prototype
        logger.info("[TCP Adapter] WMS mock – simulating RegisterPackage")
        await asyncio.sleep(0.05)   # simulate network latency
        return {
            "status": "ACK",
            "package_id": f"WMS-{order['order_id'][:8].upper()}",
        }

    try:
        reader, writer = await asyncio.open_connection(host, port)
        msg = encode_wms_message(WMS_MSG_REGISTER, order)
        writer.write(msg)
        await writer.drain()

        raw = await asyncio.wait_for(reader.read(4096), timeout=5)
        msg_type, payload = decode_wms_message(raw)
        writer.close()
        await writer.wait_closed()

        if msg_type == WMS_MSG_ACK:
            return payload
        raise RuntimeError(f"WMS returned error: {payload}")
    except (OSError, asyncio.TimeoutError) as exc:
        logger.error("[TCP Adapter] WMS connection failed: %s", exc)
        raise
