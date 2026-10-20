// ════════════════════════════════════════════════════════════════
// MODULE 23 — ProfitInsight
// Medium priority — analytics
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../utils/constants';
import { fmtRWF } from '../utils/formatters';
import { getMarketPrice } from '../utils/helpers';

export default function ProfitInsight({ pigs, feeds, sales, logs, expenses, incomes, reproductions, stock, capital }) {
  const [period, setPeriod] = useState('thisMonth');
  const active = pigs.filter(p => p.status === 'active');

  function filterByPeriod(arr, dateKey = 'date') {
    const now = new Date();
    return arr.filter(x => {
      const d = new Date(x[dateKey]);
      if (period === 'thisMonth')  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (period === 'lastMonth') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
      }
      if (period === 'last30') return (now - d) / (1000 * 60 * 60 * 24) <= 30;
      if (period === 'thisYear') return d.getFullYear() === now.getFullYear();
      return true; // 'all'
    });
  }

  const fSales    = filterByPeriod(sales);
  const fFeeds    = filterByPeriod(feeds);
  const fExp      = filterByPeriod(expenses);
  const fInc      = filterByPeriod(incomes);

  const totalInc  = fSales.reduce((s, x) => s + (x.total  || 0), 0) + fInc.reduce((s, x) => s + (x.amount || 0), 0);
  const totalExp  = fFeeds.reduce((s, x) => s + (x.cost   || 0), 0) + fExp.reduce((s, x) => s + (x.amount || 0), 0);
  const profit    = totalInc - totalExp;
  const margin    = totalInc > 0 ? Math.round((profit / totalInc) * 100) : 0;

  // Herd value
  const herdValue = active.reduce((s, p) => s + getMarketPrice(p.stage, p.weight), 0);

  // All-time profit
  const allInc    = sales.reduce((s, x) => s + (x.total  || 0), 0) + incomes.reduce((s, x) => s + (x.amount || 0), 0);
  const allExp    = feeds.reduce((s, x) => s + (x.cost   || 0), 0) + expenses.reduce((s, x) => s + (x.amount || 0), 0);
  const allProfit = allInc - allExp;

  // Top costs by category
  const costMap = {};
  [...fFeeds.map(f => ({ cat: f.feedType || 'Feed Purchase', amt: f.cost || 0 })),
   ...fExp.map(e => ({ cat: e.category || 'Other', amt: e.amount || 0 }))
  ].forEach(({ cat, amt }) => { costMap[cat] = (costMap[cat] || 0) + amt; });
  const topCosts = Object.entries(costMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top sales
  const salePigs = [...fSales].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 5);

  // Monthly profit trend (last 6 months)
  const monthlyProfit = {};
  [...sales.map(s => ({ d: s.date, inc: s.total || 0, exp: 0 })),
   ...incomes.map(i => ({ d: i.date, inc: i.amount || 0, exp: 0 })),
   ...feeds.map(f => ({ d: f.date, inc: 0, exp: f.cost || 0 })),
   ...expenses.map(e => ({ d: e.date, inc: 0, exp: e.amount || 0 }))
  ].forEach(x => {
    const m = (x.d || '').slice(0, 7);
    if (!m) return;
    if (!monthlyProfit[m]) monthlyProfit[m] = { inc: 0, exp: 0 };
    monthlyProfit[m].inc += x.inc;
    monthlyProfit[m].exp += x.exp;
  });
  const months6    = Object.entries(monthlyProfit).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).reverse();
  const maxMonthP  = Math.max(...months6.map(([, v]) => Math.max(Math.abs(v.inc - v.exp), 1)), 1);

  // Break-even
  const avgSalePig = fSales.length > 0 ? Math.round(fSales.reduce((s, x) => s + (x.total || 0), 0) / fSales.length) : 0;
  const avgCostPig = fSales.length > 0 ? Math.round(totalExp / Math.max(fSales.length, 1)) : 0;
  const breakEven  = avgSalePig > avgCostPig ? Math.ceil(totalExp / (avgSalePig - avgCostPig)) : null;

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...S.h1, display: 'flex', alignItems: 'center', gap: 8 }}><span>💡</span> Profit Insight</div>
          <div style={S.sub}>Quick profit view · Cost drilldown · Monthly trends · Break-even</div>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ ...S.inp, width: 'auto', fontSize: 12, padding: '7px 11px' }}
        >
          {[['thisMonth','This Month'],['lastMonth','Last Month'],['last30','Last 30 Days'],['thisYear','This Year'],['all','All Time']].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* P&L banner */}
      <div style={{
        ...S.card,
        background: profit >= 0 ? 'linear-gradient(135deg,rgba(22,163,74,.08),rgba(16,185,129,.04))' : 'linear-gradient(135deg,rgba(239,68,68,.08),rgba(220,38,38,.04))',
        border: '2px solid ' + (profit >= 0 ? 'rgba(22,163,74,.25)' : 'rgba(239,68,68,.25)'),
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Net Profit / Loss</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: profit >= 0 ? C.accent : C.red }}>{profit >= 0 ? '+' : ''}{fmtRWF(profit)}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              {profit >= 0 ? '✅ Profitable' : '⚠️ Loss'} · {margin}% margin · {fSales.length} sale{fSales.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            {[
              ['Income',         fmtRWF(totalInc),  '#10b981'],
              ['Expenses',       fmtRWF(totalExp),  C.red],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
                <span style={{ fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 6, borderTop: '1px solid ' + C.border }}>
              <span style={{ fontSize: 12, color: C.muted }}>Herd Value</span>
              <span style={{ fontWeight: 700, color: C.purple }}>{fmtRWF(herdValue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ fontSize: 12, color: C.muted }}>All-time Profit</span>
              <span style={{ fontWeight: 700, color: allProfit >= 0 ? C.accent : C.red }}>{fmtRWF(allProfit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense ratio bar */}
      {totalInc > 0 && (
        <div style={{ ...S.card, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 700, color: C.text }}>
            <span>Expense Ratio</span>
            <span style={{ color: totalExp > totalInc ? C.red : C.accent }}>
              {totalInc > 0 ? ((totalExp / totalInc) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div style={{ height: 10, background: C.elevated, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.min((totalExp / totalInc) * 100, 100) + '%', background: totalExp > totalInc ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#f59e0b,#22c55e)', borderRadius: 6, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: C.faint, flexWrap: 'wrap' }}>
            <span>💚 Income: {fmtRWF(totalInc)}</span>
            <span>🔴 Expenses: {fmtRWF(totalExp)}</span>
          </div>
        </div>
      )}

      {/* 2-column grid */}
      <div style={S.g2}>
        {/* Cost breakdown */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 12 }}>🔴 Cost Breakdown</div>
          {topCosts.length === 0
            ? <div style={{ color: C.faint, fontSize: 12 }}>No expenses recorded.</div>
            : topCosts.map(([cat, amt]) => {
                const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(0) : 0;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: C.muted }}>{cat}</span>
                      <span style={{ color: C.red, fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: cat === 'Feed Purchase' ? C.amber : C.red, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Top sales */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>💚 Top Sales</div>
          {salePigs.length === 0
            ? <div style={{ color: C.faint, fontSize: 12 }}>No sales recorded yet.</div>
            : salePigs.map((s, i) => (
                <div key={s.id} style={{ ...S.row, marginBottom: 6, background: i === 0 ? 'rgba(16,185,129,.06)' : C.elevated }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>🐷 {s.pigTag}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>{s.buyer || '—'} · {s.date}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: 13 }}>{fmtRWF(s.total)}</div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Monthly profit spark */}
      {months6.length > 0 && (
        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>📅 Monthly Profit Trend</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {months6.map(([m, v]) => {
              const p     = v.inc - v.exp;
              const h     = Math.max(Math.abs(p) / maxMonthP * 70, 4);
              const label = MONTH_LABELS[parseInt(m.split('-')[1]) - 1];
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: p >= 0 ? C.accent : C.red, fontWeight: 700 }}>{p >= 0 ? '+' : ''}{Math.round(p / 1000)}k</div>
                  <div style={{ width: '100%', height: h, background: p >= 0 ? 'linear-gradient(180deg,#22c55e,#16a34a)' : 'linear-gradient(180deg,#f87171,#dc2626)', borderRadius: 4, transition: 'height .55s cubic-bezier(.22,1,.36,1)' }} />
                  <div style={{ fontSize: 9, color: C.faint }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Break-even */}
      {breakEven !== null && avgSalePig > 0 && (
        <div style={{ ...S.card, marginTop: 14, background: 'rgba(99,102,241,.03)', border: '1px solid rgba(99,102,241,.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginBottom: 10 }}>📐 Break-Even Analysis</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              ['Avg Sale/pig',       fmtRWF(avgSalePig)],
              ['Avg Cost/pig',       fmtRWF(avgCostPig)],
              ['Pigs to break even', breakEven + ' pigs'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: C.elevated, borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid ' + C.border }}>
                <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{v}</div>
              </div>
            ))}
          </div>
          {fSales.length >= breakEven
            ? <div style={{ marginTop: 10, fontSize: 12, color: C.accent }}>✅ Break-even reached! ({fSales.length} sales)</div>
            : <div style={{ marginTop: 10, fontSize: 12, color: C.amber }}>⏳ {fSales.length}/{breakEven} sales to break even</div>
          }
        </div>
      )}
    </div>
  );
}
