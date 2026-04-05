/* ─── PDF Generator ─── */
function buildPDFHTML(type,data){
  const{pigs=[],feeds=[],sales=[],logs=[],expenses=[],incomes=[],users=[],messages=[],reproductions=[],stock=[]}=data;
  const biz=getBusinessProfile();
  const active=pigs.filter(p=>p.status==="active");
  const totalSaleInc=sales.reduce((s,l)=>s+(l.total||0),0);
  const totalOtherInc=incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalIncome=totalSaleInc+totalOtherInc;
  const totalFeedCost=feeds.reduce((s,l)=>s+(l.cost||0),0);
  const totalOtherExp=expenses.reduce((s,l)=>s+(l.amount||0),0);
  const totalExpense=totalFeedCost+totalOtherExp;
  const profit=totalIncome-totalExpense;
  const herdValue=active.reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);
  const now=new Date().toLocaleDateString("en-RW",{year:"numeric",month:"long",day:"numeric"});
  const css=`body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#fff;color:#1a1a2e;}.header{background:linear-gradient(135deg,#0f1117,#161b24);color:#fff;padding:32px 40px;position:relative;}.header::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;background:#16c784;}.logo{font-size:26px;font-weight:900;color:#16c784;letter-spacing:-1px;}.logo span{color:#e8edf5;}.subtitle{font-size:11px;color:#8a99b3;letter-spacing:2px;text-transform:uppercase;margin-top:4px;}.report-type{font-size:13px;color:#16c784;text-align:right;font-weight:700;letter-spacing:1px;}.meta{font-size:11px;color:#8a99b3;text-align:right;margin-top:3px;}.body{padding:32px 40px;}.section-title{font-size:13px;font-weight:800;color:#0f1117;text-transform:uppercase;letter-spacing:1.5px;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #16c784;}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}.stat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;}.stat-val{font-size:20px;font-weight:800;color:#0f1117;margin:4px 0 2px;}.stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;}.stat-box.green .stat-val{color:#16c784;}.stat-box.red .stat-val{color:#ef4444;}.stat-box.amber .stat-val{color:#f59e0b;}.stat-box.purple .stat-val{color:#8b5cf6;}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;}th{background:#f1f5f9;color:#475569;text-transform:uppercase;font-size:10px;letter-spacing:1px;padding:10px 12px;text-align:left;border-bottom:1px solid #e2e8f0;}td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#334155;}tr:nth-child(even) td{background:#f8fafc;}.income-row td:last-child{color:#16c784;font-weight:700;}.expense-row td:last-child{color:#ef4444;font-weight:700;}.profit-row{background:#f0fdf4!important;}.profit-row td{color:#16c784;font-weight:800;font-size:13px;}.loss-row{background:#fef2f2!important;}.loss-row td{color:#ef4444;font-weight:800;font-size:13px;}.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;}.badge-green{background:#dcfce7;color:#16a34a;}.badge-red{background:#fee2e2;color:#dc2626;}.badge-amber{background:#fef3c7;color:#d97706;}.badge-blue{background:#dbeafe;color:#2563eb;}.summary-box{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin:20px 0;}.summary-box.red{background:#fef2f2;border-color:#fca5a5;}.footer{position:fixed;bottom:0;left:0;right:0;background:#f8fafc;border-top:1px solid #e2e8f0;padding:8px 40px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;}.page-break{page-break-before:always;}@media print{.footer{position:fixed;bottom:0;}}`;
  let title="FULL FARM REPORT";
  if(type==="finance")title="FINANCIAL & LEDGER REPORT";
  if(type==="health")title="HEALTH & OPERATIONS REPORT";
  if(type==="messages")title="WORKER MESSAGES REPORT";
  if(type==="pnl")title="PROFIT & LOSS ANALYSIS";
  const allIncomeRows=[...sales.map(s=>{const pig=pigs.find(p=>p.id===s.pigId);return{date:s.date,cat:"Pig Sale",desc:`${pig?pig.tag:"Pig"} sold to ${s.buyer||"—"} (${s.weight||0}kg @ RWF${fmtNum(s.priceKg)}/kg)`,amount:s.total,worker:s.worker};}), ...incomes.map(i=>({date:i.date,cat:i.category,desc:i.description||i.category,amount:i.amount,worker:i.worker||"Admin"}))].sort((a,b)=>b.date?.localeCompare(a.date));
  const allExpenseRows=[...feeds.map(f=>({date:f.date,cat:"Feed Purchase",desc:`${f.feedType} (${f.kg}kg) — ${f.worker}`,amount:f.cost,worker:f.worker})), ...expenses.map(e=>({date:e.date,cat:e.category,desc:e.description||e.category,amount:e.amount,worker:e.worker||"Admin"}))].sort((a,b)=>b.date?.localeCompare(a.date));
  const expByCat={};allExpenseRows.forEach(r=>{expByCat[r.cat]=(expByCat[r.cat]||0)+r.amount;});
  const incByCat={};allIncomeRows.forEach(r=>{incByCat[r.cat]=(incByCat[r.cat]||0)+r.amount;});
  let body="";
  if(type==="farm"||type==="finance"||type==="pnl"){
    body+=`<div class="stat-grid"><div class="stat-box green"><div class="stat-lbl">Total Income</div><div class="stat-val">${fmtRWF(totalIncome)}</div></div><div class="stat-box red"><div class="stat-lbl">Total Expenses</div><div class="stat-val">${fmtRWF(totalExpense)}</div></div><div class="stat-box ${profit>=0?"green":"red"}"><div class="stat-lbl">Net Profit</div><div class="stat-val">${fmtRWF(profit)}</div></div><div class="stat-box purple"><div class="stat-lbl">Herd Market Value</div><div class="stat-val">${fmtRWF(herdValue)}</div></div></div>`;
    body+=`<div class="summary-box ${profit<0?"red":""}"><strong>${profit>=0?"✅ Farm is Profitable":"⚠️ Farm Running at a Loss"}</strong> — Net: <strong>${fmtRWF(profit)}</strong> | Income: ${fmtRWF(totalIncome)} | Expenses: ${fmtRWF(totalExpense)} | Herd Value: ${fmtRWF(herdValue)}</div>`;
    body+=`<div class="section-title">Income by Category</div><table><thead><tr><th>Category</th><th>Amount</th><th>% of Total</th></tr></thead><tbody>`;
    Object.entries(incByCat).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>{body+=`<tr class="income-row"><td>${cat}</td><td>${fmtRWF(amt)}</td><td>${totalIncome>0?((amt/totalIncome)*100).toFixed(1):0}%</td></tr>`;});
    body+=`<tr style="background:#f0fdf4"><td><strong>TOTAL INCOME</strong></td><td><strong>${fmtRWF(totalIncome)}</strong></td><td>100%</td></tr></tbody></table>`;
    body+=`<div class="section-title">Expenses by Category</div><table><thead><tr><th>Category</th><th>Amount</th><th>% of Total</th></tr></thead><tbody>`;
    Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).forEach(([cat,amt])=>{body+=`<tr class="expense-row"><td>${cat}</td><td>${fmtRWF(amt)}</td><td>${totalExpense>0?((amt/totalExpense)*100).toFixed(1):0}%</td></tr>`;});
    body+=`<tr style="background:#fef2f2"><td><strong>TOTAL EXPENSES</strong></td><td><strong>${fmtRWF(totalExpense)}</strong></td><td>100%</td></tr></tbody></table>`;
    // P&L for unsold pigs
    body+=`<div class="section-title page-break">Active Pig Valuations (Unsold Stock)</div><table><thead><tr><th>Tag</th><th>Stage</th><th>Weight</th><th>Breed</th><th>Market Value (Est.)</th><th>Status</th></tr></thead><tbody>`;
    active.forEach(pig=>{const val=getMarketPrice(pig.stage,pig.weight);body+=`<tr><td><strong>${pig.tag}</strong></td><td>${pig.stage}</td><td>${pig.weight}kg</td><td>${pig.breed}</td><td style="color:#16c784;font-weight:700">${fmtRWF(val)}</td><td><span class="badge badge-green">Active</span></td></tr>`;});
    body+=`<tr style="background:#f0fdf4"><td colspan="4"><strong>TOTAL HERD VALUE</strong></td><td style="color:#16c784;font-weight:800">${fmtRWF(herdValue)}</td><td></td></tr></tbody></table>`;
    body+=`<div class="section-title">All Income Transactions (${allIncomeRows.length})</div><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>`;
    allIncomeRows.forEach(r=>{body+=`<tr class="income-row"><td>${r.date||"—"}</td><td>${r.cat}</td><td>${r.desc}</td><td>${fmtRWF(r.amount)}</td></tr>`;});
    if(!allIncomeRows.length)body+=`<tr><td colspan="4" style="color:#94a3b8;text-align:center">No income records yet</td></tr>`;
    body+=`</tbody></table>`;
    body+=`<div class="section-title">All Expense Transactions (${allExpenseRows.length})</div><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>`;
    allExpenseRows.forEach(r=>{body+=`<tr class="expense-row"><td>${r.date||"—"}</td><td>${r.cat}</td><td>${r.desc}</td><td>${fmtRWF(r.amount)}</td></tr>`;});
    if(!allExpenseRows.length)body+=`<tr><td colspan="4" style="color:#94a3b8;text-align:center">No expense records yet</td></tr>`;
    body+=`</tbody></table>`;
  }
  if(type==="farm"||type==="health"){
    body+=`<div class="section-title page-break">Herd Summary</div><div class="stat-grid"><div class="stat-box green"><div class="stat-lbl">Active Pigs</div><div class="stat-val">${active.length}</div></div><div class="stat-box"><div class="stat-lbl">Sold Pigs</div><div class="stat-val">${pigs.filter(p=>p.status==="sold").length}</div></div><div class="stat-box amber"><div class="stat-lbl">Market Ready (80kg+)</div><div class="stat-val">${active.filter(p=>p.weight>=80).length}</div></div><div class="stat-box purple"><div class="stat-lbl">Breeding Females</div><div class="stat-val">${active.filter(p=>p.stage==="Sow"||p.stage==="Gilt").length}</div></div></div>`;
    body+=`<table><thead><tr><th>Tag</th><th>Breed</th><th>Gender</th><th>Stage</th><th>Weight</th><th>Market Value</th><th>Status</th><th>DOB</th></tr></thead><tbody>`;
    pigs.forEach(p=>{body+=`<tr><td><strong>${p.tag}</strong></td><td>${p.breed}</td><td>${p.gender}</td><td>${p.stage}</td><td>${p.weight}kg</td><td>${p.status==="active"?fmtRWF(getMarketPrice(p.stage,p.weight)):"Sold"}</td><td><span class="badge ${p.status==="active"?"badge-green":"badge-red"}">${p.status}</span></td><td>${p.dob||"—"}</td></tr>`;});
    body+=`</tbody></table>`;
    const totalSick=logs.reduce((s,l)=>s+(l.sick||0),0);
    const totalDeaths=logs.reduce((s,l)=>s+(l.deaths||0),0);
    const totalBirths=logs.reduce((s,l)=>s+(l.births||0),0);
    body+=`<div class="section-title">Daily Logs Summary</div><div class="stat-grid"><div class="stat-box"><div class="stat-lbl">Total Logs</div><div class="stat-val">${logs.length}</div></div><div class="stat-box red"><div class="stat-lbl">Total Sick Reports</div><div class="stat-val">${totalSick}</div></div><div class="stat-box red"><div class="stat-lbl">Total Deaths</div><div class="stat-val">${totalDeaths}</div></div><div class="stat-box green"><div class="stat-lbl">Total Births</div><div class="stat-val">${totalBirths}</div></div></div>`;
    body+=`<table><thead><tr><th>Date</th><th>Worker</th><th>Checked</th><th>Sick</th><th>Deaths</th><th>Births</th><th>Water</th><th>Cleaned</th></tr></thead><tbody>`;
    logs.slice().reverse().slice(0,30).forEach(l=>{body+=`<tr><td>${l.date}</td><td>${l.worker}</td><td>${l.checked}</td><td><span class="badge ${l.sick>0?"badge-red":"badge-green"}">${l.sick}</span></td><td><span class="badge ${l.deaths>0?"badge-red":"badge-green"}">${l.deaths}</span></td><td><span class="badge badge-blue">${l.births}</span></td><td>${l.water?"✓":"✗"}</td><td>${l.cleaned?"✓":"✗"}</td></tr>`;if(l.notes)body+=`<tr><td colspan="8" style="color:#64748b;font-style:italic;font-size:11px;background:#f8fafc">Notes: ${l.notes}</td></tr>`;});
    if(!logs.length)body+=`<tr><td colspan="8" style="color:#94a3b8;text-align:center">No logs yet</td></tr>`;
    body+=`</tbody></table>`;
    // Reproduction summary
    if(reproductions.length>0){
      body+=`<div class="section-title">Reproduction Records</div><table><thead><tr><th>Sow</th><th>Boar</th><th>Mating Date</th><th>Expected Farrowing</th><th>Status</th><th>Piglets</th></tr></thead><tbody>`;
      reproductions.forEach(r=>{const sow=pigs.find(p=>p.id===r.sowId);const boar=pigs.find(p=>p.id===r.boarId);body+=`<tr><td>${sow?sow.tag:"—"}</td><td>${boar?boar.tag:"—"}</td><td>${r.matingDate||"—"}</td><td>${r.expectedFarrow||"—"}</td><td><span class="badge ${r.status==="farrowed"?"badge-green":r.status==="pregnant"?"badge-amber":"badge-red"}">${r.status}</span></td><td>${r.piglets||"—"}</td></tr>`;});
      body+=`</tbody></table>`;
    }
  }
  if(type==="messages"){
    const workers=users.filter(u=>u.role==="worker"&&u.approved);
    body+=`<div class="section-title">Worker Overview</div><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead><tbody>`;
    workers.forEach(w=>{body+=`<tr><td>${w.name}</td><td>@${w.username}</td><td>Worker</td><td><span class="badge badge-green">Active</span></td></tr>`;});
    body+=`</tbody></table><div class="section-title">Broadcast Messages (${messages.length})</div>`;
    messages.slice().reverse().forEach(m=>{body+=`<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px"><div style="font-size:11px;color:#64748b;margin-bottom:6px"><strong>${m.from}</strong> · ${m.date} ${m.time} · Sent to ${m.recipients} worker(s)</div><div style="font-size:12px;color:#1e293b;line-height:1.6">${m.text}</div></div>`;});
    if(!messages.length)body+=`<p style="color:#94a3b8;font-size:13px">No messages sent yet.</p>`;
  }
  return`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>FarmIQ Report</title><style>${css}</style></head><body><div class="header"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="logo">${biz.farmName?`🐷 ${biz.farmName}`:"🐷 Farm<span>IQ</span>"}</div><div class="subtitle">${biz.farmName?"AI Pig Farm Management · Rwanda":"AI Pig Farm Management System — Rwanda"}</div>${biz.address?`<div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:3px">${[biz.address,biz.district,biz.province,"Rwanda"].filter(Boolean).join(", ")}</div>`:""}${biz.phone||biz.tin?`<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px">${biz.phone?`Tel: ${biz.phone}`:""} ${biz.tin?`| TIN: ${biz.tin}`:""}</div>`:""}</div><div style="text-align:right"><div class="report-type">${title}</div><div class="meta">Generated: ${now}</div>${biz.ownerName?`<div class="meta">Owner: ${biz.ownerName}</div>`:""}</div></div></div><div class="body">${body}</div><div class="footer"><span>${biz.farmName||"FarmIQ"} — Confidential Farm Report — ${now}</span><span>${biz.tin?`TIN: ${biz.tin} | `:""}Powered by FarmIQ AI</span></div></body></html>`;
}

