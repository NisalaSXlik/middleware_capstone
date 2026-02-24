# swifttrack — Middleware Architecture Prototype
SCS2314 Assignment 4

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- That's it. No Node.js, no npm, nothing else needed on your machine.

## Start the entire platform

```bash
docker compose up --build
```

First run takes ~2–3 minutes (downloads images, installs all npm packages inside containers).
Subsequent runs are fast due to Docker layer caching.

## Access the platform

| Interface            | URL                              | Login role |
|----------------------|----------------------------------|------------|
| Client Portal        | http://localhost:3000/login      | client     |
| Driver App           | http://localhost:3000/login      | driver     |
| Admin Dashboard      | http://localhost:3000/login      | admin      |
| API Gateway          | http://localhost:8000            | —          |
| RabbitMQ Management  | http://localhost:15672           | guest/guest |
| WMS Management API   | http://localhost:9001            | —          |

> All three roles share a single login page at `/login`. Select the **Client**, **Driver**, or **Admin** tab before signing in — you will be redirected to the correct dashboard automatically.

## Create test users (first time only)

```bash
# Register a client
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"password123","name":"Test Client","role":"client"}'

# Register a driver
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@test.com","password":"password123","name":"Test Driver","role":"driver"}'

# Register an admin
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123","name":"Admin","role":"admin"}'
```

## Demo flow

1. Go to http://localhost:3000/login, select **Client** tab → log in → submit a new order
2. Watch the order status update live (PENDING → CONFIRMED) via WebSocket — no refresh needed
3. Open a new tab → http://localhost:3000/login, select **Admin** tab → log in → see the order appear, trigger a route change
4. Open another tab → http://localhost:3000/login, select **Driver** tab → log in → see the route change notification arrive in real time
5. Check **RabbitMQ Management** (http://localhost:15672) to see queue activity
6. Use the **Service Health** tab in the Admin dashboard to toggle CMS/WMS/ROS offline and observe retry/compensation behaviour

## Architecture overview

```
Client/Driver/Admin (React)
        ↓ REST + WebSocket
   API Gateway (Express :8000)
        ↓ publishes to RabbitMQ
   order.intake queue
        ↓ consumed by
   Worker / Saga Orchestrator
        ↓ SOAP/XML → CMS Mock
        ↓ TCP/IP   → WMS Mock
        ↓ REST     → ROS Mock
        ↓ publishes event.updates
   Notification Service (Socket.io :8003)
        ↓ pushes to connected clients
```

## Stop

```bash
docker compose down          # stop containers
docker compose down -v       # stop + delete MongoDB data
```

## Project structure

```
swifttrack/
├── docker-compose.yml
├── frontend/                 React (Vite) — all 3 UIs
└── services/
    ├── api-gateway/          Node.js / Express
    ├── worker/               Saga Orchestrator + adapters
    ├── notification/         Socket.io push service
    ├── cms-mock/             SOAP/XML server
    ├── wms-mock/             TCP/IP server
    └── ros-mock/             REST/JSON server
```
