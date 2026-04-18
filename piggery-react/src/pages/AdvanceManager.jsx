import { C, S } from '../utils/constants';
import { useState } from "react";
import { uid, toDay, fmtRWF } from "../utils/helpers";
import { fsSet } from "../lib/firestore";
import { capitalTx } from "../utils/capitalUtils";

const ADVANCE_REASONS = ["Medical Emergency", "School Fees", "Rent", "Travel", "Family Emergency", "Other"];
const ADVANCE_MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function AdvanceManager({ user, users, advances, setAdvances, salaries, setSalaries, expenses, setExpenses, capital, setCapital }) {
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const now = new Date();

  const [tab, setTab] = useState(isAdmin ? "pending" : "request");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const defForm = {
    amount: "", reason: ADVANCE_REASONS[0], notes: "",
    repayMonth: String(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2),
    repayYear:  String(now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()),
  };
  const [form, setForm] = useState(defForm);

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3800); }

  const myAdvances  = (advances || []).filter(a => a.workerId === user.uid || a.workerId === user.id);
  const allPending  = (advances || []).filter(a => a.status === "pending");
  const allApproved = (advances || []).filter(a => a.status === "approved");
  const allRejected = (advances || []).filter(a => a.status === "rejected");

  async function submitRequest() {
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast("Enter a valid advance amount.", "error"); return; }
    setSaving(true);
    const rec = {
      id: uid(),
      workerId: user.uid || user.id,
      workerName: user.name,
      amount: parseFloat(form.amount),
      reason: form.reason,
      notes: form.notes,
      repayMonth: parseInt(form.repayMonth),
      repayYear: parseInt(form.repayYear),
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    const updated = [...(advances || []), rec];
    setAdvances(updated);
    try { await fsSet("advances", updated); } catch (e) {}
    showToast("✅ Advance request submitted! Admin will review it shortly.");
    window._addAuditLog?.("add", `Advance requested: ${fmtRWF(parseFloat(form.amount))} — ${form.reason || "no reason"}`);
    setForm(defForm);
    setTab("mylist");
    setSaving(false);
  }

  async function approve(id) {
    const adv = (advances || []).find(a => a.id === id);
    if (!adv) return;
    const approvedAt = toDay();
    const updatedAdv = (advances || []).map(a => a.id === id ? { ...a, status: "approved", approvedAt: new Date().toISOString(), approvedBy: user.name } : a);
    setAdvances(updatedAdv);
    try { await fsSet("advances", updatedAdv); } catch (e) {}
    const refId = "advance_" + id;
    const alreadyRecorded = (expenses || []).some(e => e.refAdvanceId === id || e.source === "advance_approval_" + id);
    if (!alreadyRecorded) {
      const desc = `Salary Advance — ${adv.workerName} (${adv.reason})`;
      const expRec = {
        id: uid(), workerId: user.uid || user.id, worker: user.name,
        category: "Salary Advance", description: desc, amount: adv.amount,
        date: approvedAt, source: "advance_approval_" + id, refAdvanceId: id, approved: true,
      };
      const updatedExp = [...(expenses || []), expRec];
      if (setExpenses) setExpenses(updatedExp);
      try { await fsSet("expenses", updatedExp); } catch (e) {}
      if (capital && setCapital) capitalTx(capital, setCapital, { type: "expense", category: "Salary Advance", amount: adv.amount, description: desc, date: approvedAt, refId });
    }
    showToast(`✅ Advance of ${fmtRWF(adv.amount)} approved for ${adv.workerName} — expense recorded`);
    window._addAuditLog?.("approve", `Advance approved: ${fmtRWF(adv.amount)} for ${adv.workerName}`);
  }

  async function reject(id, reason) {
    const adv = (advances || []).find(a => a.id === id);
    if (!adv) return;
    const updated = (advances || []).map(a => a.id === id ? { ...a, status: "rejected", rejectedAt: new Date().toISOString(), rejectedBy: user.name, rejectionReason: reason || "Not approved" } : a);
    setAdvances(updated);
    try { await fsSet("advances", updated); } catch (e) {}
    showToast(`❌ Advance rejected for ${adv.workerName}`, "error");
    window._addAuditLog?.("reject", `Advance rejected for ${adv.workerName} — ${adv.amount ? fmtRWF(adv.amount) : ""}`);
  }

  async function deleteAdvance(id) {
    if (!window.confirm("Delete this advance record?")) return;
    const _adv = (advances || []).find(a => a.id === id);
    const updated = (advances || []).filter(x => x.id !== id);
    setAdvances(updated);
    fsSet("advances", updated);
    window._addAuditLog?.("delete", `Advance deleted: ${_adv?.workerName} ${_adv ? fmtRWF(_adv.amount) : ""}`);
  }

  const statusBadge = (s) => {
    if (s === "pending")  return <span className="status-pending">⏳ Pending</span>;
    if (s === "approved") return <span className="status-paid">✅ Approved</span>;
    return <span className="status-overdue">❌ Rejected</span>;
  };

  const adminTabs  = [["pending", "⏳ Pending (" + allPending.length + ")"], ["approved", "✅ Approved"], ["rejected", "❌ Rejected"], ["all", "📋 All"]];
  const workerTabs = [["request", "💸 Request Advance"], ["mylist", "📋 My Requests"]];
  const tabs = isAdmin ? adminTabs : workerTabs;
  const listToShow = isAdmin ? (tab === "pending" ? allPending : tab === "approved" ? allApproved : tab === "rejected" ? allRejected : (advances || [])) : myAdvances;

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9998, padding: "12px 20px", background: toast.type === "error" ? "rgba(254,242,242,.98)" : "rgba(240,253,244,.98)", border: "1px solid " + (toast.type === "error" ? "rgba(252,165,165,.8)" : "rgba(110,231,183,.8)"), borderRadius: 12, fontWeight: 700, fontSize: 13, color: toast.type === "error" ? "#dc2626" : "#065f46", boxShadow: "0 8px 30px rgba(0,0,0,.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header banner */}
      <div style={{ background: "linear-gradient(135deg,#0c1f18 0%,#122d20 55%,#0e2218 100%)", borderRadius: 14, padding: "22px 24px", marginBottom: 18, position: "relative", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.2)" }}>
        <div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, background: "radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>💸 Salary Advance</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{isAdmin ? "Review and manage worker advance requests" : "Request an advance on your salary"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[{ l: "Pending", v: allPending.length, c: "#fbbf24" }, { l: "Approved", v: allApproved.length, c: "#4ade80" }, { l: "Rejected", v: allRejected.length, c: "#f87171" }].map(x => (
              <div key={x.l} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 70 }}>
                <div style={{ fontSize: 9, color: x.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{x.l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: x.c }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 18, gap: 3, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.tab(tab === t), flex: 1, borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>{l}</button>
        ))}
      </div>

      {/* Worker: Request Form */}
      {!isAdmin && tab === "request" && (
        <div style={{ maxWidth: 540 }}>
          <div style={{ ...S.card, border: "1px solid rgba(99,102,241,.2)", background: "linear-gradient(135deg,rgba(99,102,241,.04),rgba(124,58,237,.02))" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6366f1", marginBottom: 4 }}>💸 Request Salary Advance</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 18 }}>Your request will be reviewed by the admin. Approved advances are deducted from your future salary.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>💵 Advance Amount (RWF) *</label>
                <input type="number" min="0" placeholder="e.g. 30000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>📋 Reason for Advance *</label>
                <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={S.inp}>
                  {ADVANCE_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>📅 Repay from Month</label>
                <select value={form.repayMonth} onChange={e => setForm({ ...form, repayMonth: e.target.value })} style={S.inp}>
                  {ADVANCE_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Year</label>
                <input type="number" min="2024" max="2030" value={form.repayYear} onChange={e => setForm({ ...form, repayYear: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>📝 Additional Notes (optional)</label>
                <textarea rows={2} placeholder="Any extra details for the admin…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...S.inp, resize: "vertical" }} />
              </div>
            </div>
            {form.amount && parseFloat(form.amount) > 0 && (
              <div style={{ padding: "12px 16px", background: "rgba(99,102,241,.07)", border: "1.5px solid rgba(99,102,241,.2)", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 6 }}>📄 Request Preview</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>Advance Amount</span>
                  <span style={{ fontWeight: 700, color: "#6366f1" }}>{fmtRWF(parseFloat(form.amount) || 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.faint }}>
                  <span>Repayment target</span>
                  <span>{ADVANCE_MONTHS[(parseInt(form.repayMonth) || 1) - 1]} {form.repayYear}</span>
                </div>
              </div>
            )}
            <button onClick={submitRequest} disabled={saving || !form.amount || parseFloat(form.amount) <= 0}
              style={{ ...S.btn("#6366f1"), width: "100%", padding: 13, fontSize: 14, fontWeight: 700, opacity: saving || !form.amount ? 0.55 : 1 }}>
              {saving ? "⏳ Submitting…" : "💸 Submit Advance Request →"}
            </button>
          </div>
        </div>
      )}

      {/* Worker: My Requests */}
      {!isAdmin && tab === "mylist" && (
        <div>
          {myAdvances.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💸</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>No advance requests yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Use the "Request Advance" tab to apply.</div>
            </div>
          )}
          {myAdvances.slice().reverse().map(a => (
            <div key={a.id} className="card-hover" style={{ ...S.card, marginBottom: 10, borderLeft: "4px solid " + (a.status === "approved" ? C.accent : a.status === "rejected" ? C.red : C.amber) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{fmtRWF(a.amount)}</span>
                    {statusBadge(a.status)}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>📋 {a.reason}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>Requested: {a.requestedAt?.slice(0, 10)} · Repay: {ADVANCE_MONTHS[(a.repayMonth || 1) - 1]} {a.repayYear}</div>
                  {a.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic" }}>📝 "{a.notes}"</div>}
                  {a.status === "approved" && <div style={{ fontSize: 11, color: C.accent, marginTop: 4 }}>✅ Approved on {a.approvedAt?.slice(0, 10)} by {a.approvedBy}</div>}
                  {a.status === "rejected" && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>❌ Rejected: {a.rejectionReason || "Not approved"}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin: Lists */}
      {isAdmin && (tab === "pending" || tab === "approved" || tab === "rejected" || tab === "all") && (
        <div>
          {listToShow.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{tab === "pending" ? "⏳" : "📋"}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{tab === "pending" ? "No pending advance requests" : "No records in this category"}</div>
            </div>
          )}
          {listToShow.slice().reverse().map(a => (
            <AdvanceAdminCard
              key={a.id}
              adv={a}
              onApprove={() => approve(a.id)}
              onReject={(r) => reject(a.id, r)}
              onDelete={isAdmin ? () => deleteAdvance(a.id) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
