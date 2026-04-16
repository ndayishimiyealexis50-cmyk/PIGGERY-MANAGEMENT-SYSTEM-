/**
 * BonusRequestManager.jsx
 * Migrated from index.html §14c — BONUS REQUEST MANAGER
 *
 * Workers declare extra work → admin consults → suggests amount → approves.
 * Approved bonuses auto-add to the next salary generation.
 *
 * Props:
 *   user, users, bonusRequests, setBonusRequests, salaries, setSalaries
 *
 * External deps: fsSet, uid, toDay, isAdminUser, fmtRWF
 */

import { useState } from "react";
import { C, S } from "../styles";

// ─── Stubs — replace with imports from utils.js / firebase.js ────
const toDay       = () => new Date().toISOString().slice(0, 10);
const uid         = () => Math.random().toString(36).slice(2, 10);
const isAdminUser = (u) => u?.role?.toLowerCase() === "admin";
const fmtRWF      = (n) => "RWF " + Math.round(n || 0).toLocaleString();
const fsSet       = async () => {};
// ────────────────────────────────────────────────────────────────

const BONUS_REASONS = [
  "Night duty / overnight watch",
  "Emergency care (pig giving birth)",
  "Extra weekend work",
  "Sick pig emergency response",
  "Farm cleaning extra session",
  "Market day assistance",
  "Special event / overtime",
  "Other extra work",
];

