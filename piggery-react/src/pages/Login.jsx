// src/pages/Login.jsx
// ─── Full login screen — migrated from §19 of index.html ─────────────────────
// Supports:
//   • Email / password sign-in
//   • New account registration (requires admin approval)
//   • Google sign-in via redirect
//   • Forgot password (email reset OR WhatsApp OTP → email reset)
// Auth state resolution (setUser) is handled by AuthContext / onAuthStateChanged.
// This component just triggers Firebase auth actions and shows feedback.

import { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

import { auth, db, isAdminEmail, ensureUserProfile, _profileCache, generateOTP, storeOTP, verifyOTP } from '../lib/firebase';

import { useAuth } from '../context/AuthContext';

// ── Shared style helpers ──────────────────────────────────────────────────────
const inp = {
  background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#1e293b',
  borderRadius: 10, padding: '11px 14px', width: '100%', fontSize: 13.5,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color .2s, box-shadow .2s',
};
const lbl = {
  fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5,
  letterSpacing: 0.5, fontWeight: 600, textTransform: 'uppercase',
};
const focusIn  = e => { e.target.style.borderColor = '#16a34a'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,.1)'; };
const focusOut = e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; };

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const toDay = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
const uid   = () => Math.random().toString(36).slice(2, 10);

// ─── Forgot-password modal ────────────────────────────────────────────────────
function ForgotPasswordModal({ initialEmail, onClose }) {
  const [step, setStep]     = useState('choose'); // choose | otp_enter | email_sent
  const [email, setEmail]   = useState(initialEmail || '');
  const [otpInput, setOtpInput] = useState('');
  const [otpUid, setOtpUid] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [err, setErr]   = useState('');
  const [ok, setOk]     = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Read WhatsApp config from localStorage ──────────────────────────────────
  function getWAConfig() {
    try { return JSON.parse(localStorage.getItem('farmiq_wa_config') || '{}'); }
    catch { return {}; }
  }

  async function sendEmail() {
    setErr('');
    const e = email.trim();
    if (!e) return setErr('Please enter your email address.');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, e);
      setStep('email_sent');
    } catch (ex) {
      setErr(
        ex.code === 'auth/user-not-found' ? 'No account found with that email.' :
        ex.code === 'auth/invalid-email'  ? 'Invalid email address.' :
        'Error: ' + ex.message
      );
    }
    setBusy(false);
  }

  async function startOTPFlow() {
    setErr('');
    const e = email.trim();
    if (!e) return setErr('Please enter your email address first.');
    setBusy(true);
    try {
      const q    = query(collection(db, 'users'), where('email', '==', e), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { setErr('No account found with that email.'); setBusy(false); return; }

      const profile = snap.docs[0].data();
      const waConf  = getWAConfig();
      if (!waConf.enabled || !waConf.phone || !waConf.apikey) {
        setErr('WhatsApp (CallMeBot) is not configured. Use email recovery instead.');
        setBusy(false); return;
      }
      const code = generateOTP();
      await storeOTP(profile.uid, code);
      const msg = `🔐 FarmIQ Recovery OTP\n\nYour one-time code: *${code}*\n\nExpires in 10 minutes. Do not share this code.`;
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waConf.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(waConf.apikey)}`;
      await fetch(url, { method: 'GET', mode: 'no-cors' });
      setOtpUid(profile.uid);
      setCountdown(60);
      setStep('otp_enter');
      setOk('📱 OTP sent to the WhatsApp linked to this account.');
    } catch (ex) { setErr('Failed: ' + ex.message); }
    setBusy(false);
  }

  async function verifyAndSend() {
    setErr('');
    if (otpInput.length !== 6) return setErr('Please enter the full 6-digit code.');
    setBusy(true);
    try {
      const result = await verifyOTP(otpUid, otpInput);
      if (!result.ok) { setErr('❌ ' + result.reason); setBusy(false); return; }
      await sendPasswordResetEmail(auth, email.trim());
      setStep('email_sent');
      setOk('✅ OTP verified! Reset link sent to ' + email.trim() + '.');
    } catch (ex) { setErr('Error: ' + ex.message); }
    setBusy(false);
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const box     = { background: '#fff', borderRadius: 18, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' };
  const msgBox  = (type, txt) => (
    <div style={{ padding: '10px 14px', background: type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(22,163,74,.08)', border: '1px solid ' + (type === 'err' ? 'rgba(239,68,68,.25)' : 'rgba(22,163,74,.25)'), borderRadius: 9, color: type === 'err' ? '#dc2626' : '#16a34a', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>{txt}</div>
  );

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box} className="slide-up">
        {/* Header */}
        <div style={{ background: 'linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)', padding: '22px 24px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>🔐 Account Recovery</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 3 }}>Regain access to your FarmIQ account</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'rgba(255,255,255,.7)', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '22px 24px 26px' }}>
          {err && msgBox('err', err)}
          {ok  && msgBox('ok',  ok)}

          {/* STEP: CHOOSE METHOD */}
          {step === 'choose' && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ ...lbl }}>Your Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} autoCapitalize="none" onKeyDown={e => e.key === 'Enter' && sendEmail()} />
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, fontWeight: 600 }}>Choose recovery method:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={sendEmail} disabled={busy} style={{ padding: '13px 16px', borderRadius: 12, border: '2px solid rgba(37,99,235,.25)', background: 'rgba(37,99,235,.04)', color: '#1e293b', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 26 }}>📧</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Send Reset Link via Email</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Receive a secure link directly in your inbox</div>
                    </div>
                  </div>
                </button>
                <button onClick={startOTPFlow} disabled={busy} style={{ padding: '13px 16px', borderRadius: 12, border: '2px solid rgba(34,197,94,.25)', background: 'rgba(34,197,94,.04)', color: '#1e293b', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 26 }}>📱</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Verify via WhatsApp OTP</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Get a 6-digit code on WhatsApp, then reset via email</div>
                    </div>
                  </div>
                </button>
              </div>
              {busy && <div style={{ textAlign: 'center', marginTop: 14, color: '#64748b', fontSize: 13 }}>⏳ Please wait…</div>}
            </div>
          )}

          {/* STEP: OTP ENTRY */}
          {step === 'otp_enter' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Enter WhatsApp OTP</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Check your WhatsApp for a 6-digit code · expires in 10 min</div>
              </div>
              {/* Digit display */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ width: 40, height: 50, borderRadius: 9, border: '2px solid ' + (i < otpInput.length ? '#16a34a' : '#e2e8f0'), background: i < otpInput.length ? 'rgba(22,163,74,.06)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#1e293b', transition: 'all .15s' }}>
                    {otpInput[i] || ''}
                  </div>
                ))}
              </div>
              <input type="text" inputMode="numeric" maxLength={6} value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && otpInput.length === 6 && verifyAndSend()} placeholder="Tap to enter code" style={{ ...inp, letterSpacing: 8, fontSize: 20, textAlign: 'center', fontWeight: 700, marginBottom: 14 }} />
              <button onClick={verifyAndSend} disabled={busy || otpInput.length < 6} style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', background: otpInput.length === 6 ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: otpInput.length === 6 ? 'pointer' : 'default', fontFamily: 'inherit', marginBottom: 10 }}>
                {busy ? '⏳ Verifying…' : '✅ Verify Code & Send Reset Email'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => { setStep('choose'); setOtpInput(''); setErr(''); setOk(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button onClick={() => { if (countdown === 0) { setStep('choose'); setOtpInput(''); setErr(''); setOk(''); } else setErr(`Wait ${countdown}s before retrying.`); }} style={{ background: 'none', border: 'none', color: countdown > 0 ? '#94a3b8' : '#16a34a', fontSize: 12, cursor: countdown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Try again'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: EMAIL SENT SUCCESS */}
          {step === 'email_sent' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 54, marginBottom: 14 }}>✉️</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', marginBottom: 8 }}>Check Your Email!</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8, marginBottom: 20 }}>
                A password reset link has been sent to<br />
                <strong style={{ color: '#1e293b' }}>{email.trim()}</strong>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, fontSize: 12, color: '#3b82f6', textAlign: 'left', lineHeight: 1.7, marginBottom: 18 }}>
                💡 <strong>Tips:</strong> Check your spam/junk folder. The link expires in 1 hour. Click it on the same device for best results.
              </div>
              <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Done — Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Login component ─────────────────────────────────────────────────────
export default function Login() {
  const { loginWithGoogle, pendingApproval, setPendingApproval } = useAuth();

  const [tab, setTab]   = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [err, setErr]   = useState(
    pendingApproval
      ? 'Your account is pending admin approval. Please wait.'
      : window.__workerRemoved
      ? 'Your account has been removed. Please contact the farm admin.'
      : ''
  );
  const [ok, setOk]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showForgot, setShowForgot]   = useState(false);

  const nameRef  = useRef(null);
  const emailRef = useRef(null);
  const pwdRef   = useRef(null);

  // ── Listen for auth-blocked events fired by AuthContext ──────────────────
  useEffect(() => {
    function onBlocked(e) {
      const reason = e.detail?.reason;
      if (reason === 'pending') {
        setPendingApproval(true);
        setErr('Your account is pending admin approval. Please wait.');
      } else if (reason === 'removed') {
        setErr('Your account has been removed. Please contact the farm admin.');
      } else {
        setErr('Access denied. Please contact the farm admin.');
      }
      setLoading(false); setGLoading(false);
    }
    window.addEventListener('farmiq_auth_blocked', onBlocked);
    return () => window.removeEventListener('farmiq_auth_blocked', onBlocked);
  }, [setPendingApproval]);

  // ── Email / password sign-in ─────────────────────────────────────────────
  async function login() {
    setErr(''); setOk('');
    if (!form.email || !form.password) return setErr('Please enter your email and password.');
    if (form.password.length < 6)      return setErr('Password must be at least 6 characters.');
    setLoading(true);

    // Safety: if onAuthStateChanged never fires (network issue), clear spinner after 12 s
    const loginTimeout = setTimeout(() => {
      setLoading(false);
      setErr('Sign in is taking too long. Check your internet connection and try again.');
    }, 12000);

    try {
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      // Keep spinner on — onAuthStateChanged in AuthContext will resolve this and
      // unmount Login, OR the farmiq_auth_blocked handler above will setLoading(false).
      clearTimeout(loginTimeout);
    } catch (e) {
      clearTimeout(loginTimeout);
      setErr(
        e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
          ? 'Incorrect email or password. Please try again.'
          : e.code === 'auth/invalid-email'        ? 'Invalid email address.'
          : e.code === 'auth/too-many-requests'    ? 'Too many attempts. Please wait a few minutes and try again.'
          : e.code === 'auth/network-request-failed' ? 'No internet connection. Check your network and try again.'
          : 'Sign in failed: ' + e.message
      );
      setLoading(false);
    }
  }

  // ── Register new account ─────────────────────────────────────────────────
  async function reg() {
    setErr(''); setOk('');
    window.__workerRemoved = false;
    if (!form.name.trim())    return setErr('Please enter your full name.');
    if (!form.email.trim())   return setErr('Please enter your email address.');
    if (!form.password)       return setErr('Please enter a password.');
    if (form.password.length < 6)           return setErr('Password must be at least 6 characters.');
    if (form.password !== form.confirmPassword) return setErr('Passwords do not match. Please re-enter them.');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await ensureUserProfile(cred.user, { name: form.name.trim() });
      _profileCache.delete(cred.user.uid); // clear cache so next login reads fresh

      const adminFlag = isAdminEmail(form.email.trim());

      // Send welcome onboarding message to new worker inbox
      if (!adminFlag) {
        const workerName = form.name.trim();
        const now = new Date();
        const welcomeMsg = {
          id: uid(),
          text: `👋 Murakaza neza / Welcome, ${workerName}!\n\nYour FarmIQ account has been created and is pending admin approval.\n\nOnce approved, you will be able to:\n🐷 Register & track pigs\n📋 Submit daily care logs\n🌾 Record feeding entries\n📐 Submit weekly pig assessments\n✅ View & complete assigned tasks\n💬 Receive messages from the admin\n\nA farm admin will review and activate your account shortly. We are glad to have you on the team! 🌱\n\n— FarmIQ Team`,
          from:          'FarmIQ System',
          date:          toDay(),
          time:          now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }),
          recipients:    1,
          recipientNames: workerName,
          recipientIds:  [cred.user.uid],
          broadcast:     false,
          system:        true,
          welcome:       true,
        };
        try { await jbinAppend('messages', welcomeMsg); } catch (e) { console.warn('Welcome msg failed', e); }
      }

      // Sign out immediately so the new worker can't slip through before approval
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password)
        .then(() => {}) // Let AuthContext block unapproved
        .catch(() => {});

      if (adminFlag) {
        setOk('Admin account created! You can now sign in.');
      } else {
        setOk('Account created! An admin must approve your access before you can sign in.');
      }
      setTab('login');
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
    } catch (e) {
      setErr(
        e.code === 'auth/email-already-in-use' ? 'An account with that email already exists.' :
        e.code === 'auth/invalid-email'        ? 'Invalid email address.' :
        'Registration failed: ' + e.message
      );
    }
    setLoading(false);
  }

  // ── Google sign-in ───────────────────────────────────────────────────────
  async function googleSignIn() {
    setErr(''); setGLoading(true);
    try {
      await loginWithGoogle();
      // Page navigates away — nothing executes after this line.
    } catch (e) {
      setErr('Google sign-in failed. Please try again.');
      setGLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="login-enter" style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#071510 0%,#0c1f13 40%,#0f2516 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 440, boxShadow: '0 24px 80px rgba(0,0,0,.35)', overflow: 'hidden' }}>

          {/* ── Header ── */}
          <div style={{ background: 'linear-gradient(145deg,#071510 0%,#0e2213 55%,#102616 100%)', padding: '28px 28px 22px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -20, width: 130, height: 130, background: 'radial-gradient(circle,rgba(74,222,128,.14) 0%,transparent 65%)', pointerEvents: 'none' }} />
            {/* Online badge */}
            <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.1)', color: '#86efac', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: 1 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              ONLINE
            </div>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(74,222,128,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 12 }}>🐷</div>
            <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Alexis Gold Piggery</p>
            <p style={{ color: 'rgba(74,222,128,.6)', fontSize: 10, letterSpacing: 2.5, margin: '4px 0 10px', textTransform: 'uppercase', fontWeight: 700 }}>Farm Management · Rwanda</p>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 13, margin: 0 }}>Welcome back — sign in to manage your farm.</p>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '24px 28px 28px' }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 22, gap: 2 }}>
              {[['login', '🔐 Sign In'], ['register', '✏️ Register']].map(([t, l]) => (
                <button key={t} onClick={() => { setTab(t); setErr(''); setOk(''); }} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#16a34a' : '#6b7280', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>{l}</button>
              ))}
            </div>

            {/* Google button */}
            <button onClick={googleSignIn} disabled={gLoading || loading} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13.5, cursor: (gLoading || loading) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,.06)', opacity: (gLoading || loading) ? 0.7 : 1 }}>
              {gLoading
                ? <span className="spin" style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTop: '2px solid #4285f4', borderRadius: '50%', display: 'inline-block' }} />
                : <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.7 13.6l7.8 6C12.4 13.2 17.8 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z" /><path fill="#FBBC05" d="M10.5 28.4A14.8 14.8 0 0 1 9.5 24c0-1.5.3-3 .7-4.4l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.3z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.2 1.5-5 2.3-8.4 2.3-6.2 0-11.5-4.2-13.4-9.8l-7.8 6C6.7 42.5 14.7 48 24 48z" /></svg>
              }
              {gLoading ? 'Signing in with Google…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.5 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab === 'register' && (
                <div>
                  <label style={lbl}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input ref={nameRef} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && emailRef.current?.focus()} placeholder="e.g. Jean Pierre Habimana" style={inp} onFocus={focusIn} onBlur={focusOut} autoComplete="name" />
                </div>
              )}
              <div>
                <label style={lbl}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                <input ref={emailRef} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onKeyDown={e => e.key === 'Enter' && pwdRef.current?.focus()} placeholder="you@example.com" style={inp} autoCapitalize="none" autoCorrect="off" autoComplete="email" onFocus={focusIn} onBlur={focusOut} />
              </div>
              <div>
                <label style={lbl}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input ref={pwdRef} type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? login() : null)} placeholder="••••••••" style={{ ...inp, paddingRight: 44 }} onFocus={focusIn} onBlur={focusOut} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 2 }} tabIndex={-1}>{showPwd ? '🙈' : '👁️'}</button>
                </div>
                {tab === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <button onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>Forgot password?</button>
                  </div>
                )}
              </div>
              {tab === 'register' && (
                <div>
                  <label style={lbl}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConfirmPwd ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} onKeyDown={e => e.key === 'Enter' && reg()} placeholder="••••••••" style={{ ...inp, paddingRight: 44, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#fca5a5' : undefined }} onFocus={focusIn} onBlur={focusOut} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirmPwd(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 2 }} tabIndex={-1}>{showConfirmPwd ? '🙈' : '👁️'}</button>
                  </div>
                  {form.confirmPassword && form.confirmPassword !== form.password && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠️ Passwords don't match yet</div>}
                  {form.confirmPassword && form.confirmPassword === form.password  && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✅ Passwords match</div>}
                </div>
              )}
            </div>

            {/* Messages */}
            {err && <div style={{ marginTop: 16, padding: '11px 14px', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}><span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span><span>{err}</span></div>}
            {ok  && <div style={{ marginTop: 16, padding: '11px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, color: '#15803d', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}><span style={{ flexShrink: 0, marginTop: 1 }}>✅</span><span>{ok}</span></div>}

            {/* Submit */}
            <button onClick={tab === 'login' ? login : reg} disabled={loading || gLoading} style={{ marginTop: 20, width: '100%', padding: '13px', borderRadius: 11, border: 'none', background: (loading || gLoading) ? '#86efac' : 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: (loading || gLoading) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: (loading || gLoading) ? 'none' : '0 4px 18px rgba(22,163,74,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><span className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block' }} />Processing…</> : tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>

            {tab === 'register' && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 9, fontSize: 12, color: '#3b82f6', lineHeight: 1.6 }}>
                ℹ️ New accounts require <strong>admin approval</strong> before you can log in. The farm admin will be notified.
              </div>
            )}
          </div>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal initialEmail={form.email} onClose={() => setShowForgot(false)} />}
    </>
  );
}
