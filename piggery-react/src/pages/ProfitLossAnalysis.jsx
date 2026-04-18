import { C, S } from '../styles/theme';
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import {
  fmtRWF, fmtNum, calcPnL, daysDiff, getMarketPrice,
} from '../utils/helpers';
import AIPrediction from './AIPrediction';
import PDFBtn from './PDFBtn';

export default function ProfitLossAnalysis({
  pigs, feeds, sales, logs, expenses, incomes,
  reproductions, stock, allData, capital
}) {
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('all');

  const active = pigs.filter(p => p.status === 'active');
  const sold = pigs.filter(p => p.status === 'sold');
  const now = new Date();

  function inPeriod(dateStr) {
    if (period === 'all' || !dateStr) return true;
    const d = new Date(dateStr);
    if (period === 'thisMonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'lastMonth') { const lm = new Date(now); lm.setMonth(now.getMonth() - 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }
    if (period === 'thisYear') return d.getFullYear() === now.getFullYear();
    if (period === 'last30') { const cutoff = new Date(now); cutoff.setDate(now.getDate() - 30); return d >= cutoff; }
    if (period === 'last90') { const cutoff = new Date(now); cutoff.setDate(now.getDate() - 90); return d >= cutoff; }
    return true;
  }

  const fSales = sales.filter(s => inPeriod(s.date));
  const fIncomes = incomes.filter(i => inPeriod(i.date));
  const fFeeds = feeds.filter(f => inPeriod(f.date));
  const fExpenses = expenses.filter(e => inPeriod(e.date));

  const { totalInc: totalIncome, totalExp: totalExpense, profit: realizedProfit } = calcPnL(capital || { transactions: [] }, fFeeds, fSales, fExpenses, fIncomes);
  const totalSaleInc = fSales.reduce((s, l) => s + (l.total || 0), 0);
  const totalOtherInc = fIncomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalFeedCost = fFeeds.reduce((s, l) => s + (l.cost || 0), 0);
  const totalVetCost = fExpenses.filter(e => e.category === 'Veterinary' || e.category === 'Medicine').reduce((s, e) => s + (e.amount || 0), 0);
  const totalLabourCost = fExpenses.filter(e => e.category === 'Labour').reduce((s, e) => s + (e.amount || 0), 0);
  const totalSalaryCost = fExpenses.filter(e => e.category === 'Salary').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOtherExp = fExpenses.filter(e => !['Veterinary', 'Medicine', 'Labour', 'Salary'].includes(e.category)).reduce((s, l) => s + (l.amount || 0), 0);
  const stockInventoryValue = (stock || []).reduce((t, s) => t + (s.quantity * (s.costPerUnit || 0)), 0);

  const grossMargin = totalIncome > 0 ? ((totalIncome - totalFeedCost) / totalIncome * 100).toFixed(1) : 0;
  const netMargin = totalIncome > 0 ? ((realizedProfit / totalIncome) * 100).toFixed(1) : 0;
  const roi = totalExpense > 0 ? ((realizedProfit / totalExpense) * 100).toFixed(1) : 0;
  const expenseRatio = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : 0;
  const feedPct = totalExpense > 0 ? ((totalFeedCost / totalExpense) * 100).toFixed(1) : 0;

  const avgSalePrice = fSales.length > 0 ? Math.round(fSales.reduce((s, l) => s + (l.total || 0), 0) / fSales.length) : 0;
  const avgCostPerSale = fSales.length > 0 ? Math.round(totalExpense / fSales.length) : 0;
  const pigsToBreakEven = avgSalePrice > avgCostPerSale && avgSalePrice > 0 ? Math.ceil(totalExpense / avgSalePrice) : null;

  const herdValue = active.reduce((s, pig) => s + getMarketPrice(pig.stage, pig.weight), 0);
  const totalPigs = pigs.length || 1;
  const costPerPig = totalExpense / totalPigs;
  const allocatedCostUnsold = active.length * costPerPig;
  const unrealizedPnL = herdValue - allocatedCostUnsold;
  const totalPortfolioValue = totalIncome + herdValue + stockInventoryValue;
  const totalPortfolioPnL = totalPortfolioValue - totalExpense;

  function getMonths6() { const m = []; for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); m.push(d.toISOString().slice(0, 7)); } return m; }
  const months6 = getMonths6();
  const monthlyData = months6.map(m => ({
    m,
    inc: fSales.filter(s => (s.date || '').startsWith(m)).reduce((s, l) => s + (l.total || 0), 0) + fIncomes.filter(i => (i.date || '').startsWith(m)).reduce((s, l) => s + (l.amount || 0), 0),
    exp: fFeeds.filter(f => (f.date || '').startsWith(m)).reduce((s, l) => s + (l.cost || 0), 0) + fExpenses.filter(e => (e.date || '').startsWith(m)).reduce((s, l) => s + (l.amount || 0), 0),
  }));
  const maxMonthly = Math.max(...monthlyData.map(d => Math.max(d.inc, d.exp)), 1);

  const avgMonthlyExp = totalExpense / (Math.max(1, new Set(fFeeds.map(f => f.date?.slice(0, 7))).size) || 1);
  const ready80 = active.filter(p => p.weight >= 80);
  const almostReady = active.filter(p => p.weight >= 65 && p.weight < 80);
  const potentialRevenue30 = ready80.reduce((s, p) => s + getMarketPrice(p.stage, p.weight), 0);
  const expectedExp30 = avgMonthlyExp || totalExpense / Math.max(1, fFeeds.length) * 30;
  const forecast30Profit = potentialRevenue30 - expectedExp30;
  const pregnant = (reproductions || []).filter(r => r.status === 'pregnant');
  const farrowingsNext30 = pregnant.filter(r => daysDiff(r.expectedFarrow) >= 0 && daysDiff(r.expectedFarrow) <= 30);
  const expectedPigletValue = farrowingsNext30.length * 10 * 10000;

  const expByCat = {};
  fFeeds.forEach(f => { expByCat['Feed Purchase'] = (expByCat['Feed Purchase'] || 0) + (f.cost || 0); });
  fExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (e.amount || 0); });
  const sortedExpCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = (m) => MONTH_NAMES[parseInt(m.split('-')[1]) - 1] + ' ' + m.split('-')[0].slice(2);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={S.h1}>💹 Profit & Loss Analysis</div>
          <div style={S.sub}>Full P&L · break-even · margins · 30-day forecast</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...S.inp, width: 'auto', fontSize: 12, padding: '7px 11px' }}>
            {[['all', 'All Time'], ['thisMonth', 'This Month'], ['lastMonth', 'Last Month'], ['last30', 'Last 30 Days'], ['last90', 'Last 90 Days'], ['thisYear', 'This Year']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <PDFBtn label="P&L PDF" type="pnl" getData={() => allData} icon="💹" color="#374151" />
        </div>
      </div>

      {/* Key metrics banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Net Profit', v: fmtRWF(realizedProfit), c: realizedProfit >= 0 ? C.accent : C.red, bg: realizedProfit >= 0 ? 'rgba(22,163,74,.06)' : 'rgba(239,68,68,.06)' },
          { l: 'Net Margin', v: netMargin + '%', c: parseFloat(netMargin) >= 20 ? C.accent : parseFloat(netMargin) >= 0 ? C.amber : C.red, bg: 'rgba(245,158,11,.04)' },
          { l: 'Gross Margin', v: grossMargin + '%', c: C.blue, bg: 'rgba(37,99,235,.04)' },
          { l: 'ROI', v: roi + '%', c: C.purple, bg: 'rgba(124,58,237,.04)' },
          { l: 'Total Income', v: fmtRWF(totalIncome), c: '#10b981', bg: 'rgba(16,185,129,.04)' },
          { l: 'Total Expenses', v: fmtRWF(totalExpense), c: C.red, bg: 'rgba(239,68,68,.04)' },
          { l: 'Herd Value', v: fmtRWF(herdValue), c: C.purple, bg: 'rgba(124,58,237,.04)' },
          { l: 'Stock Value', v: fmtRWF(stockInventoryValue), c: C.blue, bg: 'rgba(37,99,235,.04)' },
          { l: 'Salaries Paid', v: fmtRWF(totalSalaryCost), c: C.amber, bg: 'rgba(245,158,11,.04)' },
          { l: 'Portfolio P&L', v: fmtRWF(totalPortfolioPnL), c: totalPortfolioPnL >= 0 ? C.accent : C.red, bg: totalPortfolioPnL >= 0 ? 'rgba(22,163,74,.06)' : 'rgba(239,68,68,.06)' },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, border: '1px solid ' + C.border, borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Income vs Expense bar */}
      <div style={{ ...S.card, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Income vs Expenses Ratio</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: realizedProfit >= 0 ? C.accent : C.red }}>{realizedProfit >= 0 ? '✅ Profitable' : '⚠️ Running at loss'} · Expense ratio: {expenseRatio}%</span>
        </div>
        <div style={{ height: 14, background: C.elevated, borderRadius: 8, overflow: 'hidden', marginBottom: 4, display: 'flex' }}>
          {totalIncome > 0 && <div style={{ height: '100%', width: Math.min((totalExpense / totalIncome) * 100, 100) + '%', background: totalExpense > totalIncome ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: 8, transition: 'width .5s' }} />}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.faint }}>
          <span style={{ color: '#10b981' }}>● Income: {fmtRWF(totalIncome)}</span>
          <span style={{ color: C.red }}>● Expenses: {fmtRWF(totalExpense)}</span>
          <span style={{ color: realizedProfit >= 0 ? C.accent : C.red }}>● Net: {fmtRWF(realizedProfit)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[['overview', '📊 Overview'], ['breakdown', '📂 Cost Breakdown'], ['sold', '💚 Sold Pigs'], ['unsold', '🐷 Active Herd'], ['30day', '📅 30-Day Forecast'], ['trend', '📈 Monthly Trend']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* OVERVIEW — P&L Statement */}
      {tab === 'overview' && (
        <div>
          <div style={{ ...S.card, background: totalPortfolioPnL >= 0 ? 'rgba(22,163,74,.03)' : 'rgba(239,68,68,.03)', border: '1px solid ' + (totalPortfolioPnL >= 0 ? 'rgba(22,163,74,.2)' : 'rgba(239,68,68,.2)') }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid ' + (totalPortfolioPnL >= 0 ? 'rgba(22,163,74,.2)' : 'rgba(239,68,68,.2)') }}>📊 Profit & Loss Statement</div>
            {[
              { l: '🏷️ Pig Sale Revenue', v: fmtRWF(totalSaleInc), c: '#10b981' },
              { l: '💰 Other Income', v: fmtRWF(totalOtherInc), c: '#10b981' },
              { l: 'TOTAL REVENUE', v: fmtRWF(totalIncome), c: '#10b981', bold: true, bg: 'rgba(16,185,129,.07)' },
              { l: '🌾 Feed Costs', v: '(' + fmtRWF(totalFeedCost) + ')', c: C.red },
              { l: '💊 Vet & Medicine', v: '(' + fmtRWF(totalVetCost) + ')', c: C.red },
              { l: '👷 Labour', v: '(' + fmtRWF(totalLabourCost) + ')', c: C.red },
              { l: '💼 Salaries', v: '(' + fmtRWF(totalSalaryCost) + ')', c: C.red },
              { l: '📦 Other Expenses', v: '(' + fmtRWF(totalOtherExp) + ')', c: C.red },
              { l: 'TOTAL EXPENSES', v: '(' + fmtRWF(totalExpense) + ')', c: C.red, bold: true, bg: 'rgba(239,68,68,.07)' },
              { l: 'NET REALIZED PROFIT', v: fmtRWF(realizedProfit), c: realizedProfit >= 0 ? C.accent : C.red, bold: true, bg: realizedProfit >= 0 ? 'rgba(22,163,74,.1)' : 'rgba(239,68,68,.1)' },
              { l: '🐷 Herd Market Value (unrealized)', v: fmtRWF(herdValue), c: C.purple },
              { l: '📦 Stock Inventory Value', v: fmtRWF(stockInventoryValue), c: C.blue },
              { l: 'TOTAL PORTFOLIO', v: fmtRWF(totalPortfolioPnL), c: totalPortfolioPnL >= 0 ? C.accent : C.red, bold: true, bg: totalPortfolioPnL >= 0 ? 'rgba(22,163,74,.12)' : 'rgba(239,68,68,.12)' },
            ].map(({ l, v, c, bold, bg }) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px ' + (bg ? '12px' : '2px'), marginBottom: 2, borderRadius: bg ? 7 : 0, background: bg || 'transparent' }}>
                <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 400, color: bold ? C.text : C.muted }}>{l}</span>
                <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 800 : 600, color: c }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(22,163,74,.05)', borderRadius: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Net Margin: <b style={{ color: parseFloat(netMargin) >= 0 ? C.accent : C.red }}>{netMargin}%</b></span>
              <span style={{ fontSize: 11, color: C.muted }}>Gross Margin: <b style={{ color: C.blue }}>{grossMargin}%</b></span>
              <span style={{ fontSize: 11, color: C.muted }}>ROI: <b style={{ color: C.purple }}>{roi}%</b></span>
              <span style={{ fontSize: 11, color: C.muted }}>Feed as % of expenses: <b style={{ color: C.amber }}>{feedPct}%</b></span>
            </div>
          </div>
          {avgSalePrice > 0 && (
            <div style={{ ...S.card, border: '1px solid rgba(99,102,241,.2)', background: 'rgba(99,102,241,.03)', marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginBottom: 10 }}>📐 Break-Even Analysis</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[['Avg Sale/pig', fmtRWF(avgSalePrice)], ['Avg Cost/pig', fmtRWF(avgCostPerSale)], ['Pigs to break even', pigsToBreakEven !== null ? pigsToBreakEven + ' pigs' : 'N/A']].map(([l, v]) => (
                  <div key={l} style={{ background: C.elevated, borderRadius: 8, padding: '9px 11px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{v}</div>
                  </div>
                ))}
              </div>
              {pigsToBreakEven !== null && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
                  You need to sell approximately <b style={{ color: '#6366f1' }}>{pigsToBreakEven} pigs</b> at current avg price to cover all expenses.
                  {fSales.length >= pigsToBreakEven ? <span style={{ color: C.accent }}> ✅ Already reached break-even ({fSales.length} sold)!</span> : <span style={{ color: C.amber }}> {fSales.length}/{pigsToBreakEven} sales so far.</span>}
                </div>
              )}
            </div>
          )}
          <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic={`Full farm P&L analysis: realized profit=${fmtRWF(realizedProfit)}, net margin=${netMargin}%, herd value=${fmtRWF(herdValue)}, ROI=${roi}%, feed is ${feedPct}% of expenses. Give specific profit improvement actions, cost reduction strategies, investment advice for pig farming.`} label="AI P&L Strategy" icon="💹" />
        </div>
      )}

      {/* BREAKDOWN */}
      {tab === 'breakdown' && (
        <div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 14 }}>🔴 Expense Breakdown by Category</div>
            {sortedExpCats.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No expenses recorded yet.</div>}
            {sortedExpCats.map(([cat, amt]) => {
              const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{cat}</span>
                    <span style={{ color: C.red, fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: cat === 'Feed Purchase' ? '#f59e0b' : cat === 'Pig Purchase' ? '#6366f1' : cat === 'Veterinary' || cat === 'Medicine' ? '#14b8a6' : C.red, borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
            {totalExpense > 0 && (
              <div style={{ marginTop: 10, padding: '9px 13px', background: 'rgba(239,68,68,.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Total Expenses</span>
                <span style={{ color: C.red, fontWeight: 700 }}>{fmtRWF(totalExpense)}</span>
              </div>
            )}
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 14 }}>💚 Income Breakdown</div>
            {[['🏷️ Pig Sales', totalSaleInc, totalIncome], ['💰 Other Income', totalOtherInc, totalIncome]].map(([l, amt, total]) => {
              const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
              return (
                <div key={l} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{l}</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: '#10b981', borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
            {totalIncome > 0 && (
              <div style={{ marginTop: 10, padding: '9px 13px', background: 'rgba(16,185,129,.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Total Income</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(totalIncome)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOLD PIGS */}
      {tab === 'sold' && (
        <div>
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>💚 Revenue Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[['Pig Sales', fmtRWF(totalSaleInc), '#10b981'], ['Other Income', fmtRWF(totalOtherInc), C.accent], ['Avg per Sale', fSales.length > 0 ? fmtRWF(Math.round(totalSaleInc / fSales.length)) : '—', '#10b981']].map(([l, v, c]) => (
                <div key={l} style={{ background: C.elevated, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Sale Records ({fSales.length})</div>
            {fSales.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No sales recorded for this period.</div>}
            {fSales.slice().reverse().map((s, i) => {
              const pig = pigs.find(p => p.id === s.pigId);
              const estProfit = s.total - costPerPig;
              return (
                <div key={i} style={{ ...S.row, borderBottom: '1px solid ' + C.elevated, paddingBottom: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.text }}>{pig ? pig.tag : 'Pig'} — {s.buyer || 'Unknown buyer'}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{s.date} · {s.weight || 0}kg @ RWF {fmtNum(s.priceKg)}/kg · {s.worker}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>{fmtRWF(s.total)}</div>
                    <div style={{ fontSize: 10, color: estProfit >= 0 ? C.accent : C.red }}>Est. margin: {fmtRWF(estProfit)}</div>
                  </div>
                </div>
              );
            })}
            {fSales.length > 0 && (
              <div style={{ padding: '9px 13px', background: 'rgba(16,185,129,.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted, fontSize: 13 }}>Total · {fSales.length} sale(s)</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(totalSaleInc)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE HERD */}
      {tab === 'unsold' && (
        <div>
          <div style={{ ...S.card, background: 'rgba(167,139,250,.04)', border: '1px solid rgba(167,139,250,.2)', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 12 }}>🐷 Active Herd Valuation</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 12 }}>
              {[['Active Pigs', active.length + ' pigs', '#94a3b8'], ['Market Value', fmtRWF(herdValue), C.purple], ['Est. Cost Invested', fmtRWF(allocatedCostUnsold), C.amber], ['Unrealized Gain/Loss', fmtRWF(unrealizedPnL), unrealizedPnL >= 0 ? C.accent : C.red]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.elevated, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                  <div style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.faint }}>Cost allocated proportionally. Market values based on current livestock prices.</div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Per-Pig Valuation ({active.length} active)</div>
            {active.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No active pigs.</div>}
            {active.slice().sort((a, b) => getMarketPrice(b.stage, b.weight) - getMarketPrice(a.stage, a.weight)).map((pig, i) => {
              const val = getMarketPrice(pig.stage, pig.weight);
              const pigPnL = val - costPerPig;
              const pct = herdValue > 0 ? ((val / herdValue) * 100).toFixed(0) : 0;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>🐷 {pig.tag}</span>
                      <span style={{ fontSize: 11, color: C.faint, marginLeft: 7 }}>{pig.stage} · {pig.weight}kg · {pig.breed}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: C.purple, fontSize: 13 }}>{fmtRWF(val)}</span>
                      <span style={{ fontSize: 10, color: pigPnL >= 0 ? C.accent : C.red, marginLeft: 8 }}>{pigPnL >= 0 ? '+' : ''}{fmtRWF(pigPnL)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: C.purple, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 10, padding: '9px 13px', background: 'rgba(167,139,250,.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted, fontSize: 13 }}>Total herd market value</span>
              <span style={{ color: C.purple, fontWeight: 700 }}>{fmtRWF(herdValue)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 30-DAY FORECAST */}
      {tab === '30day' && (
        <div>
          <div style={{ ...S.card, background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.2)', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 16 }}>📅 30-Day Profit Forecast</div>
            {[
              ['🐷 Market-ready pigs (80kg+)', `${ready80.length} pigs`, C.accent],
              ['📦 Potential sale revenue (80kg+ pigs)', fmtRWF(potentialRevenue30), C.accent],
              ['⏳ Almost ready (65–80kg)', `${almostReady.length} pigs growing toward market`, C.amber],
              ['🐖 Expected farrowings in 30 days', `${farrowingsNext30.length} sow(s) due`, C.pink],
              ['🐷 Expected piglet income', fmtRWF(expectedPigletValue), C.pink],
              ['🔴 Est. 30-day operating costs', fmtRWF(Math.round(expectedExp30)), C.red],
              ['━ 30-Day Net Forecast', fmtRWF(Math.round(forecast30Profit + expectedPigletValue)), forecast30Profit + expectedPigletValue >= 0 ? C.accent : C.red],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid ' + C.elevated }}>
                <span style={{ color: C.muted, fontSize: 13 }}>{l}</span>
                <span style={{ fontWeight: 700, color: c, fontSize: 13 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: '13px 16px', borderRadius: 10, background: forecast30Profit + expectedPigletValue >= 0 ? 'rgba(22,163,74,.1)' : 'rgba(239,68,68,.08)', border: '1px solid ' + (forecast30Profit + expectedPigletValue >= 0 ? 'rgba(22,163,74,.3)' : 'rgba(239,68,68,.3)') }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>30-Day Total Profit Opportunity</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: forecast30Profit + expectedPigletValue >= 0 ? C.accent : C.red }}>{fmtRWF(Math.round(forecast30Profit + expectedPigletValue))}</div>
              <div style={{ fontSize: 12, color: C.faint, marginTop: 5 }}>{forecast30Profit + expectedPigletValue >= 0 ? '✅ Positive outlook — prioritize selling market-ready pigs first' : '⚠️ Review feed costs and consider faster selling'}</div>
            </div>
          </div>
          <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic={`30-day profit forecast: ${ready80.length} pigs ready to sell (value=${fmtRWF(potentialRevenue30)}), ${farrowingsNext30.length} farrowings expected, net margin=${netMargin}%, operating costs=${fmtRWF(Math.round(expectedExp30))}. Predict exact 30-day profit/loss, specific actions to maximize it, market price negotiation tips.`} label="AI 30-Day Profit Forecast" icon="📅" />
        </div>
      )}

      {/* MONTHLY TREND */}
      {tab === 'trend' && (
        <div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 14 }}>📈 Monthly Income vs Expenses (Last 6 Months)</div>
            {monthlyData.map(({ m, inc, exp }) => {
              const profit = inc - exp;
              const label = monthLabel(m);
              return (
                <div key={m} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{label}</span>
                    <span style={{ color: profit >= 0 ? C.accent : C.red, fontWeight: 700 }}>{profit >= 0 ? '+' : ''}{fmtRWF(profit)}</span>
                  </div>
                  <div style={{ marginBottom: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, marginBottom: 2 }}>
                      <span style={{ color: '#10b981' }}>Income</span><span style={{ color: '#10b981' }}>{fmtRWF(inc)}</span>
                    </div>
                    <div style={{ height: 7, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (maxMonthly > 0 ? (inc / maxMonthly) * 100 : 0) + '%', background: 'linear-gradient(90deg,#10b981,#059669)', borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, marginBottom: 2 }}>
                      <span style={{ color: C.red }}>Expenses</span><span style={{ color: C.red }}>{fmtRWF(exp)}</span>
                    </div>
                    <div style={{ height: 7, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (maxMonthly > 0 ? (exp / maxMonthly) * 100 : 0) + '%', background: 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {monthlyData.every(d => d.inc === 0 && d.exp === 0) && <div style={{ color: C.faint, fontSize: 13, textAlign: 'center', padding: 20 }}>No data for the last 6 months.</div>}
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Monthly Summary Table</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Month', 'Income', 'Expenses', 'Profit', 'Margin'].map(h => <th key={h} style={{ textAlign: 'left', color: C.faint, paddingBottom: 8, borderBottom: '1px solid ' + C.border, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
              <tbody>
                {monthlyData.filter(d => d.inc > 0 || d.exp > 0).sort((a, b) => b.m.localeCompare(a.m)).map(({ m, inc, exp }) => {
                  const p = inc - exp;
                  const mg = inc > 0 ? ((p / inc) * 100).toFixed(0) : '—';
                  return (
                    <tr key={m} style={{ borderBottom: '1px solid ' + C.elevated }}>
                      <td style={{ padding: '8px 0', color: C.muted }}>{monthLabel(m)}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>{fmtRWF(inc)}</td>
                      <td style={{ color: C.red, fontWeight: 600 }}>{fmtRWF(exp)}</td>
                      <td style={{ color: p >= 0 ? C.accent : C.red, fontWeight: 700 }}>{fmtRWF(p)}</td>
                      <td style={{ color: parseFloat(mg) >= 20 ? C.accent : parseFloat(mg) >= 0 ? C.amber : C.red, fontWeight: 600 }}>{mg}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {monthlyData.every(d => d.inc === 0 && d.exp === 0) && <div style={{ color: C.faint, fontSize: 13, paddingTop: 8 }}>No monthly data yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
