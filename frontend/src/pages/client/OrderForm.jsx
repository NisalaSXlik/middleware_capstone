import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../hooks/useApi";

export default function OrderForm() {
  const [form, setForm] = useState({ pickupAddress: "", deliveryAddress: "", packageDescription: "", recipientName: "", recipientPhone: "" });
  const [submitted, setSubmitted] = useState(null);
  const [error, setError]         = useState("");
  const navigate = useNavigate();

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/api/orders", form);
      setSubmitted(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit order");
    }
  }

  if (submitted) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-green-600 mb-2">Order Submitted!</h2>
        <p className="text-slate-600 text-sm">Order ID: <strong className="font-mono">{submitted.orderId}</strong></p>
        <p className="text-slate-600 text-sm">Status: <strong>{submitted.status}</strong></p>
        <p className="text-slate-400 text-xs mt-3">Processing your order in the background. You will see live updates on the dashboard.</p>
        <button className="mt-6 w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150" onClick={() => navigate("/client/dashboard")}>
          View Dashboard
        </button>
      </div>
    </div>
  );

  const fields = [
    { name: "pickupAddress",      label: "Pickup Address",      type: "text" },
    { name: "deliveryAddress",    label: "Delivery Address",    type: "text" },
    { name: "packageDescription", label: "Package Description", type: "text" },
    { name: "recipientName",      label: "Recipient Name",      type: "text" },
    { name: "recipientPhone",     label: "Recipient Phone",     type: "tel"  },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-blue-700 px-8 py-6 text-center">
          <h2 className="text-xl font-bold text-white tracking-wide">New Delivery Order</h2>
          <p className="text-blue-200 text-xs mt-1 tracking-widest uppercase">Fill in the details below</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                {f.label}
              </label>
              <input
                type={f.type}
                name={f.name}
                value={form[f.name]}
                onChange={onChange}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
            </div>
          ))}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150 shadow-sm"
            >
              Submit Order
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
