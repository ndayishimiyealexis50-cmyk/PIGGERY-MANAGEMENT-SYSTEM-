import { useState } from "react";
import { isAdminUser, fsSet, fmtRWF, fmtNum, C, S } from "../utils";
import AIPrediction from "./AIPrediction";
import PDFBtn from "./PDFBtn";

export default function FeedLog({ feeds, setFeeds, pigs, logs, sales, expenses, incomes, allData, user }) {
  const [tab, setTab] = useState("records");
  const [filterWorker, setFilterWorker] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const isAdmin = isAdminUser(user);

  // ── Core Calculations ──
  const totalKg = feeds.reduce((s, f) => s + (parseFloat(f.kg) || 0), 0);
  const totalCost = feeds.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
  const avgCostPerKg = totalKg > 0 ? Math.round(totalCost / totalKg) : 0;
  const active = pigs.filter(p => p.status === "active");

  // Stage-based expected daily feed
  const STAGE_FEED = { Piglet: 0.5, Weaner: 1.0, Grower: 1.8, Finisher: 2.8, Gilt: 2.2, Sow: 2.5, Boar: 2.0 };
  const expectedDailyKg = Math.round(active.reduce((s, p) => s + (STAGE_FEED[p.stage] || 2.0), 0) * 10) / 10;

  // Actual average daily feed from logs
  const logDates = feeds.length > 0 ? new Set(feeds.map(f => f.date)).size : 1;
  const actualDailyKg = logDates > 0 ? Math.round((totalKg / logDates) * 10) / 10 : 0;

  // Per-type breakdown
  const byType = {};
  feeds.forEach(f => {
    const t = f.feedType || "Other";
    if (!byType[t]) byType[t] = { kg: 0, cost: 0, count: 0 };
    byType[t].kg += parseFloat(f.kg) || 0;
    byType[t].cost += parseFloat(f.cost) || 0;
    byType[t].count++;
  });

  // Per-worker breakdown
  const byWorker = {};
  feeds.forEach(f => {
    const w = f.worker || "Unknown";
    if (!byWorker[w]) byWorker[w] = { kg: 0, cost: 0, count: 0 };
    byWorker[w].kg += parseFloat(f.kg) || 0;
    byWorker[w].cost += parseFloat(f.cost) || 0;
    byWorker[w].count++;
  });

  // Monthly totals
  const monthMap = {};
  feeds.forEach(f => {
    const m = (f.date || "").slice(0, 7);
    if (!m) return;
    if (!monthMap[m]) monthMap[m] = { kg: 0, cost: 0 };
    monthMap[m].kg += parseFloat(f.kg) || 0;
    monthMap[m].cost += parseFloat(f.cost) || 0;
  });
  const months = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  // Feed efficiency
  const efficiencyPct = expectedDailyKg > 0 && actualDailyKg > 0 ? Math.round((actualDailyKg / expectedDailyKg) * 100) : null;
  const effColor = efficiencyPct === null ? C.faint : efficiencyPct >= 90 && efficiencyPct <= 115 ? C.accent : efficiencyPct < 80 ? C.red : C.amber;

  // Filtered records
  const allWorkers = [...new Set(feeds.map(f => f.worker || "Unknown"))];
  const allTypes = [...new Set(feeds.map(f => f.feedType || "Other"))];
  const filtered = feeds.slice().reverse().filter(f => {
    if (filterWorker && f.worker !== filterWorker) return false;
    if (filterType && f.feedType !== filterType) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <div style={S.h1}>🌾 Feeding Records</div>
          <div style={S.sub}>{feeds.length} logs · {Math.round(totalKg * 10) / 10}kg fed · {fmtRWF(totalCost)} total cost</div>
        </div>
        <PDFBtn label="Health PDF" type="health" getData={() => allData} icon="🌾" color="#374151" />
      </div>

      {/* ── Summary Stats ── */}
      <div style={S.g4}>
        {[
          { l: "Total Feed (kg)", v: fmtNum(Math.round(totalKg)), c: C.accent },
          { l: "Total Cost", v: fmtRWF(totalCost), c: C.amber },
          { l: "Avg Cost/kg", v: "RWF " + fmtNum(avgCostPerKg), c: C.blue },
          { l: "Feed Efficiency", v: efficiencyPct !== null ? efficiencyPct + "%" : "—", c: effColor },
        ].map(s => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: s.v.length > 9 ? 14 : 20 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Feed vs Expected Banner ── */}
      {active.length > 0 && expectedDailyKg > 0 && (
        <div style={{ ...S.card, padding: 14, marginBottom: 14, background: "rgba(22,163,74,.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, fontWeight: 700, color: C.accent }}>
            <span>📊 Actual vs Expected Daily Feed</span>
            <span style={{ color: effColor }}>{efficiencyPct !== null ? efficiencyPct + "% of target" : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12, marginBottom: 8 }}>
            {[
              ["🎯 Expected/day", expectedDailyKg + "kg", "(stage-based)"],
              ["📦 Actual avg/day", actualDailyKg + "kg", "(from logs)"],
              ["💰 Cost/pig/day", active.length > 0 ? fmtRWF(Math.round(totalCost / Math.max(logDates, 1) / active.length)) : "—", "per head"],
            ].map(([l, v, h]) => (
              <div key={l} style={{ background: "#fff", borderRadius: 7, padding: "7px 10px", border: "1px solid " + C.border }}>
                <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{v}</div>
                <div style={{ fontSize: 9, color: C.faint }}>{h}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>Expected feed by stage today:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(STAGE_FEED).filter(([stage]) => active.some(p => p.stage === stage)).map(([stage, kg]) => {
              const count = active.filter(p => p.stage === stage).length;
              return (
                <span key={stage} style={{ padding: "3px 9px", borderRadius: 12, background: C.elevated, border: "1px solid " + C.border, fontSize: 11, color: C.text }}>
                  {stage}: {count}×{kg}kg = <strong>{Math.round(count * kg * 10) / 10}kg</strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: "1px solid " + C.border }}>
        {[["records", "📋 All Records"], ["bytype", "🌾 By Feed Type"], ["byworker", "👷 By Worker"], ["monthly", "📅 Monthly"]].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── ALL RECORDS ── */}
      {tab === "records" && (
        <div>
          {feeds.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Filter by Worker</label>
                <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={S.inp}>
                  <option value="">All Workers</option>
                  {allWorkers.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Filter by Feed Type</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} style={S.inp}>
                  <option value="">All Types</option>
                  {allTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
          {filtered.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: "center", padding: 30 }}>No records match filters.</div>}
          {filtered.map((f, i) => {
            const pig = pigs.find(p => p.id === f.pigId);
            const cpk = f.kg > 0 ? Math.round(f.cost / f.kg) : 0;
            const cpkColor = cpk > 0 && avgCostPerKg > 0 ? (cpk > avgCostPerKg * 1.2 ? C.red : cpk < avgCostPerKg * 0.8 ? C.accent : C.muted) : C.muted;
            return (
              <div key={i} style={{ ...S.card, marginBottom: 8, padding: "10px 14px" }}>
                {editId === f.id && editForm ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div><label style={S.lbl}>Amount (kg)</label><input type="number" value={editForm.kg} onChange={e => setEditForm({ ...editForm, kg: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Cost (RWF)</label><input type="number" value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Feed Type</label><input value={editForm.feedType} onChange={e => setEditForm({ ...editForm, feedType: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={S.inp} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        setFeeds(p => {
                          const updated = p.map(x => x.id === f.id ? { ...x, ...editForm, kg: parseFloat(editForm.kg) || x.kg, cost: parseFloat(editForm.cost) || x.cost } : x);
                          fsSet("feeds", updated);
                          return updated;
                        });
                        setEditId(null); setEditForm(null);
                      }} style={{ ...S.btn(C.accent), flex: 1, padding: "7px", fontSize: 12 }}>✓ Save</button>
                      <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...S.btn("#374151"), flex: 1, padding: "7px", fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{f.feedType || "Feed"} <span style={{ color: C.faint, fontWeight: 400, fontSize: 11 }}>— {f.worker}</span></div>
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>
                        {f.date} {pig ? " · 🐷 " + pig.tag : " · All pigs"} {f.notes ? " · " + f.notes : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: C.amber, fontSize: 14 }}>{f.kg}kg · {fmtRWF(f.cost)}</div>
                      <div style={{ fontSize: 10, color: cpkColor, marginTop: 2 }}>RWF {fmtNum(cpk)}/kg {cpk > avgCostPerKg * 1.2 ? "⚠️ above avg" : cpk > 0 && cpk < avgCostPerKg * 0.8 ? "✅ below avg" : ""}</div>
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 5, marginTop: 5, justifyContent: "flex-end" }}>
                          <button onClick={() => { setEditId(f.id); setEditForm({ kg: String(f.kg), cost: String(f.cost), feedType: f.feedType, date: f.date }); }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid " + C.border, background: "transparent", color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                          <button onClick={() => { if (window.confirm("Delete this feed record?")) setFeeds(p => { const updated = p.filter(x => x.id !== f.id); fsSet("feeds", updated); return updated; }); }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > 0 && (
            <div style={{ ...S.card, padding: "10px 14px", background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: C.muted }}>Showing {filtered.length} records</span>
                <span style={{ color: C.amber, fontWeight: 700 }}>Total: {Math.round(filtered.reduce((s, f) => s + (f.kg || 0), 0) * 10) / 10}kg · {fmtRWF(filtered.reduce((s, f) => s + (f.cost || 0), 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BY FEED TYPE ── */}
      {tab === "bytype" && (
        <div>
          {Object.keys(byType).length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No feed records yet.</div>}
          {Object.entries(byType).sort((a, b) => b[1].cost - a[1].cost).map(([type, data]) => {
            const cpk = data.kg > 0 ? Math.round(data.cost / data.kg) : 0;
            const pct = totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : 0;
            return (
              <div key={type} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>🌾 {type}</div>
                  <span style={{ padding: "2px 9px", borderRadius: 12, background: "rgba(245,158,11,.1)", color: C.amber, fontSize: 11, fontWeight: 700 }}>{pct}% of cost</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, fontSize: 12 }}>
                  {[["Sessions", data.count], ["Total (kg)", Math.round(data.kg * 10) / 10], ["Total Cost", fmtRWF(data.cost)], ["Avg Cost/kg", "RWF " + fmtNum(cpk)]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: C.text }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, height: 5, background: C.elevated, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", background: C.amber, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BY WORKER ── */}
      {tab === "byworker" && (
        <div>
          {Object.keys(byWorker).length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No feed records yet.</div>}
          {Object.entries(byWorker).sort((a, b) => b[1].kg - a[1].kg).map(([worker, data]) => {
            const cpk = data.kg > 0 ? Math.round(data.cost / data.kg) : 0;
            const pct = totalKg > 0 ? ((data.kg / totalKg) * 100).toFixed(1) : 0;
            return (
              <div key={worker} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: C.text }}>👷 {worker}</div>
                  <span style={{ color: C.blue, fontSize: 12, fontWeight: 600 }}>{data.count} sessions · {pct}% of total feed</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 12 }}>
                  {[["Total (kg)", Math.round(data.kg * 10) / 10 + "kg"], ["Total Cost", fmtRWF(data.cost)], ["Avg Cost/kg", "RWF " + fmtNum(cpk)]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MONTHLY ── */}
      {tab === "monthly" && (
        <div>
          {months.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No data yet.</div>}
          {months.map(([m, data]) => {
            const cpk = data.kg > 0 ? Math.round(data.cost / data.kg) : 0;
            return (
              <div key={m} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: C.text }}>{m}</div>
                  <div style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>{fmtRWF(data.cost)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                  {[["Total (kg)", Math.round(data.kg * 10) / 10 + "kg"], ["Total Cost", fmtRWF(data.cost)], ["Avg Cost/kg", "RWF " + fmtNum(cpk)]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: C.text }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: "6px 0 12px" }}>✦ AI Feed Optimization</div>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes}
        topic="Optimal feed per pig stage, cost savings, weight gain forecast, best suppliers Rwanda."
        label="Feed Optimization" icon="🌾" />
    </div>
  );
}
