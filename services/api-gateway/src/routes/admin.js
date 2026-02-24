const router   = require("express").Router();
const axios    = require("axios");
const mongoose = require("mongoose");
const { authenticate, requireRole } = require("../middleware/auth");

const CMS_URL       = process.env.CMS_URL       || "http://localhost:8001";
const WMS_ADMIN_URL = process.env.WMS_ADMIN_URL || "http://localhost:9001";
const ROS_URL       = process.env.ROS_URL       || "http://localhost:8002";

// ── Shared schemas (read-only views into Worker's collections) ────────────────
const SagaSchema = new mongoose.Schema({
  orderId:   String,
  status:    String,
  steps:     Object,
  createdAt: Date,
  updatedAt: Date,
}, { collection: "sagalogs" });
const Saga = mongoose.models.SagaLog || mongoose.model("SagaLog", SagaSchema);

const ProtocolLogSchema = new mongoose.Schema({
  adapter:     String,
  orderId:     String,
  operation:   String,
  input:       String,
  output:      String,
  rawRequest:  String,
  rawResponse: String,
  createdAt:   Date,
}, { collection: "protocollogs" });
const ProtocolLog = mongoose.models.ProtocolLog || mongoose.model("ProtocolLog", ProtocolLogSchema);

// ── Mock service health ───────────────────────────────────────────────────────
// GET /api/admin/mock-health
router.get("/mock-health", authenticate, requireRole("admin"), async (_req, res) => {
  const fetch = async (name, url) => {
    try {
      const r = await axios.get(`${url}/admin/status`, { timeout: 3000 });
      return { name, ...r.data };
    } catch {
      return { name, online: false, offline: true, error: "unreachable" };
    }
  };

  const [cms, wms, ros] = await Promise.all([
    fetch("cms", CMS_URL),
    fetch("wms", WMS_ADMIN_URL),
    fetch("ros", ROS_URL),
  ]);

  res.json({ cms, wms, ros });
});

// POST /api/admin/mock/:service/toggle
router.post("/mock/:service/toggle", authenticate, requireRole("admin"), async (req, res) => {
  const serviceMap = { cms: CMS_URL, wms: WMS_ADMIN_URL, ros: ROS_URL };
  const url = serviceMap[req.params.service];
  if (!url) return res.status(404).json({ error: "Unknown service" });

  try {
    const r = await axios.post(`${url}/admin/toggle`, {}, { timeout: 3000 });
    res.json(r.data);
  } catch {
    res.status(502).json({ error: "Could not reach service" });
  }
});

// ── Saga logs ─────────────────────────────────────────────────────────────────
// GET /api/admin/saga-logs?orderId=ORD-xxx&limit=50
router.get("/saga-logs", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const filter = req.query.orderId ? { orderId: req.query.orderId } : {};
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs   = await Saga.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Protocol logs ─────────────────────────────────────────────────────────────
// GET /api/admin/protocol-logs?orderId=ORD-xxx&adapter=cms&limit=50
router.get("/protocol-logs", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.orderId) filter.orderId = req.query.orderId;
    if (req.query.adapter) filter.adapter = req.query.adapter;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs  = await ProtocolLog.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
