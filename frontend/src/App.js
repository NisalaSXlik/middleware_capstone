/**
 * App.js  –  Member 5 (Frontend / Real-time)
 * Root component: React Router v6 routes for the SwiftTrack portal.
 *
 * Routes:
 *   /              → redirect based on role
 *   /login         → LoginPage
 *   /register      → RegisterPage
 *   /portal        → ClientPortal (order list)
 *   /portal/submit → OrderForm
 *   /portal/orders/:id → OrderStatus (with live WebSocket updates)
 *   /portal/track  → RealTimeTracker (live event feed)
 *   /driver        → DriverDashboard
 *   /admin         → AdminDashboard
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Header           from './components/Header';
import LoginPage        from './components/LoginPage';
import RegisterPage     from './components/RegisterPage';
import ClientPortal     from './components/ClientPortal';
import OrderForm        from './components/OrderForm';
import OrderStatus      from './components/OrderStatus';
import RealTimeTracker  from './components/RealTimeTracker';
import DriverDashboard  from './components/DriverDashboard';
import AdminDashboard   from './components/AdminDashboard';

// Simple private-route wrapper
const PrivateRoute = ({ element, requiredRole }) => {
  const token = localStorage.getItem('swifttrack_token');
  const role  = localStorage.getItem('swifttrack_role');
  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to={role === 'driver' ? '/driver' : '/portal'} replace />;
  return element;
};

function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <Header />
        <Routes>
          <Route path="/"               element={<Navigate to="/login" replace />} />
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/register"       element={<RegisterPage />} />

          {/* Client portal routes */}
          <Route path="/portal"         element={<PrivateRoute requiredRole="client" element={<ClientPortal />} />} />
          <Route path="/portal/submit"  element={<PrivateRoute requiredRole="client" element={<OrderForm />} />} />
          <Route path="/portal/orders/:id" element={<PrivateRoute requiredRole="client" element={<OrderStatus />} />} />
          <Route path="/portal/track"   element={<PrivateRoute requiredRole="client" element={<RealTimeTracker />} />} />

          {/* Driver app routes */}
          <Route path="/driver"         element={<PrivateRoute requiredRole="driver" element={<DriverDashboard />} />} />
          <Route path="/driver/map"     element={<PrivateRoute requiredRole="driver" element={<RealTimeTracker />} />} />

          {/* Admin (open for prototype demo) */}
          <Route path="/admin"          element={<AdminDashboard />} />

          {/* 404 fallback */}
          <Route path="*"              element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
