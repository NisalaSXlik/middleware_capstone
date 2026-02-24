import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../hooks/useApi";

export default function Login() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [selectedRole, setSelectedRole] = useState("client");
  const [error, setError]             = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const serverRole = res.data.role;

      // Enforce: selected tab must match the account's role
      if (selectedRole === "client" && serverRole !== "client" && serverRole !== "admin") {
        return setError("This account is not a client. Please select the correct role.");
      }
      if (selectedRole === "driver" && serverRole !== "driver" && serverRole !== "admin") {
        return setError("This account is not a driver. Please select the correct role.");
      }
      if (selectedRole === "admin" && serverRole !== "admin") {
        return setError("This account does not have admin access.");
      }

      sessionStorage.setItem("token",    res.data.token);
      sessionStorage.setItem("userId",   res.data.id);
      sessionStorage.setItem("role",     serverRole);
      sessionStorage.setItem("userName", res.data.name || res.data.email);

      if (selectedRole === "driver") navigate("/driver/manifest");
      else if (selectedRole === "admin") navigate("/admin/dashboard");
      else navigate("/client/dashboard");
    } catch {
      setError("Invalid email or password");
    }
  }

  const roles = ["client", "driver", "admin"];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-blue-700 px-8 py-7 text-center">
          <div className="flex justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="1.5" />
              <circle cx="18.5" cy="18.5" r="1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">SwiftTrack</h1>
          <p className="text-blue-200 text-xs mt-1 tracking-widest uppercase">
            {selectedRole === "client" ? "Client Portal" : selectedRole === "driver" ? "Driver App" : "Admin Panel"}
          </p>

          {/* Role toggle */}
          <div className="flex mt-4 rounded-lg overflow-hidden border border-blue-500">
            {roles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`flex-1 py-1.5 text-sm font-semibold transition-colors duration-150 capitalize ${
                  selectedRole === role
                    ? "bg-white text-blue-700"
                    : "bg-transparent text-blue-200 hover:bg-blue-600"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 py-8 space-y-5">
          <p className="text-slate-500 text-sm text-center">Sign in to manage your deliveries</p>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors duration-150 shadow-sm mt-2"
          >
            Sign In
          </button>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-8 py-4 text-center">
          <p className="text-xs text-slate-400">SwiftLogistics (Pvt) Ltd. &copy; 2026</p>
        </div>
      </div>
    </div>
  );
}
