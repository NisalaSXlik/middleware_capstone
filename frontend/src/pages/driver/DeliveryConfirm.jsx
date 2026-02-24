import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../hooks/useApi";

export default function DeliveryConfirm() {
  const [status, setStatus]   = useState("DELIVERED");
  const [reason, setReason]   = useState("");
  const [notes, setNotes]     = useState("");
  const [photo, setPhoto]     = useState(null);
  const [done, setDone]       = useState(false);
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const navigate  = useNavigate();
  const stop      = useLocation().state || {};

  // ── Signature canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;  // not rendered (FAILED mode)
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches?.[0] || e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    };

    const start = (e) => { drawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move  = (e) => { if (!drawing.current) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end   = () => { drawing.current = false; };

    canvas.addEventListener("mousedown",  start);
    canvas.addEventListener("mousemove",  move);
    canvas.addEventListener("mouseup",    end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove",  move,  { passive: false });
    canvas.addEventListener("touchend",   end);
    return () => {
      canvas.removeEventListener("mousedown",  start);
      canvas.removeEventListener("mousemove",  move);
      canvas.removeEventListener("mouseup",    end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove",  move);
      canvas.removeEventListener("touchend",   end);
    };
  }, [status]);  // re-run when status changes so canvas re-mounts correctly

  function clearSignature() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  async function handleSubmit() {
    const signature = canvasRef.current?.toDataURL("image/png");
    await api.post("/api/drivers/delivery", {
      orderId: stop.orderId,
      status,
      reason:  status === "FAILED" ? reason : undefined,
      notes:   status === "FAILED" ? notes  : undefined,
      signature: status === "DELIVERED" ? signature : undefined,
      photo,
    });
    setDone(true);
  }

  if (done) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${status === "DELIVERED" ? "bg-green-100" : "bg-red-100"}`}>
            {status === "DELIVERED" ? (
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            )}
          </div>
        </div>
        <h2 className={`text-xl font-bold mb-2 ${status === "DELIVERED" ? "text-green-600" : "text-red-600"}`}>
          {status === "DELIVERED" ? "Delivery Confirmed!" : "Delivery Failed"}
        </h2>
        <button className="mt-6 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150" onClick={() => navigate("/driver/manifest")}>
          Back to Manifest
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-blue-700 px-8 py-6 text-center">
          <h2 className="text-xl font-bold text-white tracking-wide">Confirm Delivery</h2>
          <p className="text-blue-200 text-xs mt-1">📍 {stop.address}</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8 space-y-5">

          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Outcome</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            >
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {status === "FAILED" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Reason</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                >
                  <option value="">Select reason...</option>
                  <option value="RECIPIENT_ABSENT">Recipient absent</option>
                  <option value="ADDRESS_INCORRECT">Address incorrect</option>
                  <option value="REFUSED">Refused delivery</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details about the failed delivery..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition resize-none"
                />
              </div>
            </>
          )}

          {status === "DELIVERED" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Recipient Signature</label>
                <canvas ref={canvasRef} width={320} height={120} className="block bg-slate-100 rounded-lg border border-slate-200" style={{ touchAction: "none" }} />
                <button className="text-slate-400 hover:text-slate-600 text-xs mt-1 transition-colors" onClick={clearSignature}>Clear signature</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Photo (optional)</label>
                <input type="file" accept="image/*" capture="environment"
                  className="text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(file); }
                  }} />
              </div>
            </>
          )}

          <button
            className={`w-full font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150 shadow-sm text-white ${status === "DELIVERED" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
