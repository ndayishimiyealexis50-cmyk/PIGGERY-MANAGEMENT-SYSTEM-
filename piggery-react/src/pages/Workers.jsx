import { C, S } from '../utils/constants';
import React, { useState, useEffect } from "react";
import { fsSet } from "../lib/firestore";

// Farm role definitions — same list as original index.html (FARM_ROLES)
const FARM_ROLES = [
  { id: "farm_manager",   label: "Farm Manager",    desc: "Overall farm operations management" },
  { id: "pig_caretaker",  label: "Pig Caretaker",   desc: "Daily care and feeding of pigs" },
  { id: "feed_officer",   label: "Feed Officer",    desc: "Feed procurement and management" },
  { id: "sales_officer",  label: "Sales Officer",   desc: "Sales and marketing activities" },
  { id: "health_officer", label: "Health Officer",  desc: "Animal health and veterinary liaison" },
  { id: "field_worker",   label: "Field Worker",    desc: "General farm field operations" },
  { id: "data_entry",     label: "Data Entry",      desc: "Record keeping and data management" },
  { id: "other",          label: "Other / Custom",  desc: "Specify a custom role below" },
];

const roleColors = {
  farm_manager: "#a78bfa", pig_caretaker: "#34d399", feed_officer: "#60a5fa",
  sales_officer: "#fbbf24", health_officer: "#f472b6", field_worker: "#94a3b8",
  data_entry: "#fb923c", other: "#e2e8f0",
};

