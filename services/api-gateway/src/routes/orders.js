const router   = require("express").Router();
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("crypto").randomUUID ? { v4: () => require("crypto").randomUUID() } : require("crypto");
const { authenticate, requireRole } = require("../middleware/auth");

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

// POST /api/orders  — submit new order
router.post("/", authenticate, requireRole("client", "admin"), async (req, res) => {
  try {
    const orderId = "ORD-" + Date.now();
    const order   = await Order.create({ _id: orderId, clientId: req.user.id, ...req.body });

    // Publish to RabbitMQ order.intake queue
    const payload = { orderId, clientId: req.user.id, ...req.body };
    req.app.locals.amqpChannel.sendToQueue(
      "order.intake",
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );

    res.status(202).json({ orderId, status: "PENDING", message: "Order received and queued for processing" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders  — list orders for authenticated client
router.get("/", authenticate, async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { clientId: req.user.id };
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (req.user.role !== "admin" && order.clientId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
