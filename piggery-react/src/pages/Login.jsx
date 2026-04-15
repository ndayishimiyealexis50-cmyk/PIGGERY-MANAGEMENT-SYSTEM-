// pages/Login.jsx
// ─────────────────────────────────────────────────────────────────
// Extracted & converted from index HTML → Vite + React (JSX)
//
// Expected project structure (adjust paths to match yours):
//
//   src/
//   ├── lib/
//   │   ├── firebase.js   → exports: auth, db, googleProvider
//   │   ├── authHelpers.js→ exports: ensureUserProfile, isAdminEmail, _profileCache
//   │   ├── otpHelpers.js → exports: generateOTP, storeOTP, verifyOTP, getWAConfig
//   │   └── utils.js      → exports: uid, rwandaISO, toDay, jbinAppend
//   └── pages/
//       └── Login.jsx   ← this file
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithRedirect,
} from "firebase/auth";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { ensureUserProfile, isAdminEmail, _profileCache } from "../lib/authHelpers";
import { generateOTP, storeOTP, verifyOTP, getWAConfig } from "../lib/otpHelpers";
import { uid, rwandaISO, toDay, jbinAppend } from "../lib/utils";

// ─── Shared inline style tokens ────────────────────────────────
const inp2 = {
  background: "#f8fafc",
  border: "1.5px solid #e2e8f0",
  color: "#1e293b",
  borderRadius: 10,
  padding: "11px 14px",
  width: "100%",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color .2s, box-shadow .2s",
};

const lbl2 = {
  fontSize: 11,
  color: "#64748b",
  display: "block",
  marginBottom: 5,
  letterSpacing: 0.5,
  fontWeight: 600,
  textTransform: "uppercase",
};

const focusIn = (e) => {
  e.target.style.borderColor = "#16a34a";
  e.target.style.boxShadow = "0 0 0 3px rgba(22,163,74,.1)";
};
const focusOut = (e) => {
  e.target.style.borderColor = "#e2e8f0";
  e.target.style.boxShadow = "none";
};