export default function Workers({ users, setUsers, tasks = [] }) {
  const [saving, setSaving] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState("");
  const [roleModal, setRoleModal] = useState(null);
  const [roleChoice, setRoleChoice] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [workerTab, setWorkerTab] = useState("workers");

  const pending  = users.filter(u => u.role === "worker" && !u.approved && !u.removed);
  const approved = users.filter(u => u.role === "worker" &&  u.approved && !u.removed);
  const removed  = users.filter(u => u.role === "worker" &&  u.removed);

  function getRoleLabel(jobTitle) {
    if (!jobTitle) return null;
    const found = FARM_ROLES.find(r => r.id === jobTitle);
    return found ? found.label : jobTitle;
  }

  function openRoleModal(w, autoApprove) {
    const existing = w.jobTitle || "";
    setRoleChoice(existing && FARM_ROLES.find(r => r.id === existing) ? existing : "field_worker");
    setCustomRole(existing && !FARM_ROLES.find(r => r.id === existing) ? existing : "");
    setRoleModal({ uid: w.uid || w.id, name: w.name, _autoApprove: !!autoApprove });
  }

  async function saveRole() {
    if (!roleModal) return;
    const finalRole = roleChoice === "other" ? customRole.trim() : roleChoice;
    if (!finalRole) { alert("Please choose a role."); return; }
    const shouldApprove = roleModal._autoApprove;
    setRoleSaving(true);
    try {
      const updateData = { jobTitle: finalRole };
      if (shouldApprove) updateData.approved = true;
      console.log("User update pending");
      
      setUsers(prev => prev.map(u => (u.uid || u.id) === roleModal.uid ? { ...u, jobTitle: finalRole, ...(shouldApprove ? { approved: true } : {}) } : u));
      const rw = users.find(u => (u.uid || u.id) === roleModal.uid);
      window._addAuditLog?.("edit", `Worker ${rw ? rw.name : roleModal.uid} role set to ${finalRole}${shouldApprove ? " and approved" : ""}`);
      setRoleModal(null);
    } catch (e) { console.error("role save error", e); alert("Failed to save. Try again."); }
    setRoleSaving(false);
  }

  async function restoreWorker(uid) {
    setSaving(uid);
    try {
      console.log("User update pending");
      
      const rw = users.find(u => (u.uid || u.id) === uid);
      setUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, approved: true, removed: false } : u));
      window._addAuditLog?.("edit", `Worker ${rw ? rw.name : uid} restored`);
    } catch (e) { console.error("restore error", e); }
    setSaving(null);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = [];
      if (fresh && fresh.length > 0) setUsers(fresh);
      setLastCheck(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }));
    } catch (e) {}
    setRefreshing(false);
  }

  async function reject(uid) {
    setSaving(uid);
    try {
      const rw = users.find(u => (u.uid || u.id) === uid);
      console.log("User update pending");
      setUsers(prev => prev.filter(u => u.uid !== uid));
      window._addAuditLog?.("delete", `Worker registration rejected & deleted: ${rw ? rw.name : uid}`);
    } catch (e) { console.error("reject error", e); }
    setSaving(null);
  }

  async function removeWorker(uid) {
    const w = users.find(u => (u.uid || u.id) === uid);
    if (!window.confirm(`Remove ${w ? w.name : "this worker"}? They will lose access but ALL their data stays intact and can be restored.`)) return;
    setSaving(uid);
    try {
    console.log("User update pending");
      
      setUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, approved: false, removed: true } : u));
      window._addAuditLog?.("delete", `Worker removed: ${w ? w.name : uid}`);
    } catch (e) { console.error("remove error", e); }
    setSaving(null);
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Role Assignment Modal */}
      {roleModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div style={{ background: "#0f2318", borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 64px rgba(0,0,0,.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>🎭 Assign Farm Role</div>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 18 }}>
              Assigning role to <span style={{ color: C.accent, fontWeight: 700 }}>{roleModal.name}</span>
              {roleModal._autoApprove && <span style={{ color: C.amber, marginLeft: 6 }}>(will also approve account)</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {FARM_ROLES.map(r => (
                <div key={r.id} onClick={() => setRoleChoice(r.id)} style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${roleChoice === r.id ? "rgba(34,197,94,.5)" : "rgba(255,255,255,.07)"}`, background: roleChoice === r.id ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.02)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{r.desc}</div>
                  </div>
                  {roleChoice === r.id && <span style={{ color: C.accent, fontWeight: 800, fontSize: 16, flexShrink: 0 }}>✓</span>}
                </div>
              ))}
            </div>
            {roleChoice === "other" && (
              <input value={customRole} onChange={e => setCustomRole(e.target.value)} placeholder="Enter custom role name…"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box" }}
              />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setRoleModal(null)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: C.faint, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={saveRole} disabled={roleSaving} style={{ flex: 2, padding: "10px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {roleSaving ? "Saving…" : roleModal._autoApprove ? "✓ Assign Role & Approve" : "✓ Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={S.h1}>👷 Worker Management</div>
        <button onClick={refresh} disabled={refreshing} style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(22,163,74,.12)", color: C.accent, fontWeight: 700, fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={refreshing ? { display: "inline-block", animation: "spin .8s linear infinite" } : {}}>🔄</span>
          {refreshing ? "Checking…" : "Refresh"}
        </button>
      </div>
      <div style={{ ...S.sub, marginBottom: 12 }}>{approved.length} active · {pending.length} pending{lastCheck && " · Last checked: " + lastCheck}</div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 5, marginBottom: 18, background: "rgba(0,0,0,.05)", borderRadius: 11, padding: 4 }}>
        {[{ id: "workers", label: "👷 Workers" }, { id: "contracts", label: "📄 Contracts" }].map(t => (
          <button key={t.id} onClick={() => setWorkerTab(t.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", background: workerTab === t.id ? C.accent : "transparent", color: workerTab === t.id ? "#fff" : C.muted, fontWeight: workerTab === t.id ? 700 : 500, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      {workerTab === "contracts" && <WorkerContractManager users={users} />}

      {workerTab === "workers" && <>
        {/* Pending Approvals */}
        {pending.length > 0 && (
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>⏳ Pending Approval ({pending.length})</div>
            {pending.map(w => {
              const id = w.uid || w.id;
              return (
                <div key={id} style={{ borderRadius: 10, border: "1px solid rgba(245,158,11,.2)", background: "rgba(245,158,11,.04)", padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(245,158,11,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{w.email || w.username}</div>
                      <div style={{ fontSize: 11, color: C.amber, marginTop: 2 }}>New registration · needs role & approval</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={{ flex: 2, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(34,197,94,.4)", background: "rgba(34,197,94,.1)", color: "#4ade80", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                      disabled={saving === id} onClick={() => openRoleModal(w, true)}>
                      🎭 Assign Role & Approve
                    </button>
                    <button style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.07)", color: "#f87171", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                      disabled={saving === id} onClick={() => reject(id)}>{saving === id ? "⏳" : "✗ Reject"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pending.length === 0 && <div style={{ ...S.card, textAlign: "center", color: C.faint, fontSize: 13, marginBottom: 12 }}>✅ No pending approvals.</div>}

        {/* Active Workers */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>✅ Active Workers ({approved.length})</div>
          {approved.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No approved workers yet.</div>}
          {approved.map(w => {
            const id = w.uid || w.id;
            const isExp = expanded === id;
            const roleLabel = getRoleLabel(w.jobTitle);
            const roleColor = roleColors[w.jobTitle] || roleColors.other;
            return (
              <div key={id} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", marginBottom: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", background: "rgba(255,255,255,.02)" }} onClick={() => setExpanded(isExp ? null : id)}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(22,163,74,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>👤</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.email || w.username}</div>
                  </div>
                  {roleLabel
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: roleColor, background: `${roleColor}20`, padding: "2px 9px", borderRadius: 10, flexShrink: 0, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roleLabel}</span>
                    : <span style={{ fontSize: 11, color: C.amber, fontWeight: 600, background: "rgba(245,158,11,.1)", padding: "2px 9px", borderRadius: 10, flexShrink: 0 }}>⚠ No role</span>
                  }
                  <span style={{ color: C.faint, fontSize: 11, flexShrink: 0 }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && (
                  <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,.06)", background: "rgba(0,0,0,.12)" }}>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>UID: <span style={{ color: C.sub, fontFamily: "monospace" }}>{id}</span></div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => openRoleModal(w, false)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(167,139,250,.35)", background: "rgba(167,139,250,.08)", color: "#a78bfa", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🎭 {roleLabel ? "Change Role" : "Assign Role"}</button>
                      <button onClick={() => removeWorker(id)} disabled={saving === id} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.07)", color: "#f87171", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{saving === id ? "⏳" : "🚫 Remove"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Removed Workers */}
        {removed.length > 0 && (
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10 }}>🚫 Removed Workers ({removed.length})</div>
            {removed.map(w => {
              const id = w.uid || w.id;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", opacity: 0.65, borderRadius: 8, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: C.muted, fontSize: 13 }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{w.email || w.username}</div>
                    {w.jobTitle && <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>{getRoleLabel(w.jobTitle)}</div>}
                  </div>
                  <button style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(59,130,246,.3)", background: "rgba(59,130,246,.08)", color: "#60a5fa", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                    disabled={saving === id} onClick={() => restoreWorker(id)}>{saving === id ? "⏳" : "↩ Restore"}</button>
                </div>
              );
            })}
          </div>
        )}

        {approved.length > 0 && <WorkerTaskChart users={users} tasks={tasks} />}
      </>}
    </div>
  );
}
