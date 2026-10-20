function RwandaMarket({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,capital}){
  const active=pigs.filter(p=>p.status==="active");
  const [weather,setWeather]=useState(null);
  const [weatherErr,setWeatherErr]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const [exporting,setExporting]=useState(false);

  /* ── Build smart notifications ── */
  useEffect(()=>{
    const n=[];
    const ready=active.filter(p=>p.weight>=80);
    if(ready.length>0) n.push({type:"sell",msg:`🐷 ${ready.length} pig${ready.length>1?"s":""} are market-ready (80kg+). Best time to sell!`,color:"#16a34a"});
    const lowSt=stock.filter(s=>s.quantity<=s.minLevel);
    if(lowSt.length>0) n.push({type:"stock",msg:`📦 Low stock alert: ${lowSt.map(s=>s.name).join(", ")}`,color:"#d97706"});
    const upcoming=reproductions.filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)>=0&&daysDiff(r.expectedFarrow)<=7);
    if(upcoming.length>0) n.push({type:"farrow",msg:`🐖 ${upcoming.length} sow${upcoming.length>1?"s":""} due to farrow within 7 days!`,color:"#7c3aed"});
    const sick=logs.filter(l=>l.date===toDay()&&l.sick>0);
    if(sick.length>0) n.push({type:"health",msg:`🏥 ${sick.reduce((s,l)=>s+(l.sick||0),0)} sick pig(s) reported today — check health logs`,color:"#dc2626"});
    if(n.length===0) n.push({type:"ok",msg:"✅ All good! No urgent alerts today.",color:"#16a34a"});
    setNotifs(n);
  },[pigs,stock,reproductions,logs]);

  /* ── Fetch Rwanda weather (Kigali) ── */
  useEffect(()=>{
    fetch("https://wttr.in/Kigali,Rwanda?format=j1")
      .then(r=>r.json())
      .then(d=>{
        const c=d.current_condition[0];
        setWeather({
          temp:c.temp_C,
          feels:c.FeelsLikeC,
          desc:c.weatherDesc[0].value,
          humidity:c.humidity,
          wind:c.windspeedKmph,
          icon:parseInt(c.weatherCode)>=200&&parseInt(c.weatherCode)<300?"⛈️":
               parseInt(c.weatherCode)>=300&&parseInt(c.weatherCode)<600?"🌧️":
               parseInt(c.weatherCode)>=600&&parseInt(c.weatherCode)<700?"❄️":
               parseInt(c.weatherCode)>=700&&parseInt(c.weatherCode)<800?"🌫️":
               parseInt(c.weatherCode)===800?"☀️":"⛅"
        });
      })
      .catch(()=>setWeatherErr(true));
  },[]);

  /* ── Excel Export ── */
  function exportExcel(){
    setExporting(true);
    try{
      const rows=[["FarmIQ — Rwanda Market & Financial Report","","","",""],
        ["Generated:",toDay(),"","",""],["","","","",""],
        ["=== MARKET PRICES (TODAY) ===","","","",""],
        ["Category","Stage/Type","Base Price (RWF)","Trend","Notes"],
        ...Object.entries(RW_BASE_PRICES).map(([k,v])=>[
          k==="heavy"?"Heavy Pig":k,k==="heavy"?"80kg+":v.desc,v.base,
          v.trend==="up"?"📈 Rising":v.trend==="down"?"📉 Falling":"➡️ Stable",
          v.unit
        ]),
        ["","","","",""],
        ["=== YOUR HERD VALUATION ===","","","",""],
        ["Tag","Stage","Weight (kg)","Market Value (RWF)","Status"],
        ...active.map(p=>[p.tag,p.stage,p.weight,getMarketPrice(p.stage,p.weight),"Active"]),
        ["","Total Herd Value","",active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0),""],
        ["","","","",""],
        ["=== FINANCIAL SUMMARY ===","","","",""],
        ["Item","Amount (RWF)","","",""],
        ["Total Income",sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0),"","",""],
        ["Total Expenses",feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0),"","",""],
        ["Net Profit",(sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0))-(feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0)),"","",""],
        ["Herd Market Value",active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0),"","",""],
        ["","","","",""],
        ["=== RWANDA MARKETS ===","","","",""],
        ...MARKETS.map(m=>[m,"","","",""]),
      ];
      let csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
      const BOM="\uFEFF";
      const blob=new Blob([BOM+csv],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`FarmIQ_Market_Report_${toDay()}.csv`;
      document.body.appendChild(a);a.click();
      document.body.removeChild(a);URL.revokeObjectURL(url);
    }catch(e){alert("Export error: "+e.message);}
    setExporting(false);
  }

  const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);
  const herdVal=active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0);
  const ready80=active.filter(p=>p.weight>=80);

  return(<div className="fade-in" style={{maxWidth:900,margin:"0 auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:20}}>
      <div>
        <div style={{fontSize:20,fontWeight:700,color:C.text}}>📈 Rwanda Pig Market</div>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>Live prices · Weather · Alerts · Export</div>
        {(()=>{try{const sv=JSON.parse(localStorage.getItem("farmiq_market_surveys")||"[]");if(sv.length>0){const l=sv.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];return(<div style={{fontSize:11,color:C.accent,marginTop:3}}>✅ Using field survey prices from {l.date} · {l.market}</div>);}return(<div style={{fontSize:11,color:C.amber,marginTop:3}}>⚠️ Using estimated prices — add a Market Survey for accuracy</div>);}catch(e){return null;}})()}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={exportExcel} disabled={exporting} style={{
          padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",
          background:"linear-gradient(135deg,#16a34a,#15803d)",
          color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit",
          boxShadow:"0 2px 8px rgba(22,163,74,.3)",display:"flex",alignItems:"center",gap:7
        }}>
          {exporting?"⏳ Exporting...":"📥 Export to Excel"}
        </button>
      </div>
    </div>

    {/* ── Notifications ── */}
    <div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>🔔 Today's Farm Alerts</div>
      {notifs.map((n,i)=>(
        <div key={i} style={{
          padding:"10px 14px",borderRadius:9,marginBottom:7,fontSize:13,fontWeight:500,
          background:n.color+"18",border:"1.5px solid "+n.color+"44",color:n.color
        }}>{n.msg}</div>
      ))}
    </div>

    {/* ── Weather ── */}
    <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:18,border:"1px solid "+C.border}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>🌤️ Kigali Weather (Live)</div>
      {weather?(
        <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
          <div style={{fontSize:36}}>{weather.icon}</div>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text}}>{weather.temp}°C</div>
            <div style={{fontSize:12,color:C.muted}}>{weather.desc} · Feels like {weather.feels}°C</div>
          </div>
          {[["💧 Humidity",weather.humidity+"%"],["🌬️ Wind",weather.wind+" km/h"]].map(([l,v])=>(
            <div key={l} style={{background:C.elevated,borderRadius:8,padding:"8px 14px",textAlign:"center"}}>
              <div style={{fontSize:11,color:C.muted}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginTop:2}}>{v}</div>
            </div>
          ))}
          <div style={{fontSize:11,color:C.faint,marginLeft:"auto"}}>
            ⚠️ Hot &gt;30°C = stress risk<br/>🌧️ Heavy rain = disease risk
          </div>
        </div>
      ):weatherErr?(
        <div style={{color:C.muted,fontSize:13}}>⚠️ Weather unavailable — check internet connection</div>
      ):(
        <div style={{color:C.muted,fontSize:13}}>⏳ Loading weather...</div>
      )}
    </div>

    {/* ── Market Prices ── */}
    <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:18,border:"1px solid "+C.border}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>💰 Today's Rwanda Market Prices</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
        {Object.entries(RW_BASE_PRICES).map(([k,v])=>{
          const price=Math.round(v.base*getDailyVariance());
          return(
            <div key={k} style={{background:C.elevated,borderRadius:10,padding:"10px 12px",border:"1px solid "+C.border}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{v.desc}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.accent}}>{fmtRWF(price)}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>per {v.unit}</div>
              <div style={{fontSize:10,marginTop:4,color:v.trend==="up"?"#16a34a":v.trend==="down"?"#dc2626":C.muted}}>
                {v.trend==="up"?"📈 Rising":v.trend==="down"?"📉 Falling":"➡️ Stable"}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* ── Your Herd Valuation ── */}
    <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:18,border:"1px solid "+C.border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>🐷 Your Herd Valuation</div>
        <div style={{fontSize:13,fontWeight:700,color:C.accent}}>Total: {fmtRWF(herdVal)}</div>
      </div>
      {ready80.length>0&&(
        <div style={{background:"#16a34a18",border:"1px solid #16a34a44",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#16a34a",fontWeight:600}}>
          🏷️ {ready80.length} pig{ready80.length>1?"s":""} ready to sell now (80kg+) — potential: {fmtRWF(ready80.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0))}
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:"1px solid "+C.border}}>
              {["Tag","Stage","Weight","Market Value","Ready?"].map(h=>(
                <th key={h} style={{padding:"6px 10px",textAlign:"left",color:C.muted,fontWeight:600}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.sort((a,b)=>getMarketPrice(b.stage,b.weight)-getMarketPrice(a.stage,a.weight)).map(p=>(
              <tr key={p.id} style={{borderBottom:"1px solid "+C.border+"66"}}>
                <td style={{padding:"7px 10px",fontWeight:700,color:C.text}}>{p.tag}</td>
                <td style={{padding:"7px 10px",color:C.muted}}>{p.stage}</td>
                <td style={{padding:"7px 10px",color:C.muted}}>{p.weight}kg</td>
                <td style={{padding:"7px 10px",fontWeight:700,color:C.accent}}>{fmtRWF(getMarketPrice(p.stage,p.weight))}</td>
                <td style={{padding:"7px 10px"}}>
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:p.weight>=80?"#16a34a22":"#f59e0b22",color:p.weight>=80?"#16a34a":"#d97706",fontWeight:600}}>
                    {p.weight>=80?"✅ Sell Now":"⏳ Growing"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* ── Rwanda Markets ── */}
    <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:18,border:"1px solid "+C.border}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📍 Rwanda Livestock Markets</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {MARKETS.map(m=>(
          <div key={m} style={{background:C.elevated,borderRadius:8,padding:"8px 14px",fontSize:12,color:C.text,border:"1px solid "+C.border}}>
            📍 {m}
          </div>
        ))}
      </div>
    </div>

    {/* ── AI Market Advice ── */}
    <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
      topic={`Rwanda pig market advisor. Herd value=${fmtRWF(herdVal)}, ready to sell=${ready80.length} pigs, profit=${fmtRWF(calcPnL(capital||{transactions:[]},feeds,sales,expenses,incomes).profit)}. Give: 1) best time to sell now, 2) which pigs to sell first, 3) price negotiation tips for Rwanda markets, 4) seasonal price trends, 5) how to get best price at ${MARKETS[0]}.`}
      label="🤖 AI Market Strategy" icon="📈"/>
  </div>);
}

/* ─── Admin Home ─── */
function AHome({pigs,feeds,sales,logs,users,expenses,incomes,reproductions,stock,allData,setPage,capital,setCapital}){
  const active=pigs.filter(p=>p.status==="active");
  const {totalInc,totalExp,profit}=calcPnL(capital||{transactions:[]},feeds,sales,expenses,incomes);
  const herdValue=active.reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);
  const pregnant=reproductions.filter(r=>r.status==="pregnant");
  const lowStock=stock.filter(s=>s.quantity<=s.minLevel);
  const upcomingFarrows=pregnant.filter(r=>daysDiff(r.expectedFarrow)<=7&&daysDiff(r.expectedFarrow)>=0);
  const recentActivity=[...feeds.map(f=>({...f,type:"feed"})),...sales.map(s=>({...s,type:"sale"})),...logs.map(l=>({...l,type:"log"}))].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,6);
  const capitalBalance=calcCapitalBalance(capital,feeds,sales,expenses,incomes);
  const [showCapitalSet,setShowCapitalSet]=useState(false);
  const [newInitial,setNewInitial]=useState("");
  const [fixDone,setFixDone]=useState(false);
  const [fixing,setFixing]=useState(false);

  // Monthly profit data for chart (last 6 months)
  const monthlyMap={};
  [...sales.map(s=>({date:s.date,inc:s.total||0,exp:0})),...incomes.map(i=>({date:i.date,inc:i.amount||0,exp:0})),...feeds.map(f=>({date:f.date,inc:0,exp:f.cost||0})),...expenses.map(e=>({date:e.date,inc:0,exp:e.amount||0}))].forEach(item=>{
    const m=(item.date||"").slice(0,7);if(!m)return;
    if(!monthlyMap[m])monthlyMap[m]={inc:0,exp:0};
    monthlyMap[m].inc+=item.inc;monthlyMap[m].exp+=item.exp;
  });
  const months6=Object.entries(monthlyMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const maxMonthVal=Math.max(...months6.map(([,v])=>Math.max(v.inc,v.exp,1)),1);

  // Expense breakdown for donut
  const expByCat={};
  feeds.forEach(f=>{expByCat["Feed"]=(expByCat["Feed"]||0)+(f.cost||0);});
  expenses.forEach(e=>{const k=e.category||"Other";expByCat[k]=(expByCat[k]||0)+(e.amount||0);});
  const topCats=Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const donutColors=["#16a34a","#f59e0b","#6366f1","#ec4899","#64748b"];

  // Herd stage breakdown
  const stageMap={};active.forEach(p=>{stageMap[p.stage]=(stageMap[p.stage]||0)+1;});
  const stageData=Object.entries(stageMap).sort((a,b)=>b[1]-a[1]);
  const maxStage=Math.max(...stageData.map(([,v])=>v),1);

  async function fixCapital(){
    setFixing(true);
    try{
      setCapital(prev=>({...prev, transactions:[]}));
      const freshAll=await getOnlineFarmData()||{};
      const cleanedCapital={...(freshAll.capital||{initial:0}), transactions:[], _wiped:true};
      await FS_FARM_DOC.set({...freshAll, capital:cleanedCapital, updatedAt:new Date().toISOString()});
      _latestFarmData={...(_latestFarmData||{}), capital:cleanedCapital};
      setFixDone(true);
      setTimeout(()=>setFixDone(false),5000);
    }catch(e){alert("Fix failed: "+e.message);}
    setFixing(false);
  }

  const MON_LBL=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return(<div className="fade-in">
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
      <div style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,rgba(22,163,74,.15),rgba(22,163,74,.07))",border:"1px solid rgba(22,163,74,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 2px 12px rgba(22,163,74,.1)"}}>📊</div>
      <div>
        <div style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:-.4}}>Farm Overview</div>
        <div style={{fontSize:12,color:C.faint}}>{toDay()} · FarmIQ AI Management</div>
      </div>
    </div>

    {/* Capital Banner */}
    <div style={{background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",borderRadius:14,padding:"18px 22px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,boxShadow:"0 8px 28px rgba(0,0,0,.2)",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-30,right:-20,width:140,height:140,background:"radial-gradient(circle,rgba(74,222,128,.12) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div>
        <div style={{fontSize:10,color:"rgba(74,222,128,.7)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>💵 Business Capital Balance</div>
        <div style={{fontSize:30,fontWeight:800,color:capitalBalance>=0?"#4ade80":"#f87171",letterSpacing:-.5}}>{fmtRWF(capitalBalance)}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:3}}>Initial: {fmtRWF(capital.initial||0)} · Income: {fmtRWF(totalInc)} · Expenses: {fmtRWF(totalExp)}</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>{setShowCapitalSet(!showCapitalSet);setNewInitial(String(capital.initial||""));}} style={{padding:"8px 14px",borderRadius:9,border:"1px solid rgba(74,222,128,.35)",background:"rgba(74,222,128,.1)",color:"#4ade80",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>⚙️ Set Capital</button>
        <button onClick={()=>setPage("capital")} style={{padding:"8px 14px",borderRadius:9,border:"1px solid rgba(74,222,128,.35)",background:"rgba(74,222,128,.1)",color:"#4ade80",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>📋 View All</button>
        <button onClick={fixCapital} disabled={fixing} style={{padding:"8px 14px",borderRadius:9,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.15)",color:"#f87171",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
          {fixing?"⏳ Fixing...":"🔧 Fix Balance"}
        </button>
      </div>
    </div>

    {capitalBalance !== (capital.initial + totalInc - totalExp) ? (
      <div style={{padding:"14px 16px",background:"rgba(239,68,68,.1)",border:"2px solid rgba(239,68,68,.4)",borderRadius:12,marginBottom:12,animation:"pulse 2s ease-in-out infinite"}}>
        <div style={{fontWeight:700,color:"#f87171",fontSize:14,marginBottom:6}}>⚠️ Capital Balance Mismatch Detected</div>
        <div style={{fontSize:12,color:"#fca5a5",marginBottom:10}}>Expected: <strong>{fmtRWF(capital.initial+totalInc-totalExp)}</strong> &nbsp;|&nbsp; Showing: <strong>{fmtRWF(capitalBalance)}</strong></div>
        <button onClick={fixCapital} disabled={fixing} style={{padding:"10px 20px",borderRadius:9,border:"none",background:"#dc2626",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
          {fixing?"⏳ Fixing & Syncing to Server...":"🔧 FIX CAPITAL BALANCE NOW →"}
        </button>
      </div>
    ):null}
    {fixDone&&<div style={{padding:"12px 16px",background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.4)",borderRadius:10,marginBottom:12,fontSize:13,color:"#4ade80",fontWeight:700}}>✅ Capital fixed! Balance now: {fmtRWF(capital.initial+totalInc-totalExp)}</div>}
    {showCapitalSet&&<div style={{...S.card,marginBottom:12,border:"1px solid rgba(74,222,128,.3)"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>Set Initial Capital</div>
      <div style={{display:"flex",gap:9}}>
        <input type="number" value={newInitial} onChange={e=>setNewInitial(e.target.value)} placeholder="e.g. 500000" style={{...S.inp,flex:1}}/>
        <button onClick={()=>{setCapital(prev=>({...prev,initial:parseFloat(newInitial)||0}));setShowCapitalSet(false);}} style={{...S.btn(C.accent),padding:"9px 16px",whiteSpace:"nowrap"}}>Save</button>
      </div>
      <div style={{fontSize:11,color:C.faint,marginTop:6}}>This sets your starting business capital before any transactions.</div>
    </div>}

    {/* Smart alerts */}
    {upcomingFarrows.length>0&&<div onClick={()=>setPage("reproduction")} style={{padding:"10px 14px",background:"rgba(244,114,182,.08)",border:"1px solid rgba(244,114,182,.3)",borderRadius:9,marginBottom:10,fontSize:13,color:C.pink,cursor:"pointer"}}>
      🐖 {upcomingFarrows.length} farrowing(s) in ≤7 days → Click to view
    </div>}
    {lowStock.length>0&&<div onClick={()=>setPage("stock")} style={{padding:"10px 14px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.25)",borderRadius:9,marginBottom:10,fontSize:13,color:C.red,cursor:"pointer"}}>
      📦 {lowStock.length} low stock alert(s): {lowStock.map(s=>s.name).join(", ")} → Click to restock
    </div>}

    {/* ── KPI CARDS — beautiful gradient tiles ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:16}}>
      {[
        {icon:"🐷",label:"Active Pigs",value:active.length,sub:active.filter(p=>p.weight>=80).length+" ready to sell",color:C.accent,bg:"rgba(22,163,74,.07)",border:"rgba(22,163,74,.18)"},
        {icon:"💚",label:"Total Income",value:fmtRWF(totalInc),sub:sales.length+" pig sales",color:"#10b981",bg:"rgba(16,185,129,.06)",border:"rgba(16,185,129,.18)"},
        {icon:profit>=0?"✅":"⚠️",label:"Net Profit",value:fmtRWF(profit),sub:totalInc>0?((profit/totalInc)*100).toFixed(0)+"% margin":"—",color:profit>=0?C.accent:C.red,bg:profit>=0?"rgba(22,163,74,.06)":"rgba(239,68,68,.06)",border:profit>=0?"rgba(22,163,74,.18)":"rgba(239,68,68,.18)"},
        {icon:"💎",label:"Herd Value",value:fmtRWF(herdValue),sub:"at market prices",color:C.purple,bg:"rgba(124,58,237,.06)",border:"rgba(124,58,237,.18)"},
        {icon:"🤰",label:"Pregnant Sows",value:pregnant.length,sub:upcomingFarrows.length+" due this week",color:C.pink,bg:"rgba(236,72,153,.05)",border:"rgba(236,72,153,.18)"},
        {icon:"👷",label:"Workers",value:users.filter(u=>u.role==="worker"&&u.approved).length,sub:"approved accounts",color:C.blue,bg:"rgba(37,99,235,.05)",border:"rgba(37,99,235,.15)"},
        {icon:"🌾",label:"Total Expenses",value:fmtRWF(totalExp),sub:"feed + operations",color:C.amber,bg:"rgba(245,158,11,.05)",border:"rgba(245,158,11,.18)"},
        {icon:"📋",label:"Logs Today",value:logs.filter(l=>l.date===toDay()).length,sub:"daily reports",color:C.muted,bg:"rgba(0,0,0,.03)",border:C.border},
      ].map(k=>(
        <div key={k.label} className="card-hover" style={{background:k.bg,border:"1px solid "+k.border,borderRadius:12,padding:"14px 14px 12px",cursor:"default",boxShadow:"0 1px 6px rgba(0,0,0,.04)"}}>
          <div style={{fontSize:20,marginBottom:7}}>{k.icon}</div>
          <div style={{fontSize:10,color:C.faint,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>{k.label}</div>
          <div style={{fontSize:typeof k.value==="string"&&k.value.length>9?14:20,fontWeight:800,color:k.color,lineHeight:1.1,marginBottom:4}}>{k.value}</div>
          <div style={{fontSize:10,color:C.faint}}>{k.sub}</div>
        </div>
      ))}
    </div>

    {/* ── SVG BAR CHART — Monthly Income vs Expenses ── */}
    {months6.length>0&&<div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        📈 Monthly Income vs Expenses
        <span style={{fontSize:10,color:C.faint,fontWeight:400}}>last {months6.length} months</span>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"flex-end",height:110,paddingBottom:20,position:"relative"}}>
        {/* Gridlines */}
        {[0,25,50,75,100].map(pct=>(
          <div key={pct} style={{position:"absolute",left:0,right:0,bottom:20+pct*0.9,height:1,background:"rgba(0,0,0,.05)",zIndex:0}}/>
        ))}
        {months6.map(([m,v],idx)=>{
          const incH=maxMonthVal>0?Math.round((v.inc/maxMonthVal)*90):0;
          const expH=maxMonthVal>0?Math.round((v.exp/maxMonthVal)*90):0;
          const p=v.inc-v.exp;
          const lbl=MON_LBL[parseInt(m.split("-")[1])-1];
          return(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative",zIndex:1}}>
            {/* Bars */}
            <div style={{display:"flex",gap:2,alignItems:"flex-end",height:90}}>
              <div style={{width:"42%",height:Math.max(incH,2),background:"linear-gradient(180deg,#4ade80,#16a34a)",borderRadius:"3px 3px 0 0",transition:"height .5s cubic-bezier(.22,1,.36,1)",position:"relative"}} title={`Income: ${fmtRWF(v.inc)}`}/>
              <div style={{width:"42%",height:Math.max(expH,2),background:"linear-gradient(180deg,#f87171,#dc2626)",borderRadius:"3px 3px 0 0",transition:"height .5s cubic-bezier(.22,1,.36,1)"}} title={`Expenses: ${fmtRWF(v.exp)}`}/>
            </div>
            {/* Month label */}
            <div style={{fontSize:9,color:C.faint,fontWeight:600,position:"absolute",bottom:2}}>{lbl}</div>
          </div>);
        })}
      </div>
      {/* Legend */}
      <div style={{display:"flex",gap:16,marginTop:4,fontSize:11,color:C.faint}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:"#16a34a",display:"inline-block"}}/> Income</span>
        <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:2,background:"#dc2626",display:"inline-block"}}/> Expenses</span>
        <span style={{marginLeft:"auto",fontWeight:700,color:profit>=0?C.accent:C.red}}>{profit>=0?"✅":"⚠️"} Net: {fmtRWF(profit)}</span>
      </div>
    </div>}

    {/* ── 2-COL SECTION: Expense Donut + Herd Breakdown ── */}
    <div style={S.g2}>
      {/* Expense donut-style breakdown */}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:14}}>🔴 Expense Breakdown</div>
        {topCats.length===0&&<div style={{color:C.faint,fontSize:12,textAlign:"center",padding:20}}>No expenses yet.</div>}
        {topCats.map(([cat,amt],i)=>{
          const pct=totalExp>0?Math.round((amt/totalExp)*100):0;
          return(<div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{color:C.muted,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:8,height:8,borderRadius:2,background:donutColors[i]||C.muted,display:"inline-block",flexShrink:0}}/>
                {cat}
              </span>
              <span style={{color:donutColors[i]||C.muted,fontWeight:700}}>{pct}%</span>
            </div>
            <div style={{height:6,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:donutColors[i]||C.accent,borderRadius:4,transition:"width .6s cubic-bezier(.22,1,.36,1)"}}/>
            </div>
            <div style={{fontSize:10,color:C.faint,marginTop:2,textAlign:"right"}}>{fmtRWF(amt)}</div>
          </div>);
        })}
      </div>

      {/* Herd stage breakdown */}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:14}}>🐷 Herd by Stage</div>
        {stageData.length===0&&<div style={{color:C.faint,fontSize:12,textAlign:"center",padding:20}}>No active pigs.</div>}
        {stageData.map(([stage,count],i)=>{
          const stageIcons={Piglet:"🐣",Weaner:"🐷",Grower:"🐖",Finisher:"🥩",Gilt:"♀️",Sow:"🐗",Boar:"♂️"};
          const stageColors={Piglet:"#f59e0b",Weaner:"#10b981",Grower:"#16a34a",Finisher:"#2563eb",Gilt:"#ec4899",Sow:"#8b5cf6",Boar:"#6366f1"};
          const pct=active.length>0?Math.round((count/active.length)*100):0;
          return(<div key={stage} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{color:C.muted,fontWeight:600}}>{stageIcons[stage]||"🐷"} {stage}</span>
              <span style={{color:stageColors[stage]||C.accent,fontWeight:700}}>{count} pig{count!==1?"s":""}</span>
            </div>
            <div style={{height:6,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:stageColors[stage]||C.accent,borderRadius:4,transition:"width .55s cubic-bezier(.22,1,.36,1)"}}/>
            </div>
          </div>);
        })}
        <div style={{marginTop:10,padding:"8px 10px",background:"rgba(22,163,74,.05)",borderRadius:8,fontSize:11,color:C.muted,textAlign:"center",fontWeight:600}}>
          {active.length} active · {active.filter(p=>p.weight>=80).length} market-ready (80kg+)
        </div>
      </div>
    </div>

    {/* Recent Activity + Portfolio */}
    <div style={S.g2}>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>📋 Recent Activity</div>
        {recentActivity.length===0&&<div style={{color:C.faint,fontSize:13}}>No activity yet.</div>}
        {recentActivity.map((l,i)=>(
          <div key={i} style={{...S.row,marginBottom:6}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.text}}>{l.type==="feed"?"🌾":l.type==="sale"?"🏷️":"📝"} {l.worker||l.buyer||"—"}</div>
              <div style={{fontSize:10,color:C.faint}}>{l.date}</div>
            </div>
            <span style={{color:l.type==="sale"?"#10b981":l.type==="feed"?C.amber:C.muted,fontWeight:700,fontSize:12}}>{l.total?fmtRWF(l.total):l.cost?fmtRWF(l.cost):"✓"}</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:10}}>💹 Portfolio Snapshot</div>
        {[
          ["Realized Profit",fmtRWF(profit),profit>=0?C.accent:C.red],
          ["Herd Market Value",fmtRWF(herdValue),C.purple],
          ["Total Portfolio",fmtRWF(profit+herdValue),profit+herdValue>=0?C.accent:C.red],
          ["ROI",totalExp>0?((profit/totalExp)*100).toFixed(1)+"%":"—",C.amber],
          ["Expense Ratio",totalInc>0?((totalExp/totalInc)*100).toFixed(0)+"%":"—",totalExp>totalInc?C.red:C.accent],
        ].map(([l,v,c])=>(
          <div key={l} style={{...S.row,marginBottom:5}}>
            <span style={{color:C.muted,fontSize:11}}>{l}</span>
            <span style={{fontWeight:700,color:c,fontSize:12}}>{v}</span>
          </div>
        ))}
        {/* Profit gauge bar */}
        {totalInc>0&&<div style={{marginTop:8}}>
          <div style={{height:8,background:C.elevated,borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.min(Math.max((profit/totalInc)*100+50,0),100)+"%",background:profit>=0?"linear-gradient(90deg,#22c55e,#16a34a)":"linear-gradient(90deg,#f87171,#dc2626)",borderRadius:5,transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:10,color:C.faint,marginTop:3,textAlign:"center"}}>Profit margin: {totalInc>0?((profit/totalInc)*100).toFixed(1):0}%</div>
        </div>}
      </div>
    </div>

    {/* AI Predictions */}
    <div style={{fontSize:14,fontWeight:700,color:C.accent,margin:"6px 0 12px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{width:24,height:24,borderRadius:7,background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>✦</span>
      AI Predictions & Insights
    </div>
    <div style={S.g2}>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic="Predict 30-day profitability based on all income and expenses. Include reproduction forecast and market timing. Give specific improvement actions." label="30-Day Profit Forecast" icon="📈"/>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic="Analyze herd health, predict disease risks, give prevention tips for Rwanda climate. Include biosecurity for ASF." label="Herd Health Risk" icon="🏥"/>
    </div>
  </div>);
}

/* ─── Financials ─── */
function Fin({feeds,sales,pigs,logs,expenses,incomes,allData,capital}){
  // Use calcPnL for consistent totals across all screens
  const {totalInc:totalIncome,totalExp:totalExpense,profit}=calcPnL(capital||{transactions:[]},feeds,sales,expenses,incomes);
  const totalSaleInc=sales.reduce((s,l)=>s+(l.total||0),0);
  const totalOtherInc=incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalFeedCost=feeds.reduce((s,l)=>s+(l.cost||0),0);
  const totalOtherExp=expenses.reduce((s,l)=>s+(l.amount||0),0);
  const roi=totalExpense>0?((profit/totalExpense)*100).toFixed(1):"—";
  const netMargin=totalIncome>0?((profit/totalIncome)*100).toFixed(1):"—";
  const grossMargin=totalIncome>0?(((totalIncome-totalFeedCost)/totalIncome)*100).toFixed(1):"—";
  const feedRatio=totalExpense>0?((totalFeedCost/totalExpense)*100).toFixed(1):"—";

  // Monthly data
  const months={};
  [...sales.map(s=>({date:s.date,rev:s.total,cost:0})),...incomes.map(i=>({date:i.date,rev:i.amount,cost:0})),...feeds.map(f=>({date:f.date,rev:0,cost:f.cost})),...expenses.map(e=>({date:e.date,rev:0,cost:e.amount}))].forEach(l=>{const m=l.date&&l.date.slice(0,7);if(!m)return;if(!months[m])months[m]={rev:0,cost:0};months[m].rev+=l.rev;months[m].cost+=l.cost;});
  const sortedMonths=Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0]));
  const maxMonthVal=Math.max(...sortedMonths.map(([,v])=>Math.max(v.rev,v.cost)),1);

  // Expense by category
  const expByCat={};
  feeds.forEach(f=>{expByCat["Feed Purchase"]=(expByCat["Feed Purchase"]||0)+(f.cost||0);});
  expenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+(e.amount||0);});
  const sortedExpCats=Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // Active herd value
  const active=pigs.filter(p=>p.status==="active");
  const herdValue=active.reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={S.h1}>💰 Financial Dashboard</div>
      <PDFBtn label="Finance PDF" type="finance" getData={()=>allData} icon="💰" color="#374151"/>
    </div>

    {/* Key financial KPIs */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:14}}>
      {[
        {l:"Total Income",v:fmtRWF(totalIncome),c:"#10b981"},
        {l:"Total Expenses",v:fmtRWF(totalExpense),c:C.red},
        {l:"Net Profit",v:fmtRWF(profit),c:profit>=0?C.accent:C.red},
        {l:"ROI",v:roi==="—"?"—":roi+"%",c:C.purple},
        {l:"Net Margin",v:netMargin==="—"?"—":netMargin+"%",c:parseFloat(netMargin)>=20?C.accent:parseFloat(netMargin)>=0?C.amber:C.red},
        {l:"Gross Margin",v:grossMargin==="—"?"—":grossMargin+"%",c:C.blue},
        {l:"Feed % of Exp",v:feedRatio==="—"?"—":feedRatio+"%",c:C.amber},
        {l:"Herd Value",v:fmtRWF(herdValue),c:C.purple},
      ].map(s=>(
        <div key={s.l} style={{...S.stat,padding:"11px 13px"}}>
          <div style={S.sl}>{s.l}</div>
          <div style={{...S.sv,color:s.c,fontSize:s.v.length>9?13:18}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* Profitability status bar */}
    <div style={{...S.card,padding:"13px 16px",marginBottom:14,background:profit>=0?"rgba(22,163,74,.04)":"rgba(239,68,68,.04)",border:"1px solid "+(profit>=0?"rgba(22,163,74,.2)":"rgba(239,68,68,.2)")}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:700,color:profit>=0?C.accent:C.red}}>{profit>=0?"✅ Farm is Profitable":"⚠️ Running at a Loss"}</span>
        <span style={{fontSize:12,color:C.faint}}>Expense ratio: {totalIncome>0?((totalExpense/totalIncome)*100).toFixed(1):0}%</span>
      </div>
      <div style={{height:12,background:C.elevated,borderRadius:8,overflow:"hidden",marginBottom:5}}>
        <div style={{height:"100%",width:(totalIncome>0?Math.min((totalExpense/totalIncome)*100,100):0)+"%",background:totalExpense>totalIncome?"linear-gradient(90deg,#ef4444,#dc2626)":"linear-gradient(90deg,#f59e0b,#16a34a)",borderRadius:8,transition:"width .5s"}}/>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:C.faint}}>
        <span>📥 Income: <b style={{color:"#10b981"}}>{fmtRWF(totalIncome)}</b></span>
        <span>📤 Expenses: <b style={{color:C.red}}>{fmtRWF(totalExpense)}</b></span>
        <span>💹 Net: <b style={{color:profit>=0?C.accent:C.red}}>{fmtRWF(profit)}</b></span>
        <span>📦 Herd: <b style={{color:C.purple}}>{fmtRWF(herdValue)}</b></span>
      </div>
    </div>

    {/* Income + Expense side-by-side breakdown */}
    <div style={S.g2}>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12}}>💚 Income Breakdown</div>
        {[["🏷️ Pig Sales",totalSaleInc,totalIncome],["💰 Other Income",totalOtherInc,totalIncome]].map(([l,amt,tot])=>{
          const pct=tot>0?((amt/tot)*100).toFixed(0):0;
          return(<div key={l} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.muted}}>{l}</span>
              <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(amt)}</span>
            </div>
            <div style={{height:6,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:"#10b981",borderRadius:3}}/>
            </div>
          </div>);
        })}
        <div style={{marginTop:8,...S.row,background:"rgba(16,185,129,.07)",borderRadius:7}}>
          <span style={{fontWeight:700,fontSize:12}}>TOTAL</span>
          <span style={{color:"#10b981",fontWeight:800}}>{fmtRWF(totalIncome)}</span>
        </div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:12}}>🔴 Expense Breakdown</div>
        {sortedExpCats.map(([cat,amt])=>{
          const pct=totalExpense>0?((amt/totalExpense)*100).toFixed(0):0;
          return(<div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.muted}}>{cat}</span>
              <span style={{color:C.red,fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400,fontSize:10}}>({pct}%)</span></span>
            </div>
            <div style={{height:6,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:cat==="Feed Purchase"?"#f59e0b":C.red,borderRadius:3}}/>
            </div>
          </div>);
        })}
        <div style={{marginTop:8,...S.row,background:"rgba(239,68,68,.07)",borderRadius:7}}>
          <span style={{fontWeight:700,fontSize:12}}>TOTAL</span>
          <span style={{color:C.red,fontWeight:800}}>{fmtRWF(totalExpense)}</span>
        </div>
      </div>
    </div>

    {/* Monthly summary with inline bars */}
    <div style={{...S.card,marginTop:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:14}}>📅 Monthly Income vs Expenses</div>
      {sortedMonths.length===0?<div style={{color:C.faint,fontSize:13}}>No data yet.</div>:
        sortedMonths.slice(0,8).map(([m,v])=>{
          const p=v.rev-v.cost;
          const label=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.split("-")[1])-1]+" "+m.split("-")[0].slice(2);
          return(<div key={m} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{fontWeight:600,color:C.text,fontSize:12}}>{label}</span>
              <span style={{fontWeight:700,color:p>=0?C.accent:C.red}}>{p>=0?"+":""}{fmtRWF(p)}</span>
            </div>
            <div style={{marginBottom:3}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.faint,marginBottom:2}}>
                <span style={{color:"#10b981"}}>Income</span><span style={{color:"#10b981"}}>{fmtRWF(v.rev)}</span>
              </div>
              <div style={{height:7,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(v.rev/maxMonthVal*100)+"%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:3,transition:"width .4s"}}/>
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.faint,marginBottom:2}}>
                <span style={{color:C.red}}>Expenses</span><span style={{color:C.red}}>{fmtRWF(v.cost)}</span>
              </div>
              <div style={{height:7,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:(v.cost/maxMonthVal*100)+"%",background:"linear-gradient(90deg,#ef4444,#dc2626)",borderRadius:3,transition:"width .4s"}}/>
              </div>
            </div>
          </div>);
        })
      }
    </div>

    <div style={{fontSize:14,fontWeight:700,color:C.accent,margin:"16px 0 12px"}}>✦ AI Financial Analysis</div>
    <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic={`Full financial analysis Rwanda farm: income=${fmtRWF(totalIncome)}, expenses=${fmtRWF(totalExpense)}, net margin=${netMargin}%, ROI=${roi}%, feed is ${feedRatio}% of expenses, herd value=${fmtRWF(herdValue)}. Revenue optimization, expense reduction, break-even, scaling investment for Rwanda.`} label="Financial Strategy" icon="💰"/>
  </div>);
}

