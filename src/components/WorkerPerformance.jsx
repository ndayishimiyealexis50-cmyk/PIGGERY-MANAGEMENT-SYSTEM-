/**
 * WorkerPerformance.jsx
 * Migrated from index.html §17 WORKER PERFORMANCE
 *
 * Props (admin):  users, logs, feeds, sales
 * Props (worker): pass pre-filtered arrays for the single worker
 *
 * No Firebase calls — read-only analytics over passed arrays.
 */

import { C, S } from "../styles";

const fmtRWF = (n) => "RWF " + Math.round(n || 0).toLocaleString();

export default function WorkerPerformance({ users, logs, feeds, sales }) {
  const workers = users.filter(u => u.role === "worker" && u.approved);
  const today = new Date();
  const workdays = 30;

  function score(w) {
    const wLogs  = logs.filter(l => l.workerId === (w.uid || w.id));
    const wFeeds = feeds.filter(f => f.workerId === (w.uid || w.id));
    const wSales = sales.filter(s => s.workerId === (w.uid || w.id));
    const daysReported = new Set(wLogs.map(l => l.date)).size;
    const attendance = Math.round((daysReported / workdays) * 100);
    const pts = Math.min(100, Math.round((daysReported * 3) + (wFeeds.length * 2) + (wSales.length * 5)));
    const revenue = wSales.reduce((s, x) => s + (x.total || 0), 0);
    const sick = wLogs.reduce((s, l) => s + (l.sick || 0), 0);
    return { logs: wLogs.length, feeds: wFeeds.length, sales: wSales.length, attendance, pts, revenue, sick, daysReported };
  }

  const ranked = workers.map(w => ({ ...w, ...score(w) })).sort((a, b) => b.pts - a.pts);
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div style={S.h1}>👷 Worker Performance</div>
      <div style={S.sub}>Last 30 days · Ranked by performance score</div>

      {workers.length === 0 && (
        <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: "center" }}>No workers yet.</div>
      )}

      {ranked.map((w, i) => {
        const color = i === 0 ? C.amber : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : C.accent;
        const pct = Math.min(100, w.pts);
        return (
          <div key={w.uid || w.id} style={{ ...S.card, marginBottom: 12, border: i === 0 ? "1.5px solid rgba(245,158,11,.4)" : "1px solid " + C.border }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{medal[i] || "👤"}</span>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>@{w.username}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{w.pts}</div>
                <div style={{ fontSize: 10, color: C.faint }}>SCORE</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: C.elevated, borderRadius: 6, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 6, transition: "width .4s" }} />
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {[
                ["📅 Attendance", w.attendance + "%", w.attendance >= 80 ? C.accent : w.attendance >= 50 ? C.amber : C.red],
                ["📝 Reports",   w.logs,  C.accent],
                ["🌾 Feedings",  w.feeds, C.amber],
                ["🏷️ Sales",    w.sales, "#10b981"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: "7px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>

            {w.revenue > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>
                💰 Revenue: {fmtRWF(w.revenue)}
              </div>
            )}
            {w.sick > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: C.red }}>
                ⚠️ Reported {w.sick} sick pig(s)
              </div>
            )}
          </div>
        );
      })}

      {/* Attendance summary */}
      {workers.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📅 Attendance — Last 30 Days</div>
          {ranked.map(w => (
            <div key={w.uid || w.id} style={{ ...S.row, marginBottom: 8 }}>
              <span style={{ color: C.text, fontSize: 13 }}>{w.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 5, background: C.elevated, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: w.attendance + "%", background: w.attendance >= 80 ? C.accent : w.attendance >= 50 ? C.amber : C.red, borderRadius: 5 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: w.attendance >= 80 ? C.accent : w.attendance >= 50 ? C.amber : C.red, minWidth: 35 }}>{w.attendance}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
