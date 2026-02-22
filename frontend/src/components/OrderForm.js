/**
 * OrderForm.js  –  Member 3 (ROS Integration) + Member 5 (Frontend)
 * Order submission form. On success the saga is triggered in the backend
 * (CMS → WMS → ROS) and the client is redirected to the tracking view.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitOrder } from '../services/api';

const OrderForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    recipient_name:    '',
    recipient_phone:   '',
    delivery_address:  '',
    lat:               '',
    lng:               '',
    notes:             '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      };
      const order = await submitOrder(payload);
      navigate(`/portal/orders/${order.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>Submit New Delivery Order</h2>
        <p style={styles.sub}>
          Your order will be processed through our CMS, added to the warehouse queue, and optimised for routing automatically.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <Field label="Recipient Name *" name="recipient_name" value={form.recipient_name} onChange={handleChange} required />
          <Field label="Recipient Phone" name="recipient_phone" value={form.recipient_phone} onChange={handleChange} />
          <Field label="Delivery Address *" name="delivery_address" value={form.delivery_address} onChange={handleChange} required textarea />
          <div style={styles.row}>
            <Field label="Latitude" name="lat" value={form.lat} onChange={handleChange} placeholder="e.g. 6.9271" half />
            <Field label="Longitude" name="lng" value={form.lng} onChange={handleChange} placeholder="e.g. 79.8612" half />
          </div>
          <Field label="Special Notes" name="notes" value={form.notes} onChange={handleChange} textarea />

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Processing…' : '🚀 Submit Order'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, name, value, onChange, required, textarea, placeholder, half }) => (
  <div style={{ ...styles.fieldWrap, ...(half ? styles.half : {}) }}>
    <label style={styles.label}>{label}</label>
    {textarea ? (
      <textarea name={name} value={value} onChange={onChange}
        style={styles.textarea} rows={3} placeholder={placeholder} />
    ) : (
      <input type="text" name={name} value={value} onChange={onChange}
        style={styles.input} required={required} placeholder={placeholder} />
    )}
  </div>
);

const styles = {
  wrapper:   { display: 'flex', justifyContent: 'center', padding: '2rem', background: '#f4f6fa', minHeight: 'calc(100vh - 60px)' },
  card:      { background: '#fff', borderRadius: '12px', padding: '2rem 2.5rem', maxWidth: '580px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  title:     { color: '#1a1a2e', marginBottom: '0.3rem' },
  sub:       { color: '#666', fontSize: '0.88rem', marginBottom: '1.5rem' },
  error:     { background: '#fde8e8', color: '#c0392b', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' },
  fieldWrap: { marginBottom: '1rem' },
  half:      { flex: 1 },
  row:       { display: 'flex', gap: '1rem' },
  label:     { display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.88rem', color: '#333' },
  input:     { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' },
  textarea:  { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' },
  submitBtn: { width: '100%', padding: '0.8rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem' },
};

export default OrderForm;
