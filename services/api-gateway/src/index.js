require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const mongoose   = require("mongoose");
const amqp       = require("amqplib");
const rateLimit  = require("express-rate-limit");

const authRoutes   = require("./routes/auth");
const orderRoutes  = require("./routes/orders");
const driverRoutes = require("./routes/drivers");
const routeRoutes  = require("./routes/routes");
const adminRoutes  = require("./routes/admin");

const PORT         = process.env.PORT         || 8000;
const MONGO_URL    = process.env.MONGO_URL    || "mongodb://localhost:27017/swifttrack";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));  // allow base64 photos/signatures

// ── Rate limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      100,          // 100 requests per minute per IP
  message:  { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/orders",  orderRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/routes",  routeRoutes);
app.use("/api/admin",   adminRoutes);
app.get("/health",      (_req, res) => res.json({ status: "ok", service: "api-gateway" }));

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function connectRabbitMQ() {
  let connection;
  for (let i = 0; i < 15; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      break;
    } catch {
      console.log(`[Gateway] Waiting for RabbitMQ... (attempt ${i + 1})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!connection) {
    console.error("[Gateway] Could not connect to RabbitMQ after 15 attempts — retrying in 10s...");
    setTimeout(() => connectRabbitMQ(), 10000);
    return;
  }

  const channel = await connection.createChannel();

  // DLX setup (must match worker exactly)
  await channel.assertExchange("dlx", "direct", { durable: true });
  await channel.assertQueue("order.intake.dlq", { durable: true });
  await channel.bindQueue("order.intake.dlq", "dlx", "order.intake");

  await channel.assertQueue("order.intake", {
    durable: true,
    arguments: {
      "x-dead-letter-exchange":    "dlx",
      "x-dead-letter-routing-key": "order.intake",
      "x-message-ttl":             30000,
    },
  });
  app.locals.amqpChannel = channel;
  console.log("[Gateway] RabbitMQ connected");

  // Auto-reconnect on connection loss
  connection.on("error", (err) => {
    console.error("[Gateway] RabbitMQ connection error:", err.message);
  });
  connection.on("close", () => {
    console.warn("[Gateway] RabbitMQ connection closed — reconnecting in 5s...");
    app.locals.amqpChannel = null;
    setTimeout(() => connectRabbitMQ(), 5000);
  });
}

async function start() {
  await mongoose.connect(MONGO_URL);
  console.log("[Gateway] MongoDB connected");

  await connectRabbitMQ();

  app.listen(PORT, () => console.log(`[Gateway] API Gateway listening on port ${PORT}`));
}

start().catch(err => { console.error("[Gateway] Fatal:", err); process.exit(1); });
