// src/components/worker/ChangePassword.jsx
// §23 — Password & Security (password change, OTP, email recovery)

import React, { useState, useEffect } from 'react'
import { C, S } from '../../utils/constants'
import { isWAEnabled, sendWhatsApp } from '../../utils/farm'
import { _auth } from '../../firebase/config'
import { generateOTP, storeOTP, verifyOTP } from '../../utils/otp'

export default function ChangePassword({ user }) {
  const [mode, setMode] = useState('password')
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' })
  const [otpStep, setOtpStep] = useState(1)
  const [otpInput, setOtpInput] = useState('')
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [recoveryEmail, setRecoveryEmail] = useState(user?.email || '')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const fbUser = _auth.currentUser
  const hasPasswordProvider = fbUser?.providerData?.some(p => p.providerId === 'password')
  const isGoogleOnly = fbUser?.providerData?.every(p => p.providerId === 'google.com')
  const waOk = isWAEnabled()

  useEffect(() => {
    if (otpCountdown <= 0) return
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [otpCountdown])

  function reset() { setErr(''); setOk('') }
  function switchMode(m) { setMode(m); reset(); setOtpStep(1); setOtpInput('') }

  // ── Tab 1: Password change ──
  async function savePassword() {
    reset()
    if (!hasPasswordProvider) return setErr('You signed in with Google. Use the OTP or Recovery tab instead.')
    if (!form.current || !form.newPass || !form.confirm) return setErr('Please fill in all fields.')
    if (form.newPass.length < 6) return setErr('New password must be at least 6 characters.')
    if (form.newPass !== form.confirm) return setErr('New passwords do not match.')
    if (form.newPass === form.current) return setErr('New password must be different from current.')
    setSaving(true)
    try {
      const cred = window.firebase.auth.EmailAuthProvider.credential(fbUser.email, form.current)
      await fbUser.reauthenticateWithCredential(cred)
      await fbUser.updatePassword(form.newPass)
      setOk('✅ Password changed successfully!')
      window._addAuditLog?.('edit', 'Password changed successfully')
      setForm({ current: '', newPass: '', confirm: '' })
    } catch (e) {
      setErr(e.code === 'auth/wrong-password' ? '❌ Current password is incorrect.'
        : e.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.'
        : 'Failed: ' + e.message)
    }
    setSaving(false)
  }

  // ── Tab 2: OTP via WhatsApp ──
  async function sendOTP() {
    reset()
    if (!waOk) return setErr('WhatsApp (CallMeBot) is not configured. Go to Settings → WhatsApp Notifications to set it up first.')
    if (otpCountdown > 0) return setErr(`Please wait ${otpCountdown}s before requesting a new code.`)
    setSaving(true)
    try {
      const code = generateOTP()
      await storeOTP(fbUser.uid, code)
      const msg = `🔐 FarmIQ Password OTP\n\nYour one-time code: *${code}*\n\nThis code expires in 10 minutes.\nDo NOT share it with anyone.`
      const res = await sendWhatsApp(msg)
      if (res.ok === false && res.reason === 'not_configured') {
        setErr('WhatsApp not configured. Set it up in Settings → WhatsApp Notifications.')
      } else {
        setOtpStep(2); setOtpCountdown(60)
        setOk('📱 OTP sent to your WhatsApp! Enter the 6-digit code below.')
      }
    } catch (e) { setErr('Failed to send OTP: ' + e.message) }
    setSaving(false)
  }

  async function verifyOTPAndReset() {
    reset()
    if (otpInput.length !== 6) return setErr('Please enter the full 6-digit OTP code.')
    setSaving(true)
    try {
      const result = await verifyOTP(fbUser.uid, otpInput)
      if (!result.ok) { setErr('❌ ' + result.reason); setSaving(false); return }
      await _auth.sendPasswordResetEmail(fbUser.email)
      setOtpStep(1); setOtpInput('')
      setOk('✅ OTP verified! A secure password reset link has been sent to ' + fbUser.email + '. Click it to set your new password.')
    } catch (e) { setErr('Verification failed: ' + e.message) }
    setSaving(false)
  }

  // ── Tab 3: Email recovery ──
  async function sendRecovery() {
    reset()
    const email = (recoveryEmail || '').trim()
    if (!email) return setErr('Please enter your email address.')
    setSaving(true)
    try {
      await _auth.sendPasswordResetEmail(email)
      setOk('✅ Password reset link sent to ' + email + '. Check your inbox and spam folder.')
    } catch (e) {
      setErr(e.code === 'auth/user-not-found' ? 'No account found with that email.'
        : e.code === 'auth/invalid-email' ? 'Invalid email address.'
        : 'Failed: ' + e.message)
    }
    setSaving(false)
  }

  const Spinner = () => (
    <span className="spin" style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block' }} />
  )
  const MsgBox = ({ type, txt }) => (
    <div style={{ padding: '10px 14px', background: type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(22,163,74,.08)', border: '1px solid ' + (type === 'err' ? 'rgba(239,68,68,.25)' : 'rgba(22,163,74,.25)'), borderRadius: 9, color: type === 'err' ? C.red : C.accent, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>{txt}</div>
  )

  return (
    <div style={{ maxWidth: 460 }} className="fade-in">
      <div style={S.h1}>🔒 Password &amp; Security</div>
      <div style={S.sub}>Change password · OTP verification · Account recovery</div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 10, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border }}>
        {[['password', '🔑 Password'], ['otp', '📱 OTP'], ['recovery', '📧 Recovery']].map(([m, l]) => (
          <button key={m} style={S.tab(mode === m)} onClick={() => switchMode(m)}>{l}</button>
        ))}
      </div>

      <div style={S.card}>
        {err && <MsgBox type="err" txt={err} />}
        {ok  && <MsgBox type="ok"  txt={ok} />}

        {/* ── PASSWORD TAB ── */}
        {mode === 'password' && (
          <div>
            {isGoogleOnly && (
              <div style={{ padding: '11px 14px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 9, fontSize: 13, color: C.amber, marginBottom: 16, lineHeight: 1.6 }}>
                ⚠️ Your account uses <strong>Google Sign-In</strong> only. Switch to the <strong>OTP</strong> tab to add/change a password, or use <strong>Recovery</strong> to get a reset link via email.
              </div>
            )}
            {!isGoogleOnly && (
              <>
                {[['current', '🔑 Current Password', 'Enter current password'], ['newPass', '🔒 New Password', 'Min. 6 characters']].map(([k, lbl, ph]) => (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <label style={S.lbl}>{lbl}</label>
                    <input type="password" placeholder={ph} value={form[k]}
                      onChange={e => setForm({ ...form, [k]: e.target.value })}
                      style={S.inp} />
                    {k === 'newPass' && form.newPass && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 4, borderRadius: 3, background: C.elevated, overflow: 'hidden' }}>
                          <div style={{ height: '100%', transition: 'width .3s,background .3s', width: form.newPass.length < 6 ? '30%' : form.newPass.length < 10 ? '60%' : '100%', background: form.newPass.length < 6 ? C.red : form.newPass.length < 10 ? C.amber : C.accent }} />
                        </div>
                        <div style={{ fontSize: 10, color: form.newPass.length < 6 ? C.red : form.newPass.length < 10 ? C.amber : C.accent, marginTop: 3 }}>
                          {form.newPass.length < 6 ? 'Weak' : form.newPass.length < 10 ? 'Fair' : 'Strong'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ marginBottom: 18 }}>
                  <label style={S.lbl}>Confirm New Password</label>
                  <input type="password" placeholder="Repeat new password" value={form.confirm}
                    onChange={e => setForm({ ...form, confirm: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && savePassword()}
                    style={{ ...S.inp, borderColor: form.confirm && form.confirm !== form.newPass ? C.red : undefined }} />
                  {form.confirm && form.confirm !== form.newPass && <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>Passwords don't match</div>}
                </div>
                <button onClick={savePassword} disabled={saving} style={{ ...S.btn(), width: '100%', padding: 12, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {saving ? <><Spinner />Saving…</> : '🔒 Change Password'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button onClick={() => switchMode('recovery')} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Forgot current password? Use Recovery →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── OTP TAB ── */}
        {mode === 'otp' && (
          <div>
            <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 9, fontSize: 12, color: '#6366f1', marginBottom: 16, lineHeight: 1.6 }}>
              📱 <strong>How it works:</strong> We generate a 6-digit code and send it to your WhatsApp. Once you verify the code, we send a secure reset link to your email.
            </div>
            {!waOk && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 9, fontSize: 13, color: C.amber, marginBottom: 14 }}>
                ⚠️ WhatsApp not set up. Go to <strong>Settings → WhatsApp Notifications</strong> to configure your number and CallMeBot API key first.
              </div>
            )}
            {/* Step indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
              {[['1', 'Send OTP'], ['2', 'Verify Code']].map(([n, l], i) => (
                <React.Fragment key={n}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: otpStep >= parseInt(n) ? C.accent : 'rgba(100,116,139,.2)', color: otpStep >= parseInt(n) ? '#fff' : C.faint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                    <span style={{ fontSize: 12, color: otpStep >= parseInt(n) ? C.text : C.faint, fontWeight: otpStep === parseInt(n) ? 700 : 400 }}>{l}</span>
                  </div>
                  {i < 1 && <div style={{ flex: 1, height: 1, background: otpStep > 1 ? C.accent : C.border, margin: '0 4px' }} />}
                </React.Fragment>
              ))}
            </div>

            {otpStep === 1 && (
              <div>
                <div style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Send OTP to WhatsApp</div>
                  <div style={{ fontSize: 12, color: C.muted }}>A 6-digit code will be sent to your registered WhatsApp number via CallMeBot.</div>
                </div>
                <button onClick={sendOTP} disabled={saving || !waOk || otpCountdown > 0}
                  style={{ ...S.btn(waOk ? '#6366f1' : '#94a3b8'), width: '100%', padding: 12, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {saving ? <><Spinner />Sending…</> : otpCountdown > 0 ? `⏳ Resend in ${otpCountdown}s` : '📱 Send OTP via WhatsApp'}
                </button>
              </div>
            )}

            {otpStep === 2 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={S.lbl}>6-Digit OTP Code</label>
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="• • • • • •"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && otpInput.length === 6 && verifyOTPAndReset()}
                    style={{ ...S.inp, letterSpacing: 10, fontSize: 22, textAlign: 'center', fontWeight: 800, paddingTop: 12, paddingBottom: 12 }} />
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 5, textAlign: 'center' }}>Check your WhatsApp — code expires in 10 minutes</div>
                </div>
                {otpInput.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ width: 38, height: 46, borderRadius: 8, border: '2px solid ' + (i < otpInput.length ? C.accent : C.border), background: i < otpInput.length ? 'rgba(22,163,74,.06)' : C.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: C.text, transition: 'all .15s' }}>
                        {otpInput[i] || ''}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setOtpStep(1); setOtpInput(''); reset() }} style={{ ...S.btn(C.elevated), color: C.muted, border: '1px solid ' + C.border, padding: '10px 14px', fontSize: 13 }}>← Back</button>
                  <button onClick={verifyOTPAndReset} disabled={saving || otpInput.length < 6}
                    style={{ ...S.btn(), flex: 1, padding: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {saving ? <><Spinner />Verifying…</> : '✅ Verify & Send Reset Email'}
                  </button>
                </div>
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button onClick={() => { if (otpCountdown === 0) { setOtpStep(1); setOtpInput(''); reset() } else setErr(`Wait ${otpCountdown}s before resending.`) }}
                    style={{ background: 'none', border: 'none', color: otpCountdown > 0 ? C.faint : C.accent, fontSize: 12, cursor: otpCountdown > 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {otpCountdown > 0 ? `Resend available in ${otpCountdown}s` : "Didn't receive it? Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RECOVERY TAB ── */}
        {mode === 'recovery' && (
          <div>
            <div style={{ textAlign: 'center', padding: '20px 16px 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📧</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Email Recovery</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Enter your email address and we'll send you a secure password reset link. Works even if you've completely forgotten your password.</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Email Address</label>
              <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendRecovery()} placeholder="you@example.com" style={S.inp} autoCapitalize="none" />
            </div>
            <button onClick={sendRecovery} disabled={saving} style={{ ...S.btn('#2563eb'), width: '100%', padding: 12, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {saving ? <><Spinner />Sending…</> : '📧 Send Password Reset Email'}
            </button>
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 9, fontSize: 12, color: '#3b82f6', lineHeight: 1.7 }}>
              💡 <strong>Tips:</strong> Check your spam/junk folder. The link expires in 1 hour. Click it on the same device/browser for best results.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
