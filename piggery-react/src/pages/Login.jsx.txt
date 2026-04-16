// src/pages/Login.jsx

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [tab, setTab] = useState("signin"); // "signin" | "register"
  const [form, setForm] = useState({ email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

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
        setErr("Sign in is taking too long. Check your internet connection and try again.");
      }
    }, 20000);

    try {
      // ✅ v9 modular syntax — FIXED
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      didSucceed = true;
      clearTimeout(loginTimeout);
      return; // AuthContext will handle redirect
    } catch (e) {
      clearTimeout(loginTimeout);
      setErr(
        e.code === "auth/user-not-found" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/invalid-credential"
          ? "Incorrect email or password. Please try again."
          : e.code === "auth/invalid-email"
          ? "Invalid email address."
          : e.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait a few minutes and try again."
          : e.code === "auth/network-request-failed"
          ? "No internet connection. Check your network and try again."
          : "Sign in failed: " + e.message
      );
    }
    setLoading(false);
  }

  // ── Register ─────────────────────────────────────────────────
  async function register() {
    setErr(""); setOk("");
    if (!form.email || !form.password)
      return setErr("Please enter your email and password.");
    if (form.password.length < 6)
      return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setErr("Passwords do not match.");
    setLoading(true);
    try {
      // ✅ v9 modular syntax
      await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      return; // AuthContext will handle redirect
    } catch (e) {
      setErr(
        e.code === "auth/email-already-in-use"
          ? "This email is already registered. Please sign in."
          : e.code === "auth/invalid-email"
          ? "Invalid email address."
          : e.code === "auth/network-request-failed"
          ? "No internet connection. Check your network and try again."
          : "Registration failed: " + e.message
      );
    }
    setLoading(false);
  }

  // ── Forgot Password ──────────────────────────────────────────
  async function forgotPassword() {
    setErr(""); setOk("");
    if (!form.email) return setErr("Enter your email address first.");
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setOk("Password reset email sent! Check your inbox.");
    } catch (e) {
      setErr("Could not send reset email: " + e.message);
    }
  }

  // ── Styles ───────────────────────────────────────────────────
  const s = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      fontFamily: "'DM Sans', sans-serif",
    },
    card: {
      background: "#fff",
      borderRadius: "20px",
      overflow: "hidden",
      width: "100%",
      maxWidth: "420px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
    },
    header: {
      background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
      padding: "28px 24px",
      position: "relative",
    },
    onlineBadge: {
      position: "absolute",
      top: "16px",
      right: "16px",
      background: "rgba(255,255,255,0.15)",
      color: "#86efac",
      fontSize: "11px",
      fontWeight: "700",
      padding: "4px 10px",
      borderRadius: "20px",
      display: "flex",
      alignItems: "center",
      gap: "5px",
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#4ade80",
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: "14px",
      background: "rgba(255,255,255,0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "28px",
      marginBottom: "12px",
    },
    farmName: {
      color: "#fff",
      fontSize: "22px",
      fontWeight: "800",
      margin: 0,
    },
    farmSub: {
      color: "#86efac",
      fontSize: "11px",
      letterSpacing: "2px",
      margin: "4px 0 12px",
    },
    welcome: {
      color: "rgba(255,255,255,0.7)",
      fontSize: "14px",
      margin: 0,
    },
    body: { padding: "24px" },
    tabs: {
      display: "flex",
      background: "#f3f4f6",
      borderRadius: "10px",
      padding: "3px",
      marginBottom: "20px",
    },
    tab: (active) => ({
      flex: 1,
      padding: "9px",
      border: "none",
      borderRadius: "8px",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
      transition: "all 0.2s",
      background: active ? "#fff" : "transparent",
      color: active ? "#16a34a" : "#6b7280",
      boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
    }),
    googleBtn: {
      width: "100%",
      padding: "12px",
      border: "1.5px solid #e5e7eb",
      borderRadius: "10px",
      background: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      fontSize: "15px",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "16px",
    },
    divider: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      margin: "16px 0",
      color: "#9ca3af",
      fontSize: "13px",
    },
    line: { flex: 1, height: 1, background: "#e5e7eb" },
    label: {
      display: "block",
      fontSize: "11px",
      fontWeight: "700",
      color: "#16a34a",
      letterSpacing: "1px",
      marginBottom: "6px",
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      border: "1.5px solid #e5e7eb",
      borderRadius: "10px",
      fontSize: "15px",
      outline: "none",
      boxSizing: "border-box",
      marginBottom: "14px",
      background: "#f9fafb",
    },
    passWrap: { position: "relative", marginBottom: "8px" },
    eye: {
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      background: "none",
      border: "none",
      fontSize: "18px",
      color: "#9ca3af",
    },
    forgot: {
      textAlign: "right",
      marginBottom: "16px",
    },
    forgotBtn: {
      background: "none",
      border: "none",
      color: "#16a34a",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
    },
    errBox: {
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: "10px",
      padding: "12px 14px",
      color: "#dc2626",
      fontSize: "13px",
      marginBottom: "14px",
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
    },
    okBox: {
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: "10px",
      padding: "12px 14px",
      color: "#16a34a",
      fontSize: "13px",
      marginBottom: "14px",
    },
    submitBtn: {
      width: "100%",
      padding: "14px",
      background: loading ? "#9ca3af" : "linear-gradient(135deg, #16a34a, #15803d)",
      color: "#fff",
      border: "none",
      borderRadius: "10px",
      fontSize: "16px",
      fontWeight: "700",
      cursor: loading ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.onlineBadge}>
            <div style={s.dot} />
            ONLINE
          </div>
          <div style={s.logo}>🐷</div>
          <p style={s.farmName}>Alexis Gold Piggery</p>
          <p style={s.farmSub}>FARM MANAGEMENT · RWANDA</p>
          <p style={s.welcome}>Welcome back! Sign in to manage your farm.</p>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Tabs */}
          <div style={s.tabs}>
            <button style={s.tab(tab === "signin")} onClick={() => { setTab("signin"); setErr(""); setOk(""); }}>
              🔐 Sign In
            </button>
            <button style={s.tab(tab === "register")} onClick={() => { setTab("register"); setErr(""); setOk(""); }}>
              ✏️ Register
            </button>
          </div>

          {/* Google */}
          <button style={s.googleBtn} onClick={loginWithGoogle} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div style={s.divider}>
            <div style={s.line} />
            OR
            <div style={s.line} />
          </div>

          {/* Email */}
          <label style={s.label}>EMAIL ADDRESS *</label>
          <input
            style={s.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handle}
            placeholder="your@email.com"
          />

          {/* Password */}
          <label style={s.label}>PASSWORD *</label>
          <div style={s.passWrap}>
            <input
              style={{ ...s.input, paddingRight: "44px", marginBottom: 0 }}
              type={showPass ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handle}
              placeholder="••••••••"
            />
            <button style={s.eye} onClick={() => setShowPass(!showPass)}>
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Confirm Password (Register only) */}
          {tab === "register" && (
            <>
              <label style={{ ...s.label, marginTop: "14px" }}>CONFIRM PASSWORD *</label>
              <input
                style={s.input}
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handle}
                placeholder="••••••••"
              />
            </>
          )}

          {/* Forgot */}
          {tab === "signin" && (
            <div style={s.forgot}>
              <button style={s.forgotBtn} onClick={forgotPassword}>
                Forgot password?
              </button>
            </div>
          )}

          {/* Error / Success */}
          {err && (
            <div style={s.errBox}>
              ⚠️ {err}
            </div>
          )}
          {ok && <div style={s.okBox}>✅ {ok}</div>}

          {/* Submit */}
          <button
            style={s.submitBtn}
            onClick={tab === "signin" ? login : register}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={{
                  width: 18, height: 18,
                  border: "3px solid rgba(255,255,255,0.4)",
                  borderTop: "3px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  display: "inline-block"
                }} />
                Please wait...
              </>
            ) : tab === "signin" ? "Sign In →" : "Create Account →"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input:focus {
          border-color: #16a34a !important;
          background: #fff !important;
        }
      `}</style>
    </div>
  );
}
