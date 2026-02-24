const router = require("express").Router();
const { authenticate, requireRole } = require("../middleware/auth");

// GET /api/routes  — list all route manifests (admin)
router.get("/", authenticate, requireRole("admin", "driver"), async (req, res) => {
  res.json({ routes: [], message: "Routes endpoint — implement with MongoDB routes collection" });
});

// POST /api/routes/simulate-change  — admin triggers a route change (prototype demo)
router.post("/simulate-change", authenticate, requireRole("admin"), async (req, res) => {
  req.app.locals.amqpChannel.sendToQueue(
    "event.updates",
    Buffer.from(JSON.stringify({ event: "ROUTE_CHANGED", ...req.body })),
    { persistent: true }
  );
  res.json({ success: true, message: "Route change event published" });
});

module.exports = router;
