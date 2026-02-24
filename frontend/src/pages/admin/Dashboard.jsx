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

const SAGA_STATUS_COLORS = {
  COMPLETED:           "bg-green-500",
  PARTIALLY_COMPLETED: "bg-amber-500",
  PENDING:             "bg-blue-500",
  FAILED:              "bg-red-500",
};

const TAB_LABELS = ["Overview", "Service Health", "Saga Logs", "Protocol Logs"];

export default function AdminDashboard() {
  const [tab, setTab]         = useState(0);
  const [orders, setOrders]   = useState([]);
  const [events, setEvents]   = useState([]);
  const [routeMsg, setRouteMsg] = useState("");

  // Service Health tab
  const [health, setHealth]     = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Saga Logs tab
  const [sagaLogs, setSagaLogs]           = useState([]);
  const [sagaFilter, setSagaFilter]       = useState("");
  const [sagaLoading, setSagaLoading]     = useState(false);

  // Protocol Logs tab
  const [protoLogs, setProtoLogs]         = useState([]);
  const [protoFilter, setProtoFilter]     = useState("");
  const [protoAdapterFilter, setProtoAdapterFilter] = useState("");
  const [protoLoading, setProtoLoading]   = useState(false);
  const [expandedProto, setExpandedProto] = useState(null);

  const navigate  = useNavigate();
  const userId   = sessionStorage.getItem("userId") || "admin";
  const userName = sessionStorage.getItem("userName") || "Admin";

  useEffect(() => {
    if (!sessionStorage.getItem("token")) { navigate("/login"); return; }
    api.get("/api/orders").then(r => setOrders(r.data)).catch(console.error);
  }, []);

  const { connected } = useSocket(userId, "admin", (event) => {
    setEvents(prev => [{ ...event, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
    if (event.orderId) {
      setOrders(prev => prev.map(o =>
        o._id === event.orderId ? { ...o, status: event.status || o.status } : o
      ));
    }
  });

  // ── Load data per tab ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 1) fetchHealth();
    if (tab === 2) fetchSagaLogs();
    if (tab === 3) fetchProtoLogs();
  }, [tab]);

  async function fetchHealth() {
    setHealthLoading(true);
    try { const r = await api.get("/api/admin/mock-health"); setHealth(r.data); }
    catch { setHealth(null); }
    finally { setHealthLoading(false); }
  }

  async function fetchSagaLogs() {
    setSagaLoading(true);
    try {
      const params = sagaFilter ? `?orderId=${sagaFilter}` : "";
      const r = await api.get(`/api/admin/saga-logs${params}`);
      setSagaLogs(r.data);
    } catch { setSagaLogs([]); }
    finally { setSagaLoading(false); }
  }

  async function fetchProtoLogs() {
    setProtoLoading(true);
    try {
      const ps = new URLSearchParams();
      if (protoFilter)        ps.set("orderId", protoFilter);
      if (protoAdapterFilter) ps.set("adapter", protoAdapterFilter);
      const r = await api.get(`/api/admin/protocol-logs?${ps.toString()}`);
      setProtoLogs(r.data);
    } catch { setProtoLogs([]); }
    finally { setProtoLoading(false); }
  }

  async function toggleService(service) {
    await api.post(`/api/admin/mock/${service}/toggle`);
    fetchHealth();
  }

  async function simulateRouteChange() {
    await api.post("/api/routes/simulate-change", { message: routeMsg || "Route updated by admin" });
    setRouteMsg("");
  }

  const logout = () => { sessionStorage.clear(); navigate("/login"); };

  // ── Render ──────────────────────────────────────────────────────────────────
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
            <p className="text-blue-200 text-xs tracking-widest uppercase">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} title={connected ? "Live" : "Disconnected"} />
          <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Admin</span>
          <span className="text-blue-200 text-sm font-medium">{userName}</span>
          <button onClick={logout} className="bg-transparent border border-blue-400 hover:bg-blue-600 text-blue-200 hover:text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">Logout</button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-slate-800 border-b border-slate-700 px-8">
        <div className="flex gap-1">
          {TAB_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setTab(i)}
              className={`px-5 py-3 text-sm font-semibold transition-colors duration-150 border-b-2 ${
                tab === i
                  ? "border-blue-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-8">

        {/* ── TAB 0: Overview ───────────────────────────────────────────── */}
        {tab === 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Orders panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-800 font-bold text-base mb-4">All Orders ({orders.length})</h3>
                {orders.length === 0 && <p className="text-slate-400 text-sm">No orders yet.</p>}
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {orders.map(o => (
                    <div key={o._id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                      <span className="font-mono text-xs text-slate-600">{o._id}</span>
                      <span className={`${STATUS_COLORS[o.status] || "bg-gray-400"} text-white text-xs font-bold px-2.5 py-0.5 rounded-full`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live events panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-800 font-bold text-base mb-4">Live Events</h3>
                {events.length === 0 && <p className="text-slate-400 text-sm">Waiting for events...</p>}
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {events.map((e, i) => (
                    <div key={i} className="py-2 border-b border-slate-100 last:border-0 text-sm">
                      <span className="text-slate-400 text-xs">{e.ts}</span>
                      <span className="font-bold text-slate-700 ml-2">{e.event}</span>
                      {e.orderId && <span className="text-slate-500 text-xs ml-1">— {e.orderId}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Route change simulator */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-slate-800 font-bold text-base mb-2">Simulate Route Change (Demo)</h3>
              <p className="text-slate-500 text-xs mb-4">
                Triggers a real-time push notification to all connected drivers via RabbitMQ → Notification Service → Socket.io.
              </p>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  placeholder="Route change message..."
                  value={routeMsg}
                  onChange={e => setRouteMsg(e.target.value)}
                />
                <button
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors duration-150 shadow-sm"
                  onClick={simulateRouteChange}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 1: Service Health ─────────────────────────────────────── */}
        {tab === 1 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">Mock Service Health</h2>
              <button onClick={fetchHealth} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
                {healthLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {!health && !healthLoading && (
              <p className="text-slate-400 text-center mt-10">No health data — click Refresh.</p>
            )}

            {health && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { key: "cms", label: "CMS Mock", subtitle: "SOAP/XML · Port 8001" },
                  { key: "wms", label: "WMS Mock", subtitle: "TCP · Port 9000" },
                  { key: "ros", label: "ROS Mock", subtitle: "REST · Port 8002" },
                ].map(({ key, label, subtitle }) => {
                  const svc = health[key] || {};
                  const isOffline = svc.offline ?? !svc.online;
                  return (
                    <div key={key} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-slate-800 font-bold text-base">{label}</p>
                          <p className="text-slate-400 text-xs">{subtitle}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${isOffline ? "bg-red-500" : "bg-green-500"}`}>
                          {isOffline ? "OFFLINE" : "ONLINE"}
                        </span>
                      </div>
                      {svc.error && <p className="text-red-400 text-xs mb-3">{svc.error}</p>}
                      <button
                        onClick={() => toggleService(key)}
                        className={`w-full text-sm font-semibold py-2 rounded-lg transition-colors duration-150 text-white ${isOffline ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"}`}
                      >
                        {isOffline ? "Bring Online" : "Take Offline"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Saga Logs ──────────────────────────────────────────── */}
        {tab === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-white text-xl font-bold flex-1">Saga Logs</h2>
              <input
                className="rounded-lg border border-slate-600 bg-slate-800 text-slate-200 placeholder:text-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                placeholder="Filter by Order ID…"
                value={sagaFilter}
                onChange={e => setSagaFilter(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchSagaLogs()}
              />
              <button onClick={fetchSagaLogs} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
                {sagaLoading ? "Loading…" : "Search"}
              </button>
            </div>

            {sagaLogs.length === 0 && !sagaLoading && <p className="text-slate-400 text-center mt-10">No saga logs found.</p>}

            <div className="space-y-3">
              {sagaLogs.map(log => (
                <div key={log._id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="font-mono text-sm font-bold text-slate-700">{log.orderId}</span>
                    <span className={`${SAGA_STATUS_COLORS[log.status] || "bg-gray-400"} text-white text-xs font-bold px-2.5 py-0.5 rounded-full`}>
                      {log.status}
                    </span>
                    <span className="text-slate-400 text-xs ml-auto">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      { label: "CMS", step: log.steps?.cms },
                      { label: "WMS", step: log.steps?.wms },
                      { label: "ROS", step: log.steps?.ros },
                    ].map(({ label, step }) => (
                      <div key={label} className={`rounded-lg p-3 border ${step?.status === "SUCCESS" ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
                        <p className="font-bold text-slate-600 mb-1">{label}</p>
                        {step ? (
                          <>
                            <p className={`font-semibold ${step.status === "SUCCESS" ? "text-green-600" : "text-red-500"}`}>{step.status}</p>
                            {step.ref      && <p className="text-slate-500 mt-0.5 truncate">ref: {step.ref}</p>}
                            {step.id       && <p className="text-slate-500 mt-0.5 truncate">id: {step.id}</p>}
                            {step.routeId  && <p className="text-slate-500 mt-0.5 truncate">route: {step.routeId}</p>}
                            {step.estimatedMinutes != null && <p className="text-slate-500 mt-0.5">ETA: {step.estimatedMinutes} min</p>}
                          </>
                        ) : (
                          <p className="text-slate-400 italic">not started</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Protocol Logs ──────────────────────────────────────── */}
        {tab === 3 && (
          <div>
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <h2 className="text-white text-xl font-bold flex-1">Protocol Logs</h2>
              <input
                className="rounded-lg border border-slate-600 bg-slate-800 text-slate-200 placeholder:text-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                placeholder="Filter by Order ID…"
                value={protoFilter}
                onChange={e => setProtoFilter(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchProtoLogs()}
              />
              <select
                className="rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={protoAdapterFilter}
                onChange={e => setProtoAdapterFilter(e.target.value)}
              >
                <option value="">All adapters</option>
                <option value="cms">CMS</option>
                <option value="wms">WMS</option>
                <option value="ros">ROS</option>
              </select>
              <button onClick={fetchProtoLogs} className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
                {protoLoading ? "Loading…" : "Search"}
              </button>
            </div>

            {protoLogs.length === 0 && !protoLoading && <p className="text-slate-400 text-center mt-10">No protocol logs found.</p>}

            <div className="space-y-3">
              {protoLogs.map((log, i) => {
                const isOpen = expandedProto === i;
                return (
                  <div key={log._id || i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <button
                      className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedProto(isOpen ? null : i)}
                    >
                      <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">{log.adapter || log.service}</span>
                      <span className="font-mono text-sm text-slate-600">{log.orderId}</span>
                      <span className="text-slate-500 text-sm">{log.operation}</span>
                      <span className="text-slate-400 text-xs ml-auto">{new Date(log.createdAt || log.timestamp).toLocaleString()}</span>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Raw SOAP / Request</p>
                            <pre className="bg-slate-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                              {log.rawRequest || log.input || "—"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Raw Response / Output</p>
                            <pre className="bg-slate-900 text-blue-300 text-xs p-3 rounded-lg overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                              {log.rawResponse || log.output || "—"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

