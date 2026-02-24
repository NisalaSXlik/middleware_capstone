const axios    = require("axios");
const mongoose = require("mongoose");

const ROS_URL = process.env.ROS_URL || "http://ros-mock:8002";

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

// Returns full manifest object: { routeId, estimatedMinutes, optimisedStops, ... }
async function createRoute(payload) {
  const requestBody = {
    orderId:   payload.orderId,
    addresses: [payload.pickupAddress, payload.deliveryAddress],
  };
  const res = await axios.post(`${ROS_URL}/routes`, requestBody);
  if (!res.data?.routeId) throw new Error("ROS did not return a routeId");

  try {
    await ProtocolLog.create({
      adapter:     "ros",
      operation:   "CreateRoute",
      orderId:     payload.orderId,
      rawRequest:  JSON.stringify(requestBody),
      rawResponse: JSON.stringify(res.data),
      input:       JSON.stringify(requestBody, null, 2),
      output:      JSON.stringify(res.data, null, 2),
    });
  } catch (logErr) {
    console.warn("[ROS Adapter] Protocol log write failed:", logErr.message);
  }

  return res.data;
}

async function removeRoute(routeId) {
  await axios.delete(`${ROS_URL}/routes/${routeId}`);
}

module.exports = { createRoute, removeRoute };

