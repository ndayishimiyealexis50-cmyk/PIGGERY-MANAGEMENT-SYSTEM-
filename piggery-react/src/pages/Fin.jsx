import React from 'react';
import { C, S } from '../utils/constants';
import { fmtRWF, calcPnL, getMarketPrice } from '../utils/helpers';
import AIPrediction from './AIPrediction';
import PDFBtn from './PDFBtn';

export default function Fin({ feeds, sales, pigs, logs, expenses, incomes, allData, capital }) {
  const { totalInc: totalIncome, totalExp: totalExpense, profit } = calcPnL(capital || { transactions: [] }, feeds, sales, expenses, incomes);
  const totalSaleInc = sales.reduce((s, l) => s + (l.total || 0), 0);
  const totalOtherInc = incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalFeedCost = feeds.reduce((s, l) => s + (l.cost || 0), 0);
  const totalOtherExp = expenses.reduce((s, l) => s + (l.amount || 0), 0);
  const roi = totalExpense > 0 ? ((profit / totalExpense) * 100).toFixed(1) : '—';
  const netMargin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '—';
  const grossMargin = totalIncome > 0 ? (((totalIncome - totalFeedCost) / totalIncome) * 100).toFixed(1) : '—';
  const feedRatio = totalExpense > 0 ? ((totalFeedCost / totalExpense) * 100).toFixed(1) : '—';

  // Monthly data
  const months = {};
  [
    ...sales.map(s => ({ date: s.date, rev: s.total, cost: 0 })),
    ...incomes.map(i => ({ date: i.date, rev: i.amount, cost: 0 })),
    ...feeds.map(f => ({ date: f.date, rev: 0, cost: f.cost })),
    ...expenses.map(e => ({ date: e.date, rev: 0, cost: e.amount })),
  ].forEach(l => {
    const m = l.date && l.date.slice(0, 7);
    if (!m) return;
    if (!months[m]) months[m] = { rev: 0, cost: 0 };
    months[m].rev += l.rev;
    months[m].cost += l.cost;
  });
  const sortedMonths = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
  const maxMonthVal = Math.max(...sortedMonths.map(([, v]) => Math.max(v.rev, v.cost)), 1);

  // Expense by category
  const expByCat = {};
  feeds.forEach(f => { expByCat['Feed Purchase'] = (expByCat['Feed Purchase'] || 0) + (f.cost || 0); });
  expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (e.amount || 0); });
  const sortedExpCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const active = pigs.filter(p => p.status === 'active');
  const herdValue = active.reduce((s, pig) => s + getMarketPrice(pig.stage, pig.weight), 0);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={S.h1}>💰 Financial Dashboard</div>
        <PDFBtn label="Finance PDF" type="finance" getData={() => allData} icon="💰" color="#374151" />
      </div>

      {/* Key financial KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Income', v: fmtRWF(totalIncome), c: '#10b981' },
          { l: 'Total Expenses', v: fmtRWF(totalExpense), c: C.red },
          { l: 'Net Profit', v: fmtRWF(profit), c: profit >= 0 ? C.accent : C.red },
          { l: 'ROI', v: roi === '—' ? '—' : roi + '%', c: C.purple },
          { l: 'Net Margin', v: netMargin === '—' ? '—' : netMargin + '%', c: parseFloat(netMargin) >= 20 ? C.accent : parseFloat(netMargin) >= 0 ? C.amber : C.red },
          { l: 'Gross Margin', v: grossMargin === '—' ? '—' : grossMargin + '%', c: C.blue },
          { l: 'Feed % of Exp', v: feedRatio === '—' ? '—' : feedRatio + '%', c: C.amber },
          { l: 'Herd Value', v: fmtRWF(herdValue), c: C.purple },
        ].map(s => (
          <div key={s.l} style={{ ...S.stat, padding: '11px 13px' }}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: s.v.length > 9 ? 13 : 18 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Profitability status bar */}
      <div style={{ ...S.card, padding: '13px 16px', marginBottom: 14, background: profit >= 0 ? 'rgba(22,163,74,.04)' : 'rgba(239,68,68,.04)', border: '1px solid ' + (profit >= 0 ? 'rgba(22,163,74,.2)' : 'rgba(239,68,68,.2)') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? C.accent : C.red }}>{profit >= 0 ? '✅ Farm is Profitable' : '⚠️ Running at a Loss'}</span>
          <span style={{ fontSize: 12, color: C.faint }}>Expense ratio: {totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0}%</span>
        </div>
        <div style={{ height: 12, background: C.elevated, borderRadius: 8, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{ height: '100%', width: (totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0) + '%', background: totalExpense > totalIncome ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#f59e0b,#16a34a)', borderRadius: 8, transition: 'width .5s' }} />
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.faint }}>
          <span>📥 Income: <b style={{ color: '#10b981' }}>{fmtRWF(totalIncome)}</b></span>
          <span>📤 Expenses: <b style={{ color: C.red }}>{fmtRWF(totalExpense)}</b></span>
          <span>💹 Net: <b style={{ color: profit >= 0 ? C.accent : C.red }}>{fmtRWF(profit)}</b></span>
          <span>📦 Herd: <b style={{ color: C.purple }}>{fmtRWF(herdValue)}</b></span>
        </div>
      </div>

      {/* Income + Expense side-by-side */}
      <div style={S.g2}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>💚 Income Breakdown</div>
          {[['🏷️ Pig Sales', totalSaleInc, totalIncome], ['💰 Other Income', totalOtherInc, totalIncome]].map(([l, amt, tot]) => {
            const pct = tot > 0 ? ((amt / tot) * 100).toFixed(0) : 0;
            return (
              <div key={l} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>{l}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(amt)}</span>
                </div>
                <div style={{ height: 6, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: '#10b981', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, ...S.row, background: 'rgba(16,185,129,.07)', borderRadius: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>TOTAL</span>
            <span style={{ color: '#10b981', fontWeight: 800 }}>{fmtRWF(totalIncome)}</span>
          </div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 12 }}>🔴 Expense Breakdown</div>
          {sortedExpCats.map(([cat, amt]) => {
            const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(0) : 0;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.muted }}>{cat}</span>
                  <span style={{ color: C.red, fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400, fontSize: 10 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: cat === 'Feed Purchase' ? '#f59e0b' : C.red, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 8, ...S.row, background: 'rgba(239,68,68,.07)', borderRadius: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>TOTAL</span>
            <span style={{ color: C.red, fontWeight: 800 }}>{fmtRWF(totalExpense)}</span>
          </div>
        </div>
      </div>

      {/* Monthly bars */}
      <div style={{ ...S.card, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 14 }}>📅 Monthly Income vs Expenses</div>
        {sortedMonths.length === 0
          ? <div style={{ color: C.faint, fontSize: 13 }}>No data yet.</div>
          : sortedMonths.slice(0, 8).map(([m, v]) => {
            const p = v.rev - v.cost;
            const label = MONTH_NAMES[parseInt(m.split('-')[1]) - 1] + ' ' + m.split('-')[0].slice(2);
            return (
              <div key={m} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{label}</span>
                  <span style={{ fontWeight: 700, color: p >= 0 ? C.accent : C.red }}>{p >= 0 ? '+' : ''}{fmtRWF(p)}</span>
                </div>
                <div style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, marginBottom: 2 }}>
                    <span style={{ color: '#10b981' }}>Income</span><span style={{ color: '#10b981' }}>{fmtRWF(v.rev)}</span>
                  </div>
                  <div style={{ height: 7, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (v.rev / maxMonthVal * 100) + '%', background: 'linear-gradient(90deg,#10b981,#059669)', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, marginBottom: 2 }}>
                    <span style={{ color: C.red }}>Expenses</span><span style={{ color: C.red }}>{fmtRWF(v.cost)}</span>
                  </div>
                  <div style={{ height: 7, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (v.cost / maxMonthVal * 100) + '%', background: 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: '16px 0 12px' }}>✦ AI Financial Analysis</div>
      <AIPrediction
        pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes}
        topic={`Full financial analysis farm: income=${fmtRWF(totalIncome)}, expenses=${fmtRWF(totalExpense)}, net margin=${netMargin}%, ROI=${roi}%, feed is ${feedRatio}% of expenses, herd value=${fmtRWF(herdValue)}. Revenue optimization, expense reduction, break-even, scaling investment.`}
        label="Financial Strategy" icon="💰"
      />
    </div>
  );
}
