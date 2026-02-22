"""
saga_manager.py  –  Member 4 (WMS / Async Integration)
Saga orchestration pattern for distributed transaction management.

A single client order triggers three sequential steps across systems:
  Step 1 – CMS : CreateOrder  (SOAP)
  Step 2 – WMS : RegisterPackage (TCP)
  Step 3 – ROS : OptimiseRoute (REST)

If any step fails the saga executes compensating transactions to undo
completed steps, ensuring eventual consistency (Challenge 4 from spec).

Architectural pattern: Saga (orchestration style)
"""

import json
import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderStatus, SagaLog, SagaStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step definition
# ---------------------------------------------------------------------------

class SagaStep:
    def __init__(
        self,
        name: str,
        action: Callable,
        compensate: Optional[Callable] = None,
    ):
        self.name = name
        self.action = action
        self.compensate = compensate


# ---------------------------------------------------------------------------
# Saga Orchestrator
# ---------------------------------------------------------------------------

class OrderSaga:
    """
    Orchestrates the three-step distributed transaction for a new order.

    Usage:
        saga = OrderSaga(db, order, ws_manager)
        await saga.execute()
    """

    def __init__(self, db: AsyncSession, order: Order, ws_manager=None):
        self.db = db
        self.order = order
        self.ws_manager = ws_manager
        self._completed_steps: List[Dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Step actions
    # ------------------------------------------------------------------

    async def _step_cms(self) -> Dict[str, Any]:
        """Step 1: Register order in the legacy CMS via SOAP adapter."""
        from app.mock_services.cms_service import cms_create_order
        result = await cms_create_order(self.order)
        self.order.cms_order_id = result.get("cmsOrderId")
        logger.info("[Saga] CMS step OK – cms_order_id=%s", self.order.cms_order_id)
        return result

    async def _compensate_cms(self) -> None:
        """Compensate: cancel the order in CMS."""
        from app.mock_services.cms_service import cms_cancel_order
        await cms_cancel_order(self.order.cms_order_id)
        logger.info("[Saga] CMS compensation executed for %s", self.order.id)

    async def _step_wms(self) -> Dict[str, Any]:
        """Step 2: Register package in WMS via TCP adapter."""
        from app.mock_services.wms_service import wms_register_package
        result = await wms_register_package(self.order)
        self.order.wms_package_id = result.get("package_id")
        self.order.status = OrderStatus.IN_WAREHOUSE
        logger.info("[Saga] WMS step OK – package_id=%s", self.order.wms_package_id)
        return result

    async def _compensate_wms(self) -> None:
        from app.mock_services.wms_service import wms_cancel_package
        await wms_cancel_package(self.order.wms_package_id)
        logger.info("[Saga] WMS compensation executed for %s", self.order.id)

    async def _step_ros(self) -> Dict[str, Any]:
        """Step 3: Request route optimisation from ROS via REST adapter."""
        from app.mock_services.ros_service import ros_optimise_route
        result = await ros_optimise_route(self.order)
        self.order.ros_route_id = result.get("route_id")
        self.order.status = OrderStatus.PROCESSING
        logger.info("[Saga] ROS step OK – route_id=%s", self.order.ros_route_id)
        return result

    async def _compensate_ros(self) -> None:
        from app.mock_services.ros_service import ros_cancel_route
        await ros_cancel_route(self.order.ros_route_id)
        logger.info("[Saga] ROS compensation executed for %s", self.order.id)

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------

    def _build_steps(self) -> List[SagaStep]:
        return [
            SagaStep("cms",  self._step_cms,  self._compensate_cms),
            SagaStep("wms",  self._step_wms,  self._compensate_wms),
            SagaStep("ros",  self._step_ros,  self._compensate_ros),
        ]

    async def execute(self) -> bool:
        """Run all saga steps. Returns True on success, False on failure."""
        steps = self._build_steps()
        saga_log = self.order.saga or SagaLog(order_id=self.order.id)
        saga_log.status = SagaStatus.STARTED
        self.db.add(saga_log)

        for step in steps:
            try:
                result = await step.action()
                self._completed_steps.append({"step": step.name, "result": result})
                await self._notify(f"Step {step.name} completed", self.order.status)
            except Exception as exc:
                logger.error("[Saga] Step '%s' failed: %s", step.name, exc)
                await self._compensate(steps)
                self.order.status = OrderStatus.FAILED
                saga_log.status = SagaStatus.FAILED
                saga_log.steps = json.dumps(self._completed_steps)
                await self.db.commit()
                return False

        self.order.status = OrderStatus.PROCESSING
        saga_log.status = SagaStatus.COMPLETED
        saga_log.steps = json.dumps(self._completed_steps)
        await self.db.commit()
        await self._notify("Order saga completed", OrderStatus.PROCESSING)
        return True

    async def _compensate(self, steps: List[SagaStep]) -> None:
        """Roll back all completed steps in reverse order."""
        logger.warning("[Saga] Starting compensation for order %s", self.order.id)
        for step in reversed(self._completed_steps):
            saga_step = next((s for s in steps if s.name == step["step"]), None)
            if saga_step and saga_step.compensate:
                try:
                    await saga_step.compensate()
                except Exception as exc:
                    logger.error("[Saga] Compensation of '%s' failed: %s",
                                 saga_step.name, exc)

    async def _notify(self, message: str, status) -> None:
        """Push a real-time WebSocket notification to subscribers."""
        if self.ws_manager:
            await self.ws_manager.broadcast({
                "event": "order_update",
                "order_id": self.order.id,
                "status": status.value if hasattr(status, "value") else str(status),
                "message": message,
                "timestamp": datetime.utcnow().isoformat(),
            })
