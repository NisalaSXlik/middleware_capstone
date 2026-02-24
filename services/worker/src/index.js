require("dotenv").config();
const amqp     = require("amqplib");
const mongoose = require("mongoose");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/";
const MONGO_URL    = process.env.MONGO_URL    || "mongodb://localhost:27017/swifttrack";

const { runSaga }  = require("./saga/orchestrator");

// ── Mongoose Models ───────────────────────────────────────────────────────────
const sagaSchema = new mongoose.Schema({
  orderId:   String,
  status:    { type: String, default: "PENDING" }, // PENDING | PARTIALLY_COMPLETED | COMPLETED | FAILED
  steps:     { type: Object, default: {} },         // { cms: {ref, status}, wms: {id, status}, ros: {routeId, status} }
  createdAt: { type: Date,   default: Date.now },
  updatedAt: { type: Date,   default: Date.now },
});
const Saga = mongoose.model("SagaLog", sagaSchema);
global.Saga = Saga; // shared with orchestrator module

const orderSchema = new mongoose.Schema({
  _id:              String,
  clientId:         String,
  status:           { type: String, default: "PENDING" },
  payload:          Object,
  estimatedMinutes: Number,
  createdAt:        { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);
global.Order = Order;

// ── Crash Recovery ─────────────────────────────────────────────────────────────
async function recoverIncompleteSagas() {
  const incomplete = await Saga.find({ status: { $in: ["PENDING", "PARTIALLY_COMPLETED"] } });
  if (incomplete.length === 0) return;
  console.log(`[Worker] Crash recovery: resuming ${incomplete.length} incomplete saga(s)`);
  for (const saga of incomplete) {
    const order = await Order.findById(saga.orderId);
    if (order) await runSaga(order.payload, saga);
  }
}

// ── RabbitMQ Consumer ─────────────────────────────────────────────────────────
async function startWorker() {
  await mongoose.connect(MONGO_URL);
  console.log("[Worker] MongoDB connected");

  await recoverIncompleteSagas();

  let connection, channel;

  // Retry connection to RabbitMQ — it may take a moment to be ready
  for (let i = 0; i < 15; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      break;
    } catch {
      console.log(`[Worker] Waiting for RabbitMQ... (attempt ${i + 1})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  channel = await connection.createChannel();

  // Main queue + Dead Letter Queue setup
  await channel.assertExchange("dlx", "direct", { durable: true });
  await channel.assertQueue("order.intake.dlq", { durable: true });
  await channel.bindQueue("order.intake.dlq", "dlx", "order.intake");

  await channel.assertQueue("order.intake", {
    durable: true,
    arguments: {
      "x-dead-letter-exchange":    "dlx",
      "x-dead-letter-routing-key": "order.intake",
      "x-message-ttl":             30000, // messages expire after 30s if not acked
    },
  });

  await channel.assertQueue("event.updates", { durable: true });

  channel.prefetch(1); // process one order at a time per worker instance

  console.log("[Worker] Listening on order.intake queue...");

  channel.consume("order.intake", async (msg) => {
    if (!msg) return;
    const payload = JSON.parse(msg.content.toString());
    console.log(`[Worker] Processing order: ${payload.orderId}`);

    try {
      let saga = await Saga.findOne({ orderId: payload.orderId });
      if (!saga) {
        saga = await Saga.create({ orderId: payload.orderId });
      }

      const completed = await runSaga(payload, saga);

      if (completed) {
        await channel.assertQueue("event.updates", { durable: true });
        channel.sendToQueue(
          "event.updates",
          Buffer.from(JSON.stringify({
            event:    "ORDER_CONFIRMED",
            orderId:  payload.orderId,
            clientId: payload.clientId,
            status:   "CONFIRMED",
          })),
          { persistent: true }
        );
        channel.ack(msg);
      } else {
        // Publish ORDER_FAILED so client and admin get a real-time update
        channel.sendToQueue(
          "event.updates",
          Buffer.from(JSON.stringify({
            event:    "ORDER_FAILED",
            orderId:  payload.orderId,
            clientId: payload.clientId,
            status:   "FAILED",
          })),
          { persistent: true }
        );
        // Nack without requeue — message goes to DLQ
        channel.nack(msg, false, false);
      }
    } catch (err) {
      console.error("[Worker] Unhandled error:", err.message);
      channel.nack(msg, false, false);
    }
  });
}

startWorker().catch(err => {
  console.error("[Worker] Fatal startup error:", err);
  process.exit(1);
});
