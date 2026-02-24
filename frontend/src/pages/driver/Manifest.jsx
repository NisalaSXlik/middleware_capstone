import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../hooks/useApi";
import { useSocket } from "../../hooks/useSocket";

const OFFLINE_QUEUE_KEY = "swifttrack:offline_deliveries";

export default function DriverManifest() {
  const [stops, setStops]           = useState([]);
  const [notification, setNotification] = useState(null);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const navigate  = useNavigate();
  const userId   = sessionStorage.getItem("userId");
  const userName = sessionStorage.getItem("userName") || "Driver";

  // ── Network listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = async () => {
      setIsOnline(true);
      await flushOfflineQueue();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    setQueuedCount(q.length);
  }, []);

  async function flushOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    if (queue.length === 0) return;
    setNotification(`Syncing ${queue.length} queued delivery(s)…`);
    const remaining = [];
    for (const delivery of queue) {
      try {
        await api.post("/api/drivers/delivery", delivery);
      } catch {
        remaining.push(delivery);
      }
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    setQueuedCount(remaining.length);
    setNotification(remaining.length === 0 ? "All queued deliveries synced!" : `${remaining.length} delivery(s) could not sync.`);
    setTimeout(() => setNotification(null), 5000);
    // Refresh stops after sync
    api.get("/api/drivers/manifest").then(r => setStops(r.data.stops || [])).catch(() => {});
  }

  useEffect(() => {
    if (!userId) { navigate("/login"); return; }
    api.get("/api/drivers/manifest").then(r => setStops(r.data.stops || [])).catch(console.error);
  }, []);

  // Live updates from Notification Service
  useSocket(userId, "driver", (event) => {
    if (event.event === "ROUTE_CHANGED") {
      setNotification("Route updated — manifest refreshed.");
      api.get("/api/drivers/manifest").then(r => setStops(r.data.stops || []));
      setTimeout(() => setNotification(null), 5000);
    }
    if (event.event === "ORDER_CONFIRMED") {
      // New order confirmed — add it to the manifest
      api.get("/api/drivers/manifest").then(r => setStops(r.data.stops || []));
    }
    if (event.event === "DELIVERY_UPDATE") {
      // A delivery was confirmed — remove it from the manifest
      api.get("/api/drivers/manifest").then(r => setStops(r.data.stops || []));
    }
  });

  const logout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  function handleDeliver(stop) {
    if (!isOnline) {
      // Queue the stop navigation payload — the actual confirm will handle offline queuing
    }
    navigate("/driver/deliver", { state: stop });
  }

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
            <p className="text-blue-200 text-xs tracking-widest uppercase">Driver App</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Network status indicator */}
          <div className="flex items-center gap-1.5" title={isOnline ? "Online" : "Offline"}>
            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-blue-200 text-xs">{isOnline ? "Online" : "Offline"}</span>
          </div>
          <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Driver</span>
          <span className="text-blue-200 text-sm font-medium">{userName}</span>
          <span className="text-blue-300 text-xs">{stops.length} stops</span>
          <button onClick={logout} className="bg-transparent border border-blue-400 hover:bg-blue-600 text-blue-200 hover:text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-150">
            Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-xl mx-auto p-8">
        <h2 className="text-white text-xl font-bold mb-6">Today's Deliveries</h2>

        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-slate-800 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-lg flex items-center gap-2.5">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M3 3l18 18" />
            </svg>
            <span className="font-medium">You are offline — deliveries will sync automatically when reconnected.</span>
          </div>
        )}

        {/* Queued deliveries badge */}
        {queuedCount > 0 && isOnline && (
          <div className="bg-slate-800 border border-amber-400 text-amber-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{queuedCount} delivery(s) waiting to sync</span>
            </div>
            <button onClick={flushOfflineQueue} className="text-xs font-semibold text-amber-200 hover:text-white underline">Sync now</button>
          </div>
        )}

        {notification && (
          <div className="bg-slate-800 border border-blue-500 text-blue-200 px-4 py-3 rounded-lg mb-4 text-sm shadow-lg flex items-center gap-2.5">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{notification}</span>
          </div>
        )}

        {stops.length === 0 && <p className="text-slate-400 text-center mt-10">No deliveries assigned yet.</p>}

        <div className="space-y-3">
          {stops.map((stop, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
              <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Stop {i + 1}</div>
              <p className="text-slate-800 font-medium text-sm flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {stop.address}
              </p>
              <p className="text-slate-500 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {stop.recipientName}
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V11" /></svg>
                  {stop.packageId}
                </span>
                {stop.estimatedMinutes != null && (
                  <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ~{stop.estimatedMinutes} min ETA
                  </span>
                )}
              </p>
              <button
                className="mt-3 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors duration-150"
                onClick={() => handleDeliver(stop)}
              >
                Confirm Delivery
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