/* ─── Pigs ─── */
/* ─── GROWTH MEASUREMENT MODAL ─── */
function GrowthModal({pig,onSave,onClose}){
  const [weight,setWeight]=useState(String(pig.weight||""));
  const [length,setLength]=useState(String(pig.length||""));
  const today=toDay();
  function save(){
    const w=parseFloat(weight);
    const l=parseFloat(length)||null;
    if(!w||w<=0)return;
    const newMeasure={date:today,weight:w,length:l};
    const history=[...(pig.measurements||[]),newMeasure];
    onSave({weight:w,length:l||pig.length,measurements:history});
  }
  const lastM=pig.measurements&&pig.measurements.length>0?pig.measurements[pig.measurements.length-1]:null;
  const wGain=lastM&&parseFloat(weight)>0?Math.round((parseFloat(weight)-lastM.weight)*10)/10:null;
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:16,padding:24,width:340,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>📏 Record Growth — {pig.tag}</div>
      <div style={{fontSize:11,color:C.faint,marginBottom:16}}>{pig.breed} · {pig.stage} · Today: {today}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <label style={S.lbl}>Weight (kg) *</label>
          <input type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} style={S.inp} autoFocus/>
          {wGain!==null&&<div style={{fontSize:10,marginTop:3,color:wGain>0?C.accent:C.red,fontWeight:600}}>{wGain>0?"+":""}{wGain}kg since last record</div>}
        </div>
        <div>
          <label style={S.lbl}>Body Length (cm)</label>
          <input type="number" step="0.5" value={length} onChange={e=>setLength(e.target.value)} placeholder="e.g. 85" style={S.inp}/>
          <div style={{fontSize:9,color:C.faint,marginTop:2}}>Tip-to-tail length</div>
        </div>
      </div>
      {pig.measurements&&pig.measurements.length>0&&<div style={{background:C.elevated,borderRadius:8,padding:"9px 12px",marginBottom:14,fontSize:11}}>
        <div style={{fontWeight:600,color:C.text,marginBottom:6}}>📈 Growth History (last 3)</div>
        {pig.measurements.slice(-3).reverse().map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",color:C.muted,padding:"2px 0",borderBottom:i<2?"1px solid "+C.border:"none"}}>
            <span>{m.date}</span>
            <span style={{fontWeight:600,color:C.text}}>{m.weight}kg{m.length?" · "+m.length+"cm":""}</span>
          </div>
        ))}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={save} style={{...S.btn(C.accent),flex:1,padding:10,fontSize:13}}>✓ Save Measurement</button>
        <button onClick={onClose} style={{...S.btn("#374151"),padding:"10px 14px",fontSize:13}}>Cancel</button>
      </div>
    </div>
  </div>);
}

function Pigs({pigs,setPigs,logs,allData,capital,setCapital}){
  function makeBlankForm(breed="Landrace",stage="Piglet",existingPigs){
    return{tag:genPigTag(breed,stage,existingPigs||pigs),breed,gender:"Female",stage,weight:"",length:"",dob:"",arrivalDate:toDay(),source:"",batchName:"",purchasePrice:""};
  }
  const [mode,setMode]=useState(null); // null | "single" | "batch"
  const [form,setForm]=useState(()=>makeBlankForm());
  const [batchCount,setBatchCount]=useState("5");
  const [batchRows,setBatchRows]=useState([]);
  const [saved,setSaved]=useState(false);
  const [undoStack,setUndoStack]=useState([]); // [{pig, timestamp}]
  const [undoBanner,setUndoBanner]=useState(null);
  const [growthPig,setGrowthPig]=useState(null); // pig for growth modal
  const [searchQ,setSearchQ]=useState("");
  const [filterStage,setFilterStage]=useState("");
  const [editPigId,setEditPigId]=useState(null);
  const [editForm,setEditForm]=useState(null);

  function initBatch(){
    const n=parseInt(batchCount)||5;
    const rows=Array.from({length:n},(_,i)=>{
      const breed="Landrace",stage="Piglet";
      return{tag:genPigTag(breed,stage,[...pigs,...Array(i).fill({breed,stage})]),breed,gender:"Female",stage,weight:"",length:"",dob:"",arrivalDate:toDay(),source:"",batchName:"",purchasePrice:"",id:uid()};
    });
    setBatchRows(rows);
  }

  function addSingle(){
    if(!form.tag.trim()){alert("Tag is required");return;}
    const price=parseFloat(form.purchasePrice)||0;
    const newPig={...form,id:uid(),weight:parseFloat(form.weight)||0,length:parseFloat(form.length)||null,status:"active",measurements:[]};
    setPigs(p=>{const updated=[...p,newPig];fsSet("pigs",updated);return updated;});
    if(setCapital&&price>0){
      capitalTx(capital,setCapital,{type:"expense",category:"Pig Purchase",amount:price,description:`Pig ${form.tag} (${form.stage}, ${form.weight||0}kg) from ${form.source||"unknown source"}`,date:form.arrivalDate||toDay()});
    }
    setForm(makeBlankForm());setMode(null);setSaved(true);setTimeout(()=>setSaved(false),3000);
  }

  function addBatch(){
    const valid=batchRows.filter(r=>r.tag.trim());
    if(!valid.length){alert("Fill in at least one tag");return;}
    const totalPrice=valid.reduce((s,r)=>s+(parseFloat(r.purchasePrice)||0),0);
    const newPigs=valid.map(r=>({...r,weight:parseFloat(r.weight)||0,length:parseFloat(r.length)||null,status:"active",measurements:[]}));
    setPigs(p=>{const updated=[...p,...newPigs];fsSet("pigs",updated);return updated;});
    if(setCapital&&totalPrice>0){
      capitalTx(capital,setCapital,{type:"expense",category:"Pig Purchase",amount:totalPrice,description:`Batch registration: ${valid.length} pigs (${valid[0].batchName||"no batch name"})`,date:valid[0].arrivalDate||toDay()});
    }
    setBatchRows([]);setMode(null);setSaved(true);setTimeout(()=>setSaved(false),3000);
  }

  function deletePig(pig){
    setUndoStack(prev=>[...prev,{pig,timestamp:Date.now()}]);
    setPigs(prev=>{const updated=prev.filter(p=>p.id!==pig.id);fsSet("pigs",updated);return updated;});
    setUndoBanner(pig.id);
    setTimeout(()=>setUndoBanner(null),8000);
  }

  function undoDelete(pigId){
    const entry=undoStack.find(u=>u.pig.id===pigId);
    if(!entry)return;
    setPigs(prev=>{const updated=[...prev,entry.pig];fsSet("pigs",updated);return updated;});
    setUndoStack(prev=>prev.filter(u=>u.pig.id!==pigId));
    setUndoBanner(null);
  }

  function saveGrowth(pigId,updates){
    setPigs(prev=>{const updated=prev.map(p=>p.id===pigId?{...p,...updates}:p);fsSet("pigs",updated);return updated;});
    setGrowthPig(null);
  }

  function saveEdit(){
    if(!editForm)return;
    setPigs(prev=>{const updated=prev.map(p=>p.id===editPigId?{...p,...editForm,weight:parseFloat(editForm.weight)||p.weight,length:parseFloat(editForm.length)||p.length}:p);fsSet("pigs",updated);return updated;});
    setEditPigId(null);setEditForm(null);
  }

  const sc={Piglet:"#a78bfa",Weaner:"#60a5fa",Grower:"#10b981",Finisher:C.amber,Gilt:C.pink,Sow:C.red,Boar:"#fb923c"};
  const activePigs=pigs.filter(p=>p.status==="active");
  const filtered=pigs.filter(p=>{
    if(filterStage&&p.stage!==filterStage)return false;
    if(searchQ){const q=searchQ.toLowerCase();return(p.tag||"").toLowerCase().includes(q)||(p.breed||"").toLowerCase().includes(q)||(p.source||"").toLowerCase().includes(q)||(p.batchName||"").toLowerCase().includes(q);}
    return true;
  });

  const BREEDS=["Landrace","Large White","Duroc","Hampshire","Mixed/Local"];
  const STAGES=["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];

  return(<div>
    {/* Growth modal */}
    {growthPig&&<GrowthModal pig={growthPig} onSave={(u)=>saveGrowth(growthPig.id,u)} onClose={()=>setGrowthPig(null)}/>}

    {/* Undo banner */}
    {undoBanner&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9990,display:"flex",alignItems:"center",gap:12,background:"#1e293b",color:"#fff",padding:"12px 18px",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,.3)",fontSize:13}}>
      🗑️ Pig deleted.
      <button onClick={()=>undoDelete(undoBanner)} style={{padding:"5px 14px",borderRadius:7,border:"none",background:C.accent,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>↩ Undo</button>
      <button onClick={()=>setUndoBanner(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
    </div>}

    {saved&&<div style={{padding:"11px 14px",background:C.accentSoft,border:"1px solid rgba(22,163,74,.3)",borderRadius:9,marginBottom:14,color:C.accent,fontWeight:600}}>✅ Pig(s) registered successfully!</div>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <div><div style={S.h1}>🐷 Pig Records</div><div style={S.sub}>{activePigs.length} active · {pigs.filter(p=>p.status==="sold").length} sold</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        <PDFBtn label="Herd PDF" type="health" getData={()=>allData} icon="🐷" color="#374151"/>
        <button style={S.btn()} onClick={()=>setMode(mode==="single"?null:"single")}>+ Add Pig</button>
        <button style={{...S.btn("#1d4ed8")}} onClick={()=>{setMode(mode==="batch"?null:"batch");initBatch();}}>📋 Batch Register</button>
      </div>
    </div>

    {/* SINGLE PIG FORM */}
    {mode==="single"&&<div style={{...S.card,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.accent,marginBottom:4}}>➕ Register New Pig</div>
      <div style={{fontSize:11,color:C.faint,marginBottom:12}}>Tag is auto-generated. Change breed/stage to regenerate.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
        <div>
          <label style={S.lbl}>Auto-Generated Tag</label>
          <div style={{display:"flex",gap:5}}>
            <input value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})} style={{...S.inp,background:"#f0fdf4!important",fontWeight:700,fontFamily:"monospace",fontSize:12,flex:1}} title="Auto-generated. You may edit manually."/>
            <button title="Regenerate tag" onClick={()=>setForm(f=>({...f,tag:genPigTag(f.breed,f.stage,pigs)}))} style={{padding:"6px 9px",borderRadius:7,border:"1px solid rgba(22,163,74,.4)",background:"rgba(22,163,74,.07)",color:C.accent,cursor:"pointer",fontSize:13,flexShrink:0}}>🔄</button>
          </div>
        </div>
        <div><label style={S.lbl}>Weight (kg)</label><input type="number" step="0.1" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Length (cm)</label><input type="number" step="0.5" value={form.length} onChange={e=>setForm({...form,length:e.target.value})} placeholder="e.g. 85" style={S.inp}/></div>
        <div><label style={S.lbl}>Breed</label><select value={form.breed} onChange={e=>{const b=e.target.value;setForm(f=>({...f,breed:b,tag:genPigTag(b,f.stage,pigs)}));}} style={S.inp}>{BREEDS.map(o=><option key={o}>{o}</option>)}</select></div>
        <div><label style={S.lbl}>Gender</label><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} style={S.inp}><option>Female</option><option>Male</option></select></div>
        <div><label style={S.lbl}>Stage</label><select value={form.stage} onChange={e=>{const s=e.target.value;setForm(f=>({...f,stage:s,tag:genPigTag(f.breed,s,pigs)}));}} style={S.inp}>{STAGES.map(o=><option key={o}>{o}</option>)}</select></div>
        <div><label style={S.lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Arrival Date</label><input type="date" value={form.arrivalDate} onChange={e=>setForm({...form,arrivalDate:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Source Farm / Supplier</label><input placeholder="e.g. Musanze Farm" value={form.source} onChange={e=>setForm({...form,source:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Batch Name (optional)</label><input placeholder="e.g. Batch-2025-A" value={form.batchName} onChange={e=>setForm({...form,batchName:e.target.value})} style={S.inp}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Purchase Price (RWF) — deducted from capital</label><input type="number" placeholder="e.g. 35000" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})} style={S.inp}/>{form.purchasePrice&&parseFloat(form.purchasePrice)>0&&<div style={{fontSize:11,color:C.red,marginTop:3}}>💰 {fmtRWF(parseFloat(form.purchasePrice))} will be recorded as Pig Purchase expense</div>}</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btn(),flex:1,padding:11}} onClick={addSingle}>✅ Register Pig</button>
        <button style={S.btn("#374151")} onClick={()=>setMode(null)}>Cancel</button>
      </div>
    </div>}

    {/* BATCH REGISTRATION FORM */}
    {mode==="batch"&&<div style={{...S.card,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:"#1d4ed8",marginBottom:4}}>📋 Batch Pig Registration</div>
      <div style={{fontSize:12,color:C.faint,marginBottom:12}}>Register multiple pigs arriving together (same batch/source)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12,padding:"12px",background:"rgba(29,78,216,.04)",borderRadius:9,border:"1px solid rgba(29,78,216,.15)"}}>
        <div><label style={S.lbl}>Number of Pigs</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="number" min="1" max="50" value={batchCount} onChange={e=>setBatchCount(e.target.value)} style={{...S.inp,width:70}} />
            <button onClick={initBatch} style={{...S.btn("#1d4ed8"),fontSize:11,padding:"8px 12px",flexShrink:0}}>Generate</button>
          </div>
        </div>
        <div><label style={S.lbl}>Batch Name</label><input placeholder="e.g. Batch-2025-A" value={form.batchName} onChange={e=>{setForm({...form,batchName:e.target.value});setBatchRows(r=>r.map(row=>({...row,batchName:e.target.value})));}} style={S.inp}/></div>
        <div><label style={S.lbl}>Arrival Date</label><input type="date" value={form.arrivalDate} onChange={e=>{setForm({...form,arrivalDate:e.target.value});setBatchRows(r=>r.map(row=>({...row,arrivalDate:e.target.value})));}} style={S.inp}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Source Farm / Supplier (applies to all)</label><input placeholder="e.g. Musanze Farm Co-op" value={form.source} onChange={e=>{setForm({...form,source:e.target.value});setBatchRows(r=>r.map(row=>({...row,source:e.target.value})));}} style={S.inp}/></div>
      </div>
      {batchRows.length>0&&<div style={{overflowX:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:C.elevated}}>
            {["Tag *","Breed","Gender","Stage","Weight (kg)","Length (cm)","Price (RWF)"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:"left",color:C.faint,fontWeight:600,fontSize:10,borderBottom:"1px solid "+C.border}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {batchRows.map((row,i)=>(
              <tr key={i} style={{borderBottom:"1px solid "+C.elevated}}>
                <td style={{padding:"4px 6px"}}><input value={row.tag} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,tag:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}} placeholder={`RW-00${i+1}`}/></td>
                <td style={{padding:"4px 6px"}}><select value={row.breed} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,breed:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}}>{BREEDS.map(o=><option key={o}>{o}</option>)}</select></td>
                <td style={{padding:"4px 6px"}}><select value={row.gender} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,gender:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}}><option>Female</option><option>Male</option></select></td>
                <td style={{padding:"4px 6px"}}><select value={row.stage} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,stage:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}}>{STAGES.map(o=><option key={o}>{o}</option>)}</select></td>
                <td style={{padding:"4px 6px"}}><input type="number" value={row.weight} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,weight:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}} placeholder="0"/></td>
                <td style={{padding:"4px 6px"}}><input type="number" value={row.length} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,length:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}} placeholder="0"/></td>
                <td style={{padding:"4px 6px"}}><input type="number" value={row.purchasePrice} onChange={e=>setBatchRows(r=>r.map((x,j)=>j===i?{...x,purchasePrice:e.target.value}:x))} style={{...S.inp,padding:"5px 7px",fontSize:12}} placeholder="0"/></td>
              </tr>
            ))}
          </tbody>
        </table>
        {batchRows.reduce((s,r)=>s+(parseFloat(r.purchasePrice)||0),0)>0&&(
          <div style={{marginTop:8,fontSize:12,color:C.red,fontWeight:600}}>💰 Total batch cost: {fmtRWF(batchRows.reduce((s,r)=>s+(parseFloat(r.purchasePrice)||0),0))}</div>
        )}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btn("#1d4ed8"),flex:1,padding:11}} onClick={addBatch} disabled={!batchRows.length}>✅ Register {batchRows.filter(r=>r.tag.trim()).length} Pig(s)</button>
        <button style={S.btn("#374151")} onClick={()=>setMode(null)}>Cancel</button>
      </div>
    </div>}

    {/* SEARCH + FILTER */}
    {pigs.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:14}}>
      <input placeholder="🔍 Search by tag, breed, source, batch…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={S.inp}/>
      <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} style={{...S.inp,width:"auto"}}>
        <option value="">All Stages</option>
        {STAGES.map(s=><option key={s}>{s}</option>)}
      </select>
    </div>}

    {/* PIG CARDS */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>
      {filtered.map(p=>(
        <div key={p.id} style={{...S.card,marginBottom:0,opacity:p.status==="active"?1:0.55,border:"1px solid "+(p.status==="active"?C.border:"rgba(100,116,139,.2)")}}>
          {editPigId===p.id&&editForm?(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:9}}>✏️ Edit {p.tag}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9}}>
                <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={editForm.weight} onChange={e=>setEditForm({...editForm,weight:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Length (cm)</label><input type="number" value={editForm.length||""} onChange={e=>setEditForm({...editForm,length:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Stage</label><select value={editForm.stage} onChange={e=>setEditForm({...editForm,stage:e.target.value})} style={S.inp}>{STAGES.map(o=><option key={o}>{o}</option>)}</select></div>
                <div><label style={S.lbl}>Breed</label><select value={editForm.breed} onChange={e=>setEditForm({...editForm,breed:e.target.value})} style={S.inp}>{BREEDS.map(o=><option key={o}>{o}</option>)}</select></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Source</label><input value={editForm.source||""} onChange={e=>setEditForm({...editForm,source:e.target.value})} style={S.inp}/></div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={saveEdit} style={{...S.btn(C.accent),flex:1,padding:"7px",fontSize:12}}>✓ Save</button>
                <button onClick={()=>{setEditPigId(null);setEditForm(null);}} style={{...S.btn("#374151"),padding:"7px",fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:14,fontWeight:700}}>🐷 {p.tag}</div>
                <span style={{padding:"2px 8px",borderRadius:20,background:(sc[p.stage]||C.accent)+"22",color:sc[p.stage]||C.accent,fontSize:10,fontWeight:600}}>{p.stage}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,fontSize:11,marginBottom:8}}>
                {[["Breed",p.breed],["Gender",p.gender],["Weight",p.weight+"kg"],["Length",p.length?(p.length+"cm"):"—"],["Market Val",fmtRWF(p.status==="active"?getMarketPrice(p.stage,p.weight):0)],["Arrived",p.arrivalDate||"—"]].map(([l,v])=>(
                  <div key={l} style={{background:C.elevated,borderRadius:5,padding:"4px 7px"}}><div style={{color:C.faint,fontSize:9}}>{l}</div><div style={{color:l==="Market Val"?C.accent:C.text,marginTop:1,fontWeight:l==="Market Val"?700:400}}>{v}</div></div>
                ))}
              </div>
              {(p.source||p.batchName)&&<div style={{fontSize:10,color:C.faint,marginBottom:8,padding:"4px 7px",background:C.elevated,borderRadius:5}}>
                {p.source&&<span>📍 {p.source}</span>}{p.source&&p.batchName&&" · "}{p.batchName&&<span>📦 {p.batchName}</span>}
              </div>}
              {p.measurements&&p.measurements.length>1&&(()=>{
                const hist=p.measurements;
                const last=hist[hist.length-1];
                const prev=hist[hist.length-2];
                const gain=Math.round((last.weight-prev.weight)*10)/10;
                return(<div style={{fontSize:10,color:gain>=0?C.accent:C.red,marginBottom:8,padding:"3px 7px",background:gain>=0?C.accentSoft:"rgba(239,68,68,.06)",borderRadius:5,fontWeight:600}}>
                  📈 Last gain: {gain>=0?"+":""}{gain}kg · {last.date}
                </div>);
              })()}
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                {p.status==="active"&&<button onClick={()=>setGrowthPig(p)} style={{flex:1,padding:"5px",borderRadius:6,border:"1px solid "+C.border,background:C.accentSoft,color:C.accent,fontSize:10,cursor:"pointer",fontWeight:600}}>📏 Record Growth</button>}
                <button onClick={()=>setPigs(prev=>{const updated=prev.map(pig=>pig.id===p.id?{...pig,status:pig.status==="active"?"sold":"active"}:pig);fsSet("pigs",updated);return updated;})} style={{flex:1,padding:5,borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.faint,fontSize:10,cursor:"pointer"}}>
                  {p.status==="active"?"Mark Sold":"Reactivate"}
                </button>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>{setEditPigId(p.id);setEditForm({weight:String(p.weight),length:String(p.length||""),stage:p.stage,breed:p.breed,source:p.source||""});}} style={{flex:1,padding:"4px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:10,cursor:"pointer"}}>✏️ Edit</button>
                <button onClick={()=>deletePig(p)} style={{flex:1,padding:"4px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,fontSize:10,cursor:"pointer"}}>🗑️ Delete</button>
              </div>
              {p.status==="active"&&<PigHealthAI pig={p} logs={logs}/>}
            </>
          )}
        </div>
      ))}
    </div>
    {filtered.length===0&&pigs.length>0&&<div style={{...S.card,textAlign:"center",color:C.faint,padding:30}}>No pigs match your search/filter.</div>}
  </div>);
}

/* ─── Feed Log ─── */
function FeedLog({feeds,setFeeds,pigs,logs,sales,expenses,incomes,allData,user}){
  const [tab,setTab]=useState("records");
  const [filterWorker,setFilterWorker]=useState("");
  const [filterType,setFilterType]=useState("");
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState(null);
  const isAdmin=isAdminUser(user);

  // ── Core Calculations ──
  const totalKg=feeds.reduce((s,f)=>s+(parseFloat(f.kg)||0),0);
  const totalCost=feeds.reduce((s,f)=>s+(parseFloat(f.cost)||0),0);
  const avgCostPerKg=totalKg>0?Math.round(totalCost/totalKg):0;
  const active=pigs.filter(p=>p.status==="active");

  // Stage-based expected daily feed
  const STAGE_FEED={Piglet:0.5,Weaner:1.0,Grower:1.8,Finisher:2.8,Gilt:2.2,Sow:2.5,Boar:2.0};
  const expectedDailyKg=Math.round(active.reduce((s,p)=>s+(STAGE_FEED[p.stage]||2.0),0)*10)/10;

  // Actual average daily feed from logs
  const logDates=feeds.length>0?new Set(feeds.map(f=>f.date)).size:1;
  const actualDailyKg=logDates>0?Math.round((totalKg/logDates)*10)/10:0;

  // Per-type breakdown
  const byType={};
  feeds.forEach(f=>{
    const t=f.feedType||"Other";
    if(!byType[t])byType[t]={kg:0,cost:0,count:0};
    byType[t].kg+=parseFloat(f.kg)||0;
    byType[t].cost+=parseFloat(f.cost)||0;
    byType[t].count++;
  });

  // Per-worker breakdown
  const byWorker={};
  feeds.forEach(f=>{
    const w=f.worker||"Unknown";
    if(!byWorker[w])byWorker[w]={kg:0,cost:0,count:0};
    byWorker[w].kg+=parseFloat(f.kg)||0;
    byWorker[w].cost+=parseFloat(f.cost)||0;
    byWorker[w].count++;
  });

  // Monthly totals
  const monthMap={};
  feeds.forEach(f=>{
    const m=(f.date||"").slice(0,7);
    if(!m)return;
    if(!monthMap[m])monthMap[m]={kg:0,cost:0};
    monthMap[m].kg+=parseFloat(f.kg)||0;
    monthMap[m].cost+=parseFloat(f.cost)||0;
  });
  const months=Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);

  // Feed efficiency: cost vs expected
  const efficiencyPct=expectedDailyKg>0&&actualDailyKg>0?Math.round((actualDailyKg/expectedDailyKg)*100):null;
  const effColor=efficiencyPct===null?C.faint:efficiencyPct>=90&&efficiencyPct<=115?C.accent:efficiencyPct<80?C.red:C.amber;

  // Filtered records
  const allWorkers=[...new Set(feeds.map(f=>f.worker||"Unknown"))];
  const allTypes=[...new Set(feeds.map(f=>f.feedType||"Other"))];
  const filtered=feeds.slice().reverse().filter(f=>{
    if(filterWorker&&f.worker!==filterWorker)return false;
    if(filterType&&f.feedType!==filterType)return false;
    return true;
  });

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div>
        <div style={S.h1}>🌾 Feeding Records</div>
        <div style={S.sub}>{feeds.length} logs · {Math.round(totalKg*10)/10}kg fed · {fmtRWF(totalCost)} total cost</div>
      </div>
      <PDFBtn label="Health PDF" type="health" getData={()=>allData} icon="🌾" color="#374151"/>
    </div>

    {/* ── Summary Stats ── */}
    <div style={S.g4}>
      {[
        {l:"Total Feed (kg)",v:fmtNum(Math.round(totalKg)),c:C.accent},
        {l:"Total Cost",v:fmtRWF(totalCost),c:C.amber},
        {l:"Avg Cost/kg",v:"RWF "+fmtNum(avgCostPerKg),c:C.blue},
        {l:"Feed Efficiency",v:efficiencyPct!==null?efficiencyPct+"%":"—",c:effColor},
      ].map(s=>(<div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:s.v.length>9?14:20}}>{s.v}</div></div>))}
    </div>

    {/* ── Feed vs Expected Banner ── */}
    {active.length>0&&expectedDailyKg>0&&<div style={{...S.card,padding:14,marginBottom:14,background:"rgba(22,163,74,.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8,fontWeight:700,color:C.accent}}>
        <span>📊 Actual vs Expected Daily Feed</span>
        <span style={{color:effColor}}>{efficiencyPct!==null?efficiencyPct+"% of target":""}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,fontSize:12,marginBottom:8}}>
        {[
          ["🎯 Expected/day",expectedDailyKg+"kg","(stage-based)"],
          ["📦 Actual avg/day",actualDailyKg+"kg","(from logs)"],
          ["💰 Cost/pig/day",active.length>0?fmtRWF(Math.round(totalCost/Math.max(logDates,1)/active.length)):"—","per head"],
        ].map(([l,v,h])=>(<div key={l} style={{background:"#fff",borderRadius:7,padding:"7px 10px",border:"1px solid "+C.border}}>
          <div style={{color:C.faint,fontSize:10}}>{l}</div>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{v}</div>
          <div style={{fontSize:9,color:C.faint}}>{h}</div>
        </div>))}
      </div>
      {/* Expected per stage */}
      <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:600}}>Expected feed by stage today:</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {Object.entries(STAGE_FEED).filter(([stage])=>active.some(p=>p.stage===stage)).map(([stage,kg])=>{
          const count=active.filter(p=>p.stage===stage).length;
          return(<span key={stage} style={{padding:"3px 9px",borderRadius:12,background:C.elevated,border:"1px solid "+C.border,fontSize:11,color:C.text}}>
            {stage}: {count}×{kg}kg = <strong>{Math.round(count*kg*10)/10}kg</strong>
          </span>);
        })}
      </div>
    </div>}

    {/* ── Tabs ── */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["records","📋 All Records"],["bytype","🌾 By Feed Type"],["byworker","👷 By Worker"],["monthly","📅 Monthly"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* ── ALL RECORDS ── */}
    {tab==="records"&&<div>
      {/* Filters */}
      {feeds.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={S.lbl}>Filter by Worker</label>
          <select value={filterWorker} onChange={e=>setFilterWorker(e.target.value)} style={S.inp}>
            <option value="">All Workers</option>
            {allWorkers.map(w=><option key={w}>{w}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Filter by Feed Type</label>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={S.inp}>
            <option value="">All Types</option>
            {allTypes.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
      </div>}
      {filtered.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:30}}>No records match filters.</div>}
      {filtered.map((f,i)=>{
        const pig=pigs.find(p=>p.id===f.pigId);
        const cpk=f.kg>0?Math.round(f.cost/f.kg):0;
        const cpkColor=cpk>0&&avgCostPerKg>0?(cpk>avgCostPerKg*1.2?C.red:cpk<avgCostPerKg*0.8?C.accent:C.muted):C.muted;
        return(<div key={i} style={{...S.card,marginBottom:8,padding:"10px 14px"}}>
          {editId===f.id&&editForm?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><label style={S.lbl}>Amount (kg)</label><input type="number" value={editForm.kg} onChange={e=>setEditForm({...editForm,kg:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Cost (RWF)</label><input type="number" value={editForm.cost} onChange={e=>setEditForm({...editForm,cost:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Feed Type</label><input value={editForm.feedType} onChange={e=>setEditForm({...editForm,feedType:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setFeeds(p=>{const updated=p.map(x=>x.id===f.id?{...x,...editForm,kg:parseFloat(editForm.kg)||x.kg,cost:parseFloat(editForm.cost)||x.cost}:x);fsSet("feeds",updated);return updated;});setEditId(null);setEditForm(null);}} style={{...S.btn(C.accent),flex:1,padding:"7px",fontSize:12}}>✓ Save</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),flex:1,padding:"7px",fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:600,color:C.text,fontSize:13}}>{f.feedType||"Feed"} <span style={{color:C.faint,fontWeight:400,fontSize:11}}>— {f.worker}</span></div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>
                  {f.date} {pig?" · 🐷 "+pig.tag:" · All pigs"} {f.notes?" · "+f.notes:""}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:C.amber,fontSize:14}}>{f.kg}kg · {fmtRWF(f.cost)}</div>
                <div style={{fontSize:10,color:cpkColor,marginTop:2}}>RWF {fmtNum(cpk)}/kg {cpk>avgCostPerKg*1.2?"⚠️ above avg":cpk>0&&cpk<avgCostPerKg*0.8?"✅ below avg":""}</div>
                {isAdmin&&<div style={{display:"flex",gap:5,marginTop:5,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setEditId(f.id);setEditForm({kg:String(f.kg),cost:String(f.cost),feedType:f.feedType,date:f.date});}} style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid "+C.border,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                  <button onClick={()=>{if(window.confirm("Delete this feed record?"))setFeeds(p=>{const updated=p.filter(x=>x.id!==f.id);fsSet("feeds",updated);return updated;});}} style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                </div>}
              </div>
            </div>
          )}
        </div>);
      })}
      {filtered.length>0&&<div style={{...S.card,padding:"10px 14px",background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span style={{color:C.muted}}>Showing {filtered.length} records</span>
          <span style={{color:C.amber,fontWeight:700}}>Total: {Math.round(filtered.reduce((s,f)=>s+(f.kg||0),0)*10)/10}kg · {fmtRWF(filtered.reduce((s,f)=>s+(f.cost||0),0))}</span>
        </div>
      </div>}
    </div>}

    {/* ── BY FEED TYPE ── */}
    {tab==="bytype"&&<div>
      {Object.keys(byType).length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No feed records yet.</div>}
      {Object.entries(byType).sort((a,b)=>b[1].cost-a[1].cost).map(([type,data])=>{
        const cpk=data.kg>0?Math.round(data.cost/data.kg):0;
        const pct=totalCost>0?((data.cost/totalCost)*100).toFixed(1):0;
        return(<div key={type} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:700,color:C.text,fontSize:14}}>🌾 {type}</div>
            <span style={{padding:"2px 9px",borderRadius:12,background:"rgba(245,158,11,.1)",color:C.amber,fontSize:11,fontWeight:700}}>{pct}% of cost</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,fontSize:12}}>
            {[["Sessions",data.count],["Total (kg)",Math.round(data.kg*10)/10],["Total Cost",fmtRWF(data.cost)],["Avg Cost/kg","RWF "+fmtNum(cpk)]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:C.text}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:8,height:5,background:C.elevated,borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",width:pct+"%",background:C.amber,borderRadius:5}}/>
          </div>
        </div>);
      })}
    </div>}

    {/* ── BY WORKER ── */}
    {tab==="byworker"&&<div>
      {Object.keys(byWorker).length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No feed records yet.</div>}
      {Object.entries(byWorker).sort((a,b)=>b[1].kg-a[1].kg).map(([worker,data])=>{
        const cpk=data.kg>0?Math.round(data.cost/data.kg):0;
        const pct=totalKg>0?((data.kg/totalKg)*100).toFixed(1):0;
        return(<div key={worker} style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontWeight:700,color:C.text}}>👷 {worker}</div>
            <span style={{color:C.blue,fontSize:12,fontWeight:600}}>{data.count} sessions · {pct}% of total feed</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,fontSize:12}}>
            {[["Total (kg)",Math.round(data.kg*10)/10+"kg"],["Total Cost",fmtRWF(data.cost)],["Avg Cost/kg","RWF "+fmtNum(cpk)]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:C.text,fontSize:13}}>{v}</div>
              </div>
            ))}
          </div>
        </div>);
      })}
    </div>}

    {/* ── MONTHLY ── */}
    {tab==="monthly"&&<div>
      {months.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No data yet.</div>}
      {months.map(([m,data])=>{
        const cpk=data.kg>0?Math.round(data.cost/data.kg):0;
        return(<div key={m} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:700,color:C.text}}>{m}</div>
            <div style={{fontSize:12,color:C.amber,fontWeight:600}}>{fmtRWF(data.cost)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12}}>
            {[["Total (kg)",Math.round(data.kg*10)/10+"kg"],["Total Cost",fmtRWF(data.cost)],["Avg Cost/kg","RWF "+fmtNum(cpk)]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:C.text}}>{v}</div>
              </div>
            ))}
          </div>
        </div>);
      })}
    </div>}

    <div style={{fontSize:14,fontWeight:700,color:C.accent,margin:"6px 0 12px"}}>✦ AI Feed Optimization</div>
    <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic="Optimal feed per pig stage, cost savings, weight gain forecast, best suppliers Rwanda." label="Feed Optimization" icon="🌾"/>
  </div>);
}

