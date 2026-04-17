import { fsSet } from '../lib/firestore';
import { useState, useEffect } from "react";
import { C, S } from "../styles/theme.js";
import { uid, toDay, fmtRWF } from "../lib/utils.js";
import { db } from "../lib/firebase.js";
import { capitalTx } from "../utils/capitalUtils.js";

const SALARY_METHODS  = ["Mobile Money (MoMo)", "Cash", "Bank Transfer", "Cheque"];
const SALARY_PERIODS  = ["Monthly", "Bi-Weekly", "Weekly"];
const MONTHS_LBL      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DEDUCTION_TYPES = ["Advance Repayment","Absence (days)","Late Arrival","Damage / Loss","Tax","Custom Deduction"];
const BONUS_TYPES     = ["Performance Bonus","Attendance Bonus","Overtime","Commission","End of Month Bonus","Custom Bonus"];

function calcNetPay(gross, deductions = [], bonuses = []) {
  const g      = parseFloat(gross) || 0;
  const totalBonus  = bonuses.reduce((s, b)  => s + (parseFloat(b.amount)  || 0), 0);
  const totalDeduct = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const subtotal = g + totalBonus;
  const net      = Math.max(0, subtotal - totalDeduct);
  return { gross: g, totalBonus, totalDeduct, subtotal, net };
}

