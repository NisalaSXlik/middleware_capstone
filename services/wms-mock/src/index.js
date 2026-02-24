require("dotenv").config();
const net      = require("net");
const express  = require("express");
const mongoose = require("mongoose");

const TCP_PORT      = parseInt(process.env.TCP_PORT  || "9000");
const MGMT_PORT     = parseInt(process.env.MANAGEMENT_PORT || "9001");
const MONGO_URL     = process.env.MONGO_URL || "mongodb://localhost:27017/swifttrack";

// ── Offline toggle (admin demo for resilience) ────────────────────────────────
let offline = false;

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URL).then(() => console.log("[WMS] MongoDB connected"));

const PackageSchema = new mongoose.Schema({
  wmsPackageId: String,
  orderId:      String,
  status:       { type: String, default: "RECEIVED" },
  updatedAt:    { type: Date,   default: Date.now },
});
const Package = mongoose.model("WmsPackage", PackageSchema);

// ── HTTP Management Server (health + toggle) ──────────────────────────────────
const mgmt = express();
mgmt.use(express.json());
mgmt.get("/health",        (_req, res) => res.json({ status: "ok", service: "wms-mock", offline }));
mgmt.get("/admin/status",  (_req, res) => res.json({ service: "wms", offline }));
mgmt.post("/admin/toggle", (_req, res) => {
  offline = !offline;
  console.log(`[WMS] Service is now ${offline ? "OFFLINE" : "ONLINE"}`);
  res.json({ service: "wms", offline });
});

// Mark package as DELIVERED via HTTP (called by api-gateway on driver delivery confirmation)
mgmt.post("/packages/:id/delivered", async (req, res) => {
  try {
    await Package.updateOne({ wmsPackageId: req.params.id }, { status: "DELIVERED", updatedAt: new Date() });
    console.log(`[WMS] Package ${req.params.id} marked DELIVERED via HTTP`);
    res.json({ success: true, wmsPackageId: req.params.id, status: "DELIVERED" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
mgmt.listen(MGMT_PORT, () => console.log(`[WMS] Management HTTP on port ${MGMT_PORT}`));

// ── TCP Server (newline-delimited JSON protocol) ───────────────────────────────
const server = net.createServer((socket) => {
  console.log("[WMS] Client connected");
  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    lines.forEach(async (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        console.log(`[WMS] Received: ${msg.operation}`);

        if (offline) {
          socket.write(JSON.stringify({ success: false, error: "WMS is offline" }) + "\n");
          return;
        }

        let response;

        if (msg.operation === "PACKAGE_RECEIVED") {
          const id = "WMS-" + Date.now();
          await Package.create({ wmsPackageId: id, orderId: msg.orderId, status: "RECEIVED" });
          response = { success: true, wmsPackageId: id, status: "RECEIVED" };

        } else if (msg.operation === "PACKAGE_REMOVED") {
          await Package.updateOne({ wmsPackageId: msg.wmsPackageId }, { status: "REMOVED" });
          response = { success: true, status: "REMOVED" };

        } else if (msg.operation === "PACKAGE_DELIVERED") {
          await Package.updateOne({ wmsPackageId: msg.wmsPackageId }, { status: "DELIVERED" });
          response = { success: true, status: "DELIVERED" };

        } else {
          response = { success: false, error: "Unknown operation" };
        }

        socket.write(JSON.stringify(response) + "\n");
      } catch (err) {
        socket.write(JSON.stringify({ success: false, error: "Parse error" }) + "\n");
      }
    });
  });

  socket.on("end",   () => console.log("[WMS] Client disconnected"));
  socket.on("error", (err) => console.error("[WMS] Socket error:", err.message));
});

server.listen(TCP_PORT, () => {
  console.log(`[WMS] TCP server listening on port ${TCP_PORT}`);
});
