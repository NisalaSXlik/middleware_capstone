import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../hooks/useApi";
import { useSocket } from "../../hooks/useSocket";

const STATUS_COLORS = {
  PENDING:    "bg-amber-500",
  PROCESSING: "bg-blue-500",
  CONFIRMED:  "bg-emerald-500",
  IN_TRANSIT: "bg-indigo-500",
  DELIVERED:  "bg-green-500",
  FAILED:     "bg-red-500",
};

const ACTIVE_STATUSES   = new Set(["PENDING", "PROCESSING", "CONFIRMED", "IN_TRANSIT"]);
const DONE_STATUSES     = new Set(["DELIVERED"]);
const FAILED_STATUSES   = new Set(["FAILED"]);

const FILTER_TABS = [
  { label: "All",       fn: () => true },
  { label: "Active",    fn: o => ACTIVE_STATUSES.has(o.status) },
  { label: "Completed", fn: o => DONE_STATUSES.has(o.status) },
  { label: "Failed",    fn: o => FAILED_STATUSES.has(o.status) },
];

export default function ClientDashboard() {
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState(0);
  const navigate  = useNavigate();
  const userId   = sessionStorage.getItem("userId");
  const userName = sessionStorage.getItem("userName") || "Client";

  useEffect(() => {
    if (!userId) { navigate("/login"); return; }
    api.get("/api/orders").then(r => setOrders(r.data)).catch(console.error);
  }, []);

  const { connected } = useSocket(userId, "client", (event) => {
    setOrders(prev => prev.map(o =>
      o._id === event.orderId
        ? { ...o, status: event.status || o.status, estimatedMinutes: event.estimatedMinutes ?? o.estimatedMinutes }
        : o
    ));
  });

  const logout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  const visibleOrders = orders.filter(FILTER_TABS[filter].fn);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="bg-blue-700 px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="1.5" />
            <circle cx="18.5" cy="18.5" r="1.5" />
          </svg>
          <div>
            <h1 className="text-white font-bold text-lg tracking-wide leading-none">SwiftTrack</h1>
            <p className="text-blue-200 text-xs tracking-widest uppercase">Client Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Live connection indicator */}
          <div className="flex items-center gap-1.5" title={connected ? "Live updates active" : "Not connected"}>
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-blue-200 text-xs">{connected ? "Live" : "Offline"}</span>
          </div>
          <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Client</span>
          <span className="text-blue-200 text-sm font-medium">{userName}</span>
          <button onClick={() => navigate("/client/order/new")} className="bg-white text-blue-700 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
            + New Order
          </button>
          <button onClick={logout} className="bg-transparent border border-blue-400 hover:bg-blue-600 text-blue-200 hover:text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
            Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-3xl mx-auto p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-xl font-bold">My Orders</h2>
          <span className="text-slate-400 text-sm">{visibleOrders.length} shown</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1">
          {FILTER_TABS.map((t, i) => (
            <button
              key={i}
              onClick={() => setFilter(i)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 ${
                filter === i ? "bg-blue-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {visibleOrders.length === 0 && <p className="text-slate-400 text-center mt-10">No orders in this category.</p>}

        <div className="space-y-3">
          {visibleOrders.map(order => (
            <div key={order._id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <strong className="text-slate-700 font-mono text-sm">{order._id}</strong>
                <div className="flex items-center gap-2">
                  {/* ETA badge for active in-flight orders */}
                  {order.estimatedMinutes != null && (ACTIVE_STATUSES.has(order.status)) && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      ~{order.estimatedMinutes} min
                    </span>
                  )}
                  <span className={`${STATUS_COLORS[order.status] || "bg-gray-400"} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                    {order.status}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-sm mt-2 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {order.pickupAddress} → {order.deliveryAddress}
              </p>
              <p className="text-slate-500 text-sm flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V11" /></svg>
                {order.packageDescription}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

