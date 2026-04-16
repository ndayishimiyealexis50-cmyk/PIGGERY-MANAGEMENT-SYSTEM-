// pages/AHome.jsx
// ─── Admin Dashboard — Farm Overview ─────────────────────────────────────────
// Port of FarmIQ §17 AHome component to Vite + React.
//
// REQUIRED IMPORTS (adjust paths to match your project layout):
//   src/utils/helpers.js   — calcPnL, calcCapitalBalance, getMarketPrice,
//                            getMarketSurveys, daysDiff, fmtRWF, toDay
//   src/firebase.js        — db (Firestore), getOnlineFarmData, FS_FARM_DOC
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  calcPnL,
  calcCapitalBalance,
  getMarketPrice,
  getMarketSurveys,
  daysDiff,
  fmtRWF,
  toDay,
} from "../utils/helpers";

// ── Firestore import — choose ONE depending on your SDK version ───────────────
// Firestore v9 modular (recommended):
import { setDoc } from "firebase/firestore";
import { getOnlineFarmData, FS_FARM_DOC } from "../lib/firebase";
// Firestore v8 (legacy): just keep the original import above and use FS_FARM_DOC.set(...)

// ─── Design Tokens (mirrors FarmIQ C / S constants) ─────────────────────────
const C = {
  base:    "#f0f4f0",
  surface: "#ffffff",
  card:    "#ffffff",
  elevated:"#f4f7f4",
  border:  "#dde7dd",
  accent:  "#16a34a",
  text:    "#111a11",
  muted:   "#3d5040",
  faint:   "#526b58",
  red:     "#dc2626",
  amber:   "#d97706",
  blue:    "#2563eb",
  purple:  "#7c3aed",
  pink:    "#db2777",
};

const S = {
  card: {
    background:   C.surface,
    border:       `1px solid ${C.border}`,
    borderRadius: 16,
    padding:      20,
    marginBottom: 14,
    boxShadow:    "0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05)",
    transition:   "box-shadow .2s,border-color .2s",
  },
  h1:  { fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4, letterSpacing: -.4 },
  g2:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  inp: {
    background: "#fff", border: `1.5px solid ${C.border}`, color: C.text,
    borderRadius: 9, padding: "9px 12px", width: "100%", fontSize: 13,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    transition: "border-color .2s",
  },
  btn: (bg) => ({
    padding: "8px 16px", borderRadius: 9, border: "none",
    background: bg || C.accent, color: "#fff",
    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
    transition: "opacity .15s,transform .12s", boxShadow: "0 2px 6px rgba(0,0,0,.12)",
  }),
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 14px", background: C.elevated, borderRadius: 9, marginBottom: 5,
    fontSize: 13, border: `1px solid ${C.border}`, transition: "background .18s",
  },
};

// Month label lookup
const MON_LBL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STAGE_ICONS  = { Piglet:"🐣", Weaner:"🐷", Grower:"🐖", Finisher:"🥩", Gilt:"♀️", Sow:"🐗", Boar:"♂️" };
const STAGE_COLORS = { Piglet:"#f59e0b", Weaner:"#10b981", Grower:"#16a34a", Finisher:"#2563eb", Gilt:"#ec4899", Sow:"#8b5cf6", Boar:"#6366f1" };
const DONUT_COLORS = ["#16a34a","#f59e0b","#6366f1","#ec4899","#64748b"];

