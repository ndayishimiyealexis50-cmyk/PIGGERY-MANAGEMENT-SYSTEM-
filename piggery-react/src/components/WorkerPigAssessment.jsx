/**
 * WorkerPigAssessment.jsx
 * Migrated from index.html §13 WORKER PIG ASSESSMENT
 *
 * Props: user, pigs, assessments, setAssessments
 *
 * External deps:
 *   fsSet(key, value)
 *   getOnlineFarmData()
 *   setOnlineFarmData(patch)
 *   toDay()
 *   uid()
 */

import { useState } from "react";
import { C, S } from "../styles";

// ─── Stubs — replace with imports from utils.js ─────────────────
const toDay = () => new Date().toISOString().slice(0, 10);
const uid   = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fsSet = async () => {};
const getOnlineFarmData  = async () => ({});
const setOnlineFarmData  = async () => {};
// ────────────────────────────────────────────────────────────────

function ConfirmDialog({ title, body, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{body}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onConfirm} style={{ ...S.btn(C.accent), flex: 1, padding: 10 }}>Submit</button>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, padding: "10px 18px", borderRadius: 10, background: type === "error" ? "#dc2626" : "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.2)", cursor: "pointer" }} onClick={onClose}>
      {message}
    </div>
  );
}

const BCS_DESC = {
  "1": "Emaciated — ribs & spine very prominent",
  "2": "Thin — ribs easily felt",
  "3": "Ideal — slight fat cover",
  "4": "Fat — ribs hard to feel",
  "5": "Obese — fat deposits visible",
};

