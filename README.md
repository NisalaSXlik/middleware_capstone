# SwiftTrack – How to Run & Team Member Tasks
**Course:** SCS2314 – Middleware Architecture | UCSC Jan 2026

---

## How to Run the Project

### Option A – Local (No Docker)

#### Step 1 – Start the Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at **http://localhost:8000**  
Interactive API docs at **http://localhost:8000/docs**

---

#### Step 2 – Start the Frontend

Open a **new terminal**:

```bash
cd frontend

# Install Node packages
npm install

# Start the React dev server
npm start
```

Frontend will open at **http://localhost:3000**

---

#### Step 3 – Log In and Test

| Role   | Email                        | Password     |
|--------|------------------------------|--------------|
| Client | `demo@shopfast.lk`           | `demo1234`   |
| Driver | `driver@swiftlogistics.lk`   | `driver1234` |

These demo accounts are **auto-created** every time the backend starts.

---

### Option B – Docker Compose (All-in-one)

Requires Docker Desktop installed and running.

```bash
# From the project root (where docker-compose.yml lives)
docker compose up --build
```

| URL                        | What it is                        |
|----------------------------|-----------------------------------|
| http://localhost:3000      | React Client/Driver Portal        |
| http://localhost:8000/docs | FastAPI Swagger UI                |
| http://localhost:8000      | REST API root                     |
| http://localhost:15672     | RabbitMQ Management (guest/guest) |

To stop:
```bash
docker compose down
```

---

### WebSocket Real-time Feed

Once logged in, go to **Live Tracking** (client) or watch the **System** page.  
The backend streams events to the browser over:
```
ws://localhost:8000/ws/global
```
Every order status change and driver GPS update appears live without refreshing.

---

## What Each Member Does & How to Verify

---

### Member 1 – Architecture Lead

**Responsibilities:**
- Designed the overall middleware architecture
- Set up the async SQLite database (`database.py`)
- Defined all ORM models and Pydantic schemas (`models.py`)
- Implemented the **Service Registry** (in-memory service discovery)
- Wrote the FastAPI application startup/shutdown lifecycle in `main.py`
- Seeded demo accounts on first run
- Authored all documentation (`README.md`, `RUNNING_GUIDE.md`)

**How to verify:**
1. Start the backend — the console logs show services being registered:
   ```
   [Registry] Registered service 'cms' at http://127.0.0.1:8000/mock/cms (soap)
   [Registry] Registered service 'wms' at tcp://127.0.0.1:9000 (tcp)
   [Registry] Registered service 'ros' at http://127.0.0.1:8000/mock/ros (http)
   ```
2. Open **http://localhost:8000/api/v1/admin/registry** — returns a JSON object listing all three services with their health status.
3. The SQLite database file `swifttrack.db` is created automatically on first run.

**Files owned:**
- `backend/app/database.py`
- `backend/app/models.py`
- `backend/app/main.py` (startup + WebSocket manager)
- `backend/app/middleware_core/service_registry.py`
- `README.md` / `RUNNING_GUIDE.md`

---

### Member 2 – CMS Integration (SOAP/XML)

**Responsibilities:**
- Built the **SOAP/XML Protocol Adapter** — translates the internal order format into a correctly structured SOAP XML envelope that the legacy CMS expects
- Implemented the XML response parser that converts the CMS's SOAP response back into a Python dict
- Created the mock CMS service (`cms_service.py`) that exercises the full SOAP code path in-process
- Implemented client registration and login endpoints
- Built the **Client Portal** UI page

**How to verify:**
1. Register as a new client at **http://localhost:3000/register**
2. Log in and go to **My Orders**
3. Submit a new order — check the backend console for:
   ```
   [CMS Mock] SOAP Request:
   <?xml version="1.0" ...><soap:Envelope>...<cms:CreateOrder>...
   [CMS Mock] Order created – cmsOrderId=CMS-XXXXXXXX
   ```
4. Open **http://localhost:8000/api/v1/admin/cms-orders** to see the order stored in the mock CMS

**Files owned:**
- `backend/app/middleware_core/protocol_adapter.py` — SOAP section (`build_soap_create_order`, `parse_soap_response`, `call_cms_soap`)
- `backend/app/mock_services/cms_service.py`
- `backend/app/routes.py` — `/auth/register/client`, `/auth/token`
- `frontend/src/components/ClientPortal.js`
- `frontend/src/components/LoginPage.js`
- `frontend/src/components/RegisterPage.js`

---

### Member 3 – ROS Integration (REST/JSON)

**Responsibilities:**
- Built the **REST/JSON Protocol Adapter** for the cloud-based Route Optimisation System
- Implemented the mock ROS service with a real **Haversine distance algorithm** to assign the nearest available driver to each delivery
- Authored the order submission API endpoints
- Built the **Order Form** and **Order Status** UI pages

**How to verify:**
1. Log in as a client and click **New Order** at **http://localhost:3000/portal/submit**
2. Fill in a recipient name and delivery address, then submit
3. Check the backend console for:
   ```
   [ROS Mock] Route optimised – route_id=ROS-XXXXXXXX, driver=Kasun Perera
   ```
4. Open **http://localhost:8000/api/v1/admin/ros-routes** — the route plan will show the assigned driver, distance in km, and estimated arrival time

