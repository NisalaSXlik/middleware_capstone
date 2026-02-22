"""
models.py  –  Member 1 (Architecture Lead)
SQLAlchemy ORM table definitions + Pydantic request/response schemas
for the SwiftTrack platform.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr

from app.database import Base

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class OrderStatus(str, PyEnum):
    PENDING        = "PENDING"
    PROCESSING     = "PROCESSING"
    IN_WAREHOUSE   = "IN_WAREHOUSE"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED      = "DELIVERED"
    FAILED         = "FAILED"

class SagaStatus(str, PyEnum):
    STARTED    = "STARTED"
    COMPLETED  = "COMPLETED"
    COMPENSATING = "COMPENSATING"
    FAILED     = "FAILED"

# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------

class Client(Base):
    """E-commerce client registered in the CMS."""
    __tablename__ = "clients"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, nullable=False, index=True)
    password   = Column(String, nullable=False)          # hashed
    cms_ref    = Column(String, unique=True)             # CMS system reference
    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="client")


class Driver(Base):
    """Delivery driver using the SwiftTrack mobile app."""
    __tablename__ = "drivers"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, nullable=False)
    password   = Column(String, nullable=False)
    vehicle    = Column(String)
    lat        = Column(Float, default=6.9271)           # last known location
    lng        = Column(Float, default=79.8612)
    created_at = Column(DateTime, default=datetime.utcnow)

    deliveries = relationship("Order", back_populates="driver")


class Order(Base):
    """Core order entity – created from client portal, processed via CMS→WMS→ROS."""
    __tablename__ = "orders"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id        = Column(String, ForeignKey("clients.id"), nullable=False)
    driver_id        = Column(String, ForeignKey("drivers.id"), nullable=True)

    recipient_name   = Column(String, nullable=False)
    recipient_phone  = Column(String)
    delivery_address = Column(Text, nullable=False)
    lat              = Column(Float)
    lng              = Column(Float)

    status           = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    cms_order_id     = Column(String)   # reference returned by mock CMS
    wms_package_id   = Column(String)   # reference returned by mock WMS
    ros_route_id     = Column(String)   # reference returned by mock ROS

    notes            = Column(Text)
    proof_of_delivery = Column(Text)    # base64 photo or signature JSON
    failure_reason   = Column(Text)

    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client  = relationship("Client", back_populates="orders")
    driver  = relationship("Driver", back_populates="deliveries")
    saga    = relationship("SagaLog", back_populates="order", uselist=False)


class SagaLog(Base):
    """Tracks the distributed transaction (Saga) initiated per order."""
    __tablename__ = "saga_logs"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id   = Column(String, ForeignKey("orders.id"), unique=True)
    status     = Column(Enum(SagaStatus), default=SagaStatus.STARTED)
    steps      = Column(Text, default="[]")     # JSON list of step results
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="saga")

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ClientCreate(BaseModel):
    name: str
    email: str
    password: str

class ClientOut(BaseModel):
    id: str
    name: str
    email: str
    cms_ref: Optional[str] = None
    model_config = {"from_attributes": True}

class DriverCreate(BaseModel):
    name: str
    email: str
    password: str
    vehicle: Optional[str] = None

class DriverOut(BaseModel):
    id: str
    name: str
    email: str
    vehicle: Optional[str] = None
    lat: float
    lng: float
    model_config = {"from_attributes": True}

class OrderCreate(BaseModel):
    recipient_name: str
    recipient_phone: Optional[str] = None
    delivery_address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None

class OrderOut(BaseModel):
    id: str
    client_id: str
    driver_id: Optional[str] = None
    recipient_name: str
    delivery_address: str
    status: OrderStatus
    cms_order_id: Optional[str] = None
    wms_package_id: Optional[str] = None
    ros_route_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class DeliveryUpdate(BaseModel):
    status: OrderStatus
    failure_reason: Optional[str] = None
    proof_of_delivery: Optional[str] = None   # base64 image or signature

class DriverLocationUpdate(BaseModel):
    lat: float
    lng: float

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str