const router   = require("express").Router();
const mongoose = require("mongoose");
const axios    = require("axios");
const { authenticate, requireRole } = require("../middleware/auth");

const WMS_ADMIN_URL = process.env.WMS_ADMIN_URL || "http://wms-mock:9001";

// ── Shared schemas ────────────────────────────────────────────────────────────
const OrderSchema = new mongoose.Schema({
  _id:                String,
  clientId:           String,
  pickupAddress:      String,
  deliveryAddress:    String,
  packageDescription: String,
  recipientName:      String,
  recipientPhone:     String,
  status:             { type: String, default: "PENDING" },
  estimatedMinutes:   Number,
  createdAt:          { type: Date, default: Date.now },
});
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

const SagaSchema = new mongoose.Schema({
  orderId:   String,
  status:    String,
  steps:     Object,
  createdAt: Date,
  updatedAt: Date,
}, { collection: "sagalogs" });
const Saga = mongoose.models.SagaLog || mongoose.model("SagaLog", SagaSchema);

// GET /api/drivers/manifest  — driver's delivery manifest
router.get("/manifest", authenticate, requireRole("driver", "admin"), async (req, res) => {
  try {
    const orders = await Order.find({ status: { $in: ["CONFIRMED", "IN_TRANSIT"] } })
      .sort({ createdAt: 1 });

    const sagas = await Saga.find({
      orderId: { $in: orders.map(o => o._id) },
      status: "COMPLETED",
    });
    const sagaMap = Object.fromEntries(sagas.map(s => [s.orderId, s]));

    const stops = orders.map(o => {
      const saga = sagaMap[o._id];
      return {
        orderId:         o._id,
        address:         o.deliveryAddress,
        recipientName:   o.recipientName,
        recipientPhone:  o.recipientPhone,
        packageId:       saga?.steps?.wms?.id   || o._id,
        routeId:         saga?.steps?.ros?.routeId || null,
        estimatedMinutes: o.estimatedMinutes     || saga?.steps?.ros?.estimatedMinutes || null,
        status:          o.status,
      };
    });

    res.json({ driverId: req.user.id, stops });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drivers/delivery  — mark package delivered / failed
router.post("/delivery", authenticate, requireRole("driver"), async (req, res) => {
  const { orderId, status, reason, notes, signature, photo } = req.body;

  if (!orderId || !["DELIVERED", "FAILED"].includes(status)) {
    return res.status(400).json({ error: "orderId and valid status (DELIVERED|FAILED) are required" });
  }

  try {
    const update = { status };
    if (status === "FAILED" && reason) update.failReason = reason;
    if (status === "FAILED" && notes)  update.failNotes  = notes;

    await Order.updateOne({ _id: orderId }, update);

    // Retrieve clientId for targeted notification
    const order = await Order.findById(orderId).lean();
    const clientId = order?.clientId;

    // Notify WMS that the package has been delivered
    if (status === "DELIVERED") {
      try {
        const saga = await Saga.findOne({ orderId, status: "COMPLETED" }).lean();
        const wmsPackageId = saga?.steps?.wms?.id;
        if (wmsPackageId) {
          await axios.post(`${WMS_ADMIN_URL}/packages/${wmsPackageId}/delivered`);
        }
      } catch (wmsErr) {
        console.warn(`[drivers] WMS delivery notification failed (non-fatal): ${wmsErr.message}`);
      }
    }

    const channel = req.app.locals.amqpChannel;
    if (channel) {
      channel.sendToQueue(
        "event.updates",
        Buffer.from(JSON.stringify({
          event:    "DELIVERY_UPDATE",
          orderId,
          status,
          reason,
          notes,
          clientId,
          driverId: req.user.id,
          ts:       new Date().toISOString(),
        })),
        { persistent: true }
      );
    }

    res.json({ success: true, orderId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
