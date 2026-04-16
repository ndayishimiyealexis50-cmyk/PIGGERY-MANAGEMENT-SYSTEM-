// src/pages/Login.jsx

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { loginWithGoogle, user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // ✅ Redirect if already logged in
  if (authLoading) return null;
  if (user) return <Navigate to="/" replace />;

  const handle = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Sign In ──────────────────────────────────────────────────
  async function login() {
    setErr(""); setOk("");
    if (!form.email || !form.password)
      return setErr("Please enter your email and password.");
    if (form.password.length < 6)
      return setErr("Password must be at least 6 characters.");
    setLoading(true);

    let didSucceed = false;
    const loginTimeout = setTimeout(() => {
      if (!didSucceed) {
        setLoading(false);
        setErr("Login timed out. Please try again.");
      }
    }, 8000);

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      didSucceed = true;
      clearTimeout(loginTimeout);
      // ✅ No need to navigate manually — the guard above handles it
    } catch (e) {
      clearTimeout(loginTimeout);
      setErr(
        e.code === "auth/user-not-found" ? "No account found with this email." :
        e.code === "auth/wrong-password" ? "Incorrect password." :
        e.code === "auth/invalid-email" ? "Invalid email address." :
        e.code === "auth/too-many-requests" ? "Too many attempts. Try later." :
        "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Register ─────────────────────────────────────────────────
  async function register() {
    setErr(""); setOk("");
    if (!form.email || !form.password || !form.confirm)
      return setErr("Please fill in all fields.");
    if (form.password.length < 6)
      return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setErr("Passwords do not match.");
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password);
      // ✅ Auth state change triggers redirect automatically
    } catch (e) {
      setErr(
        e.code === "auth/email-already-in-use" ? "This email is already registered." :
        e.code === "auth/invalid-email" ? "Invalid email address." :
        "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Reset Password ────────────────────────────────────────────
  async function resetPassword() {
    setErr(""); setOk("");
    if (!form.email) return setErr("Enter your email to reset password.");
    try {
      await sendPasswordResetEmail(auth, form.email);
      setOk("Password reset email sent. Check your inbox.");
    } catch (e) {
      setErr("Failed to send reset email. Check the address and try again.");
    }
  }

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", backgroundColor: "#f0fdf4", padding: "16px"
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", padding: "32px 24px",
        width: "100%", maxWidth: "400px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "36px" }}>🐷</div>
          <h1 style={{ color: "#16a34a", fontWeight: "700", fontSize: "22px", margin: "8px 0 4px" }}>
            FarmIQ
          </h1>
          <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>
            Smart Piggery Management
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: "20px", borderBottom: "2px solid #e5e7eb" }}>
          {["signin", "register"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); setOk(""); }}
              style={{
                flex: 1, padding: "8px", border: "none", background: "none",
                fontWeight: "600", fontSize: "14px", cursor: "pointer",
                color: tab === t ? "#16a34a" : "#9ca3af",
                borderBottom: tab === t ? "2px solid #16a34a" : "2px solid transparent",
                marginBottom: "-2px"
              }}>
              {t === "signin" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Error / Success */}
        {err && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>{err}</div>}
        {ok && <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>{ok}</div>}

        {/* Email */}
        <input name="email" type="email" placeholder="Email address"
          value={form.email} onChange={handle}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", marginBottom: "10px", boxSizing: "border-box" }} />

        {/* Password */}
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <input name="password" type={showPass ? "text" : "password"} placeholder="Password"
            value={form.password} onChange={handle}
            style={{ width: "100%", padding: "10px 40px 10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
          <button onClick={() => setShowPass(p => !p)}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Confirm Password (register only) */}
        {tab === "register" && (
          <input name="confirm" type="password" placeholder="Confirm password"
            value={form.confirm} onChange={handle}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", marginBottom: "10px", boxSizing: "border-box" }} />
        )}

        {/* Main Button */}
        <button
          onClick={tab === "signin" ? login : register}
          disabled={loading}
          style={{
            width: "100%", padding: "11px", backgroundColor: loading ? "#86efac" : "#16a34a",
            color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600",
            fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", marginBottom: "10px"
          }}>
          {loading ? "Please wait..." : tab === "signin" ? "Sign In" : "Create Account"}
        </button>

        {/* Forgot Password */}
        {tab === "signin" && (
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <button onClick={resetPassword}
              style={{ background: "none", border: "none", color: "#16a34a", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}>
              Forgot password?
            </button>
          </div>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "12px 0" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
          <span style={{ padding: "0 10px", color: "#9ca3af", fontSize: "12px" }}>or</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
        </div>

        {/* Google Login */}
        <button onClick={loginWithGoogle}
          style={{
            width: "100%", padding: "11px", backgroundColor: "#fff",
            border: "1px solid #d1d5db", borderRadius: "8px", fontWeight: "600",
            fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: "8px"
          }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
