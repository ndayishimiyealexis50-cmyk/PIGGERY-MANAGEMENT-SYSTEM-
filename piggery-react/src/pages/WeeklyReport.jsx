import React, { useState } from "react";
// ════════════════════════════════════════════════════════════════
// FarmIQ — Weekly Report (Module #26)
// Migrated from §17 of index_migration_to_vite_react.html
//
// Props
//   pigs        {Array}
//   feeds       {Array}
//   sales       {Array}
//   logs        {Array}
//   expenses    {Array}
//   incomes     {Array}
//   users       {Array}
//   stock       {Array}
// ════════════════════════════════════════════════════════════════
import { C, S } from '../styles/constants';
import { fmtRWF, toDay } from '../utils/helpers';

export default function WeeklyReport({ pigs, feeds, sales, logs, expenses, incomes, users, stock }) {
  // ── Date ranges ──────────────────────────────────────────────
  const today      = new Date();
  const dayOfWeek  = today.getDay();
  const monday     = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart  = monday.toISOString().slice(0, 10);

  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);
  const lastWeekStart = lastMonday.toISOString().slice(0, 10);

  const lastWeekEnd = new Date(monday);
  lastWeekEnd.setDate(monday.getDate() - 1);
  const lastWeekEndStr = lastWeekEnd.toISOString().slice(0, 10);

  function inRange(date, start, end) { return date >= start && date <= end; }

  // ── This week ────────────────────────────────────────────────
  const wLogs  = logs.filter((l) => l.date >= weekStart);
  const wFeeds = feeds.filter((f) => f.date >= weekStart);
  const wSales = sales.filter((s) => s.date >= weekStart);

  const wInc =
    wSales.reduce((s, x) => s + (x.total || 0), 0) +
    incomes.filter((i) => i.date >= weekStart).reduce((s, x) => s + (x.amount || 0), 0);
  const wExp =
    wFeeds.reduce((s, x) => s + (x.cost || 0), 0) +
    expenses.filter((e) => e.date >= weekStart).reduce((s, x) => s + (x.amount || 0), 0);
  const wProfit  = wInc - wExp;
  const wSick    = wLogs.reduce((s, l) => s + (l.sick   || 0), 0);
  const wDeaths  = wLogs.reduce((s, l) => s + (l.deaths || 0), 0);
  const wBirths  = wLogs.reduce((s, l) => s + (l.births || 0), 0);

  // ── Last week ────────────────────────────────────────────────
  const lwInc =
    sales.filter((s) => inRange(s.date, lastWeekStart, lastWeekEndStr))
         .reduce((s, x) => s + (x.total || 0), 0) +
    incomes.filter((i) => inRange(i.date, lastWeekStart, lastWeekEndStr))
           .reduce((s, x) => s + (x.amount || 0), 0);
  const lwExp =
    feeds.filter((f) => inRange(f.date, lastWeekStart, lastWeekEndStr))
         .reduce((s, x) => s + (x.cost || 0), 0) +
    expenses.filter((e) => inRange(e.date, lastWeekStart, lastWeekEndStr))
            .reduce((s, x) => s + (x.amount || 0), 0);
  const lwProfit = lwInc - lwExp;

  const profitChange = lwProfit > 0 ? Math.round(((wProfit - lwProfit) / lwProfit) * 100) : 0;

  // ── Derived ──────────────────────────────────────────────────
  const lowStock  = stock.filter((s) => s.quantity <= s.minLevel);
  const workers   = users.filter((u) => u.role === 'worker' && u.approved);

  return (
    <div>
      <div style={S.h1}>📊 Weekly Report</div>
      <div style={S.sub}>Week from {weekStart} · Auto-generated</div>

      {/* ── Financial summary ── */}
      <div style={S.g4}>
        {[
          { l: 'This Week Income',   v: fmtRWF(wInc),    c: '#10b981' },
          { l: 'This Week Expenses', v: fmtRWF(wExp),    c: C.red     },
          { l: 'This Week Profit',   v: fmtRWF(wProfit), c: wProfit >= 0 ? C.accent : C.red },
          { l: 'vs Last Week',       v: (profitChange >= 0 ? '+' : '') + profitChange + '%', c: profitChange >= 0 ? C.accent : C.red },
        ].map((s) => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: 14 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Health summary ── */}
      <div style={S.g4}>
        {[
          { l: 'Daily Reports',       v: wLogs.length, c: C.accent                            },
          { l: 'Sick Pigs Reported',  v: wSick,        c: wSick   > 0 ? C.red : C.accent      },
          { l: 'Deaths',              v: wDeaths,      c: wDeaths > 0 ? C.red : C.accent      },
          { l: 'New Births',          v: wBirths,      c: C.purple                            },
        ].map((s) => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Low stock alerts ── */}
      {lowStock.length > 0 && (
        <div style={{ ...S.card, background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 8 }}>
            📦 Low Stock Alerts ({lowStock.length})
          </div>
          {lowStock.map((s) => (
            <div key={s.id} style={S.row}>
              <span style={{ color: C.text }}>{s.name}</span>
              <span style={{ color: C.red, fontWeight: 700 }}>
                {s.quantity}{s.unit} left (min: {s.minLevel})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Worker activity ── */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>
          👷 Worker Activity This Week
        </div>
        {workers.length === 0 && (
          <div style={{ color: C.faint, fontSize: 13 }}>No workers yet.</div>
        )}
        {workers.map((w) => {
          const wid    = w.uid || w.id;
          const wl     = wLogs.filter((l) => l.workerId === wid).length;
          const wf     = wFeeds.filter((f) => f.workerId === wid).length;
          const ws     = wSales.filter((s) => s.workerId === wid).length;
          const active = logs.some((l) => l.workerId === wid && l.date === toDay());
          return (
            <div key={wid} style={{ ...S.row, marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 600, color: C.text }}>{w.name}</span>
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: active ? 'rgba(22,163,74,.12)' : 'rgba(239,68,68,.1)',
                  color:      active ? C.accent : C.red,
                }}>
                  {active ? '● Active today' : '○ No report today'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.faint }}>
                {wl} logs · {wf} feeds · {ws} sales
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sales this week ── */}
      {wSales.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>
            🏷️ Sales This Week ({wSales.length})
          </div>
          {wSales.map((s, i) => {
            const pig = pigs.find((p) => p.id === s.pigId);
            return (
              <div key={i} style={S.row}>
                <span style={{ color: C.muted, fontSize: 12 }}>
                  {s.date} · {s.worker} · {pig ? pig.tag : '—'}
                </span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(s.total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
