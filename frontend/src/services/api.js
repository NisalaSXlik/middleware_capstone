/**
 * api.js  –  Member 5 (Frontend / Real-time)
 * Centralised Axios API service for the SwiftTrack React portal.
 * All HTTP calls to the FastAPI backend go through this module.
 */

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
const WS_URL   = process.env.REACT_APP_WS_URL  || 'ws://localhost:8000/ws';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('swifttrack_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('swifttrack_token');
      localStorage.removeItem('swifttrack_role');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginUser = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  const res = await axios.post(`${BASE_URL}/auth/token`, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
};

export const registerClient = async (name, email, password) => {
  const res = await api.post('/auth/register/client', { name, email, password });
  return res.data;
};

export const registerDriver = async (name, email, password, vehicle) => {
  const res = await api.post('/auth/register/driver', { name, email, password, vehicle });
  return res.data;
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const submitOrder = async (orderData) => {
  const res = await api.post('/orders', orderData);
  return res.data;
};

export const fetchOrders = async () => {
  const res = await api.get('/orders');
  return res.data;
};

export const fetchOrder = async (orderId) => {
  const res = await api.get(`/orders/${orderId}`);
  return res.data;
};

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export const fetchManifest = async () => {
  const res = await api.get('/drivers/manifest');
  return res.data;
};

export const updateLocation = async (lat, lng) => {
  const res = await api.put('/drivers/location', { lat, lng });
  return res.data;
};

export const completeDelivery = async (orderId, status, proof = null, failureReason = null) => {
  const res = await api.put(`/deliveries/${orderId}/complete`, {
    status,
    proof_of_delivery: proof,
    failure_reason: failureReason,
  });
  return res.data;
};

// ---------------------------------------------------------------------------
// Admin diagnostics
// ---------------------------------------------------------------------------

export const fetchRegistry  = async () => (await api.get('/admin/registry')).data;
export const fetchWmsData   = async () => (await api.get('/admin/wms-packages')).data;
export const fetchRosData   = async () => (await api.get('/admin/ros-routes')).data;
export const fetchCmsData   = async () => (await api.get('/admin/cms-orders')).data;
export const fetchHealth    = async () => (await api.get('/health')).data;

// ---------------------------------------------------------------------------
// WebSocket factory
// ---------------------------------------------------------------------------

export const createWebSocket = (channel = 'global') => {
  return new WebSocket(`${WS_URL}/${channel}`);
};

export default api;
