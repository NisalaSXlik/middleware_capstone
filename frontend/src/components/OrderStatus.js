/**
 * OrderStatus.js  –  Member 2 + Member 5 (Frontend)
 * Displays a single order's full status, including CMS/WMS/ROS references.
 * Subscribes to the WebSocket channel for live status updates.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchOrder } from '../services/api';
import { createWebSocket } from '../services/api';

const STEPS = [
  { key: 'PENDING',           label: 'Order Received' },
  { key: 'PROCESSING',        label: 'CMS → WMS → ROS' },
  { key: 'IN_WAREHOUSE',      label: 'In Warehouse' },
  { key: 'OUT_FOR_DELIVERY',  label: 'Out for Delivery' },
  { key: 'DELIVERED',         label: 'Delivered' },
];

const OrderStatus = () => {
  const { id }                = useParams();
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveMsg, setLiveMsg] = useState('');

  useEffect(() => {
    fetchOrder(id)
      .then(setOrder)
      .finally(() => setLoading(false));

    // Connect to per-order WebSocket channel for real-time updates
    const ws = createWebSocket(`order-${id}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === 'order_update' && data.order_id === id) {
        setOrder((prev) => prev ? { ...prev, status: data.status } : prev);
        setLiveMsg(data.message);
        setTimeout(() => setLiveMsg(''), 5000);
      }
    };
    ws.onerror = () => {};  // silently ignore – WebSocket is optional
    return () => ws.close();
  }, [id]);

  if (loading) return <div style={c.centre}>Loading…</div>;
  if (!order)  return <div style={c.centre}>Order not found.</div>;

  const currentIdx = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div style={c.container}>
      <h2 style={c.title}>Order #{order.id.slice(0, 8).toUpperCase()}</h2>

      {liveMsg && <div style={c.liveBanner}>🔔 {liveMsg}</div>}

      {/* Progress stepper */}
      <div style={c.stepper}>
        {STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const failed  = order.status === 'FAILED' && i === currentIdx;
          return (
            <div key={step.key} style={c.stepWrap}>
              <div style={{ ...c.dot, ...(done || active ? c.dotActive : {}), ...(failed ? c.dotFail : {}) }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ ...c.stepLabel, fontWeight: active || done ? 700 : 400 }}>{step.label}</span>
              {i < STEPS.length - 1 && <div style={{ ...c.line, ...(done ? c.lineActive : {}) }} />}
            </div>
          );
        })}
      </div>

      {order.status === 'FAILED' && (
        <div style={c.failReason}>
          ❌ Delivery failed: {order.failure_reason || 'Unknown reason'}
        </div>
      )}

      {/* System references */}
      <div style={c.refsGrid}>
        <RefCard title="CMS Order ID"      value={order.cms_order_id}    colour="#3498db" icon="🏢" />
        <RefCard title="WMS Package ID"    value={order.wms_package_id}  colour="#9b59b6" icon="📦" />
        <RefCard title="ROS Route ID"      value={order.ros_route_id}    colour="#27ae60" icon="🗺️" />
      </div>

      {/* Order details */}
      <div style={c.detailCard}>
        <Detail label="Recipient"  value={order.recipient_name} />
        <Detail label="Address"    value={order.delivery_address} />
        <Detail label="Created"    value={new Date(order.created_at).toLocaleString()} />
        {order.driver_id && <Detail label="Driver ID" value={order.driver_id} />}
        {order.proof_of_delivery && (
          <div>
            <strong>Proof of Delivery:</strong>
            <pre style={c.proof}>{order.proof_of_delivery.slice(0, 200)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

const RefCard = ({ title, value, colour, icon }) => (
  <div style={{ ...c.refCard, borderTop: `3px solid ${colour}` }}>
    <span style={{ fontSize: '1.4rem' }}>{icon}</span>
    <div>
      <div style={{ fontSize: '0.75rem', color: '#888' }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: value ? '#333' : '#ccc' }}>
        {value || 'Pending…'}
      </div>
    </div>
  </div>
);

const Detail = ({ label, value }) => (
  <div style={c.detail}>
    <span style={c.detailLabel}>{label}:</span>
    <span>{value}</span>
  </div>
);

const c = {
  container:  { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  title:      { color: '#1a1a2e', marginBottom: '1rem' },
  liveBanner: { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', padding: '0.6rem 1rem', marginBottom: '1rem', color: '#856404' },
  stepper:    { display: 'flex', alignItems: 'center', marginBottom: '2rem', overflowX: 'auto', gap: '0' },
  stepWrap:   { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: '80px' },
  dot:        { width: '32px', height: '32px', borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#999', zIndex: 1 },
  dotActive:  { background: '#e94560', color: '#fff' },
  dotFail:    { background: '#e74c3c', color: '#fff' },
  stepLabel:  { fontSize: '0.72rem', textAlign: 'center', marginTop: '4px', color: '#555', maxWidth: '70px' },
  line:       { position: 'absolute', top: '16px', left: '50%', width: '100%', height: '3px', background: '#ddd', zIndex: 0 },
  lineActive: { background: '#e94560' },
  failReason: { background: '#fde8e8', color: '#c0392b', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' },
  refsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  refCard:    { background: '#fff', borderRadius: '8px', padding: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' },
  detailCard: { background: '#fff', borderRadius: '8px', padding: '1.2rem', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' },
  detail:     { marginBottom: '0.6rem', fontSize: '0.9rem' },
  detailLabel:{ fontWeight: 600, marginRight: '0.5rem', color: '#555' },
  proof:      { background: '#f4f4f4', padding: '0.5rem', borderRadius: '4px', fontSize: '0.78rem', overflowX: 'auto' },
  centre:     { textAlign: 'center', padding: '3rem', color: '#666' },
};

export default OrderStatus;
