const soap     = require("soap");
const mongoose = require("mongoose");

const CMS_WSDL = process.env.CMS_URL
  ? `${process.env.CMS_URL}/cms?wsdl`
  : "http://cms-mock:8001/cms?wsdl";

// Protocol Transformation Log schema (shared with gateway reads)
const ProtocolLogSchema = new mongoose.Schema({
  adapter:    String,   // "cms"
  operation:  String,
  orderId:    String,
  rawRequest:  String,  // Raw XML envelope sent to CMS
  rawResponse: String,  // Raw XML envelope received from CMS
  input:       String,  // JSON before transform
  output:      String,  // JSON after transform
  createdAt:  { type: Date, default: Date.now },
}, { collection: "protocollogs" });
const ProtocolLog = mongoose.models.ProtocolLog || mongoose.model("ProtocolLog", ProtocolLogSchema);

async function getClient() {
  return soap.createClientAsync(CMS_WSDL);
}

async function createOrder(payload) {
  const client = await getClient();
  const args = {
    clientId:    payload.clientId,
    pickupAddr:  payload.pickupAddress,
    deliverAddr: payload.deliveryAddress,
    packageDesc: payload.packageDescription || "Package",
  };
  const [result] = await client.CreateOrderAsync(args);
  if (!result?.cmsOrderRef) throw new Error("CMS did not return an order reference");

  // Log protocol transformation: JSON → SOAP/XML → JSON
  try {
    await ProtocolLog.create({
      adapter:     "cms",
      operation:   "CreateOrder",
      orderId:     payload.orderId,
      rawRequest:  client.lastRequest,    // Raw XML envelope sent
      rawResponse: client.lastResponse,   // Raw XML envelope received
      input:       JSON.stringify(args, null, 2),
      output:      JSON.stringify(result, null, 2),
    });
  } catch (logErr) {
    console.warn("[CMS Adapter] Protocol log write failed:", logErr.message);
  }

  return result.cmsOrderRef;
}

async function cancelOrder(cmsOrderRef) {
  const client = await getClient();
  await client.CancelOrderAsync({ cmsOrderRef });
}

module.exports = { createOrder, cancelOrder };

