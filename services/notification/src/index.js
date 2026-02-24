require("dotenv").config();
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const amqp     = require("amqplib");
const cors     = require("cors");

const PORT         = process.env.PORT         || 8003;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672/";

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "notification" }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const { userId, role } = socket.handshake.query;
  if (userId) {
    socket.join(`user:${userId}`);
    if (role === "admin")  socket.join("role:admin");
    if (role === "driver") socket.join("role:driver");
    console.log(`[Notification] ${role || "user"} ${userId} connected`);
  }
  socket.on("disconnect", () => console.log(`[Notification] ${userId} disconnected`));
});

// ── RabbitMQ Consumer ─────────────────────────────────────────────────────────
async function startConsumer() {
  let connection;
  for (let i = 0; i < 15; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      break;
    } catch {
      console.log(`[Notification] Waiting for RabbitMQ... (attempt ${i + 1})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const channel = await connection.createChannel();
  await channel.assertQueue("event.updates", { durable: true });

  console.log("[Notification] Consuming event.updates queue...");

  channel.consume("event.updates", (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    console.log(`[Notification] Broadcasting event: ${event.event} → order ${event.orderId}`);

    // Push to the specific client's room
    if (event.clientId) {
      io.to(`user:${event.clientId}`).emit("order:update", event);
      // Forward to all admins
      io.to("role:admin").emit("order:update", event);
      // New confirmed order or delivery update — refresh all driver manifests
      if (event.event === "ORDER_CONFIRMED" || event.event === "DELIVERY_UPDATE") {
        io.to("role:driver").emit("order:update", event);
      }
    } else {
      // No specific target (e.g. ROUTE_CHANGED) — broadcast to everyone
      io.emit("order:update", event);
    }

    channel.ack(msg);
  });
}

server.listen(PORT, () => {
  console.log(`[Notification] Socket.io server listening on port ${PORT}`);
  startConsumer().catch(err => console.error("[Notification] Consumer error:", err));
});