function StatusBadge({ status }) {
  const map = {
    pending:  { c: "#d97706", bg: "rgba(245,158,11,.1)",  b: "rgba(245,158,11,.3)",  l: "⏳ Pending" },
    consulted:{ c: "#2563eb", bg: "rgba(37,99,235,.1)",   b: "rgba(37,99,235,.3)",   l: "💬 Consulted" },
    approved: { c: "#16a34a", bg: "rgba(22,163,74,.1)",   b: "rgba(22,163,74,.3)",   l: "✅ Approved" },
    rejected: { c: "#dc2626", bg: "rgba(239,68,68,.1)",   b: "rgba(239,68,68,.3)",   l: "❌ Rejected" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.c, border: "1px solid " + s.b, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {s.l}
    </span>
  );
}

export default function BonusRequestManager({ user, users, bonusRequests, setBonusRequests, salaries, setSalaries }) {
  const isAdmin = isAdminUser(user);
  const [tab, setTab]       = useState(isAdmin ? "pending" : "request");
  const [toast, setToast]   = useState(null);
  const [saving, setSaving] = useState(false);

  // Admin consult modal state
  const [consultId, setConsultId] = useState(null);
  const [suggestAmt, setSuggestAmt] = useState("");
  const [adminNote, setAdminNote]   = useState("");

  // Worker request form
  const [reqForm, setReqForm] = useState({ reason: "", description: "", date: toDay(), workedHours: "" });

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3800); };

  const myRequests    = (bonusRequests || []).filter(r => r.workerId === user.uid || r.workerId === user.id);
  const pendingReqs   = (bonusRequests || []).filter(r => r.status === "pending");
  const allRequests   = (bonusRequests || []).slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  // ── Worker: submit ──────────────────────────────────────────────
  async function submitRequest() {
    if (!reqForm.reason.trim() || !reqForm.description.trim()) { showToast("Please fill in reason and description.", "error"); return; }
    setSaving(true);
    const rec = {
      id: uid(), workerId: user.uid || user.id, workerName: user.name,
      reason: reqForm.reason, description: reqForm.description,
      date: reqForm.date, workedHours: reqForm.workedHours || "",
      status: "pending", suggestedAmount: 0, adminNote: "",
      createdAt: new Date().toISOString(),
    };
    const updated = [...(bonusRequests || []), rec];
    setBonusRequests(updated);
    await fsSet("bonusRequests", updated);
    setReqForm({ reason: "", description: "", date: toDay(), workedHours: "" });
    window._addAuditLog?.("add", "Bonus request submitted by worker");
    showToast("✅ Bonus request submitted! Admin will review it.");
    setSaving(false);
  }

  // ── Admin: consult & suggest ────────────────────────────────────
  async function consultAndSuggest(id) {
    if (!suggestAmt || parseFloat(suggestAmt) <= 0) { showToast("Enter a suggested bonus amount.", "error"); return; }
    setSaving(true);
    const updated = (bonusRequests || []).map(r => r.id === id ? {
      ...r, status: "consulted", suggestedAmount: parseFloat(suggestAmt),
      adminNote, consultedAt: new Date().toISOString(), consultedBy: user.name,
    } : r);
    setBonusRequests(updated);
    await fsSet("bonusRequests", updated);
    setConsultId(null); setSuggestAmt(""); setAdminNote("");
    window._addAuditLog?.("edit", "Bonus consultation saved");
    showToast("✅ Consultation saved — bonus amount suggested to worker.");
    setSaving(false);
  }

  // ── Admin: approve ──────────────────────────────────────────────
  async function approveBonus(id, directAmount) {
    setSaving(true);
    const existing = (bonusRequests || []).find(r => r.id === id);
    let finalAmount = parseFloat(directAmount) || 0;
    if (finalAmount <= 0) finalAmount = parseFloat(existing?.suggestedAmount) || 0;
    if (finalAmount <= 0) {
      const input = window.prompt("Enter approved bonus amount (RWF):");
      finalAmount = parseFloat(input) || 0;
      if (finalAmount <= 0) { showToast("Please enter a valid bonus amount.", "error"); setSaving(false); return; }
    }
    const updated = (bonusRequests || []).map(r => r.id === id ? {
      ...r, status: "approved", suggestedAmount: finalAmount,
      approvedAt: new Date().toISOString(), approvedBy: user.name,
    } : r);
    setBonusRequests(updated);
    await fsSet("bonusRequests", updated);
    showToast(`✅ Bonus of ${fmtRWF(finalAmount)} approved! Will be added to next salary.`);
    window._addAuditLog?.("approve", `Bonus approved: ${fmtRWF(finalAmount)}`);
    setSaving(false);
    setConsultId(null); setSuggestAmt(""); setAdminNote("");
  }

  // ── Admin: reject ───────────────────────────────────────────────
  async function rejectBonus(id) {
    const reason = window.prompt("Reason for rejection (optional):") || "";
    setSaving(true);
    const updated = (bonusRequests || []).map(r => r.id === id ? {
      ...r, status: "rejected", rejectedAt: new Date().toISOString(),
      rejectedBy: user.name, rejectionReason: reason,
    } : r);
    setBonusRequests(updated);
    await fsSet("bonusRequests", updated);
    window._addAuditLog?.("reject", "Bonus request rejected");
    showToast("Bonus request rejected.");
    setSaving(false);
  }

  const tabs = isAdmin
    ? [["pending", `🔔 Pending (${pendingReqs.length})`], ["all", "📋 All Requests"]]
    : [["request", "➕ Declare Bonus"], ["mine", "📋 My Requests"]];

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9998, padding: "12px 20px", background: toast.type === "error" ? "rgba(254,242,242,.98)" : "rgba(240,253,244,.98)", border: "1px solid " + (toast.type === "error" ? "rgba(252,165,165,.8)" : "rgba(110,231,183,.8)"), borderRadius: 12, fontWeight: 700, fontSize: 13, color: toast.type === "error" ? "#dc2626" : "#065f46", boxShadow: "0 8px 30px rgba(0,0,0,.15)", backdropFilter: "blur(8px)" }}>
          {toast.msg}
        </div>
      )}

      {/* Admin: Consult modal */}
      {consultId && (() => {
        const req = (bonusRequests || []).find(r => r.id === consultId);
        if (!req) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
            onClick={e => e.target === e.currentTarget && setConsultId(null)}>
            <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 28px 70px rgba(0,0,0,.18)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>💬 Consult Bonus Request</div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>Review the worker's request and suggest an appropriate bonus amount.</div>
              <div style={{ background: C.elevated, borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid " + C.border }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>🧑‍🌾 {req.workerName} — {req.reason}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{req.description}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>📅 {req.date} {req.workedHours ? `· ⏱️ ${req.workedHours} hrs` : ""}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.lbl}>💰 Suggested Bonus Amount (RWF)</label>
                <input type="number" min="0" placeholder="e.g. 15000" value={suggestAmt} onChange={e => setSuggestAmt(e.target.value)} style={S.inp} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.lbl}>📝 Admin Note / Reason</label>
                <textarea rows={2} placeholder="e.g. Good effort during farrowing, approved as overtime bonus" value={adminNote} onChange={e => setAdminNote(e.target.value)} style={{ ...S.inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => consultAndSuggest(consultId)} disabled={saving} style={{ ...S.btn(C.blue), flex: 1, padding: "10px", fontSize: 13 }}>💬 Save Consultation</button>
                <button onClick={() => approveBonus(consultId, suggestAmt)} disabled={saving} style={{ ...S.btn(C.accent), flex: 1, padding: "10px", fontSize: 13 }}>✅ Approve Directly</button>
                <button onClick={() => setConsultId(null)} style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Banner */}
      <div style={{ background: "linear-gradient(135deg,#0c1f12 0%,#102316 55%,#0d1f10 100%)", borderRadius: 14, padding: "22px 24px", marginBottom: 18, boxShadow: "0 8px 28px rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>🌟 Bonus Requests</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 14 }}>{isAdmin ? "Review & approve worker bonus declarations" : "Declare extra work done for bonus consideration"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { l: "Pending",   v: pendingReqs.length, c: "#fbbf24" },
            { l: "Approved",  v: (bonusRequests || []).filter(r => r.status === "approved").length, c: "#4ade80" },
            { l: "Total",     v: (bonusRequests || []).length, c: "rgba(255,255,255,.6)" },
          ].map(x => (
            <div key={x.l} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 80 }}>
              <div style={{ fontSize: 9, color: x.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{x.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 16, gap: 3, border: "1px solid #e2e8f0" }}>
        {tabs.map(([t, l]) => <button key={t} onClick={() => setTab(t)} style={{ ...S.tab(tab === t), flex: 1, borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>{l}</button>)}
      </div>

      {/* ── Worker: request form ── */}
      {!isAdmin && tab === "request" && (
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>🌟 Declare Extra Work for Bonus</div>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>Did you do extra work? Declare it here and admin will review and approve a bonus amount.</div>

          <div style={{ marginBottom: 12 }}>
            <label style={S.lbl}>Type of Extra Work</label>
            <select value={reqForm.reason} onChange={e => setReqForm(f => ({ ...f, reason: e.target.value }))} style={S.inp}>
              <option value="">— Select reason —</option>
              {BONUS_REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.lbl}>Description (what you did, when, why)</label>
            <textarea rows={3} placeholder="e.g. Stayed the whole night from 9pm to 6am while sow RW-001 was giving birth. Helped deliver 11 piglets safely." value={reqForm.description} onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))} style={{ ...S.inp, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={S.lbl}>Date of Extra Work</label>
              <input type="date" value={reqForm.date} onChange={e => setReqForm(f => ({ ...f, date: e.target.value }))} style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>Hours Worked (optional)</label>
              <input type="number" min="0" max="24" placeholder="e.g. 9" value={reqForm.workedHours} onChange={e => setReqForm(f => ({ ...f, workedHours: e.target.value }))} style={S.inp} />
            </div>
          </div>

          <div style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 9, padding: "10px 14px", fontSize: 12, color: "#6366f1", marginBottom: 14 }}>
            💡 <strong>Note:</strong> You do not set the bonus amount — admin will review your request and suggest a fair amount based on the work done.
          </div>

          <button onClick={submitRequest} disabled={saving || !reqForm.reason || !reqForm.description}
            style={{ ...S.btn("#6366f1"), width: "100%", padding: "11px", fontSize: 14, opacity: (!reqForm.reason || !reqForm.description) ? 0.5 : 1 }}>
            {saving ? "Submitting…" : "🌟 Submit Bonus Request"}
          </button>
        </div>
      )}

      {/* ── Worker: my requests ── */}
      {!isAdmin && tab === "mine" && (
        <div>
          {myRequests.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 32, color: C.faint }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌟</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No bonus requests yet</div>
              <div style={{ fontSize: 12 }}>Use the "Declare Bonus" tab to submit your first request.</div>
            </div>
          ) : myRequests.slice().reverse().map(r => (
            <div key={r.id} style={{ ...S.card, borderLeft: "4px solid " + (r.status === "approved" ? C.accent : r.status === "rejected" ? C.red : r.status === "consulted" ? C.blue : C.amber) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.reason}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ${r.workedHours} hrs` : ""}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>{r.description}</div>

              {r.status === "consulted" && (
                <div style={{ background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: C.blue, marginBottom: 3 }}>💬 Admin is reviewing your request</div>
                  {r.adminNote && <div style={{ color: C.muted, marginTop: 3 }}>Note: <em>{r.adminNote}</em></div>}
                  <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>The bonus amount will be added to your salary once approved.</div>
                </div>
              )}
              {r.status === "approved" && (
                <div style={{ background: "rgba(22,163,74,.06)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: C.accent }}>✅ Bonus Approved — {fmtRWF(r.suggestedAmount)}</div>
                  {r.adminNote && <div style={{ color: C.muted, marginTop: 3 }}>Admin note: <em>{r.adminNote}</em></div>}
                </div>
              )}
              {r.status === "rejected" && (
                <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.red }}>
                  ❌ Rejected{r.rejectionReason ? ` — ${r.rejectionReason}` : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Admin: pending ── */}
      {isAdmin && tab === "pending" && (
        <div>
          {pendingReqs.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 32, color: C.faint }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No pending bonus requests</div>
              <div style={{ fontSize: 12 }}>All worker bonus requests have been reviewed.</div>
            </div>
          ) : pendingReqs.map(r => (
            <div key={r.id} style={{ ...S.card, borderLeft: "4px solid " + C.amber }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🧑‍🌾 {r.workerName}</div>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{r.reason}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ⏱️ ${r.workedHours} hrs` : ""} · Submitted {r.createdAt?.slice(0, 10)}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, background: C.elevated, padding: "10px 12px", borderRadius: 8, marginBottom: 12, border: "1px solid " + C.border }}>
                "{r.description}"
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { setConsultId(r.id); setSuggestAmt(""); setAdminNote(""); }} style={{ ...S.btn(C.blue), fontSize: 12, padding: "7px 13px" }}>💬 Consult &amp; Suggest Amount</button>
                <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 12, padding: "7px 13px" }}>✅ Approve</button>
                <button onClick={() => rejectBonus(r.id)} style={{ ...S.btn(C.red), fontSize: 12, padding: "7px 13px" }}>❌ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Admin: all requests ── */}
      {isAdmin && tab === "all" && (
        <div>
          {allRequests.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 24, color: C.faint, fontSize: 13 }}>No bonus requests yet.</div>
          ) : allRequests.map(r => (
            <div key={r.id} style={{ ...S.card, borderLeft: "4px solid " + (r.status === "approved" ? C.accent : r.status === "rejected" ? C.red : r.status === "consulted" ? C.blue : C.amber) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.workerName} — {r.reason}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ${r.workedHours} hrs` : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <StatusBadge status={r.status} />
                  {r.suggestedAmount > 0 && <span style={{ fontWeight: 700, color: C.accent, fontSize: 12 }}>{fmtRWF(r.suggestedAmount)}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: r.status === "pending" ? 10 : 0 }}>{r.description}</div>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button onClick={() => { setConsultId(r.id); setSuggestAmt(""); setAdminNote(""); }} style={{ ...S.btn(C.blue), fontSize: 11, padding: "5px 11px" }}>💬 Consult</button>
                  <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 11, padding: "5px 11px" }}>✅ Approve</button>
                  <button onClick={() => rejectBonus(r.id)} style={{ ...S.btn(C.red), fontSize: 11, padding: "5px 11px" }}>❌ Reject</button>
                </div>
              )}
              {r.status === "consulted" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 11, padding: "5px 11px" }}>✅ Approve Now</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
