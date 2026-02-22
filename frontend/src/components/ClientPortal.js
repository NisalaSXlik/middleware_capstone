/**
 * ClientPortal.js  –  Member 2 (CMS Integration) + Member 5 (Frontend)
 * Authenticated client dashboard: shows all submitted orders at a glance.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders } from '../services/api';

const STATUS_COLOUR = {
  PENDING:           '#f0a500',
  PROCESSING:        '#3498db',
  IN_WAREHOUSE:      '#9b59b6',
  OUT_FOR_DELIVERY:  '#27ae60',
  DELIVERED:         '#2ecc71',
  FAILED:            '#e74c3c',
};

const ClientPortal = () => {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.centre}>Loading orders…</div>;
  if (error)   return <div style={styles.centre}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>My Orders</h2>
        <Link to="/portal/submit" style={styles.newBtn}>+ New Order</Link>
      </div>

      {orders.length === 0 ? (
        <div style={styles.empty}>
          <p>No orders yet. <Link to="/portal/submit">Submit your first order.</Link></p>
        </div>
      ) : (
        <div style={styles.grid}>
          {orders.map((o) => (
            <Link key={o.id} to={`/portal/orders/${o.id}`} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</span>
                <span style={{ ...styles.badge, background: STATUS_COLOUR[o.status] || '#888' }}>
                  {o.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={styles.recipient}>{o.recipient_name}</div>
              <div style={styles.address}>{o.delivery_address}</div>
              <div style={styles.date}>{new Date(o.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title:     { fontSize: '1.6rem', color: '#1a1a2e', margin: 0 },
  newBtn:    { background: '#e94560', color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  card:      { display: 'block', textDecoration: 'none', background: '#fff', borderRadius: '10px', padding: '1rem 1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'transform 0.15s', color: '#333' },
  cardTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  orderId:   { fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' },
  badge:     { fontSize: '0.72rem', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 },
  recipient: { fontWeight: 600, marginBottom: '0.2rem' },
  address:   { color: '#666', fontSize: '0.85rem', marginBottom: '0.4rem' },
  date:      { color: '#aaa', fontSize: '0.78rem' },
  centre:    { textAlign: 'center', padding: '3rem', color: '#666' },
  empty:     { textAlign: 'center', padding: '3rem', color: '#888' },
};

export default ClientPortal;
