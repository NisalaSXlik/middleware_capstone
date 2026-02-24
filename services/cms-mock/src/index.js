require("dotenv").config();
const http    = require("http");
const path    = require("path");
const fs      = require("fs");
const soap    = require("soap");
const express = require("express");
const mongoose = require("mongoose");

const PORT     = process.env.PORT || 8001;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/swifttrack";

// ── Offline toggle (admin demo for resilience) ─────────────────────────────
let offline = false;

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URL).then(() => console.log("[CMS] MongoDB connected"));

const OrderSchema = new mongoose.Schema({
  cmsOrderRef: String,
  clientId:    String,
  pickupAddr:  String,
  deliverAddr: String,
  packageDesc: String,
  status:      { type: String, default: "ACTIVE" },
  createdAt:   { type: Date, default: Date.now },
});
const Order = mongoose.model("CmsOrder", OrderSchema);

// ── SOAP Service Implementation ───────────────────────────────────────────────
const cmsService = {
  CMSService: {
    CMSPort: {
      async CreateOrder(args) {
        if (offline) {
          console.log("[CMS] OFFLINE — rejecting CreateOrder");
          throw Object.assign(new Error("CMS service is offline"), { Fault: { faultstring: "Service Unavailable" } });
        }
        const ref = "CMS-" + Date.now();
        await Order.create({
          cmsOrderRef: ref,
          clientId:    args.clientId,
          pickupAddr:  args.pickupAddr,
          deliverAddr: args.deliverAddr,
          packageDesc: args.packageDesc,
        });
        console.log(`[CMS] CreateOrder → ${ref}`);
        return { cmsOrderRef: ref, status: "CREATED" };
      },
      async CancelOrder(args) {
        await Order.updateOne({ cmsOrderRef: args.cmsOrderRef }, { status: "CANCELLED" });
        console.log(`[CMS] CancelOrder → ${args.cmsOrderRef}`);
        return { status: "CANCELLED" };
      },
    },
  },
};

// ── Server ────────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wsdl   = fs.readFileSync(path.join(__dirname, "../wsdl/cms.wsdl"), "utf8");

app.get("/health", (_req, res) => res.json({ status: "ok", service: "cms-mock", offline }));
app.get("/admin/status", (_req, res) => res.json({ service: "cms", offline }));
app.post("/admin/toggle", (_req, res) => {
  offline = !offline;
  console.log(`[CMS] Service is now ${offline ? "OFFLINE" : "ONLINE"}`);
  res.json({ service: "cms", offline });
});

soap.listen(server, "/cms", cmsService, wsdl, () => {
  console.log(`[CMS] SOAP server listening on port ${PORT}`);
});

server.listen(PORT);