// ═══════════════════════════════════════════════════════════════
//  ForgotPasswordModal
// ═══════════════════════════════════════════════════════════════
function ForgotPasswordModal({ initialEmail, onClose }) {
  const [step, setStep] = useState("choose"); // choose | email_sent | otp_enter
  const [email, setEmail] = useState(initialEmail || "");
  const [otpInput, setOtpInput] = useState("");
  const [otpUid, setOtpUid] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendEmail() {
    setErr("");
    const e = (email || "").trim();
    if (!e) return setErr("Please enter your email address.");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, e);
      setStep("email_sent");
    } catch (ex) {
      setErr(
        ex.code === "auth/user-not-found"
          ? "No account found with that email."
          : ex.code === "auth/invalid-email"
          ? "Invalid email address."
          : "Error: " + ex.message
      );
    }
    setBusy(false);
  }

  async function startOTPFlow() {
    setErr("");
    const e = (email || "").trim();
    if (!e) return setErr("Please enter your email address first.");
    setBusy(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", e), limit(1)));
      if (snap.empty) {
        setErr("No account found with that email.");
        setBusy(false);
        return;
      }
      const profile = snap.docs[0].data();
      const userUid = profile.uid;
      const waConf = getWAConfig();
      if (!waConf.enabled || !waConf.phone || !waConf.apikey) {
        setErr("WhatsApp (CallMeBot) is not configured on this account. Use email recovery instead.");
        setBusy(false);
        return;
      }
      const code = generateOTP();
      await storeOTP(userUid, code);
      const msg = `🔐 FarmIQ Recovery OTP\n\nYour one-time code: *${code}*\n\nExpires in 10 minutes. Do not share this code.`;
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waConf.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(waConf.apikey)}`;
      await fetch(url, { method: "GET", mode: "no-cors" });
      setOtpUid(userUid);
      setCountdown(60);
      setStep("otp_enter");
      setOk("📱 OTP sent to the WhatsApp linked to this account.");
    } catch (ex) {
      setErr("Failed: " + ex.message);
    }
    setBusy(false);
  }

  async function verifyAndSend() {
    setErr("");
    if (otpInput.length !== 6) return setErr("Please enter the full 6-digit code.");
    setBusy(true);
    try {
      const result = await verifyOTP(otpUid, otpInput);
      if (!result.ok) {
        setErr("❌ " + result.reason);
        setBusy(false);
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      setStep("email_sent");
      setOk("✅ OTP verified! Reset link sent to " + email.trim() + ".");
    } catch (ex) {
      setErr("Error: " + ex.message);
    }
    setBusy(false);
  }

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
  const box = {
    background: "#fff",
    borderRadius: 18,
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 24px 64px rgba(0,0,0,.2)",
    overflow: "hidden",
  };
  const inp3 = {
    background: "#f8fafc",
    border: "1.5px solid #e2e8f0",
    color: "#1e293b",
    borderRadius: 10,
    padding: "11px 14px",
    width: "100%",
    fontSize: 13.5,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const msgBox = (type, txt) => (
    <div
      style={{
        padding: "10px 14px",
        background: type === "err" ? "rgba(239,68,68,.08)" : "rgba(22,163,74,.08)",
        border: "1px solid " + (type === "err" ? "rgba(239,68,68,.25)" : "rgba(22,163,74,.25)"),
        borderRadius: 9,
        color: type === "err" ? "#dc2626" : "#16a34a",
        fontSize: 13,
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {txt}
    </div>
  );

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={box} className="slide-up">
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",
            padding: "22px 24px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>🔐 Account Recovery</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 3 }}>
              Regain access to your FarmIQ account
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.1)",
              border: "none",
              color: "rgba(255,255,255,.7)",
              width: 30,
              height: 30,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "22px 24px 26px" }}>
          {err && msgBox("err", err)}
          {ok && msgBox("ok", ok)}

          {/* STEP: CHOOSE METHOD */}
          {step === "choose" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 5,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Your Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inp3}
                  autoCapitalize="none"
                  onKeyDown={(e) => e.key === "Enter" && sendEmail()}
                />
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14, fontWeight: 600 }}>
                Choose recovery method:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Email recovery */}
                <button
                  onClick={sendEmail}
                  disabled={busy}
                  style={{
                    padding: "13px 16px",
                    borderRadius: 12,
                    border: "2px solid rgba(37,99,235,.25)",
                    background: "rgba(37,99,235,.04)",
                    color: "#1e293b",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all .2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 26 }}>📧</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                        Send Reset Link via Email
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        Receive a secure link directly in your inbox
                      </div>
                    </div>
                  </div>
                </button>
                {/* WhatsApp OTP */}
                <button
                  onClick={startOTPFlow}
                  disabled={busy}
                  style={{
                    padding: "13px 16px",
                    borderRadius: 12,
                    border: "2px solid rgba(34,197,94,.25)",
                    background: "rgba(34,197,94,.04)",
                    color: "#1e293b",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all .2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 26 }}>📱</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                        Verify via WhatsApp OTP
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        Get a 6-digit code on WhatsApp, then reset via email
                      </div>
                    </div>
                  </div>
                </button>
              </div>
              {busy && (
                <div style={{ textAlign: "center", marginTop: 14, color: "#64748b", fontSize: 13 }}>
                  ⏳ Please wait…
                </div>
              )}
            </div>
          )}

          {/* STEP: OTP ENTRY */}
          {step === "otp_enter" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 4 }}>
                  Enter WhatsApp OTP
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Check your WhatsApp for a 6-digit code · expires in 10 min
                </div>
              </div>
              {/* Digit boxes */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 40,
                      height: 50,
                      borderRadius: 9,
                      border: "2px solid " + (i < otpInput.length ? "#16a34a" : "#e2e8f0"),
                      background: i < otpInput.length ? "rgba(22,163,74,.06)" : "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#1e293b",
                      transition: "all .15s",
                    }}
                  >
                    {otpInput[i] || ""}
                  </div>
                ))}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && otpInput.length === 6 && verifyAndSend()
                }
                placeholder="Tap to enter code"
                style={{
                  ...inp3,
                  letterSpacing: 8,
                  fontSize: 20,
                  textAlign: "center",
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              />
              <button
                onClick={verifyAndSend}
                disabled={busy || otpInput.length < 6}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 11,
                  border: "none",
                  background:
                    otpInput.length === 6 ? "linear-gradient(135deg,#16a34a,#15803d)" : "#cbd5e1",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: otpInput.length === 6 ? "pointer" : "default",
                  fontFamily: "inherit",
                  marginBottom: 10,
                }}
              >
                {busy ? "⏳ Verifying…" : "✅ Verify Code & Send Reset Email"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => {
                    setStep("choose");
                    setOtpInput("");
                    setErr("");
                    setOk("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (countdown === 0) {
                      setStep("choose");
                      setOtpInput("");
                      setErr("");
                      setOk("");
                    } else {
                      setErr(`Wait ${countdown}s before retrying.`);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: countdown > 0 ? "#94a3b8" : "#16a34a",
                    fontSize: 12,
                    cursor: countdown > 0 ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : "Try again"}
                </button>
              </div>
            </div>
          )}

          {/* STEP: EMAIL SENT SUCCESS */}
          {step === "email_sent" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 54, marginBottom: 14 }}>✉️</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b", marginBottom: 8 }}>
                Check Your Email!
              </div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.8, marginBottom: 20 }}>
                A password reset link has been sent to
                <br />
                <strong style={{ color: "#1e293b" }}>{(email || "").trim()}</strong>
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(59,130,246,.06)",
                  border: "1px solid rgba(59,130,246,.15)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#3b82f6",
                  textAlign: "left",
                  lineHeight: 1.7,
                  marginBottom: 18,
                }}
              >
                💡 <strong>Tips:</strong> Check your spam/junk folder. The link expires in 1 hour.
                Click it on the same device for best results.
              </div>
              <button
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 11,
                  border: "none",
                  background: "linear-gradient(135deg,#16a34a,#15803d)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Done — Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Login  (Login + Register + Google Sign-in)
//
//  Props:
//    setUser           – (profile) => void   called after auth resolves
//    pendingApproval   – boolean             pre-set pending state
//    setPendingApproval– (bool) => void
// ═══════════════════════════════════════════════════════════════
export default function Login({ setUser, pendingApproval, setPendingApproval }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [err, setErr] = useState(
    pendingApproval
      ? "Your account is pending admin approval. Please wait."
      : window.__workerRemoved
      ? "Your account has been removed. Please contact the farm admin."
      : ""
  );
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const emailRef = useRef(null);
  const pwdRef = useRef(null);
  const namRef = useRef(null);
  const loginTimeoutRef = useRef(null);

  // ── Listen for auth blocked events fired by onAuthStateChanged ──
  useEffect(() => {
    function onBlocked(e) {
      clearTimeout(loginTimeoutRef.current);
      setLoading(false);
      setGLoading(false);
      const reason = e.detail?.reason;
      if (reason === "removed") {
        setErr("Your account has been removed. Please contact the farm admin.");
      } else if (reason === "pending") {
        setErr("Your account is pending admin approval. Please wait.");
      } else {
        setErr("Sign in was not completed. Please try again.");
      }
    }
    window.addEventListener("farmiq_auth_blocked", onBlocked);
    return () => window.removeEventListener("farmiq_auth_blocked", onBlocked);
  }, []);

  // ── handleFirebaseUser (shared post-auth logic) ──────────────
  async function handleFirebaseUser(fbUser, extraName) {
    const profile = await ensureUserProfile(fbUser, extraName ? { name: extraName } : {});
    if (!profile) {
      await signOut(auth);
      setErr("Could not load your account. Check your internet and try again.");
      setLoading(false);
      setGLoading(false);
      return;
    }
    const forceAdmin = isAdminEmail(fbUser.email);
    if (!forceAdmin && profile.removed) {
      await signOut(auth);
      window.__workerRemoved = true;
      setErr("Your account has been removed. Please contact the farm admin.");
      setLoading(false);
      setGLoading(false);
      return;
    }
    if (!profile.approved && !forceAdmin) {
      await signOut(auth);
      setErr("Your account is pending admin approval. Please wait.");
      setLoading(false);
      setGLoading(false);
      return;
    }
    // onAuthStateChanged in App handles setUser with correct role
  }

  // ── Sign In ──────────────────────────────────────────────────
  async function login() {
    setErr("");
    setOk("");
    if (!form.email || !form.password) return setErr("Please enter your email and password.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);

    // Safety timeout — clear spinner if onAuthStateChanged never fires
    loginTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setErr("Sign in is taking too long. Check your internet connection and try again.");
    }, 12000);

    try {
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      // ✅ Do NOT clearTimeout here — let the 12s guard protect the full
      // onAuthStateChanged + Firestore profile flow. It will be cleared
      // by onBlocked (pending/removed) or when this component unmounts on success.
      return;
    } catch (e) {
      clearTimeout(loginTimeoutRef.current);
      const msg =
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
          : "Sign in failed: " + e.message;
      setErr(msg);
    }
    setLoading(false);
  }

  // ── Register ─────────────────────────────────────────────────
  async function reg() {
    setErr("");
    setOk("");
    window.__workerRemoved = false;
    if (!form.name.trim()) return setErr("Please enter your full name.");
    if (!form.email.trim()) return setErr("Please enter your email address.");
    if (!form.password) return setErr("Please enter a password.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword)
      return setErr("Passwords do not match. Please re-enter them.");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await ensureUserProfile(cred.user, { name: form.name.trim() });
      _profileCache.delete(cred.user.uid);
      const isAdmin = isAdminEmail(form.email.trim());

      // Send welcome onboarding message to new worker's inbox
      if (!isAdmin) {
        const workerName = form.name.trim();
        const now = new Date();
        const welcomeMsg = {
          id: uid(),
          text:
            "👋 Murakaza neza / Welcome, " +
            workerName +
            "!\n\nYour FarmIQ account has been created and is pending admin approval.\n\nOnce approved, you will be able to:\n🐷 Register & track pigs\n📋 Submit daily care logs\n🌾 Record feeding entries\n📏 Submit weekly pig assessments\n✅ View & complete assigned tasks\n💬 Receive messages from the admin\n\nA farm admin will review and activate your account shortly. We are glad to have you on the team! 🌱\n\n— FarmIQ Team",
          from: "FarmIQ System",
          date: toDay(),
          time: now.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Kigali",
          }),
          recipients: 1,
          recipientNames: workerName,
          recipientIds: [cred.user.uid],
          broadcast: false,
          system: true,
          welcome: true,
        };
        try {
          await jbinAppend("messages", welcomeMsg);
        } catch (e) {
          console.warn("Welcome msg failed", e);
        }
      }

      await signOut(auth);
      if (isAdmin) {
        setOk("Admin account created! You can now sign in.");
      } else {
        setOk("Account created! An admin must approve your access before you can sign in.");
      }
      setTab("login");
      setForm({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (e) {
      const msg =
        e.code === "auth/email-already-in-use"
          ? "An account with that email already exists."
          : e.code === "auth/invalid-email"
          ? "Invalid email address."
          : "Registration failed: " + e.message;
      setErr(msg);
    }
    setLoading(false);
  }

  // ── Google Sign-In (redirect, not popup — mobile safe) ───────
  async function googleSignIn() {
    setErr("");
    setGLoading(true);
    try {
      // Use redirect — popup opens as a new tab on mobile Chrome,
      // which breaks Firebase sessionStorage across origins.
      // Redirect keeps everything in the same window/origin.
      await signInWithRedirect(auth, googleProvider);
      // Page navigates away — nothing executes after this line.
      // Result is handled by getRedirectResult() in the App init useEffect.
    } catch (e) {
      const msg =
        e.code === "auth/unauthorized-domain"
          ? "This domain is not authorized. Add it in Firebase → Authentication → Authorized Domains."
          : e.code === "auth/network-request-failed"
          ? "No internet connection. Try email/password sign-in instead."
          : e.code === "auth/too-many-requests"
          ? "Too many attempts. Please wait and try again."
          : "Google sign-in failed: " + e.message;
      if (msg) setErr(msg);
      setGLoading(false);
    }
    // setGLoading(false) intentionally omitted on success —
    // the page navigates away; on return onAuthStateChanged resolves.
  }

  // ── Inline forgot password (quick path) ─────────────────────
  async function forgotPassword() {
    if (!form.email) return setErr("Enter your email above first.");
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setOk("Password reset email sent! Check your inbox.");
    } catch (e) {
      setErr("Could not send reset email: " + e.message);
    }
  }

  // ── Switch tab helper ────────────────────────────────────────
  function switchTab(t) {
    setTab(t);
    setErr("");
    setOk("");
    setShowPwd(false);
    setShowConfirmPwd(false);
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(150deg,#eef5ee 0%,#f0fdf4 50%,#e8f5e9 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}
      >
        {/* Background blobs */}
        <div
          style={{
            position: "fixed",
            top: "-10%",
            right: "-5%",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(22,163,74,.07) 0%,transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "fixed",
            bottom: "-10%",
            left: "-5%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(16,185,129,.06) 0%,transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            width: 440,
            background: "#fff",
            borderRadius: 22,
            boxShadow:
              "0 28px 70px rgba(0,0,0,.10),0 6px 20px rgba(22,163,74,.09),0 1px 3px rgba(0,0,0,.06)",
            overflow: "hidden",
            border: "1px solid rgba(22,163,74,.12)",
          }}
          className="login-enter fade-in"
        >
          {/* ── Header ── */}
          <div
            style={{
              background:
                "linear-gradient(135deg,#071410 0%,#0f2316 55%,#0a1f12 100%)",
              padding: "32px 36px 28px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: "50%",
                background: "rgba(74,222,128,.06)",
                border: "1px solid rgba(74,222,128,.12)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -20,
                left: -20,
                width: 90,
                height: 90,
                borderRadius: "50%",
                background: "rgba(74,222,128,.04)",
              }}
            />
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(74,222,128,.15)",
                  border: "1px solid rgba(74,222,128,.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                🐷
              </div>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    letterSpacing: "-0.5px",
                  }}
                >
                  Alexis Gold Piggery
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: "rgba(74,222,128,.8)",
                    letterSpacing: 2.5,
                    textTransform: "uppercase",
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  Farm Management · Rwanda
                </div>
              </div>
            </div>
            <div
              style={{
                position: "relative",
                marginTop: 18,
                fontSize: 13,
                color: "rgba(255,255,255,.55)",
                lineHeight: 1.5,
              }}
            >
              {tab === "login"
                ? "Welcome back! Sign in to manage your farm."
                : "Create your account to get started."}
            </div>
            {/* Online indicator */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                padding: "4px 10px",
                borderRadius: 20,
                background: navigator.onLine
                  ? "rgba(74,222,128,.18)"
                  : "rgba(239,68,68,.18)",
                border:
                  "1px solid " +
                  (navigator.onLine
                    ? "rgba(74,222,128,.35)"
                    : "rgba(239,68,68,.4)"),
                fontSize: 10,
                color: navigator.onLine ? "#4ade80" : "#f87171",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: navigator.onLine ? "#4ade80" : "#f87171",
                  display: "inline-block",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
              {navigator.onLine ? "ONLINE" : "OFFLINE"}
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: "28px 36px 32px" }}>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: 11,
                padding: 3,
                marginBottom: 24,
                gap: 2,
              }}
            >
              {[
                ["login", "🔐 Sign In"],
                ["register", "✏️ Register"],
              ].map(([t, l]) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    border: "none",
                    borderRadius: 9,
                    background: tab === t ? "#fff" : "transparent",
                    color: tab === t ? "#1e293b" : "#64748b",
                    fontWeight: tab === t ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all .2s",
                    boxShadow: tab === t ? "0 1px 6px rgba(0,0,0,.08)" : "none",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Google Button */}
            <button
              onClick={googleSignIn}
              disabled={gLoading || loading}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                color: "#374151",
                fontWeight: 600,
                fontSize: 13.5,
                cursor: gLoading || loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 18,
                transition: "all .2s",
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                opacity: gLoading || loading ? 0.7 : 1,
              }}
            >
              {gLoading ? (
                <span
                  className="spin"
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid #e2e8f0",
                    borderTop: "2px solid #4285f4",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.7 13.6l7.8 6C12.4 13.2 17.8 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.5 28.4A14.8 14.8 0 0 1 9.5 24c0-1.5.3-3 .7-4.4l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.3z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.2 1.5-5 2.3-8.4 2.3-6.2 0-11.5-4.2-13.4-9.8l-7.8 6C6.7 42.5 14.7 48 24 48z"
                  />
                </svg>
              )}
              {gLoading ? "Signing in with Google…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                OR
              </span>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            </div>

            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {tab === "register" && (
                <div>
                  <label style={lbl2}>
                    Full Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    ref={namRef}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && emailRef.current?.focus()}
                    placeholder="e.g. Jean Pierre Habimana"
                    style={inp2}
                    onFocus={focusIn}
                    onBlur={focusOut}
                    autoComplete="name"
                  />
                </div>
              )}

              <div>
                <label style={lbl2}>
                  Email Address <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && pwdRef.current?.focus()}
                  placeholder="you@example.com"
                  style={inp2}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </div>

              <div>
                <label style={lbl2}>
                  Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    ref={pwdRef}
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onKeyDown={(e) =>
                      e.key === "Enter" && tab === "login" ? login() : null
                    }
                    placeholder="••••••••"
                    style={{ ...inp2, paddingRight: 44 }}
                    onFocus={focusIn}
                    onBlur={focusOut}
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                      fontSize: 16,
                      padding: 2,
                      lineHeight: 1,
                    }}
                    tabIndex={-1}
                  >
                    {showPwd ? "🙈" : "👁️"}
                  </button>
                </div>
                {tab === "login" && (
                  <div style={{ textAlign: "right", marginTop: 6 }}>
                    <button
                      onClick={() => setShowForgot(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#16a34a",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              {tab === "register" && (
                <div>
                  <label style={lbl2}>
                    Confirm Password <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPwd ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm({ ...form, confirmPassword: e.target.value })
                      }
                      onKeyDown={(e) => e.key === "Enter" && reg()}
                      placeholder="••••••••"
                      style={{
                        ...inp2,
                        paddingRight: 44,
                        borderColor:
                          form.confirmPassword &&
                          form.confirmPassword !== form.password
                            ? "#fca5a5"
                            : undefined,
                      }}
                      onFocus={focusIn}
                      onBlur={focusOut}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: 16,
                        padding: 2,
                        lineHeight: 1,
                      }}
                      tabIndex={-1}
                    >
                      {showConfirmPwd ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {form.confirmPassword && form.confirmPassword !== form.password && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                      ⚠️ Passwords don't match yet
                    </div>
                  )}
                  {form.confirmPassword && form.confirmPassword === form.password && (
                    <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>
                      ✅ Passwords match
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error / Success Messages */}
            {err && (
              <div
                style={{
                  marginTop: 16,
                  padding: "11px 14px",
                  background: "#fef2f2",
                  border: "1.5px solid #fca5a5",
                  borderRadius: 10,
                  color: "#b91c1c",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
                <span>{err}</span>
              </div>
            )}
            {ok && (
              <div
                style={{
                  marginTop: 16,
                  padding: "11px 14px",
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  borderRadius: 10,
                  color: "#15803d",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>✅</span>
                <span>{ok}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={tab === "login" ? login : reg}
              disabled={loading || gLoading}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "13px",
                borderRadius: 11,
                border: "none",
                background:
                  loading || gLoading
                    ? "#86efac"
                    : "linear-gradient(135deg,#16a34a,#15803d)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14.5,
                cursor: loading || gLoading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow:
                  loading || gLoading ? "none" : "0 4px 18px rgba(22,163,74,.35)",
                transition: "all .2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span
                    className="spin"
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,.4)",
                      borderTop: "2px solid #fff",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
                  Processing…
                </>
              ) : tab === "login" ? (
                "Sign In →"
              ) : (
                "Create Account →"
              )}
            </button>

            {tab === "register" && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "rgba(59,130,246,.06)",
                  border: "1px solid rgba(59,130,246,.15)",
                  borderRadius: 9,
                  fontSize: 12,
                  color: "#3b82f6",
                  lineHeight: 1.6,
                }}
              >
                ℹ️ New accounts require <strong>admin approval</strong> before you can log
                in. The farm admin will be notified.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <ForgotPasswordModal
          initialEmail={form.email}
          onClose={() => setShowForgot(false)}
        />
      )}
    </>
  );
}