/* ─── Sales Log ─── */
function SaleLog({sales,setSales,pigs,feeds,logs,expenses,incomes,allData,user}){
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState(null);
  const isAdmin=isAdminUser(user);
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div><div style={S.h1}>Sales Records</div><div style={S.sub}>{sales.length} sales · {fmtRWF(sales.reduce((s,l)=>s+(l.total||0),0))}</div></div>
      <PDFBtn label="Finance PDF" type="finance" getData={()=>allData} icon="🏷️" color="#374151"/>
    </div>
    <div style={S.card}>
      {sales.length===0&&<div style={{color:C.faint,fontSize:13}}>No sales yet.</div>}
      {sales.slice().reverse().map((s,i)=>{
        const pig=pigs.find(p=>p.id===s.pigId);
        return(<div key={i} style={{...S.row,flexWrap:"wrap",alignItems:"flex-start",gap:4,paddingBottom:8,marginBottom:8,borderBottom:"1px solid "+C.elevated}}>
          {editId===s.id&&editForm?(
            <div style={{width:"100%"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><label style={S.lbl}>Buyer</label><input value={editForm.buyer} onChange={e=>setEditForm({...editForm,buyer:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={editForm.weight} onChange={e=>setEditForm({...editForm,weight:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Price/kg (RWF)</label><input type="number" value={editForm.priceKg} onChange={e=>setEditForm({...editForm,priceKg:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setSales(p=>p.map(x=>{if(x.id!==s.id)return x;const w=parseFloat(editForm.weight||x.weight)||x.weight;const pk=parseFloat(editForm.priceKg||x.priceKg)||x.priceKg;return{...x,...editForm,weight:w,priceKg:pk,total:Math.round(w*pk)};}));setEditId(null);setEditForm(null);}} style={{...S.btn(C.accent),flex:1,padding:"7px",fontSize:12}}>✓ Save</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),flex:1,padding:"7px",fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <>
              <div style={{flex:1}}><span style={{color:C.muted,fontSize:12}}>{s.date} · {s.worker} · {pig?pig.tag:"—"} · {s.buyer||"—"}</span></div>
              <div style={{textAlign:"right"}}>
                <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(s.total)}</span>
                {isAdmin&&<div style={{display:"flex",gap:5,marginTop:4,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setEditId(s.id);setEditForm({buyer:s.buyer||"",weight:String(s.weight||""),priceKg:String(s.priceKg||""),date:s.date});}} style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid "+C.border,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                  <button onClick={()=>{if(window.confirm("Delete this sale record?")){const u=sales.filter(x=>x.id!==s.id);setSales(u);fsSet("sales",u);}}} style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                </div>}
              </div>
            </>
          )}
        </div>);
      })}
    </div>
    <div style={{fontSize:14,fontWeight:700,color:C.accent,margin:"6px 0 12px"}}>✦ AI Sales Strategy</div>
    <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic="Best sell timing Rwanda, optimal weight at sale, market forecast, best buyers." label="Sales & Market Forecast" icon="🏷️"/>
  </div>);
}

/* ─── Daily Logs ─── */
function DLogs({logs,setLogs,pigs,feeds,sales,expenses,incomes,allData,user}){
  const isAdmin=isAdminUser(user);
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div><div style={S.h1}>Daily Farm Logs</div><div style={S.sub}>{logs.length} reports</div></div>
      <PDFBtn label="Health PDF" type="health" getData={()=>allData} icon="📋" color="#374151"/>
    </div>
    {logs.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No logs yet.</div>}
    {logs.slice().reverse().map((log,i)=>(
      <div key={i} style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:9}}>
          <div style={{fontWeight:700}}>{log.worker}</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:C.faint}}>{log.date}</span>
            {isAdmin&&<button onClick={()=>{if(window.confirm("Delete this log?")){const u=logs.filter(l=>l.id!==log.id);setLogs(u);fsSet("logs",u);}}} style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:7}}>
          {[["Checked",log.checked],["Sick",log.sick],["Deaths",log.deaths],["Births",log.births],["Water",log.water?"✓":"✗"],["Cleaned",log.cleaned?"✓":"✗"]].map(([l,v])=>(
            <div key={l} style={{background:C.elevated,borderRadius:5,padding:"5px 9px"}}><div style={{fontSize:9,color:C.faint}}>{l}</div><div style={{color:(l==="Sick"||l==="Deaths")&&v>0?C.red:C.text,marginTop:2,fontSize:12}}>{v}</div></div>
          ))}
        </div>
        {log.notes&&<div style={{padding:"7px 11px",background:C.elevated,borderRadius:6,fontSize:12,color:C.muted,fontStyle:"italic"}}>"{log.notes}"</div>}
      </div>
    ))}
    {logs.length>0&&(<>
      <div style={{fontSize:14,fontWeight:700,color:C.accent,margin:"6px 0 12px"}}>✦ AI Health Analysis</div>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic="Disease pattern analysis, mortality risk, vaccination schedule Rwanda, biosecurity improvements." label="Daily Health Insight" icon="📋"/>
    </>)}
  </div>);
}


/* ─── Change Password ─── */
/* ─── Change Password (Password · OTP · Recovery) ─── */
function ChangePassword({user}){
  const [mode,setMode]=useState("password");
  // Password tab
  const [form,setForm]=useState({current:"",newPass:"",confirm:""});
  // OTP tab
  const [otpStep,setOtpStep]=useState(1); // 1=send, 2=enter code
  const [otpInput,setOtpInput]=useState("");
  const [otpCountdown,setOtpCountdown]=useState(0);
  // Recovery tab
  const [recoveryEmail,setRecoveryEmail]=useState(user?.email||"");
  // Shared
  const [err,setErr]=useState("");
  const [ok,setOk]=useState("");
  const [saving,setSaving]=useState(false);

  const fbUser=_auth.currentUser;
  const hasPasswordProvider=fbUser?.providerData?.some(p=>p.providerId==="password");
  const isGoogleOnly=fbUser?.providerData?.every(p=>p.providerId==="google.com");
  const waOk=isWAEnabled();

  /* countdown for OTP resend */
  useEffect(()=>{
    if(otpCountdown<=0) return;
    const t=setTimeout(()=>setOtpCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[otpCountdown]);

  function reset(){setErr("");setOk("");}
  function switchMode(m){setMode(m);reset();setOtpStep(1);setOtpInput("");}

  /* ── Tab 1: Password change (current → new) ── */
  async function savePassword(){
    reset();
    if(!hasPasswordProvider) return setErr("You signed in with Google. Use the OTP or Recovery tab instead.");
    if(!form.current||!form.newPass||!form.confirm) return setErr("Please fill in all fields.");
    if(form.newPass.length<6) return setErr("New password must be at least 6 characters.");
    if(form.newPass!==form.confirm) return setErr("New passwords do not match.");
    if(form.newPass===form.current) return setErr("New password must be different from current.");
    setSaving(true);
    try{
      const cred=firebase.auth.EmailAuthProvider.credential(fbUser.email,form.current);
      await fbUser.reauthenticateWithCredential(cred);
      await fbUser.updatePassword(form.newPass);
      setOk("✅ Password changed successfully!");
      setForm({current:"",newPass:"",confirm:""});
    }catch(e){
      setErr(e.code==="auth/wrong-password"?"❌ Current password is incorrect."
        :e.code==="auth/too-many-requests"?"Too many attempts. Try again later."
        :"Failed: "+e.message);
    }
    setSaving(false);
  }

  /* ── Tab 2: OTP via WhatsApp ── */
  async function sendOTP(){
    reset();
    if(!waOk) return setErr("WhatsApp (CallMeBot) is not configured. Go to Settings → WhatsApp Notifications to set it up first.");
    if(otpCountdown>0) return setErr(`Please wait ${otpCountdown}s before requesting a new code.`);
    setSaving(true);
    try{
      const code=generateOTP();
      await storeOTP(fbUser.uid,code);
      const msg=`🔐 FarmIQ Password OTP\n\nYour one-time code: *${code}*\n\nThis code expires in 10 minutes.\nDo NOT share it with anyone.`;
      const res=await sendWhatsApp(msg);
      if(res.ok===false&&res.reason==="not_configured"){
        setErr("WhatsApp not configured. Set it up in Settings → WhatsApp Notifications.");
      } else {
        setOtpStep(2);
        setOtpCountdown(60);
        setOk("📱 OTP sent to your WhatsApp! Enter the 6-digit code below.");
      }
    }catch(e){ setErr("Failed to send OTP: "+e.message); }
    setSaving(false);
  }

  async function verifyOTPAndReset(){
    reset();
    if(otpInput.length!==6) return setErr("Please enter the full 6-digit OTP code.");
    setSaving(true);
    try{
      const result=await verifyOTP(fbUser.uid,otpInput);
      if(!result.ok){ setErr("❌ "+result.reason); setSaving(false); return; }
      // OTP is valid — send Firebase password reset email as the secure channel
      await _auth.sendPasswordResetEmail(fbUser.email);
      setOtpStep(1);
      setOtpInput("");
      setOk("✅ OTP verified! A secure password reset link has been sent to "+fbUser.email+". Click it to set your new password.");
    }catch(e){ setErr("Verification failed: "+e.message); }
    setSaving(false);
  }

  /* ── Tab 3: Recovery (email reset link) ── */
  async function sendRecovery(){
    reset();
    const email=(recoveryEmail||"").trim();
    if(!email) return setErr("Please enter your email address.");
    setSaving(true);
    try{
      await _auth.sendPasswordResetEmail(email);
      setOk("✅ Password reset link sent to "+email+". Check your inbox and spam folder.");
    }catch(e){
      setErr(e.code==="auth/user-not-found"?"No account found with that email."
        :e.code==="auth/invalid-email"?"Invalid email address."
        :"Failed: "+e.message);
    }
    setSaving(false);
  }

  const msgBox=(type,txt)=>(<div style={{padding:"10px 14px",background:type==="err"?"rgba(239,68,68,.08)":"rgba(22,163,74,.08)",border:"1px solid "+(type==="err"?"rgba(239,68,68,.25)":"rgba(22,163,74,.25)"),borderRadius:9,color:type==="err"?C.red:C.accent,fontSize:13,marginBottom:14,lineHeight:1.5}}>{txt}</div>);

  return(<div style={{maxWidth:460}} className="fade-in">
    <div style={S.h1}>🔒 Password & Security</div>
    <div style={S.sub}>Change password · OTP verification · Account recovery</div>

    {/* Mode selector */}
    <div style={{display:"flex",background:C.elevated,borderRadius:10,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["password","🔑 Password"],["otp","📱 OTP"],["recovery","📧 Recovery"]].map(([m,l])=>(
        <button key={m} style={S.tab(mode===m)} onClick={()=>switchMode(m)}>{l}</button>
      ))}
    </div>

    <div style={S.card}>
      {err&&msgBox("err",err)}
      {ok&&msgBox("ok",ok)}

      {/* ── PASSWORD TAB ── */}
      {mode==="password"&&(<div>
        {isGoogleOnly&&<div style={{padding:"11px 14px",background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,fontSize:13,color:C.amber,marginBottom:16,lineHeight:1.6}}>
          ⚠️ Your account uses <strong>Google Sign-In</strong> only. Switch to the <strong>OTP</strong> tab to add/change a password, or use <strong>Recovery</strong> to get a reset link via email.
        </div>}
        {!isGoogleOnly&&(<>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Current Password</label>
            <input type="password" placeholder="Enter your current password" value={form.current} onChange={e=>setForm({...form,current:e.target.value})} onKeyDown={e=>e.key==="Enter"&&savePassword()} style={S.inp}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>New Password <span style={{color:C.faint,fontWeight:400,textTransform:"none"}}>(min 6 characters)</span></label>
            <input type="password" placeholder="Enter new password" value={form.newPass} onChange={e=>setForm({...form,newPass:e.target.value})} style={S.inp}/>
            {/* Strength bar */}
            {form.newPass.length>0&&<div style={{marginTop:6}}>
              <div style={{height:4,borderRadius:3,background:C.elevated,overflow:"hidden"}}>
                <div style={{height:"100%",transition:"width .3s,background .3s",width:form.newPass.length<6?"30%":form.newPass.length<10?"60%":"100%",background:form.newPass.length<6?C.red:form.newPass.length<10?C.amber:C.accent}}/>
              </div>
              <div style={{fontSize:10,color:form.newPass.length<6?C.red:form.newPass.length<10?C.amber:C.accent,marginTop:3}}>
                {form.newPass.length<6?"Weak":form.newPass.length<10?"Fair":"Strong"}
              </div>
            </div>}
          </div>
          <div style={{marginBottom:18}}>
            <label style={S.lbl}>Confirm New Password</label>
            <input type="password" placeholder="Repeat new password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} onKeyDown={e=>e.key==="Enter"&&savePassword()} style={{...S.inp,borderColor:form.confirm&&form.confirm!==form.newPass?C.red:undefined}}/>
            {form.confirm&&form.confirm!==form.newPass&&<div style={{fontSize:11,color:C.red,marginTop:3}}>Passwords don't match</div>}
          </div>
          <button onClick={savePassword} disabled={saving} style={{...S.btn(),width:"100%",padding:12,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            {saving?<><span className="spin" style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"}}/>Saving…</>:"🔒 Change Password"}
          </button>
          <div style={{textAlign:"center",marginTop:12}}>
            <button onClick={()=>switchMode("recovery")} style={{background:"none",border:"none",color:C.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Forgot current password? Use Recovery →</button>
          </div>
        </>)}
      </div>)}

      {/* ── OTP TAB ── */}
      {mode==="otp"&&(<div>
        <div style={{padding:"10px 14px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.2)",borderRadius:9,fontSize:12,color:"#6366f1",marginBottom:16,lineHeight:1.6}}>
          📱 <strong>How it works:</strong> We generate a 6-digit code and send it to your WhatsApp. Once you verify the code, we send a secure reset link to your email.
        </div>
        {!waOk&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,fontSize:13,color:C.amber,marginBottom:14}}>
          ⚠️ WhatsApp not set up. Go to <strong>Settings → WhatsApp Notifications</strong> to configure your number and CallMeBot API key first.
        </div>}

        {/* Step indicators */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:18}}>
          {[["1","Send OTP"],["2","Verify Code"]].map(([n,l],i)=>(
            <React.Fragment key={n}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:otpStep>=parseInt(n)?C.accent:"rgba(100,116,139,.2)",color:otpStep>=parseInt(n)?"#fff":C.faint,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{n}</div>
                <span style={{fontSize:12,color:otpStep>=parseInt(n)?C.text:C.faint,fontWeight:otpStep===parseInt(n)?700:400}}>{l}</span>
              </div>
              {i<1&&<div style={{flex:1,height:1,background:otpStep>1?C.accent:C.border,margin:"0 4px"}}/>}
            </React.Fragment>
          ))}
        </div>

        {otpStep===1&&(<div>
          <div style={{textAlign:"center",padding:"24px 16px",marginBottom:16}}>
            <div style={{fontSize:40,marginBottom:10}}>📲</div>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>Send OTP to WhatsApp</div>
            <div style={{fontSize:12,color:C.muted}}>A 6-digit code will be sent to your registered WhatsApp number via CallMeBot.</div>
          </div>
          <button onClick={sendOTP} disabled={saving||!waOk||otpCountdown>0} style={{...S.btn(waOk?"#6366f1":"#94a3b8"),width:"100%",padding:12,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            {saving?<><span className="spin" style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"}}/>Sending…</>
            :otpCountdown>0?`⏳ Resend in ${otpCountdown}s`:"📱 Send OTP via WhatsApp"}
          </button>
        </div>)}

        {otpStep===2&&(<div>
          <div style={{marginBottom:16}}>
            <label style={S.lbl}>6-Digit OTP Code</label>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="• • • • • •" value={otpInput} onChange={e=>setOtpInput(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>e.key==="Enter"&&otpInput.length===6&&verifyOTPAndReset()} style={{...S.inp,letterSpacing:10,fontSize:22,textAlign:"center",fontWeight:800,paddingTop:12,paddingBottom:12}}/>
            <div style={{fontSize:11,color:C.faint,marginTop:5,textAlign:"center"}}>Check your WhatsApp — code expires in 10 minutes</div>
          </div>
          {/* OTP digit display */}
          {otpInput.length>0&&<div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} style={{width:38,height:46,borderRadius:8,border:"2px solid "+(i<otpInput.length?C.accent:C.border),background:i<otpInput.length?"rgba(22,163,74,.06)":C.elevated,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:C.text,transition:"all .15s"}}>
                {otpInput[i]||""}
              </div>
            ))}
          </div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setOtpStep(1);setOtpInput("");reset();}} style={{...S.btn(C.elevated),color:C.muted,border:"1px solid "+C.border,padding:"10px 14px",fontSize:13}}>← Back</button>
            <button onClick={verifyOTPAndReset} disabled={saving||otpInput.length<6} style={{...S.btn(),flex:1,padding:10,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {saving?<><span className="spin" style={{width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"}}/>Verifying…</>:"✅ Verify & Send Reset Email"}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:10}}>
            <button onClick={()=>{if(otpCountdown===0){setOtpStep(1);setOtpInput("");reset();}else setErr(`Wait ${otpCountdown}s before resending.`);}} style={{background:"none",border:"none",color:otpCountdown>0?C.faint:C.accent,fontSize:12,cursor:otpCountdown>0?"default":"pointer",fontFamily:"inherit"}}>
              {otpCountdown>0?`Resend available in ${otpCountdown}s`:"Didn't receive it? Resend OTP"}
            </button>
          </div>
        </div>)}
      </div>)}

      {/* ── RECOVERY TAB ── */}
      {mode==="recovery"&&(<div>
        <div style={{textAlign:"center",padding:"20px 16px 16px"}}>
          <div style={{fontSize:40,marginBottom:10}}>📧</div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Email Recovery</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>Enter your email address and we'll send you a secure password reset link. Works even if you've completely forgotten your password.</div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.lbl}>Email Address</label>
          <input type="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendRecovery()} placeholder="you@example.com" style={S.inp} autoCapitalize="none"/>
        </div>
        <button onClick={sendRecovery} disabled={saving} style={{...S.btn("#2563eb"),width:"100%",padding:12,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          {saving?<><span className="spin" style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"}}/>Sending…</>:"📧 Send Password Reset Email"}
        </button>
        <div style={{marginTop:14,padding:"10px 14px",background:"rgba(59,130,246,.05)",border:"1px solid rgba(59,130,246,.15)",borderRadius:9,fontSize:12,color:"#3b82f6",lineHeight:1.7}}>
          💡 <strong>Tips:</strong> Check your spam/junk folder. The link expires in 1 hour. Click it on the same device/browser for best results.
        </div>
      </div>)}
    </div>
  </div>);
}

/* ─── Workers ─── */
function Workers({users,setUsers,tasks=[]}){
  const [saving,setSaving]=React.useState(null);
  const [refreshing,setRefreshing]=React.useState(false);
  const [lastCheck,setLastCheck]=React.useState("");
  const pending=users.filter(u=>u.role==="worker"&&!u.approved&&!u.removed);
  const approved=users.filter(u=>u.role==="worker"&&u.approved&&!u.removed);
  const removed=users.filter(u=>u.role==="worker"&&u.removed);

  async function restoreWorker(uid){
    setSaving(uid);
    try{
      await _db.collection("users").doc(uid).update({approved:false,removed:false,removedAt:null});
      setUsers(prev=>prev.map(u=>(u.uid||u.id)===uid?{...u,approved:false,removed:false}:u));
    }catch(e){console.error("restore error",e);}
    setSaving(null);
  }

  // Auto-refresh every 10 seconds when on this page
  useEffect(()=>{
    refresh();
    const t=setInterval(refresh,4000);
    return()=>clearInterval(t);
  },[]);

  async function refresh(){
    setRefreshing(true);
    try{
      const fresh = await getAllUserProfiles();
      if(fresh&&fresh.length>0) setUsers(fresh);
      setLastCheck(new Date().toLocaleTimeString());
    }catch(e){}
    setRefreshing(false);
  }

  async function approve(uid){
    setSaving(uid);
    try{
      await updateUserProfile(uid,{approved:true});
      setUsers(prev=>prev.map(u=>u.uid===uid?{...u,approved:true}:u));
    }catch(e){console.error("approve error",e);}
    setSaving(null);
  }
  async function reject(uid){
    setSaving(uid);
    try{
      await _db.collection("users").doc(uid).delete();
      await _auth.currentUser; // no-op, just reference
      setUsers(prev=>prev.filter(u=>u.uid!==uid));
    }catch(e){console.error("reject error",e);}
    setSaving(null);
  }
  async function removeWorker(uid){
    const w=users.find(u=>(u.uid||u.id)===uid);
    if(!window.confirm(`Remove ${w?w.name:"this worker"}? They will lose access but their data stays intact.`)) return;
    setSaving(uid);
    try{
      // Soft-delete: mark removed instead of deleting the doc.
      // Hard-deleting the Firestore user doc causes farm data to appear
      // to clear because pollFarm/refresh() race with the deletion.
      // Soft-delete preserves all data attribution and lets admin restore later.
      await _db.collection("users").doc(uid).update({
        approved: false,
        removed: true,
        removedAt: new Date().toISOString()
      });
      _profileCache.delete(uid); // force fresh read on next login attempt
      setUsers(prev=>prev.map(u=>(u.uid||u.id)===uid?{...u,approved:false,removed:true}:u));
    }catch(e){console.error("remove error",e);}
    setSaving(null);
  }

  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
      <div style={S.h1}>Worker Management</div>
      <button onClick={refresh} disabled={refreshing} style={{
        padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",
        background:"rgba(22,163,74,.12)",color:C.accent,fontWeight:700,
        fontSize:12,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6
      }}>
        <span style={refreshing?{display:"inline-block",animation:"spin .8s linear infinite"}:{}}>🔄</span>
        {refreshing?"Checking…":"Refresh"}
      </button>
    </div>
    <div style={{...S.sub,marginBottom:14}}>{approved.length} active · {pending.length} pending · {lastCheck&&"Last checked: "+lastCheck}</div>
    {pending.length>0&&<div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:10}}>⏳ Pending Approval ({pending.length})</div>
      {pending.map(w=><div key={w.uid||w.id} style={{...S.row,background:"rgba(245,158,11,.05)"}}>
        <div><div style={{fontWeight:600}}>{w.name}</div><div style={{fontSize:11,color:C.faint}}>{w.email||w.username}</div></div>
        <div>
          <button style={S.btn("#166534")} disabled={saving===(w.uid||w.id)} onClick={()=>approve(w.uid||w.id)}>{saving===(w.uid||w.id)?"⏳":"✓ Approve"}</button>
          <button style={S.btn("#991b1b")} disabled={saving===(w.uid||w.id)} onClick={()=>reject(w.uid||w.id)}>{saving===(w.uid||w.id)?"⏳":"✗ Reject"}</button>
        </div>
      </div>)}
    </div>}
    {pending.length===0&&<div style={{...S.card,textAlign:"center",color:C.faint,fontSize:13}}>✅ No pending approvals.</div>}
    <div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>✅ Active Workers ({approved.length})</div>
      {approved.length===0&&<div style={{color:C.faint,fontSize:13}}>No workers yet.</div>}
      {approved.map(w=><div key={w.uid||w.id} style={S.row}>
        <div><div style={{fontWeight:600}}>{w.name}</div><div style={{fontSize:11,color:C.faint}}>{w.email||w.username}</div></div>
        <button style={{...S.btn(C.red),padding:"5px 11px",fontSize:11}} disabled={saving===(w.uid||w.id)} onClick={()=>removeWorker(w.uid||w.id)}>{saving===(w.uid||w.id)?"⏳":"Remove"}</button>
      </div>)}
    </div>
    {removed.length>0&&<div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:10}}>🚫 Removed Workers ({removed.length})</div>
      {removed.map(w=><div key={w.uid||w.id} style={{...S.row,opacity:.7}}>
        <div><div style={{fontWeight:600,color:C.muted}}>{w.name}</div><div style={{fontSize:11,color:C.faint}}>{w.email||w.username}</div></div>
        <button style={{...S.btn("#1d4ed8"),padding:"5px 11px",fontSize:11}} disabled={saving===(w.uid||w.id)} onClick={()=>restoreWorker(w.uid||w.id)}>{saving===(w.uid||w.id)?"⏳":"Restore"}</button>
      </div>)}
    </div>}
    {approved.length>0&&<WorkerTaskChart users={users} tasks={tasks}/>}
  </div>);
}

/* ─── Worker Views ─── */
function WHome({user,logs,feeds,sales,messages,assessments,pendingPigs,tasks,expenses}){
  const myId=user.uid||user.id;
  const ml=logs.filter(l=>l.workerId===myId||l.worker===user.name);
  const mf=feeds.filter(f=>f.workerId===myId||f.worker===user.name);
  const ms=sales.filter(s=>s.workerId===myId||s.worker===user.name);
  const myExp=(expenses||[]).filter(e=>e.workerId===myId||e.worker===user.name);
  const adminMessages=[...messages].reverse();
  const latest=adminMessages[0]||null;

  const myPendingLogs=ml.filter(l=>l.approved===false);
  const myPendingFeeds=mf.filter(f=>f.approved===false);
  const myPendingSales=ms.filter(s=>s.approved===false);
  const myPendingExp=myExp.filter(e=>e.approved===false);
  const myPendingAssessments=(assessments||[]).filter(a=>(a.workerId===myId||a.worker===user.name)&&a.approved===false);
  const myPendingPigs=(pendingPigs||[]).filter(p=>(p.submittedBy===myId||p.submittedByName===user.name)&&!p.approved&&!p.rejected);
  const totalPending=myPendingLogs.length+myPendingFeeds.length+myPendingSales.length+myPendingExp.length+myPendingAssessments.length+myPendingPigs.length;
  const myOverdueTasks=(tasks||[]).filter(t=>(t.workerId===myId||t.workerId===user.id)&&t.status==="pending"&&t.dueDate&&((new Date(t.dueDate)-new Date())/(1000*60*60*24))<0);
  const myDueTasks=(tasks||[]).filter(t=>(t.workerId===myId||t.workerId===user.id)&&t.status==="pending"&&t.dueDate&&((new Date(t.dueDate)-new Date())/(1000*60*60*24))>=0&&((new Date(t.dueDate)-new Date())/(1000*60*60*24))<=2);
  const todayDone=ml.some(l=>l.date===toDay());
  const myRevenue=ms.reduce((s,l)=>s+(l.total||0),0);

  // Monthly activity for worker sparkline (last 6 months)
  const actMap={};
  [...ml,...mf,...ms].forEach(x=>{const m=(x.date||"").slice(0,7);if(m){actMap[m]=(actMap[m]||0)+1;}});
  const actMonths=Object.entries(actMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const maxAct=Math.max(...actMonths.map(([,v])=>v),1);
  const MON_LBL_W=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return(<div className="fade-in">
    {/* Welcome header */}
    <div style={{background:"linear-gradient(135deg,#0c1f18 0%,#122d20 55%,#0e2218 100%)",borderRadius:14,padding:"20px 22px",marginBottom:16,position:"relative",overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,.18)"}}>
      <div style={{position:"absolute",top:-30,right:-20,width:120,height:120,background:"radial-gradient(circle,rgba(74,222,128,.12) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:46,height:46,borderRadius:13,background:"linear-gradient(135deg,rgba(74,222,128,.22),rgba(22,163,74,.12))",border:"1.5px solid rgba(74,222,128,.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👷</div>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:-.3}}>Welcome, {user.name}!</div>
          <div style={{fontSize:11,color:"rgba(74,222,128,.6)",marginTop:2}}>{toDay()} · FarmIQ Worker Portal</div>
        </div>
      </div>
    </div>

    {/* Latest admin message */}
    {latest&&<div style={{padding:"12px 14px",background:"rgba(22,163,74,.07)",border:"1px solid rgba(22,163,74,.28)",borderRadius:10,marginBottom:10,fontSize:13}}>
      <div style={{fontWeight:700,color:C.accent,marginBottom:3,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15}}>📢</span> From {latest.from}:</div>
      <div style={{color:C.text,lineHeight:1.6}}>{latest.text}</div>
      <div style={{fontSize:10,color:C.faint,marginTop:4}}>{latest.date}{latest.time?" · "+latest.time:""}</div>
    </div>}

    {/* Alerts */}
    {!todayDone&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,marginBottom:8,color:C.amber,fontSize:13,display:"flex",alignItems:"center",gap:8}}>
      <span>⚠️</span> You haven't submitted your daily report today.
    </div>}
    {myOverdueTasks.length>0&&<div style={{padding:"10px 14px",background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.25)",borderRadius:9,marginBottom:8,color:C.red,fontSize:13}}>
      🔴 {myOverdueTasks.length} overdue task{myOverdueTasks.length>1?"s":""} — please complete now.
    </div>}
    {myDueTasks.length>0&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,marginBottom:8,color:C.amber,fontSize:13}}>
      ⏰ {myDueTasks.length} task{myDueTasks.length>1?"s":""} due within 2 days.
    </div>}
    {totalPending>0&&<div style={{padding:"10px 14px",background:"rgba(37,99,235,.06)",border:"1px solid rgba(37,99,235,.2)",borderRadius:9,marginBottom:10,color:C.blue,fontSize:13}}>
      ⏳ {totalPending} submission{totalPending>1?"s":""} awaiting admin approval.
    </div>}

    {/* KPI tiles */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:11,marginBottom:14}}>
      {[
        {icon:"📝",label:"Daily Reports",value:ml.length,sub:todayDone?"✅ Done today":"⚠️ Due today",color:todayDone?C.accent:C.amber,bg:todayDone?"rgba(22,163,74,.07)":"rgba(245,158,11,.07)",border:todayDone?"rgba(22,163,74,.2)":"rgba(245,158,11,.2)"},
        {icon:"🌾",label:"Feeding Logs",value:mf.length,sub:"all time",color:C.amber,bg:"rgba(245,158,11,.06)",border:"rgba(245,158,11,.18)"},
        {icon:"🏷️",label:"Sales",value:ms.length,sub:fmtRWF(myRevenue),color:"#10b981",bg:"rgba(16,185,129,.06)",border:"rgba(16,185,129,.18)"},
        {icon:"✅",label:"Tasks Done",value:(tasks||[]).filter(t=>(t.workerId===myId||t.workerId===user.id)&&t.status==="done").length,sub:(tasks||[]).filter(t=>(t.workerId===myId||t.workerId===user.id)&&t.status==="pending").length+" pending",color:C.blue,bg:"rgba(37,99,235,.05)",border:"rgba(37,99,235,.15)"},
      ].map(k=>(
        <div key={k.label} style={{background:k.bg,border:"1px solid "+k.border,borderRadius:12,padding:"13px 13px 11px",boxShadow:"0 1px 5px rgba(0,0,0,.04)"}}>
          <div style={{fontSize:18,marginBottom:6}}>{k.icon}</div>
          <div style={{fontSize:9,color:C.faint,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{k.label}</div>
          <div style={{fontSize:22,fontWeight:800,color:k.color,lineHeight:1.1,marginBottom:3}}>{k.value}</div>
          <div style={{fontSize:10,color:C.faint}}>{k.sub}</div>
        </div>
      ))}
    </div>

    {/* Activity sparkline (last 6 months) */}
    {actMonths.length>1&&<div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>📊 My Activity — Last {actMonths.length} Months</div>
      <div style={{display:"flex",gap:5,alignItems:"flex-end",height:60,paddingBottom:16,position:"relative"}}>
        {actMonths.map(([m,v])=>{
          const h=Math.max(Math.round((v/maxAct)*50),3);
          const lbl=MON_LBL_W[parseInt(m.split("-")[1])-1];
          return(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{fontSize:9,color:C.accent,fontWeight:700}}>{v}</div>
            <div style={{width:"70%",height:h,background:"linear-gradient(180deg,#4ade80,#16a34a)",borderRadius:"3px 3px 0 0",transition:"height .5s cubic-bezier(.22,1,.36,1)"}}/>
            <div style={{fontSize:9,color:C.faint,position:"absolute",bottom:2}}>{lbl}</div>
          </div>);
        })}
      </div>
    </div>}
  </div>);
}

function WorkerInbox({messages,setMessages,user}){
  const [checking,setChecking]=React.useState(false);
  const [lastCheck,setLastCheck]=React.useState("");
  const [newCount,setNewCount]=React.useState(0);
  const [search,setSearch]=React.useState("");
  const [filter,setFilter]=React.useState("all"); // "all"|"today"|"week"
  const [expanded,setExpanded]=React.useState(null);
  const prevLen=React.useRef(messages.length);
  const bottomRef=React.useRef(null);
  const [readIds,setReadIds]=React.useState(()=>{
    try{return new Set(JSON.parse(localStorage.getItem("farmiq_read_msgs")||"[]"));}catch{return new Set();}
  });

  function markRead(id){
    setReadIds(prev=>{
      const next=new Set(prev);next.add(id);
      try{localStorage.setItem("farmiq_read_msgs",JSON.stringify([...next]));}catch(e){}
      return next;
    });
  }

  useEffect(()=>{
    let active=true;
    async function poll(){
      setChecking(true);
      try{
        const farm=await getOnlineFarmData();
        if(farm&&Array.isArray(farm.messages)&&active){
          const fresh=farm.messages;
          if(fresh.length>prevLen.current){
            setNewCount(fresh.length-prevLen.current);
            setTimeout(()=>setNewCount(0),5000);
          }
          prevLen.current=fresh.length;
          if(setMessages) setMessages(fresh);
          setLastCheck(new Date().toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"}));
        }
      }catch(e){}
      if(active) setChecking(false);
    }
    poll();
    const t=setInterval(poll,4000);
    return()=>{active=false;clearInterval(t);};
  },[]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(()=>{
    if(bottomRef.current) bottomRef.current.scrollIntoView({behavior:"smooth"});
  },[messages.length]);

  const today=toDay();
  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const weekStr=weekAgo.toISOString().slice(0,10);

  let filtered=messages.slice();
  if(filter==="today") filtered=filtered.filter(m=>m.date===today);
  if(filter==="week") filtered=filtered.filter(m=>m.date>=weekStr);
  if(search.trim()) filtered=filtered.filter(m=>(m.text+m.from).toLowerCase().includes(search.trim().toLowerCase()));
  filtered=filtered.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  const unread=messages.filter(m=>!readIds.has(m.id||String(m.date+m.time)));
  const unreadCount=unread.length;

  // Group messages by date
  const grouped={};
  filtered.forEach(m=>{
    const d=m.date||"Unknown";
    if(!grouped[d]) grouped[d]=[];
    grouped[d].push(m);
  });

  function dateLbl(d){
    if(d===today) return "Today";
    const yest=new Date();yest.setDate(yest.getDate()-1);
    if(d===yest.toISOString().slice(0,10)) return "Yesterday";
    return new Date(d).toLocaleDateString("en-RW",{weekday:"short",day:"numeric",month:"short"});
  }

  return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)",maxHeight:760}}>
    {/* Header */}
    <div style={{marginBottom:10,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
        <div style={S.h1}>💬 Message History</div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          {unreadCount>0&&<span style={{padding:"2px 9px",borderRadius:10,background:"rgba(239,68,68,.12)",color:C.red,fontWeight:700,fontSize:11}}>{unreadCount} unread</span>}
          {checking&&<span style={{fontSize:11,color:C.faint,display:"flex",alignItems:"center",gap:4}}>
            <span className="spin" style={{width:10,height:10,border:"2px solid #cbd5e1",borderTop:"2px solid #16a34a",borderRadius:"50%",display:"inline-block"}}/>Live
          </span>}
          {lastCheck&&!checking&&<span style={{fontSize:10,color:C.faint}}>✓ {lastCheck}</span>}
        </div>
      </div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{messages.length} message{messages.length!==1?"s":""} from admin · Auto-refreshes every 8s</div>

      {/* New message banner */}
      {newCount>0&&<div className="slide-up" style={{padding:"9px 14px",background:"linear-gradient(135deg,rgba(22,163,74,.15),rgba(16,185,129,.08))",border:"1px solid rgba(22,163,74,.4)",borderRadius:9,marginBottom:10,fontSize:13,color:"#16a34a",fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>🔔</span> {newCount} new message{newCount>1?"s":""} just arrived!
      </div>}

      {/* Search + Filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:160,position:"relative"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.faint,pointerEvents:"none"}}>🔍</span>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search messages…"
            style={{...S.inp,paddingLeft:30,fontSize:12}}
          />
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {[["all","All"],["today","Today"],["week","This Week"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{
              padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",
              fontFamily:"inherit",fontWeight:700,fontSize:11,
              background:filter===v?"linear-gradient(135deg,#16a34a,#10b981)":"rgba(22,163,74,.08)",
              color:filter===v?"#fff":"#16a34a"
            }}>{l}</button>
          ))}
        </div>
      </div>
    </div>

    {/* Chat history area */}
    <div style={{flex:1,overflowY:"auto",background:"#f0f4f8",borderRadius:12,padding:"12px 10px",border:"1px solid #e2e8f0"}}>
      {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.faint}}>
        <div style={{fontSize:32,marginBottom:10}}>📭</div>
        <div style={{fontWeight:600,marginBottom:4}}>{search?"No messages match your search":"No messages yet"}</div>
        <div style={{fontSize:12}}>{search?"Try a different keyword":"Admin hasn't sent any messages"}</div>
      </div>}

      {Object.entries(grouped).map(([date,msgs])=>(
        <div key={date}>
          {/* Date divider */}
          <div style={{display:"flex",alignItems:"center",gap:10,margin:"10px 0"}}>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
            <span style={{fontSize:10,color:C.faint,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap",padding:"2px 10px",background:"#e8edf5",borderRadius:10}}>{dateLbl(date)}</span>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
          </div>

          {msgs.map((m,i)=>{
            const msgId=m.id||String(m.date+m.time);
            const isUnread=!readIds.has(msgId);
            const isExpanded=expanded===msgId;
            const isAI=m.aiGenerated;
            const isWelcome=m.welcome||m.system;
            return(
              <div key={msgId} style={{marginBottom:10,display:"flex",flexDirection:"column",alignItems:"flex-start"}}>
                {/* Bubble */}
                <div
                  onClick={()=>{setExpanded(isExpanded?null:msgId);markRead(msgId);}}
                  style={{
                    maxWidth:"88%",cursor:"pointer",
                    background:isWelcome?"linear-gradient(135deg,#fffbeb,#fef3c7)":isUnread?"linear-gradient(135deg,#ffffff,#f0fdf4)":"#ffffff",
                    border:isWelcome?"1px solid rgba(245,158,11,.45)":isUnread?"1px solid rgba(22,163,74,.4)":"1px solid #e2e8f0",
                    borderRadius:"4px 16px 16px 16px",
                    padding:"10px 14px",
                    boxShadow:isWelcome?"0 2px 12px rgba(245,158,11,.15)":isUnread?"0 2px 10px rgba(22,163,74,.12)":"0 1px 4px rgba(0,0,0,.06)",
                    position:"relative",
                    transition:"box-shadow .2s"
                  }}
                >
                  {/* Sender row */}
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,flexWrap:"wrap"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:isWelcome?"linear-gradient(135deg,#f59e0b,#fbbf24)":"linear-gradient(135deg,#16a34a,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:isWelcome?15:12,fontWeight:700,flexShrink:0}}>
                      {isWelcome?"🌱":"A"}
                    </div>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:isWelcome?"#d97706":"#16a34a"}}>{m.from||"Admin"}</div>
                      <div style={{fontSize:10,color:C.faint}}>{m.date} · {m.time||""}</div>
                    </div>
                    {isWelcome&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:6,background:"rgba(245,158,11,.12)",color:"#d97706",fontWeight:700}}>👋 Welcome</span>}
                    {isAI&&!isWelcome&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:6,background:"rgba(124,58,237,.1)",color:"#7c3aed",fontWeight:700}}>❆ AI</span>}
                    {isUnread&&<span style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",background:isWelcome?"#f59e0b":"#16a34a",flexShrink:0,boxShadow:"0 0 0 2px rgba(245,158,11,.2)"}}/>}
                  </div>
                  {/* Message text */}
                  <div style={{fontSize:13,color:C.text,lineHeight:1.75,whiteSpace:"pre-wrap",
                    ...(isExpanded?{}:{
                      overflow:"hidden",
                      display:"-webkit-box",
                      WebkitLineClamp:3,
                      WebkitBoxOrient:"vertical"
                    })
                  }}>{m.text}</div>
                  {m.text&&m.text.length>160&&<div style={{fontSize:10,color:"#16a34a",marginTop:4,fontWeight:600}}>{isExpanded?"▲ Show less":"▼ Read more"}</div>}
                  {m.waDelivered&&<div style={{fontSize:10,color:"#128C7E",marginTop:5}}>📱 Also sent via WhatsApp</div>}
                  {m.recipients>0&&<div style={{fontSize:10,color:C.faint,marginTop:3}}>📬 Sent to {m.recipients} worker(s)</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div ref={bottomRef}/>
    </div>

    {/* Footer stats */}
    <div style={{flexShrink:0,marginTop:10,display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:C.faint}}>
      <span>📨 {messages.length} total</span>
      <span>📅 {messages.filter(m=>m.date===today).length} today</span>
      <span>✅ {messages.length-unreadCount} read</span>
      {unreadCount>0&&<span style={{color:C.red,fontWeight:700}}>● {unreadCount} unread</span>}
    </div>
  </div>);
}



/* ─── Toast Notification ─── */
function Toast({message,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,3200);return()=>clearTimeout(t);},[onClose]);
  const bg=type==="success"?"#16a34a":type==="error"?"#dc2626":"#f59e0b";
  const icon=type==="success"?"✅":type==="error"?"❌":"⚠️";
  return(
    <div className="fade-in" style={{
      position:"fixed",bottom:24,right:24,zIndex:9999,
      background:bg,color:"#fff",
      padding:"13px 18px",borderRadius:12,
      display:"flex",alignItems:"center",gap:10,
      boxShadow:"0 8px 30px rgba(0,0,0,.18)",
      fontSize:14,fontWeight:600,maxWidth:320,
      animation:"fadeIn .3s ease both"
    }}>
      <span style={{fontSize:18}}>{icon}</span>
      <span>{message}</span>
      <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"rgba(255,255,255,.8)",cursor:"pointer",fontSize:18,lineHeight:1,padding:0}}>×</button>
    </div>
  );
}

/* ─── Undo Toast ─── */
function UndoToast({label,onUndo,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,5500);return()=>clearTimeout(t);},[onClose]);
  return(
    <div className="fade-in" style={{
      position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:10000,
      background:"linear-gradient(135deg,#141f14,#1a2e1a)",color:"#fff",
      padding:"12px 20px",borderRadius:16,
      display:"flex",alignItems:"center",gap:12,
      boxShadow:"0 12px 40px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.18)",
      border:"1px solid rgba(74,222,128,.15)",
      fontSize:13,fontWeight:500,minWidth:260,maxWidth:400
    }}>
      <span style={{flex:1}}>🗑️ {label} deleted</span>
      <button onClick={()=>{onUndo();onClose();}} style={{
        padding:"6px 16px",borderRadius:9,border:"none",
        background:"#16a34a",color:"#fff",fontWeight:700,fontSize:12,
        cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"
      }}>↩ Undo</button>
      <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
    </div>
  );
}

/* ─── Confirm Dialog ─── */
function ConfirmDialog({title,body,onConfirm,onCancel}){
  return(
    <div style={{
      position:"fixed",inset:0,zIndex:9998,
      background:"rgba(0,0,0,.45)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:16
    }}>
      <div className="fade-in" style={{
        background:"#fff",borderRadius:16,padding:24,
        maxWidth:360,width:"100%",
        boxShadow:"0 20px 60px rgba(0,0,0,.22)"
      }}>
        <div style={{fontSize:20,marginBottom:6,fontWeight:700,color:"#1e293b"}}>{title}</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.6}}>{body}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"10px 0",borderRadius:9,border:"1px solid #cbd5e1",background:"#f8fafc",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"10px 0",borderRadius:9,border:"none",background:"#16a34a",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Yes, Save</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   WORKER PIG REGISTRATION — workers submit, admin approves
═══════════════════════════════════════════════════ */
function WorkerPigEntry({user,pigs,setPigs,pendingPigs,setPendingPigs}){
  const BREEDS=["Landrace","Large White","Duroc","Hampshire","Mixed/Local"];
  const STAGES=["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];
  const isAdmin=isAdminUser(user);

  function makeBlank(){
    const breed="Landrace",stage="Piglet";
    return{breed,stage,gender:"Female",weight:"",length:"",dob:"",arrivalDate:toDay(),source:"",batchName:"",purchasePrice:"",notes:""};
  }
  const [form,setForm]=useState(makeBlank());
  const [submitted,setSubmitted]=useState(false);
  const [tab,setTab]=useState("form");

  const myPending=(pendingPigs||[]).filter(p=>p.submittedBy===user.id).slice().reverse();

  function updateBreedOrStage(field,val){
    setForm(f=>{
      const newBreed=field==="breed"?val:f.breed;
      const newStage=field==="stage"?val:f.stage;
      // Generate preview tag based on all pigs plus already-submitted pending
      const allForCount=[...pigs,...(pendingPigs||[])];
      return{...f,[field]:val,tag:genPigTag(newBreed,newStage,allForCount)};
    });
  }

  // Generate initial tag on first render
  useEffect(()=>{
    setForm(f=>({...f,tag:genPigTag(f.breed,f.stage,[...pigs,...(pendingPigs||[])])}));
  },[]);

  async function submit(){
    const allForCount=[...pigs,...(pendingPigs||[])];
    const tag=form.tag||genPigTag(form.breed,form.stage,allForCount);
    const newEntry={
      ...form,tag,
      id:uid(),
      submittedBy:user.id,
      submittedByName:user.name,
      submittedAt:new Date().toISOString(),
      approved:false,
      weight:parseFloat(form.weight)||0,
      length:parseFloat(form.length)||null,
    };
    const updated=[...(pendingPigs||[]),newEntry];
    setPendingPigs(updated);
    fsSet("pendingPigs",updated);
    try{await jbinAppend("pendingPigs",newEntry);}catch(e){console.error(e);}
    setForm(makeBlank());
    setSubmitted(true);
    setTimeout(()=>setSubmitted(false),3000);
    setTab("history");
  }

  const statusColor={pending:C.amber,approved:C.accent,rejected:C.red};
  const statusBg={pending:"rgba(245,158,11,.1)",approved:"rgba(22,163,74,.1)",rejected:"rgba(239,68,68,.08)"};
  const statusLabel={pending:"⏳ Pending",approved:"✅ Approved",rejected:"✗ Rejected"};

  return(<div style={{maxWidth:520}}>
    <div style={S.h1}>🐷 Register Pig</div>
    <div style={S.sub}>Submit pig details · Admin will approve and add to herd</div>

    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["form","➕ New Registration"],["history","📋 My Submissions"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="form"&&(<div>
      {submitted&&<div style={{padding:"10px 14px",background:C.accentSoft,border:"1px solid rgba(22,163,74,.3)",borderRadius:9,marginBottom:14,color:C.accent,fontWeight:600}}>✅ Submitted! Awaiting admin approval.</div>}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:12}}>🐷 Pig Details</div>

        {/* Tag preview banner */}
        <div style={{padding:"10px 14px",background:"rgba(22,163,74,.06)",border:"1px solid rgba(22,163,74,.2)",borderRadius:9,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div>
            <div style={{fontSize:9,color:C.faint,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Auto-Generated Pig Code</div>
            <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:C.accent,letterSpacing:1}}>{form.tag||"—"}</div>
            <div style={{fontSize:10,color:C.faint,marginTop:2}}>Breed · Stage · YYMM · Sequence</div>
          </div>
          <button onClick={()=>setForm(f=>({...f,tag:genPigTag(f.breed,f.stage,[...pigs,...(pendingPigs||[])])}))} style={{padding:"6px 10px",borderRadius:7,border:"1px solid rgba(22,163,74,.35)",background:"rgba(22,163,74,.06)",color:C.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🔄 Regen</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:12}}>
          <div>
            <label style={S.lbl}>Breed</label>
            <select value={form.breed} onChange={e=>updateBreedOrStage("breed",e.target.value)} style={S.inp}>
              {BREEDS.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Stage</label>
            <select value={form.stage} onChange={e=>updateBreedOrStage("stage",e.target.value)} style={S.inp}>
              {STAGES.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Gender</label>
            <select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} style={S.inp}>
              <option>Female</option><option>Male</option>
            </select>
          </div>
          <div>
            <label style={S.lbl}>Weight (kg)</label>
            <input type="number" step="0.1" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})} style={S.inp} placeholder="e.g. 25"/>
          </div>
          <div>
            <label style={S.lbl}>Length (cm)</label>
            <input type="number" step="0.5" value={form.length} onChange={e=>setForm({...form,length:e.target.value})} style={S.inp} placeholder="e.g. 70"/>
          </div>
          <div>
            <label style={S.lbl}>Date of Birth</label>
            <input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} style={S.inp}/>
          </div>
          <div>
            <label style={S.lbl}>Arrival Date</label>
            <input type="date" value={form.arrivalDate} onChange={e=>setForm({...form,arrivalDate:e.target.value})} style={S.inp}/>
          </div>
          <div>
            <label style={S.lbl}>Source Farm / Supplier</label>
            <input placeholder="e.g. Musanze Farm" value={form.source} onChange={e=>setForm({...form,source:e.target.value})} style={S.inp}/>
          </div>
          <div>
            <label style={S.lbl}>Purchase Price (RWF)</label>
            <input type="number" placeholder="e.g. 35000" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Notes / Observations</label>
            <textarea rows={2} placeholder="Any notes about this pig..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{...S.inp,resize:"vertical"}}/>
          </div>
        </div>
        <button onClick={submit} style={{...S.btn(),width:"100%",padding:12,fontSize:14}}>
          📤 Submit for Admin Approval →
        </button>
        <div style={{fontSize:11,color:C.faint,marginTop:8,textAlign:"center"}}>Your submission will be reviewed before the pig is added to the herd.</div>
      </div>
    </div>)}

    {tab==="history"&&(<div>
      {myPending.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:8}}>🐷</div>No submissions yet.
      </div>}
      {myPending.map((p,i)=>{
        const st=p.approved===true?"approved":p.approved===false&&p.rejected?"rejected":"pending";
        return(<div key={i} style={{...S.card,marginBottom:10,borderLeft:"3px solid "+(statusColor[st]||C.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,fontFamily:"monospace",color:C.text}}>{p.tag}</div>
              <div style={{fontSize:11,color:C.faint}}>{p.breed} · {p.stage} · {p.gender} · {p.weight||0}kg</div>
            </div>
            <span style={{padding:"2px 9px",borderRadius:20,background:statusBg[st],color:statusColor[st],fontSize:11,fontWeight:700}}>{statusLabel[st]||"⏳ Pending"}</span>
          </div>
          <div style={{fontSize:11,color:C.faint}}>Submitted: {(p.submittedAt||"").slice(0,10)}</div>
          {p.adminNote&&<div style={{marginTop:6,fontSize:12,color:C.blue,padding:"5px 9px",background:"rgba(96,165,250,.07)",borderRadius:6}}>💬 Admin: {p.adminNote}</div>}
        </div>);
      })}
    </div>)}
  </div>);
}

function DEntry({user,pigs,logs,setLogs,capital,setCapital}){
  const active=pigs.filter(p=>p.status==="active");
  const [form,setForm]=useState({checked:active.length,sick:0,deaths:0,births:0,water:true,cleaned:true,notes:"",deathLossAmount:""});
  const [done,setDone]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState("form");
  const closeToast=useCallback(()=>setToast(null),[]);

  // My past submissions
  const myLogs=logs.filter(l=>l.workerId===user.id).slice().reverse().slice(0,10);
  const todayDone=logs.some(l=>l.workerId===user.id&&l.date===toDay());

  async function doSave(){
    if(saving) return;
    setSaving(true);
    setConfirm(false);
    const isAdmin=isAdminUser(user);
    const newLog={...form,id:uid(),workerId:user.uid||user.id,worker:user.name,date:toDay(),approved:isAdmin?true:false};
    if(isAdmin&&setCapital&&form.deaths>0&&parseFloat(form.deathLossAmount)>0){
      capitalTx(capital,setCapital,{type:"expense",category:"Pig Death Loss",amount:parseFloat(form.deathLossAmount),description:`${form.deaths} pig(s) died — entered by ${user.name}`,date:toDay()});
    }
    try{
      await jbinAppend("logs",newLog);
      setLogs(p=>[...p.filter(x=>x.id!==newLog.id),newLog]);
      setToast({type:"success",message:isAdmin?"✅ Daily report saved!":"✅ Report submitted! Awaiting admin approval."});
      // Auto WhatsApp alert for sick pigs or deaths
      if(isAdmin){
        const waPrefs=getWAAlertPrefs();
        if(form.sick>0&&waPrefs.onSickPig){
          sendWhatsApp(`🚨 FarmIQ Alert — ${toDay()}\n🏥 ${form.sick} sick pig(s) reported by ${user.name}.\nCheck health logs immediately.`);
        }
        if(form.deaths>0&&waPrefs.onDeath){
          sendWhatsApp(`💀 FarmIQ Alert — ${toDay()}\n${form.deaths} pig death(s) recorded by ${user.name}.${form.deathLossAmount?"\nLoss: RWF "+parseInt(form.deathLossAmount).toLocaleString():""}\nReview cause urgently.`);
        }
      }
      setTimeout(()=>setDone(true),1600);
    }catch(e){setToast({type:"error",message:"Failed to save. Check internet and try again."});}
    setSaving(false);
  }

  if((!user||user.role!=="admin")&&(todayDone||done))return(<div style={{textAlign:"center",padding:60}}>
    <div style={{fontSize:48}}>✅</div>
    <div style={{fontSize:19,fontWeight:700,color:C.accent,marginTop:14}}>Report submitted!</div>
    <div style={{fontSize:13,color:C.faint,marginTop:6}}>Come back tomorrow.</div>
    {myLogs.length>0&&<div style={{marginTop:24,textAlign:"left",maxWidth:400,margin:"24px auto 0"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📋 My Recent Reports</div>
      {myLogs.slice(0,5).map((l,i)=>(
        <div key={i} style={{...S.card,padding:"10px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontWeight:600,fontSize:13}}>{l.date}</span>
            <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:l.approved===false?"rgba(245,158,11,.12)":"rgba(22,163,74,.1)",color:l.approved===false?C.amber:C.accent,fontWeight:700}}>{l.approved===false?"⏳ Pending":"✅ Approved"}</span>
          </div>
          <div style={{fontSize:11,color:C.faint,marginTop:4}}>Checked: {l.checked} · Sick: {l.sick} · Deaths: {l.deaths}</div>
        </div>
      ))}
    </div>}
  </div>);

  return(<div style={{maxWidth:490}}>
    {confirm&&<ConfirmDialog title="Submit Daily Report?" body={`Checked: ${form.checked} pigs · Sick: ${form.sick} · Deaths: ${form.deaths} · Births: ${form.births}${form.deaths>0&&form.deathLossAmount?" · Loss: RWF "+parseInt(form.deathLossAmount).toLocaleString():""}. Are you sure you want to submit this report for ${toDay()}?`} onConfirm={doSave} onCancel={()=>setConfirm(false)}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={closeToast}/>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["form","📝 Today's Report"],["history","📋 My Submissions"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="history"&&(<div>
      {myLogs.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:30}}>No submissions yet.</div>}
      {myLogs.map((l,i)=>(
        <div key={i} style={{...S.card,marginBottom:10,borderLeft:"3px solid "+(l.approved===false?C.amber:C.accent)}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13}}>{l.date}</span>
            <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:l.approved===false?"rgba(245,158,11,.12)":"rgba(22,163,74,.1)",color:l.approved===false?C.amber:C.accent,fontWeight:700}}>{l.approved===false?"⏳ Pending approval":"✅ Approved"}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,fontSize:11}}>
            {[["Checked",l.checked],["Sick",l.sick],["Deaths",l.deaths],["Births",l.births],["Water",l.water?"✓":"✗"],["Cleaned",l.cleaned?"✓":"✗"]].map(([lbl,v])=>(
              <div key={lbl} style={{background:C.elevated,borderRadius:5,padding:"4px 7px"}}>
                <div style={{color:C.faint,fontSize:9}}>{lbl}</div>
                <div style={{color:(lbl==="Sick"||lbl==="Deaths")&&v>0?C.red:C.text,marginTop:1}}>{v}</div>
              </div>
            ))}
          </div>
          {l.notes&&<div style={{fontSize:11,color:C.faint,marginTop:6,fontStyle:"italic"}}>"{l.notes}"</div>}
        </div>
      ))}
    </div>)}

    {tab==="form"&&(<div>
    <div style={S.h1}>📝 Daily Report — {toDay()}</div>
    <div style={S.card}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      {[["checked","Pigs Checked"],["sick","Sick Pigs"],["deaths","Deaths"],["births","New Births"]].map(([k,l])=>(
        <div key={k}><label style={S.lbl}>{l}</label><input type="number" min="0" value={form[k]} onChange={e=>setForm({...form,[k]:parseInt(e.target.value)||0})} style={S.inp}/></div>
      ))}
      {[["water","Water OK?"],["cleaned","Pen Cleaned?"]].map(([k,l])=>(
        <div key={k}><label style={S.lbl}>{l}</label><select value={form[k]?"yes":"no"} onChange={e=>setForm({...form,[k]:e.target.value==="yes"})} style={S.inp}><option value="yes">Yes ✓</option><option value="no">No ✗</option></select></div>
      ))}
    </div>
    {form.deaths>0&&<div style={{marginBottom:12,padding:"10px 13px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9}}>
      <label style={{...S.lbl,color:C.red}}>💀 Capital Loss from {form.deaths} Death(s) (RWF)</label>
      <input type="number" min="0" placeholder="Enter total loss amount in RWF" value={form.deathLossAmount} onChange={e=>setForm({...form,deathLossAmount:e.target.value})} style={S.inp}/>
      <div style={{fontSize:10,color:C.faint,marginTop:4}}>This amount will be deducted from business capital.</div>
    </div>}
    <div style={{marginBottom:12}}><label style={S.lbl}>Notes</label><textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any observations, sick pig details, unusual events…" style={{...S.inp,resize:"vertical"}}/></div>
    <button style={{...S.btn(),width:"100%",padding:12,fontSize:14,opacity:saving?0.6:1}} onClick={()=>!saving&&setConfirm(true)} disabled={saving}>{saving?"⏳ Submitting…":"Submit Report →"}</button>
    {user.role!=="admin"&&<div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center",padding:"7px",background:"rgba(245,158,11,.06)",borderRadius:6,border:"1px solid rgba(245,158,11,.2)"}}>⏳ Pending admin approval before it counts in records</div>}
  </div></div>)}
  </div>);
}

function FEntry({user,pigs,feeds,setFeeds,capital,setCapital,tasks,setTasks}){
  // Reference prices (RWF/kg) for auto-cost calculation
  const FEED_PRICE_REF={"Maize bran":350,"Soya meal":800,"Pellets":950,"Kitchen waste":0,"Mixed":500,"Other":400};
  const STAGE_FEED={Piglet:0.5,Weaner:1.0,Grower:1.8,Finisher:2.8,Gilt:2.2,Sow:2.5,Boar:2.0};

  const [form,setForm]=useState({pigId:"",feedType:"Maize bran",kg:"",costPerKg:"",notes:""});
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [toast,setToast]=useState(null);
  const closeToast=useCallback(()=>setToast(null),[]);
  const active=pigs.filter(p=>p.status==="active");

  // Auto-fill costPerKg from reference when feed type changes
  function updateForm(patch){
    const updated={...form,...patch};
    if(patch.feedType){
      const ref=FEED_PRICE_REF[updated.feedType]||0;
      if(ref>0) updated.costPerKg=String(ref);
    }
    setForm(updated);
  }

  // Computed values
  const kg=parseFloat(form.kg)||0;
  const costPerKg=parseFloat(form.costPerKg)||0;
  const totalCost=kg>0&&costPerKg>0?Math.round(kg*costPerKg):0;
  const refCpk=FEED_PRICE_REF[form.feedType]||0;
  const cpkWarning=costPerKg>0&&refCpk>0&&costPerKg>refCpk*1.3?"⚠️ Price seems high":costPerKg>0&&refCpk>0&&costPerKg<refCpk*0.5?"ℹ️ Price seems low":"";

  const selPig=active.find(p=>p.id===form.pigId);
  const suggestedKg=selPig?(STAGE_FEED[selPig.stage]||2.0):null;

  const histFeeds=feeds.filter(f=>f.feedType===form.feedType&&f.kg>0&&f.cost>0);
  const histAvgCpk=histFeeds.length>0?Math.round(histFeeds.reduce((s,f)=>s+(f.kg>0?f.cost/f.kg:0),0)/histFeeds.length):null;

  async function doSave(){
    if(saving) return;
    setSaving(true);
    setConfirm(false);
    if(!kg||kg<=0||!costPerKg||costPerKg<=0){
      setToast({type:"error",message:"Please enter valid kg and cost per kg values."});
      return;
    }
    const isAdmin=isAdminUser(user);
    const costVal=totalCost;
    const newFeed={...form,id:uid(),workerId:user.uid||user.id,worker:user.name,date:toDay(),kg,cost:costVal,costPerKg,approved:isAdmin?true:false};
    // Only record capital if admin-entered (approved immediately)
    if(isAdmin&&setCapital) capitalTx(capital,setCapital,{type:"expense",category:"Feed Purchase",amount:costVal,description:`${kg}kg ${form.feedType}${selPig?" for "+selPig.tag:""}`,date:toDay()});
    try{
      await jbinAppend("feeds",newFeed);
      setFeeds(p=>[...p.filter(x=>x.id!==newFeed.id),newFeed]);
      // ─── Auto-mark today's feeding tasks as done for this worker ───
      if(tasks&&setTasks){
        const today=toDay();
        let taskChanged=false;
        const updatedTasks=tasks.map(t=>{
          if(t.autoFeed&&t.workerId===user.id&&t.due===today&&t.status==="pending"){
            taskChanged=true;
            return{...t,status:"done",autoCompletedAt:new Date().toISOString()};
          }
          return t;
        });
        if(taskChanged){setTasks(updatedTasks);fsSet("tasks",updatedTasks);}
      }
      setToast({type:"success",message:isAdmin?`✅ ${kg}kg of ${form.feedType} saved · RWF ${costVal.toLocaleString()}`:`✅ Feed log submitted! Awaiting admin approval.`});
      setSaved(true);
      setTimeout(()=>{setSaved(false);setForm({pigId:"",feedType:"Maize bran",kg:"",costPerKg:"",notes:""});},2200);
    }catch(e){setToast({type:"error",message:"Failed to save. Check internet and try again."});}
    setSaving(false);
  }
  function trySubmit(){
    if(saving||!form.kg||!form.costPerKg||parseFloat(form.kg)<=0||parseFloat(form.costPerKg)<=0)return;
    setConfirm(true);
  }

  return(<div style={{maxWidth:520}}>
    {confirm&&<ConfirmDialog
      title="Save Feeding Log?"
      body={`${kg}kg of ${form.feedType} · RWF ${costPerKg}/kg · Total: RWF ${totalCost.toLocaleString()}${selPig?" · 🐷 "+selPig.tag:" · All pigs"}. Confirm?`}
      onConfirm={doSave} onCancel={()=>setConfirm(false)}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={closeToast}/>}
    <div style={S.h1}>🌾 Log Feeding</div>
    {saved&&<div style={{padding:10,background:C.accentSoft,borderRadius:7,marginBottom:12,color:C.accent,fontSize:13}}>✓ Saved!</div>}
    <div style={S.card}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={S.lbl}>Pig (or All)</label>
          <select value={form.pigId} onChange={e=>setForm({...form,pigId:e.target.value})} style={S.inp}>
            <option value="">All pigs</option>
            {active.map(p=><option key={p.id} value={p.id}>{p.tag} — {p.stage} ({STAGE_FEED[p.stage]||2}kg/day)</option>)}
          </select>
          {selPig&&<div style={{fontSize:10,color:C.accent,marginTop:3}}>📊 Suggested: {suggestedKg}kg/day for {selPig.stage}</div>}
        </div>
        <div>
          <label style={S.lbl}>Feed Type</label>
          <select value={form.feedType} onChange={e=>updateForm({feedType:e.target.value})} style={S.inp}>
            {["Maize bran","Soya meal","Pellets","Kitchen waste","Mixed","Other"].map(f=><option key={f}>{f}</option>)}
          </select>
          {refCpk>0&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>Ref price: ~RWF {refCpk}/kg</div>}
          {histAvgCpk&&<div style={{fontSize:10,color:C.blue,marginTop:1}}>Your avg: RWF {histAvgCpk}/kg ({histFeeds.length} logs)</div>}
        </div>
        {/* KG amount */}
        <div>
          <label style={S.lbl}>Amount (kg) *</label>
          <input type="number" min="0" step="0.1" placeholder={suggestedKg||"15"} value={form.kg}
            onChange={e=>setForm({...form,kg:e.target.value})} style={S.inp}/>
          {suggestedKg&&form.kg&&Math.abs(parseFloat(form.kg)-suggestedKg)>suggestedKg*0.5&&(
            <div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠️ Significantly different from suggested {suggestedKg}kg</div>
          )}
        </div>
        {/* Cost per kg */}
        <div>
          <label style={S.lbl}>Cost per kg (RWF) *</label>
          <input type="number" min="0" placeholder={refCpk||"350"} value={form.costPerKg}
            onChange={e=>setForm({...form,costPerKg:e.target.value})} style={S.inp}/>
          {cpkWarning&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>{cpkWarning}</div>}
        </div>
      </div>

      {/* Live total preview */}
      {kg>0&&costPerKg>0&&<div style={{padding:"10px 14px",background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.18)",borderRadius:9,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:C.text}}>
          <span style={{color:C.muted}}>Cost per kg: </span>
          <strong style={{color:C.accent,fontSize:14}}>RWF {fmtNum(costPerKg)}/kg</strong>
        </div>
        <div style={{fontSize:12,color:C.muted}}>
          Total: <strong style={{color:C.amber,fontSize:14}}>RWF {fmtNum(totalCost)}</strong> for {kg}kg
        </div>
      </div>}

      <div style={{marginBottom:12}}>
        <label style={S.lbl}>Notes</label>
        <input placeholder="e.g. morning feed, pig seemed healthy, mixed with water..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={S.inp}/>
      </div>
      <button
        disabled={saving||!form.kg||!form.costPerKg||parseFloat(form.kg)<=0||parseFloat(form.costPerKg)<=0}
        style={{...S.btn(C.amber),color:"#fff",width:"100%",padding:12,fontSize:14,opacity:(saving||!form.kg||!form.costPerKg)?0.5:1}}
        onClick={trySubmit}>
        {saving?"⏳ Saving…":"💾 Save Feeding Log →"}
      </button>
      {(!form.kg||!form.costPerKg)&&<div style={{fontSize:11,color:C.faint,marginTop:7,textAlign:"center"}}>Enter kg and cost per kg to save</div>}
      {user.role!=="admin"&&<div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center",padding:"7px",background:"rgba(245,158,11,.06)",borderRadius:6,border:"1px solid rgba(245,158,11,.2)"}}>⏳ Pending admin approval before it counts in records</div>}
    </div>

    {/* My recent feed logs */}
    {feeds.filter(f=>f.workerId===user.id).length>0&&<div style={{marginTop:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📋 My Recent Feed Logs</div>
      {feeds.filter(f=>f.workerId===user.id).slice().reverse().slice(0,5).map((f,i)=>(
        <div key={i} style={{...S.row,marginBottom:6,borderLeft:"3px solid "+(f.approved===false?C.amber:C.accent)}}>
          <div>
            <div style={{fontWeight:600,fontSize:12}}>{f.feedType} · {f.kg}kg</div>
            <div style={{fontSize:10,color:C.faint}}>{f.date} · RWF {fmtNum(f.cost)}</div>
          </div>
          <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:f.approved===false?"rgba(245,158,11,.12)":"rgba(22,163,74,.1)",color:f.approved===false?C.amber:C.accent,fontWeight:700}}>{f.approved===false?"⏳ Pending":"✅ Approved"}</span>
        </div>
      ))}
    </div>}
  </div>);
}

function SEntry({user,pigs,setPigs,sales,setSales,capital,setCapital}){
  const [form,setForm]=useState({pigId:"",buyer:"",weight:"",priceKg:"",total:"",notes:""});
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [toast,setToast]=useState(null);
  const closeToast=useCallback(()=>setToast(null),[]);
  const active=pigs.filter(p=>p.status==="active");

  // Past buyers for suggestions
  const pastBuyers=[...new Set((sales||[]).map(s=>s.buyer).filter(Boolean))].slice(0,8);
  const [showBuyerSugg,setShowBuyerSugg]=useState(false);
  const buyerSugg=pastBuyers.filter(b=>!form.buyer||b.toLowerCase().includes(form.buyer.toLowerCase()));

  const selPig=active.find(p=>p.id===form.pigId);
  const marketPriceHint=selPig?getMarketPrice(selPig.stage,selPig.weight):0;
  const suggestedPriceKg=selPig&&selPig.weight>0?Math.round(marketPriceHint/selPig.weight):2500;

  function selectPig(pigId){
    const pig=active.find(p=>p.id===pigId);
    if(pig){
      const priceKg=String(suggestedPriceKg||2500);
      const w=String(pig.weight||"");
      const tot=pig.weight&&suggestedPriceKg?String(Math.round(pig.weight*suggestedPriceKg)):"";
      setForm(f=>({...f,pigId,weight:w,priceKg,total:tot}));
    } else {
      setForm(f=>({...f,pigId,weight:"",priceKg:"",total:""}));
    }
  }

  function upd(f){
    const w=parseFloat(f.weight)||0;
    const p=parseFloat(f.priceKg)||0;
    if(w>0&&p>0) return {...f,total:String(Math.round(w*p))};
    return f;
  }

  async function doSave(){
    if(saving) return;
    setSaving(true);
    setConfirm(false);
    const isAdmin=isAdminUser(user);
    const calcTotal=parseFloat(form.weight)*parseFloat(form.priceKg)||0;
    const finalTotal=parseFloat(form.total)||calcTotal;
    const newSale={...form,id:uid(),workerId:user.uid||user.id,worker:user.name,date:toDay(),weight:parseFloat(form.weight)||0,priceKg:parseFloat(form.priceKg)||0,total:Math.round(finalTotal),approved:isAdmin?true:false};
    if(isAdmin){
      if(form.pigId) setPigs(p=>{const updated=p.map(pig=>pig.id===form.pigId?{...pig,status:"sold"}:pig);fsSet("pigs",updated);return updated;});
      if(setCapital) capitalTx(capital,setCapital,{type:"income",category:"Pig Sale",amount:Math.round(finalTotal),description:`${selPig?selPig.tag+", ":""}${form.weight}kg @ RWF ${form.priceKg}/kg to ${form.buyer||"buyer"}`,date:toDay()});
    }
    try{
      await jbinAppend("sales",newSale);
      setSales(p=>[...p.filter(x=>x.id!==newSale.id),newSale]);
      setToast({type:"success",message:isAdmin?`Sale of ${fmtRWF(Math.round(newSale.total))} recorded!`:"✅ Sale submitted! Awaiting admin approval."});
      // Auto WhatsApp alert on sale
      if(isAdmin&&getWAAlertPrefs().onSale){
        sendWhatsApp(`💰 FarmIQ Sale — ${toDay()}\n🐷 ${selPig?selPig.tag:"Pig"} sold to ${form.buyer||"buyer"}\n${form.weight}kg @ RWF ${parseInt(form.priceKg||0).toLocaleString()}/kg\n💵 Total: ${fmtRWF(Math.round(newSale.total))}`);
      }
      setSaved(true);
      setTimeout(()=>{setSaved(false);setForm({pigId:"",buyer:"",weight:"",priceKg:"",total:"",notes:""});},2000);
    }catch(e){setToast({type:"error",message:"Failed to save. Check internet and try again."});}
    setSaving(false);
  }

  function trySubmit(){if(saving||!form.total)return;setConfirm(true);}

  return(<div style={{maxWidth:490}}>
    {confirm&&<ConfirmDialog title="Record This Sale?" body={`${selPig?selPig.tag+" · ":""}Buyer: ${form.buyer||"—"} · ${form.weight}kg @ RWF ${parseInt(form.priceKg||0).toLocaleString()}/kg = RWF ${parseInt(form.total||0).toLocaleString()}. This will mark the pig as sold. Confirm?`} onConfirm={doSave} onCancel={()=>setConfirm(false)}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={closeToast}/>}
    <div style={S.h1}>🏷️ Log a Sale</div>
    <div style={S.sub}>Record pig sale — submitted for admin approval</div>
    {saved&&<div style={{padding:10,background:C.accentSoft,borderRadius:7,marginBottom:12,color:C.accent,fontSize:13}}>✓ Sale recorded!</div>}
    <div style={S.card}>
      {/* Pig selector with market hint */}
      <div style={{marginBottom:12}}>
        <label style={S.lbl}>Pig Sold *</label>
        <select value={form.pigId} onChange={e=>selectPig(e.target.value)} style={S.inp}>
          <option value="">Select pig…</option>
          {active.map(p=><option key={p.id} value={p.id}>{p.tag} — {p.stage} · {p.weight}kg · est. {fmtRWF(getMarketPrice(p.stage,p.weight))}</option>)}
        </select>
        {selPig&&<div style={{fontSize:11,color:C.accent,marginTop:4,padding:"5px 9px",background:C.accentSoft,borderRadius:6}}>
          ✅ {selPig.tag} · {selPig.breed} · {selPig.weight}kg · Market est: <strong>{fmtRWF(marketPriceHint)}</strong> (~{fmtRWF(suggestedPriceKg)}/kg)
        </div>}
      </div>

      {/* Buyer with suggestions */}
      <div style={{marginBottom:12,position:"relative"}}>
        <label style={S.lbl}>Buyer Name *</label>
        <input placeholder="Type buyer name…" value={form.buyer}
          onChange={e=>{setForm({...form,buyer:e.target.value});setShowBuyerSugg(true);}}
          onFocus={()=>setShowBuyerSugg(true)}
          onBlur={()=>setTimeout(()=>setShowBuyerSugg(false),180)}
          style={S.inp}/>
        {showBuyerSugg&&buyerSugg.length>0&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid "+C.border,borderRadius:8,zIndex:999,boxShadow:"0 4px 16px rgba(0,0,0,.1)"}}>
            {buyerSugg.map(b=>(
              <div key={b} onMouseDown={()=>{setForm(f=>({...f,buyer:b}));setShowBuyerSugg(false);}}
                style={{padding:"9px 14px",cursor:"pointer",fontSize:13,color:C.text,borderBottom:"1px solid "+C.elevated}}
                onMouseEnter={e=>e.currentTarget.style.background=C.accentSoft}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                👤 {b}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={S.lbl}>Weight (kg) *</label>
          <input type="number" placeholder={selPig?String(selPig.weight):"80"} value={form.weight}
            onChange={e=>setForm(upd({...form,weight:e.target.value}))} style={S.inp}/>
          {selPig&&form.weight&&Math.abs(parseFloat(form.weight)-selPig.weight)>10&&(
            <div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠️ Different from recorded weight ({selPig.weight}kg)</div>
          )}
        </div>
        <div>
          <label style={S.lbl}>Price per kg (RWF) *</label>
          <input type="number" placeholder={String(suggestedPriceKg||2500)} value={form.priceKg}
            onChange={e=>setForm(upd({...form,priceKg:e.target.value}))} style={S.inp}/>
          {suggestedPriceKg>0&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>Market ref: ~{fmtRWF(suggestedPriceKg)}/kg</div>}
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <label style={S.lbl}>Total (RWF) — auto-calculated</label>
          <input type="number" placeholder="Auto-calculated" value={form.total}
            onChange={e=>setForm({...form,total:e.target.value})} style={{...S.inp,fontWeight:700,fontSize:15,color:C.accent}}/>
          {form.weight&&form.priceKg&&<div style={{fontSize:11,color:C.accent,marginTop:3,fontWeight:600}}>
            {parseFloat(form.weight).toFixed(1)}kg × {fmtRWF(parseFloat(form.priceKg))} = <strong>{fmtRWF(Math.round(parseFloat(form.weight)*parseFloat(form.priceKg)))}</strong>
          </div>}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={S.lbl}>Notes (optional)</label>
        <input placeholder="e.g. cash paid, market name…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={S.inp}/>
      </div>

      <button style={{...S.btn(),width:"100%",padding:12,fontSize:14,opacity:(saving||!form.total)?0.5:1}} disabled={saving||!form.total} onClick={trySubmit}>
        {saving?"⏳ Saving…":"💰 Record Sale →"}
      </button>
      {user.role!=="admin"&&<div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center",padding:"7px",background:"rgba(245,158,11,.06)",borderRadius:6,border:"1px solid rgba(245,158,11,.2)"}}>⏳ Pending admin approval before pig is marked sold</div>}
    </div>
  </div>);
}


function BEntry({user,expenses,setExpenses,capital,setCapital}){
  const PURCHASE_CATS=["Feed Purchase","Medicine","Veterinary","Equipment","Transport","Labour","Utilities","Maintenance","Pig Purchase","Other"];
  // Pre-defined item suggestions per category
  const CAT_ITEMS={
    "Feed Purchase":["Maize bran","Soya meal","Pellets","Wheat bran","Kitchen waste","Cassava peels","Mixed feed","Fish meal","Cotton seed cake","Brewery waste"],
    "Medicine":["Ivermectin","ORS sachets","Multivitamins","Antibiotics","Dewormer","Electrolytes","Wound spray","Disinfectant (Dettol)","Acaricide","Iron injection"],
    "Veterinary":["Vet consultation fee","Vet call-out fee","Lab test fee","Diagnosis fee","Treatment fee"],
    "Equipment":["Feeding trough","Water nipples","Weighing scale","Wheelbarrow","Shovels","Hoe","Buckets","Spray pump","Feeders","Water tank"],
    "Transport":["Truck hire","Motorbike fee","Bus transport","Fuel","Loading fee"],
    "Labour":["Daily wages","Weekly wages","Cleaning labour","Construction labour","Loading/offloading"],
    "Utilities":["Electricity bill","Water bill","Phone airtime","Internet data"],
    "Maintenance":["Pen repair","Roof repair","Fence repair","Painting","Plumbing","Welding"],
    "Pig Purchase":["Weaner pig","Grower pig","Sow","Boar","Gilt","Piglet"],
    "Other":["Office supplies","Signage","Printing","Other expense"]
  };
  const UNIT_OPTIONS=["kg","litres","doses","pcs","bags","boxes","heads"];
  const [form,setForm]=useState({category:"Feed Purchase",item:"",quantity:"",unit:"kg",unitPrice:"",totalAmount:"",supplier:"",date:toDay(),notes:""});
  const [saved,setSaved]=useState(false);
  const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [toast,setToast]=useState(null);
  const closeToast=useCallback(()=>setToast(null),[]);
  const [showItemSuggestions,setShowItemSuggestions]=useState(false);

  // Past suppliers from expenses history
  const pastSuppliers=[...new Set((expenses||[]).map(e=>e.supplier).filter(Boolean))].slice(0,8);

  function updateCalc(f){
    const q=parseFloat(f.quantity)||0;
    const up=parseFloat(f.unitPrice)||0;
    if(q>0&&up>0) return{...f,totalAmount:String(Math.round(q*up))};
    return f;
  }
  function updateCat(cat){
    // Auto-set unit when category changes
    const unitMap={"Feed Purchase":"kg","Medicine":"doses","Equipment":"pcs","Labour":"pcs","Pig Purchase":"heads"};
    setForm(f=>({...f,category:cat,item:"",unit:unitMap[cat]||f.unit}));
    setShowItemSuggestions(false);
  }

  const total=parseFloat(form.totalAmount)||0;
  const suggestions=(CAT_ITEMS[form.category]||[]).filter(s=>!form.item||s.toLowerCase().includes(form.item.toLowerCase()));

  async function doSave(){
    if(saving) return;
    setSaving(true);
    setConfirm(false);
    const isAdmin=isAdminUser(user);
    const newExp={
      id:uid(),workerId:user.uid||user.id,worker:user.name,
      category:form.category,item:form.item||form.category,
      quantity:form.quantity,unit:form.unit,unitPrice:form.unitPrice,
      amount:total,supplier:form.supplier,
      description:`${form.item||form.category}${form.quantity?" — "+form.quantity+" "+(form.unit||""):""}${form.supplier?" from "+form.supplier:""}`,
      notes:form.notes,date:form.date,
      source:"worker_purchase",
      approved:isAdmin?true:false
    };
    if(isAdmin&&setCapital) capitalTx(capital,setCapital,{type:"expense",category:form.category,amount:total,description:newExp.description,date:form.date});
    try{
      await jbinAppend("expenses",newExp);
      setExpenses(p=>[...p.filter(x=>x.id!==newExp.id),newExp]);
      setToast({type:"success",message:isAdmin?`✅ Purchase of ${fmtRWF(total)} recorded!`:`✅ Purchase submitted! Awaiting admin approval.`});
      setSaved(true);
      setTimeout(()=>{
        setSaved(false);
        setForm({category:"Feed Purchase",item:"",quantity:"",unit:"kg",unitPrice:"",totalAmount:"",supplier:"",date:toDay(),notes:""});
      },2200);
    }catch(e){setToast({type:"error",message:"Failed to save. Check internet and try again."});}
    setSaving(false);
  }

  function trySubmit(){
    if(saving||!total||total<=0) return;
    setConfirm(true);
  }

  return(<div style={{maxWidth:520}}>
    {confirm&&<ConfirmDialog
      title="Record This Purchase?"
      body={`${form.item||form.category} — ${form.quantity?form.quantity+" "+form.unit+(form.unitPrice?" @ RWF "+form.unitPrice+"/"+form.unit:"")+" = ":""}RWF ${Math.round(total).toLocaleString()}${form.supplier?" from "+form.supplier:""}. Recorded as ${form.category} expense. Confirm?`}
      onConfirm={doSave} onCancel={()=>setConfirm(false)}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={closeToast}/>}
    <div style={S.h1}>🛒 Log Purchase</div>
    <div style={S.sub}>Record what you bought — submitted for admin approval</div>
    {saved&&<div style={{padding:10,background:C.accentSoft,borderRadius:7,marginBottom:12,color:C.accent,fontSize:13}}>✓ Purchase recorded!</div>}
    <div style={S.card}>
      {/* Category first */}
      <div style={{marginBottom:12}}>
        <label style={S.lbl}>Category *</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {PURCHASE_CATS.map(c=>(
            <button key={c} onClick={()=>updateCat(c)} style={{
              padding:"6px 12px",borderRadius:20,border:"1.5px solid "+(form.category===c?C.accent:C.border),
              background:form.category===c?C.accent:"transparent",
              color:form.category===c?"#fff":C.muted,
              fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:form.category===c?700:400,
              transition:"all .15s"
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Item with suggestions */}
      <div style={{marginBottom:12,position:"relative"}}>
        <label style={S.lbl}>What did you buy? *</label>
        <input
          placeholder={`e.g. ${(CAT_ITEMS[form.category]||[])[0]||"Type item name"}…`}
          value={form.item}
          onChange={e=>{setForm({...form,item:e.target.value});setShowItemSuggestions(true);}}
          onFocus={()=>setShowItemSuggestions(true)}
          onBlur={()=>setTimeout(()=>setShowItemSuggestions(false),180)}
          style={S.inp}/>
        {showItemSuggestions&&suggestions.length>0&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid "+C.border,borderRadius:8,zIndex:999,boxShadow:"0 4px 16px rgba(0,0,0,.1)",maxHeight:180,overflowY:"auto"}}>
            {suggestions.map(s=>(
              <div key={s} onMouseDown={()=>{setForm(f=>({...f,item:s}));setShowItemSuggestions(false);}}
                style={{padding:"9px 14px",cursor:"pointer",fontSize:13,color:C.text,borderBottom:"1px solid "+C.elevated}}
                onMouseEnter={e=>e.currentTarget.style.background=C.accentSoft}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={S.lbl}>Quantity</label>
          <input type="number" min="0" placeholder="e.g. 50" value={form.quantity} onChange={e=>setForm(updateCalc({...form,quantity:e.target.value}))} style={S.inp}/>
        </div>
        <div>
          <label style={S.lbl}>Unit</label>
          <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={S.inp}>
            {UNIT_OPTIONS.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Unit Price (RWF)</label>
          <input type="number" min="0" placeholder="e.g. 350" value={form.unitPrice} onChange={e=>setForm(updateCalc({...form,unitPrice:e.target.value}))} style={S.inp}/>
        </div>
        <div>
          <label style={S.lbl}>Total Amount (RWF) *</label>
          <input type="number" min="0" placeholder="Auto-calculated or type" value={form.totalAmount} onChange={e=>setForm({...form,totalAmount:e.target.value})} style={S.inp}/>
        </div>
        <div>
          <label style={S.lbl}>Date</label>
          <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.inp}/>
        </div>
        <div>
          <label style={S.lbl}>Supplier / Market</label>
          {pastSuppliers.length>0?(
            <select value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} style={S.inp}>
              <option value="">Select or type…</option>
              {pastSuppliers.map(s=><option key={s}>{s}</option>)}
              <option value="__new__">+ Other (type below)</option>
            </select>
          ):(
            <input placeholder="e.g. Kimironko Market…" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} style={S.inp}/>
          )}
          {form.supplier==="__new__"&&<input placeholder="Type supplier name…" style={{...S.inp,marginTop:6}} value="" onChange={e=>setForm({...form,supplier:e.target.value})}/>}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={S.lbl}>Notes (optional)</label>
        <input placeholder="Any additional details…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={S.inp}/>
      </div>

      {total>0&&<div style={{padding:"10px 14px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,color:C.muted}}>Total expense: <strong style={{color:C.red,fontSize:15}}>{fmtRWF(total)}</strong></div>
        <div style={{fontSize:11,color:C.faint}}>Category: <span style={{color:C.text,fontWeight:600}}>{form.category}</span></div>
      </div>}

      <button
        disabled={saving||!total||total<=0}
        style={{...S.btn(C.red),color:"#fff",width:"100%",padding:12,fontSize:14,opacity:(saving||!total||total<=0)?0.5:1}}
        onClick={trySubmit}>
        {saving?"⏳ Saving…":"🛒 Save Purchase →"}
      </button>
      {(!total||total<=0)&&<div style={{fontSize:11,color:C.faint,marginTop:7,textAlign:"center"}}>Enter quantity × unit price, or type total amount directly</div>}
      {user.role!=="admin"&&<div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center",padding:"7px",background:"rgba(245,158,11,.06)",borderRadius:6,border:"1px solid rgba(245,158,11,.2)"}}>⏳ Pending admin approval before it counts in records</div>}
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════
   ADMIN WORKER DATA EDITOR
   Full CRUD on worker-submitted feeds, logs, sales, expenses
   Every edit/delete cascades to capital & P&L automatically
═══════════════════════════════════════════════════ */
function AdminWorkerDataEditor({feeds,setFeeds,logs,setLogs,sales,setSales,expenses,setExpenses,incomes,capital,setCapital,pigs,users,pushUndo}){
  const [tab,setTab]=useState("feeds");
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState(null);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [recalcDone,setRecalcDone]=useState(false);

  // Auto-purge orphaned capital transactions whenever this page opens
  useEffect(()=>{
    purgeOrphanedCapitalTx(capital,setCapital,feeds,sales,expenses,logs);
  },[]);

  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3000);}

  function recalculateCapital(){
    purgeOrphanedCapitalTx(capital,setCapital,feeds,sales,expenses,logs);
    setRecalcDone(true);
    showToast("✅ Capital recalculated! All orphaned transactions purged. Balance now reflects actual data.");
    setTimeout(()=>setRecalcDone(false),4000);
  }

  // ── Capital cascade helpers ──
  function patchCapitalTx(refId,newAmt,newType,newCat,newDesc,newDate){
    setCapital(prev=>{
      const txs=(prev.transactions||[]).map(t=>{
        if(t.refId===refId) return{...t,amount:Math.round(newAmt),type:newType,category:newCat,description:newDesc,date:newDate};
        return t;
      });
      return{...prev,transactions:txs};
    });
  }
  function removeCapitalTx(refId){
    setCapital(prev=>({...prev,transactions:(prev.transactions||[]).filter(t=>t.refId!==refId)}));
  }
  function ensureCapitalTx(refId,type,category,amount,description,date){
    setCapital(prev=>{
      const exists=(prev.transactions||[]).some(t=>t.refId===refId);
      if(exists) return prev;
      const tx={id:uid(),type,category,amount:Math.round(amount),description,date,createdAt:new Date().toISOString(),refId};
      return{...prev,transactions:[...(prev.transactions||[]),tx]};
    });
  }

  // ── FEEDS ──
  function saveFeedEdit(id){
    const f=editForm;
    const kg=parseFloat(f.kg)||0;
    const cpk=parseFloat(f.costPerKg)||0;
    const cost=kg>0&&cpk>0?Math.round(kg*cpk):parseFloat(f.cost)||0;
    const updated=feeds.map(x=>x.id===id?{...x,...f,kg,costPerKg:cpk,cost}:x);
    setFeeds(updated);fsSet("feeds",updated);
    const orig=feeds.find(x=>x.id===id);
    const refId="feed_"+id;
    if((capital.transactions||[]).some(t=>t.refId===refId)){
      patchCapitalTx(refId,cost,"expense","Feed Purchase",`${kg}kg ${f.feedType||orig.feedType} — edited by admin`,f.date||orig.date);
    }else{
      ensureCapitalTx(refId,"expense","Feed Purchase",cost,`${kg}kg ${f.feedType||orig.feedType} — admin edit`,f.date||orig.date);
    }
    setEditId(null);setEditForm(null);
    showToast("✅ Feed log updated — capital synced");
  }
  function deleteFeed(id){
    if(!window.confirm("Delete this feed log? Capital will be adjusted."))return;
    const deleted=feeds.find(x=>x.id===id);
    const updated=feeds.filter(x=>x.id!==id);
    setFeeds(updated);fsSet("feeds",updated);
    purgeOrphanedCapitalTx(capital,setCapital,updated,sales,expenses,logs);
    showToast("🗑️ Feed log deleted — capital adjusted");
    if(pushUndo&&deleted) pushUndo("Feed log ("+deleted.feedType+" "+deleted.kg+"kg)",()=>{
      const restored=[...feeds.filter(x=>x.id!==deleted.id),deleted];
      setFeeds(restored);fsSet("feeds",restored);
    });
  }

  // ── LOGS ──
  function saveLogEdit(id){
    const updated=logs.map(x=>x.id===id?{...x,...editForm,checked:parseInt(editForm.checked)||0,sick:parseInt(editForm.sick)||0,deaths:parseInt(editForm.deaths)||0,births:parseInt(editForm.births)||0,water:editForm.water==="yes"||editForm.water===true,cleaned:editForm.cleaned==="yes"||editForm.cleaned===true}:x);
    setLogs(updated);fsSet("logs",updated);
    const lossAmt=parseFloat(editForm.deathLossAmount)||0;
    const refId="deathloss_"+id;
    if(lossAmt>0){
      if((capital.transactions||[]).some(t=>t.refId===refId)){
        patchCapitalTx(refId,lossAmt,"expense","Pig Death Loss",`${parseInt(editForm.deaths)||0} pig(s) died — edited by admin`,editForm.date);
      }else{
        ensureCapitalTx(refId,"expense","Pig Death Loss",lossAmt,`${parseInt(editForm.deaths)||0} pig(s) died — admin edit`,editForm.date);
      }
    }else{
      removeCapitalTx(refId);
    }
    setEditId(null);setEditForm(null);
    showToast("✅ Daily log updated — capital synced");
  }
  function deleteLog(id){
    if(!window.confirm("Delete this daily log?"))return;
    const deleted=logs.find(x=>x.id===id);
    const updated=logs.filter(x=>x.id!==id);
    setLogs(updated);fsSet("logs",updated);
    purgeOrphanedCapitalTx(capital,setCapital,feeds,sales,expenses,updated);
    showToast("🗑️ Daily log deleted");
    if(pushUndo&&deleted) pushUndo("Daily log ("+deleted.worker+" "+deleted.date+")",()=>{
      const restored=[...logs.filter(x=>x.id!==deleted.id),deleted];
      setLogs(restored);fsSet("logs",restored);
    });
  }

  // ── SALES ──
  function saveSaleEdit(id){
    const w=parseFloat(editForm.weight)||0;
    const pk=parseFloat(editForm.priceKg)||0;
    const total=w>0&&pk>0?Math.round(w*pk):parseFloat(editForm.total)||0;
    const updated=sales.map(x=>x.id===id?{...x,...editForm,weight:w,priceKg:pk,total}:x);
    setSales(updated);fsSet("sales",updated);
    const refId="sale_"+id;
    const orig=sales.find(x=>x.id===id);
    if((capital.transactions||[]).some(t=>t.refId===refId)){
      patchCapitalTx(refId,total,"income","Pig Sale",`${w}kg @ RWF${pk}/kg to ${editForm.buyer||orig.buyer||"buyer"} — edited by admin`,editForm.date||orig.date);
    }else{
      ensureCapitalTx(refId,"income","Pig Sale",total,`${w}kg @ RWF${pk}/kg to ${editForm.buyer||orig.buyer||"buyer"} — admin edit`,editForm.date||orig.date);
    }
    setEditId(null);setEditForm(null);
    showToast("✅ Sale updated — capital & P&L synced");
  }
  function deleteSale(id){
    if(!window.confirm("Delete this sale? Capital income will be reversed."))return;
    const deleted=sales.find(x=>x.id===id);
    const updated=sales.filter(x=>x.id!==id);
    setSales(updated);fsSet("sales",updated);
    purgeOrphanedCapitalTx(capital,setCapital,feeds,updated,expenses,logs);
    showToast("🗑️ Sale deleted — capital reversed");
    if(pushUndo&&deleted) pushUndo("Sale ("+fmtRWF(deleted.total)+" — "+deleted.worker+")",()=>{
      const restored=[...sales.filter(x=>x.id!==deleted.id),deleted];
      setSales(restored);fsSet("sales",restored);
    });
  }

  // ── EXPENSES ──
  function saveExpenseEdit(id){
    const amt=parseFloat(editForm.amount)||0;
    const orig=expenses.find(x=>x.id===id);
    const merged={
      ...orig,
      ...editForm,
      amount:amt,
      // rebuild description from item/supplier if worker purchase
      description: editForm.description ||
        (editForm.item
          ? `${editForm.item}${editForm.quantity?" — "+editForm.quantity+" "+(editForm.unit||""):""}${editForm.supplier?" from "+editForm.supplier:""}`
          : orig.description||editForm.category)
    };
    const updated=expenses.map(x=>x.id===id?merged:x);
    setExpenses(updated);fsSet("expenses",updated);
    const refId="exp_"+id;
    if((capital.transactions||[]).some(t=>t.refId===refId)){
      patchCapitalTx(refId,amt,"expense",editForm.category||orig.category,merged.description,editForm.date||orig.date);
    }else{
      ensureCapitalTx(refId,"expense",editForm.category||orig.category,amt,merged.description,editForm.date||orig.date);
    }
    setEditId(null);setEditForm(null);
    showToast("✅ Purchase updated — capital synced");
  }
  function deleteExpense(id){
    if(!window.confirm("Delete this expense? Capital will be adjusted."))return;
    const deleted=expenses.find(x=>x.id===id);
    const updated=expenses.filter(x=>x.id!==id);
    setExpenses(updated);fsSet("expenses",updated);
    purgeOrphanedCapitalTx(capital,setCapital,feeds,sales,updated,logs);
    showToast("🗑️ Expense deleted — capital adjusted");
    if(pushUndo&&deleted) pushUndo("Purchase ("+fmtRWF(deleted.amount)+" — "+(deleted.item||deleted.category)+")",()=>{
      const restored=[...expenses.filter(x=>x.id!==deleted.id),deleted];
      setExpenses(restored);fsSet("expenses",restored);
    });
  }

  const TABS=[{id:"feeds",l:"🌾 Feeds",count:feeds.length},{id:"logs",l:"📋 Daily Logs",count:logs.length},{id:"sales",l:"🏷️ Sales",count:sales.length},{id:"expenses",l:"🛒 Purchases",count:expenses.length}];
  const workerName=(id)=>{const u=users.find(x=>x.id===id);return u?u.name:"—";};
  const q=search.toLowerCase();

  return(<div>
    {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:toast.type==="success"?"#16a34a":"#dc2626",color:"#fff",padding:"12px 18px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 30px rgba(0,0,0,.18)",animation:"fadeIn .3s ease both"}}>{toast.msg}</div>}
    <div style={S.h1}>🛠️ Admin: Edit Worker Data</div>
    <div style={S.sub}>Edit or delete any record submitted by workers — every change instantly updates Capital & P&L</div>

    {/* Recalculate capital banner */}
    <div style={{padding:"12px 16px",background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",borderRadius:12,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:"#4ade80",marginBottom:2}}>⚡ Capital Balance (Live)</div>
        <div style={{fontSize:22,fontWeight:800,color:calcCapitalBalance(capital,feeds,sales,expenses,incomes)>=0?"#4ade80":"#f87171"}}>{fmtRWF(calcCapitalBalance(capital,feeds,sales,expenses,incomes))}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginTop:2}}>Derived from actual records — always accurate</div>
      </div>
      <button onClick={recalculateCapital} style={{padding:"10px 16px",borderRadius:10,border:"1px solid rgba(74,222,128,.4)",background:"rgba(74,222,128,.12)",color:"#4ade80",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}>
        🔧 Recalculate & Fix Capital
      </button>
    </div>
    {recalcDone&&<div style={{padding:"10px 14px",background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.3)",borderRadius:9,marginBottom:12,fontSize:13,color:C.accent,fontWeight:600}}>✅ Capital fixed! Orphaned transactions removed. All figures now match actual records.</div>}

    {/* Live impact summary */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {[["🌾 Feed Records",feeds.length,C.amber],["📋 Daily Logs",logs.length,C.blue],["🏷️ Sales",sales.length,"#10b981"],["🛒 Expenses",expenses.length,C.red]].map(([l,v,c])=>(
        <div key={l} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <div style={{fontSize:10,color:C.faint,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
          <div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div>
        </div>
      ))}
    </div>

    <div style={{padding:"10px 14px",background:"rgba(22,163,74,.06)",border:"1px solid rgba(22,163,74,.2)",borderRadius:9,marginBottom:14,fontSize:12,color:C.muted}}>
      ⚡ <strong style={{color:C.accent}}>Live sync active</strong> — every edit/delete automatically updates Capital Balance, P&L, and Dashboard in real-time. No manual recalculation needed.
    </div>

    {/* Search */}
    <div style={{marginBottom:12}}>
      <input placeholder="🔍 Search by worker, pig tag, date, category…" value={search} onChange={e=>setSearch(e.target.value)} style={{...S.inp,maxWidth:400}}/>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {TABS.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setEditId(null);setEditForm(null);}} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.muted,fontWeight:tab===t.id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t.l} <span style={{fontSize:10,opacity:.7}}>({t.count})</span></button>)}
    </div>

    {/* ── FEEDS TAB ── */}
    {tab==="feeds"&&<div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>🌾 All Feeding Records ({feeds.length})</div>
      {feeds.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No feed records yet.</div>}
      {feeds.filter(f=>!q||(f.worker||"").toLowerCase().includes(q)||(f.feedType||"").toLowerCase().includes(q)||(f.date||"").includes(q)).slice().reverse().map(f=>{
        const pig=pigs.find(p=>p.id===f.pigId);
        return(<div key={f.id} style={{...S.card,marginBottom:10,border:"1px solid "+C.border}}>
          {editId===f.id&&editForm?(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:10}}>✏️ Editing Feed Log</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={S.lbl}>Feed Type</label>
                  <select value={editForm.feedType} onChange={e=>setEditForm({...editForm,feedType:e.target.value})} style={S.inp}>
                    {["Maize bran","Soya meal","Pellets","Kitchen waste","Mixed","Other"].map(x=><option key={x}>{x}</option>)}
                  </select>
                </div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Amount (kg)</label><input type="number" min="0" step="0.1" value={editForm.kg} onChange={e=>setEditForm({...editForm,kg:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Cost per kg (RWF)</label><input type="number" min="0" value={editForm.costPerKg} onChange={e=>setEditForm({...editForm,costPerKg:e.target.value})} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes</label><input value={editForm.notes||""} onChange={e=>setEditForm({...editForm,notes:e.target.value})} style={S.inp}/></div>
              </div>
              {editForm.kg&&editForm.costPerKg&&<div style={{padding:"8px 12px",background:"rgba(239,68,68,.06)",borderRadius:7,marginBottom:10,fontSize:12,color:C.red}}>
                New total cost: <strong>{fmtRWF(Math.round((parseFloat(editForm.kg)||0)*(parseFloat(editForm.costPerKg)||0)))}</strong> → will update capital
              </div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>saveFeedEdit(f.id)} style={{...S.btn(C.accent),flex:1,padding:8,fontSize:12}}>✓ Save & Sync Capital</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),padding:8,fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:C.text,fontSize:13}}>🌾 {f.feedType} — {f.kg}kg</span>
                  {f.approved===false&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"rgba(245,158,11,.15)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>}
                </div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>👷 {f.worker||workerName(f.workerId)} · {f.date} · {pig?"🐷 "+pig.tag:"All pigs"}</div>
                {f.notes&&<div style={{fontSize:11,color:C.muted,marginTop:2,fontStyle:"italic"}}>"{f.notes}"</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:C.amber,fontSize:14}}>{fmtRWF(f.cost)}</div>
                <div style={{display:"flex",gap:5,marginTop:5,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setEditId(f.id);setEditForm({feedType:f.feedType,date:f.date,kg:String(f.kg||""),costPerKg:String(f.costPerKg||""),notes:f.notes||""});}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.text,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                  <button onClick={()=>deleteFeed(f.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️ Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>);
      })}
    </div>}

    {/* ── LOGS TAB ── */}
    {tab==="logs"&&<div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📋 All Daily Logs ({logs.length})</div>
      {logs.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No logs yet.</div>}
      {logs.filter(l=>!q||(l.worker||"").toLowerCase().includes(q)||(l.date||"").includes(q)||(l.notes||"").toLowerCase().includes(q)).slice().reverse().map(l=>(
        <div key={l.id} style={{...S.card,marginBottom:10}}>
          {editId===l.id&&editForm?(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:10}}>✏️ Editing Daily Log</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
                {[["checked","Pigs Checked"],["sick","Sick Pigs"],["deaths","Deaths"],["births","New Births"]].map(([k,lbl])=>(
                  <div key={k}><label style={S.lbl}>{lbl}</label><input type="number" min="0" value={editForm[k]||0} onChange={e=>setEditForm({...editForm,[k]:e.target.value})} style={S.inp}/></div>
                ))}
                {[["water","Water OK?"],["cleaned","Pen Cleaned?"]].map(([k,lbl])=>(
                  <div key={k}><label style={S.lbl}>{lbl}</label>
                    <select value={editForm[k]==="yes"||editForm[k]===true?"yes":"no"} onChange={e=>setEditForm({...editForm,[k]:e.target.value==="yes"})} style={S.inp}>
                      <option value="yes">Yes ✓</option><option value="no">No ✗</option>
                    </select>
                  </div>
                ))}
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Death Loss Amount (RWF)</label><input type="number" min="0" value={editForm.deathLossAmount||""} onChange={e=>setEditForm({...editForm,deathLossAmount:e.target.value})} placeholder="0 = no capital loss" style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes</label><textarea rows={2} value={editForm.notes||""} onChange={e=>setEditForm({...editForm,notes:e.target.value})} style={{...S.inp,resize:"vertical"}}/></div>
              </div>
              {(parseInt(editForm.deaths)||0)>0&&<div style={{padding:"8px 12px",background:"rgba(239,68,68,.06)",borderRadius:7,marginBottom:10,fontSize:12,color:C.red}}>
                {parseFloat(editForm.deathLossAmount)>0?`Capital deduction: ${fmtRWF(parseFloat(editForm.deathLossAmount))}`:"{No capital loss recorded}"}
              </div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>saveLogEdit(l.id)} style={{...S.btn(C.accent),flex:1,padding:8,fontSize:12}}>✓ Save & Sync Capital</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),padding:8,fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:13,color:C.text}}>📋 {l.worker} — {l.date}</span>
                  {l.approved===false&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"rgba(245,158,11,.15)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>}
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:5,fontSize:11}}>
                  {[["✓ Checked",l.checked,C.accent],["🤒 Sick",l.sick,l.sick>0?C.red:C.muted],["💀 Deaths",l.deaths,l.deaths>0?C.red:C.muted],["🐣 Births",l.births,l.births>0?"#10b981":C.muted]].map(([lbl,val,col])=>(
                    <span key={lbl} style={{padding:"2px 8px",borderRadius:20,background:C.elevated,color:col,fontWeight:val>0?700:400}}>{lbl}: {val}</span>
                  ))}
                </div>
                {l.notes&&<div style={{fontSize:11,color:C.muted,marginTop:4,fontStyle:"italic"}}>"{l.notes}"</div>}
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <button onClick={()=>{setEditId(l.id);setEditForm({date:l.date,checked:String(l.checked||0),sick:String(l.sick||0),deaths:String(l.deaths||0),births:String(l.births||0),water:l.water?"yes":"no",cleaned:l.cleaned?"yes":"no",notes:l.notes||"",deathLossAmount:String(l.deathLossAmount||"")});}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.text,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                <button onClick={()=>deleteLog(l.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>}

    {/* ── SALES TAB ── */}
    {tab==="sales"&&<div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>🏷️ All Sale Records ({sales.length})</div>
      {sales.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No sales yet.</div>}
      {sales.filter(s=>!q||(s.worker||"").toLowerCase().includes(q)||(s.buyer||"").toLowerCase().includes(q)||(s.date||"").includes(q)).slice().reverse().map(s=>{
        const pig=pigs.find(p=>p.id===s.pigId);
        return(<div key={s.id} style={{...S.card,marginBottom:10}}>
          {editId===s.id&&editForm?(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#10b981",marginBottom:10}}>✏️ Editing Sale Record</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={S.lbl}>Buyer</label><input value={editForm.buyer} onChange={e=>setEditForm({...editForm,buyer:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={editForm.weight} onChange={e=>{const w=e.target.value;const pk=parseFloat(editForm.priceKg)||0;setEditForm({...editForm,weight:w,total:String(Math.round((parseFloat(w)||0)*pk))});}} style={S.inp}/></div>
                <div><label style={S.lbl}>Price/kg (RWF)</label><input type="number" value={editForm.priceKg} onChange={e=>{const pk=e.target.value;const w=parseFloat(editForm.weight)||0;setEditForm({...editForm,priceKg:pk,total:String(Math.round(w*(parseFloat(pk)||0)))});}} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Total (RWF)</label><input type="number" value={editForm.total} onChange={e=>setEditForm({...editForm,total:e.target.value})} style={S.inp}/></div>
              </div>
              {editForm.total&&<div style={{padding:"8px 12px",background:"rgba(16,185,129,.06)",borderRadius:7,marginBottom:10,fontSize:12,color:"#10b981"}}>
                New income: <strong>{fmtRWF(parseFloat(editForm.total)||0)}</strong> → will update capital
              </div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>saveSaleEdit(s.id)} style={{...S.btn(C.accent),flex:1,padding:8,fontSize:12}}>✓ Save & Sync Capital</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),padding:8,fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:13,color:C.text}}>🏷️ {pig?pig.tag:"—"} → {s.buyer||"—"}</span>
                  {s.approved===false&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"rgba(245,158,11,.15)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>}
                </div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>👷 {s.worker} · {s.date} · {s.weight}kg @ RWF{fmtNum(s.priceKg)}/kg</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:"#10b981",fontSize:14}}>{fmtRWF(s.total)}</div>
                <div style={{display:"flex",gap:5,marginTop:5,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setEditId(s.id);setEditForm({buyer:s.buyer||"",date:s.date,weight:String(s.weight||""),priceKg:String(s.priceKg||""),total:String(s.total||"")});}} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.text,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                  <button onClick={()=>deleteSale(s.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️ Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>);
      })}
    </div>}

    {/* ── EXPENSES / PURCHASES TAB ── */}
    {tab==="expenses"&&<div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>🛒 All Purchases & Expenses ({expenses.length})</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Includes all worker purchases and admin-recorded expenses</div>
      {expenses.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No expense/purchase records yet.</div>}
      {expenses.filter(e=>!q||(e.worker||"").toLowerCase().includes(q)||(e.category||"").toLowerCase().includes(q)||(e.description||"").toLowerCase().includes(q)||(e.item||"").toLowerCase().includes(q)||(e.supplier||"").toLowerCase().includes(q)||(e.date||"").includes(q)).slice().reverse().map(e=>(
        <div key={e.id} style={{...S.card,marginBottom:10,borderLeft:"3px solid "+C.red}}>
          {editId===e.id&&editForm?(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.red,marginBottom:10}}>✏️ Editing Purchase / Expense</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={S.lbl}>Category</label>
                  <select value={editForm.category||""} onChange={ex=>setEditForm({...editForm,category:ex.target.value})} style={S.inp}>
                    {["Feed Purchase","Medicine","Veterinary","Equipment","Transport","Labour","Utilities","Maintenance","Pig Purchase","Other"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date||""} onChange={ex=>setEditForm({...editForm,date:ex.target.value})} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Item / What was bought</label><input placeholder="e.g. Maize bran, Ivermectin…" value={editForm.item||""} onChange={ex=>setEditForm({...editForm,item:ex.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Quantity</label><input type="number" min="0" placeholder="e.g. 50" value={editForm.quantity||""} onChange={ex=>{const q2=ex.target.value;const up=parseFloat(editForm.unitPrice)||0;setEditForm({...editForm,quantity:q2,amount:up>0&&parseFloat(q2)>0?String(Math.round(parseFloat(q2)*up)):editForm.amount});}} style={S.inp}/></div>
                <div><label style={S.lbl}>Unit</label>
                  <select value={editForm.unit||"kg"} onChange={ex=>setEditForm({...editForm,unit:ex.target.value})} style={S.inp}>
                    {["kg","litres","doses","pcs","bags","boxes","heads"].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><label style={S.lbl}>Unit Price (RWF)</label><input type="number" min="0" placeholder="per unit" value={editForm.unitPrice||""} onChange={ex=>{const up=ex.target.value;const q2=parseFloat(editForm.quantity)||0;setEditForm({...editForm,unitPrice:up,amount:q2>0&&parseFloat(up)>0?String(Math.round(q2*parseFloat(up))):editForm.amount});}} style={S.inp}/></div>
                <div><label style={S.lbl}>Total Amount (RWF) *</label><input type="number" min="0" value={editForm.amount||""} onChange={ex=>setEditForm({...editForm,amount:ex.target.value})} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Supplier / Where bought</label><input placeholder="e.g. Kimironko Market…" value={editForm.supplier||""} onChange={ex=>setEditForm({...editForm,supplier:ex.target.value})} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Description / Notes</label><input value={editForm.description||""} onChange={ex=>setEditForm({...editForm,description:ex.target.value})} style={S.inp}/></div>
              </div>
              {editForm.amount&&parseFloat(editForm.amount)>0&&<div style={{padding:"8px 12px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:7,marginBottom:10,fontSize:12,color:C.red,display:"flex",justifyContent:"space-between"}}>
                <span>New total expense: <strong>{fmtRWF(parseFloat(editForm.amount)||0)}</strong></span>
                <span style={{color:C.faint}}>{editForm.category} → capital updated</span>
              </div>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>saveExpenseEdit(e.id)} style={{...S.btn(C.accent),flex:1,padding:9,fontSize:12}}>✓ Save & Sync Capital</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),padding:9,fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:13,color:C.text}}>🛒 {e.item||e.category}</span>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(239,68,68,.08)",color:C.red,fontWeight:600}}>{e.category}</span>
                    {e.source==="worker_purchase"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(37,99,235,.08)",color:C.blue,fontWeight:600}}>👷 Worker</span>}
                    {e.approved===false&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"rgba(245,158,11,.15)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>}
                  </div>
                  <div style={{fontSize:11,color:C.faint,marginTop:3}}>
                    👤 {e.worker||"Admin"} · 📅 {e.date}
                    {e.quantity&&<span> · {e.quantity} {e.unit||""}{e.unitPrice?" @ RWF"+fmtNum(e.unitPrice)+"/"+e.unit:""}</span>}
                    {e.supplier&&<span> · 📍 {e.supplier}</span>}
                  </div>
                  {e.description&&e.description!==e.item&&<div style={{fontSize:11,color:C.muted,marginTop:2,fontStyle:"italic"}}>{e.description}</div>}
                  {e.notes&&<div style={{fontSize:11,color:C.muted,marginTop:2,fontStyle:"italic"}}>📝 {e.notes}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:C.red,fontSize:15}}>{fmtRWF(e.amount)}</div>
                  <div style={{display:"flex",gap:5,marginTop:6,justifyContent:"flex-end"}}>
                    <button onClick={()=>{setEditId(e.id);setEditForm({category:e.category||"Other",date:e.date||toDay(),item:e.item||"",quantity:e.quantity||"",unit:e.unit||"kg",unitPrice:e.unitPrice||"",amount:String(e.amount||""),supplier:e.supplier||"",description:e.description||"",notes:e.notes||""});}} style={{padding:"4px 12px",borderRadius:7,border:"1px solid "+C.border,background:C.elevated,color:C.text,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️ Edit</button>
                    <button onClick={()=>deleteExpense(e.id)} style={{padding:"4px 12px",borderRadius:7,border:"1px solid rgba(239,68,68,.35)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑️ Delete</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   FEED EFFICIENCY MODULE
   Actual vs expected feed, cost trends, waste detection
═══════════════════════════════════════════════════ */
function FeedEfficiency({pigs,feeds,logs,expenses,sales,incomes}){
  const [tab,setTab]=useState("overview");
  const active=pigs.filter(p=>p.status==="active");
  const STAGE_FEED={Piglet:0.5,Weaner:1.0,Grower:1.8,Finisher:2.8,Gilt:2.2,Sow:2.5,Boar:2.0};
  const FEED_REF={"Maize bran":350,"Soya meal":800,"Pellets":950,"Kitchen waste":0,"Mixed":500,"Other":400};

  // Overall totals
  const totalKg=feeds.reduce((s,f)=>s+(parseFloat(f.kg)||0),0);
  const totalCost=feeds.reduce((s,f)=>s+(parseFloat(f.cost)||0),0);
  const avgCpk=totalKg>0?Math.round(totalCost/totalKg):0;

  // Expected daily feed based on herd
  const expectedDaily=active.reduce((s,p)=>s+(STAGE_FEED[p.stage]||2.0),0);
  const logDays=feeds.length>0?new Set(feeds.map(f=>f.date)).size:1;
  const actualDaily=logDays>0?Math.round((totalKg/logDays)*10)/10:0;
  const effPct=expectedDaily>0?Math.round((actualDaily/expectedDaily)*100):null;
  const effColor=effPct===null?C.faint:effPct>=90&&effPct<=115?C.accent:effPct<80?C.red:C.amber;

  // FCR (Feed Conversion Ratio): kg feed per kg weight gain estimated
  // Estimate weight gain from pig records over time (simplified)
  const totalFeedKg=totalKg;
  // Per-stage breakdown
  const byStage={};
  active.forEach(p=>{
    const s=p.stage;
    if(!byStage[s])byStage[s]={count:0,expected:0,pigs:[]};
    byStage[s].count++;
    byStage[s].expected+=STAGE_FEED[s]||2.0;
    byStage[s].pigs.push(p);
  });

  // Per feed type cost analysis
  const byType={};
  feeds.forEach(f=>{
    const t=f.feedType||"Other";
    if(!byType[t])byType[t]={kg:0,cost:0,count:0};
    byType[t].kg+=parseFloat(f.kg)||0;
    byType[t].cost+=parseFloat(f.cost)||0;
    byType[t].count++;
  });

  // Last 30 days trend
  const now=new Date();
  const days30=feeds.filter(f=>{
    if(!f.date)return false;
    const d=new Date(f.date);
    return (now-d)/(1000*60*60*24)<=30;
  });
  const days30Kg=days30.reduce((s,f)=>s+(parseFloat(f.kg)||0),0);
  const days30Cost=days30.reduce((s,f)=>s+(parseFloat(f.cost)||0),0);
  const days30Cpk=days30Kg>0?Math.round(days30Cost/days30Kg):0;

  // Cost per pig per day
  const costPerPigDay=active.length>0&&logDays>0?Math.round(totalCost/logDays/active.length):0;

  // Detect overfeeding/underfeeding
  const overFed=effPct!==null&&effPct>120;
  const underFed=effPct!==null&&effPct<75;

  // Monthly cost trend
  const monthMap={};
  feeds.forEach(f=>{
    const m=(f.date||"").slice(0,7);
    if(!m)return;
    if(!monthMap[m])monthMap[m]={kg:0,cost:0};
    monthMap[m].kg+=parseFloat(f.kg)||0;
    monthMap[m].cost+=parseFloat(f.cost)||0;
  });
  const months=Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);
  const maxCost=Math.max(...months.map(([,v])=>v.cost),1);

  return(<div className="fade-in">
    <div style={S.h1}>🌾 Feed Efficiency</div>
    <div style={S.sub}>Actual vs expected · Cost trends · Waste detection · Per-pig analysis</div>

    {/* Alert banner */}
    {(overFed||underFed)&&<div style={{padding:"11px 16px",background:overFed?"rgba(245,158,11,.08)":"rgba(239,68,68,.08)",border:"1.5px solid "+(overFed?"rgba(245,158,11,.4)":"rgba(239,68,68,.4)"),borderRadius:10,marginBottom:14,fontSize:13,color:overFed?C.amber:C.red}}>
      {overFed?"⚠️ Overfeeding detected! Actual feed is "+effPct+"% of target — review portions to reduce waste and costs.":"🔴 Underfeeding alert! Actual feed is only "+effPct+"% of target — pigs may not be getting enough nutrition."}
    </div>}

    {/* KPI row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
      {[
        {l:"Feed Efficiency",v:effPct!==null?effPct+"%":"—",c:effColor},
        {l:"Actual/Day",v:actualDaily+"kg",c:C.text},
        {l:"Expected/Day",v:Math.round(expectedDaily*10)/10+"kg",c:C.muted},
        {l:"Avg Cost/kg",v:"RWF "+fmtNum(avgCpk),c:C.amber},
        {l:"Cost/Pig/Day",v:fmtRWF(costPerPigDay),c:C.blue},
        {l:"Last 30d Cost",v:fmtRWF(days30Cost),c:C.red},
      ].map(s=>(
        <div key={s.l} style={S.stat}>
          <div style={S.sl}>{s.l}</div>
          <div style={{...S.sv,color:s.c,fontSize:s.v.length>9?13:20}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* Efficiency bar */}
    {effPct!==null&&<div style={{...S.card,padding:"13px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:700,color:C.text}}>📊 Feed Efficiency Meter</span>
        <span style={{fontSize:13,fontWeight:700,color:effColor}}>{effPct}% of target</span>
      </div>
      <div style={{height:14,background:C.elevated,borderRadius:8,overflow:"hidden",marginBottom:6,position:"relative"}}>
        <div style={{position:"absolute",left:"75%",top:0,bottom:0,width:1,background:"rgba(239,68,68,.4)",zIndex:1}}/>
        <div style={{position:"absolute",left:"90%",top:0,bottom:0,width:1,background:C.accent+"66",zIndex:1}}/>
        <div style={{position:"absolute",left:"115%",top:0,bottom:0,width:1,background:"rgba(245,158,11,.4)",zIndex:1}}/>
        <div style={{height:"100%",width:Math.min(effPct,140)+"%",background:effColor,borderRadius:8,transition:"width .5s"}}/>
      </div>
      <div style={{display:"flex",gap:16,fontSize:10,color:C.faint}}>
        <span style={{color:C.red}}>▲ 75% min</span>
        <span style={{color:C.accent}}>▲ 90–115% ideal</span>
        <span style={{color:C.amber}}>▲ 120%+ overfeeding</span>
      </div>
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["overview","📊 By Stage"],["type","🌾 By Feed Type"],["trend","📅 Monthly Trend"],["pigs","🐷 Per Pig"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* BY STAGE */}
    {tab==="overview"&&<div>
      {Object.keys(byStage).length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No active pigs. Add pigs to see stage analysis.</div>}
      {Object.entries(byStage).map(([stage,data])=>{
        const expD=Math.round(data.expected*10)/10;
        return(<div key={stage} style={{...S.card,marginBottom:10,borderLeft:"3px solid "+C.accent}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>{stage}</div>
              <div style={{fontSize:11,color:C.faint}}>{data.count} pig{data.count>1?"s":""} · {expD}kg/day total expected</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:C.muted}}>Standard: {STAGE_FEED[stage]||2}kg/pig/day</div>
              <div style={{fontSize:12,color:C.accent,fontWeight:700}}>Expected: {expD}kg/day</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {data.pigs.map(p=>(
              <div key={p.id} style={{background:C.elevated,borderRadius:7,padding:"6px 10px",fontSize:11,border:"1px solid "+C.border}}>
                <div style={{fontWeight:600,color:C.text}}>{p.tag}</div>
                <div style={{color:C.faint,marginTop:2}}>{p.weight}kg · {STAGE_FEED[p.stage]||2}kg feed/day</div>
              </div>
            ))}
          </div>
        </div>);
      })}
      {active.length>0&&<div style={{...S.card,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.2)"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:8}}>📐 Total Herd Feed Budget</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,fontSize:12}}>
          {[
            ["Expected/day",Math.round(expectedDaily*10)/10+"kg"],
            ["Expected/month",Math.round(expectedDaily*30)+"kg"],
            ["Est. monthly cost",fmtRWF(Math.round(expectedDaily*30*avgCpk))],
          ].map(([l,v])=>(<div key={l} style={{background:C.surface,borderRadius:7,padding:"8px 10px",textAlign:"center",border:"1px solid "+C.border}}>
            <div style={{color:C.faint,fontSize:10}}>{l}</div>
            <div style={{fontWeight:700,color:C.text,marginTop:3}}>{v}</div>
          </div>))}
        </div>
      </div>}
    </div>}

    {/* BY FEED TYPE */}
    {tab==="type"&&<div>
      {Object.keys(byType).length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No feed records yet.</div>}
      {Object.entries(byType).sort((a,b)=>b[1].cost-a[1].cost).map(([type,data])=>{
        const cpk=data.kg>0?Math.round(data.cost/data.kg):0;
        const ref=FEED_REF[type]||0;
        const pct=totalCost>0?((data.cost/totalCost)*100).toFixed(1):0;
        const expensive=ref>0&&cpk>ref*1.25;
        const cheap=ref>0&&cpk<ref*0.75;
        return(<div key={type} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,color:C.text,fontSize:14}}>🌾 {type}</div>
              <div style={{fontSize:11,color:C.faint}}>{data.count} sessions · {Math.round(data.kg*10)/10}kg total</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:C.amber}}>{fmtRWF(data.cost)}</div>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(245,158,11,.1)",color:C.amber}}>{pct}% of feed budget</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12,marginBottom:8}}>
            {[["Avg Cost/kg","RWF "+fmtNum(cpk)],["Ref Price","RWF "+fmtNum(ref)||"N/A"],["vs Reference",ref>0?(cpk>ref?"+":"")+(cpk-ref)+" RWF/kg":"—"]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"7px 10px",textAlign:"center"}}>
                <div style={{color:C.faint,fontSize:10}}>{l}</div>
                <div style={{fontWeight:700,color:l==="vs Reference"?(expensive?C.red:cheap?C.accent:C.text):C.text,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
          {expensive&&<div style={{fontSize:11,color:C.red,padding:"6px 10px",background:"rgba(239,68,68,.06)",borderRadius:6}}>⚠️ Price is 25%+ above reference — consider alternative suppliers</div>}
          {cheap&&<div style={{fontSize:11,color:C.accent,padding:"6px 10px",background:"rgba(22,163,74,.06)",borderRadius:6}}>✅ Good price — {Math.round((1-cpk/ref)*100)}% below reference</div>}
          <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden",marginTop:8}}>
            <div style={{height:"100%",width:pct+"%",background:C.amber,borderRadius:3}}/>
          </div>
        </div>);
      })}
    </div>}

    {/* MONTHLY TREND */}
    {tab==="trend"&&<div>
      {months.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No feed data yet.</div>}
      {months.map(([m,data])=>{
        const cpk=data.kg>0?Math.round(data.cost/data.kg):0;
        const label=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.split("-")[1])-1]+" "+m.split("-")[0].slice(2);
        return(<div key={m} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontWeight:700,color:C.text}}>{label}</span>
            <span style={{color:C.amber,fontWeight:700}}>{fmtRWF(data.cost)}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12,marginBottom:6}}>
            {[["Feed (kg)",Math.round(data.kg*10)/10+"kg"],["Total Cost",fmtRWF(data.cost)],["Avg/kg","RWF "+fmtNum(cpk)]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                <div style={{color:C.faint,fontSize:10}}>{l}</div>
                <div style={{fontWeight:700,color:C.text,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{height:6,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:(data.cost/maxCost*100)+"%",background:C.amber,borderRadius:3,transition:"width .5s"}}/>
          </div>
        </div>);
      })}
    </div>}

    {/* PER PIG */}
    {tab==="pigs"&&<div>
      {active.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No active pigs.</div>}
      {active.map(p=>{
        const pigFeeds=feeds.filter(f=>f.pigId===p.id);
        const pigKg=pigFeeds.reduce((s,f)=>s+(parseFloat(f.kg)||0),0);
        const pigCost=pigFeeds.reduce((s,f)=>s+(parseFloat(f.cost)||0),0);
        const pigDays=pigFeeds.length>0?new Set(pigFeeds.map(f=>f.date)).size:0;
        const pigCpk=pigKg>0?Math.round(pigCost/pigKg):0;
        const stdFeed=STAGE_FEED[p.stage]||2.0;
        return(<div key={p.id} style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>🐷 {p.tag}</div>
              <div style={{fontSize:11,color:C.faint}}>{p.stage} · {p.weight}kg · {p.breed}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:C.accent,fontWeight:700}}>Standard: {stdFeed}kg/day</div>
              {pigDays>0&&<div style={{fontSize:11,color:C.muted}}>Recorded: {pigDays} days</div>}
            </div>
          </div>
          {pigDays>0?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,fontSize:12}}>
              {[["Total Feed",Math.round(pigKg*10)/10+"kg"],["Total Cost",fmtRWF(pigCost)],["Avg/kg","RWF "+fmtNum(pigCpk)],["Avg/day",(pigDays>0?Math.round(pigKg/pigDays*10)/10:0)+"kg"]].map(([l,v])=>(
                <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                  <div style={{color:C.faint,fontSize:10}}>{l}</div>
                  <div style={{fontWeight:700,color:C.text,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          ):<div style={{fontSize:12,color:C.faint,textAlign:"center",padding:"8px 0"}}>No individual feed logs for this pig. Feeds logged as "All pigs" are not counted per-pig.</div>}
        </div>);
      })}
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   PIG PERFORMANCE MODULE
   Individual weight tracking, ADG, market readiness
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   HERD INTELLIGENCE — replaces basic PigPerformance
   Growth vs Feed · Sow Productivity · Profit per pig
   Decisions: Keep / Sell / Cull / Breed
═══════════════════════════════════════════════════ */
function PigPerformance({pigs,feeds,sales,logs,expenses,incomes,reproductions}){
  const [tab,setTab]=useState("growth");
  const [sortGrowth,setSortGrowth]=useState("score");
  const [sortSow,setSortSow]=useState("piglets");
  const active=pigs.filter(p=>p.status==="active");
  const allSold=pigs.filter(p=>p.status==="sold");

  /* ── Constants ── */
  const ADG={Piglet:0.20,Weaner:0.35,Grower:0.50,Finisher:0.65,Gilt:0.40,Sow:0.05,Boar:0.05};
  const IDEAL_FCR={Piglet:1.8,Weaner:2.2,Grower:2.5,Finisher:2.8,Gilt:2.6,Sow:3.0,Boar:3.0}; // kg feed / kg gain
  const STAGE_FEED={Piglet:0.5,Weaner:1.0,Grower:1.8,Finisher:2.8,Gilt:2.2,Sow:2.5,Boar:2.0};
  const IDEAL_ADG={Piglet:0.22,Weaner:0.38,Grower:0.55,Finisher:0.70,Gilt:0.45,Sow:0.05,Boar:0.05};

  /* ── Per-pig feed cost ── */
  function pigFeedKgCost(pig){
    const pf=feeds.filter(f=>f.pigId===pig.id);
    const allFeeds=feeds.filter(f=>!f.pigId); // feeds logged to "all pigs"
    const perHead=active.length>0?allFeeds.reduce((s,f)=>s+(f.cost||0),0)/active.length:0;
    const directCost=pf.reduce((s,f)=>s+(f.cost||0),0);
    const directKg=pf.reduce((s,f)=>s+(f.kg||0),0);
    return{feedCost:Math.round(directCost+perHead),feedKg:Math.round((directKg+(allFeeds.reduce((s,f)=>s+(f.kg||0),0)/Math.max(active.length,1)))*10)/10};
  }

  /* ── Per-pig sale revenue ── */
  function pigSaleRevenue(pig){
    const s=sales.filter(x=>x.pigId===pig.id);
    return s.reduce((t,x)=>t+(x.total||0),0);
  }

  /* ── Growth score: actual weight vs expected for age/stage ── */
  function growthScore(pig){
    const ageDays=pig.dob?Math.round((new Date()-new Date(pig.dob))/(1000*60*60*24)):null;
    const adg=ADG[pig.stage]||0.5;
    const {feedKg,feedCost}=pigFeedKgCost(pig);

    // FCR: kg feed per kg weight (vs ideal)
    const estGain=ageDays&&ageDays>0?Math.min(pig.weight,adg*ageDays):pig.weight;
    const fcr=estGain>0&&feedKg>0?Math.round((feedKg/estGain)*10)/10:null;
    const idealFcr=IDEAL_FCR[pig.stage]||2.8;
    const fcrScore=fcr?Math.max(0,Math.min(40,Math.round((idealFcr/fcr)*40))):20; // 40pts

    // Weight score: current vs stage benchmark
    const benchmarks={Piglet:8,Weaner:20,Grower:40,Finisher:70,Gilt:75,Sow:130,Boar:150};
    const bench=benchmarks[pig.stage]||40;
    const wtScore=Math.min(40,Math.round((pig.weight/bench)*40)); // 40pts

    // ADG vs ideal (estimate if no dob)
    const adgEst=ageDays&&ageDays>30?pig.weight/ageDays:adg;
    const adgIdeal=IDEAL_ADG[pig.stage]||0.5;
    const adgScore=Math.min(20,Math.round((adgEst/adgIdeal)*20)); // 20pts

    const total=Math.min(100,fcrScore+wtScore+adgScore);
    return{total,fcrScore,wtScore,adgScore,fcr,feedCost,feedKg,ageDays,adgEst:Math.round(adgEst*100)/100};
  }

  /* ── Decision engine ── */
  function decision(pig,score,repr){
    const s=score.total;
    const val=getMarketPrice(pig.stage,pig.weight);
    const feedCost=score.feedCost;
    const isSow=pig.stage==="Sow"||pig.stage==="Gilt";
    const isBoar=pig.stage==="Boar";
    const reprRecords=repr.filter(r=>r.sowId===pig.id);
    const farrowedR=reprRecords.filter(r=>r.status==="farrowed");
    const avgLitter=farrowedR.length>0?farrowedR.reduce((t,r)=>t+(r.piglets||0),0)/farrowedR.length:0;

    if(pig.weight>=80&&!isSow&&!isBoar){
      return{label:"🏷️ SELL NOW",color:"#16a34a",bg:"rgba(22,163,74,.08)",reason:`Market ready at ${pig.weight}kg — est. ${fmtRWF(val)}`};
    }
    if(isSow&&farrowedR.length>0&&avgLitter<6){
      return{label:"⚠️ REVIEW SOW",color:C.amber,bg:"rgba(245,158,11,.06)",reason:`Low avg litter size: ${avgLitter.toFixed(1)} piglets/litter (target ≥8). Consider culling.`};
    }
    if(isSow&&farrowedR.length>=2&&avgLitter>=9){
      return{label:"⭐ KEEP — TOP SOW",color:C.purple,bg:"rgba(124,58,237,.06)",reason:`Excellent: ${avgLitter.toFixed(1)} piglets/litter avg. Priority breeding animal.`};
    }
    if(isSow&&reprRecords.length===0){
      return{label:"🐖 BREED SOON",color:C.blue,bg:"rgba(37,99,235,.06)",reason:"No mating recorded yet. Schedule mating to generate income."};
    }
    if(s>=80){
      return{label:"✅ GROWING WELL",color:C.accent,bg:"rgba(22,163,74,.06)",reason:`High growth score (${s}/100). Continue current feeding routine.`};
    }
    if(s>=55){
      return{label:"⏳ ON TRACK",color:C.muted,bg:C.elevated,reason:`Moderate score (${s}/100). Monitor closely and maintain feed quality.`};
    }
    if(s<40&&feedCost>val*0.8){
      return{label:"🔴 CULL / SELL",color:C.red,bg:"rgba(239,68,68,.06)",reason:`Poor growth (${s}/100) + high feed cost vs value. Selling now reduces losses.`};
    }
    return{label:"📋 MONITOR",color:C.amber,bg:"rgba(245,158,11,.06)",reason:`Below average growth (${s}/100). Adjust diet or check for illness.`};
  }

  /* ── Sow Productivity ── */
  function sowStats(sow){
    const records=reproductions.filter(r=>r.sowId===sow.id);
    const farrowed=records.filter(r=>r.status==="farrowed");
    const totalPiglets=farrowed.reduce((s,r)=>s+(r.piglets||0),0);
    const avgLitter=farrowed.length>0?totalPiglets/farrowed.length:0;
    const pigletValue=totalPiglets*10000;
    const {feedCost}=pigFeedKgCost(sow);
    const roi=feedCost>0?Math.round(((pigletValue-feedCost)/feedCost)*100):null;
    const pregnant=records.find(r=>r.status==="pregnant");
    return{records:records.length,farrowed:farrowed.length,totalPiglets,avgLitter:Math.round(avgLitter*10)/10,pigletValue,feedCost,roi,pregnant};
  }

  /* ── Compute data ── */
  const sows=active.filter(p=>p.stage==="Sow"||p.stage==="Gilt");
  const growers=active.filter(p=>["Grower","Finisher","Weaner","Piglet"].includes(p.stage));

  // Growth data for all active
  const growthData=active.map(pig=>{
    const score=growthScore(pig);
    const dec=decision(pig,score,reproductions||[]);
    const val=getMarketPrice(pig.stage,pig.weight);
    const dtm=pig.weight>=80?0:Math.round((80-pig.weight)/(ADG[pig.stage]||0.5));
    return{pig,score,dec,val,dtm};
  }).sort((a,b)=>{
    if(sortGrowth==="score")return b.score.total-a.score.total;
    if(sortGrowth==="dtm")return a.dtm-b.dtm;
    if(sortGrowth==="fcr")return (a.score.fcr||99)-(b.score.fcr||99);
    if(sortGrowth==="value")return b.val-a.val;
    return 0;
  });

  // Sow data
  const sowData=sows.map(sow=>{
    const st=sowStats(sow);
    return{sow,st};
  }).sort((a,b)=>{
    if(sortSow==="piglets")return b.st.totalPiglets-a.st.totalPiglets;
    if(sortSow==="litter")return b.st.avgLitter-a.st.avgLitter;
    if(sortSow==="roi")return (b.st.roi||0)-(a.st.roi||0);
    return 0;
  });

  // Summary stats
  const readyNow=active.filter(p=>p.weight>=80&&p.stage!=="Sow"&&p.stage!=="Boar");
  const sellPotential=readyNow.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0);
  const bestSow=sowData.length>0?sowData.sort((a,b)=>b.st.totalPiglets-a.st.totalPiglets)[0]:null;
  const avgGrowthScore=growthData.length>0?Math.round(growthData.reduce((s,d)=>s+d.score.total,0)/growthData.length):0;
  const cullCount=growthData.filter(d=>d.dec.label.includes("CULL")||d.dec.label.includes("REVIEW")).length;
  const totalPigletsAllSows=sowData.reduce((s,d)=>s+d.st.totalPiglets,0);

  return(<div className="fade-in">
    <div style={S.h1}>🧬 Herd Intelligence</div>
    <div style={S.sub}>Growth vs feed · Sow productivity · Profit per pig · Smart decisions</div>

    {/* KPI row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
      {[
        {l:"Market Ready",v:readyNow.length+" pigs",c:C.accent},
        {l:"Sell Potential",v:fmtRWF(sellPotential),c:"#10b981"},
        {l:"Avg Growth Score",v:avgGrowthScore+"/100",c:avgGrowthScore>=70?C.accent:avgGrowthScore>=50?C.amber:C.red},
        {l:"Action Needed",v:cullCount+" pigs",c:cullCount>0?C.red:C.accent},
        {l:"Total Sows",v:sows.length,c:C.pink},
        {l:"Total Piglets Born",v:totalPigletsAllSows,c:C.purple},
      ].map(s=>(
        <div key={s.l} style={S.stat}>
          <div style={S.sl}>{s.l}</div>
          <div style={{...S.sv,color:s.c,fontSize:s.v.toString().length>9?13:20}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* Banner alerts */}
    {readyNow.length>0&&<div style={{padding:"11px 16px",background:"rgba(22,163,74,.08)",border:"1.5px solid rgba(22,163,74,.35)",borderRadius:10,marginBottom:10,fontSize:13,color:C.accent,fontWeight:600}}>
      🏷️ {readyNow.length} pig{readyNow.length>1?"s":""} ready to sell — {fmtRWF(sellPotential)} potential revenue
    </div>}
    {cullCount>0&&<div style={{padding:"11px 16px",background:"rgba(239,68,68,.06)",border:"1.5px solid rgba(239,68,68,.3)",borderRadius:10,marginBottom:10,fontSize:13,color:C.red}}>
      ⚠️ {cullCount} pig{cullCount>1?"s":""} flagged for review — poor growth relative to feed cost
    </div>}
    {bestSow&&<div style={{padding:"11px 16px",background:"rgba(124,58,237,.06)",border:"1.5px solid rgba(124,58,237,.3)",borderRadius:10,marginBottom:14,fontSize:13,color:C.purple}}>
      ⭐ Best sow: <b>{bestSow.sow.tag}</b> — {bestSow.st.totalPiglets} piglets born, avg litter {bestSow.st.avgLitter} — worth {fmtRWF(bestSow.st.pigletValue)}
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["growth","📈 Growth & Feed"],["sows","🐖 Sow Productivity"],["decisions","🎯 Decision Board"],["profit","💰 Profit per Pig"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* ══ GROWTH & FEED TAB ══ */}
    {tab==="growth"&&<div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:12,color:C.faint}}>Sort by:</span>
        {[["score","Growth Score"],["dtm","Days to Market"],["fcr","Feed Efficiency"],["value","Market Value"]].map(([v,l])=>(
          <button key={v} onClick={()=>setSortGrowth(v)} style={{padding:"5px 11px",borderRadius:7,border:"1px solid "+(sortGrowth===v?C.accent:C.border),background:sortGrowth===v?C.accent:"transparent",color:sortGrowth===v?"#fff":C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:sortGrowth===v?700:400}}>{l}</button>
        ))}
      </div>
      {growthData.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No active pigs.</div>}
      {growthData.map(({pig,score,dec,val,dtm})=>{
        const scoreColor=score.total>=75?C.accent:score.total>=50?C.amber:C.red;
        const fcrGood=score.fcr&&score.fcr<=IDEAL_FCR[pig.stage];
        return(<div key={pig.id} style={{...S.card,marginBottom:12,borderLeft:"4px solid "+dec.color}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:15,color:C.text}}>🐷 {pig.tag}</span>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:dec.bg,color:dec.color,fontWeight:700,border:"1px solid "+dec.color+"33"}}>{dec.label}</span>
              </div>
              <div style={{fontSize:11,color:C.faint,marginTop:3}}>{pig.breed} · {pig.gender} · {pig.stage} · {pig.weight}kg</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,fontSize:15,color:C.purple}}>{fmtRWF(val)}</div>
              <div style={{fontSize:10,color:C.faint}}>{dtm===0?"Ready to sell":dtm+" days to market"}</div>
            </div>
          </div>

          {/* Growth score bar */}
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{color:C.muted,fontWeight:600}}>Overall Growth Score</span>
              <span style={{color:scoreColor,fontWeight:800}}>{score.total}/100</span>
            </div>
            <div style={{height:10,background:C.elevated,borderRadius:6,overflow:"hidden",marginBottom:4}}>
              <div style={{height:"100%",width:score.total+"%",background:score.total>=75?"linear-gradient(90deg,#22c55e,#16a34a)":score.total>=50?"linear-gradient(90deg,#f59e0b,#d97706)":"linear-gradient(90deg,#ef4444,#dc2626)",borderRadius:6,transition:"width .6s"}}/>
            </div>
            {/* Sub-score breakdown */}
            <div style={{display:"flex",gap:6,fontSize:10,color:C.faint}}>
              <span style={{color:C.blue}}>Weight: {score.wtScore}/40</span>
              <span>·</span>
              <span style={{color:C.accent}}>Feed Conv.: {score.fcrScore}/40</span>
              <span>·</span>
              <span style={{color:C.amber}}>Growth Rate: {score.adgScore}/20</span>
            </div>
          </div>

          {/* Weight progress to 80kg */}
          {pig.stage!=="Sow"&&pig.stage!=="Boar"&&<div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span style={{color:C.muted}}>Progress to market (80kg)</span>
              <span style={{fontWeight:700,color:pig.weight>=80?C.accent:C.text}}>{pig.weight}kg / 80kg</span>
            </div>
            <div style={{height:7,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.min((pig.weight/80)*100,100)+"%",background:pig.weight>=80?"#16a34a":pig.weight>=65?"#f59e0b":"#3b82f6",borderRadius:4,transition:"width .5s"}}/>
            </div>
          </div>}

          {/* Metrics grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:7,fontSize:11,marginBottom:10}}>
            {[
              ["Feed Used",score.feedKg+"kg"],
              ["Feed Cost",fmtRWF(score.feedCost)],
              ["FCR",score.fcr?score.fcr+"x":"N/A"],
              ["ADG Est.",score.adgEst+"kg/day"],
              ["Age",score.ageDays?score.ageDays+"d":"Unknown"],
              ["Market Val",fmtRWF(val)],
            ].map(([l,v])=>(
              <div key={l} style={{background:l==="FCR"&&score.fcr?(fcrGood?"rgba(22,163,74,.07)":"rgba(239,68,68,.06)"):C.elevated,borderRadius:6,padding:"6px 8px",textAlign:"center",border:"1px solid "+(l==="FCR"&&score.fcr?(fcrGood?"rgba(22,163,74,.2)":"rgba(239,68,68,.2)"):C.border)}}>
                <div style={{color:C.faint,fontSize:9,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:l==="FCR"&&score.fcr?(fcrGood?C.accent:C.red):C.text,fontSize:11}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Decision reason */}
          <div style={{padding:"7px 11px",background:dec.bg,borderRadius:7,fontSize:12,color:dec.color,fontWeight:500,border:"1px solid "+dec.color+"22"}}>
            💡 {dec.reason}
          </div>

          {/* FCR warning */}
          {score.fcr&&!fcrGood&&<div style={{marginTop:7,fontSize:11,color:C.red,padding:"5px 10px",background:"rgba(239,68,68,.05)",borderRadius:6}}>
            ⚠️ FCR {score.fcr}x exceeds ideal ({IDEAL_FCR[pig.stage]}x for {pig.stage}) — pig consuming more feed per kg of body weight than expected
          </div>}
        </div>);
      })}
    </div>}

    {/* ══ SOW PRODUCTIVITY TAB ══ */}
    {tab==="sows"&&<div>
      {sows.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No sows or gilts in herd.</div>}

      {/* Leaderboard header */}
      {sowData.length>0&&<div style={{...S.card,background:"linear-gradient(135deg,rgba(124,58,237,.06),rgba(219,39,119,.04))",border:"1px solid rgba(124,58,237,.2)",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:10}}>🏆 Sow Productivity Leaderboard</div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {[["piglets","Most Piglets"],["litter","Best Litter Size"],["roi","Best ROI"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSortSow(v)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+(sortSow===v?C.purple:C.border),background:sortSow===v?C.purple:"transparent",color:sortSow===v?"#fff":C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        {sowData.slice(0,3).map(({sow,st},i)=>(
          <div key={sow.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:i===0?"rgba(124,58,237,.08)":C.elevated,marginBottom:6,border:"1px solid "+(i===0?"rgba(124,58,237,.2)":C.border)}}>
            <span style={{fontSize:20,minWidth:28,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":"🥉"}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:C.text}}>{sow.tag} <span style={{fontWeight:400,color:C.faint,fontSize:11}}>({sow.breed})</span></div>
              <div style={{fontSize:11,color:C.muted}}>Litters: {st.farrowed} · Avg: {st.avgLitter} piglets · Total: {st.totalPiglets} 🐷</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:C.purple,fontSize:13}}>{fmtRWF(st.pigletValue)}</div>
              {st.roi!==null&&<div style={{fontSize:10,color:st.roi>=0?C.accent:C.red}}>ROI: {st.roi}%</div>}
            </div>
          </div>
        ))}
      </div>}

      {/* Full sow cards */}
      {sowData.map(({sow,st},idx)=>{
        const pregnant=st.pregnant;
        const noRecord=st.records===0;
        const lowLitter=st.farrowed>0&&st.avgLitter<6;
        const topSow=st.farrowed>=2&&st.avgLitter>=9;
        let badge={label:"",color:C.muted};
        if(topSow)badge={label:"⭐ Top Sow",color:C.purple};
        else if(noRecord)badge={label:"🐖 Not Mated",color:C.blue};
        else if(pregnant)badge={label:"🤰 Pregnant",color:C.amber};
        else if(lowLitter)badge={label:"⚠️ Low Litter",color:C.red};
        else if(st.farrowed>0)badge={label:"✅ Active",color:C.accent};

        return(<div key={sow.id} style={{...S.card,marginBottom:12,borderLeft:"4px solid "+badge.color}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:15,color:C.text}}>🐖 {sow.tag}</span>
                {badge.label&&<span style={{fontSize:10,padding:"2px 9px",borderRadius:20,background:badge.color+"18",color:badge.color,fontWeight:700,border:"1px solid "+badge.color+"33"}}>{badge.label}</span>}
                {idx===0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(124,58,237,.1)",color:C.purple,fontWeight:700}}>🏆 #1 Producer</span>}
              </div>
              <div style={{fontSize:11,color:C.faint,marginTop:3}}>{sow.breed} · {sow.stage} · {sow.weight}kg</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,fontSize:15,color:C.purple}}>{fmtRWF(st.pigletValue)}</div>
              <div style={{fontSize:10,color:C.faint}}>Lifetime piglet value</div>
            </div>
          </div>

          {/* Metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8,marginBottom:12}}>
            {[
              {l:"Litters",v:st.farrowed,c:C.text},
              {l:"Avg Litter",v:st.avgLitter+" 🐷",c:st.avgLitter>=9?C.accent:st.avgLitter>=7?C.amber:st.farrowed>0?C.red:C.faint},
              {l:"Total Piglets",v:st.totalPiglets,c:C.purple},
              {l:"Piglet Value",v:fmtRWF(st.pigletValue),c:"#10b981"},
              {l:"Feed Cost",v:fmtRWF(st.feedCost),c:C.red},
              {l:"ROI",v:st.roi!==null?st.roi+"%":"N/A",c:st.roi===null?C.faint:st.roi>=0?C.accent:C.red},
            ].map(s=>(
              <div key={s.l} style={{background:C.elevated,borderRadius:7,padding:"7px 8px",textAlign:"center",border:"1px solid "+C.border}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{s.l}</div>
                <div style={{fontWeight:700,color:s.c,fontSize:12}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Litter size visual */}
          {st.farrowed>0&&<div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Avg litter vs target (≥8 piglets)</div>
            <div style={{height:7,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.min((st.avgLitter/10)*100,100)+"%",background:st.avgLitter>=9?"#16a34a":st.avgLitter>=7?"#f59e0b":"#ef4444",borderRadius:4,transition:"width .5s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.faint,marginTop:2}}>
              <span>0</span><span style={{color:C.amber}}>▲6 min</span><span style={{color:C.accent}}>▲8 target</span><span>10+</span>
            </div>
          </div>}

          {/* Decision */}
          <div style={{padding:"8px 11px",borderRadius:8,fontSize:12,fontWeight:600,border:"1px solid "+badge.color+"33",background:badge.color+"0d",color:badge.color}}>
            {topSow&&"💡 Keep and prioritize breeding — top genetic asset for your herd"}
            {lowLitter&&!topSow&&"💡 Low litter size. Consider replacing with a younger, more productive sow."}
            {noRecord&&"💡 No mating on record. Schedule mating to start generating piglet income."}
            {pregnant&&!topSow&&!lowLitter&&!noRecord&&"💡 Currently pregnant. Prepare farrowing pen and increase feed to 3kg/day."}
            {!topSow&&!lowLitter&&!noRecord&&!pregnant&&st.farrowed>0&&"💡 Performing adequately. Continue monitoring litter size trends."}
          </div>
        </div>);
      })}
    </div>}

    {/* ══ DECISION BOARD TAB ══ */}
    {tab==="decisions"&&<div>
      <div style={{fontSize:13,color:C.muted,marginBottom:14}}>Recommended actions for each pig based on growth score, feed cost, and market value.</div>
      {/* Group by decision */}
      {[
        {key:"SELL NOW",label:"🏷️ Sell Now",color:"#16a34a",desc:"Market-ready or cost-effective to sell immediately"},
        {key:"TOP SOW",label:"⭐ Top Sows — Keep",color:C.purple,desc:"High-producing sows — protect and breed regularly"},
        {key:"BREED",label:"🐖 Breed Soon",color:C.blue,desc:"Unmated sows — schedule mating now"},
        {key:"GROWING WELL",label:"✅ Growing Well",color:C.accent,desc:"On track — maintain current routine"},
        {key:"ON TRACK",label:"⏳ Monitor",color:C.muted,desc:"Average progress — watch feed efficiency"},
        {key:"REVIEW SOW",label:"⚠️ Review Sow",color:C.amber,desc:"Low litter size — evaluate culling"},
        {key:"MONITOR",label:"📋 Monitor Closely",color:C.amber,desc:"Below average growth — check feed and health"},
        {key:"CULL",label:"🔴 Cull / Sell",color:C.red,desc:"Poor growth + high cost — act soon"},
      ].map(({key,label,color,desc})=>{
        const group=growthData.filter(d=>d.dec.label.includes(key));
        if(group.length===0)return null;
        return(<div key={key} style={{...S.card,marginBottom:12,borderLeft:"4px solid "+color}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color}}>{label} ({group.length})</div>
              <div style={{fontSize:11,color:C.muted}}>{desc}</div>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {group.map(({pig,score,val})=>(
              <div key={pig.id} style={{background:color+"0f",border:"1px solid "+color+"33",borderRadius:8,padding:"7px 12px",minWidth:130}}>
                <div style={{fontWeight:700,fontSize:13,color:C.text}}>🐷 {pig.tag}</div>
                <div style={{fontSize:10,color:C.faint,marginTop:2}}>{pig.stage} · {pig.weight}kg</div>
                <div style={{fontSize:11,color,fontWeight:700,marginTop:3}}>{fmtRWF(val)}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>Score: {score.total}/100</div>
              </div>
            ))}
          </div>
        </div>);
      })}
    </div>}

    {/* ══ PROFIT PER PIG TAB ══ */}
    {tab==="profit"&&<div>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Estimated profit per pig = market value − estimated feed cost share.</div>
      {/* Sold pigs with actual profit */}
      {allSold.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:10}}>✅ Sold Pigs — Actual Profit</div>
        {allSold.map(pig=>{
          const rev=pigSaleRevenue(pig);
          const {feedCost}=pigFeedKgCost(pig);
          const profit=rev-feedCost;
          return(<div key={pig.id} style={{...S.card,marginBottom:8,borderLeft:"3px solid "+(profit>=0?C.accent:C.red)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:C.text}}>🐷 {pig.tag} <span style={{fontSize:10,color:C.faint,fontWeight:400}}>({pig.stage} · {pig.breed})</span></div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>Sale revenue: {fmtRWF(rev)} · Feed cost: {fmtRWF(feedCost)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:15,color:profit>=0?C.accent:C.red}}>{profit>=0?"+":""}{fmtRWF(profit)}</div>
                <div style={{fontSize:10,color:C.faint}}>Net profit</div>
              </div>
            </div>
          </div>);
        })}
      </div>}

      {/* Active pigs estimated profit */}
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📊 Active Pigs — Estimated Profit at Sale</div>
      {growthData.map(({pig,score,val})=>{
        const feedCost=score.feedCost;
        const estProfit=val-feedCost;
        const margin=val>0?Math.round((estProfit/val)*100):0;
        return(<div key={pig.id} style={{...S.card,marginBottom:8,borderLeft:"3px solid "+(estProfit>=0?C.accent:C.red)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:C.text}}>🐷 {pig.tag} <span style={{fontSize:10,color:C.faint,fontWeight:400}}>{pig.stage} · {pig.weight}kg</span></div>
              <div style={{display:"flex",gap:12,fontSize:11,color:C.faint,marginTop:3,flexWrap:"wrap"}}>
                <span>Market value: <b style={{color:C.purple}}>{fmtRWF(val)}</b></span>
                <span>Feed cost: <b style={{color:C.red}}>{fmtRWF(feedCost)}</b></span>
                <span>Margin: <b style={{color:margin>=30?C.accent:margin>=0?C.amber:C.red}}>{margin}%</b></span>
              </div>
              <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden",marginTop:6}}>
                <div style={{height:"100%",width:Math.max(0,Math.min(margin,100))+"%",background:margin>=30?C.accent:margin>=0?C.amber:C.red,borderRadius:3}}/>
              </div>
            </div>
            <div style={{textAlign:"right",minWidth:90}}>
              <div style={{fontWeight:800,fontSize:15,color:estProfit>=0?C.accent:C.red}}>{estProfit>=0?"+":""}{fmtRWF(estProfit)}</div>
              <div style={{fontSize:10,color:C.faint}}>Est. profit</div>
            </div>
          </div>
        </div>);
      })}
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   SMART ALERTS MODULE
   Consolidates all farm alerts in one place
═══════════════════════════════════════════════════ */
function SmartAlerts({pigs,feeds,logs,sales,expenses,incomes,reproductions,stock,users,tasks,vaccinations,capital,setPage}){
  const active=pigs.filter(p=>p.status==="active");
  const today=toDay();
  const [waSending,setWASending]=useState(false);
  const [waStatus,setWAStatus]=useState("");

  // Build all alerts
  const alerts=[];

  // Market ready pigs
  const ready=active.filter(p=>p.weight>=80);
  if(ready.length>0) alerts.push({
    cat:"💰 Sales",priority:1,color:"#16a34a",
    title:`${ready.length} pig${ready.length>1?"s":""} market-ready (80kg+)`,
    body:`Potential revenue: ${fmtRWF(ready.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0))}`,
    action:()=>setPage&&setPage("performance")
  });

  // Almost ready
  const almost=active.filter(p=>p.weight>=65&&p.weight<80);
  if(almost.length>0) alerts.push({
    cat:"📈 Growth",priority:2,color:C.amber,
    title:`${almost.length} pig${almost.length>1?"s":""} almost at market weight (65–79kg)`,
    body:"Start preparing buyers and transport",
    action:null
  });

  // Low stock
  const lowStock=(stock||[]).filter(s=>s.quantity<=s.minLevel);
  if(lowStock.length>0) alerts.push({
    cat:"📦 Stock",priority:1,color:C.red,
    title:`Low stock: ${lowStock.map(s=>s.name).join(", ")}`,
    body:`${lowStock.length} item${lowStock.length>1?"s":""} below minimum level`,
    action:()=>setPage&&setPage("stock")
  });

  // Reproduction — overdue
  const overdue=(reproductions||[]).filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)<0);
  overdue.forEach(r=>{
    const sow=pigs.find(p=>p.id===r.sowId);
    alerts.push({
      cat:"🐖 Breeding",priority:0,color:C.red,
      title:`🚨 OVERDUE: ${sow?sow.tag:"Sow"} is ${Math.abs(daysDiff(r.expectedFarrow))} day(s) overdue!`,
      body:"Check immediately — may need veterinary assistance",
      action:()=>setPage&&setPage("reproduction")
    });
  });

  // Farrowing soon
  const farrowSoon=(reproductions||[]).filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)>=0&&daysDiff(r.expectedFarrow)<=7);
  if(farrowSoon.length>0) alerts.push({
    cat:"🐖 Breeding",priority:1,color:C.purple,
    title:`${farrowSoon.length} sow${farrowSoon.length>1?"s":""} due to farrow within 7 days`,
    body:"Prepare farrowing pens, bedding, and heat lamps",
    action:()=>setPage&&setPage("reproduction")
  });

  // Sick pigs from today's logs
  const todayLogs=logs.filter(l=>l.date===today&&l.sick>0);
  if(todayLogs.length>0){
    const totalSick=todayLogs.reduce((s,l)=>s+(l.sick||0),0);
    alerts.push({
      cat:"🏥 Health",priority:0,color:C.red,
      title:`${totalSick} sick pig${totalSick>1?"s":""} reported today`,
      body:"Review health logs and contact vet if needed",
      action:()=>setPage&&setPage("daylogs")
    });
  }

  // Deaths this week
  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const recentDeaths=logs.filter(l=>{
    if(!l.date||l.deaths<=0)return false;
    return new Date(l.date)>=weekAgo;
  });
  if(recentDeaths.length>0){
    const total=recentDeaths.reduce((s,l)=>s+(l.deaths||0),0);
    alerts.push({
      cat:"🏥 Health",priority:1,color:C.red,
      title:`${total} death${total>1?"s":""} recorded this week`,
      body:"Review cause — consider vaccination or biosecurity review",
      action:null
    });
  }

  // No daily log today
  const todayLogExists=logs.some(l=>l.date===today);
  if(!todayLogExists) alerts.push({
    cat:"📋 Operations",priority:2,color:C.amber,
    title:"No daily log submitted today",
    body:"Remind workers to submit their daily health check report",
    action:()=>setPage&&setPage("adminlog")
  });

  // Pending worker approvals
  const pending=users.filter(u=>u.role==="worker"&&!u.approved);
  if(pending.length>0) alerts.push({
    cat:"👷 Workers",priority:2,color:C.blue,
    title:`${pending.length} worker registration${pending.length>1?"s":""} awaiting approval`,
    body:pending.map(u=>u.name).join(", "),
    action:()=>setPage&&setPage("workers")
  });

  // Pending data approvals
  const pendingData=[...feeds,...logs,...sales,...expenses].filter(x=>x.approved===false);
  if(pendingData.length>0) alerts.push({
    cat:"✅ Approvals",priority:1,color:C.amber,
    title:`${pendingData.length} worker record${pendingData.length>1?"s":""} awaiting approval`,
    body:"Worker-submitted data needs admin review",
    action:()=>setPage&&setPage("approvals")
  });

  // Overdue vaccinations
  if(vaccinations){
    const overdueVax=vaccinations.filter(v=>daysDiff(v.nextDue)<0);
    const dueVax=vaccinations.filter(v=>daysDiff(v.nextDue)>=0&&daysDiff(v.nextDue)<=7);
    if(overdueVax.length>0) alerts.push({
      cat:"💉 Vaccines",priority:1,color:C.red,
      title:`${overdueVax.length} overdue vaccination${overdueVax.length>1?"s":""}`,
      body:"Overdue vaccines increase disease risk",
      action:()=>setPage&&setPage("vaccination")
    });
    if(dueVax.length>0) alerts.push({
      cat:"💉 Vaccines",priority:2,color:C.amber,
      title:`${dueVax.length} vaccination${dueVax.length>1?"s":""} due within 7 days`,
      body:"Schedule vet visit to keep herd protected",
      action:()=>setPage&&setPage("vaccination")
    });
  }

  // Financial: running at loss
  const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);
  if(totalInc>0&&totalExp>totalInc*1.1) alerts.push({
    cat:"💹 Finance",priority:1,color:C.red,
    title:"Farm is running at a loss",
    body:`Expenses (${fmtRWF(totalExp)}) exceed income (${fmtRWF(totalInc)}) by ${fmtRWF(totalExp-totalInc)}`,
    action:()=>setPage&&setPage("pnl")
  });

  // Overdue tasks
  if(tasks&&tasks.length>0){
    const overdueT=tasks.filter(t=>t.status==="pending"&&t.dueDate&&daysDiff(t.dueDate)<0);
    if(overdueT.length>0) alerts.push({
      cat:"✅ Tasks",priority:2,color:C.amber,
      title:`${overdueT.length} overdue task${overdueT.length>1?"s":""}`,
      body:overdueT.slice(0,3).map(t=>t.title).join(", "),
      action:()=>setPage&&setPage("tasks")
    });
  }

  // All good
  if(alerts.length===0) alerts.push({
    cat:"✅ All Good",priority:3,color:C.accent,
    title:"No urgent alerts today!",
    body:"Farm is running smoothly. Keep up the great work!",
    action:null
  });

  // Sort by priority (0=critical, 1=high, 2=medium, 3=info)
  alerts.sort((a,b)=>a.priority-b.priority);

  const critCount=alerts.filter(a=>a.priority===0).length;
  const highCount=alerts.filter(a=>a.priority===1).length;

  async function sendAlertsToWA(){
    if(waSending) return;
    setWASending(true);setWAStatus("");
    const critical=alerts.filter(a=>a.priority<=1);
    if(critical.length===0){setWAStatus("ℹ️ No critical/high alerts to send.");setWASending(false);return;}
    const lines=[`🐷 *FarmIQ Alert — ${toDay()}*`,""];
    critical.forEach((a,i)=>{
      lines.push(`${i+1}. ${a.title}`);
      if(a.body) lines.push(`   ${a.body}`);
    });
    lines.push("","_Via FarmIQ Rwanda_");
    const msg=lines.join("\n");
    const res=await sendWhatsApp(msg);
    if(res.ok) setWAStatus("✅ Sent "+critical.length+" alert(s) to WhatsApp!");
    else if(res.reason==="not_configured") setWAStatus("⚠️ WhatsApp not configured. Go to 📱 WhatsApp Alerts in the menu.");
    else setWAStatus("⚠️ Sent (delivery unconfirmed — CallMeBot doesn't support CORS confirmation).");
    setWASending(false);
    setTimeout(()=>setWAStatus(""),6000);
  }

  const priorityLabel=["🚨 CRITICAL","🔴 High","🟡 Medium","🟢 Info"];
  const priorityBg=["rgba(239,68,68,.06)","rgba(239,68,68,.04)","rgba(245,158,11,.04)","rgba(22,163,74,.04)"];

  return(<div className="fade-in">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:4}}>
      <div>
        <div style={{...S.h1,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🔔</span> Smart Alerts</div>
        <div style={S.sub}>All farm alerts in one place · {alerts.length} alert{alerts.length!==1?"s":""} · {critCount>0?critCount+" critical":"No critical issues"}</div>
      </div>
      <button onClick={sendAlertsToWA} disabled={waSending} style={{...S.btn("#128C7E"),display:"flex",alignItems:"center",gap:7,fontSize:12,padding:"8px 14px"}}>
        {waSending?<><span className="spin" style={{...S.loader,borderTopColor:"#fff"}}/>Sending…</>:<>📱 Send to WhatsApp</>}
      </button>
    </div>
    {waStatus&&<div style={{padding:"9px 14px",background:"rgba(37,211,102,.08)",border:"1px solid rgba(37,211,102,.3)",borderRadius:9,fontSize:12,color:C.muted,marginBottom:12}}>{waStatus}</div>}

    {/* Summary */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {[
        {l:"Critical",v:critCount,c:C.red,bg:"rgba(239,68,68,.06)"},
        {l:"High Priority",v:highCount,c:C.amber,bg:"rgba(245,158,11,.06)"},
        {l:"Medium",v:alerts.filter(a=>a.priority===2).length,c:C.blue,bg:"rgba(37,99,235,.06)"},
        {l:"Total Alerts",v:alerts.length,c:C.text,bg:C.elevated},
      ].map(s=>(
        <div key={s.l} style={{background:s.bg,border:"1px solid "+C.border,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
          <div style={{fontSize:10,color:C.faint,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
          <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* Alert list */}
    {alerts.map((a,i)=>(
      <div key={i} className="fade-in" style={{
        ...S.card,marginBottom:10,
        borderLeft:"4px solid "+a.color,
        background:priorityBg[a.priority]||C.surface,
        animation:`fadeIn ${.2+i*.05}s ease both`
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:a.color+"18",color:a.color,fontWeight:700}}>{a.cat}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:20,background:C.elevated,color:C.faint,fontWeight:600}}>{priorityLabel[a.priority]}</span>
            </div>
            <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:3}}>{a.title}</div>
            <div style={{fontSize:12,color:C.muted}}>{a.body}</div>
          </div>
          {a.action&&<button onClick={a.action} style={{padding:"6px 13px",borderRadius:8,border:"1px solid "+a.color+"44",background:a.color+"12",color:a.color,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>View →</button>}
        </div>
      </div>
    ))}
  </div>);
}

/* ═══════════════════════════════════════════════════
   PROFIT INSIGHT MODULE
   Quick profit dashboard, trends, cost drilldown
═══════════════════════════════════════════════════ */
function ProfitInsight({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,capital}){
  const [period,setPeriod]=useState("thisMonth");
  const active=pigs.filter(p=>p.status==="active");

  function filterByPeriod(arr,dateKey="date"){
    const now=new Date();
    const thisY=now.getFullYear();
    const thisM=now.getMonth();
    return arr.filter(x=>{
      if(!x[dateKey])return false;
      const d=new Date(x[dateKey]);
      if(period==="thisMonth")return d.getFullYear()===thisY&&d.getMonth()===thisM;
      if(period==="lastMonth"){const lm=thisM===0?11:thisM-1;const ly=thisM===0?thisY-1:thisY;return d.getFullYear()===ly&&d.getMonth()===lm;}
      if(period==="last30")return (now-d)/(1000*60*60*24)<=30;
      if(period==="thisYear")return d.getFullYear()===thisY;
      return true; // all
    });
  }

  const fSales=filterByPeriod(sales);
  const fFeeds=filterByPeriod(feeds);
  const fExp=filterByPeriod(expenses);
  const fInc=filterByPeriod(incomes);

  const totalInc=fSales.reduce((s,x)=>s+(x.total||0),0)+fInc.reduce((s,x)=>s+(x.amount||0),0);
  const totalExp=fFeeds.reduce((s,x)=>s+(x.cost||0),0)+fExp.reduce((s,x)=>s+(x.amount||0),0);
  const profit=totalInc-totalExp;
  const margin=totalInc>0?((profit/totalInc)*100).toFixed(1):"0";
  const herdValue=active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0);

  // All-time for context
  const allInc=sales.reduce((s,x)=>s+(x.total||0),0)+incomes.reduce((s,x)=>s+(x.amount||0),0);
  const allExp=feeds.reduce((s,x)=>s+(x.cost||0),0)+expenses.reduce((s,x)=>s+(x.amount||0),0);
  const allProfit=allInc-allExp;

  // Top selling pigs
  const salePigs=sales.map(s=>{
    const p=pigs.find(x=>x.id===s.pigId);
    return{...s,pigTag:p?p.tag:"Unknown",pigStage:p?p.stage:"Unknown"};
  }).sort((a,b)=>(b.total||0)-(a.total||0)).slice(0,5);

  // Cost breakdown for period
  const expByCat={};
  fFeeds.forEach(f=>{expByCat["Feed Purchase"]=(expByCat["Feed Purchase"]||0)+(f.cost||0);});
  fExp.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+(e.amount||0);});
  const topCosts=Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Monthly profit for spark bars
  const monthlyProfit={};
  [...sales.map(s=>({d:s.date,inc:s.total||0,exp:0})),...incomes.map(i=>({d:i.date,inc:i.amount||0,exp:0})),...feeds.map(f=>({d:f.date,inc:0,exp:f.cost||0})),...expenses.map(e=>({d:e.date,inc:0,exp:e.amount||0}))].forEach(x=>{
    const m=(x.d||"").slice(0,7);
    if(!m)return;
    if(!monthlyProfit[m])monthlyProfit[m]={inc:0,exp:0};
    monthlyProfit[m].inc+=x.inc;
    monthlyProfit[m].exp+=x.exp;
  });
  const months6=Object.entries(monthlyProfit).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).reverse();
  const maxMonthP=Math.max(...months6.map(([,v])=>Math.max(Math.abs(v.inc-v.exp),1)),1);

  // Break-even
  const avgSalePig=fSales.length>0?Math.round(fSales.reduce((s,x)=>s+(x.total||0),0)/fSales.length):0;
  const avgCostPig=fSales.length>0?Math.round(totalExp/Math.max(fSales.length,1)):0;
  const breakEven=avgSalePig>avgCostPig?Math.ceil(totalExp/(avgSalePig-avgCostPig)):null;

  return(<div className="fade-in">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{...S.h1,display:'flex',alignItems:'center',gap:8}}><span>💡</span> Profit Insight</div>
        <div style={S.sub}>Quick profit view · Cost drilldown · Monthly trends · Break-even</div>
      </div>
      <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...S.inp,width:"auto",fontSize:12,padding:"7px 11px"}}>
        {[["thisMonth","This Month"],["lastMonth","Last Month"],["last30","Last 30 Days"],["thisYear","This Year"],["all","All Time"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>

    {/* Main P&L banner */}
    <div style={{...S.card,background:profit>=0?"linear-gradient(135deg,rgba(22,163,74,.08),rgba(16,185,129,.04))":"linear-gradient(135deg,rgba(239,68,68,.08),rgba(220,38,38,.04))",border:"2px solid "+(profit>=0?"rgba(22,163,74,.25)":"rgba(239,68,68,.25)"),marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,color:C.faint,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Net Profit / Loss</div>
          <div style={{fontSize:32,fontWeight:800,color:profit>=0?C.accent:C.red}}>{profit>=0?"+":""}{fmtRWF(profit)}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:4}}>
            {profit>=0?"✅ Profitable":"⚠️ Loss"} · {margin}% margin · {fSales.length} sale{fSales.length!==1?"s":""}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:160}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:16}}>
            <span style={{fontSize:12,color:C.muted}}>Income</span>
            <span style={{fontWeight:700,color:"#10b981"}}>{fmtRWF(totalInc)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:16}}>
            <span style={{fontSize:12,color:C.muted}}>Expenses</span>
            <span style={{fontWeight:700,color:C.red}}>{fmtRWF(totalExp)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,paddingTop:6,borderTop:"1px solid "+C.border}}>
            <span style={{fontSize:12,color:C.muted}}>Herd Value</span>
            <span style={{fontWeight:700,color:C.purple}}>{fmtRWF(herdValue)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:16}}>
            <span style={{fontSize:12,color:C.muted}}>All-time Profit</span>
            <span style={{fontWeight:700,color:allProfit>=0?C.accent:C.red}}>{fmtRWF(allProfit)}</span>
          </div>
        </div>
      </div>
    </div>

    {/* Income bar */}
    {totalInc>0&&<div style={{...S.card,padding:"12px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12,fontWeight:700,color:C.text}}>
        <span>Expense Ratio</span>
        <span style={{color:totalExp>totalInc?C.red:C.accent}}>{totalInc>0?((totalExp/totalInc)*100).toFixed(1):0}%</span>
      </div>
      <div style={{height:10,background:C.elevated,borderRadius:6,overflow:"hidden"}}>
        <div style={{height:"100%",width:Math.min((totalExp/totalInc)*100,100)+"%",background:totalExp>totalInc?"linear-gradient(90deg,#ef4444,#f87171)":"linear-gradient(90deg,#f59e0b,#22c55e)",borderRadius:6,transition:"width .6s cubic-bezier(.22,1,.36,1)"}}/>
      </div>
      <div style={{display:"flex",gap:14,marginTop:6,fontSize:11,color:C.faint,flexWrap:"wrap"}}>
        <span>💚 Income: {fmtRWF(totalInc)}</span>
        <span>🔴 Expenses: {fmtRWF(totalExp)}</span>
      </div>
    </div>}

    {/* 2-column grid */}
    <div style={S.g2}>
      {/* Cost breakdown */}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:12}}>🔴 Cost Breakdown</div>
        {topCosts.length===0?<div style={{color:C.faint,fontSize:12}}>No expenses recorded.</div>:
          topCosts.map(([cat,amt])=>{
            const pct=totalExp>0?((amt/totalExp)*100).toFixed(0):0;
            return(<div key={cat} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                <span style={{color:C.muted}}>{cat}</span>
                <span style={{color:C.red,fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400}}>({pct}%)</span></span>
              </div>
              <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:pct+"%",background:cat==="Feed Purchase"?C.amber:C.red,borderRadius:3}}/>
              </div>
            </div>);
          })}
      </div>

      {/* Top sales */}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12}}>💚 Top Sales</div>
        {salePigs.length===0?<div style={{color:C.faint,fontSize:12}}>No sales recorded yet.</div>:
          salePigs.map((s,i)=>(
            <div key={s.id} style={{...S.row,marginBottom:6,background:i===0?"rgba(16,185,129,.06)":C.elevated}}>
              <div>
                <div style={{fontWeight:600,fontSize:12,color:C.text}}>🐷 {s.pigTag}</div>
                <div style={{fontSize:10,color:C.faint}}>{s.buyer||"—"} · {s.date}</div>
              </div>
              <div style={{fontWeight:700,color:"#10b981",fontSize:13}}>{fmtRWF(s.total)}</div>
            </div>
          ))}
      </div>
    </div>

    {/* Monthly profit spark */}
    {months6.length>0&&<div style={{...S.card,marginTop:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>📅 Monthly Profit Trend</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",height:80}}>
        {months6.map(([m,v])=>{
          const p=v.inc-v.exp;
          const h=Math.max(Math.abs(p)/maxMonthP*70,4);
          const label=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.split("-")[1])-1];
          return(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{fontSize:9,color:p>=0?C.accent:C.red,fontWeight:700}}>{p>=0?"+":""}{Math.round(p/1000)}k</div>
            <div style={{width:"100%",height:h,background:p>=0?"linear-gradient(180deg,#22c55e,#16a34a)":"linear-gradient(180deg,#f87171,#dc2626)",borderRadius:4,transition:"height .55s cubic-bezier(.22,1,.36,1)"}}/>
            <div style={{fontSize:9,color:C.faint}}>{label}</div>
          </div>);
        })}
      </div>
    </div>}

    {/* Break-even */}
    {breakEven!==null&&avgSalePig>0&&<div style={{...S.card,marginTop:14,background:"rgba(99,102,241,.03)",border:"1px solid rgba(99,102,241,.2)"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#6366f1",marginBottom:10}}>📐 Break-Even Analysis</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[["Avg Sale/pig",fmtRWF(avgSalePig)],["Avg Cost/pig",fmtRWF(avgCostPig)],["Pigs to break even",breakEven+" pigs"]].map(([l,v])=>(
          <div key={l} style={{background:C.elevated,borderRadius:8,padding:"8px 10px",textAlign:"center",border:"1px solid "+C.border}}>
            <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
            <div style={{fontWeight:700,color:C.text,fontSize:13}}>{v}</div>
          </div>
        ))}
      </div>
      {fSales.length>=breakEven?
        <div style={{marginTop:10,fontSize:12,color:C.accent}}>✅ Break-even reached! ({fSales.length} sales)</div>:
        <div style={{marginTop:10,fontSize:12,color:C.amber}}>⏳ {fSales.length}/{breakEven} sales to break even</div>}
    </div>}
  </div>);}