export default function SalaryManager({ user, users, salaries, setSalaries, expenses, setExpenses, capital, setCapital, bonusRequests, setBonusRequests, salaryConfigs, setSalaryConfigs, advances }) {
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const now = new Date();

  const [tab, setTab]               = useState(isAdmin ? "overview" : "history");
  const [toast, setToast]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [confirmId, setConfirmId]   = useState(null);
  const [viewPayslip, setViewPayslip] = useState(null);
  const [editId, setEditId]         = useState(null);
  const [configForm, setConfigForm] = useState({ workerId: "", grossSalary: "", notes: "" });
  const [configSaving, setConfigSaving] = useState(false);

  const defForm = {
    workerId: "", workerName: "", amount: "", period: "Monthly",
    month: String(now.getMonth() + 1), year: String(now.getFullYear()),
    dueDate: toDay(), method: "Mobile Money (MoMo)", notes: "",
    deductions: [], bonuses: [],
  };
  const [form, setForm] = useState(defForm);

  function addDeduction()   { setForm(f => ({ ...f, deductions: [...f.deductions, { id: uid(), type: "Custom Deduction", label: "", amount: "" }] })); }
  function addBonus()       { setForm(f => ({ ...f, bonuses:    [...f.bonuses,    { id: uid(), type: "Custom Bonus",     label: "", amount: "" }] })); }
  function updateDeduction(id, field, val) { setForm(f => ({ ...f, deductions: f.deductions.map(d => d.id === id ? { ...d, [field]: val } : d) })); }
  function updateBonus(id, field, val)     { setForm(f => ({ ...f, bonuses:    f.bonuses.map(b    => b.id === id ? { ...b, [field]: val } : b) })); }
  function removeDeduction(id) { setForm(f => ({ ...f, deductions: f.deductions.filter(d => d.id !== id) })); }
  function removeBonus(id)     { setForm(f => ({ ...f, bonuses:    f.bonuses.filter(b    => b.id !== id) })); }

  const workers = users.filter(u => u.role === "worker" && u.approved);

  function getWorkerConfig(workerId) { return (salaryConfigs || []).find(c => c.workerId === workerId) || null; }

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3800); }

  /* ── Save salary config ── */
  async function saveConfig() {
    if (!configForm.workerId || !configForm.grossSalary || parseFloat(configForm.grossSalary) <= 0) {
      showToast("Select a worker and enter their monthly gross salary.", "error"); return;
    }
    setConfigSaving(true);
    const worker   = workers.find(w => w.uid === configForm.workerId || w.id === configForm.workerId);
    const existing = (salaryConfigs || []).find(c => c.workerId === configForm.workerId);
    const updated  = existing
      ? (salaryConfigs || []).map(c => c.workerId === configForm.workerId ? { ...c, grossSalary: parseFloat(configForm.grossSalary), notes: configForm.notes, updatedAt: new Date().toISOString(), updatedBy: user.name } : c)
      : [...(salaryConfigs || []), { id: uid(), workerId: configForm.workerId, workerName: worker?.name || "", grossSalary: parseFloat(configForm.grossSalary), notes: configForm.notes, createdAt: new Date().toISOString(), createdBy: user.name, updatedAt: new Date().toISOString(), updatedBy: user.name }];
    if (setSalaryConfigs) setSalaryConfigs(updated);
    await fsSet("salaryConfigs", updated);
    setConfigForm({ workerId: "", grossSalary: "", notes: "" });
    showToast(`✅ Monthly salary of ${fmtRWF(parseFloat(configForm.grossSalary))} set for ${worker?.name || "worker"}.`);
    window._addAuditLog?.("edit", `Salary config set: ${fmtRWF(parseFloat(configForm.grossSalary))}/month for ${worker?.name || "worker"}`);
    setConfigSaving(false);
  }

  /* ── Auto-generate on 25th ── */
  useEffect(() => {
    if (!isAdmin || !salaryConfigs?.length) return;
    const today    = new Date();
    if (today.getDate() !== 25) return;
    const thisMonth = today.getMonth() + 1;
    const thisYear  = today.getFullYear();

    (salaryConfigs || []).forEach(async config => {
      const alreadyExists = (salaries || []).some(s => s.workerId === config.workerId && s.month === thisMonth && s.year === thisYear);
      if (alreadyExists) return;
      const approvedBonuses = (bonusRequests || []).filter(r => r.workerId === config.workerId && r.status === "approved" && !r.addedToSalaryId);
      const bonusItems      = approvedBonuses.map(r => ({ id: uid(), type: "Approved Bonus", label: r.reason, amount: r.suggestedAmount || 0, bonusRequestId: r.id }));
      const pendingAdvances = (advances || []).filter(a => a.workerId === config.workerId && a.status === "approved" && !a.deductedInSalaryId);
      const advanceDeductions = pendingAdvances.map(a => ({ id: uid(), type: "Salary Advance Deduction", label: `Advance: ${a.reason || "Salary advance"}`, amount: a.amount || 0, advanceId: a.id }));
      const { gross, totalBonus, totalDeduct, subtotal, net } = calcNetPay(config.grossSalary, advanceDeductions, bonusItems);
      const rec = {
        id: uid(), workerId: config.workerId, workerName: config.workerName || config.workerId,
        gross, deductions: advanceDeductions, bonuses: bonusItems,
        totalBonus, totalDeduct, subtotal, net, amount: net,
        period: "Monthly", month: thisMonth, year: thisYear,
        dueDate: `${thisYear}-${String(thisMonth).padStart(2, "0")}-25`,
        method: "Mobile Money (MoMo)", notes: "Auto-generated on 25th",
        status: "pending", autoGenerated: true, createdAt: new Date().toISOString(), scheduledBy: "System (Auto)",
        approvedBonusIds: approvedBonuses.map(r => r.id),
        pendingAdvanceIds: pendingAdvances.map(a => a.id),
      };
      const updSalaries = [...(salaries || []), rec];
      setSalaries(updSalaries);
      await fsSet("salaries", updSalaries);
      if (approvedBonuses.length > 0 && setBonusRequests) {
        const updBonuses = (bonusRequests || []).map(r => approvedBonuses.find(ab => ab.id === r.id) ? { ...r, addedToSalaryId: rec.id } : r);
        setBonusRequests(updBonuses); await fsSet("bonusRequests", updBonuses);
      }
    });
  }, [isAdmin, salaryConfigs?.length, workers.length]);

  /* ── Manual generate ── */
  async function triggerAutoGenerate() {
    if (!salaryConfigs?.length) { showToast("No salary configs set. Set monthly salaries first in Salary Config tab.", "error"); return; }
    const today     = new Date();
    const thisMonth = today.getMonth() + 1;
    const thisYear  = today.getFullYear();
    let generated = 0, skipped = 0;
    setSaving(true);
    let updSalaries = [...(salaries || [])];
    let updBonuses  = [...(bonusRequests || [])];
    for (const config of (salaryConfigs || [])) {
      const alreadyExists = updSalaries.some(s => s.workerId === config.workerId && s.month === thisMonth && s.year === thisYear);
      if (alreadyExists) { skipped++; continue; }
      const approvedBonuses   = updBonuses.filter(r => r.workerId === config.workerId && r.status === "approved" && !r.addedToSalaryId);
      const bonusItems        = approvedBonuses.map(r => ({ id: uid(), type: "Approved Bonus", label: r.reason, amount: r.suggestedAmount || 0, bonusRequestId: r.id }));
      const pendingAdvances   = (advances || []).filter(a => a.workerId === config.workerId && a.status === "approved" && !a.deductedInSalaryId);
      const advanceDeductions = pendingAdvances.map(a => ({ id: uid(), type: "Salary Advance Deduction", label: `Advance: ${a.reason || "Salary advance"}`, amount: a.amount || 0, advanceId: a.id }));
      const { gross, totalBonus, totalDeduct, subtotal, net } = calcNetPay(config.grossSalary, advanceDeductions, bonusItems);
      const rec = {
        id: uid(), workerId: config.workerId, workerName: config.workerName || "",
        gross, deductions: advanceDeductions, bonuses: bonusItems,
        totalBonus, totalDeduct, subtotal, net, amount: net,
        period: "Monthly", month: thisMonth, year: thisYear,
        dueDate: `${thisYear}-${String(thisMonth).padStart(2, "0")}-25`,
        method: "Mobile Money (MoMo)", notes: "Admin-triggered generation",
        status: "pending", autoGenerated: true, createdAt: new Date().toISOString(), scheduledBy: "Admin (Manual Trigger)",
        approvedBonusIds: approvedBonuses.map(r => r.id),
      };
      updSalaries = [...updSalaries, rec];
      if (approvedBonuses.length > 0) updBonuses = updBonuses.map(r => approvedBonuses.find(ab => ab.id === r.id) ? { ...r, addedToSalaryId: rec.id } : r);
      generated++;
    }
    setSalaries(updSalaries); await fsSet("salaries", updSalaries);
    if (setBonusRequests) { setBonusRequests(updBonuses); await fsSet("bonusRequests", updBonuses); }
    window._addAuditLog?.("add", `Auto-generated ${generated} salary record(s)`);
    showToast(`✅ Generated ${generated} salary record(s). ${skipped} already existed. Awaiting your approval.`);
    setSaving(false); setTab("history");
  }

  async function approveGeneratedSalary(salId) {
    setSaving(true);
    const updated = (salaries || []).map(s => s.id === salId ? { ...s, adminApproved: true, adminApprovedAt: new Date().toISOString(), adminApprovedBy: user.name } : s);
    setSalaries(updated); await fsSet("salaries", updated);
    const appSal = (salaries || []).find(s => s.id === salId);
    showToast("✅ Salary approved! Worker can now see their approved salary.");
    window._addAuditLog?.("approve", `Salary approved for ${appSal?.workerName || "worker"} — ${fmtRWF(appSal?.net || appSal?.amount || 0)}`);
    setSaving(false);
  }

  const visibleSalaries = isAdmin
    ? (salaries || [])
    : (salaries || []).filter(s => {
        const isOwn = s.workerId === user.uid || s.workerId === user.id;
        if (!isOwn) return false;
        if (s.autoGenerated && !s.adminApproved) return false;
        return true;
      });

  const paidList    = visibleSalaries.filter(s => s.status === "paid");
  const pendingList = visibleSalaries.filter(s => s.status === "pending");
  const overdueList = visibleSalaries.filter(s => s.status === "pending" && s.dueDate && s.dueDate < toDay());
  const totalPaid    = paidList.reduce((a, s)    => a + (s.net || s.amount || 0), 0);
  const totalPending = pendingList.reduce((a, s) => a + (s.net || s.amount || 0), 0);
  const totalOverdue = overdueList.reduce((a, s) => a + (s.net || s.amount || 0), 0);
  const pendingApprovalList = (salaries || []).filter(s => s.autoGenerated && !s.adminApproved && s.status === "pending");

  function handleWorkerChange(wid) {
    const w             = workers.find(x => x.uid === wid || x.id === wid);
    const pendingAdvances = (advances || []).filter(a => a.workerId === wid && a.status === "approved" && !a.deductedInSalaryId);
    const autoDeductions  = pendingAdvances.map(a => ({ id: uid(), type: "Salary Advance Deduction", label: `Advance: ${a.reason || "Salary advance"}`, amount: String(a.amount || 0), advanceId: a.id }));
    const approvedBonuses = (bonusRequests || []).filter(r => r.workerId === wid && r.status === "approved" && !r.addedToSalaryId);
    const autoBonuses     = approvedBonuses.map(r => ({ id: uid(), type: "Approved Bonus", label: r.reason || "Bonus", amount: String(r.suggestedAmount || 0), bonusRequestId: r.id }));
    const config          = (salaryConfigs || []).find(c => c.workerId === wid);
    if (config) {
      setForm(f => ({ ...f, workerId: wid, workerName: w?.name || "", amount: String(config.grossSalary), deductions: autoDeductions, bonuses: autoBonuses }));
    } else {
      setForm(f => ({ ...f, workerId: wid, workerName: w?.name || "", amount: "", deductions: autoDeductions, bonuses: autoBonuses }));
      db.collection("contracts").where("workerId", "==", wid).limit(1).get()
        .then(snap => { if (!snap.empty) { const sal = String(snap.docs[0].data().salary || ""); if (sal) setForm(f => ({ ...f, amount: sal })); } })
        .catch(() => {});
    }
  }

  const preview = calcNetPay(form.amount, form.deductions, form.bonuses);

  async function scheduleSalary() {
    if (!form.workerId || !form.amount || parseFloat(form.amount) <= 0) { showToast("Select a worker and enter base salary.", "error"); return; }
    setSaving(true);
    const { gross, totalBonus, totalDeduct, subtotal, net } = calcNetPay(form.amount, form.deductions, form.bonuses);
    const rec = {
      id: uid(), workerId: form.workerId, workerName: form.workerName, gross,
      deductions: form.deductions.map(d => ({ ...d, amount: parseFloat(d.amount) || 0 })),
      bonuses:    form.bonuses.map(b    => ({ ...b, amount: parseFloat(b.amount) || 0 })),
      totalBonus, totalDeduct, subtotal, net, amount: net,
      period: form.period, month: parseInt(form.month), year: parseInt(form.year),
      dueDate: form.dueDate, method: form.method, notes: form.notes,
      status: "pending", createdAt: new Date().toISOString(), scheduledBy: user.name,
      pendingAdvanceIds: form.deductions.filter(d => d.advanceId).map(d => d.advanceId),
      approvedBonusIds:  form.bonuses.filter(b => b.bonusRequestId).map(b => b.bonusRequestId),
    };
    const updated = [...(salaries || []), rec];
    setSalaries(updated); await fsSet("salaries", updated);
    const usedBonusIds = rec.approvedBonusIds || [];
    if (usedBonusIds.length > 0 && setBonusRequests) {
      const updBonuses = (bonusRequests || []).map(r => usedBonusIds.includes(r.id) ? { ...r, addedToSalaryId: rec.id } : r);
      setBonusRequests(updBonuses); await fsSet("bonusRequests", updBonuses);
    }
    showToast(`✅ Salary scheduled for ${rec.workerName} — Net: ${fmtRWF(net)}`);
    window._addAuditLog?.("add", `Salary scheduled for ${rec.workerName} — Net: ${fmtRWF(net)}`);
    setForm(defForm); setSaving(false); setTab("history");
  }

  async function saveEdit() {
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast("Enter base salary.", "error"); return; }
    setSaving(true);
    const { gross, totalBonus, totalDeduct, subtotal, net } = calcNetPay(form.amount, form.deductions, form.bonuses);
    const updated = (salaries || []).map(s => s.id === editId ? {
      ...s, gross,
      deductions: form.deductions.map(d => ({ ...d, amount: parseFloat(d.amount) || 0 })),
      bonuses:    form.bonuses.map(b    => ({ ...b, amount: parseFloat(b.amount) || 0 })),
      totalBonus, totalDeduct, subtotal, net, amount: net,
      period: form.period, month: parseInt(form.month), year: parseInt(form.year),
      dueDate: form.dueDate, method: form.method, notes: form.notes,
      editedAt: new Date().toISOString(), editedBy: user.name,
    } : s);
    setSalaries(updated); await fsSet("salaries", updated);
    window._addAuditLog?.("edit", "Salary record updated manually");
    showToast("✅ Salary updated successfully!");
    setEditId(null); setForm(defForm); setSaving(false);
  }

  function startEdit(sal) {
    setEditId(sal.id);
    setForm({
      workerId: sal.workerId, workerName: sal.workerName,
      amount: String(sal.gross || sal.amount || ""),
      period:  sal.period   || "Monthly",
      month:   String(sal.month  || now.getMonth() + 1),
      year:    String(sal.year   || now.getFullYear()),
      dueDate: sal.dueDate  || toDay(),
      method:  sal.method   || "Mobile Money (MoMo)",
      notes:   sal.notes    || "",
      deductions: (sal.deductions || []).map(d => ({ ...d, amount: String(d.amount) })),
      bonuses:    (sal.bonuses    || []).map(b => ({ ...b, amount: String(b.amount) })),
    });
    setTab("schedule");
  }

  async function paySalary(sal) {
    const alreadyPaidThisMonth = (salaries || []).some(s =>
      s.id !== sal.id && s.workerId === sal.workerId && s.month === sal.month && s.year === sal.year && s.status === "paid"
    );
    if (alreadyPaidThisMonth) {
      showToast(`⛔ ${sal.workerName} has already been paid for ${MONTHS_LBL[(sal.month || 1) - 1]} ${sal.year}. Only one payment per worker per month is allowed.`, "error");
      setConfirmId(null); return;
    }
    setSaving(true);
    const paidAt = toDay();
    const netAmt = sal.net || sal.amount || 0;
    const updatedSalaries = (salaries || []).map(s => s.id === sal.id ? { ...s, status: "paid", paidAt, paidBy: user.name } : s);
    setSalaries(updatedSalaries); await fsSet("salaries", updatedSalaries);
    const alreadyRecorded = (expenses || []).some(e => e.refSalaryId === sal.id || e.source === "salary_payment_" + sal.id);
    if (!alreadyRecorded) {
      const desc   = `Salary — ${sal.workerName} (${MONTHS_LBL[(sal.month || 1) - 1]} ${sal.year}) via ${sal.method}`;
      const expRec = { id: uid(), workerId: user.uid || user.id, worker: user.name, category: "Salary", description: desc, amount: netAmt, date: paidAt, source: "salary_payment_" + sal.id, approved: true, refSalaryId: sal.id };
      const updatedExp = [...(expenses || []), expRec];
      setExpenses(updatedExp); await fsSet("expenses", updatedExp);
      if (capital && setCapital) capitalTx(capital, setCapital, { type: "expense", category: "Salary", amount: netAmt, description: desc, date: paidAt, refId: "salary_" + sal.id });
    }
    showToast(`💸 ${fmtRWF(netAmt)} paid to ${sal.workerName} — expense recorded`);
    window._addAuditLog?.("edit", `Salary paid: ${fmtRWF(netAmt)} to ${sal.workerName} via ${sal.method || "—"}`);
    setSaving(false); setConfirmId(null);
  }

  async function deleteSalary(salId) {
    const sal    = (salaries || []).find(s => s.id === salId);
    if (!sal) return;
    const wasPaid = sal.status === "paid";
    if (!window.confirm(`Delete this salary record${wasPaid ? " (it was already PAID — the expense entry will also be removed)" : ""}?`)) return;
    const updatedSal = (salaries || []).filter(s => s.id !== salId);
    setSalaries(updatedSal); await fsSet("salaries", updatedSal);
    if (wasPaid && setExpenses) {
      const updatedExp = (expenses || []).filter(e => e.refSalaryId !== salId && e.source !== "salary_payment_" + salId);
      setExpenses(updatedExp); await fsSet("expenses", updatedExp);
      if (capital && setCapital) setCapital(prev => ({ ...prev, transactions: (prev.transactions || []).filter(t => t.refId !== "salary_" + salId) }));
      showToast("🗑️ Paid salary deleted — expense reversed.");
      window._addAuditLog?.("delete", `Paid salary deleted for ${sal?.workerName || "worker"} — expense reversed`);
    } else {
      showToast("🗑️ Salary record deleted.");
      window._addAuditLog?.("delete", `Salary record deleted for ${sal?.workerName || "worker"}`);
    }
  }

  function periodLabel(s) { return `${MONTHS_LBL[(s.month || 1) - 1]} ${s.year || ""}`; }
  function statusEl(s) {
    const isOvr = s.status === "pending" && s.dueDate && s.dueDate < toDay();
    if (s.status === "paid") return <span className="status-paid">✅ Paid</span>;
    if (isOvr)               return <span className="status-overdue">⚠️ Overdue</span>;
    return                          <span className="status-pending">⏳ Pending</span>;
  }

  const byWorker = {};
  (salaries || []).forEach(s => {
    if (!byWorker[s.workerId]) byWorker[s.workerId] = { name: s.workerName, totalNet: 0, paid: 0, pending: 0, records: [] };
    byWorker[s.workerId].records.push(s);
    byWorker[s.workerId].totalNet += (s.net || s.amount || 0);
    if (s.status === "paid") byWorker[s.workerId].paid    += (s.net || s.amount || 0);
    else                     byWorker[s.workerId].pending += (s.net || s.amount || 0);
  });

  /* ── Payslip card ── */
  function PayslipCard({ sal, onClose }) {
    const net        = sal.net || sal.amount || 0;
    const gross      = sal.gross || sal.amount || 0;
    const deductions = sal.deductions || [];
    const bonuses    = sal.bonuses    || [];
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
          <div style={{ background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)", padding: "20px 22px", borderRadius: "16px 16px 0 0", position: "relative" }}>
            <div style={{ fontSize: 11, color: "rgba(74,222,128,.7)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>FarmIQ · Official Payslip</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>👷 {sal.workerName}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>{sal.period} · {periodLabel(sal)} · {sal.method}</div>
            <div style={{ position: "absolute", top: 18, right: 18 }}>{statusEl(sal)}</div>
          </div>
          <div style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 9, marginBottom: 8, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>📋 Base (Gross) Salary</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{fmtRWF(gross)}</span>
            </div>
            {bonuses.length > 0 && <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1, margin: "10px 0 5px", padding: "0 4px" }}>🌟 Bonuses / Motivations</div>
              {bonuses.map((b, i) => (
                <div key={b.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "rgba(22,163,74,.05)", borderRadius: 8, marginBottom: 4, border: "1px solid rgba(22,163,74,.15)" }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{b.label || b.type}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{b.type}</div></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>+ {fmtRWF(b.amount)}</span>
                </div>
              ))}
            </>}
            {bonuses.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "rgba(22,163,74,.08)", borderRadius: 8, marginBottom: 8, border: "1px solid rgba(22,163,74,.2)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>Subtotal (before deductions)</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{fmtRWF(sal.subtotal || gross + (sal.totalBonus || 0))}</span>
            </div>}
            {deductions.length > 0 && <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, margin: "10px 0 5px", padding: "0 4px" }}>✂️ Deductions</div>
              {deductions.map((d, i) => (
                <div key={d.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: "rgba(239,68,68,.04)", borderRadius: 8, marginBottom: 4, border: "1px solid rgba(239,68,68,.15)" }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{d.label || d.type}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{d.type}</div></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>− {fmtRWF(d.amount)}</span>
                </div>
              ))}
            </>}
            <div style={{ borderTop: "2px dashed #e2e8f0", margin: "12px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "linear-gradient(135deg,rgba(22,163,74,.08),rgba(16,185,129,.04))", borderRadius: 10, border: "2px solid rgba(22,163,74,.25)" }}>
              <div><div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>💵 Net Pay</div><div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>What worker receives</div></div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#16a34a" }}>{fmtRWF(net)}</div>
            </div>
            {(bonuses.length > 0 || deductions.length > 0) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
              {[{ l: "Gross", v: fmtRWF(gross), c: "#475569" }, { l: "+ Bonuses", v: fmtRWF(sal.totalBonus || 0), c: "#16a34a" }, { l: "− Deductions", v: fmtRWF(sal.totalDeduct || 0), c: "#dc2626" }].map(x => (
                <div key={x.l} style={{ background: "#f8fafc", borderRadius: 7, padding: "7px 10px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>{x.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: x.c }}>{x.v}</div>
                </div>
              ))}
            </div>}
            <div style={{ marginTop: 12, padding: "9px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11, color: "#94a3b8" }}>
              {sal.paidAt && <div>✅ Paid on <strong style={{ color: "#1e293b" }}>{sal.paidAt}</strong> by {sal.paidBy || "Admin"}</div>}
              {sal.notes  && <div style={{ marginTop: 3 }}>📝 Note: <em style={{ color: "#475569" }}>{sal.notes}</em></div>}
              {sal.editedAt && <div style={{ marginTop: 3 }}>✏️ Last edited: {sal.editedAt.slice(0, 10)} by {sal.editedBy || "Admin"}</div>}
            </div>
          </div>
          <div style={{ padding: "0 22px 18px" }}>
            <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Close Payslip</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Line items (deductions / bonuses) ── */
  function LineItems({ items, types, onAdd, onUpdate, onRemove, colorAccent, label, icon }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ ...S.lbl, color: colorAccent }}>{icon} {label}</label>
          <button onClick={onAdd} style={{ padding: "3px 10px", borderRadius: 7, border: "1px solid " + colorAccent + "44", background: colorAccent + "12", color: colorAccent, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>+ Add</button>
        </div>
        {items.length === 0 && <div style={{ fontSize: 11, color: C.faint, padding: "7px 10px", background: C.elevated, borderRadius: 7, textAlign: "center" }}>None added — click + Add</div>}
        {items.map(item => (
          <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <select value={item.type}   onChange={e => onUpdate(item.id, "type",   e.target.value)} style={{ ...S.inp, fontSize: 11, padding: "6px 8px" }}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            <input placeholder="Label / reason" value={item.label}  onChange={e => onUpdate(item.id, "label",  e.target.value)} style={{ ...S.inp, fontSize: 11, padding: "6px 8px" }} />
            <input type="number" min="0" placeholder="RWF" value={item.amount} onChange={e => onUpdate(item.id, "amount", e.target.value)} style={{ ...S.inp, fontSize: 11, padding: "6px 8px", width: 90 }} />
            <button onClick={() => onRemove(item.id)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
        ))}
      </div>
    );
  }

  const allTabs = isAdmin
    ? [["overview", "📊 Overview"], ["config", "⚙️ Salary Config"], ["schedule", editId ? "✏️ Edit" : "➕ Schedule"], ["history", "📋 Records"], ["byworker", "👷 By Worker"]]
    : [["history", "💳 My Salary"], ["overview", "📊 Summary"]];

  return (
    <div className="fade-in">
      {viewPayslip && (() => { const sal = (salaries || []).find(s => s.id === viewPayslip); return sal ? <PayslipCard sal={sal} onClose={() => setViewPayslip(null)} /> : null; })()}

      {toast && <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9998, padding: "12px 20px", background: toast.type === "error" ? "rgba(254,242,242,.98)" : "rgba(240,253,244,.98)", border: "1px solid " + (toast.type === "error" ? "rgba(252,165,165,.8)" : "rgba(110,231,183,.8)"), borderRadius: 12, fontWeight: 700, fontSize: 13, color: toast.type === "error" ? "#dc2626" : "#065f46", boxShadow: "0 8px 30px rgba(0,0,0,.15)", backdropFilter: "blur(8px)" }}>{toast.msg}</div>}

      {/* Banner */}
      <div className="salary-banner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>💼 Salary & Payments</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>{isAdmin ? "Manage salaries · deductions · bonuses — workers see full payslip" : "Your personal salary records, deductions & bonuses"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[{ l: "Paid", v: fmtRWF(totalPaid), c: "#4ade80" }, { l: "Pending", v: fmtRWF(totalPending), c: "#fbbf24" }, ...(totalOverdue > 0 ? [{ l: "Overdue", v: fmtRWF(totalOverdue), c: "#f87171" }] : [])].map(x => (
              <div key={x.l} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 88 }}>
                <div style={{ fontSize: 9, color: x.c, opacity: .8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{x.l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: x.c }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, marginBottom: 16, gap: 3, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        {allTabs.map(([t, l]) => (
          <button key={t} onClick={() => { setTab(t); if (t !== "schedule") { setEditId(null); setForm(defForm); } }} style={{ ...S.tab(tab === t), flex: 1, borderRadius: 8, fontSize: 12, padding: "8px 10px" }}>{l}</button>
        ))}
      </div>

      {/* Pending approval notification */}
      {isAdmin && pendingApprovalList.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,rgba(245,158,11,.08),rgba(234,179,8,.04))", border: "2px solid rgba(245,158,11,.35)", borderRadius: 12, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 28 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 2 }}>⚡ {pendingApprovalList.length} Auto-Generated Salary Record{pendingApprovalList.length !== 1 ? "s" : ""} Awaiting Your Approval</div>
            <div style={{ fontSize: 12, color: "#b45309" }}>The system auto-generated salaries for this month on the 25th. Review and approve each one so workers can see them.</div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>Workers: <strong>{pendingApprovalList.map(s => s.workerName).join(", ")}</strong></div>
          </div>
          <button onClick={() => setTab("history")} style={{ ...S.btn("#d97706"), fontSize: 12, padding: "8px 16px", flexShrink: 0 }}>📋 Review Now</button>
        </div>
      )}

      {/* ── SALARY CONFIG ── */}
      {tab === "config" && isAdmin && (
        <div>
          <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(22,163,74,.04),rgba(16,185,129,.02))", border: "1px solid rgba(22,163,74,.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>⚙️ Set Monthly Gross Salary Per Worker</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 18, lineHeight: 1.6 }}>
              Set each worker's fixed monthly gross salary. On the 25th of every month, the system will <strong>automatically generate</strong> their salary records — including any approved bonuses and pending advance deductions — and notify you to approve them.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.lbl}>Select Worker</label>
              <select value={configForm.workerId} onChange={e => {
                const wid = e.target.value;
                const existing = getWorkerConfig(wid);
                setConfigForm(f => ({ ...f, workerId: wid, grossSalary: existing ? String(existing.grossSalary) : "", notes: existing?.notes || "" }));
                if (!existing && wid) {
                  db.collection("contracts").where("workerId", "==", wid).limit(1).get()
                    .then(snap => { if (!snap.empty) { const sal = String(snap.docs[0].data().salary || ""); if (sal) setConfigForm(f => ({ ...f, grossSalary: sal })); } })
                    .catch(() => {});
                }
              }} style={S.inp}>
                <option value="">— Choose a worker —</option>
                {workers.map(w => {
                  const cfg = getWorkerConfig(w.uid || w.id);
                  return <option key={w.uid || w.id} value={w.uid || w.id}>{w.name}{cfg ? ` ✓ ${fmtRWF(cfg.grossSalary)}/mo` : ""}</option>;
                })}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.lbl}>Monthly Gross Salary (RWF)</label>
              <input type="number" min="0" placeholder="e.g. 150000" value={configForm.grossSalary} onChange={e => setConfigForm(f => ({ ...f, grossSalary: e.target.value }))} style={S.inp} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>Notes (optional)</label>
              <input type="text" placeholder="e.g. Includes housing allowance" value={configForm.notes} onChange={e => setConfigForm(f => ({ ...f, notes: e.target.value }))} style={S.inp} />
            </div>
            <button onClick={saveConfig} disabled={configSaving || !configForm.workerId || !configForm.grossSalary} style={{ ...S.btn(), width: "100%", padding: "11px", fontSize: 14, opacity: (!configForm.workerId || !configForm.grossSalary) ? 0.5 : 1 }}>
              {configSaving ? "Saving…" : "💾 Save Salary Config"}
            </button>
          </div>
          <div style={{ ...S.card, border: "2px dashed rgba(22,163,74,.3)", background: "rgba(22,163,74,.02)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>⚡ Manual Salary Generation</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
              Normally salaries auto-generate on the <strong>25th of each month</strong>. Trigger manually here at any time — skips workers who already have a salary record this month.
            </div>
            <button onClick={triggerAutoGenerate} disabled={saving} style={{ ...S.btn("#6366f1"), padding: "10px 20px", fontSize: 13 }}>
              {saving ? "Generating…" : "🚀 Generate This Month's Salaries"}
            </button>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>👷 Worker Salary Configurations</div>
            {workers.length === 0 && <div style={{ color: C.faint, fontSize: 13, textAlign: "center", padding: "16px 0" }}>No approved workers yet.</div>}
            {workers.map(w => {
              const cfg = getWorkerConfig(w.uid || w.id);
              return (
                <div key={w.uid || w.id} style={{ ...S.row, marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: cfg ? "rgba(22,163,74,.12)" : "rgba(100,116,139,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid " + (cfg ? "rgba(22,163,74,.3)" : "rgba(100,116,139,.2)") }}>👤</div>
                    <div><div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{w.name}</div><div style={{ fontSize: 11, color: C.faint }}>{w.email || ""}</div></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {cfg ? (<>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: C.accent }}>{fmtRWF(cfg.grossSalary)}</div>
                        <div style={{ fontSize: 10, color: C.faint }}>per month · Updated {cfg.updatedAt?.slice(0, 10)}</div>
                      </div>
                      <button onClick={() => setConfigForm({ workerId: w.uid || w.id, grossSalary: String(cfg.grossSalary), notes: cfg.notes || "" })} style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>✏️ Edit</button>
                    </>) : <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>⚠️ No salary set</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
            {[{ l: "Total Paid", v: fmtRWF(totalPaid), c: "#16a34a", i: "✅" }, { l: "Pending", v: fmtRWF(totalPending), c: "#d97706", i: "⏳" }, { l: "Overdue", v: fmtRWF(totalOverdue), c: totalOverdue > 0 ? "#dc2626" : C.faint, i: "⚠️" }, { l: "Records", v: visibleSalaries.length, c: C.text, i: "📋" }].map(k => (
              <div key={k.l} style={S.stat}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{k.i}</div>
                <div style={S.sl}>{k.l}</div>
                <div style={{ ...S.sv, color: k.c, fontSize: typeof k.v === "string" && k.v.length > 10 ? 14 : 20 }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Recent Payments</div>
            {paidList.length === 0 && <div style={{ color: C.faint, fontSize: 13, textAlign: "center", padding: 20 }}>No salaries paid yet.</div>}
            {paidList.slice().sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || "")).slice(0, 6).map((s, i) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: i % 2 === 0 ? C.elevated : "transparent", borderRadius: 8, marginBottom: 4, cursor: "pointer" }} onClick={() => setViewPayslip(s.id)}>
                <div><div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>👷 {s.workerName}</div><div style={{ fontSize: 11, color: C.faint }}>{periodLabel(s)} · {s.period} · Paid {s.paidAt || "—"}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, color: C.accent, fontSize: 14 }}>{fmtRWF(s.net || s.amount)}</div><div style={{ fontSize: 10, color: C.faint }}>View Payslip →</div></div>
              </div>
            ))}
          </div>
          {pendingList.length > 0 && (
            <div style={{ ...S.card, border: "1.5px solid rgba(245,158,11,.3)", background: "rgba(255,251,235,.5)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>⏳ Pending ({pendingList.length})</div>
              {pendingList.map(s => {
                const isOvr = s.dueDate && s.dueDate < toDay();
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 8, background: isOvr ? "rgba(239,68,68,.05)" : "rgba(245,158,11,.04)", border: "1px solid " + (isOvr ? "rgba(239,68,68,.2)" : "rgba(245,158,11,.2)"), marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <div><div style={{ fontWeight: 600, fontSize: 13 }}>{s.workerName} <span style={{ fontSize: 10, color: C.faint }}>— {periodLabel(s)}</span></div><div style={{ fontSize: 11, color: C.faint }}>Due: {s.dueDate || "—"} · Net: <strong style={{ color: isOvr ? C.red : C.amber }}>{fmtRWF(s.net || s.amount)}</strong></div></div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button onClick={() => setViewPayslip(s.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>📄 Payslip</button>
                      {isAdmin && <button onClick={() => setConfirmId(s.id)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>💸 Pay Now</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCHEDULE / EDIT ── */}
      {tab === "schedule" && isAdmin && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ ...S.card, border: "1px solid rgba(22,163,74,.2)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 2 }}>{editId ? "✏️ Edit Salary Record" : "➕ Schedule New Salary"}</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>{editId ? "Update salary, deductions or bonuses. Worker will see all changes instantly." : "Create a salary. Add deductions/bonuses — worker sees full payslip."}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Worker *</label>
                <select value={form.workerId} onChange={e => handleWorkerChange(e.target.value)} disabled={!!editId} style={{ ...S.inp, opacity: editId ? .6 : 1 }}>
                  <option value="">— Select Worker —</option>
                  {workers.map(w => <option key={w.uid || w.id} value={w.uid || w.id}>{w.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Base (Gross) Salary (RWF) *</label>
                <input type="number" min="0" placeholder="e.g. 80000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Pay Period</label>
                <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} style={S.inp}>
                  {SALARY_PERIODS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Month</label>
                <select value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} style={S.inp}>
                  {MONTHS_LBL.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Year</label>
                <input type="number" min="2020" max="2030" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Payment Method</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SALARY_METHODS.map(m => (
                    <button key={m} onClick={() => setForm({ ...form, method: m })} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid " + (form.method === m ? C.accent : C.border), background: form.method === m ? "rgba(22,163,74,.1)" : "transparent", color: form.method === m ? C.accent : C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: form.method === m ? 700 : 400 }}>{m}</button>
                  ))}
                </div>
              </div>
            </div>
            <LineItems items={form.bonuses}    types={BONUS_TYPES}     onAdd={addBonus}      onUpdate={updateBonus}      onRemove={removeBonus}      colorAccent={C.accent} label="Bonuses / Motivations" icon="🌟" />
            <LineItems items={form.deductions} types={DEDUCTION_TYPES} onAdd={addDeduction}  onUpdate={updateDeduction}  onRemove={removeDeduction}  colorAccent={C.red}    label="Deductions"           icon="✂️" />
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Notes (optional)</label>
              <input placeholder="e.g. Performance bonus included, deduction noted…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={S.inp} />
            </div>
            {form.amount && parseFloat(form.amount) > 0 && (
              <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,rgba(22,163,74,.06),rgba(16,185,129,.03))", border: "1.5px solid rgba(22,163,74,.2)", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>📄 Payslip Preview</div>
                {[["Base Salary", fmtRWF(preview.gross), C.text], ...(preview.totalBonus > 0 ? [["+ Total Bonuses", "+ " + fmtRWF(preview.totalBonus), C.accent], ["Subtotal", fmtRWF(preview.subtotal), C.muted]] : []), ...(preview.totalDeduct > 0 ? [["− Total Deductions", "− " + fmtRWF(preview.totalDeduct), C.red]] : [])].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 3 }}><span>{l}</span><span style={{ color: c, fontWeight: 600 }}>{v}</span></div>
                ))}
                <div style={{ borderTop: "1px dashed rgba(22,163,74,.3)", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800 }}>
                  <span style={{ color: C.text }}>💵 Net Pay</span>
                  <span style={{ color: C.accent }}>{fmtRWF(preview.net)}</span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={editId ? saveEdit : scheduleSalary} disabled={saving || !form.workerId || !form.amount || parseFloat(form.amount) <= 0}
                style={{ ...S.btn(C.accent), flex: 1, padding: "12px", fontSize: 14, fontWeight: 700, opacity: (saving || !form.workerId || !form.amount) ? 0.55 : 1 }}>
                {saving ? "⏳ Saving…" : editId ? "✅ Save Changes →" : "📅 Schedule Salary →"}
              </button>
              {editId && <button onClick={() => { setEditId(null); setForm(defForm); setTab("history"); }} style={{ padding: "12px 16px", borderRadius: 9, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── RECORDS ── */}
      {tab === "history" && (
        <div>
          {visibleSalaries.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}><div style={{ fontSize: 32, marginBottom: 8 }}>💼</div><div style={{ fontSize: 14, fontWeight: 600 }}>No salary records yet</div><div style={{ fontSize: 12, marginTop: 4 }}>{isAdmin ? "Use ➕ Schedule tab to create salaries." : "Your salary records will appear here."}</div></div>}
          {visibleSalaries.slice().sort((a, b) => (b.paidAt || b.dueDate || b.createdAt || "").localeCompare(a.paidAt || a.dueDate || a.createdAt || "")).map(s => {
            const isOvr         = s.status === "pending" && s.dueDate && s.dueDate < toDay();
            const borderCol     = s.status === "paid" ? C.accent : isOvr ? C.red : C.amber;
            const hasExtras     = (s.deductions || []).length > 0 || (s.bonuses || []).length > 0;
            const needsApproval = isAdmin && s.autoGenerated && !s.adminApproved && s.status === "pending";
            return (
              <div key={s.id} className="card-hover" style={{ ...S.card, borderLeft: "4px solid " + (needsApproval ? "#f59e0b" : borderCol), marginBottom: 10, padding: "13px 16px", background: needsApproval ? "rgba(245,158,11,.02)" : "#fff" }}>
                {needsApproval && <div style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 7, padding: "6px 12px", marginBottom: 8, fontSize: 11, color: "#92400e", fontWeight: 600 }}>🔔 Auto-generated salary awaiting your approval — workers cannot see this yet</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>👷 {s.workerName}</span>
                      {statusEl(s)}
                      {hasExtras && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: "rgba(99,102,241,.1)", color: "#6366f1", fontWeight: 600, border: "1px solid rgba(99,102,241,.2)" }}>✦ adjusted</span>}
                      {s.autoGenerated && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: "rgba(16,185,129,.1)", color: "#059669", fontWeight: 600, border: "1px solid rgba(16,185,129,.2)" }}>⚡ Auto</span>}
                      {s.adminApproved && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: "rgba(22,163,74,.1)", color: C.accent, fontWeight: 600, border: "1px solid rgba(22,163,74,.2)" }}>✅ Approved</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 2, fontSize: 11, color: C.faint }}>
                      <span>Period:</span><span style={{ color: C.muted }}>{s.period} — {periodLabel(s)}</span>
                      <span>Method:</span><span style={{ color: C.muted }}>{s.method}</span>
                      {s.gross && s.gross !== s.net && <><span>Gross:</span><span style={{ color: C.muted }}>{fmtRWF(s.gross)}</span></>}
                      {(s.totalBonus  || 0) > 0 && <><span>+ Bonuses:</span><span style={{ color: C.accent, fontWeight: 600 }}>+ {fmtRWF(s.totalBonus)}</span></>}
                      {(s.totalDeduct || 0) > 0 && <><span>− Deductions:</span><span style={{ color: C.red, fontWeight: 600 }}>− {fmtRWF(s.totalDeduct)}</span></>}
                      {s.paidAt && <><span>Paid:</span><span style={{ color: C.accent, fontWeight: 600 }}>{s.paidAt}{isAdmin ? ` by ${s.paidBy || "Admin"}` : ""}</span></>}
                      {s.notes && <><span>Note:</span><span style={{ fontStyle: "italic" }}>{s.notes}</span></>}
                      {s.adminApproved && s.adminApprovedAt && <><span>Approved:</span><span style={{ color: C.accent }}>{s.adminApprovedAt.slice(0, 10)} by {s.adminApprovedBy || "Admin"}</span></>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div><div style={{ fontSize: 10, color: C.faint, marginBottom: 1 }}>Net Pay</div><div style={{ fontWeight: 900, fontSize: 20, color: s.status === "paid" ? C.accent : isOvr ? C.red : C.amber }}>{fmtRWF(s.net || s.amount)}</div></div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => setViewPayslip(s.id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>📄 Payslip</button>
                      {needsApproval && <button onClick={() => approveGeneratedSalary(s.id)} disabled={saving} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✅ Approve</button>}
                      {isAdmin && s.status !== "paid" && <button onClick={() => startEdit(s)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.07)", color: "#6366f1", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>}
                      {isAdmin && s.status !== "paid" && (s.adminApproved || !s.autoGenerated) && (() => {
                        const blocked = (salaries || []).some(x => x.id !== s.id && x.workerId === s.workerId && x.month === s.month && x.year === s.year && x.status === "paid");
                        return blocked
                          ? <span style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.07)", color: C.red, fontWeight: 700, fontSize: 11, cursor: "not-allowed", fontFamily: "inherit", opacity: .7 }}>⛔ Already Paid</span>
                          : <button onClick={() => setConfirmId(s.id)} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>💸 Pay</button>;
                      })()}
                      {isAdmin && <button onClick={() => deleteSalary(s.id)} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(239,68,68,.25)", background: "transparent", color: C.red, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BY WORKER ── */}
      {tab === "byworker" && isAdmin && (
        <div>
          {Object.keys(byWorker).length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40, color: C.faint }}>No data yet.</div>}
          {Object.entries(byWorker).sort((a, b) => b[1].totalNet - a[1].totalNet).map(([wid, data]) => (
            <div key={wid} className="card-hover" style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div><div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>👷 {data.name}</div><div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{data.records.length} record{data.records.length !== 1 ? "s" : ""}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, color: C.accent, fontSize: 16 }}>{fmtRWF(data.paid)} <span style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>paid</span></div>{data.pending > 0 && <div style={{ color: C.amber, fontSize: 12, fontWeight: 600 }}>{fmtRWF(data.pending)} pending</div>}</div>
              </div>
              <div style={{ height: 6, background: C.elevated, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: data.totalNet > 0 ? (data.paid / data.totalNet * 100) + "%" : "0%", background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {data.records.slice(-5).map(r => {
                  const isOvr = r.status === "pending" && r.dueDate && r.dueDate < toDay();
                  return <button key={r.id} onClick={() => setViewPayslip(r.id)} style={{ padding: "4px 10px", borderRadius: 12, background: r.status === "paid" ? "rgba(22,163,74,.1)" : isOvr ? "rgba(239,68,68,.1)" : "rgba(245,158,11,.1)", border: "1px solid " + (r.status === "paid" ? "rgba(22,163,74,.25)" : isOvr ? "rgba(239,68,68,.25)" : "rgba(245,158,11,.25)"), fontSize: 10, color: r.status === "paid" ? C.accent : isOvr ? C.red : C.amber, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{periodLabel(r)} · {fmtRWF(r.net || r.amount)}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PAY CONFIRM MODAL ── */}
      {confirmId && (() => {
        const sal = (salaries || []).find(s => s.id === confirmId);
        if (!sal) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }} onClick={e => e.target === e.currentTarget && setConfirmId(null)}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 390, boxShadow: "0 28px 70px rgba(0,0,0,.16)" }}>
              <div style={{ fontSize: 22, marginBottom: 8, textAlign: "center" }}>💸</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, textAlign: "center" }}>Confirm Payment</div>
              <div style={{ background: "rgba(22,163,74,.06)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 12px", fontSize: 13, color: C.muted }}>
                  <span>Worker:</span><strong style={{ color: C.text }}>{sal.workerName}</strong>
                  <span>Gross:</span><span>{fmtRWF(sal.gross || sal.amount)}</span>
                  {(sal.totalBonus  || 0) > 0 && <><span>+ Bonuses:</span><span style={{ color: C.accent }}>+ {fmtRWF(sal.totalBonus)}</span></>}
                  {(sal.totalDeduct || 0) > 0 && <><span>− Deductions:</span><span style={{ color: C.red }}>− {fmtRWF(sal.totalDeduct)}</span></>}
                  <span>Net Pay:</span><strong style={{ color: C.accent, fontSize: 16 }}>{fmtRWF(sal.net || sal.amount)}</strong>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 16, padding: "8px 12px", background: "rgba(245,158,11,.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,.2)" }}>
                ⚠️ Net Pay of <strong>{fmtRWF(sal.net || sal.amount)}</strong> will be recorded as a Salary expense and deducted from capital.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => paySalary(sal)} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  {saving ? "⏳ Processing…" : "✅ Confirm Payment"}
                </button>
                <button onClick={() => setConfirmId(null)} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid " + C.border, background: C.elevated, color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
