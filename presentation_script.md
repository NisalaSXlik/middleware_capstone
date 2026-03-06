# SwiftTrack – Presentation Screencast Script
## SCS2314 Middleware Architecture | Assignment 4
### Total runtime: ~10 minutes | 6 Members

---

> **Before recording — setup checklist**
> 1. Run `docker compose up --build` from the project root and wait for all services to be healthy.
> 2. Open **http://localhost:3000** in a browser.
> 3. Register accounts via the Login page (Register link) or via API:
>    - `client@test.com / password` — role: **client**
>    - `driver@test.com / password` — role: **driver**
>    - `admin@test.com  / password` — role: **admin**
> 4. Open **http://localhost:15672** (RabbitMQ UI — guest / guest) in a second tab, ready to show.
> 5. Submit 1–2 orders as the client beforehand so the dashboard is not empty at recording time.
> 6. All three services (CMS, WMS, ROS) should be **online** at the start.

---

## 🎙️ MEMBER 1 — Introduction + Architecture Overview
### Time: 0:00 – 1:30 | Screen: Documentation architecture diagrams (no app yet)

---

*[Screen shows the Conceptual Architecture diagram from documentation.md — use a screenshot or rendered PDF]*

"Welcome to our presentation for Assignment 4 of SCS2314 — Middleware Architecture. We are presenting SwiftTrack, a middleware integration platform for Swift Logistics, a last-mile delivery company in Sri Lanka.

The business problem is that Swift Logistics has **three back-end systems that do not talk to each other**:

The **CMS** — a legacy on-premise system — only speaks SOAP/XML.
The **ROS** — a cloud-based route planner — exposes a REST/JSON API.
The **WMS** — a warehouse tracking system — uses a proprietary protocol over raw TCP/IP sockets.

Our job was to build a middleware layer that integrates all three, while also delivering a real-time client portal, a driver mobile app, and an admin operational dashboard.

*[Switch to the Implementation Architecture diagram]*

Here is the implementation. Every box is a separate Docker container. At the top are three React frontends. They all talk through a single **API Gateway** on port 8000. The gateway publishes orders to **RabbitMQ**. The **Saga Orchestrator Worker** consumes from RabbitMQ and runs the distributed transaction across CMS, WMS, and ROS. Results flow back through RabbitMQ's `event.updates` queue to the **Notification Service**, which pushes real-time Socket.io events to the browser.

The entire platform starts with one command: `docker compose up --build`. Let me hand over to the next member to explain the patterns."

---

## 🎙️ MEMBER 2 — Architectural Patterns Explanation
### Time: 1:30 – 3:00 | Screen: Documentation patterns section

---

*[Screen shows documentation Section 3 — Architectural and Integration Patterns]*

"We used six architectural and integration patterns. Let me walk through each.

**API Gateway Pattern** — one entry point for all traffic. JWT authentication, rate limiting at 100 requests per minute, and input validation all happen here before anything reaches the back end.

**Publish-Subscribe with RabbitMQ** — when an order is submitted, the gateway drops the message in the `order.intake` queue and returns `202 Accepted` immediately. The client is never blocked. RabbitMQ holds the message durably. If the worker is busy or restarting, the message waits safely.

**Dead Letter Queue** — every message that fails all saga retry attempts is nack'd and automatically routed by RabbitMQ to `order.intake.dlq`. No order is ever silently dropped. We will show this queue live in the RabbitMQ management UI.

**Saga Orchestration Pattern** — a single order touches three systems. The Worker runs them in sequence — CMS first, then WMS, then ROS. Each step is logged. If WMS fails after CMS succeeded, the orchestrator cancels the CMS order as a compensating transaction, then marks the saga FAILED. Each step is retried up to three times with exponential backoff: 1 second, 2 seconds, 4 seconds.

**Adapter Pattern** — three dedidated adapters isolate each protocol. CMS uses the `soap` npm library for SOAP/XML envelopes. WMS uses Node.js's built-in `net` module for raw TCP messages. ROS uses `axios` for REST. Each adapter is completely independent.

