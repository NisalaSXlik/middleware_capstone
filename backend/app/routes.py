"""
routes.py  –  All Members (combined)
FastAPI APIRouter – all HTTP endpoints for the SwiftTrack platform.

  /auth/*          – Authentication (all members)
  /clients/*       – Client portal endpoints (Member 2)
  /orders/*        – Order intake & tracking (Member 3 + Member 4)
  /drivers/*       – Driver mobile app endpoints (Member 5)
  /admin/*         – System diagnostics (Member 1)
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Client, ClientCreate, ClientOut,
    Driver, DriverCreate, DriverOut,
    Order, OrderCreate, OrderOut, OrderStatus,
    DeliveryUpdate, DriverLocationUpdate, LoginRequest, TokenResponse,
)
from app.middleware_core.message_broker import (
    get_broker, TOPIC_ORDER_CREATED, TOPIC_DELIVERY_UPDATE, TOPIC_DRIVER_LOCATION,
)
from app.middleware_core.saga_manager import OrderSaga

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

SECRET_KEY = "swifttrack-secret-key-change-in-prod"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8 hours

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + (expires_delta or timedelta(minutes=60))
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme),
                            db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        role: str = payload.get("role", "client")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return {"id": sub, "role": role}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/register/client", response_model=ClientOut, tags=["Auth"])
async def register_client(data: ClientCreate, db: AsyncSession = Depends(get_db)):
    """Register a new e-commerce client."""
    existing = (await db.execute(select(Client).where(Client.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    client = Client(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        cms_ref=f"CMS-CLIENT-{data.email.split('@')[0].upper()}",
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/auth/register/driver", response_model=DriverOut, tags=["Auth"])
async def register_driver(data: DriverCreate, db: AsyncSession = Depends(get_db)):
    """Register a new delivery driver."""
    existing = (await db.execute(select(Driver).where(Driver.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    driver = Driver(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        vehicle=data.vehicle,
    )
    db.add(driver)
    await db.commit()
    await db.refresh(driver)
    return driver


@router.post("/auth/token", response_model=TokenResponse, tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends(),
                db: AsyncSession = Depends(get_db)):
    """OAuth2 password flow – accepts both clients and drivers."""
    email = form_data.username

    # Try client first
    client = (await db.execute(select(Client).where(Client.email == email))).scalar_one_or_none()
    if client and verify_password(form_data.password, client.password):
        token = create_token({"sub": client.id, "role": "client"})
        return TokenResponse(access_token=token, role="client")

    # Try driver
    driver = (await db.execute(select(Driver).where(Driver.email == email))).scalar_one_or_none()
    if driver and verify_password(form_data.password, driver.password):
        token = create_token({"sub": driver.id, "role": "driver"})
        return TokenResponse(access_token=token, role="driver")

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


# ---------------------------------------------------------------------------
# Client portal – Order endpoints  (Member 2 + Member 4)
# ---------------------------------------------------------------------------

@router.post("/orders", response_model=OrderOut, tags=["Orders"])
async def submit_order(
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new delivery order.
    Triggers the OrderSaga: CMS → WMS → ROS in sequence.
    Published to message broker for async processing.
    """
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can submit orders")

    order = Order(
        client_id=current_user["id"],
        recipient_name=order_data.recipient_name,
        recipient_phone=order_data.recipient_phone,
        delivery_address=order_data.delivery_address,
        lat=order_data.lat,
        lng=order_data.lng,
        notes=order_data.notes,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()   # get the generated ID without full commit

    # Publish to message broker (async processing pattern)
    broker = get_broker()
    await broker.publish(TOPIC_ORDER_CREATED, {
        "order_id": order.id,
        "client_id": order.client_id,
        "address": order.delivery_address,
    })

    # Run the Saga (orchestrates CMS / WMS / ROS integration)
    from app.main import ws_manager
    saga = OrderSaga(db=db, order=order, ws_manager=ws_manager)
    asyncio.create_task(saga.execute())   # non-blocking – client gets immediate response

    await db.commit()
    await db.refresh(order)
    return order


@router.get("/orders", response_model=List[OrderOut], tags=["Orders"])
async def list_orders(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List orders for the logged-in client."""
    if current_user["role"] == "client":
        result = await db.execute(select(Order).where(Order.client_id == current_user["id"]).order_by(Order.created_at.desc()))
    else:
        result = await db.execute(select(Order).where(Order.driver_id == current_user["id"]).order_by(Order.created_at.desc()))
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=OrderOut, tags=["Orders"])
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ---------------------------------------------------------------------------
# Driver endpoints  (Member 5)
# ---------------------------------------------------------------------------

@router.get("/drivers/manifest", response_model=List[OrderOut], tags=["Drivers"])
async def get_driver_manifest(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's delivery manifest for the logged-in driver."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Order)
        .where(Order.driver_id == current_user["id"])
        .where(Order.created_at >= today_start)
        .where(Order.status.in_([OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PROCESSING]))
    )
    return result.scalars().all()


@router.put("/drivers/location", tags=["Drivers"])
async def update_driver_location(
    location: DriverLocationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Drivers push their GPS coordinates from the mobile app."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")
    driver = (await db.execute(select(Driver).where(Driver.id == current_user["id"]))).scalar_one_or_none()
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.lat = location.lat
    driver.lng = location.lng
    await db.commit()

    # Broadcast location update via WebSocket
    from app.main import ws_manager
    await ws_manager.broadcast({
        "event": "driver_location",
        "driver_id": current_user["id"],
        "lat": location.lat,
        "lng": location.lng,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Also publish to message broker for event-driven subscribers
    broker = get_broker()
    await broker.publish(TOPIC_DRIVER_LOCATION, {
        "driver_id": current_user["id"],
        "lat": location.lat,
        "lng": location.lng,
    })
    return {"status": "ok"}


@router.put("/deliveries/{order_id}/complete", response_model=OrderOut, tags=["Drivers"])
async def complete_delivery(
    order_id: str,
    update: DeliveryUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a delivery as completed or failed. Triggers WebSocket notification."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status           = update.status
    order.failure_reason   = update.failure_reason
    order.proof_of_delivery = update.proof_of_delivery
    order.updated_at       = datetime.utcnow()
    await db.commit()
    await db.refresh(order)

    # Broadcast to client portal (real-time tracking)
    from app.main import ws_manager
    await ws_manager.broadcast({
        "event": "order_update",
        "order_id": order.id,
        "status": order.status.value,
        "message": f"Delivery {order.status.value.lower().replace('_', ' ')}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Publish delivery event to broker
    broker = get_broker()
    await broker.publish(TOPIC_DELIVERY_UPDATE, {
        "order_id": order.id,
        "status": order.status.value,
        "driver_id": current_user["id"],
    })

    return order


# ---------------------------------------------------------------------------
# Admin / diagnostics  (Member 1)
# ---------------------------------------------------------------------------

@router.get("/admin/registry", tags=["Admin"])
async def service_registry_status():
    """List all registered services and their health status."""
    from app.middleware_core.service_registry import registry
    return registry.list_services()


@router.get("/admin/wms-packages", tags=["Admin"])
async def wms_packages():
    """View all packages stored in the mock WMS."""
    from app.mock_services.wms_service import get_all_packages
    return get_all_packages()


@router.get("/admin/ros-routes", tags=["Admin"])
async def ros_routes():
    """View all routes stored in the mock ROS."""
    from app.mock_services.ros_service import get_all_routes
    return get_all_routes()


@router.get("/admin/cms-orders", tags=["Admin"])
async def cms_orders():
    """View all orders stored in the mock CMS."""
    from app.mock_services.cms_service import get_all_cms_orders
    return get_all_cms_orders()


@router.get("/health", tags=["Admin"])
async def health():
    return {"status": "UP", "service": "SwiftTrack Middleware", "time": datetime.utcnow().isoformat()}
