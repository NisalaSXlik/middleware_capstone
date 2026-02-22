/**
 * DriverDashboard.js  –  Member 5 (Frontend / Real-time)
 * Driver mobile-app view: today's delivery manifest with inline actions.
 * Drivers can mark deliveries complete/failed and push GPS coordinates.
 */

import React, { useEffect, useState, useRef } from 'react';
import { fetchManifest, completeDelivery, updateLocation } from '../services/api';

const STATUS_COLOUR = {
  PROCESSING:        '#3498db',
  OUT_FOR_DELIVERY:  '#f0a500',
  DELIVERED:         '#2ecc71',
  FAILED:            '#e74c3c',
};

const DriverDashboard = () => {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [message, setMessage]     = useState('');
  const [locStatus, setLocStatus] = useState('');
  const locationInterval          = useRef(null);

  useEffect(() => {
    loadManifest();
    startLocationTracking();
    return () => clearInterval(locationInterval.current);
  }, []);

  const loadManifest = () => {
    fetchManifest()
      .then(setOrders)
      .catch(() => setMessage('Could not load manifest'))
      .finally(() => setLoading(false));
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;
    locationInterval.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLocation(pos.coords.latitude, pos.coords.longitude)
            .then(() => setLocStatus(`📍 Location updated at ${new Date().toLocaleTimeString()}`))
            .catch(() => {});
        },
        () => setLocStatus('⚠️ Location unavailable'),
        { enableHighAccuracy: true },
      );
    }, 30_000);  // push every 30 s
  };

  const handleComplete = async (orderId, status, reason = null) => {
    const proof = status === 'DELIVERED' ? `SIGNED-${Date.now()}` : null;
    try {
      await completeDelivery(orderId, status, proof, reason);
      setMessage(`✅ Order ${orderId.slice(0, 8)} marked as ${status}`);
      setTimeout(() => setMessage(''), 4000);
      loadManifest();
    } catch {
      setMessage('❌ Failed to update delivery status');
    }
  };

  if (loading) return <div style={s.centre}>Loading manifest…</div>;

  return (
    <div style={s.container}>
      <h2 style={s.title}>📋 Today's Delivery Manifest</h2>
      {locStatus && <div style={s.locBanner}>{locStatus}</div>}
      {message   && <div style={s.msgBanner}>{message}</div>}

      {orders.length === 0 ? (
        <div style={s.empty}>No deliveries assigned for today.</div>
      ) : (
        orders.map((o, idx) => (
          <div key={o.id} style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.seq}>#{idx + 1}</span>
              <span style={s.orderId}>{o.id.slice(0, 8).toUpperCase()}</span>
              <span style={{ ...s.badge, background: STATUS_COLOUR[o.status] || '#888' }}>
                {o.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={s.recipient}>{o.recipient_name}</div>
            <div style={s.address}>📍 {o.delivery_address}</div>
            {o.wms_package_id && <div style={s.ref}>📦 WMS: {o.wms_package_id}</div>}
            {o.ros_route_id   && <div style={s.ref}>🗺️ Route: {o.ros_route_id}</div>}

            {(o.status === 'OUT_FOR_DELIVERY' || o.status === 'PROCESSING') && (
              <div style={s.actions}>
                <button style={s.successBtn}
                  onClick={() => handleComplete(o.id, 'DELIVERED')}>
                  ✅ Mark Delivered
                </button>
                <button style={s.failBtn}
                  onClick={() => handleComplete(o.id, 'FAILED', 'Recipient not available')}>
                  ❌ Mark Failed
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const s = {
  container:  { padding: '1.5rem', maxWidth: '600px', margin: '0 auto' },
  title:      { color: '#1a1a2e', marginBottom: '0.75rem' },
  locBanner:  { background: '#e8f4fd', color: '#2471a3', padding: '0.5rem 0.8rem', borderRadius: '5px', marginBottom: '0.5rem', fontSize: '0.85rem' },
  msgBanner:  { background: '#d5f5e3', color: '#1e8449', padding: '0.5rem 0.8rem', borderRadius: '5px', marginBottom: '0.5rem', fontSize: '0.85rem' },
  card:       { background: '#fff', borderRadius: '10px', padding: '1rem 1.2rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' },
  seq:        { background: '#1a1a2e', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 },
  orderId:    { fontWeight: 700, fontSize: '0.85rem', flex: 1 },
  badge:      { fontSize: '0.72rem', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 },
  recipient:  { fontWeight: 600, marginBottom: '0.25rem' },
  address:    { color: '#555', fontSize: '0.88rem', marginBottom: '0.25rem' },
  ref:        { color: '#888', fontSize: '0.80rem' },
  actions:    { display: 'flex', gap: '0.75rem', marginTop: '0.75rem' },
  successBtn: { flex: 1, padding: '0.5rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  failBtn:    { flex: 1, padding: '0.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 },
  empty:      { textAlign: 'center', padding: '2rem', color: '#888' },
  centre:     { textAlign: 'center', padding: '3rem', color: '#666' },
};

export default DriverDashboard;
