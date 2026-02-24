const net      = require("net");
const mongoose = require("mongoose");

const WMS_HOST = process.env.WMS_HOST || "wms-mock";
const WMS_PORT = parseInt(process.env.WMS_PORT || "9000");

const ProtocolLogSchema = new mongoose.Schema({
  adapter:     String,
  operation:   String,
  orderId:     String,
  rawRequest:  String,
  rawResponse: String,
  input:       String,
  output:      String,
  createdAt:   { type: Date, default: Date.now },
}, { collection: "protocollogs" });
const ProtocolLog = mongoose.models.ProtocolLog || mongoose.model("ProtocolLog", ProtocolLogSchema);

function sendTcp(message) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer   = "";

    socket.setTimeout(10000);

    socket.connect(WMS_PORT, WMS_HOST, () => {
      socket.write(JSON.stringify(message) + "\n");
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      if (lines.length >= 2) {
        socket.destroy();
        try {
          resolve(JSON.parse(lines[0]));
        } catch {
          reject(new Error("WMS: invalid JSON response"));
        }
      }
    });

    socket.on("timeout", () => { socket.destroy(); reject(new Error("WMS: connection timeout")); });
    socket.on("error",   (err) => reject(err));
  });
}

async function registerPackage(payload) {
  const request = { operation: "PACKAGE_RECEIVED", orderId: payload.orderId };
  const res = await sendTcp(request);
  if (!res.success) throw new Error("WMS PACKAGE_RECEIVED failed");

  try {
    await ProtocolLog.create({
      adapter:     "wms",
      operation:   "PACKAGE_RECEIVED",
      orderId:     payload.orderId,
      rawRequest:  JSON.stringify(request),
      rawResponse: JSON.stringify(res),
      input:       JSON.stringify(payload, null, 2),
      output:      JSON.stringify(res, null, 2),
    });
  } catch (logErr) {
    console.warn("[WMS Adapter] Protocol log write failed:", logErr.message);
  }

  return res.wmsPackageId;
}

async function removePackage(wmsPackageId) {
  await sendTcp({ operation: "PACKAGE_REMOVED", wmsPackageId });
}

async function markDelivered(wmsPackageId) {
  await sendTcp({ operation: "PACKAGE_DELIVERED", wmsPackageId });
}

module.exports = { registerPackage, removePackage, markDelivered };
