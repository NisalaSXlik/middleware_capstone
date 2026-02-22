/**
 * LoginPage.js  –  Member 5 (Frontend)
 * Handles login for both clients (e-commerce) and drivers.
 * Demo credentials are shown for quick prototype evaluation.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../services/api';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('swifttrack_token', data.access_token);
      localStorage.setItem('swifttrack_role',  data.role);
      navigate(data.role === 'driver' ? '/driver' : '/portal');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'client') { setEmail('demo@shopfast.lk');          setPassword('demo1234'); }
    else                   { setEmail('driver@swiftlogistics.lk');  setPassword('driver1234'); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoBlock}>
          <span style={s.logoIcon}>📦</span>
          <h1 style={s.logoText}>SwiftTrack</h1>
          <p style={s.subText}>SwiftLogistics Delivery Platform</p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={submit}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} required placeholder="your@email.lk" />

          <label style={s.label}>Password</label>
          <input style={s.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={s.demos}>
          <p style={s.demoTitle}>Quick Demo:</p>
          <button style={s.demoBtn} onClick={() => fillDemo('client')}>👤 Client Demo</button>
          <button style={s.demoBtn} onClick={() => fillDemo('driver')}>🚛 Driver Demo</button>
        </div>

        <p style={s.register}>New client? <Link to="/register">Register here</Link></p>
      </div>
    </div>
  );
};

const s = {
  page:      { minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card:      { background: '#fff', borderRadius: '14px', padding: '2.5rem', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
  logoBlock: { textAlign: 'center', marginBottom: '1.5rem' },
  logoIcon:  { fontSize: '2.5rem' },
  logoText:  { margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1a1a2e', fontWeight: 800 },
  subText:   { color: '#888', fontSize: '0.82rem', margin: '0.2rem 0 0' },
  error:     { background: '#fde8e8', color: '#c0392b', padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem' },
  label:     { display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.85rem', color: '#444' },
  input:     { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: '7px', fontSize: '0.95rem', marginBottom: '1rem', boxSizing: 'border-box' },
  btn:       { width: '100%', padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' },
  demos:     { marginTop: '1.2rem', textAlign: 'center' },
  demoTitle: { color: '#999', fontSize: '0.78rem', marginBottom: '0.4rem' },
  demoBtn:   { background: '#f4f6fa', border: '1px solid #ddd', borderRadius: '6px', padding: '0.35rem 0.9rem', cursor: 'pointer', margin: '0 0.25rem', fontSize: '0.82rem' },
  register:  { textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#666' },
};

export default LoginPage;