function downloadPDF(type,data,label){
  const html=buildPDFHTML(type,data);
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const win=window.open(url,"_blank");
  if(win){win.onload=()=>{setTimeout(()=>{win.focus();win.print();},200);};}
  else{const a=document.createElement("a");a.href=url;a.download=`FarmIQ_${type}_${toDay()}.html`;a.click();}
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

/* ─── Colors & Styles ─── */
const C={
  base:"#f0f4f0",surface:"#ffffff",card:"#ffffff",elevated:"#f7faf7",
  border:"#e4ebe4",borderSoft:"#edf2ed",
  accent:"#16a34a",accentSoft:"rgba(22,163,74,.08)",
  text:"#141f14",muted:"#4b6050",faint:"#8da898",
  red:"#dc2626",amber:"#d97706",blue:"#2563eb",purple:"#7c3aed",pink:"#db2777",
};
const S={
  app:{
    fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
    background:"#f0f4f0",minHeight:"100vh",display:"flex",color:C.text,
    backgroundImage:"radial-gradient(ellipse 80% 40% at 50% -5%,rgba(22,163,74,.055) 0%,transparent 60%)"
  },
  side:{
    width:228,
    background:"linear-gradient(175deg,#091a0e 0%,#0f2316 45%,#112918 100%)",
    borderRight:"none",padding:"0",display:"flex",flexDirection:"column",flexShrink:0,
    boxShadow:"5px 0 28px rgba(0,0,0,.22),1px 0 0 rgba(74,222,128,.06)",
    overflowY:"auto"
  },
  nb:(a)=>({
    display:"flex",alignItems:"center",gap:8,width:"100%",textAlign:"left",
    padding:"9px 16px 9px 18px",
    background:a?"rgba(74,222,128,.13)":"transparent",
    border:"none",
    color:a?"#d6f5de":"rgba(255,255,255,.5)",
    fontSize:12.5,cursor:"pointer",
    borderLeft:a?"3px solid #4ade80":"3px solid transparent",
    marginBottom:1,
    transition:"all .18s cubic-bezier(.22,1,.36,1)",
    fontFamily:"inherit",fontWeight:a?650:400,
    letterSpacing:a?.08:0,
    borderRadius:"0 8px 8px 0",
  }),
  main:{flex:1,padding:"24px 28px",overflowY:"auto",background:"transparent",minWidth:0},
  card:{
    background:C.surface,border:"1px solid "+C.border,borderRadius:14,padding:18,marginBottom:14,
    boxShadow:"0 1px 4px rgba(0,0,0,.05),0 2px 10px rgba(0,0,0,.04)",
    transition:"box-shadow .2s,border-color .2s",
  },
  aiCard:{
    background:"linear-gradient(135deg,#f0fdf4 0%,#fafffe 100%)",
    border:"1px solid rgba(22,163,74,.22)",borderRadius:14,padding:18,marginBottom:14,
    boxShadow:"0 2px 12px rgba(22,163,74,.07)",
  },
  h1:{fontSize:22,fontWeight:800,color:C.text,marginBottom:4,letterSpacing:-.4},
  sub:{fontSize:13,color:C.muted,marginBottom:18,lineHeight:1.5},
  g4:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18},
  g3:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18},
  g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  stat:{
    background:C.surface,border:"1px solid "+C.border,borderRadius:13,padding:"16px 16px 14px",
    boxShadow:"0 1px 4px rgba(0,0,0,.05),0 2px 8px rgba(0,0,0,.04)",
  },
  sl:{fontSize:10,color:C.faint,marginBottom:5,textTransform:"uppercase",letterSpacing:.9,fontWeight:700},
  sv:{fontSize:22,fontWeight:800,color:C.accent,letterSpacing:-.3},
  btn:(bg)=>({
    padding:"8px 16px",borderRadius:9,border:"none",background:bg||C.accent,color:"#fff",
    fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
    transition:"opacity .15s,transform .12s,box-shadow .15s",marginRight:7,
    boxShadow:"0 2px 6px rgba(0,0,0,.12)",letterSpacing:.1,
  }),
  inp:{
    background:"#fff",border:"1.5px solid "+C.border,color:C.text,
    borderRadius:9,padding:"9px 12px",width:"100%",fontSize:13,
    fontFamily:"inherit",outline:"none",boxSizing:"border-box",
    transition:"border-color .2s,box-shadow .2s",
  },
  lbl:{fontSize:10,color:C.faint,textTransform:"uppercase",display:"block",marginBottom:4,letterSpacing:.7,fontWeight:700},
  row:{
    display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"10px 14px",background:C.elevated,borderRadius:9,marginBottom:5,fontSize:13,
    border:"1px solid "+C.border,transition:"background .18s,box-shadow .18s",
  },
  ui:{marginTop:"auto",padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,.09)"},
  loader:{display:"inline-block",width:13,height:13,border:"2px solid rgba(22,163,74,.18)",borderTop:"2px solid "+C.accent,borderRadius:"50%"},
  tab:(a)=>({
    flex:1,padding:"7px 10px",border:"none",borderRadius:8,
    background:a?C.accent:"transparent",color:a?"#fff":C.muted,
    fontWeight:a?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit",
    textTransform:"capitalize",transition:"all .18s",letterSpacing:.1,
  }),
};

