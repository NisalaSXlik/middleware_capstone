# SwiftTrack – Middleware Platform for SwiftLogistics (Pvt) Ltd.

**Course:** Middleware Architecture (SCS2314) | UCSC, January 2026  
**Assignment Deadline:** 28 February 2026  
**Scenario:** SwiftLogistics Last-Mile Delivery Platform

---

## Table of Contents

1. [Team Members & Responsibilities](#1-team-members--responsibilities)
2. [Introduction to the Solution](#2-introduction-to-the-solution)
3. [Architecture](#3-architecture)
4. [Architectural & Integration Patterns](#4-architectural--integration-patterns)
5. [Prototype Description](#5-prototype-description)
6. [Information Security Considerations](#6-information-security-considerations)
7. [Quick Start](#7-quick-start)
8. [API Reference](#8-api-reference)

---

## 1. Team Members & Responsibilities

The team is divided into five focused sections, each owning a distinct layer of the middleware architecture.

| # | Responsibility | Key Deliverables | Files |
|---|---|---|---|
| **Member 1** | **Architecture Lead & System Design** | Overall architecture decisions, database schema, service registry, system startup lifecycle, documentation | `database.py`, `models.py`, `main.py`, `service_registry.py`, `README.md` |
| **Member 2** | **CMS Integration (SOAP/XML)** | SOAP protocol adapter, XML envelope builder/parser, mock CMS service, client registration | `protocol_adapter.py` (SOAP), `cms_service.py`, `ClientPortal.js` |
| **Member 3** | **ROS Integration (REST/JSON)** | REST adapter, route optimisation mock (Haversine), order intake endpoints, order form UI | `protocol_adapter.py` (REST), `ros_service.py`, `OrderForm.js` |
| **Member 4** | **WMS & Async Communication** | TCP binary protocol, WMS mock TCP server, RabbitMQ message broker, Saga distributed-transaction orchestrator | `protocol_adapter.py` (TCP), `wms_service.py`, `message_broker.py`, `saga_manager.py` |
| **Member 5** | **Frontend & Real-time Communication** | React SPA, WebSocket manager, live event feed, driver dashboard, JWT auth flow | `main.py` (WebSocket), all `frontend/src/` files |

### Member 1 – Architecture Lead
Responsible for the holistic design of the SwiftTrack middleware platform. Defined the canonical message format, set up the async SQLAlchemy/SQLite database layer, implemented the Service Registry singleton, and orchestrated the application startup/shutdown lifecycle. Also authored all architecture documentation.

### Member 2 – CMS Integration (SOAP/XML)
Integrated the legacy Client Management System's SOAP/XML API. Built the SOAP envelope builder (`build_soap_create_order`) and XML parser (`parse_soap_response`). Implemented the mock CMS service that exercises the full SOAP code path in-process. Authored the `ClientPortal.js` component and client registration/auth endpoints.

### Member 3 – ROS Integration (REST/JSON)
Integrated the third-party cloud Route Optimisation System's RESTful API. Implemented `build_ros_route_request` and `call_ros_rest` in the protocol adapter. The mock ROS service applies a real Haversine distance algorithm to assign the nearest driver. Authored the `OrderForm.js` React component and the order submission flow.

### Member 4 – WMS Integration & Async Communication
Designed the proprietary WMS TCP/IP binary framing protocol (`encode_wms_message` / `decode_wms_message`) and spun up a real `asyncio` TCP server on port 9000. Built the full message broker abstraction supporting both in-process `asyncio.Queue` (fallback) and production-grade RabbitMQ via `aio-pika`. Implemented the **Saga Orchestrator** coordinating the three-step distributed transaction with automatic compensating transactions on failure.

### Member 5 – Frontend & Real-time Communication
Built the entire React SPA: routing, protected pages, login/register flows, driver dashboard with live GPS push, and the real-time event feed. Implemented the `ConnectionManager` in `main.py` supporting named WebSocket channels. The `RealTimeTracker` component demonstrates the Observer pattern visually with a live event console.

---

## 2. Introduction to the Solution

SwiftTrack is a web-based middleware integration platform built for SwiftLogistics (Pvt) Ltd. It connects three siloed, heterogeneous back-end systems:

| System | Protocol | Challenge |
|--------|----------|-----------|
| **CMS** (Client Management) | SOAP/XML legacy on-premise | Protocol mismatch with modern REST world |
| **ROS** (Route Optimisation) | REST/JSON third-party cloud | Synchronous blocking during high-traffic peaks |
| **WMS** (Warehouse Management) | Proprietary TCP/IP binary | Custom framing, stateful connections |

The prototype demonstrates a complete **order submission flow**: client submits order → Saga orchestrates CMS/WMS/ROS integrations → client sees real-time status via WebSocket.

---

## 3. Architecture

### 3.1 Conceptual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│   Web Portal (React)              Driver Mobile App (PWA)       │
└──────────────────────┬────────────────────────┬─────────────────┘
                       │ REST / WebSocket        │
┌──────────────────────▼────────────────────────▼─────────────────┐
│             MIDDLEWARE / API GATEWAY LAYER (FastAPI)             │
│  FastAPI REST API  │  WebSocket Manager  │  Service Registry    │
│  ──────────────────────────────────────────────────────────────  │
│         Message Broker (RabbitMQ / asyncio.Queue)               │
│  ──────────────────────────────────────────────────────────────  │
│         Saga Orchestrator  ←→  Protocol Adapter Layer           │
│             SOAP Adapter  │  REST Adapter  │  TCP Adapter       │
└──────────────┬─────────────────────┬──────────────────┬─────────┘
               │                     │                  │
         CMS (SOAP)           ROS (REST)          WMS (TCP)
         On-premise           Cloud SaaS          Warehouse
```

### 3.2 Implementation Architecture

```
backend/app/
  main.py              ← FastAPI + WebSocket ConnectionManager
  database.py          ← Async SQLAlchemy (SQLite → PostgreSQL ready)
  models.py            ← ORM + Pydantic schemas
  routes.py            ← All HTTP endpoints
  middleware_core/
    service_registry.py  ← Service discovery singleton
    message_broker.py    ← RabbitMQ / asyncio.Queue abstraction
    protocol_adapter.py  ← SOAP / REST / TCP translators
    saga_manager.py      ← Distributed transaction orchestrator
  mock_services/
    cms_service.py       ← Mock CMS (full SOAP XML code path)
    ros_service.py       ← Mock ROS (Haversine route optimisation)
    wms_service.py       ← Mock WMS (real asyncio TCP server :9000)

frontend/src/
  App.js               ← React Router v6 + protected routes
  services/api.js      ← Axios + WebSocket factory
  components/
    LoginPage.js / RegisterPage.js
    ClientPortal.js / OrderForm.js / OrderStatus.js
    DriverDashboard.js / RealTimeTracker.js / AdminDashboard.js
```

### 3.3 Alternative Architectures

#### Alternative A – ESB-based (Apache Camel / MuleSoft)
An ESB acts as a central routing hub with built-in SOAP and TCP connectors.  
**Pros:** centralised routing, visual flow editors.  
**Cons:** single point of failure, bottleneck under load, heavy vendor lock-in.

#### Alternative B – Event-Driven Microservices (Apache Kafka)
Each integration is a separate microservice; Kafka is the event backbone.  
**Pros:** extreme throughput, independent deployment.  
**Cons:** high operational complexity, difficult exactly-once Saga semantics.

#### Chosen – Orchestrated Middleware with Pub-Sub (FastAPI + RabbitMQ)
**Rationale:** simpler to operate, RabbitMQ durable queuing prevents message loss, Saga gives explicit transaction recovery, FastAPI `asyncio` handles TCP/HTTP/WebSocket concurrently in one process, easily migrated to microservices by splitting routes.

---

## 4. Architectural & Integration Patterns

| Pattern | Location | Challenge Addressed |
|---------|----------|---------------------|
| **Protocol Adapter** | `protocol_adapter.py` | Heterogeneous Systems (Ch. 1) |
| **Saga (Orchestration)** | `saga_manager.py` | Transaction Management (Ch. 4) |
| **Publish-Subscribe + Queue** | `message_broker.py` | Async High-Volume Processing (Ch. 3) |
| **Service Registry & Discovery** | `service_registry.py` | Scalability & Resilience (Ch. 5) |
| **Observer via WebSocket** | `main.py`, `RealTimeTracker.js` | Real-time Tracking (Ch. 2) |
| **API Gateway** | `main.py` (CORS, JWT, routing) | Security + Single Entry Point (Ch. 6) |
| **Message Translator** | `protocol_adapter.py` | Format translation across all systems |

### Saga Compensation Flow
```
Order Received
  └─► [CMS CreateOrder]     ──fail──► compensate CMS.CancelOrder
        └─► [WMS RegisterPackage] ──fail──► comp. WMS + CMS
              └─► [ROS OptimiseRoute] ──fail──► comp. ROS + WMS + CMS
                    └─► Order = PROCESSING  ✅
```

---

## 5. Prototype Description

### Order Submission Flow
1. Client submits order via `OrderForm.js` → `POST /api/v1/orders`
2. Gateway creates `Order` record, publishes `order.created` to broker, starts Saga as background task
3. **Saga Step 1 – CMS:** builds SOAP XML envelope → `cms_create_order` → returns `cmsOrderId`
4. **Saga Step 2 – WMS:** encodes/decodes proprietary TCP frame → `wms_register_package` → returns `package_id`; also starts real asyncio TCP server on `:9000`
5. **Saga Step 3 – ROS:** Haversine distance selects nearest driver → `ros_optimise_route` → returns `route_id`
6. At each step `ws_manager.broadcast(order_update)` → `OrderStatus.js` progress bar updates in real time

### Driver Flow
1. Driver logs in → delivery manifest at `/driver`
2. Browser pushes GPS every 30 s → `/api/v1/drivers/location` → WebSocket broadcast to client portal
3. Driver marks package delivered/failed → `/api/v1/deliveries/{id}/complete` → client portal updates immediately

### Real-time Notification Architecture
`RealTimeTracker.js` maintains a persistent WebSocket to `ws://localhost:8000/ws/global`. Every event is pushed server→client without polling. In production, a **Redis Channel Layer** behind multiple FastAPI replicas enables horizontal scaling of WebSocket broadcasts.

---

## 6. Information Security Considerations

1. **Passwords** hashed with `bcrypt` (passlib); never stored in plaintext
2. **JWT tokens** (HS256, 8-hour expiry) for stateless authentication; `SECRET_KEY` must come from environment variable in production
3. **Role-based access control** — clients can only access their own orders; drivers only their assigned deliveries
4. **HTTPS + WSS** required in production (nginx + Let's Encrypt); all browser traffic must be encrypted
5. **Input validation** via Pydantic models — all requests validated before hitting business logic (prevents injection)
6. **CORS restricted** to known frontend origin; expanded to `swifttrack.swiftlogistics.lk` in production
7. **Rate limiting** at API Gateway level to handle Black Friday / Avurudu traffic spikes
8. **CMS SOAP endpoint** reachable only over private VPN/network segment
9. **RabbitMQ** must use non-default credentials + AMQPS (TLS) in production; virtual hosts isolate queues
10. **WMS TCP** wrapped in `ssl.SSLContext` in production to prevent MITM
11. **Secrets management** (ROS API key, SOAP credentials) via environment variables or vault; never committed to Git
12. **Data at rest encryption** — PostgreSQL pgcrypto for PII fields; proof-of-delivery photos in private S3 bucket
13. **Audit logging** — all Saga step completions/compensations logged with timestamp for forensics

---

## 7. Quick Start

### Without Docker (local development)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm start
```

### With Docker Compose (recommended)

```bash
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:3000 | React portal |
| http://localhost:15672 | RabbitMQ Management (guest/guest) |

### Demo Credentials (auto-seeded on first run)

| Role | Email | Password |
|------|-------|----------|
| Client | `demo@shopfast.lk` | `demo1234` |
| Driver | `driver@swiftlogistics.lk` | `driver1234` |

---

## 8. API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/register/client` | — | Register new e-commerce client |
| `POST` | `/api/v1/auth/register/driver` | — | Register new driver |
| `POST` | `/api/v1/auth/token` | — | Login → JWT |
| `POST` | `/api/v1/orders` | Client | Submit order (triggers Saga) |
| `GET`  | `/api/v1/orders` | Client/Driver | List my orders |
| `GET`  | `/api/v1/orders/{id}` | Any | Get single order |
| `GET`  | `/api/v1/drivers/manifest` | Driver | Today's delivery manifest |
| `PUT`  | `/api/v1/drivers/location` | Driver | Push GPS coordinates |
| `PUT`  | `/api/v1/deliveries/{id}/complete` | Driver | Mark delivered / failed |
| `GET`  | `/api/v1/admin/registry` | — | Service registry status |
| `GET`  | `/api/v1/admin/wms-packages` | — | WMS package store |
| `GET`  | `/api/v1/admin/ros-routes` | — | ROS route plans |
| `GET`  | `/api/v1/admin/cms-orders` | — | CMS order store |
| `GET`  | `/api/v1/health` | — | Backend health |
| `WS`   | `/ws/{channel}` | — | Real-time WebSocket feed |

Full interactive docs: **http://localhost:8000/docs**

## Project Structure

```
fullstack-app
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── routes.py
│   ├── requirements.txt
│   └── README.md
├── frontend
│   ├── public
│   │   └── index.html
│   ├── src
│   │   ├── App.js
│   │   ├── components
│   │   │   └── Header.js
│   │   └── index.js
│   ├── package.json
│   └── README.md
└── README.md
```

## Backend Setup

1. Navigate to the `backend` directory:
   ```
   cd backend
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the FastAPI application:
   ```
   uvicorn app.main:app --reload
   ```

4. Access the API documentation at `http://localhost:8000/docs`.

## Frontend Setup

1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Start the React application:
   ```
   npm start
   ```

4. Open your browser and go to `http://localhost:3000` to view the application.

## Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements for the project.

## License

This project is licensed under the MIT License.