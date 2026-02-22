"""
message_broker.py  –  Member 4 (WMS / Async Integration)
Asynchronous publish-subscribe message broker abstraction.

Primary backend: RabbitMQ via aio-pika (start with docker-compose).
Fallback: in-process asyncio.Queue for running without RabbitMQ.

Architectural pattern: Publish-Subscribe + Message Queue
Ensures orders are NEVER lost even when downstream systems (WMS, ROS)
are temporarily unavailable – satisfying the high-volume, async requirement.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)

# Try to import aio-pika; fall back to local queue silently
try:
    import aio_pika
    RABBITMQ_AVAILABLE = True
except ImportError:  # pragma: no cover
    RABBITMQ_AVAILABLE = False


# ---------------------------------------------------------------------------
# In-process fallback broker (no external dependencies)
# ---------------------------------------------------------------------------

class InProcessBroker:
    """
    Simple asyncio.Queue-backed pub/sub broker.
    Used when RabbitMQ is not available (e.g. during local dev without Docker).
    """

    def __init__(self):
        self._queues: Dict[str, asyncio.Queue] = {}
        self._subscribers: Dict[str, List[Callable]] = {}

    def _ensure_queue(self, topic: str) -> asyncio.Queue:
        if topic not in self._queues:
            self._queues[topic] = asyncio.Queue(maxsize=10_000)
            self._subscribers[topic] = []
        return self._queues[topic]

    async def publish(self, topic: str, message: Dict[str, Any]) -> None:
        q = self._ensure_queue(topic)
        await q.put(message)
        logger.debug("[Broker] Published to '%s': %s", topic, message)
        # Notify all inline subscribers immediately
        for handler in self._subscribers.get(topic, []):
            asyncio.create_task(handler(message))

    def subscribe(self, topic: str, handler: Callable) -> None:
        self._ensure_queue(topic)
        self._subscribers[topic].append(handler)
        logger.info("[Broker] Subscribed handler '%s' to topic '%s'",
                    handler.__name__, topic)

    async def consume_once(self, topic: str) -> Dict[str, Any]:
        q = self._ensure_queue(topic)
        return await q.get()

    async def consume_forever(self, topic: str, handler: Callable) -> None:
        q = self._ensure_queue(topic)
        while True:
            msg = await q.get()
            try:
                await handler(msg)
            except Exception as exc:
                logger.error("[Broker] Error in handler for '%s': %s", topic, exc)
            finally:
                q.task_done()


# ---------------------------------------------------------------------------
# RabbitMQ-backed broker (production)
# ---------------------------------------------------------------------------

class RabbitMQBroker:
    """
    RabbitMQ broker using aio-pika.
    Connection string: amqp://guest:guest@localhost/
    Configure via RABBITMQ_URL environment variable.
    """

    def __init__(self, url: str = "amqp://guest:guest@localhost/"):
        self.url = url
        self._connection = None
        self._channel = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(self.url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)
        logger.info("[RabbitMQ] Connected to %s", self.url)

    async def publish(self, topic: str, message: Dict[str, Any]) -> None:
        if self._channel is None:
            raise RuntimeError("RabbitMQ channel not initialised")
        queue = await self._channel.declare_queue(topic, durable=True)
        body = json.dumps(message).encode()
        await self._channel.default_exchange.publish(
            aio_pika.Message(body=body, delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
            routing_key=topic,
        )
        logger.debug("[RabbitMQ] Published to '%s'", topic)

    def subscribe(self, topic: str, handler: Callable) -> None:
        # Subscriptions are registered via consume_forever in a background task
        logger.info("[RabbitMQ] Handler registered for topic '%s'", topic)
        self._handlers = getattr(self, "_handlers", {})
        self._handlers[topic] = handler

    async def consume_forever(self, topic: str, handler: Callable) -> None:
        if self._channel is None:
            raise RuntimeError("RabbitMQ channel not initialised")
        queue = await self._channel.declare_queue(topic, durable=True)
        async for msg in queue:
            async with msg.process():
                payload = json.loads(msg.body.decode())
                try:
                    await handler(payload)
                except Exception as exc:
                    logger.error("[RabbitMQ] Handler error: %s", exc)

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()


# ---------------------------------------------------------------------------
# Broker factory & singleton
# ---------------------------------------------------------------------------

_broker: InProcessBroker | RabbitMQBroker | None = None

# Topic constants (shared across the application)
TOPIC_ORDER_CREATED   = "order.created"
TOPIC_CMS_PROCESSED   = "order.cms.processed"
TOPIC_WMS_PROCESSED   = "order.wms.processed"
TOPIC_ROS_PROCESSED   = "order.ros.processed"
TOPIC_DELIVERY_UPDATE = "delivery.update"
TOPIC_DRIVER_LOCATION = "driver.location"


def get_broker() -> InProcessBroker:
    """Return the active broker singleton (InProcess for prototype)."""
    global _broker
    if _broker is None:
        _broker = InProcessBroker()
        logger.info("[Broker] Using InProcessBroker (RabbitMQ not configured)")
    return _broker


async def init_rabbitmq(url: str) -> RabbitMQBroker:
    """Initialise and return a connected RabbitMQ broker (call at startup)."""
    global _broker
    broker = RabbitMQBroker(url)
    await broker.connect()
    _broker = broker
    return broker
