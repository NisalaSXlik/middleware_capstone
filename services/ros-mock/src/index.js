require("dotenv").config();
const express = require("express");

const PORT = process.env.PORT || 8002;
const app  = express();
app.use(express.json());

// ── Offline toggle (admin demo for resilience) ─────────────────────────────
let offline = false;
app.get("/admin/status",  (_req, res) => res.json({ service: "ros", offline }));
app.post("/admin/toggle", (_req, res) => {
  offline = !offline;
  console.log(`[ROS] Service is now ${offline ? "OFFLINE" : "ONLINE"}`);
  res.json({ service: "ros", offline });
});

// In-memory route store (stateless mock — no DB needed)
const routes = {};

// POST /routes  →  generate mock optimised route
app.post("/routes", (req, res) => {
  if (offline) return res.status(503).json({ error: "ROS is offline" });
  const { orderId, addresses } = req.body;
  if (!addresses || !Array.isArray(addresses)) {
    return res.status(400).json({ error: "addresses array required" });
  }
  // Mock optimisation: sort addresses alphabetically to simulate ordering
  const optimised = [...addresses].sort();
  const manifest = {
    routeId:         "ROS-" + Date.now(),
    orderId,
    optimisedStops:  optimised,
    estimatedMinutes: optimised.length * 15,
    generatedAt:     new Date().toISOString(),
  };
  routes[manifest.routeId] = manifest;
  console.log(`[ROS] Route generated: ${manifest.routeId}`);
  res.status(201).json(manifest);
});

// GET /routes/:routeId
app.get("/routes/:routeId", (req, res) => {
  const route = routes[req.params.routeId];
  if (!route) return res.status(404).json({ error: "Route not found" });
  res.json(route);
});

// DELETE /routes/:routeId  (compensating action)
app.delete("/routes/:routeId", (req, res) => {
  delete routes[req.params.routeId];
  console.log(`[ROS] Route removed: ${req.params.routeId}`);
  res.json({ status: "REMOVED" });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "ros-mock", offline }));

app.listen(PORT, () => console.log(`[ROS] REST server listening on port ${PORT}`));