**Files owned:**
- `backend/app/middleware_core/protocol_adapter.py` — REST section (`build_ros_route_request`, `call_ros_rest`)
- `backend/app/mock_services/ros_service.py`
- `backend/app/routes.py` — `POST /orders`, `GET /orders`, `GET /orders/{id}`
- `frontend/src/components/OrderForm.js`
- `frontend/src/components/OrderStatus.js`

---

### Member 4 – WMS Integration & Async Communication

**Responsibilities:**
- Designed the **proprietary WMS TCP/IP binary protocol** — custom 10-byte frame header (`SWIFT` magic + message type + payload length) followed by JSON payload
- Started a real **asyncio TCP server** on port 9000 that decodes the frames and registers packages
- Built the **Message Broker** abstraction supporting both RabbitMQ (production) and an in-process `asyncio.Queue` (development fallback)
- Implemented the **Saga Orchestrator** that coordinates the three-step distributed transaction (CMS → WMS → ROS) and automatically runs compensating transactions if any step fails

**How to verify:**
1. Start the backend — console shows:
   ```
   [WMS TCP] Mock server listening on 127.0.0.1:9000
   [Broker] Using InProcessBroker (RabbitMQ not configured)
   ```
2. Submit an order — console shows the Saga executing:
   ```
   [Saga] CMS step OK – cms_order_id=CMS-...
   [WMS Mock] Package registered – package_id=WMS-...
   [Saga] ROS step OK – route_id=ROS-...
   [Saga] Order saga completed
   ```
3. Open **http://localhost:8000/api/v1/admin/wms-packages** to see the registered package
4. With Docker Compose running, the broker automatically switches to RabbitMQ — visible in the RabbitMQ management UI at **http://localhost:15672** under Queues

**Files owned:**
- `backend/app/middleware_core/protocol_adapter.py` — TCP section (`encode_wms_message`, `decode_wms_message`, `call_wms_tcp`)
- `backend/app/mock_services/wms_service.py`
- `backend/app/middleware_core/message_broker.py`
- `backend/app/middleware_core/saga_manager.py`

---

### Member 5 – Frontend & Real-time Communication

**Responsibilities:**
- Built the entire **React Single Page Application** with React Router v6 and role-based protected routes
- Implemented the **WebSocket Connection Manager** in `main.py` — supports named channels so each order can be targeted individually
- Implemented the **JWT authentication flow** — login, token storage, auto-redirect on expiry
- Built the **Driver Dashboard** with inline manifest actions and automatic GPS location push every 30 seconds
- Built the **Live Event Feed** (`RealTimeTracker`) that streams all middleware events to the browser in real time
- Built the **Admin/System dashboard** showing service registry status and all mock system snapshots

**How to verify:**
1. Open **http://localhost:3000/portal/track** (log in as client first) — the event console connects to `ws://localhost:8000/ws/global`
2. In a second tab, log in as a driver at **http://localhost:3000/driver** and mark a delivery as **Delivered**
3. Switch back to the client tab — the event feed instantly shows the `order_update` event without any page refresh
4. Allow location access in the driver tab — the console shows `📍 Location updated at HH:MM:SS` every 30 seconds and the event feed shows `driver_location` events
5. Open **http://localhost:3000/admin** — shows the service registry table and live snapshots of all three mock systems

**Files owned:**
- `backend/app/main.py` — `ConnectionManager` class and `/ws/{channel}` WebSocket endpoint
- `frontend/src/index.js`
- `frontend/src/App.js`
- `frontend/src/services/api.js`
- `frontend/src/components/Header.js`
- `frontend/src/components/DriverDashboard.js`
- `frontend/src/components/RealTimeTracker.js`
- `frontend/src/components/AdminDashboard.js`
- `frontend/Dockerfile`

---

## Full Order Flow (End-to-End Test)

Follow these steps to demonstrate the complete prototype:

```
1. Open http://localhost:3000 → login as client (demo@shopfast.lk / demo1234)
2. Click "Live Tracking" → event console opens and connects (green dot)
3. In a new tab: login as driver (driver@swiftlogistics.lk / driver1234)
4. Back to client tab → click "New Order" → fill form → Submit
5. Watch the event console: order_update events fire for each Saga step
6. Go to "My Orders" → open the order → see the 5-step progress bar updating
7. In the driver tab → click the delivery manifest link
8. Click "Mark Delivered" on the order
9. Switch back to client tab → event console shows DELIVERED immediately
10. Open http://localhost:8000/api/v1/admin/cms-orders to confirm CMS record
    Open http://localhost:8000/api/v1/admin/wms-packages to confirm WMS record
    Open http://localhost:8000/api/v1/admin/ros-routes to confirm ROS route
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` inside the activated venv |
| `Address already in use :8000` | Kill the existing process: `pkill -f uvicorn` |
| `Address already in use :9000` | WMS TCP mock port conflict — stop any service on 9000 |
| Port 3000 in use | `PORT=3001 npm start` then update `REACT_APP_API_URL` accordingly |
| WebSocket shows red dot | Backend is not running — start uvicorn first |
| RabbitMQ connection refused | Normal in local mode — broker falls back to asyncio.Queue automatically |
| CORS error in browser | Ensure backend is on port 8000 and frontend on port 3000 |
