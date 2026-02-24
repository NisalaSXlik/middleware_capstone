import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

// Shared login
import Login from "./pages/Login";

// Client pages
import ClientDashboard from "./pages/client/Dashboard";
import OrderForm       from "./pages/client/OrderForm";

// Driver pages
import DriverManifest from "./pages/driver/Manifest";
import DeliveryConfirm from "./pages/driver/DeliveryConfirm";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";

export default function App() {
  return (
    <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/login" />} />

      {/* Unified login */}
      <Route path="/login" element={<Login />} />

      {/* Client */}
      <Route path="/client/dashboard" element={<ClientDashboard />} />
      <Route path="/client/order/new" element={<OrderForm />} />

      {/* Driver */}
      <Route path="/driver/manifest" element={<DriverManifest />} />
      <Route path="/driver/deliver"  element={<DeliveryConfirm />} />

      {/* Admin */}
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
    </Routes>
  );
}
