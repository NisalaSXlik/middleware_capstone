/**
 * RegisterPage.js  –  Member 5 (Frontend)
 * Client self-registration form.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerClient } from '../services/api';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await registerClient(form.name, form.email, form.password);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Create Client Account</h2>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {[['name','Business / Your Name','text'],['email','Email','email'],['password','Password','password'],['confirm','Confirm Password','password']].map(([key,ph,type])=>(
            <div key={key}>
              <label style={s.label}>{ph}</label>
              <input style={s.input} type={type} placeholder={ph} required
                value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} />
            </div>
          ))}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Register'}
          </button>
        </form>
        <p style={s.foot}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
};

const s = {
  page:  { minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card:  { background: '#fff', borderRadius: '14px', padding: '2.5rem', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
  title: { textAlign: 'center', color: '#1a1a2e', marginBottom: '1.5rem' },
  error: { background: '#fde8e8', color: '#c0392b', padding: '0.6rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem' },
  label: { display: 'block', fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.85rem', color: '#444' },
  input: { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: '7px', fontSize: '0.95rem', marginBottom: '1rem', boxSizing: 'border-box' },
  btn:   { width: '100%', padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' },
  foot:  { textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#666' },
};

export default RegisterPage;
