"""
main.py  –  Member 1 (Architecture Lead)
FastAPI application entry point for the SwiftTrack middleware platform.

Responsibilities:
  • App lifecycle (startup / shutdown events)
  • CORS configuration (frontend ↔ backend)
  • WebSocket connection manager (real-time notifications)
  • Service registration on startup
  • Include all API routers

Run:  uvicorn app.main:app --reload --port 8000
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# WebSocket Connection Manager  (Member 5 – Real-time)
# ---------------------------------------------------------------------------

class ConnectionManager:
    """
    Manages active WebSocket connections for real-time push notifications.

    Architectural pattern: Observer / Event-Driven
    Both the client portal and driver app connect via WebSocket;
    the middleware broadcasts order/delivery events to all subscribers.
    Channels allow targeting by client_id so drivers only get their updates.
    """

    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}   # channel → sockets

    async def connect(self, ws: WebSocket, channel: str = "global") -> None:
        await ws.accept()
        self._connections.setdefault(channel, []).append(ws)
        logger.info("[WS] Client connected – channel=%s, total=%d",
                    channel, sum(len(v) for v in self._connections.values()))

    def disconnect(self, ws: WebSocket, channel: str = "global") -> None:
        conns = self._connections.get(channel, [])
        if ws in conns:
            conns.remove(ws)
        logger.info("[WS] Client disconnected – channel=%s", channel)

    async def send_to(self, channel: str, data: dict) -> None:
        """Send a message to all sockets in a named channel."""
        dead: List[WebSocket] = []
        for ws in list(self._connections.get(channel, [])):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, channel)

    async def broadcast(self, data: dict) -> None:
        """Broadcast to ALL connected clients (global channel + all named channels)."""
        all_sockets: List[WebSocket] = []
        for conns in self._connections.values():
            all_sockets.extend(conns)

        dead: List[WebSocket] = []
        for ws in all_sockets:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            for channel, conns in self._connections.items():
                if ws in conns:
                    self.disconnect(ws, channel)


# Global singleton – imported by routes & saga_manager
ws_manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Application lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────
    logger.info("SwiftTrack starting up …")

    # 1. Initialise database tables
    from app.database import init_db
    await init_db()
    logger.info("Database initialised (SQLite)")

    # 2. Register services in the Service Registry
    from app.middleware_core.service_registry import registry
    registry.register("cms",  "http://127.0.0.1:8000/mock/cms",  "soap",
                      {"description": "Legacy Client Management System"})
    registry.register("wms",  "tcp://127.0.0.1:9000",            "tcp",
                      {"description": "Warehouse Management System"})
    registry.register("ros",  "http://127.0.0.1:8000/mock/ros",  "http",
                      {"description": "Route Optimisation System (cloud)"})
    logger.info("Services registered")

    # 3. Start in-process WMS TCP mock server
    from app.mock_services.wms_service import start_wms_tcp_server
    wms_server = await start_wms_tcp_server()

    # 4. Start periodic service-registry health checks (background)
    health_task = asyncio.create_task(
        registry.periodic_health_check(interval_seconds=60))

    # 5. Seed demo data (idempotent)
    await _seed_demo_data()

    yield     # ← application runs here

    # ── Shutdown ─────────────────────────────────────────────────────────
    health_task.cancel()
    wms_server.close()
    logger.info("SwiftTrack shut down cleanly")


async def _seed_demo_data():
    """Create demo client & driver accounts if they don't exist yet."""
    from app.database import AsyncSessionLocal
    from app.models import Client, Driver
    from app.routes import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # Demo client
        client_exists = (await db.execute(
            select(Client).where(Client.email == "demo@shopfast.lk")
        )).scalar_one_or_none()
        if not client_exists:
            db.add(Client(
                name="ShopFast Demo Client",
                email="demo@shopfast.lk",
                password=hash_password("demo1234"),
                cms_ref="CMS-CLIENT-DEMO",
            ))

        # Demo driver
        driver_exists = (await db.execute(
            select(Driver).where(Driver.email == "driver@swiftlogistics.lk")
        )).scalar_one_or_none()
        if not driver_exists:
            db.add(Driver(
                name="Kasun Perera (Demo)",
                email="driver@swiftlogistics.lk",
                password=hash_password("driver1234"),
                vehicle="Toyota KIA Light Truck – CAB-1234",
            ))

        await db.commit()
    logger.info("Demo seed data ready")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SwiftTrack – SwiftLogistics Middleware Platform",
    description=(
        "Middleware integration layer connecting CMS (SOAP), "
        "ROS (REST) and WMS (TCP/IP) for SwiftLogistics Pvt Ltd. "
        "Implements Saga, Pub-Sub, Service Registry, and WebSocket patterns."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routes
from app.routes import router as api_router
app.include_router(api_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# WebSocket endpoints  (Member 5)
# ---------------------------------------------------------------------------

@app.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    """
    WebSocket endpoint for real-time updates.
    channel: 'global' | client_id | driver_id
    """
    await ws_manager.connect(websocket, channel)
    try:
        while True:
            # Keep connection alive; clients can also send pings
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel)


# ---------------------------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "SwiftTrack Middleware Platform",
        "docs": "/docs",
        "health": "/api/v1/health",
        "websocket": "ws://localhost:8000/ws/{channel}",
    }
