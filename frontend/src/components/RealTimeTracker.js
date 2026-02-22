/**
 * RealTimeTracker.js  –  Member 5 (Frontend / Real-time)
 * Live event feed for a logged-in client.
 * Connects to the WebSocket backend and streams all order/driver events
 * in real time, demonstrating the Observer / Event-Driven pattern.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createWebSocket } from '../services/api';

const EVENT_COLOUR = {
  order_update:    '#3498db',
  driver_location: '#27ae60',
  default:         '#888',
};

const RealTimeTracker = () => {
  const [events, setEvents]       = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef                     = useRef(null);
  const bottomRef                 = useRef(null);

  useEffect(() => {
    const ws = createWebSocket('global');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addEvent({ type: 'system', message: 'Connected to SwiftTrack real-time feed ✅' });
      // Heartbeat every 25s to keep connection alive
      setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;   // ignore heartbeat responses
        addEvent(data);
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      addEvent({ type: 'system', message: '⚠️ Connection closed. Refresh to reconnect.' });
    };

    ws.onerror = () => {
      addEvent({ type: 'system', message: '❌ WebSocket error – backend may be offline.' });
    };

    return () => ws.close();
  }, []);

  const addEvent = (data) => {
    const entry = {
      ...data,
      _id:   Date.now() + Math.random(),
      _time: new Date().toLocaleTimeString(),
    };
    setEvents((prev) => [entry, ...prev].slice(0, 100));   // keep last 100 events
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const clearEvents = () => setEvents([]);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>📡 Live Event Feed</h2>
        <div style={s.indicators}>
          <span style={{ ...s.dot, background: connected ? '#2ecc71' : '#e74c3c' }} />
          <span style={s.status}>{connected ? 'Connected' : 'Disconnected'}</span>
          <button style={s.clearBtn} onClick={clearEvents}>Clear</button>
        </div>
      </div>

      <p style={s.desc}>
        Real-time events pushed from the middleware via WebSocket.
        This feed demonstrates the <strong>Observer / Event-Driven</strong> pattern –
        order status changes and driver location updates appear here instantly.
      </p>

      <div style={s.feed}>
        {events.length === 0 && (
          <div style={s.empty}>Waiting for events… Submit an order to see activity.</div>
        )}
        {events.map((ev) => (
          <div key={ev._id} style={{ ...s.event, borderLeft: `4px solid ${EVENT_COLOUR[ev.event] || EVENT_COLOUR.default}` }}>
            <span style={s.time}>{ev._time}</span>
            {ev.event === 'order_update' && (
              <span>
                <strong>Order</strong> {ev.order_id?.slice(0, 8) || '?'} →&nbsp;
                <span style={{ fontWeight: 700, color: EVENT_COLOUR.order_update }}>{ev.status}</span>
                {ev.message && ` – ${ev.message}`}
              </span>
            )}
            {ev.event === 'driver_location' && (
              <span>
                <strong>Driver</strong> {ev.driver_id?.slice(0, 8) || '?'} →&nbsp;
                📍 ({ev.lat?.toFixed(4)}, {ev.lng?.toFixed(4)})
              </span>
            )}
            {(!ev.event || ev.type === 'system') && (
              <span style={{ color: '#888' }}>{ev.message || JSON.stringify(ev)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const s = {
  container: { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  title:     { color: '#1a1a2e', margin: 0 },
  indicators:{ display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dot:       { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
  status:    { fontSize: '0.85rem', color: '#555' },
  clearBtn:  { background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', padding: '0.25rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem' },
  desc:      { color: '#666', fontSize: '0.88rem', marginBottom: '1rem' },
  feed:      { background: '#0d1117', borderRadius: '10px', padding: '1rem', height: '500px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem' },
  event:     { color: '#cdd', padding: '0.4rem 0.6rem', marginBottom: '0.3rem', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' },
  time:      { color: '#888', marginRight: '0.6rem' },
  empty:     { color: '#666', textAlign: 'center', marginTop: '6rem' },
};

export default RealTimeTracker;