// ─── AHome ───────────────────────────────────────────────────────────────────
// FIX 1: All array props default to [] and capital defaults to a safe object.
// This prevents crashes when data is still loading or Firestore times out.
export default function AHome({
  pigs          = [],
  feeds         = [],
  sales         = [],
  logs          = [],
  users         = [],
  expenses      = [],
  incomes       = [],
  reproductions = [],
  stock         = [],
  allData,
  setPage,
  capital       = { initial: 0, transactions: [] },
  setCapital,
}) {
  const [showCapitalSet, setShowCapitalSet] = useState(false);
  const [newInitial,     setNewInitial]     = useState("");
  const [fixDone,        setFixDone]        = useState(false);
  const [fixing,         setFixing]         = useState(false);

  // FIX 2: Loading state — show a spinner if critical data hasn't arrived yet.
  const isLoading = !pigs || !feeds || !sales;
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
        <div style={{ fontSize: 40 }}>🌱</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>Loading farm data…</div>
        <div style={{ fontSize: 12, color: C.faint }}>Please wait while your dashboard syncs.</div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const safeCapital     = capital && typeof capital === "object" ? capital : { initial: 0, transactions: [] };
  const active          = pigs.filter(p => p.status === "active");
  const { totalInc, totalExp, profit } = calcPnL(safeCapital, feeds, sales, expenses, incomes);
  const hasSurveys      = getMarketSurveys().length > 0;
  const herdValue       = active.reduce((s, pig) => s + getMarketPrice(pig.stage, pig.weight), 0);
  const pregnant        = reproductions.filter(r => r.status === "pregnant");
  const lowStock        = stock.filter(s => s.quantity <= s.minLevel);
  const upcomingFarrows = pregnant.filter(r => daysDiff(r.expectedFarrow) <= 7 && daysDiff(r.expectedFarrow) >= 0);
  const capitalBalance  = calcCapitalBalance(safeCapital, feeds, sales, expenses, incomes);
  const expectedBalance = (safeCapital.initial || 0) + totalInc - totalExp;
  const hasMismatch     = capitalBalance !== expectedBalance;

  const recentActivity = [
    ...feeds.map(f => ({ ...f, type: "feed" })),
    ...sales.map(s => ({ ...s, type: "sale" })),
    ...logs.map(l  => ({ ...l, type: "log"  })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);

  // ── Monthly chart data (last 6 months) ───────────────────────────────────
  const monthlyMap = {};
  [
    ...sales.map(s    => ({ date: s.date, inc: s.total    || 0, exp: 0 })),
    ...incomes.map(i  => ({ date: i.date, inc: i.amount   || 0, exp: 0 })),
    ...feeds.map(f    => ({ date: f.date, inc: 0, exp: f.cost  || 0 })),
    ...expenses.map(e => ({ date: e.date, inc: 0, exp: e.amount|| 0 })),
  ].forEach(item => {
    const m = (item.date || "").slice(0, 7); if (!m) return;
    if (!monthlyMap[m]) monthlyMap[m] = { inc: 0, exp: 0 };
    monthlyMap[m].inc += item.inc;
    monthlyMap[m].exp += item.exp;
  });
  const months6     = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const maxMonthVal = Math.max(...months6.map(([, v]) => Math.max(v.inc, v.exp, 1)), 1);

  // ── Expense breakdown ─────────────────────────────────────────────────────
  const expByCat = {};
  feeds.forEach(f    => { expByCat["Feed"] = (expByCat["Feed"] || 0) + (f.cost   || 0); });
  expenses.forEach(e => { const k = e.category || "Other"; expByCat[k] = (expByCat[k] || 0) + (e.amount || 0); });
  const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ── Herd stage breakdown ──────────────────────────────────────────────────
  const stageMap = {};
  active.forEach(p => { stageMap[p.stage] = (stageMap[p.stage] || 0) + 1; });
  const stageData = Object.entries(stageMap).sort((a, b) => b[1] - a[1]);

  // ── Fix capital handler ───────────────────────────────────────────────────
  // FIX 3: Updated to Firestore v9 modular syntax (setDoc instead of .set()).
  // If you are on Firestore v8, replace `await setDoc(FS_FARM_DOC, {...})` 
  // with `await FS_FARM_DOC.set({...})`.
  async function fixCapital() {
    setFixing(true);
    try {
      setCapital(prev => ({ ...prev, transactions: [] }));
      const freshAll       = await getOnlineFarmData() || {};
      const cleanedCapital = { ...(freshAll.capital || { initial: 0 }), transactions: [], _wiped: true };
      // Firestore v9:
      await setDoc(FS_FARM_DOC, { ...freshAll, capital: cleanedCapital, updatedAt: new Date().toISOString() });
      // Firestore v8 (uncomment if needed):
      // await FS_FARM_DOC.set({ ...freshAll, capital: cleanedCapital, updatedAt: new Date().toISOString() });
      setFixDone(true);
      setTimeout(() => setFixDone(false), 5000);
    } catch (e) {
      alert("Fix failed: " + e.message);
    }
    setFixing(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,rgba(22,163,74,.15),rgba(22,163,74,.07))", border: "1px solid rgba(22,163,74,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 2px 12px rgba(22,163,74,.1)" }}>
          📊
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: -.4 }}>Farm Overview</div>
          <div style={{ fontSize: 12, color: C.faint }}>{toDay()} · FarmIQ Management</div>
        </div>
      </div>

      {/* ── Capital Banner ── */}
      <div style={{ background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)", borderRadius: 14, padding: "18px 22px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, boxShadow: "0 8px 28px rgba(0,0,0,.2)", position: "relative", overflow: "hidden" }}>
        {/* Glow orb */}
        <div style={{ position: "absolute", top: -30, right: -20, width: 140, height: 140, background: "radial-gradient(circle,rgba(74,222,128,.12) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div>
          <div style={{ fontSize: 10, color: "rgba(74,222,128,.7)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5 }}>💵 Business Capital Balance</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: capitalBalance >= 0 ? "#4ade80" : "#f87171", letterSpacing: -.5 }}>
            {fmtRWF(capitalBalance)}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
            Initial: {fmtRWF(safeCapital.initial || 0)} · Income: {fmtRWF(totalInc)} · Expenses: {fmtRWF(totalExp)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setShowCapitalSet(!showCapitalSet); setNewInitial(String(safeCapital.initial || "")); }}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(74,222,128,.35)", background: "rgba(74,222,128,.1)", color: "#4ade80", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
          >
            ⚙️ Set Capital
          </button>
          <button
            onClick={() => setPage("capital")}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(74,222,128,.35)", background: "rgba(74,222,128,.1)", color: "#4ade80", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
          >
            📋 View All
          </button>
          <button
            onClick={fixCapital}
            disabled={fixing}
            style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.15)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
          >
            {fixing ? "⏳ Fixing..." : "🔧 Fix Balance"}
          </button>
        </div>
      </div>

      {/* ── Mismatch Alert ── */}
      {hasMismatch && (
        <div style={{ padding: "14px 16px", background: "rgba(239,68,68,.1)", border: "2px solid rgba(239,68,68,.4)", borderRadius: 12, marginBottom: 12, animation: "pulse 2s ease-in-out infinite" }}>
          <div style={{ fontWeight: 700, color: "#f87171", fontSize: 14, marginBottom: 6 }}>⚠️ Capital Balance Mismatch Detected</div>
          <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>
            Expected: <strong>{fmtRWF(expectedBalance)}</strong> &nbsp;|&nbsp; Showing: <strong>{fmtRWF(capitalBalance)}</strong>
          </div>
          <button
            onClick={fixCapital}
            disabled={fixing}
            style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
          >
            {fixing ? "⏳ Fixing & Syncing to Server..." : "🔧 FIX CAPITAL BALANCE NOW →"}
          </button>
        </div>
      )}

      {/* ── Fix Done Banner ── */}
      {fixDone && (
        <div style={{ padding: "12px 16px", background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.4)", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#4ade80", fontWeight: 700 }}>
          ✅ Capital fixed! Balance now: {fmtRWF(expectedBalance)}
        </div>
      )}

      {/* ── Set Capital Inline Form ── */}
      {showCapitalSet && (
        <div style={{ ...S.card, marginBottom: 12, border: "1px solid rgba(74,222,128,.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>Set Initial Capital</div>
          <div style={{ display: "flex", gap: 9 }}>
            <input
              type="number"
              value={newInitial}
              onChange={e => setNewInitial(e.target.value)}
              placeholder="e.g. 500000"
              style={{ ...S.inp, flex: 1 }}
            />
            <button
              onClick={() => { setCapital(prev => ({ ...prev, initial: parseFloat(newInitial) || 0 })); setShowCapitalSet(false); }}
              style={{ ...S.btn(C.accent), padding: "9px 16px", whiteSpace: "nowrap" }}
            >
              Save
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>This sets your starting business capital before any transactions.</div>
        </div>
      )}

      {/* ── Smart Alerts ── */}
      {upcomingFarrows.length > 0 && (
        <div onClick={() => setPage("reproduction")} style={{ padding: "10px 14px", background: "rgba(244,114,182,.08)", border: "1px solid rgba(244,114,182,.3)", borderRadius: 9, marginBottom: 10, fontSize: 13, color: C.pink, cursor: "pointer" }}>
          🐖 {upcomingFarrows.length} farrowing(s) in ≤7 days → Click to view
        </div>
      )}
      {lowStock.length > 0 && (
        <div onClick={() => setPage("stock")} style={{ padding: "10px 14px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 9, marginBottom: 10, fontSize: 13, color: C.red, cursor: "pointer" }}>
          📦 {lowStock.length} low stock alert(s): {lowStock.map(s => s.name).join(", ")} → Click to restock
        </div>
      )}

      {/* ── KPI Tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { icon:"🐷", label:"Active Pigs",     value: active.length,                                                sub: `${active.filter(p => p.weight >= 80).length} ready to sell`,            color: C.accent, bg:"rgba(22,163,74,.07)",    border:"rgba(22,163,74,.18)" },
          { icon:"💚", label:"Total Income",     value: fmtRWF(totalInc),                                            sub: `${sales.length} pig sales`,                                              color:"#10b981", bg:"rgba(16,185,129,.06)",   border:"rgba(16,185,129,.18)" },
          { icon: profit >= 0 ? "✅" : "⚠️",
                        label:"Net Profit",      value: fmtRWF(profit),                                              sub: totalInc > 0 ? `${((profit / totalInc) * 100).toFixed(0)}% margin` : "—", color: profit >= 0 ? C.accent : C.red, bg: profit >= 0 ? "rgba(22,163,74,.06)" : "rgba(239,68,68,.06)", border: profit >= 0 ? "rgba(22,163,74,.18)" : "rgba(239,68,68,.18)" },
          { icon:"💎", label:"Herd Value",       value: hasSurveys ? fmtRWF(herdValue) : "No survey",                sub: hasSurveys ? "from market survey" : "Add a market survey",                color: C.purple, bg:"rgba(124,58,237,.06)",   border:"rgba(124,58,237,.18)" },
          { icon:"🤰", label:"Pregnant Sows",    value: pregnant.length,                                              sub: `${upcomingFarrows.length} due this week`,                                color: C.pink,   bg:"rgba(236,72,153,.05)",   border:"rgba(236,72,153,.18)" },
          { icon:"👷", label:"Workers",          value: users.filter(u => u.role === "worker" && u.approved).length, sub:"approved accounts",                                                       color: C.blue,   bg:"rgba(37,99,235,.05)",    border:"rgba(37,99,235,.15)" },
          { icon:"🌾", label:"Total Expenses",   value: fmtRWF(totalExp),                                            sub:"feed + operations",                                                       color: C.amber,  bg:"rgba(245,158,11,.05)",   border:"rgba(245,158,11,.18)" },
          { icon:"📋", label:"Logs Today",       value: logs.filter(l => l.date === toDay()).length,                 sub:"daily reports",                                                           color: C.muted,  bg:"rgba(0,0,0,.03)",        border: C.border },
        ].map(k => (
          <div
            key={k.label}
            className="card-hover"
            style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: "14px 14px 12px", cursor: "default", boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}
          >
            <div style={{ fontSize: 20, marginBottom: 7 }}>{k.icon}</div>
            <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontSize: typeof k.value === "string" && k.value.length > 9 ? 14 : 20, fontWeight: 800, color: k.color, lineHeight: 1.1, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: C.faint }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Monthly Bar Chart (Income vs Expenses) ── */}
      {months6.length > 0 && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            📈 Monthly Income vs Expenses
            <span style={{ fontSize: 10, color: C.faint, fontWeight: 400 }}>last {months6.length} months</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 110, paddingBottom: 20, position: "relative" }}>
            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map(pct => (
              <div key={pct} style={{ position: "absolute", left: 0, right: 0, bottom: 20 + pct * 0.9, height: 1, background: "rgba(0,0,0,.05)", zIndex: 0 }} />
            ))}
            {months6.map(([m, v]) => {
              const incH = maxMonthVal > 0 ? Math.round((v.inc / maxMonthVal) * 90) : 0;
              const expH = maxMonthVal > 0 ? Math.round((v.exp / maxMonthVal) * 90) : 0;
              const lbl  = MON_LBL[parseInt(m.split("-")[1]) - 1];
              return (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 90 }}>
                    <div
                      style={{ width: "42%", height: Math.max(incH, 2), background: "linear-gradient(180deg,#4ade80,#16a34a)", borderRadius: "3px 3px 0 0", transition: "height .5s cubic-bezier(.22,1,.36,1)" }}
                      title={`Income: ${fmtRWF(v.inc)}`}
                    />
                    <div
                      style={{ width: "42%", height: Math.max(expH, 2), background: "linear-gradient(180deg,#f87171,#dc2626)", borderRadius: "3px 3px 0 0", transition: "height .5s cubic-bezier(.22,1,.36,1)" }}
                      title={`Expenses: ${fmtRWF(v.exp)}`}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: C.faint, fontWeight: 600, position: "absolute", bottom: 2 }}>{lbl}</div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: C.faint }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#16a34a", display: "inline-block" }} /> Income
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#dc2626", display: "inline-block" }} /> Expenses
            </span>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: profit >= 0 ? C.accent : C.red }}>
              {profit >= 0 ? "✅" : "⚠️"} Net: {fmtRWF(profit)}
            </span>
          </div>
        </div>
      )}

      {/* ── 2-col: Expense Breakdown + Herd by Stage ── */}
      <div style={S.g2}>
        {/* Expense Breakdown */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 14 }}>🔴 Expense Breakdown</div>
          {topCats.length === 0
            ? <div style={{ color: C.faint, fontSize: 12, textAlign: "center", padding: 20 }}>No expenses yet.</div>
            : topCats.map(([cat, amt], i) => {
                const pct = totalExp > 0 ? Math.round((amt / totalExp) * 100) : 0;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: C.muted, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i] || C.muted, display: "inline-block", flexShrink: 0 }} />
                        {cat}
                      </span>
                      <span style={{ color: DONUT_COLORS[i] || C.muted, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: C.elevated, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: DONUT_COLORS[i] || C.accent, borderRadius: 4, transition: "width .6s cubic-bezier(.22,1,.36,1)" }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 2, textAlign: "right" }}>{fmtRWF(amt)}</div>
                  </div>
                );
              })
          }
        </div>

        {/* Herd by Stage */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 14 }}>🐷 Herd by Stage</div>
          {stageData.length === 0
            ? <div style={{ color: C.faint, fontSize: 12, textAlign: "center", padding: 20 }}>No active pigs.</div>
            : stageData.map(([stage, count]) => {
                const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0;
                return (
                  <div key={stage} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: C.muted, fontWeight: 600 }}>{STAGE_ICONS[stage] || "🐷"} {stage}</span>
                      <span style={{ color: STAGE_COLORS[stage] || C.accent, fontWeight: 700 }}>{count} pig{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ height: 6, background: C.elevated, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: STAGE_COLORS[stage] || C.accent, borderRadius: 4, transition: "width .55s cubic-bezier(.22,1,.36,1)" }} />
                    </div>
                  </div>
                );
              })
          }
          <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(22,163,74,.05)", borderRadius: 8, fontSize: 11, color: C.muted, textAlign: "center", fontWeight: 600 }}>
            {active.length} active · {active.filter(p => p.weight >= 80).length} market-ready (80kg+)
          </div>
        </div>
      </div>

      {/* ── Recent Activity + Portfolio ── */}
      <div style={S.g2}>
        {/* Recent Activity */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>📋 Recent Activity</div>
          {recentActivity.length === 0
            ? <div style={{ color: C.faint, fontSize: 13 }}>No activity yet.</div>
            : recentActivity.map((l, i) => (
                <div key={i} style={{ ...S.row, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {l.type === "feed" ? "🌾" : l.type === "sale" ? "🏷️" : "📝"} {l.worker || l.buyer || "—"}
                    </div>
                    <div style={{ fontSize: 10, color: C.faint }}>{l.date}</div>
                  </div>
                  <span style={{ color: l.type === "sale" ? "#10b981" : l.type === "feed" ? C.amber : C.muted, fontWeight: 700, fontSize: 12 }}>
                    {l.total ? fmtRWF(l.total) : l.cost ? fmtRWF(l.cost) : "✓"}
                  </span>
                </div>
              ))
          }
        </div>

        {/* Portfolio Snapshot */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 10 }}>💹 Portfolio Snapshot</div>
          {[
            ["Realized Profit",   fmtRWF(profit),                                                                   profit >= 0 ? C.accent : C.red ],
            ["Herd Market Value", fmtRWF(herdValue),                                                                 C.purple                       ],
            ["Total Portfolio",   fmtRWF(profit + herdValue),                                                        profit + herdValue >= 0 ? C.accent : C.red ],
            ["ROI",               totalExp > 0 ? `${((profit / totalExp) * 100).toFixed(1)}%` : "—",                C.amber ],
            ["Expense Ratio",     totalInc > 0 ? `${((totalExp / totalInc) * 100).toFixed(0)}%` : "—",              totalExp > totalInc ? C.red : C.accent ],
          ].map(([label, value, color]) => (
            <div key={label} style={{ ...S.row, marginBottom: 5 }}>
              <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
              <span style={{ fontWeight: 700, color, fontSize: 12 }}>{value}</span>
            </div>
          ))}
          {/* Profit gauge bar */}
          {totalInc > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 8, background: C.elevated, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(Math.max((profit / totalInc) * 100 + 50, 0), 100)}%`, background: profit >= 0 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#f87171,#dc2626)", borderRadius: 5, transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 3, textAlign: "center" }}>
                Profit margin: {totalInc > 0 ? ((profit / totalInc) * 100).toFixed(1) : 0}%
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
