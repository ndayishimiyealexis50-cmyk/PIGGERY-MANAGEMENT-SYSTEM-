/**
 * RemoteWorkPanel.jsx
 * Migrated from index.html §12 REMOTE WORK PANEL (Worker side)
 *
 * Props: user, sessions, setSessions, messages
 *
 * External deps:
 *   setOnlineFarmData(patch)
 *   toDay()
 *   uid()
 */

import { useState } from "react";
import { C, S } from "../styles";

// ─── Stubs ──────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const setOnlineFarmData = async () => {};
// ────────────────────────────────────────────────────────────────

const STATUS_COLOR = { pending: "#f59e0b", active: "#16a34a", ended: "#6b7280", rejected: "#ef4444" };
const STATUS_BG    = { pending: "rgba(245,158,11,.1)", active: "rgba(22,163,74,.1)", ended: "rgba(107,114,128,.08)", rejected: "rgba(239,68,68,.08)" };

export default function RemoteWorkPanel({ user, sessions, setSessions, messages }) {
  const [tab, setTab] = useState("status");
  const [form, setForm] = useState({ computerName: "", computerSpec: "", location: "", purpose: "", notes: "" });
  const [saved, setSaved] = useState(false);
  const [err,   setErr]   = useState("");

  const myActive  = sessions.filter(s => s.workerId === user.id && s.status === "active");
  const myAll     = sessions.filter(s => s.workerId === user.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const currentSession = myActive[0] || null;

  function requestSession() {
    setErr("");
    if (!form.computerName || !form.location || !form.purpose) return setErr("Please fill all required fields.");
    const newSess = {
      id: uid(), workerId: user.id, workerName: user.name, workerUsername: user.username,
      computerName: form.computerName, computerSpec: form.computerSpec || "Not specified",
      location: form.location, purpose: form.purpose, notes: form.notes,
      status: "pending", requestedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      startedAt: new Date().toISOString(), approvedAt: null, endedAt: null, adminNote: "",
    };
    setSessions(p => { const updated = [...p, newSess]; setOnlineFarmData({ sessions: updated }); return updated; });
    setSaved(true); setErr("");
    setForm({ computerName: "", computerSpec: "", location: "", purpose: "", notes: "" });
    setTimeout(() => setSaved(false), 3000);
    setTab("status");
  }

  function endSession() {
    if (!currentSession) return;
    setSessions(p => {
      const updated = p.map(s => s.id === currentSession.id ? { ...s, status: "ended", endedAt: new Date().toISOString().slice(0, 16).replace("T", " ") } : s);
      setOnlineFarmData({ sessions: updated });
      return updated;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={S.h1}>🖥️ Remote Work Portal</div>
          <div style={S.sub}>Register your computer &amp; get admin approval to work remotely</div>
        </div>
        {currentSession && (
          <div style={{ padding: "7px 13px", borderRadius: 8, background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.3)", fontSize: 12, color: C.accent, fontWeight: 700 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.accent, marginRight: 6 }} />
            ACTIVE SESSION
          </div>
        )}
      </div>

      {/* Active session banner */}
      {currentSession && (
        <div style={{ padding: "14px 16px", background: "rgba(22,163,74,.07)", border: "1px solid rgba(22,163,74,.25)", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>✅ You are currently working remotely</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10, fontSize: 12 }}>
            {[["🖥️ Computer", currentSession.computerName], ["📍 Location", currentSession.location], ["🎯 Purpose", currentSession.purpose], ["⏱️ Since", currentSession.approvedAt || currentSession.startedAt]].map(([l, v]) => (
              <div key={l} style={{ background: C.elevated, borderRadius: 6, padding: "5px 9px" }}>
                <span style={{ color: C.faint }}>{l}: </span>
                <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={endSession} style={{ ...S.btn("#991b1b"), fontSize: 12, padding: "7px 16px" }}>🔴 End Session</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", background: C.elevated, borderRadius: 8, padding: 3, gap: 2, border: "1px solid " + C.border, marginBottom: 16 }}>
        {[["status", "📋 My Sessions"], ["request", "➕ New Request"]].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── New Request tab ── */}
      {tab === "request" && (
        <div style={{ maxWidth: 520 }}>
          {saved && <div style={{ padding: "10px 14px", background: C.accentSoft, borderRadius: 8, marginBottom: 12, color: C.accent, fontSize: 13, border: "1px solid rgba(22,163,74,.3)" }}>✅ Request submitted! Waiting for admin approval.</div>}
          {err  && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.08)", borderRadius: 8, marginBottom: 12, color: C.red, fontSize: 13, border: "1px solid rgba(239,68,68,.25)" }}>{err}</div>}
          {currentSession && <div style={{ padding: "10px 14px", background: "rgba(245,158,11,.08)", borderRadius: 8, marginBottom: 14, color: C.amber, fontSize: 13 }}>⚠️ You already have an active session. End it before requesting a new one.</div>}

          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>🖥️ Remote Work Registration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Computer Name / ID <span style={{ color: C.red }}>*</span></label>
                <input value={form.computerName} onChange={e => setForm({ ...form, computerName: e.target.value })} placeholder="e.g. Laptop-HP-237 or Home PC" style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Computer Specs (optional)</label>
                <input value={form.computerSpec} onChange={e => setForm({ ...form, computerSpec: e.target.value })} placeholder="e.g. Windows 11, i5, 8GB RAM" style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Work Location <span style={{ color: C.red }}>*</span></label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Home - Kigali, Nyamirambo" style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Purpose / Task <span style={{ color: C.red }}>*</span></label>
                <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} style={S.inp}>
                  <option value="">— Select purpose —</option>
                  {["Daily Report Submission", "Feeding Log Entry", "Sales Recording", "Inventory Update", "Financial Data Entry", "Health Monitoring Reports", "General Farm Management", "Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Additional Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any special requirements or context..." style={{ ...S.inp, resize: "vertical" }} />
              </div>
            </div>
            <button disabled={!!currentSession} onClick={requestSession}
              style={{ ...S.btn(currentSession ? "#374151" : C.accent), width: "100%", padding: 12, fontSize: 14, opacity: currentSession ? 0.5 : 1 }}>
              📤 Submit Remote Work Request →
            </button>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 8, textAlign: "center" }}>Your request will be reviewed and approved by the admin before your session starts.</div>
          </div>
        </div>
      )}

      {/* ── Sessions tab ── */}
      {tab === "status" && (
        <div>
          {myAll.length === 0 && (
            <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖥️</div>
              <div>No remote work sessions yet.</div>
              <div style={{ marginTop: 6 }}>Use the "New Request" tab to register your computer.</div>
            </div>
          )}
          {myAll.map((s, i) => (
            <div key={i} style={{ ...S.card, marginBottom: 10, border: "1px solid " + (s.status === "active" ? "rgba(22,163,74,.3)" : C.border) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>🖥️ {s.computerName}</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>📍 {s.location} · Requested: {s.requestedAt}</div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 20, background: STATUS_BG[s.status], color: STATUS_COLOR[s.status], fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{s.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, marginBottom: s.adminNote ? 8 : 0 }}>
                {[["Specs", s.computerSpec], ["Purpose", s.purpose], ["Approved", s.approvedAt || "—"], ["Ended", s.endedAt || "—"]].map(([l, v]) => (
                  <div key={l} style={{ background: C.elevated, borderRadius: 5, padding: "4px 8px" }}>
                    <span style={{ color: C.faint }}>{l}: </span>
                    <span style={{ color: C.text }}>{v}</span>
                  </div>
                ))}
              </div>
              {s.adminNote && (
                <div style={{ marginTop: 8, padding: "7px 10px", background: "rgba(96,165,250,.08)", borderRadius: 6, fontSize: 12, color: C.blue, border: "1px solid rgba(96,165,250,.2)" }}>
                  💬 Admin note: {s.adminNote}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
