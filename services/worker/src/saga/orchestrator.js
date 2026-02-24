const cmsAdapter = require("../adapters/cmsAdapter");
const wmsAdapter = require("../adapters/wmsAdapter");
const rosAdapter = require("../adapters/rosAdapter");

const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff in ms

async function withRetry(fn, stepName) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`[Orchestrator] ${stepName} failed (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS[attempt]}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      } else {
        console.error(`[Orchestrator] ${stepName} failed after all retries: ${err.message}`);
        throw err;
      }
    }
  }
}

async function runSaga(payload, saga) {
  const Saga  = global.Saga;
  const Order = global.Order;

  // ── STEP 1: CMS ────────────────────────────────────────────────────────────
  if (!saga.steps.cms || saga.steps.cms.status !== "SUCCESS") {
    try {
      const cmsRef = await withRetry(
        () => cmsAdapter.createOrder(payload),
        "CMS Step"
      );
      saga.steps.cms = { ref: cmsRef, status: "SUCCESS" };
      saga.status    = "PARTIALLY_COMPLETED";
      saga.updatedAt = new Date();
      await Saga.updateOne({ _id: saga._id }, { steps: saga.steps, status: saga.status, updatedAt: saga.updatedAt });
      console.log(`[Orchestrator] Step 1 CMS OK → ${cmsRef}`);
    } catch {
      saga.status = "FAILED";
      await Saga.updateOne({ _id: saga._id }, { status: "FAILED" });
      await Order.updateOne({ _id: payload.orderId }, { status: "FAILED" });
      return false;
    }
  }

  // ── STEP 2: WMS ────────────────────────────────────────────────────────────
  if (!saga.steps.wms || saga.steps.wms.status !== "SUCCESS") {
    try {
      const wmsId = await withRetry(
        () => wmsAdapter.registerPackage(payload),
        "WMS Step"
      );
      saga.steps.wms = { id: wmsId, status: "SUCCESS" };
      saga.updatedAt = new Date();
      await Saga.updateOne({ _id: saga._id }, { steps: saga.steps, updatedAt: saga.updatedAt });
      console.log(`[Orchestrator] Step 2 WMS OK → ${wmsId}`);
    } catch {
      // Compensate Step 1
      console.log("[Orchestrator] Compensating: cancelling CMS order...");
      try { await cmsAdapter.cancelOrder(saga.steps.cms.ref); } catch (e) { console.error("[Compensate] CMS cancel failed:", e.message); }
      saga.status = "FAILED";
      await Saga.updateOne({ _id: saga._id }, { status: "FAILED" });
      await Order.updateOne({ _id: payload.orderId }, { status: "FAILED" });
      return false;
    }
  }

  // ── STEP 3: ROS ────────────────────────────────────────────────────────────
  if (!saga.steps.ros || saga.steps.ros.status !== "SUCCESS") {
    try {
      const manifest = await withRetry(
        () => rosAdapter.createRoute(payload),
        "ROS Step"
      );
      saga.steps.ros = { routeId: manifest.routeId, estimatedMinutes: manifest.estimatedMinutes, status: "SUCCESS" };
      saga.status    = "COMPLETED";
      saga.updatedAt = new Date();
      await Saga.updateOne({ _id: saga._id }, { steps: saga.steps, status: "COMPLETED", updatedAt: saga.updatedAt });
      await Order.updateOne({ _id: payload.orderId }, { status: "CONFIRMED", estimatedMinutes: manifest.estimatedMinutes });
      console.log(`[Orchestrator] Step 3 ROS OK → ${manifest.routeId} (ETA: ${manifest.estimatedMinutes} min)`);
    } catch {
      // Compensate Steps 1 & 2
      console.log("[Orchestrator] Compensating: removing WMS package and cancelling CMS order...");
      try { await wmsAdapter.removePackage(saga.steps.wms.id); } catch (e) { console.error("[Compensate] WMS remove failed:", e.message); }
      try { await cmsAdapter.cancelOrder(saga.steps.cms.ref); }  catch (e) { console.error("[Compensate] CMS cancel failed:", e.message); }
      saga.status = "FAILED";
      await Saga.updateOne({ _id: saga._id }, { status: "FAILED" });
      await Order.updateOne({ _id: payload.orderId }, { status: "FAILED" });
      return false;
    }
  }

  return true; // saga completed successfully
}

module.exports = { runSaga };
