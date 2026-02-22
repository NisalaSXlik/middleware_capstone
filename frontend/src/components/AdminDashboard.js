/**
 * AdminDashboard.js  –  Member 1 (Architecture Lead)
 * System diagnostics dashboard – shows service registry, WMS packages,
 * ROS routes, and CMS orders. Demonstrates all mock systems running.
 */

import React, { useEffect, useState } from 'react';
import { fetchRegistry, fetchWmsData, fetchRosData, fetchCmsData, fetchHealth } from '../services/api';

const AdminDashboard = () => {
  const [registry, setRegistry] = useState(null);
  const [wms, setWms]           = useState(null);
  const [ros, setRos]           = useState(null);
  const [cms, setCms]           = useState(null);
  const [health, setHealth]     = useState(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth({ status: 'DOWN' }));
    fetchRegistry().then(setRegistry).catch(() => {});
    fetchWmsData().then(setWms).catch(() => {});
    fetchRosData().then(setRos).catch(() => {});
    fetchCmsData().then(setCms).catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <h2 style={s.title}>⚙️ System Diagnostics</h2>

      {/* Health banner */}
      {health && (
        <div style={{ ...s.healthBanner, background: health.status === 'UP' ? '#d5f5e3' : '#fde8e8' }}>
          Backend Status: <strong>{health.status}</strong>
          {health.time && ` — ${new Date(health.time).toLocaleTimeString()}`}
        </div>
      )}

      {/* Service Registry */}
      <Section title="📋 Service Registry">
        {registry ? (
          <table style={s.table}>
            <thead>
              <tr>{['Service','URL','Protocol','Healthy'].map(h=><th style={s.th} key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(registry).map(([name, info]) => (
                <tr key={name}>
                  <td style={s.td}><strong>{name.toUpperCase()}</strong></td>
                  <td style={s.td}><code>{info.url}</code></td>
                  <td style={s.td}>{info.protocol}</td>
                  <td style={s.td}><span style={{ color: info.healthy ? '#27ae60' : '#e74c3c' }}>{info.healthy ? '✅ UP' : '❌ DOWN'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Skeleton />}
      </Section>

      {/* Mock CMS */}
      <Section title="🏢 CMS Orders (Mock SOAP/XML)">
        <pre style={s.pre}>{cms ? JSON.stringify(cms, null, 2) : 'Loading…'}</pre>
      </Section>

      {/* Mock WMS */}
      <Section title="📦 WMS Packages (Mock TCP)">
        <pre style={s.pre}>{wms ? JSON.stringify(wms, null, 2) : 'Loading…'}</pre>
      </Section>

      {/* Mock ROS */}
      <Section title="🗺️ ROS Routes (Mock REST)">
        <pre style={s.pre}>{ros ? JSON.stringify(ros, null, 2) : 'Loading…'}</pre>
      </Section>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div style={s.section}>
    <h3 style={s.sectionTitle}>{title}</h3>
    {children}
  </div>
);

const Skeleton = () => <div style={s.skeleton}>Loading…</div>;

const s = {
  page:         { padding: '2rem', maxWidth: '900px', margin: '0 auto' },
  title:        { color: '#1a1a2e', marginBottom: '1rem' },
  healthBanner: { padding: '0.6rem 1rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem' },
  section:      { background: '#fff', borderRadius: '10px', padding: '1.2rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  sectionTitle: { color: '#1a1a2e', marginTop: 0, marginBottom: '0.8rem' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th:           { background: '#f4f6fa', padding: '0.5rem 0.75rem', textAlign: 'left', color: '#555', borderBottom: '2px solid #eee' },
  td:           { padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
  pre:          { background: '#0d1117', color: '#cdd', padding: '1rem', borderRadius: '6px', fontSize: '0.78rem', maxHeight: '250px', overflowY: 'auto', margin: 0 },
  skeleton:     { color: '#aaa', padding: '0.5rem' },
};

export default AdminDashboard;