export default function WorkerPigAssessment({ user, pigs, assessments, setAssessments }) {
  const active = pigs.filter(p => p.status === "active");
  const [tab, setTab] = useState("form");
  const [rows, setRows] = useState(() =>
    active.map(p => ({ pigId: p.id, tag: p.tag, breed: p.breed, stage: p.stage, currentWeight: p.weight, weight: "", length: "", bcs: "3", notes: "", done: false }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [toast, setToast]   = useState(null);
  const [confirm, setConfirm] = useState(false);

  const myHistory = (assessments || []).filter(a => a.workerId === user.id).slice().reverse();
  const pending   = myHistory.filter(a => a.approved === false);

  const thisWeek = () => {
    const d = new Date();
    const mon = new Date(d);
    mon.setDate(d.getDate() - d.getDay() + 1);
    return mon.toISOString().slice(0, 10);
  };
  const weekStart = thisWeek();
  const alreadyThisWeek = myHistory.some(a => a.weekStart === weekStart);

  function updateRow(pigId, field, val) {
    setRows(r => r.map(x => x.pigId === pigId ? { ...x, [field]: val, done: !!(x.weight || (field === "weight" && val)) } : x));
  }

  const filledCount = rows.filter(r => r.weight).length;
  const allFilled   = filledCount === rows.length && rows.length > 0;

  async function submit() {
    setConfirm(false); setSaving(true);
    const batch = rows.filter(r => r.weight).map(r => ({
      id: uid(), pigId: r.pigId, pigTag: r.tag, pigBreed: r.breed, pigStage: r.stage,
      prevWeight: r.currentWeight, weight: parseFloat(r.weight) || r.currentWeight,
      length: r.length ? parseFloat(r.length) : null, bcs: parseInt(r.bcs) || 3,
      notes: r.notes || "", workerId: user.id, worker: user.name,
      date: toDay(), weekStart, approved: false, submittedAt: new Date().toISOString(),
    }));
    const updated = [...(assessments || []), ...batch];
    setAssessments(updated);
    fsSet("assessments", updated);
    try {
      const data = await getOnlineFarmData() || {};
      await setOnlineFarmData({ ...data, assessments: updated });
      setToast({ type: "success", message: `✅ ${batch.length} pig assessment${batch.length > 1 ? "s" : ""} submitted! Awaiting admin approval.` });
      setSaved(true);
    } catch {
      setToast({ type: "error", message: "Saved locally. Sync failed — check internet." });
      setSaved(true);
    }
    setSaving(false);
  }

  if (saved) return (
    <div style={{ textAlign: "center", padding: 60, maxWidth: 460, margin: "0 auto" }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>📏</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: C.accent, marginBottom: 6 }}>Assessment Submitted!</div>
      <div style={{ fontSize: 13, color: C.faint, marginBottom: 20 }}>The farm owner will review and approve your measurements. Once approved, pig weights will be updated automatically.</div>
      <button onClick={() => { setSaved(false); setTab("history"); }} style={S.btn(C.accent)}>📋 View My Submissions →</button>
    </div>
  );

  return (
    <div className="fade-in">
      {confirm && <ConfirmDialog title="Submit Weekly Assessment?" body={`You're submitting measurements for ${filledCount} pig(s). Unmeasured pigs will be skipped. Submit now?`} onConfirm={submit} onCancel={() => setConfirm(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={S.h1}>📏 Weekly Pig Assessment</div>
      <div style={S.sub}>Measure weight &amp; length for each pig — submitted for admin approval</div>

      {alreadyThisWeek && (
        <div style={{ padding: "10px 14px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 9, marginBottom: 14, fontSize: 13, color: C.amber }}>
          ⚠️ You already submitted an assessment this week ({weekStart}). You can submit again if measurements were missed or corrected.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: "1px solid " + C.border }}>
        {[["form", "📝 New Assessment"], ["history", "📋 My History"]].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── Form tab ── */}
      {tab === "form" && (
        <div>
          {/* Progress */}
          <div style={{ ...S.card, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: C.text }}>Progress: {filledCount}/{rows.length} pigs measured</span>
              <span style={{ color: allFilled ? C.accent : C.amber }}>{allFilled ? "✅ All done!" : "⏳ In progress"}</span>
            </div>
            <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: (rows.length > 0 ? filledCount / rows.length * 100 : 0) + "%", background: allFilled ? C.accent : "#f59e0b", borderRadius: 4, transition: "width .4s" }} />
            </div>
          </div>

          <div style={{ ...S.card, background: "rgba(37,99,235,.04)", border: "1px solid rgba(37,99,235,.2)", padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.muted }}>
            📐 <b>Weight:</b> Use a weighing scale (kg) &nbsp;|&nbsp; 📏 <b>Length:</b> Measure from snout tip to tail base (cm) &nbsp;|&nbsp; 🔢 <b>BCS:</b> Body Condition Score 1–5
          </div>

          {rows.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}>No active pigs found. Ask admin to add pigs first.</div>}

          {rows.map(r => (
            <div key={r.pigId} style={{ ...S.card, marginBottom: 10, borderLeft: "4px solid " + (r.weight ? C.accent : C.border) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>🐷 {r.tag}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{r.breed} · {r.stage} · Current: <b>{r.currentWeight}kg</b></div>
                </div>
                {r.weight && <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 20, background: "rgba(22,163,74,.1)", color: C.accent, fontWeight: 700 }}>✓ Measured</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={S.lbl}>⚖️ Weight (kg) *</label>
                  <input type="number" min="1" max="500" step="0.1" value={r.weight} onChange={e => updateRow(r.pigId, "weight", e.target.value)} placeholder={r.currentWeight} style={{ ...S.inp, borderColor: r.weight ? "rgba(22,163,74,.5)" : undefined }} />
                </div>
                <div>
                  <label style={S.lbl}>📏 Length (cm)</label>
                  <input type="number" min="20" max="250" step="0.5" value={r.length} onChange={e => updateRow(r.pigId, "length", e.target.value)} placeholder="e.g. 95" style={S.inp} />
                </div>
                <div>
                  <label style={S.lbl}>🔢 BCS (1–5)</label>
                  <select value={r.bcs} onChange={e => updateRow(r.pigId, "bcs", e.target.value)} style={S.inp}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              {r.bcs && <div style={{ fontSize: 11, color: C.faint, marginBottom: 6, padding: "4px 8px", background: C.elevated, borderRadius: 5 }}>BCS {r.bcs}: {BCS_DESC[r.bcs]}</div>}
              {r.weight && r.currentWeight && (() => {
                const gain = parseFloat(r.weight) - r.currentWeight;
                return <div style={{ fontSize: 11, color: gain > 0 ? C.accent : gain < 0 ? C.red : C.muted, marginBottom: 6 }}>
                  {gain > 0 ? "📈" : gain === 0 ? "➡️" : "📉"} Weight change: <b>{gain > 0 ? "+" : ""}{gain.toFixed(1)}kg</b>
                </div>;
              })()}
              <div>
                <label style={S.lbl}>📝 Notes (optional)</label>
                <input value={r.notes} onChange={e => updateRow(r.pigId, "notes", e.target.value)} placeholder="Any observations, injuries, behavior changes..." style={S.inp} />
              </div>
            </div>
          ))}

          {rows.length > 0 && (
            <div style={{ position: "sticky", bottom: 16, zIndex: 10 }}>
              <button onClick={() => filledCount > 0 && setConfirm(true)} disabled={saving || filledCount === 0}
                style={{ ...S.btn(filledCount > 0 ? C.accent : "#94a3b8"), width: "100%", padding: 13, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(22,163,74,.35)", opacity: filledCount === 0 ? 0.5 : 1 }}>
                {saving ? "Submitting…" : `📤 Submit Assessment (${filledCount}/${rows.length} pigs)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div>
          {myHistory.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}>No assessments submitted yet.</div>}
          {pending.length > 0 && (
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 9, marginBottom: 12, fontSize: 13, color: C.amber }}>
              ⏳ {pending.length} assessment(s) awaiting admin approval
            </div>
          )}
          {Object.entries(
            myHistory.reduce((acc, a) => { const k = a.weekStart || a.date; if (!acc[k]) acc[k] = []; acc[k].push(a); return acc; }, {})
          ).map(([week, items]) => (
            <div key={week} style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>📅 Week of {week}</div>
                <span style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 700,
                  background: items.some(a => a.approved === false) ? "rgba(245,158,11,.1)" : "rgba(22,163,74,.1)",
                  color: items.some(a => a.approved === false) ? C.amber : C.accent,
                }}>
                  {items.some(a => a.approved === false) ? "⏳ Pending" : "✅ Approved"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                {items.map(a => (
                  <div key={a.id} style={{ background: C.elevated, borderRadius: 8, padding: "8px 10px", border: "1px solid " + C.border }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: C.text }}>🐷 {a.pigTag}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>⚖️ {a.weight}kg {a.length ? "· 📏 " + a.length + "cm" : ""}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>BCS {a.bcs} · {a.date}</div>
                    {a.notes && <div style={{ fontSize: 10, color: C.faint, marginTop: 3, fontStyle: "italic" }}>{a.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
