/**
 * TaskManager.jsx
 * Migrated from index.html §18 TASK MANAGEMENT
 *
 * Props (admin):  user, users, tasks, setTasks, feeds
 * Props (worker): user, users, tasks (pre-filtered to worker), setTasks, feeds
 *
 * External deps expected from shared firebase/db module:
 *   fsSet(key, value)          — saves array to Firestore
 *   getOnlineFarmData()        — returns farm snapshot
 *   setOnlineFarmData(patch)   — merges patch into farm doc
 *   toDay()                    — returns "YYYY-MM-DD" today string
 *   uid()                      — generates a unique id string
 *   isAdminUser(user)          — returns boolean
 *
 * window._addAuditLog(action, detail) — global audit logger (injected by App)
 */

import { useState, useEffect } from "react";
import { C, S } from "../styles";

// ─── Helpers (import from your shared utils file in real project) ─────────────
// These are inline stubs — replace with imports from utils.js
const toDay = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const isAdminUser = (u) => u?.role?.toLowerCase() === "admin";
// Replace these stubs with real Firebase calls:
const fsSet = async (key, val) => { /* await firestoreSet(key, val) */ };
const getOnlineFarmData = async () => ({});
const setOnlineFarmData = async (patch) => { /* await firestoreMerge(patch) */ };
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Auto Feeding Task Generator hook ─────────────────────────── */
function useAutoFeedingTasks(tasks, setTasks, users, feeds) {
  useEffect(() => {
    const workers = users.filter(u => u.role === "worker" && u.approved);
    if (workers.length === 0) return;
    const today = toDay();
    let changed = false;
    const updated = [...tasks];

    workers.forEach(w => {
      ["AM", "PM"].forEach(slot => {
        const taskId = `autoFeed_${w.uid || w.id}_${today}_${slot}`;
        const exists = updated.find(t => t.id === taskId);
        const title = slot === "AM" ? "🌅 Morning Feeding (07:00)" : "🌆 Evening Feeding (18:00)";
        const desc = slot === "AM"
          ? "Feed all pigs by 7:00 AM and log the feeding entry."
          : "Feed all pigs by 6:00 PM and log the feeding entry.";
        const fedToday = feeds.some(f => f.workerId === (w.uid || w.id) && f.date === today);

        if (!exists) {
          updated.push({
            id: taskId, title, desc,
            workerId: w.uid || w.id,
            priority: "High", due: today,
            createdBy: "🤖 AI Auto-Task", createdAt: today,
            status: fedToday ? "done" : "pending",
            autoFeed: true, slot,
          });
          changed = true;
        } else if (exists.status === "pending" && fedToday) {
          const idx = updated.findIndex(t => t.id === taskId);
          if (idx >= 0) { updated[idx] = { ...updated[idx], status: "done", autoCompletedAt: new Date().toISOString() }; changed = true; }
        }
      });
    });

    if (changed) { setTasks(updated); fsSet("tasks", updated); }
  }, [users, feeds, tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ─── Worker Task Chart ─────────────────────────────────────────── */
export function WorkerTaskChart({ users, tasks }) {
  const workers = users.filter(u => u.role === "worker" && u.approved);
  if (workers.length === 0) return null;
  const today = toDay();

  const data = workers.map(w => {
    const myTasks = tasks.filter(t => t.workerId === (w.uid || w.id));
    const pending = myTasks.filter(t => t.status === "pending");
    const done = myTasks.filter(t => t.status === "done");
    const overdue = pending.filter(t => t.due && t.due < today);
    return { w, pending: pending.length, done: done.length, overdue: overdue.length, total: myTasks.length };
  });
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 Worker Task Overview</div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 14 }}>Tasks assigned per worker · Today's feeding status</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {data.map(({ w, pending, done, overdue, total }) => {
          const pct = total > 0 ? (done / total) * 100 : 0;
          const amFedToday = tasks.some(t => t.workerId === (w.uid || w.id) && t.autoFeed && t.slot === "AM" && t.status === "done" && t.due === today);
          const pmFedToday = tasks.some(t => t.workerId === (w.uid || w.id) && t.autoFeed && t.slot === "PM" && t.status === "done" && t.due === today);
          return (
            <div key={w.uid || w.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#16a34a,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>
                      <span style={{ color: amFedToday ? C.accent : C.red }}>{amFedToday ? "✅" : "⏳"} 07:00</span>
                      <span style={{ margin: "0 5px", color: C.border }}>·</span>
                      <span style={{ color: pmFedToday ? C.accent : C.red }}>{pmFedToday ? "✅" : "⏳"} 18:00</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11 }}>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{done}</span>
                  <span style={{ color: C.faint }}> / {total} done</span>
                  {overdue > 0 && <span style={{ color: C.red, fontWeight: 700, marginLeft: 6 }}>⚠️ {overdue} overdue</span>}
                </div>
              </div>
              <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: pct + "%",
                  background: pct === 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : pct > 50 ? "linear-gradient(90deg,#f59e0b,#16a34a)" : "linear-gradient(90deg,#ef4444,#f59e0b)",
                  borderRadius: 4, transition: "width .5s",
                }} />
              </div>
              {pending > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {tasks.filter(t => t.workerId === (w.uid || w.id) && t.status === "pending").slice(0, 4).map(t => (
                    <span key={t.id} style={{
                      fontSize: 9, padding: "2px 7px", borderRadius: 10,
                      background: t.autoFeed ? "rgba(22,163,74,.1)" : "rgba(99,102,241,.1)",
                      color: t.autoFeed ? C.accent : "#6366f1", fontWeight: 600,
                      border: "1px solid " + (t.autoFeed ? "rgba(22,163,74,.2)" : "rgba(99,102,241,.2)"),
                    }}>{t.autoFeed ? "🤖" : ""}{t.title.length > 22 ? t.title.slice(0, 22) + "…" : t.title}</span>
                  ))}
                  {pending > 4 && <span style={{ fontSize: 9, color: C.faint, padding: "2px 5px" }}>+{pending - 4} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid " + C.border }}>
        {[["🤖 AI Auto Task", "rgba(22,163,74,.2)", C.accent], ["📋 Manual Task", "rgba(99,102,241,.2)", "#6366f1"], ["⚠️ Overdue", "rgba(239,68,68,.2)", C.red]].map(([l, bg, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: c }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: "1px solid " + c }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TaskManager (main component) ──────────────────────────────── */
export default function TaskManager({ user, users, tasks, setTasks, feeds }) {
  const isAdmin = isAdminUser(user);
  const workers = users.filter(u => u.role === "worker" && u.approved);
  const [form, setForm] = useState({ title: "", desc: "", workerId: "", priority: "Normal", due: toDay() });
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("all");
  const myTasks = isAdmin ? tasks : tasks.filter(t => t.workerId === user.id);

  useAutoFeedingTasks(tasks, setTasks, users, feeds || []);

  async function addTask() {
    if (!form.title || (isAdmin && !form.workerId)) return;
    const newTask = { ...form, id: uid(), createdBy: user.name, createdAt: toDay(), status: "pending", workerId: isAdmin ? form.workerId : user.id };
    const updated = [...tasks, newTask];
    setTasks(updated);
    fsSet("tasks", updated);
    try {
      window._addAuditLog?.("add", `Task created: "${newTask.title}" assigned to ${users.find(u => (u.uid || u.id) === newTask.workerId)?.name || "worker"}`);
      setSaved(true);
      setTimeout(() => { setSaved(false); setForm({ title: "", desc: "", workerId: "", priority: "Normal", due: toDay() }); }, 2000);
    } catch (e) { console.error("task save error", e); }
  }

  async function updateStatus(id, status) {
    const tsk = tasks.find(t => t.id === id);
    const updated = tasks.map(t => t.id === id ? { ...t, status, completedAt: status === "done" ? toDay() : undefined } : t);
    setTasks(updated);
    fsSet("tasks", updated);
    window._addAuditLog?.(status === "done" ? "edit" : "edit", `Task ${status === "done" ? "completed" : "re-opened"}: "${tsk?.title || id}"`);
    try {
      const data = await getOnlineFarmData() || {};
      await setOnlineFarmData({ ...data, tasks: updated });
    } catch (e) { console.error("task update error", e); }
  }

  const pending = myTasks.filter(t => t.status === "pending");
  const done = myTasks.filter(t => t.status === "done");
  const priorityColor = { High: C.red, Normal: C.accent, Low: C.muted };
  const today = toDay();

  return (
    <div>
      <div style={S.h1}>✅ Task Manager</div>
      <div style={S.sub}>{pending.length} pending · {done.length} completed · 🤖 AI auto-generates daily feeding reminders</div>

      {isAdmin && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["all", "📋 All Tasks"], ["chart", "📊 Worker Chart"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontWeight: 700, fontSize: 12,
              background: tab === id ? "linear-gradient(135deg,#16a34a,#10b981)" : "rgba(22,163,74,.08)",
              color: tab === id ? "#fff" : C.accent,
            }}>{lbl}</button>
          ))}
        </div>
      )}

      {isAdmin && tab === "chart" && <WorkerTaskChart users={users} tasks={tasks} />}

      {tab === "all" && (
        <>
          {isAdmin && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>➕ Assign New Task</div>
              {saved && <div style={{ padding: 8, background: C.accentSoft, borderRadius: 7, marginBottom: 10, color: C.accent, fontSize: 13 }}>✓ Task assigned!</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={S.lbl}>Task Title *</label>
                  <input placeholder="e.g. Clean pig pens" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.inp} />
                </div>
                <div>
                  <label style={S.lbl}>Assign To *</label>
                  <select value={form.workerId} onChange={e => setForm({ ...form, workerId: e.target.value })} style={S.inp}>
                    <option value="">Select worker</option>
                    {workers.map(w => <option key={w.uid || w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={S.inp}>
                    {["High", "Normal", "Low"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Due Date</label>
                  <input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} style={S.inp} />
                </div>
                <div>
                  <label style={S.lbl}>Description</label>
                  <input placeholder="Details..." value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} style={S.inp} />
                </div>
              </div>
              <button onClick={addTask} style={{ ...S.btn(), width: "100%", padding: 11, fontSize: 14 }}>Assign Task →</button>
            </div>
          )}

          <div style={{ padding: "10px 14px", background: "rgba(22,163,74,.05)", border: "1px solid rgba(22,163,74,.2)", borderRadius: 9, marginBottom: 14, fontSize: 12, color: C.muted }}>
            🤖 <strong style={{ color: C.accent }}>AI Auto-Tasks:</strong> Two daily feeding tasks (07:00 &amp; 18:00) are automatically assigned to each worker every day. They are marked ✅ Done automatically when the worker logs a feed entry.
          </div>

          {pending.length === 0 && (
            <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: "center" }}>
              {isAdmin ? "No pending tasks. Assign one above!" : "No tasks assigned to you yet."}
            </div>
          )}

          {pending.map(t => {
            const worker = users.find(u => u.id === t.workerId);
            const overdue = t.due && t.due < today;
            return (
              <div key={t.id} style={{ ...S.card, marginBottom: 10, border: "1px solid " + (overdue ? "rgba(239,68,68,.3)" : t.autoFeed ? "rgba(22,163,74,.25)" : C.border) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      {t.autoFeed && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, background: "rgba(22,163,74,.12)", color: C.accent, fontWeight: 700 }}>🤖 AUTO</span>}
                      {t.title}
                    </div>
                    {t.desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.desc}</div>}
                  </div>
                  <span style={{ padding: "2px 9px", borderRadius: 12, background: priorityColor[t.priority] + "22", color: priorityColor[t.priority], fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{t.priority}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.faint, marginBottom: 10 }}>
                  <span>👤 {worker?.name || "—"} · 📅 Due: <span style={{ color: overdue ? C.red : C.muted, fontWeight: overdue ? 700 : 400 }}>{t.due}{overdue ? " ⚠️ OVERDUE" : ""}</span></span>
                  <span style={{ color: t.autoFeed ? C.accent : C.faint }}>{t.autoFeed ? "🤖 AI" : "By: " + t.createdBy}</span>
                </div>
                <button onClick={() => updateStatus(t.id, "done")} style={{ ...S.btn(C.accent), fontSize: 12, padding: "6px 14px", width: "100%" }}>✓ Mark as Done</button>
                {isAdmin && !t.autoFeed && (
                  <button onClick={() => {
                    if (window.confirm("Delete this task?")) {
                      const updated = tasks.filter(x => x.id !== t.id);
                      setTasks(updated); fsSet("tasks", updated);
                      window._addAuditLog?.("delete", `Task deleted: "${t.title}"`);
                    }
                  }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, cursor: "pointer", fontFamily: "inherit", marginTop: 6, width: "100%" }}>
                    🗑️ Delete Task
                  </button>
                )}
              </div>
            );
          })}

          {done.length > 0 && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>✅ Completed ({done.length})</div>
                {isAdmin && (
                  <button onClick={() => {
                    if (!window.confirm(`Delete all ${done.length} completed task(s)?`)) return;
                    const updated = tasks.filter(t => t.status !== "done");
                    setTasks(updated); fsSet("tasks", updated);
                    window._addAuditLog?.("delete", `${done.length} completed tasks cleared`);
                  }} style={{ fontSize: 11, padding: "4px 11px", borderRadius: 6, border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.07)", color: C.red, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    🗑️ Clear All Completed
                  </button>
                )}
              </div>
              {done.slice().reverse().map(t => {
                const worker = users.find(u => u.id === t.workerId);
                return (
                  <div key={t.id} style={{ ...S.row, opacity: .7 }}>
                    <span style={{ color: C.muted, fontSize: 12, textDecoration: "line-through" }}>{t.title} · {worker?.name || "—"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: C.accent, fontSize: 11 }}>{t.autoFeed ? "🤖 " : ""}✓ Done</span>
                      {isAdmin && (
                        <button onClick={() => {
                          const updated = tasks.filter(x => x.id !== t.id);
                          setTasks(updated); fsSet("tasks", updated);
                          window._addAuditLog?.("delete", `Task deleted: "${t.title}"`);
                        }} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