**WebSocket Push Pattern** — the Notification Service uses Socket.io rooms. Clients join `user:{id}`, admins join `role:admin`, drivers join `role:driver`. Events are pushed in real time without any polling from the browser.

Service discovery uses Docker's built-in container DNS — each service is reachable by its container name within the Docker network, acting as a lightweight service registry. Let me hand over to show the live demo."

---

## 🎙️ MEMBER 3 — Live Demo: Client Portal + Real-Time Order Flow
### Time: 3:00 – 5:00 | Screen: Browser — http://localhost:3000

---

*[Browser is on the Login page at http://localhost:3000/login]*

"Let me demonstrate the SwiftTrack platform live.

**Step 1 — Client Login.**
*[Type client@test.com and password, click Login]*

After login, a JWT is issued and stored in sessionStorage — not localStorage — to limit XSS exposure. Notice the **green 'Live' dot** in the top right of the navbar. That confirms an active Socket.io WebSocket connection is open between this browser and the Notification Service.

**Step 2 — Client Dashboard.**

Here are all of this client's orders with colour-coded status badges — PENDING amber, CONFIRMED green, DELIVERED dark green, FAILED red. I can filter by All, Active, Completed, or Failed using these tabs.
*[Click the filter tabs to show them]*

**Step 3 — Submit a new order.**
*[Click the '+ New Order' button]*

I'll fill in the order form — pickup address, delivery address, package description, recipient name, and phone number.
*[Fill in the fields]*

*[Click Submit]*

The response comes back immediately as **202 Accepted**. The order ID is shown. Status is PENDING. The API Gateway has already published this to RabbitMQ and returned — no waiting for back-end processing.

*[Click 'View Dashboard']*

Watch the status badge on this new order.
*[Pause 3–4 seconds]*

It just flipped to **CONFIRMED** — with no page refresh. The Saga Orchestrator ran CMS, then WMS, then ROS in the background, published an ORDER_CONFIRMED event, and the Notification Service pushed it here over Socket.io. The estimated delivery time you see — sourced from the ROS route manifest — also appeared live."

---

## 🎙️ MEMBER 4 — Live Demo: Admin Dashboard — Overview, Service Health & Failure Demo
### Time: 5:00 – 7:00 | Screen: Browser — Admin login, then all four tabs

---

*[Open a new tab, go to http://localhost:3000/login, log in as admin@test.com]*

"Now let me show the Admin Dashboard. Admins get four tabs.

**Tab 1 — Overview.**

I can see every order across all clients with live status badges. The Live Events panel on the right shows the Socket.io events arriving in real time — admins are in the `role:admin` room and receive every event.

Let me trigger a **Route Change** using the simulator.
*[Type a message in the text box, click Send]*

That published a `ROUTE_CHANGED` event through RabbitMQ to the Notification Service, which broadcast it to all connected driver sockets. We will see the driver manifest respond in a moment.

**Tab 2 — Service Health.**
*[Click 'Service Health' tab]*

Here I can see the live online/offline status of CMS, WMS, and ROS. Each has a toggle button.

**Failure demo — Let me take the CMS offline.**
*[Click 'Take Offline' on CMS — it turns red]*

Now switch to the client portal and submit another order.
*[Switch to the client tab, submit another order, then switch back to admin]*

Watch the status on this order. The Saga Orchestrator is retrying the CMS step three times with backoff — that takes about 7 seconds. After the third retry it marks the saga FAILED, triggers a compensating transaction, and publishes ORDER_FAILED.
*[Wait — the order status badge turns red: FAILED]*

There it is — FAILED — pushed live to both the client portal and this admin view simultaneously via Socket.io.

**Let me bring CMS back online.**
*[Click 'Bring Online' on CMS — it turns green]*

**Tab 3 — Saga Logs.**
*[Click 'Saga Logs' tab]*

Here is the full transaction history. The failed saga shows CMS step as FAILED with no compensation needed since CMS was Step 1. The successful saga from earlier shows all three steps: CMS step with its reference ID, WMS step with its package ID, and ROS step with the route ID and estimated minutes."

---

## 🎙️ MEMBER 5 — Live Demo: Protocol Logs + RabbitMQ Management UI + DLQ
### Time: 7:00 – 8:15 | Screen: Protocol Logs tab, then RabbitMQ UI at localhost:15672

---

*[Still on Admin Dashboard — click 'Protocol Logs' tab]*

"**Tab 4 — Protocol Logs.**

This tab shows every raw adapter call at the wire-protocol level. Let me expand a CMS entry.
*[Click on a CMS protocol log entry to expand it]*

On the left: the raw **SOAP/XML envelope** that the CMS Adapter constructed and sent — you can see the full XML with the order fields. On the right: the raw **SOAP/XML response** from the CMS mock with the order reference number.

*[Expand a WMS log entry]*

This is the WMS adapter. Left: the raw **TCP JSON message** sent over the socket — `PACKAGE_RECEIVED` with the package details. Right: the **TCP acknowledgement JSON** returned by the WMS.

*[Expand a ROS log entry]*

This is the ROS adapter. Left: the **REST JSON POST body** sent to `/routes`. Right: the **JSON route manifest** returned — including the `estimatedMinutes` value that appears in the client portal ETA.

*[Use the adapter filter dropdown to show filtering — select 'cms', then 'wms', then 'ros']*

Each log entry also shows the orderId so you can trace a complete order across all three protocol calls.

---

**RabbitMQ Management UI — showing live queues.**
*[Switch to the localhost:15672 tab — already logged in as guest/guest]*

*[Click Queues tab]*

Here are our three queues: `order.intake`, `order.intake.dlq`, and `event.updates`.

Look at `order.intake.dlq` — the Dead Letter Queue. The failed order we just triggered in the CMS-offline demo ended up here after the saga nack'd the message. No order is ever silently discarded.
*[Click on order.intake.dlq → Get Messages → Get Message(s)]*

You can see the original order payload — the exact JSON that was published by the API Gateway — preserved in the DLQ, ready for operations staff to inspect and re-queue."

---

## 🎙️ MEMBER 6 — Live Demo: Driver App + Security Summary + Conclusion
### Time: 8:15 – 10:00 | Screen: Driver login → Manifest → Delivery Confirm

---

*[Open a new tab, go to http://localhost:3000/login, log in as driver@test.com]*

"Finally, the Driver App.

**Driver Login** issues a driver-scoped JWT that restricts access to only that driver's assigned route and deliveries.

**Daily Manifest.**
*[After login, manifest page loads]*

This shows today's ordered list of delivery stops, generated by the ROS route manifests. Each stop shows the delivery address, recipient name, and the estimated arrival time from the ROS.

Notice the **network status indicator** in the navbar — currently showing Online. If the driver loses signal, the app detects the browser going offline and switches to offline mode — confirmed deliveries are queued in localStorage and automatically synced to the server when connectivity is restored.

Look — a notification just appeared saying 'Route updated — manifest refreshed.' That is the ROUTE_CHANGED event we sent from the Admin dashboard earlier, pushed here instantly via Socket.io.

*[Click the Deliver button on the first stop]*

**Delivery Confirmation screen.**

The driver selects **DELIVERED** or **FAILED**.

For **DELIVERED** — the driver draws the recipient's signature here using touch or mouse on the canvas.
*[Draw a signature on the canvas]*

The driver can also tap the camera button to capture a proof-of-delivery photo using the device camera API.
*[Click the camera icon to show it]*

For **FAILED** — the driver selects a reason code: Recipient Absent, Address Incorrect, Refused, or Other, and can add notes.

*[Switch back to DELIVERED and click Submit]*

The API Gateway receives this, updates the order to DELIVERED in MongoDB, notifies the WMS mock via a `PACKAGE_DELIVERED` TCP message, and publishes a `DELIVERY_UPDATE` event to RabbitMQ. The Notification Service forwards it to the client's Socket.io room.

*[Switch to the client tab — the order badge now shows DELIVERED]*

The client portal updated in real time — no refresh.

---

**Security summary in 30 seconds:**

All endpoints are protected with JWT and RBAC. Clients only see their own orders; drivers only see their assigned manifest. Passwords are bcrypt-hashed. Input is validated at the gateway. RabbitMQ uses authenticated service accounts. Docker network isolation prevents direct external access to any internal service. TLS is used in production for all client-to-gateway and external API traffic. Every saga step and auth event is recorded as an immutable audit log in MongoDB.

---

**Conclusion.**

SwiftTrack integrates three heterogeneous systems using dedicated adapters, manages distributed transactions with the Saga pattern and compensating transactions, never loses an order using durable queues and the Dead Letter Queue, and delivers real-time updates to clients, drivers, and admins in under one second using Socket.io.

The platform starts with a single `docker compose up --build`. Everything is open-source. Thank you."

---

## Demo Sequence — What to Show and When

| # | Member | UI Action | Feature Demonstrated |
|---|---|---|---|
| 1 | M1 | Architecture diagrams (doc) | Conceptual + implementation layers |
| 2 | M2 | Documentation patterns section | All 6 patterns explained |
| 3 | M3 | Login as client | JWT, sessionStorage, role-based routing |
| 4 | M3 | Client Dashboard | Order list, filter tabs, live dot |
| 5 | M3 | Submit new order (OrderForm) | Async 202, PENDING status |
| 6 | M3 | Watch dashboard | CONFIRMED arrives live via Socket.io, ETA shown |
| 7 | M4 | Login as admin | Admin-scoped JWT |
| 8 | M4 | Admin → Overview tab | All-orders view, live events feed |
| 9 | M4 | Simulate Route Change | ROUTE_CHANGED published → driver manifest refreshes |
| 10 | M4 | Service Health tab | CMS/WMS/ROS status cards |
| 11 | M4 | Toggle CMS offline + submit order | Saga retry → compensation → FAILED live |
| 12 | M4 | Bring CMS back online | Recovery |
| 13 | M4 | Saga Logs tab | FAILED + COMPLETED entries, steps detail |
| 14 | M5 | Protocol Logs tab | SOAP XML (CMS), TCP JSON (WMS), REST JSON (ROS) |
| 15 | M5 | Adapter filter dropdown | Filter by cms / wms / ros |
| 16 | M5 | RabbitMQ UI — Queues tab | order.intake, event.updates, order.intake.dlq |
| 17 | M5 | DLQ → Get Messages | Failed order payload preserved in DLQ |
| 18 | M6 | Login as driver | Driver-scoped JWT |
| 19 | M6 | Driver Manifest | Delivery stops, ETA, online/offline indicator |
| 20 | M6 | Route update notification banner | ROUTE_CHANGED received live from M4's action |
| 21 | M6 | Delivery Confirm — DELIVERED | Signature canvas (draw), camera button |
| 22 | M6 | Submit delivery | DELIVERY_UPDATE → client portal updates to DELIVERED live |
| 23 | M6 | — | Security summary |
| 24 | M6 | — | Conclusion |

---

## All Brief Requirements — Coverage Map

| Requirement | Shown in |
|---|---|
| Client portal: login, order status, real-time tracking | M3 |
| Driver: view manifest + optimised route | M6 |
| Driver: real-time route change notification | M6 (triggered by M4) |
| Driver: mark delivered / failed + reason | M6 |
| Driver: digital signature + proof-of-delivery photo | M6 |
| Order intake → WMS + ROS processing | M3 (visible in saga logs M4) |
| High-volume async — 202 immediate response | M3 + M2 (pattern) |
| Order never lost — DLQ | M5 (RabbitMQ UI) + M2 (pattern) |
| CMS SOAP/XML integration | M2 (pattern) + M5 (protocol log) |
| WMS TCP/IP integration | M2 (pattern) + M5 (protocol log) |
| ROS REST/JSON integration | M2 (pattern) + M5 (protocol log) |
| Saga compensating transactions | M4 (CMS offline demo) |
| Crash recovery from saga log | M2 (explained) |
| 2 alternative architectures + rationale | M1 (diagram) + M2 (explained) |
| Service registry (Docker DNS) | M2 |
| Security — JWT, RBAC, bcrypt, TLS, audit log | M6 |
| Open-source technologies only | M1 |