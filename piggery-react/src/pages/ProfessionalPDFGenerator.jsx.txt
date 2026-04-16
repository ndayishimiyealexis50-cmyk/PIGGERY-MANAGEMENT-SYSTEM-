// ════════════════════════════════════════════════════════════════
// FarmIQ — Professional PDF Generator (Module #30)
// Migrated from §17/§18 of index_migration_to_vite_react.html
//
// Generates bank-ready HTML documents opened in a new tab for
// printing / saving as PDF.
//
// Props
//   pigs           {Array}
//   feeds          {Array}
//   sales          {Array}
//   logs           {Array}
//   expenses       {Array}
//   incomes        {Array}
//   reproductions  {Array}
//   stock          {Array}
//   capital        {Object}
//   users          {Array}
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../styles/constants';
import { fmtRWF, toDay, calcCapitalBalance } from '../utils/helpers';
import { getMarketPrice, getLatestSurveyPrices, getSurveyOrEstimatedPrice, getBusinessProfile } from '../utils/market';

// ── PDF CSS (embedded in generated document) ──────────────────
const PDF_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',Arial,sans-serif;color:#1a1a2e;background:#fff;font-size:11.5px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{max-width:820px;margin:0 auto;background:#fff;}
.letterhead{background:linear-gradient(135deg,#071a0d 0%,#0d2e16 55%,#0a2010 100%);color:#fff;padding:0;}
.lh-top-bar{background:rgba(22,163,74,.85);height:5px;}
.lh-body{padding:32px 40px 26px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;}
.lh-logo-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.lh-icon{width:48px;height:48px;background:rgba(74,222,128,.15);border:1.5px solid rgba(74,222,128,.4);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
.lh-farm-name{font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#fff;}
.lh-farm-sub{font-size:11px;color:rgba(74,222,128,.7);font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-top:1px;}
.lh-contact{font-size:11px;color:rgba(255,255,255,.6);margin-top:6px;line-height:1.8;}
.lh-contact span{color:rgba(255,255,255,.85);}
.lh-right{text-align:right;flex-shrink:0;}
.lh-doc-type{font-size:9px;color:rgba(74,222,128,.6);text-transform:uppercase;letter-spacing:2.5px;margin-bottom:6px;}
.lh-doc-title{font-size:15px;font-weight:700;color:#4ade80;margin-bottom:10px;line-height:1.3;}
.lh-meta{font-size:10px;color:rgba(255,255,255,.45);line-height:1.9;}
.lh-meta strong{color:rgba(255,255,255,.7);font-weight:600;}
.lh-bottom-bar{height:3px;background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a);}
.exec-band{background:#f8fdf9;border-top:3px solid #16a34a;border-bottom:1px solid #d1fae5;padding:20px 40px;}
.exec-band-title{font-size:9px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
.kpi-cell{padding:12px 16px;border-right:1px solid #d1fae5;}
.kpi-cell:last-child{border-right:none;}
.kpi-cell:first-child{padding-left:0;}
.kpi-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;}
.kpi-value{font-size:19px;font-weight:800;color:#15803d;line-height:1.1;}
.kpi-value.red{color:#dc2626;}.kpi-value.blue{color:#1d4ed8;}.kpi-value.purple{color:#7c3aed;}.kpi-value.amber{color:#b45309;}
.kpi-sub{font-size:9.5px;color:#9ca3af;margin-top:2px;}
.content{padding:28px 40px 20px;}
.section{margin-bottom:28px;}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #16a34a;}
.section-icon{width:28px;height:28px;background:#dcfce7;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.section-title{font-size:13px;font-weight:700;color:#0d2e16;flex:1;}
.section-badge{font-size:9px;background:#0d2e16;color:#4ade80;padding:3px 8px;border-radius:10px;font-weight:700;letter-spacing:.5px;}
.sub-header{font-size:11px;font-weight:700;color:#1f4028;margin:16px 0 8px;padding-left:10px;border-left:3px solid #86efac;}
table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:6px;}
thead tr{background:#0d2e16;}
th{color:#fff;font-weight:600;padding:8px 12px;text-align:left;font-size:10px;letter-spacing:.3px;}
th.r{text-align:right;}
td{padding:7px 12px;border-bottom:1px solid #f0f0f0;vertical-align:middle;color:#374151;}
td.r{text-align:right;}td.bold{font-weight:700;}td.green{color:#15803d;font-weight:700;}td.red{color:#dc2626;font-weight:700;}
td.purple{color:#7c3aed;font-weight:700;}td.blue{color:#1d4ed8;font-weight:700;}td.amber{color:#b45309;font-weight:700;}
tr:nth-child(even) td{background:#fafafa;}
tr.section-total td{background:#f0fdf4!important;font-weight:700;color:#166534;border-top:1.5px solid #86efac;border-bottom:1.5px solid #86efac;}
tr.grand-total td{background:#0d2e16!important;color:#fff!important;font-weight:700;font-size:11px;}
tr.grand-total td.green{color:#4ade80!important;}tr.grand-total td.red{color:#fca5a5!important;}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9.5px;font-weight:700;white-space:nowrap;}
.badge-green{background:#dcfce7;color:#166534;}.badge-red{background:#fee2e2;color:#991b1b;}
.badge-amber{background:#fef3c7;color:#92400e;}.badge-blue{background:#dbeafe;color:#1e40af;}.badge-purple{background:#ede9fe;color:#6d28d9;}
.info-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin:10px 0;font-size:10.5px;color:#166534;display:flex;gap:8px;align-items:flex-start;}
.info-box-icon{flex-shrink:0;font-size:13px;}.info-box.amber{background:#fffbeb;border-color:#fde68a;color:#92400e;}.info-box.blue{background:#eff6ff;border-color:#bfdbfe;color:#1e40af;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.col-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;}
.col-box-title{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;}
.col-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:10.5px;}
.col-row-label{color:#6b7280;}.col-row-val{font-weight:600;color:#111;}.col-row-val.green{color:#15803d;}.col-row-val.red{color:#dc2626;}
.month-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:10px;}
.month-label{width:38px;color:#6b7280;flex-shrink:0;font-weight:600;}
.month-bar-wrap{flex:1;background:#f3f4f6;border-radius:3px;height:14px;overflow:hidden;}
.month-bar{height:100%;border-radius:3px;min-width:2px;}
.month-val{width:90px;text-align:right;font-weight:700;flex-shrink:0;}
.sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:20px;}
.sig-box{border-top:1.5px solid #374151;padding-top:8px;}
.sig-name{font-size:10px;font-weight:700;color:#111;}.sig-role{font-size:9.5px;color:#6b7280;margin-top:1px;}.sig-date{font-size:9px;color:#9ca3af;margin-top:4px;}
.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(22,163,74,.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:8px;}
.doc-footer{margin-top:32px;padding:14px 40px 20px;border-top:2px solid #e5e7eb;background:#f9fafb;}
.footer-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;}
.footer-left{font-size:9.5px;color:#9ca3af;line-height:1.7;}.footer-left strong{color:#6b7280;}.footer-right{font-size:9px;color:#d1d5db;text-align:right;}
.footer-brand{font-size:10px;font-weight:800;color:#16a34a;letter-spacing:.5px;}
.page-break{page-break-before:always;break-before:page;}.page-break-avoid{page-break-inside:avoid;break-inside:avoid;}
@media print{body{font-size:10.5px;}.page{max-width:100%;}.watermark{position:fixed;}.lh-body{padding:24px 30px 20px;}.content{padding:20px 30px 16px;}.exec-band{padding:16px 30px;}.doc-footer{padding:10px 30px 16px;}.section{page-break-inside:avoid;}table{page-break-inside:auto;}tr{page-break-inside:avoid;page-break-after:auto;}}
`;

const DOC_OPTIONS = [
  { id: 'full',    label: '📄 Complete Farm Report',        desc: 'Full report: P&L, herd, capital, trends — general use' },
  { id: 'pnl',     label: '💹 Profit & Loss Statement',     desc: 'Revenue, expenses, profit margin, monthly trends' },
  { id: 'loan',    label: '🏦 Bank Loan Application',       desc: 'Formal report with business address, collateral, TIN — bank-ready' },
  { id: 'herd',    label: '🐷 Herd Inventory & Valuation',  desc: 'All pigs with market values, weight, breed' },
  { id: 'capital', label: '💵 Capital & Balance Sheet',     desc: 'Opening capital, cash flow, net worth' },
  { id: 'bizplan', label: '📋 Business Plan',               desc: 'Full investor-ready business plan — mission, market, projections, SWOT' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Main Component ─────────────────────────────────────────────
export default function ProfessionalPDFGenerator({ pigs, feeds, sales, logs, expenses, incomes, reproductions, stock, capital, users }) {
  const [docType,      setDocType]      = useState('full');
  const [generating,   setGenerating]   = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [bizPlan,      setBizPlan]      = useState({
    mission:'', vision:'', objectives:'',
    products:'', market:'', operations:'',
    strengths:'', weaknesses:'', opportunities:'', threats:'',
    loanPurpose:'', loanAmount:'',
    proj1Revenue:'', proj1Expenses:'',
    proj2Revenue:'', proj2Expenses:'',
    proj3Revenue:'', proj3Expenses:'',
  });

  const bpSet = (k, v) => setBizPlan((p) => ({ ...p, [k]: v }));

  const biz                = getBusinessProfile();
  const latestSurveyPrices = getLatestSurveyPrices();

  // ── Financial calculations ────────────────────────────────────
  const active          = pigs.filter((p) => p.status === 'active');
  const sold            = pigs.filter((p) => p.status === 'sold');
  const totalSalesInc   = sales.reduce((s, l) => s + (l.total  || 0), 0);
  const totalOtherInc   = incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalInc        = totalSalesInc + totalOtherInc;
  const totalFeedExp    = feeds.reduce((s, l) => s + (l.cost   || 0), 0);
  const totalOtherExp   = expenses.reduce((s, l) => s + (l.amount || 0), 0);
  const totalExp        = totalFeedExp + totalOtherExp;
  const netProfit       = totalInc - totalExp;
  const profitMargin    = totalInc > 0 ? ((netProfit / totalInc) * 100).toFixed(1) : 0;
  const herdValue       = active.reduce((s, p) => s + (latestSurveyPrices ? getSurveyOrEstimatedPrice(p.stage, p.weight) : getMarketPrice(p.stage, p.weight)), 0);
  const capitalBalance  = calcCapitalBalance(capital || { initial: 0 }, feeds, sales, expenses, incomes);

  const avgSalePig = sales.length > 0 ? Math.round(totalSalesInc / sales.length) : 0;
  const avgCostPig = sales.length > 0 ? Math.round(totalExp / Math.max(sales.length, 1)) : 0;
  const breakEven  = avgSalePig > avgCostPig ? Math.ceil(totalExp / (avgSalePig - avgCostPig)) : null;

  const expByCat = {};
  expenses.forEach((e) => { const k = e.category || 'Other'; expByCat[k] = (expByCat[k] || 0) + (e.amount || 0); });
  feeds.forEach((f) => { expByCat['Feed Purchase'] = (expByCat['Feed Purchase'] || 0) + (f.cost || 0); });

  const incByCat = {};
  sales.forEach((s) => { incByCat['Pig Sales'] = (incByCat['Pig Sales'] || 0) + (s.total || 0); });
  incomes.forEach((i) => { const k = i.category || 'Other Income'; incByCat[k] = (incByCat[k] || 0) + (i.amount || 0); });

  const months6 = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); months6.push(d.toISOString().slice(0, 7)); }
  const monthlyPL = months6.map((m) => {
    const mInc = sales.filter((s) => (s.date || '').startsWith(m)).reduce((s, x) => s + (x.total  || 0), 0) +
                 incomes.filter((x) => (x.date || '').startsWith(m)).reduce((s, x) => s + (x.amount || 0), 0);
    const mExp = feeds.filter((f) => (f.date || '').startsWith(m)).reduce((s, x) => s + (x.cost   || 0), 0) +
                 expenses.filter((e) => (e.date || '').startsWith(m)).reduce((s, x) => s + (x.amount || 0), 0);
    return { month: m, income: mInc, expense: mExp, profit: mInc - mExp };
  });

  // ── PDF generation ────────────────────────────────────────────
  function generatePDF() {
    setGenerating(true);
    const DOC_TITLES = { full:'Complete Farm Report', pnl:'Profit & Loss Statement', loan:'Bank Loan Application Report', herd:'Herd Inventory & Valuation', capital:'Capital & Balance Sheet', bizplan:'Business Plan' };
    const docNum      = `FIQ-${toDay().replace(/-/g, '')}-${docType.toUpperCase()}`;
    const farmName    = biz.farmName || 'FarmIQ Rwanda';
    const ownerLine   = [biz.ownerName ? 'Owner: ' + biz.ownerName : null, biz.phone ? 'Tel: ' + biz.phone : null, biz.email || null].filter(Boolean).join('  |  ');
    const addressLine = [biz.address, biz.district, biz.province, 'Rwanda'].filter(Boolean).join(', ') || 'Rwanda';
    const tinLine     = [biz.tin ? 'TIN: ' + biz.tin : null, biz.licenseNo ? 'License: ' + biz.licenseNo : null].filter(Boolean).join('  |  ');

    const letterhead = `<div class="letterhead"><div class="lh-top-bar"></div><div class="lh-body"><div class="lh-left"><div class="lh-logo-row"><div class="lh-icon">🐷</div><div><div class="lh-farm-name">${farmName}</div><div class="lh-farm-sub">FarmIQ · Rwanda Farm Management</div></div></div><div class="lh-contact">${ownerLine ? `<span>${ownerLine}</span><br/>` : ''}<span>${addressLine}</span><br/>${tinLine ? `<span style="color:rgba(74,222,128,.55)">${tinLine}</span>` : ''}</div></div><div class="lh-right"><div class="lh-doc-type">Official Document</div><div class="lh-doc-title">${DOC_TITLES[docType]}</div><div class="lh-meta"><strong>Doc No.:</strong> ${docNum}<br/><strong>Date:</strong> ${toDay()}<br/><strong>Prices:</strong> ${latestSurveyPrices ? 'Field Survey Data' : 'Market Estimates'}<br/><strong>Currency:</strong> RWF (Rwandan Franc)</div></div></div><div class="lh-bottom-bar"></div></div>`;

    const execBand = `<div class="exec-band"><div class="exec-band-title">Executive Summary</div><div class="kpi-row"><div class="kpi-cell"><div class="kpi-label">Total Revenue</div><div class="kpi-value">RWF ${Math.round(totalInc).toLocaleString()}</div><div class="kpi-sub">${sales.length} sales · ${Object.keys(incByCat).length} categories</div></div><div class="kpi-cell"><div class="kpi-label">Total Expenses</div><div class="kpi-value red">RWF ${Math.round(totalExp).toLocaleString()}</div><div class="kpi-sub">${Object.keys(expByCat).length} expense categories</div></div><div class="kpi-cell"><div class="kpi-label">Net Profit / Loss</div><div class="kpi-value ${netProfit >= 0 ? '' : 'red'}">RWF ${Math.round(Math.abs(netProfit)).toLocaleString()}</div><div class="kpi-sub">${netProfit >= 0 ? '▲ Profitable' : '▼ Loss'} · Margin: ${profitMargin}%</div></div><div class="kpi-cell"><div class="kpi-label">Live Herd Value</div><div class="kpi-value purple">RWF ${Math.round(herdValue).toLocaleString()}</div><div class="kpi-sub">${active.length} active pigs</div></div></div></div>`;

    let body = '';

    // P&L section
    if (['full','pnl','loan'].includes(docType)) {
      const maxM = Math.max(...monthlyPL.map((m) => Math.max(m.income, m.expense, 1)), 1);
      const monthBars = monthlyPL.map((m) => {
        const mn = MONTH_NAMES[parseInt(m.month.split('-')[1]) - 1] + ' ' + m.month.slice(2, 4);
        const iw = Math.round((m.income  / maxM) * 100);
        const ew = Math.round((m.expense / maxM) * 100);
        const p  = m.profit;
        return `<div class="month-bar-row"><div class="month-label">${mn}</div><div style="flex:1"><div style="display:flex;gap:3px;margin-bottom:2px"><div class="month-bar-wrap" style="flex:1"><div class="month-bar" style="width:${iw}%;background:#16a34a;opacity:.85"></div></div><div class="month-bar-wrap" style="flex:1"><div class="month-bar" style="width:${ew}%;background:#dc2626;opacity:.7"></div></div></div></div><div class="month-val" style="color:${p >= 0 ? '#15803d' : '#dc2626'}">${p >= 0 ? '+' : ''}${Math.abs(p) >= 1000 ? Math.round(p / 1000) + 'k' : p.toLocaleString()}</div></div>`;
      }).join('');

      body += `<div class="section"><div class="section-header"><div class="section-icon">📊</div><div class="section-title">Profit & Loss Statement</div><div class="section-badge">ALL TIME · AS OF ${toDay()}</div></div><div class="two-col"><div class="col-box"><div class="col-box-title">💚 Revenue Streams</div>${Object.entries(incByCat).map(([cat, amt]) => `<div class="col-row"><span class="col-row-label">${cat}</span><span class="col-row-val green">RWF ${Math.round(amt).toLocaleString()}</span></div>`).join('')}<div class="col-row" style="margin-top:6px;padding-top:6px;border-top:1.5px solid #d1fae5"><span class="col-row-label" style="font-weight:700;color:#111">Total Revenue</span><span class="col-row-val green" style="font-size:12px">RWF ${Math.round(totalInc).toLocaleString()}</span></div></div><div class="col-box"><div class="col-box-title">🔴 Expense Breakdown</div>${Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`<div class="col-row"><span class="col-row-label">${cat}</span><span class="col-row-val red">RWF ${Math.round(amt).toLocaleString()}</span></div>`).join('')}<div class="col-row" style="margin-top:6px;padding-top:6px;border-top:1.5px solid #fecaca"><span class="col-row-label" style="font-weight:700;color:#111">Total Expenses</span><span class="col-row-val red" style="font-size:12px">RWF ${Math.round(totalExp).toLocaleString()}</span></div></div></div><table><thead><tr><th>Description</th><th class="r">Amount (RWF)</th><th class="r">Note</th></tr></thead><tbody><tr><td>Gross Revenue</td><td class="r green">RWF ${Math.round(totalInc).toLocaleString()}</td><td class="r"><span class="badge badge-green">Income</span></td></tr><tr><td>Less: Total Operating Expenses</td><td class="r red">– RWF ${Math.round(totalExp).toLocaleString()}</td><td class="r"><span class="badge badge-red">Expense</span></td></tr><tr class="grand-total"><td><strong>NET PROFIT / (LOSS)</strong></td><td class="r ${netProfit>=0?'green':'red'}"><strong>${netProfit>=0?'RWF':'(RWF)'} ${Math.abs(Math.round(netProfit)).toLocaleString()}</strong></td><td class="r">${netProfit>=0?'<span class="badge badge-green">✓ Profitable</span>':'<span class="badge badge-red">▼ Loss</span>'}</td></tr><tr><td>Profit Margin</td><td class="r bold">${profitMargin}%</td><td></td></tr><tr><td>Capital Balance</td><td class="r purple">RWF ${Math.round(capitalBalance).toLocaleString()}</td><td></td></tr></tbody></table><div class="sub-header">Monthly Performance Trend (Last 6 Months)</div><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:8px"><div style="display:flex;gap:16px;font-size:9px;color:#6b7280;margin-bottom:10px"><span><span style="display:inline-block;width:10px;height:10px;background:#16a34a;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Income</span><span><span style="display:inline-block;width:10px;height:10px;background:#dc2626;border-radius:2px;margin-right:4px;vertical-align:middle"></span>Expenses</span></div>${monthBars}</div><table><thead><tr><th>Month</th><th class="r">Income (RWF)</th><th class="r">Expenses (RWF)</th><th class="r">Net Profit (RWF)</th><th>Status</th></tr></thead><tbody>${monthlyPL.map(m=>`<tr><td style="font-weight:600">${MONTH_NAMES[parseInt(m.month.split('-')[1])-1]} ${m.month.slice(0,4)}</td><td class="r green">${m.income>0?m.income.toLocaleString():'—'}</td><td class="r red">${m.expense>0?m.expense.toLocaleString():'—'}</td><td class="r bold" style="color:${m.profit>=0?'#15803d':'#dc2626'}">${m.profit>=0?'+':''}${m.profit.toLocaleString()}</td><td>${m.profit>0?'<span class="badge badge-green">Profit</span>':m.profit<0?'<span class="badge badge-red">Loss</span>':'<span class="badge badge-amber">Break-even</span>'}</td></tr>`).join('')}</tbody></table></div>`;

      body += `<div class="section"><div class="section-header"><div class="section-icon">📐</div><div class="section-title">Break-Even Analysis</div></div><table><thead><tr><th>Metric</th><th class="r">Value</th><th>Interpretation</th></tr></thead><tbody><tr><td>Average Revenue per Pig Sold</td><td class="r green">RWF ${avgSalePig.toLocaleString()}</td><td>Avg selling price</td></tr><tr><td>Average Allocated Cost per Pig</td><td class="r red">RWF ${avgCostPig.toLocaleString()}</td><td>Total costs ÷ pigs sold</td></tr><tr><td>Contribution Margin per Pig</td><td class="r bold" style="color:${avgSalePig>avgCostPig?'#15803d':'#dc2626'}">RWF ${(avgSalePig-avgCostPig).toLocaleString()}</td><td>${avgSalePig>avgCostPig?'Profit per pig after costs':'Negative — below cost'}</td></tr><tr><td>Total Pigs Sold (all time)</td><td class="r bold">${sales.length}</td><td></td></tr>${breakEven!==null?`<tr><td>Pigs Required to Break Even</td><td class="r purple">${breakEven} pigs</td><td>Total expenses ÷ margin/pig</td></tr><tr class="section-total"><td><strong>Break-Even Status</strong></td><td class="r">${sales.length>=breakEven?'<span class="badge badge-green">✅ Break-even Reached</span>':'<span class="badge badge-amber">⏳ '+sales.length+' / '+breakEven+' pigs</span>'}</td><td>${sales.length>=breakEven?'Farm has recovered all costs':'Still '+Math.max(breakEven-sales.length,0)+' pigs away'}</td></tr>`:'<tr><td colspan="3" style="color:#9ca3af;font-style:italic">Insufficient sales data for break-even calculation.</td></tr>'}</tbody></table></div>`;
    }

    // Herd section
    if (['full','herd','loan'].includes(docType)) {
      const avgWt = active.length > 0 ? Math.round(active.reduce((s, p) => s + (p.weight || 0), 0) / active.length) : 0;
      body += `<div class="section ${docType==='herd'?'':'page-break'}"><div class="section-header"><div class="section-icon">🐷</div><div class="section-title">Herd Inventory & Valuation</div><div class="section-badge">${active.length} ACTIVE PIGS</div></div><div class="info-box"><span class="info-box-icon">ℹ️</span><span>Market valuations based on <strong>${latestSurveyPrices?'actual field survey prices':'estimated Rwanda market prices'}</strong> as of ${toDay()}.</span></div><div class="two-col" style="margin-bottom:14px"><div class="col-box"><div class="col-box-title">Herd Summary</div><div class="col-row"><span class="col-row-label">Active / In-Farm</span><span class="col-row-val">${active.length} pigs</span></div><div class="col-row"><span class="col-row-label">Total Sold (all time)</span><span class="col-row-val">${sold.length} pigs</span></div><div class="col-row"><span class="col-row-label">Average Weight</span><span class="col-row-val">${avgWt} kg</span></div><div class="col-row"><span class="col-row-label">Sows</span><span class="col-row-val">${active.filter(p=>p.stage==='Sow').length}</span></div><div class="col-row"><span class="col-row-label">Boars</span><span class="col-row-val">${active.filter(p=>p.stage==='Boar').length}</span></div></div><div class="col-box" style="background:#f0fdf4;border-color:#bbf7d0"><div class="col-box-title" style="color:#166534">Herd Valuation</div>${[...new Set(active.map(p=>p.stage))].map(stage=>{const sp=active.filter(p=>p.stage===stage);const sv=sp.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0);return`<div class="col-row"><span class="col-row-label">${stage} (${sp.length})</span><span class="col-row-val green">RWF ${Math.round(sv).toLocaleString()}</span></div>`;}).join('')}<div class="col-row" style="margin-top:6px;padding-top:6px;border-top:1.5px solid #86efac"><span class="col-row-label" style="font-weight:700;color:#111">Total Herd Value</span><span class="col-row-val green" style="font-size:12px">RWF ${Math.round(herdValue).toLocaleString()}</span></div></div></div><table><thead><tr><th>#</th><th>Tag / ID</th><th>Breed</th><th>Gender</th><th>Stage</th><th class="r">Weight (kg)</th><th class="r">Market Value</th><th>Status</th></tr></thead><tbody>${active.map((p,i)=>{const val=latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight);return`<tr><td style="color:#9ca3af">${i+1}</td><td class="bold">${p.tag}</td><td>${p.breed||'—'}</td><td>${p.gender||'—'}</td><td><span class="badge badge-green">${p.stage}</span></td><td class="r bold">${p.weight||'—'}</td><td class="r green">RWF ${val.toLocaleString()}</td><td><span class="badge badge-blue">Active</span></td></tr>`;}).join('')}<tr class="grand-total"><td colspan="5"><strong>TOTAL HERD VALUE</strong></td><td class="r">${active.length} pigs</td><td class="r green"><strong>RWF ${Math.round(herdValue).toLocaleString()}</strong></td><td></td></tr></tbody></table></div>`;
    }

    // Loan section
    if (docType === 'loan') {
      const sows     = active.filter((p) => p.stage === 'Sow');
      const boars    = active.filter((p) => p.stage === 'Boar');
      const growStock= active.filter((p) => !['Sow','Boar'].includes(p.stage));
      body += `<div class="section page-break"><div class="section-header"><div class="section-icon">🏦</div><div class="section-title">Bank Loan Application Summary</div><div class="section-badge">CONFIDENTIAL</div></div><div class="info-box blue"><span class="info-box-icon">🏦</span><span>This document is prepared for financial institution review. All figures are derived from the FarmIQ management system and represent actual recorded transactions.</span></div><div class="sub-header">Business Identification</div><table><thead><tr><th>Field</th><th>Details</th></tr></thead><tbody><tr><td class="bold">Business / Farm Name</td><td>${biz.farmName||'—'}</td></tr><tr><td class="bold">Owner / Applicant</td><td>${biz.ownerName||'—'}</td></tr><tr><td class="bold">Business Address</td><td>${addressLine}</td></tr><tr><td class="bold">TIN Number</td><td>${biz.tin||'—'}</td></tr><tr><td class="bold">Business License No.</td><td>${biz.licenseNo||'—'}</td></tr><tr><td class="bold">Year Established</td><td>${biz.established||'—'}</td></tr><tr><td class="bold">Bank / Financial Institution</td><td>${biz.bankName||'—'}</td></tr><tr><td class="bold">Bank Account Number</td><td>${biz.bankAccount||'—'}</td></tr><tr><td class="bold">Contact Phone</td><td>${biz.phone||'—'}</td></tr><tr><td class="bold">Email Address</td><td>${biz.email||'—'}</td></tr></tbody></table><div class="sub-header">Financial Position & Collateral</div><table><thead><tr><th>Asset / Liability</th><th class="r">Estimated Value (RWF)</th><th>Category</th></tr></thead><tbody><tr><td>Live Herd Market Value</td><td class="r green">RWF ${Math.round(herdValue).toLocaleString()}</td><td><span class="badge badge-green">Asset</span></td></tr><tr><td>Capital Balance (Cash Equivalent)</td><td class="r green">RWF ${Math.round(capitalBalance).toLocaleString()}</td><td><span class="badge badge-green">Asset</span></td></tr><tr><td>Total Revenue (Recorded)</td><td class="r green">RWF ${Math.round(totalInc).toLocaleString()}</td><td><span class="badge badge-blue">Revenue</span></td></tr><tr><td>Total Expenses (Recorded)</td><td class="r red">RWF ${Math.round(totalExp).toLocaleString()}</td><td><span class="badge badge-red">Expense</span></td></tr><tr><td>Net Profit</td><td class="r bold" style="color:${netProfit>=0?'#15803d':'#dc2626'}">RWF ${Math.round(Math.abs(netProfit)).toLocaleString()}</td><td>${netProfit>=0?'<span class="badge badge-green">Profit</span>':'<span class="badge badge-red">Loss</span>'}</td></tr><tr class="grand-total"><td><strong>ESTIMATED TOTAL COLLATERAL</strong></td><td class="r green"><strong>RWF ${Math.round(herdValue+capitalBalance).toLocaleString()}</strong></td><td></td></tr></tbody></table><div class="sub-header">Breeding Stock (Core Business Assets)</div><table><thead><tr><th>Category</th><th class="r">Head Count</th><th class="r">Estimated Value (RWF)</th></tr></thead><tbody><tr><td>Sows (Breeding Females)</td><td class="r bold">${sows.length} head</td><td class="r green">RWF ${Math.round(sows.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr><tr><td>Boars (Breeding Males)</td><td class="r bold">${boars.length} head</td><td class="r green">RWF ${Math.round(boars.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr><tr><td>Growing & Fattening Stock</td><td class="r bold">${growStock.length} head</td><td class="r green">RWF ${Math.round(growStock.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr><tr class="section-total"><td><strong>Total Breeding Capital</strong></td><td class="r">${active.length} head</td><td class="r green"><strong>RWF ${Math.round(herdValue).toLocaleString()}</strong></td></tr></tbody></table><div class="sig-grid" style="margin-top:28px"><div class="sig-box"><div class="sig-name">${biz.ownerName||'________________________'}</div><div class="sig-role">Applicant / Farm Owner</div><div class="sig-date">Date: ${toDay()}</div></div><div class="sig-box"><div class="sig-name">________________________</div><div class="sig-role">Authorizing Officer</div><div class="sig-date">Date: _______________</div></div><div class="sig-box"><div class="sig-name">________________________</div><div class="sig-role">Bank Official / Stamp</div><div class="sig-date">Ref No.: _______________</div></div></div></div>`;
    }

    // Capital section
    if (['full','capital'].includes(docType)) {
      const pdfStockValue = Math.round((stock || []).reduce((t, s) => t + s.quantity * (s.costPerUnit || 0), 0));
      const pdfSalaryCost = Math.round(expenses.filter((e) => e.category === 'Salary').reduce((s, e) => s + (e.amount || 0), 0));
      const netWorth      = Math.round(capitalBalance + herdValue + pdfStockValue);
      body += `<div class="section ${docType==='capital'?'':'page-break'}"><div class="section-header"><div class="section-icon">💵</div><div class="section-title">Capital & Balance Sheet</div></div><div class="two-col"><div class="col-box"><div class="col-box-title">Capital Movement</div><div class="col-row"><span class="col-row-label">Opening Capital</span><span class="col-row-val">RWF ${Math.round(capital?.initial||0).toLocaleString()}</span></div><div class="col-row"><span class="col-row-label">+ Total Revenue</span><span class="col-row-val green">+ RWF ${Math.round(totalInc).toLocaleString()}</span></div><div class="col-row"><span class="col-row-label">– Operations Expenses</span><span class="col-row-val red">– RWF ${Math.round(totalExp-pdfSalaryCost).toLocaleString()}</span></div><div class="col-row"><span class="col-row-label">– Salaries Paid</span><span class="col-row-val red">– RWF ${pdfSalaryCost.toLocaleString()}</span></div><div class="col-row" style="margin-top:6px;padding-top:6px;border-top:1.5px solid #d1fae5"><span class="col-row-label" style="font-weight:700;color:#111">Capital Balance</span><span class="col-row-val green" style="font-size:12px">RWF ${Math.round(capitalBalance).toLocaleString()}</span></div></div><div class="col-box" style="background:#faf5ff;border-color:#ddd6fe"><div class="col-box-title" style="color:#6d28d9">Total Net Worth</div><div class="col-row"><span class="col-row-label">Cash Capital Balance</span><span class="col-row-val" style="color:#15803d">RWF ${Math.round(capitalBalance).toLocaleString()}</span></div><div class="col-row"><span class="col-row-label">Live Herd Market Value</span><span class="col-row-val purple">RWF ${Math.round(herdValue).toLocaleString()}</span></div><div class="col-row"><span class="col-row-label">Stock & Inventory Value</span><span class="col-row-val blue">RWF ${pdfStockValue.toLocaleString()}</span></div><div class="col-row" style="margin-top:6px;padding-top:6px;border-top:1.5px solid #ddd6fe"><span class="col-row-label" style="font-weight:700;color:#111">Total Net Worth</span><span class="col-row-val" style="color:#7c3aed;font-size:12px">RWF ${netWorth.toLocaleString()}</span></div></div></div><table><thead><tr><th>Balance Sheet Item</th><th class="r">Amount (RWF)</th><th>Type</th></tr></thead><tbody><tr><td>Opening Capital</td><td class="r">RWF ${Math.round(capital?.initial||0).toLocaleString()}</td><td><span class="badge badge-blue">Starting</span></td></tr><tr><td>+ Total Revenue</td><td class="r green">+ RWF ${Math.round(totalInc).toLocaleString()}</td><td><span class="badge badge-green">Inflow</span></td></tr><tr><td>– Feed & Operations Expenses</td><td class="r red">– RWF ${Math.round(totalExp-pdfSalaryCost).toLocaleString()}</td><td><span class="badge badge-red">Outflow</span></td></tr><tr><td>– Salaries Paid</td><td class="r red">– RWF ${pdfSalaryCost.toLocaleString()}</td><td><span class="badge badge-red">Outflow</span></td></tr><tr class="section-total"><td><strong>CAPITAL BALANCE (Cash)</strong></td><td class="r green"><strong>RWF ${Math.round(capitalBalance).toLocaleString()}</strong></td><td><span class="badge badge-green">Balance</span></td></tr><tr><td>+ Live Herd Market Value</td><td class="r purple">RWF ${Math.round(herdValue).toLocaleString()}</td><td><span class="badge badge-purple">Asset</span></td></tr><tr><td>+ Stock & Feed Inventory</td><td class="r blue">RWF ${pdfStockValue.toLocaleString()}</td><td><span class="badge badge-blue">Asset</span></td></tr><tr class="grand-total"><td><strong>TOTAL NET WORTH</strong></td><td class="r green"><strong>RWF ${netWorth.toLocaleString()}</strong></td><td></td></tr></tbody></table></div>`;
    }

    const footer = `<div class="doc-footer"><div class="footer-row"><div class="footer-left"><strong>Generated by:</strong> FarmIQ Rwanda Farm Management System &nbsp;|&nbsp; <strong>Date:</strong> ${toDay()} &nbsp;|&nbsp; <strong>Doc No.:</strong> ${docNum}<br/>${biz.farmName ? `<strong>Farm:</strong> ${biz.farmName}${biz.tin ? ' &nbsp;|&nbsp; <strong>TIN:</strong> ' + biz.tin : ''} &nbsp;|&nbsp; ` : ''}All figures derived from recorded farm transactions. ${latestSurveyPrices ? 'Herd valuations use field survey prices.' : 'Herd valuations use estimated market prices.'}<br/><em>For official financial statements, consult a certified accountant.</em></div><div class="footer-right"><div class="footer-brand">🐷 FarmIQ</div><div>Page 1</div></div></div></div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${farmName} — ${DOC_TITLES[docType]}</title><style>${PDF_CSS}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:12mm 14mm;}}</style></head><body><div class="watermark">FARMIQ</div><div class="page">${letterhead}${docType === 'bizplan' ? '' : execBand}<div class="content">${body}</div>${footer}</div><script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } else {
      setPopupBlocked(true);
      const a = document.createElement('a');
      a.href = url; a.download = `FarmIQ_${DOC_TITLES[docType].replace(/\s+/g, '_')}_${toDay()}.html`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 3000);
    }
    setGenerating(false);
  }

  // ── Editable business-plan field ─────────────────────────────
  function BPField({ label, k, placeholder, multiline }) {
    const common = {
      width: '100%', background: C.elevated, border: `1px solid ${C.border}`,
      borderRadius: 8, color: C.text, fontSize: 13, fontFamily: 'inherit',
      padding: '10px 12px', boxSizing: 'border-box', resize: 'vertical', outline: 'none', lineHeight: 1.5,
    };
    return (
      <div style={{ marginBottom: 12 }} onClick={(e) => e.stopPropagation()}>
        <label style={{ ...S.lbl, marginBottom: 4 }}>{label}</label>
        {multiline
          ? <textarea value={bizPlan[k]} onChange={(e) => bpSet(k, e.target.value)} placeholder={placeholder || ''} rows={3} style={common} onFocus={(e) => e.stopPropagation()} />
          : <input    value={bizPlan[k]} onChange={(e) => bpSet(k, e.target.value)} placeholder={placeholder || ''}                     style={common} onFocus={(e) => e.stopPropagation()} />
        }
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div style={S.h1}>📄 Professional PDF Reports</div>
      <div style={S.sub}>Bank-ready documents with business address, verified financials, and proper formatting</div>

      {(!biz.farmName || !biz.address) && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: C.amber }}>
          ⚠️ <strong>Business Profile incomplete.</strong> Go to <strong>🏢 Business Profile</strong> to add your farm name, address, and TIN.
        </div>
      )}

      {biz.farmName && (
        <div style={{ ...S.card, marginBottom: 16, background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.2)' }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>📋 Business details on documents:</div>
          <div style={{ fontWeight: 700, color: C.text }}>{biz.farmName}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{[biz.address, biz.district, biz.province, 'Rwanda'].filter(Boolean).join(', ')}</div>
          <div style={{ fontSize: 11, color: C.faint }}>Tel: {biz.phone || '—'} | TIN: {biz.tin || '—'}</div>
        </div>
      )}

      <div style={{ ...S.card, marginBottom: 16, background: 'rgba(22,163,74,.03)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📊 Verified Financial Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          {[
            ['💚 Total Income',  fmtRWF(totalInc),      '#10b981'],
            ['🔴 Total Expenses',fmtRWF(totalExp),      C.red    ],
            [netProfit >= 0 ? '✅ Net Profit' : '⚠️ Net Loss', fmtRWF(netProfit), netProfit >= 0 ? '#16a34a' : C.red],
            ['🐷 Herd Value',    fmtRWF(herdValue),     C.purple ],
            ['💵 Capital Balance',fmtRWF(capitalBalance),C.blue  ],
            ['📐 Profit Margin', profitMargin + '%',    parseFloat(profitMargin) > 0 ? '#16a34a' : C.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: C.elevated, borderRadius: 8, padding: '8px 11px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.faint }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        {breakEven && (
          <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, fontSize: 12, color: '#6366f1' }}>
            📐 Break-even: {breakEven} pigs to sell | Current: {sales.length} sold {sales.length >= breakEven ? '✅ Reached!' : '⏳'}
          </div>
        )}
        {latestSurveyPrices && <div style={{ fontSize: 11, color: C.accent, marginTop: 8 }}>✅ Using field survey prices for herd valuation</div>}
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Select Document Type</div>
        {DOC_OPTIONS.map((opt) => (
          <div key={opt.id} onClick={() => setDocType(opt.id)} style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
            background: docType === opt.id ? 'rgba(22,163,74,.08)' : C.elevated,
            border:     docType === opt.id ? '1.5px solid rgba(22,163,74,.4)' : `1px solid ${C.border}`,
            transition: 'all .15s',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: docType === opt.id ? C.accent : C.text }}>{opt.label}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{opt.desc}</div>
            {opt.id === 'loan' && <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>⚠️ Requires complete Business Profile for maximum effectiveness</div>}
            {opt.id === 'bizplan' && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>✏️ Fill in the editable fields below before generating</div>}
          </div>
        ))}

        {docType === 'bizplan' && (
          <div style={{ marginTop: 4, padding: '16px 14px', background: 'rgba(99,102,241,.04)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 12 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 14 }}>✏️ Business Plan Content — edit before generating</div>
            <div style={{ fontSize: 11, color: C.amber, marginBottom: 12, padding: '8px 10px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8 }}>
              💡 All fields are optional. Financial data is auto-filled from your records.
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>🏢 Company Identity</div>
            <BPField k="mission"    label="Mission Statement"    placeholder='e.g. "To produce high-quality pigs using modern farming techniques…"' multiline />
            <BPField k="vision"     label="Vision Statement"     placeholder='e.g. "To become the leading pig farm supplier in the Northern Province by 2027."' />
            <BPField k="objectives" label="Business Objectives"  placeholder='e.g. "1. Grow herd to 200 pigs…"' multiline />
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>🐷 Products & Market</div>
            <BPField k="products"   label="Products & Services"  placeholder='e.g. "Live pigs at various stages, organic manure…"' multiline />
            <BPField k="market"     label="Target Market"        placeholder='e.g. "Primary: local butcheries in Musanze District…"' multiline />
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>⚙️ Operations</div>
            <BPField k="operations" label="Operations Plan"      placeholder='e.g. "Farm operates 7 days/week with 2 full-time workers…"' multiline />
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>📊 3-Year Financial Projections</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Year 1','1'],['Year 2','2'],['Year 3','3']].map(([yr, n]) => (
                <div key={yr} style={{ gridColumn: 'span 1' }}>
                  <BPField k={`proj${n}Revenue`}  label={`${yr} Revenue (RWF)`}  placeholder={n==='1'?'e.g. 4,500,000':n==='2'?'e.g. 7,200,000':'e.g. 11,000,000'} />
                  <BPField k={`proj${n}Expenses`} label={`${yr} Expenses (RWF)`} placeholder={n==='1'?'e.g. 3,000,000':n==='2'?'e.g. 4,800,000':'e.g. 7,000,000'}  />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>🔷 SWOT Analysis</div>
            <BPField k="strengths"     label="Strengths"     placeholder='e.g. "Experienced management, quality breeding stock…"' />
            <BPField k="weaknesses"    label="Weaknesses"    placeholder='e.g. "Limited land, dependence on imported feed…"' />
            <BPField k="opportunities" label="Opportunities" placeholder='e.g. "Growing demand for pork in Kigali…"' />
            <BPField k="threats"       label="Threats"       placeholder='e.g. "Disease outbreaks (ASF risk), rising feed prices…"' />
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>🏦 Loan / Funding Request (optional)</div>
            <BPField k="loanAmount"  label="Amount Requested (RWF)" placeholder='e.g. "5,000,000"' />
            <BPField k="loanPurpose" label="Purpose of Funds"       placeholder='e.g. "Expand pig housing capacity…"' multiline />
          </div>
        )}

        {popupBlocked && (
          <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 9, marginBottom: 10, marginTop: 10, fontSize: 12, color: C.accent }}>
            ✅ Your PDF is downloading as an HTML file. Open it in Chrome and use Print → Save as PDF.
          </div>
        )}
        <button onClick={generatePDF} disabled={generating} style={{ ...S.btn(), width: '100%', padding: 13, fontSize: 14, marginTop: 12 }}>
          {generating ? '⏳ Generating…' : '📄 Open & Save as PDF →'}
        </button>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 8, textAlign: 'center' }}>
          Opens print preview · tap <strong>Save as PDF</strong> in the print dialog
        </div>
      </div>
    </div>
  );
}
