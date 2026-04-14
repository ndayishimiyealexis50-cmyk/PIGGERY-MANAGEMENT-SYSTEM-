function ReproductionModule({pigs,reproductions,setReproductions,feeds,sales,logs,expenses,incomes,stock,capital,setCapital}){
  const [tab,setTab]=useState("overview");
  const [form,setForm]=useState({sowId:"",boarId:"",matingDate:toDay(),notes:"",method:"Natural Service"});
  const [saved,setSaved]=useState(false);
  const [farrowingId,setFarrowingId]=useState(null);
  const [farrowingConfirm,setFarrowingConfirm]=useState(null);
  const [pigletCount,setPigletCount]=useState("10");
  const [stillbornCount,setStillbornCount]=useState("0");
  const sows=pigs.filter(p=>p.status==="active"&&(p.stage==="Sow"||p.stage==="Gilt"));
  const boars=pigs.filter(p=>p.status==="active"&&p.stage==="Boar");

  const STAGES=[
    {day:0,  label:"Mating",       icon:"🐖", desc:"Breeding recorded",           color:"#8b5cf6"},
    {day:21, label:"Heat Check",   icon:"🔍", desc:"Check if returned to heat",    color:"#f59e0b"},
    {day:35, label:"Confirm Preg", icon:"✅", desc:"Physical signs visible",       color:"#3b82f6"},
    {day:75, label:"Mid Preg",     icon:"🤰", desc:"Increase feed to 2.5kg/day",   color:"#ec4899"},
    {day:100,label:"Prep Pen",     icon:"🏠", desc:"Prepare farrowing pen",        color:"#f97316"},
    {day:110,label:"Near Birth",   icon:"⚠️", desc:"Watch closely, reduce feed",   color:"#ef4444"},
    {day:114,label:"Farrowing",    icon:"🐣", desc:"Birth expected today!",        color:"#16a34a"},
  ];

  async function logMating(){
    if(!form.sowId||!form.matingDate)return;
    const expectedFarrow=addDays(form.matingDate,GESTATION);
    const newRecord={
      id:uid(),sowId:form.sowId,boarId:form.boarId,
      matingDate:form.matingDate,expectedFarrow,
      heatCheckDate:addDays(form.matingDate,21),
      preparePenDate:addDays(form.matingDate,100),
      method:form.method,status:"pregnant",piglets:0,
      notes:form.notes,loggedDate:toDay()
    };
    setReproductions(r=>{const updated=[...r,newRecord];fsSet("reproductions",updated);return updated;});
    try{await jbinAppend("reproductions",newRecord);}catch(e){console.error(e);}
    setSaved(true);
    setTimeout(()=>{setSaved(false);setForm({sowId:"",boarId:"",matingDate:toDay(),notes:"",method:"Natural Service"});},2500);
  }

  async function updateStatus(id,status,piglets,stillborn){
    const record=reproductions.find(x=>x.id===id);
    const farrowDate=status==="farrowed"?toDay():undefined;
    // Generate weekly monitoring schedule for newborn piglets
    let weeklyChecks=undefined;
    if(status==="farrowed"&&piglets>0&&farrowDate){
      weeklyChecks=[1,2,3,4,5,6,7,8].map(wk=>({week:wk,dueDate:addDays(farrowDate,wk*7),completed:false,notes:""}));
    }
    const updated=reproductions.map(x=>x.id===id?{
      ...x,status,
      piglets:piglets||x.piglets,
      stillborn:stillborn||0,
      farrowDate:farrowDate||x.farrowDate,
      ...(weeklyChecks?{weeklyChecks}:{})
    }:x);
    setReproductions(updated);
    fsSet("reproductions",updated);
    // When marked farrowed, record piglet value as capital income
    if(status==="farrowed"&&piglets>0&&setCapital){
      const sow=pigs.find(p=>p.id===record?.sowId);
      const pigletValue=piglets*10000;
      capitalTx(capital,setCapital,{type:"income",category:"Piglet Sale",amount:pigletValue,description:`${piglets} piglets born from ${sow?sow.tag:"sow"} — est. value @ RWF 10,000/piglet`,date:toDay()});
    }
    try{
      const data=await getOnlineFarmData()||{};
      await setOnlineFarmData({...data,reproductions:updated});
    }catch(e){console.error(e);}
  }

  const pregnant=reproductions.filter(r=>r.status==="pregnant");
  const farrowed=reproductions.filter(r=>r.status==="farrowed");
  const upcomingFarrows=pregnant.filter(r=>daysDiff(r.expectedFarrow)<=14&&daysDiff(r.expectedFarrow)>=0);
  const overdue=pregnant.filter(r=>daysDiff(r.expectedFarrow)<0);
  const totalPiglets=farrowed.reduce((s,r)=>s+(r.piglets||0),0);
  const avgLitter=farrowed.length>0?(totalPiglets/farrowed.length).toFixed(1):0;
  const farrowRate=reproductions.length>0?Math.round((farrowed.length/reproductions.length)*100):0;

  function pregProgress(matingDate){
    const elapsed=GESTATION-daysDiff(addDays(matingDate,GESTATION));
    return Math.min(100,Math.max(0,Math.round((elapsed/GESTATION)*100)));
  }
  function currentStage(matingDate){
    const elapsed=GESTATION-daysDiff(addDays(matingDate,GESTATION));
    let stage=STAGES[0];
    for(let s of STAGES){if(elapsed>=s.day) stage=s;}
    return stage;
  }
  function sowScore(sowId){
    const records=reproductions.filter(r=>r.sowId===sowId);
    const farrowedR=records.filter(r=>r.status==="farrowed");
    const totalP=farrowedR.reduce((s,r)=>s+(r.piglets||0),0);
    return{litters:farrowedR.length,avg:farrowedR.length>0?(totalP/farrowedR.length).toFixed(1):0,rate:records.length>0?Math.round((farrowedR.length/records.length)*100):0,totalPiglets:totalP};
  }

  return(<div>
    <div style={S.h1}>🐖 Pregnancy & Reproduction</div>
    <div style={S.sub}>Full breeding cycle · Birth predictions · Sow performance</div>

    {/* Alerts */}
    {overdue.length>0&&<div style={{padding:"12px 16px",background:"rgba(239,68,68,.08)",border:"1.5px solid rgba(239,68,68,.4)",borderRadius:10,marginBottom:12,animation:"pulse 2s ease-in-out infinite"}}>
      <div style={{fontWeight:700,color:C.red,fontSize:14,marginBottom:6}}>🚨 OVERDUE — Immediate Attention!</div>
      {overdue.map(r=>{const sow=pigs.find(p=>p.id===r.sowId);return(
        <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:"1px solid rgba(239,68,68,.2)"}}>
          <span style={{color:C.text,fontWeight:600}}>🐷 {sow?sow.tag:"Unknown"}</span>
          <span style={{color:C.red,fontWeight:700}}>{Math.abs(daysDiff(r.expectedFarrow))}d overdue — check now!</span>
        </div>
      );})}
    </div>}
    {upcomingFarrows.length>0&&<div style={{padding:"12px 16px",background:"rgba(245,158,11,.08)",border:"1.5px solid rgba(245,158,11,.4)",borderRadius:10,marginBottom:12}}>
      <div style={{fontWeight:700,color:C.amber,fontSize:14,marginBottom:6}}>🔔 Farrowing Soon — Prepare Pens!</div>
      {upcomingFarrows.map(r=>{const sow=pigs.find(p=>p.id===r.sowId);return(
        <div key={r.id} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderTop:"1px solid rgba(245,158,11,.2)"}}>
          <span style={{color:C.text,fontWeight:600}}>🐷 {sow?sow.tag:"—"} · Due: {r.expectedFarrow}</span>
          <span style={{color:C.amber,fontWeight:700}}>{daysDiff(r.expectedFarrow)===0?"TODAY!":daysDiff(r.expectedFarrow)+"d"}</span>
        </div>
      );})}
    </div>}

    {/* Stats */}
    <div style={S.g4}>
      {[{l:"Pregnant",v:pregnant.length,c:C.amber},{l:"Total Litters",v:farrowed.length,c:C.accent},{l:"Avg Litter",v:avgLitter+" 🐷",c:C.purple},{l:"Farrowing Rate",v:farrowRate+"%",c:farrowRate>=70?C.accent:C.red}].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:18}}>{s.v}</div></div>
      ))}
    </div>
    <div style={S.g4}>
      {[{l:"Total Piglets Born",v:fmtNum(totalPiglets),c:C.accent},{l:"Piglet Value",v:fmtRWF(totalPiglets*10000),c:"#10b981"},{l:"Breeding Females",v:sows.length,c:C.pink},{l:"Active Boars",v:boars.length,c:"#6366f1"}].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:s.v.length>8?14:18}}>{s.v}</div></div>
      ))}
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["overview","🐷 Active"],["predict","📅 Predictions"],["log","➕ Log Mating"],["sows","⭐ Sow Records"],["guide","📖 Guide"],["ai","🤖 AI"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* ACTIVE PREGNANCIES */}
    {tab==="overview"&&(<div>
      {pregnant.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>
        <div style={{fontSize:36,marginBottom:8}}>🐖</div>No pregnant sows. Log a mating to start tracking.
      </div>}
      {pregnant.map((r,i)=>{
        const sow=pigs.find(p=>p.id===r.sowId);
        const boar=pigs.find(p=>p.id===r.boarId);
        const daysLeft=daysDiff(r.expectedFarrow);
        const progress=pregProgress(r.matingDate);
        const stage=currentStage(r.matingDate);
        const elapsed=GESTATION-daysLeft;
        return(<div key={i} style={{...S.card,marginBottom:14,border:"1px solid "+stage.color+"44"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontWeight:800,color:C.text,fontSize:15}}>🐷 {sow?sow.tag:"Unknown"} <span style={{fontSize:11,color:C.faint,fontWeight:400}}>{sow?"("+sow.breed+")":""}</span></div>
              <div style={{fontSize:11,color:C.faint}}>{boar?"♂ "+boar.tag+" · ":""}Mated: {r.matingDate} · {r.method||"Natural"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:800,color:daysLeft<0?C.red:daysLeft<=7?C.amber:C.accent}}>{daysLeft<0?Math.abs(daysLeft)+"d":daysLeft===0?"TODAY":daysLeft+"d"}</div>
              <div style={{fontSize:9,color:C.faint}}>{daysLeft<0?"OVERDUE":daysLeft===0?"BIRTH DAY":"UNTIL BIRTH"}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.faint,marginBottom:3}}>
              <span>Day {elapsed} of {GESTATION}</span>
              <span style={{color:stage.color,fontWeight:700}}>{stage.icon} {stage.label} — {stage.desc}</span>
              <span>{progress}%</span>
            </div>
            <div style={{height:10,background:C.elevated,borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:progress+"%",background:"linear-gradient(90deg,#8b5cf6,"+stage.color+")",borderRadius:10,transition:"width .5s"}}/>
            </div>
          </div>
          {/* Stage dots */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 2px",marginBottom:10}}>
            {STAGES.map((s,si)=>{
              const passed=elapsed>=s.day;
              const current=s.label===stage.label;
              return(<React.Fragment key={si}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:current?26:18,height:current?26:18,borderRadius:"50%",background:passed?s.color:"rgba(100,116,139,.15)",border:current?"3px solid "+s.color:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:current?13:9,boxShadow:current?"0 0 8px "+s.color+"66":"none",transition:"all .3s"}}>{passed?s.icon:""}</div>
                  <div style={{fontSize:7,color:passed?s.color:C.faint,textAlign:"center",maxWidth:36,lineHeight:1.2}}>{s.label}</div>
                </div>
                {si<STAGES.length-1&&<div style={{flex:1,height:2,background:elapsed>s.day?"linear-gradient(90deg,"+s.color+","+STAGES[si+1].color+")":"rgba(100,116,139,.15)",margin:"0 1px",marginBottom:16}}/>}
              </React.Fragment>);
            })}
          </div>
          {/* Key dates */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
            {[["🔍 Heat Check",r.heatCheckDate||addDays(r.matingDate,21)],["🏠 Prep Pen",r.preparePenDate||addDays(r.matingDate,100)],["🐣 Birth Due",r.expectedFarrow]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.faint}}>{l}</div>
                <div style={{fontSize:11,color:C.text,fontWeight:600,marginTop:1}}>{v}</div>
              </div>
            ))}
          </div>
          {farrowingId===r.id?(
            <div style={{background:"rgba(22,163,74,.06)",border:"1px solid rgba(22,163,74,.25)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>🐣 Birth Approval — Step 2 of 2</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                <div>
                  <label style={S.lbl}>🐷 Piglets Born *</label>
                  <input type="number" min="1" max="30" value={pigletCount} onChange={e=>setPigletCount(e.target.value)} style={{...S.inp,fontSize:14,textAlign:"center"}} autoFocus/>
                </div>
                <div>
                  <label style={S.lbl}>💀 Stillborn</label>
                  <input type="number" min="0" max="20" value={stillbornCount||"0"} onChange={e=>setStillbornCount&&setStillbornCount(e.target.value)} style={{...S.inp,fontSize:14,textAlign:"center"}}/>
                </div>
              </div>
              <div style={{fontSize:11,color:C.faint,marginBottom:10,padding:"7px 10px",background:C.elevated,borderRadius:7}}>
                📋 Confirm all details are accurate. Once approved, piglet weekly monitoring will begin automatically.
              </div>
              <div style={{display:"flex",gap:7}}>
                <button style={{...S.btn(C.accent),flex:1,padding:9,fontSize:13}} onClick={()=>{updateStatus(r.id,"farrowed",parseInt(pigletCount)||10,parseInt(stillbornCount)||0);setFarrowingId(null);setPigletCount("10");setStillbornCount&&setStillbornCount("0");}}>✅ Approve Birth & Start Monitoring</button>
                <button style={{...S.btn("#6b7280"),padding:"9px 12px",fontSize:12}} onClick={()=>{setFarrowingId(null);setPigletCount("10");}}>Cancel</button>
              </div>
            </div>
          ):farrowingConfirm===r.id?(
            <div style={{background:"rgba(245,158,11,.06)",border:"1.5px solid rgba(245,158,11,.4)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:8}}>🐣 Birth Approval — Step 1 of 2</div>
              <div style={{fontSize:12,color:C.text,marginBottom:10,lineHeight:1.6}}>
                Confirm that <strong>{(pigs.find(p=>p.id===r.sowId)||{}).tag||"this sow"}</strong> has given birth. A worker or supervisor must verify the birth before recording piglets.
              </div>
              <div style={{display:"flex",gap:7}}>
                <button style={{...S.btn(C.amber),flex:1,padding:9,fontSize:13,color:"#fff"}} onClick={()=>{setFarrowingConfirm(null);setFarrowingId(r.id);}}>✓ Birth Confirmed — Enter Piglet Details</button>
                <button style={{...S.btn("#6b7280"),padding:"9px 12px",fontSize:12}} onClick={()=>setFarrowingConfirm(null)}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",gap:7}}>
              <button style={{...S.btn(C.accent),flex:1,padding:9,fontSize:12}} onClick={()=>setFarrowingConfirm(r.id)}>🐣 Approve Birth</button>
              <button style={{...S.btn(C.red),padding:"9px 14px",fontSize:12}} onClick={()=>{if(window.confirm("Mark as failed/aborted?"))updateStatus(r.id,"failed",0,0);}}>✗ Failed</button>
            </div>
          )}
          {r.notes&&<div style={{fontSize:11,color:C.faint,marginTop:8,fontStyle:"italic",padding:"5px 9px",background:C.elevated,borderRadius:6}}>📝 {r.notes}</div>}
        </div>);
      })}
    </div>)}

    {/* BIRTH PREDICTIONS */}
    {tab==="predict"&&(<div>
      {pregnant.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No pregnant sows to predict.</div>}
      {pregnant.sort((a,b)=>a.expectedFarrow?.localeCompare(b.expectedFarrow)).map((r,i)=>{
        const sow=pigs.find(p=>p.id===r.sowId);
        const daysLeft=daysDiff(r.expectedFarrow);
        const stage=currentStage(r.matingDate);
        const progress=pregProgress(r.matingDate);
        return(<div key={i} style={{...S.card,marginBottom:12,border:"1px solid "+(daysLeft<0?C.red:daysLeft<=7?C.amber:C.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,color:C.text,fontSize:14}}>🐷 {sow?sow.tag:"—"} <span style={{fontSize:11,color:stage.color}}>{stage.icon} {stage.label}</span></div>
            <div style={{padding:"4px 14px",borderRadius:20,background:daysLeft<0?C.red:daysLeft<=3?"#ef4444":daysLeft<=7?C.amber:C.accentSoft,color:daysLeft<=7?"#fff":C.accent,fontWeight:800,fontSize:13}}>
              {daysLeft<0?Math.abs(daysLeft)+"d OVERDUE":daysLeft===0?"🐣 TODAY!":daysLeft+"d left"}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:10}}>
            {[["🗓️ Expected Birth",r.expectedFarrow],["📊 Progress",progress+"%"],["🔍 Heat Check",r.heatCheckDate||addDays(r.matingDate,21)],["🏠 Pen Prep By",r.preparePenDate||addDays(r.matingDate,100)],["🐷 Est. Piglets","8–12 piglets"],["💰 Est. Value",fmtRWF(100000)]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"7px 9px"}}>
                <div style={{fontSize:9,color:C.faint}}>{l}</div>
                <div style={{fontSize:12,color:C.text,fontWeight:600,marginTop:1}}>{v}</div>
              </div>
            ))}
          </div>
          {daysLeft<=14&&daysLeft>=0&&<div style={{padding:"9px 12px",background:"rgba(245,158,11,.06)",borderRadius:8,border:"1px solid rgba(245,158,11,.2)"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:6}}>📋 Pre-Farrowing Checklist:</div>
            {["Clean & disinfect farrowing pen","Prepare heat lamp & bedding (32°C for piglets)","Stock ORS sachets, clean towels, iodine","Reduce feed to 1.5kg/day from day 112","Prepare iron injection for newborn piglets","Watch for swollen udder — sign of imminent birth"].map((item,ii)=>(
              <div key={ii} style={{fontSize:11,color:C.muted,padding:"2px 0",display:"flex",gap:6}}><span style={{color:C.amber}}>□</span>{item}</div>
            ))}
          </div>}
        </div>);
      })}
      {farrowed.length>0&&<div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>✅ Completed Farrowings ({farrowed.length})</div>
        {farrowed.slice().reverse().map((r,i)=>{
          const sow=pigs.find(p=>p.id===r.sowId);
          const pendingChecks=(r.weeklyChecks||[]).filter(c=>!c.completed&&daysDiff(c.dueDate)<=0);
          return(<div key={i} style={{...S.card,marginBottom:10,padding:"11px 14px",border:"1px solid "+(pendingChecks.length>0?"rgba(245,158,11,.4)":C.border)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:pendingChecks.length>0?10:0}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{sow?sow.tag:"—"} <span style={{fontSize:10,color:C.faint}}>Mated: {r.matingDate} · Born: {r.farrowDate||r.expectedFarrow}</span></div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  🐷 {r.piglets||0} born · {r.stillborn>0?<span style={{color:C.red}}>💀 {r.stillborn} stillborn · </span>:""}
                  <span style={{color:"#10b981",fontWeight:600}}>{fmtRWF((r.piglets||0)*10000)} est. value</span>
                </div>
              </div>
              <div style={{textAlign:"right",fontSize:11,color:C.faint}}>
                {r.weeklyChecks&&<span style={{padding:"2px 7px",borderRadius:12,background:pendingChecks.length>0?"rgba(245,158,11,.12)":"rgba(22,163,74,.1)",color:pendingChecks.length>0?C.amber:C.accent,fontWeight:600,fontSize:10}}>{pendingChecks.length>0?"⏰ "+pendingChecks.length+" check(s) due":"✅ On track"}</span>}
              </div>
            </div>
            {/* Weekly monitoring */}
            {r.weeklyChecks&&r.weeklyChecks.length>0&&(()=>{
              const today=toDay();
              const due=r.weeklyChecks.filter(c=>c.dueDate<=today);
              const upcoming=r.weeklyChecks.filter(c=>c.dueDate>today).slice(0,2);
              return(<div style={{background:C.elevated,borderRadius:8,padding:"9px 12px",marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:7}}>📅 Weekly Piglet Monitoring</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {due.map(c=>(
                    <div key={c.week} style={{padding:"4px 10px",borderRadius:20,background:c.completed?"rgba(22,163,74,.1)":"rgba(245,158,11,.1)",border:"1px solid "+(c.completed?"rgba(22,163,74,.3)":"rgba(245,158,11,.4)"),fontSize:10,fontWeight:600,color:c.completed?C.accent:C.amber,cursor:c.completed?"default":"pointer"}}
                      onClick={()=>{
                        if(!c.completed){
                          const updated=reproductions.map(x=>x.id===r.id?{...x,weeklyChecks:(x.weeklyChecks||[]).map(wc=>wc.week===c.week?{...wc,completed:true,completedDate:toDay()}:wc)}:x);
                          setReproductions(updated);fsSet("reproductions",updated);
                        }
                      }}>
                      {c.completed?"✅":"⏰"} Wk {c.week} · {c.dueDate}
                    </div>
                  ))}
                  {upcoming.map(c=>(
                    <div key={c.week} style={{padding:"4px 10px",borderRadius:20,background:"rgba(100,116,139,.08)",border:"1px solid rgba(100,116,139,.2)",fontSize:10,color:C.faint}}>
                      📆 Wk {c.week} · {c.dueDate}
                    </div>
                  ))}
                </div>
                {due.filter(c=>!c.completed).length>0&&<div style={{marginTop:7,fontSize:10,color:C.amber,fontWeight:600}}>⏰ {due.filter(c=>!c.completed).length} overdue check(s) — tap to mark complete</div>}
              </div>);
            })()}
          </div>);
        })}
        <div style={{marginTop:8,padding:"9px 12px",background:C.accentSoft,borderRadius:7,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:12}}>Total: {totalPiglets} piglets · Avg: {avgLitter}/litter</span>
          <span style={{color:C.accent,fontWeight:700}}>{fmtRWF(totalPiglets*10000)}</span>
        </div>
      </div>}
    </div>)}

    {/* LOG MATING */}
    {tab==="log"&&(<div style={{maxWidth:540}}>
      {saved&&<div style={{padding:"11px 14px",background:C.accentSoft,borderRadius:8,marginBottom:14,color:C.accent,fontSize:13,fontWeight:600}}>
        ✅ Mating recorded! Expected birth: <strong>{form.matingDate?addDays(form.matingDate,GESTATION):"—"}</strong>
      </div>}
      <div style={S.card}>
        <div style={{fontSize:15,fontWeight:700,color:C.pink,marginBottom:14}}>🐖 Log Mating Event</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={S.lbl}>Sow / Gilt *</label>
            <select value={form.sowId} onChange={e=>setForm({...form,sowId:e.target.value})} style={S.inp}>
              <option value="">Select sow/gilt</option>
              {sows.map(p=>{const sc=sowScore(p.id);return<option key={p.id} value={p.id}>{p.tag} ({p.breed}) — {sc.litters} litters</option>;})}
            </select>
            {sows.length===0&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>No sows found. Add female pigs first.</div>}
          </div>
          <div><label style={S.lbl}>Boar (optional)</label>
            <select value={form.boarId} onChange={e=>setForm({...form,boarId:e.target.value})} style={S.inp}>
              <option value="">Select boar</option>
              {boars.map(p=><option key={p.id} value={p.id}>{p.tag} ({p.breed})</option>)}
            </select>
          </div>
          <div><label style={S.lbl}>Method</label>
            <select value={form.method} onChange={e=>setForm({...form,method:e.target.value})} style={S.inp}>
              {["Natural Service","Artificial Insemination","Hand Mating"].map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label style={S.lbl}>Mating Date *</label><input type="date" value={form.matingDate} onChange={e=>setForm({...form,matingDate:e.target.value})} style={S.inp}/></div>
        </div>

        {/* ─── GENETIC COMPATIBILITY CHECK ─── */}
        {(()=>{
          if(!form.sowId||!form.boarId) return null;
          const sow=pigs.find(p=>p.id===form.sowId);
          const boar=pigs.find(p=>p.id===form.boarId);
          if(!sow||!boar) return null;
          const warnings=[];
          const infos=[];
          // Check same batch/source — possible siblings
          if(sow.batchName&&boar.batchName&&sow.batchName===boar.batchName){
            warnings.push("⚠️ Same batch origin ("+sow.batchName+") — possible siblings. Risk of inbreeding!");
          }
          if(sow.source&&boar.source&&sow.source===boar.source&&sow.arrivalDate&&boar.arrivalDate&&sow.arrivalDate===boar.arrivalDate){
            warnings.push("⚠️ Same source farm & arrival date — may be related. Consider a different boar.");
          }
          // Check previous mating between same pair
          const prevMatings=reproductions.filter(r=>r.sowId===sow.id&&r.boarId===boar.id);
          if(prevMatings.length>=3){
            warnings.push("⚠️ This pair has mated "+prevMatings.length+" times — rotate boar to improve genetic diversity.");
          }
          // Check sow already pregnant
          const alreadyPreg=reproductions.find(r=>r.sowId===sow.id&&r.status==="pregnant");
          if(alreadyPreg){
            warnings.push("🚫 "+sow.tag+" is already pregnant! Expected birth: "+alreadyPreg.expectedFarrow);
          }
          // Check boar age / same breed cross info
          if(sow.breed===boar.breed){
            infos.push("✅ Same breed ("+sow.breed+") — purebred litter expected.");
          } else {
            infos.push("✅ Cross-breed match: "+sow.breed+" × "+boar.breed+" — hybrid vigour expected (higher growth rate).");
          }
          // Check sow history
          const sc2=reproductions.filter(r=>r.sowId===sow.id&&r.status==="farrowed");
          if(sc2.length>0){
            const avgP=sc2.reduce((s,r)=>s+(r.piglets||0),0)/sc2.length;
            infos.push("ℹ️ "+sow.tag+" has "+sc2.length+" previous litter(s), avg "+avgP.toFixed(1)+" piglets.");
          }
          if(warnings.length===0&&!alreadyPreg){
            infos.push("✅ No inbreeding risks detected. Mating approved.");
          }
          const hasBlock=warnings.some(w=>w.startsWith("🚫"));
          return(<div style={{marginBottom:12,borderRadius:9,border:"1.5px solid "+(warnings.length>0?"rgba(239,68,68,.4)":"rgba(22,163,74,.3)"),background:warnings.length>0?"rgba(239,68,68,.04)":"rgba(22,163,74,.04)",padding:"11px 14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>🧬 Genetic Compatibility Check</div>
            {warnings.map((w,i)=>(
              <div key={i} style={{fontSize:12,color:w.startsWith("🚫")?C.red:C.amber,marginBottom:5,display:"flex",gap:6}}>{w}</div>
            ))}
            {infos.map((inf,i)=>(
              <div key={i} style={{fontSize:12,color:C.muted,marginBottom:4}}>{inf}</div>
            ))}
            {hasBlock&&<div style={{marginTop:8,fontSize:11,fontWeight:700,color:C.red,padding:"6px 10px",background:"rgba(239,68,68,.08)",borderRadius:6}}>⛔ This mating is blocked. Resolve the issue above before proceeding.</div>}
          </div>);
        })()}

        {form.matingDate&&<div style={{background:"rgba(22,163,74,.05)",border:"1px solid rgba(22,163,74,.2)",borderRadius:9,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>📅 Auto-Calculated Key Dates:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,fontSize:12}}>
            {[["🔍 Heat Check (Day 21)",addDays(form.matingDate,21),"No heat = pregnant!"],["✅ Confirm Preg (Day 35)",addDays(form.matingDate,35),"Physical signs visible"],["🍽️ Increase Feed (Day 75)",addDays(form.matingDate,75),"2.5kg/day"],["🏠 Prepare Pen (Day 100)",addDays(form.matingDate,100),"Clean & disinfect"],["⚠️ Near Birth (Day 110)",addDays(form.matingDate,110),"Watch closely"],["🐣 Expected Birth (Day 114)",addDays(form.matingDate,114),"Farrowing day!"]].map(([l,v,h])=>(
              <div key={l} style={{background:"#fff",borderRadius:7,padding:"7px 10px"}}>
                <div style={{fontWeight:600,color:C.accent,fontSize:10}}>{l}</div>
                <div style={{fontSize:13,color:C.text,fontWeight:700}}>{v}</div>
                <div style={{fontSize:9,color:C.faint}}>{h}</div>
              </div>
            ))}
          </div>
        </div>}
        <div style={{marginBottom:12}}><label style={S.lbl}>Notes</label><textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="e.g. first mating, AI done twice..." style={{...S.inp,resize:"vertical"}}/></div>
        {(()=>{
          // Block submit if sow is already pregnant
          const sow=pigs.find(p=>p.id===form.sowId);
          const alreadyPreg=sow&&reproductions.find(r=>r.sowId===sow.id&&r.status==="pregnant");
          const blocked=!!alreadyPreg;
          return(<button style={{...S.btn(blocked?"#9ca3af":C.pink),width:"100%",padding:13,fontSize:14,fontWeight:700,cursor:blocked?"not-allowed":"pointer"}} onClick={blocked?null:logMating} disabled={blocked}>
            {blocked?"⛔ Mating Blocked — Sow Already Pregnant":"🐖 Record Mating & Generate Timeline →"}
          </button>);
        })()}
      </div>
    </div>)}

    {/* SOW RECORDS */}
    {tab==="sows"&&(<div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>⭐ Sow Performance</div>
      {sows.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No sows registered yet.</div>}
      {sows.map((sow,i)=>{
        const sc=sowScore(sow.id);
        const currentPreg=reproductions.find(r=>r.sowId===sow.id&&r.status==="pregnant");
        const lastFarrow=reproductions.filter(r=>r.sowId===sow.id&&r.status==="farrowed").slice(-1)[0];
        const nextHeat=lastFarrow?addDays(lastFarrow.farrowDate||lastFarrow.expectedFarrow,33):null;
        const rating=sc.litters===0?"New":sc.avg>=10?"⭐ Excellent":sc.avg>=8?"✅ Good":sc.avg>=6?"⚠️ Average":"❌ Poor";
        const ratingColor=sc.litters===0?C.faint:parseFloat(sc.avg)>=10?C.amber:parseFloat(sc.avg)>=8?C.accent:parseFloat(sc.avg)>=6?C.amber:C.red;
        return(<div key={i} style={{...S.card,marginBottom:12,border:"1px solid "+(currentPreg?"rgba(245,158,11,.3)":C.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontWeight:700,fontSize:15,color:C.text}}>🐷 {sow.tag} <span style={{fontSize:11,color:C.faint,fontWeight:400}}>({sow.breed})</span></div>
            <div style={{fontSize:11,color:C.faint}}>DOB: {sow.dob||"—"} · {sow.weight}kg</div></div>
            <span style={{padding:"3px 11px",borderRadius:20,background:ratingColor+"22",color:ratingColor,fontSize:12,fontWeight:700}}>{rating}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:8}}>
            {[["Litters",sc.litters,C.accent],["Avg Size",sc.avg+" 🐷",C.purple],["Piglets",sc.totalPiglets,C.amber],["Rate",sc.rate+"%",sc.rate>=70?C.accent:C.red]].map(([l,v,c])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"7px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:c,fontSize:14}}>{v}</div>
              </div>
            ))}
          </div>
          {currentPreg&&<div style={{padding:"6px 10px",background:"rgba(245,158,11,.07)",borderRadius:7,fontSize:12,color:C.amber}}>
            🤰 Pregnant · Birth: <strong>{currentPreg.expectedFarrow}</strong> ({daysDiff(currentPreg.expectedFarrow)}d)
          </div>}
          {nextHeat&&!currentPreg&&<div style={{padding:"6px 10px",background:C.accentSoft,borderRadius:7,fontSize:12,color:C.accent}}>
            🔥 Next heat ~<strong>{nextHeat}</strong>
          </div>}
        </div>);
      })}
    </div>)}

    {/* GUIDE */}
    {tab==="guide"&&(<div style={S.card}>
      <div style={{fontSize:14,fontWeight:700,color:C.accent,marginBottom:14}}>📖 Rwanda Pig Breeding Guide</div>
      {[
        {t:"🗓️ Gestation",items:["114 days total (3 months, 3 weeks, 3 days)","Normal range: 112–116 days","Over 116 days: call vet immediately"]},
        {t:"🔥 Heat Signs",items:["Swollen red vulva","Stands still when pressed on back","Restless, loss of appetite","Every 21 days if not pregnant","Breed on day 2 of heat for best results"]},
        {t:"✅ Pregnancy Signs",items:["No return to heat at day 21 = likely pregnant","Swollen abdomen visible from day 35","Udder enlarges from day 90","Nesting behavior 24–48h before birth"]},
        {t:"🏠 Prepare Farrowing Pen",items:["Move sow at day 100–107","Clean, disinfect, dry bedding","Heat lamp (32°C for piglets)","Prepare: towels, iodine, iron injection"]},
        {t:"🐣 Birth Signs",items:["Nesting & restlessness 12–24h before","Milk drops from teats","Vulva swollen and relaxed","Contractions 30 min before first piglet"]},
        {t:"🐷 Newborn Care",items:["Clear mucus from nose and mouth","Dry with clean towel","Disinfect umbilical cord with iodine","Iron injection within 3 days","Ensure nursing within 1 hour"]},
        {t:"💉 After Farrowing",items:["Placenta expelled within 4 hours","Feed 2–3kg/day, increase after day 3","Wean piglets at 28 days","Sow in heat 5–7 days after weaning"]},
      ].map(({t,items},i)=>(
        <div key={i} style={{marginBottom:14,paddingBottom:14,borderBottom:i<6?"1px solid "+C.elevated:"none"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:7}}>{t}</div>
          {items.map((item,ii)=>(
            <div key={ii} style={{display:"flex",gap:8,padding:"2px 0",fontSize:12,color:C.muted}}>
              <span style={{color:C.accent,flexShrink:0}}>•</span>{item}
            </div>
          ))}
        </div>
      ))}
    </div>)}

    {/* AI */}
    {tab==="ai"&&(
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Rwanda pig reproduction advisor. Pregnant: ${pregnant.length}, upcoming farrows 14d: ${upcomingFarrows.length}, overdue: ${overdue.length}, litters: ${farrowed.length}, avg litter: ${avgLitter}, total piglets: ${totalPiglets}. Give: 1) breeding optimization, 2) health risks for pregnant sows, 3) best selling age for piglets, 4) Rwanda seasonal breeding tips, 5) genetic improvement for local breeds.`}
        label="AI Reproduction Advisor" icon="🐖" autoRun={false}/>
    )}
  </div>);
}


/* ─── STOCK MANAGEMENT ─── */
function StockManager({stock,setStock,feeds,pigs,capital,setCapital}){
  const [tab,setTab]=useState("inventory");
  const [form,setForm]=useState({name:"",category:"Feed",quantity:"",unit:"kg",minLevel:"",costPerUnit:"",notes:""});
  const [saved,setSaved]=useState(false);
  const [adjId,setAdjId]=useState(null);
  const [adjQty,setAdjQty]=useState("");
  const CATEGORIES=["Feed","Medicine","Vaccine","Equipment","Other"];

  const active=pigs.filter(p=>p.status==="active");
  // Stage-based daily feed (kg/day): Piglet=0.5,Weaner=1.0,Grower=1.8,Finisher=2.8,Gilt=2.2,Sow=2.5,Boar=2.0
  const STAGE_FEED_KG={Piglet:0.5,Weaner:1.0,Grower:1.8,Finisher:2.8,Gilt:2.2,Sow:2.5,Boar:2.0};
  const dailyFeedKg=Math.round(active.reduce((s,p)=>s+(STAGE_FEED_KG[p.stage]||2.0),0)*10)/10;
  const monthFeedKg=Math.round(dailyFeedKg*30);
  const totalFeedStock=stock.filter(s=>s.category==="Feed").reduce((t,s)=>t+(s.unit==="kg"?s.quantity:0),0);
  const daysOfFeedLeft=dailyFeedKg>0?Math.floor(totalFeedStock/dailyFeedKg):999;
  const lowItems=stock.filter(s=>s.quantity<=s.minLevel);
  const criticalItems=stock.filter(s=>s.quantity<s.minLevel*0.5);
  const totalStockValue=stock.reduce((t,s)=>t+(s.quantity*(s.costPerUnit||0)),0);

  function addItem(){
    if(!form.name||!form.quantity)return;
    const qty=parseFloat(form.quantity)||0;
    const cpu=parseFloat(form.costPerUnit)||0;
    const totalCost=qty*cpu;
    setStock(p=>{const updated=[...p,{...form,id:uid(),quantity:qty,minLevel:parseFloat(form.minLevel)||0,costPerUnit:cpu,lastUpdated:toDay()}];fsSet("stock",updated);return updated;});
    if(setCapital&&totalCost>0){
      const cat=form.category==="Medicine"?"Medicine":form.category==="Vaccine"?"Veterinary":form.category==="Feed"?"Feed Purchase":"Equipment";
      capitalTx(capital,setCapital,{type:"expense",category:cat,amount:totalCost,description:`Purchased ${qty} ${form.unit} of ${form.name}`,date:toDay()});
    }
    setSaved(true);setTimeout(()=>{setSaved(false);setForm({name:"",category:"Feed",quantity:"",unit:"kg",minLevel:"",costPerUnit:"",notes:""});},2000);
  }

  function adjust(id,delta){
    setStock(p=>{const updated=p.map(s=>s.id===id?{...s,quantity:Math.max(0,s.quantity+delta),lastUpdated:toDay()}:s);fsSet("stock",updated);return updated;});
  }

  function applyAdj(id){
    const delta=parseFloat(adjQty)||0;
    if(delta!==0)adjust(id,delta);
    setAdjId(null);setAdjQty("");
  }

  const statusColor=(s)=>s.quantity<s.minLevel*0.5?"rgba(239,68,68,.12)":s.quantity<=s.minLevel?"rgba(245,158,11,.08)":"transparent";
  const statusBorder=(s)=>s.quantity<s.minLevel*0.5?C.red:s.quantity<=s.minLevel?C.amber:C.border;

  return(<div>
    <div style={S.h1}>📦 Stock Management</div>
    <div style={S.sub}>Track feed, medicine, vaccines & supplies · Auto-alerts for low stock</div>

    {/* Alerts */}
    {criticalItems.length>0&&<div style={{padding:"11px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:9,marginBottom:12,fontSize:13,color:C.red}}>
      🚨 <strong>Critical low stock!</strong> {criticalItems.map(s=>s.name).join(", ")} — Restock immediately
    </div>}
    {lowItems.length>0&&lowItems.length!==criticalItems.length&&<div style={{padding:"11px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,marginBottom:12,fontSize:13,color:C.amber}}>
      ⚠️ <strong>Low stock:</strong> {lowItems.filter(s=>s.quantity>s.minLevel*0.5).map(s=>s.name).join(", ")}
    </div>}

    {/* Stats */}
    <div style={S.g4}>
      {[{l:"Total Items",v:stock.length,c:C.accent},{l:"Low Stock Alerts",v:lowItems.length,c:lowItems.length>0?C.red:C.accent},{l:"Feed Stock",v:totalFeedStock+"kg",c:C.amber},{l:"Days of Feed Left",v:daysOfFeedLeft<30?daysOfFeedLeft+"d":daysOfFeedLeft+"d+",c:daysOfFeedLeft<7?C.red:daysOfFeedLeft<14?C.amber:C.accent}].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c}}>{s.v}</div></div>
      ))}
    </div>

    {/* Feed consumption info */}
    {active.length>0&&<div style={{...S.card,padding:14,marginBottom:14,background:"rgba(22,163,74,.04)"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8,fontWeight:700,color:C.accent}}>
        <span>🌾 Feed Consumption Monitor</span>
        <span style={{color:daysOfFeedLeft<7?C.red:daysOfFeedLeft<14?C.amber:C.accent}}>{daysOfFeedLeft} days of feed remaining</span>
      </div>
      <div style={{height:8,background:C.elevated,borderRadius:8,overflow:"hidden",marginBottom:6}}>
        <div style={{height:"100%",width:Math.min(100,daysOfFeedLeft/30*100)+"%",background:daysOfFeedLeft<7?C.red:daysOfFeedLeft<14?C.amber:C.accent,borderRadius:8,transition:"width .4s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.faint}}>
        <span>{active.length} pigs (stage-based avg) = {dailyFeedKg}kg/day</span>
        <span>Monthly need: ~{fmtNum(monthFeedKg)}kg</span>
      </div>
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["inventory","📦 Inventory"],["add","➕ Add Item"],["alerts","⚠️ Alerts ("+lowItems.length+")"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="inventory"&&(
      <div>
        {stock.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No stock items yet. Add your first item.</div>}
        {CATEGORIES.map(cat=>{
          const catItems=stock.filter(s=>s.category===cat);
          if(catItems.length===0)return null;
          return(<div key={cat}>
            <div style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.8}}>{cat}</div>
            {catItems.map((s,i)=>(
              <div key={i} style={{...S.card,marginBottom:8,border:"1px solid "+statusBorder(s),background:s.quantity<=s.minLevel?statusColor(s):C.surface}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:700,color:C.text}}>{s.name}</div>
                    <div style={{fontSize:11,color:C.faint,marginTop:1}}>Min level: {s.minLevel}{s.unit} · Updated: {s.lastUpdated}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:800,color:s.quantity<=s.minLevel*0.5?C.red:s.quantity<=s.minLevel?C.amber:C.accent}}>{fmtNum(s.quantity)}<span style={{fontSize:12,fontWeight:400}}>{s.unit}</span></div>
                    {s.costPerUnit>0&&<div style={{fontSize:10,color:C.faint}}>{fmtRWF(s.quantity*s.costPerUnit)}</div>}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{height:5,background:C.elevated,borderRadius:5,overflow:"hidden",marginBottom:8}}>
                  <div style={{height:"100%",width:s.minLevel>0?Math.min(100,(s.quantity/s.minLevel)*50)+"%":"50%",background:s.quantity<=s.minLevel*0.5?C.red:s.quantity<=s.minLevel?C.amber:C.accent,borderRadius:5}}/>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>adjust(s.id,-1)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.border,background:C.elevated,color:C.text,fontSize:12,cursor:"pointer"}}>−</button>
                  {adjId===s.id?(
                    <div style={{display:"flex",gap:4,flex:1}}>
                      <input type="number" value={adjQty} onChange={e=>setAdjQty(e.target.value)} placeholder="+/- amount" style={{...S.inp,flex:1,padding:"4px 8px",fontSize:12}} autoFocus/>
                      <button onClick={()=>applyAdj(s.id)} style={{...S.btn(C.accent),padding:"4px 10px",fontSize:11,marginRight:0}}>✓</button>
                      <button onClick={()=>{setAdjId(null);setAdjQty("");}} style={{...S.btn("#374151"),padding:"4px 8px",fontSize:11}}>✗</button>
                    </div>
                  ):(
                    <button onClick={()=>setAdjId(s.id)} style={{padding:"4px 12px",borderRadius:6,border:"1px solid "+C.border,background:C.elevated,color:C.muted,fontSize:12,cursor:"pointer",flex:1}}>Adjust Qty</button>
                  )}
                  <button onClick={()=>adjust(s.id,1)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.border,background:C.elevated,color:C.text,fontSize:12,cursor:"pointer"}}>+</button>
                  <button onClick={()=>setStock(p=>p.filter(x=>x.id!==s.id))} style={{padding:"4px 8px",borderRadius:6,border:"none",background:"transparent",color:C.red,fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              </div>
            ))}
          </div>);
        })}
        {stock.length>0&&<div style={{...S.card,padding:12,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.15)"}}>
          <div style={{fontSize:12,color:C.muted}}>Total inventory value: <strong style={{color:C.accent}}>{fmtRWF(totalStockValue)}</strong></div>
        </div>}
      </div>
    )}

    {tab==="add"&&(
      <div style={{maxWidth:500}}>
        {saved&&<div style={{padding:10,background:C.accentSoft,borderRadius:8,marginBottom:12,color:C.accent,fontSize:13}}>✓ Stock item added!</div>}
        <div style={S.card}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Item Name *</label><input placeholder="e.g. Maize Bran" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={S.inp}/></div>
            <div><label style={S.lbl}>Category</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.inp}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label style={S.lbl}>Unit</label><select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} style={S.inp}>{["kg","litres","doses","pcs","bags","boxes"].map(u=><option key={u}>{u}</option>)}</select></div>
            <div><label style={S.lbl}>Current Quantity *</label><input type="number" placeholder="100" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} style={S.inp}/></div>
            <div><label style={S.lbl}>Minimum Level Alert</label><input type="number" placeholder="20" value={form.minLevel} onChange={e=>setForm({...form,minLevel:e.target.value})} style={S.inp}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Cost Per Unit (RWF)</label><input type="number" placeholder="350" value={form.costPerUnit} onChange={e=>setForm({...form,costPerUnit:e.target.value})} style={S.inp}/></div>
          </div>
          {form.quantity&&form.costPerUnit&&parseFloat(form.quantity)>0&&parseFloat(form.costPerUnit)>0&&(
            <div style={{padding:"9px 13px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,marginBottom:12,fontSize:13,color:C.red,fontWeight:600}}>
              💰 Capital expense: {fmtRWF(parseFloat(form.quantity)*parseFloat(form.costPerUnit))} will be deducted from capital
            </div>
          )}
          <button style={{...S.btn(),width:"100%",padding:12,fontSize:14}} onClick={addItem}>📦 Add to Stock →</button>
        </div>
      </div>
    )}

    {tab==="alerts"&&(
      <div>
        {lowItems.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>✅ All stock levels are healthy!</div>}
        {criticalItems.length>0&&<>
          <div style={{fontSize:12,fontWeight:700,color:C.red,marginBottom:8,textTransform:"uppercase"}}>🚨 Critical — Restock Immediately</div>
          {criticalItems.map(s=>(
            <div key={s.id} style={{...S.card,border:"1px solid "+C.red,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,color:C.red}}>{s.name}</div><div style={{fontSize:11,color:C.faint}}>{s.category} · Min: {s.minLevel}{s.unit}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:C.red}}>{s.quantity}{s.unit}</div><div style={{fontSize:10,color:C.faint}}>Need {s.minLevel-s.quantity}+ more</div></div>
              </div>
            </div>
          ))}
        </>}
        {lowItems.filter(s=>s.quantity>s.minLevel*0.5).length>0&&<>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:8,marginTop:12,textTransform:"uppercase"}}>⚠️ Low Stock — Order Soon</div>
          {lowItems.filter(s=>s.quantity>s.minLevel*0.5).map(s=>(
            <div key={s.id} style={{...S.card,border:"1px solid "+C.amber,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:700,color:C.amber}}>{s.name}</div><div style={{fontSize:11,color:C.faint}}>{s.category} · Min: {s.minLevel}{s.unit}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800,color:C.amber}}>{s.quantity}{s.unit}</div><div style={{fontSize:10,color:C.faint}}>Min level: {s.minLevel}</div></div>
              </div>
            </div>
          ))}
        </>}
      </div>
    )}
  </div>);
}

/* ─── PROFIT & LOSS ANALYSIS ─── */
function ProfitLossAnalysis({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,allData,capital}){
  const [tab,setTab]=useState("overview");
  const [period,setPeriod]=useState("all");
  const active=pigs.filter(p=>p.status==="active");
  const sold=pigs.filter(p=>p.status==="sold");

  // Period filter
  const now=new Date();
  function inPeriod(dateStr){
    if(period==="all"||!dateStr) return true;
    const d=new Date(dateStr);
    if(period==="thisMonth") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(period==="lastMonth"){const lm=new Date(now);lm.setMonth(now.getMonth()-1);return d.getMonth()===lm.getMonth()&&d.getFullYear()===lm.getFullYear();}
    if(period==="thisYear") return d.getFullYear()===now.getFullYear();
    if(period==="last30"){const cutoff=new Date(now);cutoff.setDate(now.getDate()-30);return d>=cutoff;}
    if(period==="last90"){const cutoff=new Date(now);cutoff.setDate(now.getDate()-90);return d>=cutoff;}
    return true;
  }

  const fSales=sales.filter(s=>inPeriod(s.date));
  const fIncomes=incomes.filter(i=>inPeriod(i.date));
  const fFeeds=feeds.filter(f=>inPeriod(f.date));
  const fExpenses=expenses.filter(e=>inPeriod(e.date));

  // Financial totals — single source of truth via calcPnL
  const {totalInc:totalIncome,totalExp:totalExpense,profit:realizedProfit}=calcPnL(capital||{transactions:[]},fFeeds,fSales,fExpenses,fIncomes);
  // Array-based breakdowns for detail display
  const totalSaleInc=fSales.reduce((s,l)=>s+(l.total||0),0);
  const totalOtherInc=fIncomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalFeedCost=fFeeds.reduce((s,l)=>s+(l.cost||0),0);
  const totalVetCost=fExpenses.filter(e=>e.category==="Veterinary"||e.category==="Medicine").reduce((s,e)=>s+(e.amount||0),0);
  const totalLabourCost=fExpenses.filter(e=>e.category==="Labour").reduce((s,e)=>s+(e.amount||0),0);
  const totalOtherExp=fExpenses.reduce((s,l)=>s+(l.amount||0),0);

  // Margins and ratios
  const grossMargin=totalIncome>0?((totalIncome-totalFeedCost)/totalIncome*100).toFixed(1):0;
  const netMargin=totalIncome>0?((realizedProfit/totalIncome)*100).toFixed(1):0;
  const roi=totalExpense>0?((realizedProfit/totalExpense)*100).toFixed(1):0;
  const expenseRatio=totalIncome>0?((totalExpense/totalIncome)*100).toFixed(1):0;
  const feedPct=totalExpense>0?((totalFeedCost/totalExpense)*100).toFixed(1):0;

  // Break-even analysis
  const avgSalePrice=fSales.length>0?Math.round(fSales.reduce((s,l)=>s+(l.total||0),0)/fSales.length):0;
  const avgCostPerSale=fSales.length>0?Math.round(totalExpense/fSales.length):0;
  const pigsToBreakEven=avgSalePrice>avgCostPerSale&&avgSalePrice>0?Math.ceil(totalExpense/avgSalePrice):null;

  // Unsold herd estimated value
  const herdValue=active.reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);
  const totalPigs=pigs.length||1;
  const costPerPig=totalExpense/totalPigs;
  const allocatedCostUnsold=active.length*costPerPig;
  const unrealizedPnL=herdValue-allocatedCostUnsold;

  // Total portfolio
  const totalPortfolioValue=totalIncome+herdValue;
  const totalPortfolioPnL=totalPortfolioValue-totalExpense;

  // Monthly trend (last 6 months)
  function getMonths6(){const m=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);m.push(d.toISOString().slice(0,7));}return m;}
  const months6=getMonths6();
  const monthlyData=months6.map(m=>({
    m,
    inc:fSales.filter(s=>(s.date||"").startsWith(m)).reduce((s,l)=>s+(l.total||0),0)+fIncomes.filter(i=>(i.date||"").startsWith(m)).reduce((s,l)=>s+(l.amount||0),0),
    exp:fFeeds.filter(f=>(f.date||"").startsWith(m)).reduce((s,l)=>s+(l.cost||0),0)+fExpenses.filter(e=>(e.date||"").startsWith(m)).reduce((s,l)=>s+(l.amount||0),0),
  }));
  const maxMonthly=Math.max(...monthlyData.map(d=>Math.max(d.inc,d.exp)),1);

  // 30-day forecast
  const avgMonthlyExp=totalExpense/(Math.max(1,new Set(fFeeds.map(f=>f.date?.slice(0,7))).size)||1);
  const ready80=active.filter(p=>p.weight>=80);
  const almostReady=active.filter(p=>p.weight>=65&&p.weight<80);
  const potentialRevenue30=ready80.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0);
  const expectedExp30=avgMonthlyExp||totalExpense/Math.max(1,fFeeds.length)*30;
  const forecast30Profit=potentialRevenue30-expectedExp30;
  const pregnant=(reproductions||[]).filter(r=>r.status==="pregnant");
  const farrowingsNext30=pregnant.filter(r=>daysDiff(r.expectedFarrow)>=0&&daysDiff(r.expectedFarrow)<=30);
  const expectedPigletValue=farrowingsNext30.length*10*10000;

  // Expense by category
  const expByCat={};
  fFeeds.forEach(f=>{expByCat["Feed Purchase"]=(expByCat["Feed Purchase"]||0)+(f.cost||0);});
  fExpenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+(e.amount||0);});
  const sortedExpCats=Object.entries(expByCat).sort((a,b)=>b[1]-a[1]);

  const tabs=["overview","breakdown","sold","unsold","30day","trend"];

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={S.h1}>💹 Profit & Loss Analysis</div>
        <div style={S.sub}>Full P&L · break-even · margins · 30-day forecast</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...S.inp,width:"auto",fontSize:12,padding:"7px 11px"}}>
          {[["all","All Time"],["thisMonth","This Month"],["lastMonth","Last Month"],["last30","Last 30 Days"],["last90","Last 90 Days"],["thisYear","This Year"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        <PDFBtn label="P&L PDF" type="pnl" getData={()=>allData} icon="💹" color="#374151"/>
      </div>
    </div>

    {/* Key metrics banner */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:14}}>
      {[
        {l:"Net Profit",v:fmtRWF(realizedProfit),c:realizedProfit>=0?C.accent:C.red,bg:realizedProfit>=0?"rgba(22,163,74,.06)":"rgba(239,68,68,.06)"},
        {l:"Net Margin",v:netMargin+"%",c:parseFloat(netMargin)>=20?C.accent:parseFloat(netMargin)>=0?C.amber:C.red,bg:"rgba(245,158,11,.04)"},
        {l:"Gross Margin",v:grossMargin+"%",c:C.blue,bg:"rgba(37,99,235,.04)"},
        {l:"ROI",v:roi+"%",c:C.purple,bg:"rgba(124,58,237,.04)"},
        {l:"Total Income",v:fmtRWF(totalIncome),c:"#10b981",bg:"rgba(16,185,129,.04)"},
        {l:"Total Expenses",v:fmtRWF(totalExpense),c:C.red,bg:"rgba(239,68,68,.04)"},
        {l:"Herd Value",v:fmtRWF(herdValue),c:C.purple,bg:"rgba(124,58,237,.04)"},
        {l:"Portfolio P&L",v:fmtRWF(totalPortfolioPnL),c:totalPortfolioPnL>=0?C.accent:C.red,bg:totalPortfolioPnL>=0?"rgba(22,163,74,.06)":"rgba(239,68,68,.06)"},
      ].map(s=>(
        <div key={s.l} style={{background:s.bg,border:"1px solid "+C.border,borderRadius:11,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:C.faint,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>{s.l}</div>
          <div style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
        </div>
      ))}
    </div>

    {/* Income vs Expense visual bar */}
    <div style={{...S.card,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:12,fontWeight:700,color:C.text}}>Income vs Expenses Ratio</span>
        <span style={{fontSize:12,fontWeight:700,color:realizedProfit>=0?C.accent:C.red}}>{realizedProfit>=0?"✅ Profitable":"⚠️ Running at loss"} · Expense ratio: {expenseRatio}%</span>
      </div>
      <div style={{height:14,background:C.elevated,borderRadius:8,overflow:"hidden",marginBottom:4,display:"flex"}}>
        {totalIncome>0&&<div style={{height:"100%",width:Math.min((totalExpense/totalIncome)*100,100)+"%",background:totalExpense>totalIncome?"linear-gradient(90deg,#ef4444,#dc2626)":"linear-gradient(90deg,#f59e0b,#d97706)",borderRadius:8,transition:"width .5s"}}/>}
      </div>
      <div style={{display:"flex",gap:16,fontSize:11,color:C.faint}}>
        <span style={{color:"#10b981"}}>● Income: {fmtRWF(totalIncome)}</span>
        <span style={{color:C.red}}>● Expenses: {fmtRWF(totalExpense)}</span>
        <span style={{color:realizedProfit>=0?C.accent:C.red}}>● Net: {fmtRWF(realizedProfit)}</span>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["overview","📊 Overview"],["breakdown","📂 Cost Breakdown"],["sold","💚 Sold Pigs"],["unsold","🐷 Active Herd"],["30day","📅 30-Day Forecast"],["trend","📈 Monthly Trend"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="overview"&&(<div>
      {/* P&L statement */}
      <div style={{...S.card,background:totalPortfolioPnL>=0?"rgba(22,163,74,.03)":"rgba(239,68,68,.03)",border:"1px solid "+(totalPortfolioPnL>=0?"rgba(22,163,74,.2)":"rgba(239,68,68,.2)")}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14,paddingBottom:10,borderBottom:"2px solid "+(totalPortfolioPnL>=0?"rgba(22,163,74,.2)":"rgba(239,68,68,.2)")}}>📊 Profit & Loss Statement</div>
        {[
          {l:"🏷️ Pig Sale Revenue",v:fmtRWF(totalSaleInc),c:"#10b981",indent:false},
          {l:"💰 Other Income",v:fmtRWF(totalOtherInc),c:"#10b981",indent:false},
          {l:"TOTAL REVENUE",v:fmtRWF(totalIncome),c:"#10b981",bold:true,bg:"rgba(16,185,129,.07)"},
          {l:"🌾 Feed Costs",v:"("+fmtRWF(totalFeedCost)+")",c:C.red,indent:false},
          {l:"💊 Vet & Medicine",v:"("+fmtRWF(totalVetCost)+")",c:C.red,indent:false},
          {l:"👷 Labour",v:"("+fmtRWF(totalLabourCost)+")",c:C.red,indent:false},
          {l:"📦 Other Expenses",v:"("+fmtRWF(totalOtherExp)+")",c:C.red,indent:false},
          {l:"TOTAL EXPENSES",v:"("+fmtRWF(totalExpense)+")",c:C.red,bold:true,bg:"rgba(239,68,68,.07)"},
          {l:"NET REALIZED PROFIT",v:fmtRWF(realizedProfit),c:realizedProfit>=0?C.accent:C.red,bold:true,bg:realizedProfit>=0?"rgba(22,163,74,.1)":"rgba(239,68,68,.1)"},
          {l:"🐷 Herd Market Value (unrealized)",v:fmtRWF(herdValue),c:C.purple,indent:false},
          {l:"TOTAL PORTFOLIO",v:fmtRWF(totalPortfolioPnL),c:totalPortfolioPnL>=0?C.accent:C.red,bold:true,bg:totalPortfolioPnL>=0?"rgba(22,163,74,.12)":"rgba(239,68,68,.12)"},
        ].map(({l,v,c,bold,bg,indent})=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px "+(bg?"12px":"2px"),marginBottom:2,borderRadius:bg?7:0,background:bg||"transparent"}}>
            <span style={{fontSize:bold?13:12,fontWeight:bold?700:400,color:bold?C.text:C.muted,paddingLeft:indent?14:0}}>{l}</span>
            <span style={{fontSize:bold?14:13,fontWeight:bold?800:600,color:c}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:10,padding:"9px 12px",background:"rgba(22,163,74,.05)",borderRadius:8,display:"flex",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:C.muted}}>Net Margin: <b style={{color:parseFloat(netMargin)>=0?C.accent:C.red}}>{netMargin}%</b></span>
          <span style={{fontSize:11,color:C.muted}}>Gross Margin: <b style={{color:C.blue}}>{grossMargin}%</b></span>
          <span style={{fontSize:11,color:C.muted}}>ROI: <b style={{color:C.purple}}>{roi}%</b></span>
          <span style={{fontSize:11,color:C.muted}}>Feed as % of expenses: <b style={{color:C.amber}}>{feedPct}%</b></span>
        </div>
      </div>
      {/* Break-even */}
      {avgSalePrice>0&&<div style={{...S.card,border:"1px solid rgba(99,102,241,.2)",background:"rgba(99,102,241,.03)",marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"#6366f1",marginBottom:10}}>📐 Break-Even Analysis</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[["Avg Sale/pig",fmtRWF(avgSalePrice)],["Avg Cost/pig",fmtRWF(avgCostPerSale)],["Pigs to break even",pigsToBreakEven!==null?pigsToBreakEven+" pigs":"N/A"]].map(([l,v])=>(
            <div key={l} style={{background:C.elevated,borderRadius:8,padding:"9px 11px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:700,color:C.text,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>
        {pigsToBreakEven!==null&&<div style={{marginTop:10,fontSize:12,color:C.muted}}>
          You need to sell approximately <b style={{color:"#6366f1"}}>{pigsToBreakEven} pigs</b> at current avg price to cover all expenses.
          {fSales.length>=pigsToBreakEven?<span style={{color:C.accent}}> ✅ Already reached break-even ({fSales.length} sold)!</span>:<span style={{color:C.amber}}> {fSales.length}/{pigsToBreakEven} sales so far.</span>}
        </div>}
      </div>}
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic={`Full farm P&L analysis Rwanda: realized profit=${fmtRWF(realizedProfit)}, net margin=${netMargin}%, herd value=${fmtRWF(herdValue)}, ROI=${roi}%, feed is ${feedPct}% of expenses. Give specific profit improvement actions, cost reduction strategies, investment advice for Rwanda pig farming.`} label="AI P&L Strategy" icon="💹"/>
    </div>)}

    {tab==="breakdown"&&(<div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:14}}>🔴 Expense Breakdown by Category</div>
        {sortedExpCats.length===0&&<div style={{color:C.faint,fontSize:13}}>No expenses recorded yet.</div>}
        {sortedExpCats.map(([cat,amt])=>{
          const pct=totalExpense>0?((amt/totalExpense)*100).toFixed(1):0;
          return(<div key={cat} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
              <span style={{fontWeight:600,color:C.text}}>{cat}</span>
              <span style={{color:C.red,fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400}}>({pct}%)</span></span>
            </div>
            <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:cat==="Feed Purchase"?"#f59e0b":cat==="Pig Purchase"?"#6366f1":cat==="Veterinary"||cat==="Medicine"?"#14b8a6":C.red,borderRadius:4,transition:"width .4s"}}/>
            </div>
          </div>);
        })}
        {totalExpense>0&&<div style={{marginTop:10,padding:"9px 13px",background:"rgba(239,68,68,.06)",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:13}}>Total Expenses</span>
          <span style={{color:C.red,fontWeight:700}}>{fmtRWF(totalExpense)}</span>
        </div>}
      </div>
      <div style={{...S.card,marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:14}}>💚 Income Breakdown</div>
        {[["🏷️ Pig Sales",totalSaleInc,totalIncome],["💰 Other Income",totalOtherInc,totalIncome]].map(([l,amt,total])=>{
          const pct=total>0?((amt/total)*100).toFixed(1):0;
          return(<div key={l} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
              <span style={{fontWeight:600,color:C.text}}>{l}</span>
              <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400}}>({pct}%)</span></span>
            </div>
            <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:"#10b981",borderRadius:4,transition:"width .4s"}}/>
            </div>
          </div>);
        })}
        {totalIncome>0&&<div style={{marginTop:10,padding:"9px 13px",background:"rgba(16,185,129,.06)",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:13}}>Total Income</span>
          <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(totalIncome)}</span>
        </div>}
      </div>
    </div>)}

    {tab==="sold"&&(<div>
      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12}}>💚 Revenue Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[["Pig Sales",fmtRWF(totalSaleInc),"#10b981"],["Other Income",fmtRWF(totalOtherInc),C.accent],["Avg per Sale",fSales.length>0?fmtRWF(Math.round(totalSaleInc/fSales.length)):"—","#10b981"]].map(([l,v,c])=>(
            <div key={l} style={{background:C.elevated,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:700,color:c,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 Sale Records ({fSales.length})</div>
        {fSales.length===0&&<div style={{color:C.faint,fontSize:13}}>No sales recorded for this period.</div>}
        {fSales.slice().reverse().map((s,i)=>{
          const pig=pigs.find(p=>p.id===s.pigId);
          const estProfit=s.total-(costPerPig);
          return(<div key={i} style={{...S.row,borderBottom:"1px solid "+C.elevated,paddingBottom:8,marginBottom:8}}>
            <div>
              <div style={{fontWeight:600,color:C.text}}>{pig?pig.tag:"Pig"} — {s.buyer||"Unknown buyer"}</div>
              <div style={{fontSize:11,color:C.faint}}>{s.date} · {s.weight||0}kg @ RWF {fmtNum(s.priceKg)}/kg · {s.worker}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:"#10b981",fontSize:14}}>{fmtRWF(s.total)}</div>
              <div style={{fontSize:10,color:estProfit>=0?C.accent:C.red}}>Est. margin: {fmtRWF(estProfit)}</div>
            </div>
          </div>);
        })}
        {fSales.length>0&&<div style={{padding:"9px 13px",background:"rgba(16,185,129,.06)",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:13}}>Total · {fSales.length} sale(s)</span>
          <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(totalSaleInc)}</span>
        </div>}
      </div>
    </div>)}

    {tab==="unsold"&&(<div>
      <div style={{...S.card,background:"rgba(167,139,250,.04)",border:"1px solid rgba(167,139,250,.2)",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:12}}>🐷 Active Herd Valuation</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:12}}>
          {[["Active Pigs",active.length+" pigs","#94a3b8"],["Market Value",fmtRWF(herdValue),C.purple],["Est. Cost Invested",fmtRWF(allocatedCostUnsold),C.amber],["Unrealized Gain/Loss",fmtRWF(unrealizedPnL),unrealizedPnL>=0?C.accent:C.red]].map(([l,v,c])=>(
            <div key={l} style={{background:C.elevated,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:700,color:c,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.faint}}>Cost allocated proportionally. Market values based on current Rwanda livestock prices.</div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Per-Pig Valuation ({active.length} active)</div>
        {active.length===0&&<div style={{color:C.faint,fontSize:13}}>No active pigs.</div>}
        {active.slice().sort((a,b)=>getMarketPrice(b.stage,b.weight)-getMarketPrice(a.stage,a.weight)).map((pig,i)=>{
          const val=getMarketPrice(pig.stage,pig.weight);
          const pigPnL=val-costPerPig;
          const pct=herdValue>0?((val/herdValue)*100).toFixed(0):0;
          return(<div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <div>
                <span style={{fontWeight:600,color:C.text,fontSize:13}}>🐷 {pig.tag}</span>
                <span style={{fontSize:11,color:C.faint,marginLeft:7}}>{pig.stage} · {pig.weight}kg · {pig.breed}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontWeight:700,color:C.purple,fontSize:13}}>{fmtRWF(val)}</span>
                <span style={{fontSize:10,color:pigPnL>=0?C.accent:C.red,marginLeft:8}}>{pigPnL>=0?"+":""}{fmtRWF(pigPnL)}</span>
              </div>
            </div>
            <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:C.purple,borderRadius:3}}/>
            </div>
          </div>);
        })}
        <div style={{marginTop:10,padding:"9px 13px",background:"rgba(167,139,250,.06)",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.muted,fontSize:13}}>Total herd market value</span>
          <span style={{color:C.purple,fontWeight:700}}>{fmtRWF(herdValue)}</span>
        </div>
      </div>
    </div>)}

    {tab==="30day"&&(<div>
      <div style={{...S.card,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.2)",marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:C.accent,marginBottom:16}}>📅 30-Day Profit Forecast</div>
        {[
          ["🐷 Market-ready pigs (80kg+)",`${ready80.length} pigs`,C.accent],
          ["📦 Potential sale revenue (80kg+ pigs)",fmtRWF(potentialRevenue30),C.accent],
          ["⏳ Almost ready (65–80kg)",`${almostReady.length} pigs growing toward market`,C.amber],
          ["🐖 Expected farrowings in 30 days",`${farrowingsNext30.length} sow(s) due`,C.pink],
          ["🐷 Expected piglet income",fmtRWF(expectedPigletValue),C.pink],
          ["🔴 Est. 30-day operating costs",fmtRWF(Math.round(expectedExp30)),C.red],
          ["━ 30-Day Net Forecast",fmtRWF(Math.round(forecast30Profit+expectedPigletValue)),forecast30Profit+expectedPigletValue>=0?C.accent:C.red],
        ].map(([l,v,c])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid "+C.elevated}}>
            <span style={{color:C.muted,fontSize:13}}>{l}</span>
            <span style={{fontWeight:700,color:c,fontSize:13}}>{v}</span>
          </div>
        ))}
        <div style={{marginTop:14,padding:"13px 16px",borderRadius:10,background:forecast30Profit+expectedPigletValue>=0?"rgba(22,163,74,.1)":"rgba(239,68,68,.08)",border:"1px solid "+(forecast30Profit+expectedPigletValue>=0?"rgba(22,163,74,.3)":"rgba(239,68,68,.3)")}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:3}}>30-Day Total Profit Opportunity</div>
          <div style={{fontSize:24,fontWeight:800,color:forecast30Profit+expectedPigletValue>=0?C.accent:C.red}}>{fmtRWF(Math.round(forecast30Profit+expectedPigletValue))}</div>
          <div style={{fontSize:12,color:C.faint,marginTop:5}}>{forecast30Profit+expectedPigletValue>=0?"✅ Positive outlook — prioritize selling market-ready pigs first":"⚠️ Review feed costs and consider faster selling"}</div>
        </div>
      </div>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} topic={`30-day profit forecast Rwanda: ${ready80.length} pigs ready to sell (value=${fmtRWF(potentialRevenue30)}), ${farrowingsNext30.length} farrowings expected, net margin=${netMargin}%, operating costs=${fmtRWF(Math.round(expectedExp30))}. Predict exact 30-day profit/loss, specific actions to maximize it, Rwanda market price negotiation tips.`} label="AI 30-Day Profit Forecast" icon="📅"/>
    </div>)}

    {tab==="trend"&&(<div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:14}}>📈 Monthly Income vs Expenses (Last 6 Months)</div>
        {monthlyData.map(({m,inc,exp})=>{
          const profit=inc-exp;
          const label=m.split("-").length===2?["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.split("-")[1])-1]+" "+m.split("-")[0].slice(2):"—";
          return(<div key={m} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <span style={{fontWeight:600,color:C.text}}>{label}</span>
              <span style={{color:profit>=0?C.accent:C.red,fontWeight:700}}>{profit>=0?"+":""}{fmtRWF(profit)}</span>
            </div>
            <div style={{marginBottom:3}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.faint,marginBottom:2}}>
                <span style={{color:"#10b981"}}>Income</span><span style={{color:"#10b981"}}>{fmtRWF(inc)}</span>
              </div>
              <div style={{height:7,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:(maxMonthly>0?(inc/maxMonthly)*100:0)+"%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:4,transition:"width .5s"}}/>
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.faint,marginBottom:2}}>
                <span style={{color:C.red}}>Expenses</span><span style={{color:C.red}}>{fmtRWF(exp)}</span>
              </div>
              <div style={{height:7,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:(maxMonthly>0?(exp/maxMonthly)*100:0)+"%",background:"linear-gradient(90deg,#ef4444,#dc2626)",borderRadius:4,transition:"width .5s"}}/>
              </div>
            </div>
          </div>);
        })}
        {monthlyData.every(d=>d.inc===0&&d.exp===0)&&<div style={{color:C.faint,fontSize:13,textAlign:"center",padding:20}}>No data for the last 6 months.</div>}
      </div>
      <div style={{...S.card,marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Monthly Summary Table</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Month","Income","Expenses","Profit","Margin"].map(h=><th key={h} style={{textAlign:"left",color:C.faint,paddingBottom:8,borderBottom:"1px solid "+C.border,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>
            {monthlyData.filter(d=>d.inc>0||d.exp>0).sort((a,b)=>b.m.localeCompare(a.m)).map(({m,inc,exp})=>{
              const p=inc-exp;
              const mg=inc>0?((p/inc)*100).toFixed(0):"—";
              const label=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.split("-")[1])-1]+" "+m.split("-")[0].slice(2);
              return(<tr key={m} style={{borderBottom:"1px solid "+C.elevated}}>
                <td style={{padding:"8px 0",color:C.muted}}>{label}</td>
                <td style={{color:"#10b981",fontWeight:600}}>{fmtRWF(inc)}</td>
                <td style={{color:C.red,fontWeight:600}}>{fmtRWF(exp)}</td>
                <td style={{color:p>=0?C.accent:C.red,fontWeight:700}}>{fmtRWF(p)}</td>
                <td style={{color:parseFloat(mg)>=20?C.accent:parseFloat(mg)>=0?C.amber:C.red,fontWeight:600}}>{mg}%</td>
              </tr>);
            })}
          </tbody>
        </table>
        {monthlyData.every(d=>d.inc===0&&d.exp===0)&&<div style={{color:C.faint,fontSize:13,paddingTop:8}}>No monthly data yet.</div>}
      </div>
    </div>)}
  </div>);
}

/* ─── LEDGER ─── */
function Ledger({expenses,setExpenses,incomes,setIncomes,feeds,setFeeds,sales,setSales,capital,setCapital}){
  const [tab,setTab]=useState("overview");
  const [eForm,setEForm]=useState({date:toDay(),category:"Feed Purchase",amount:"",description:""});
  const [iForm,setIForm]=useState({date:toDay(),category:"Pig Sale",amount:"",description:""});
  const [eSaved,setESaved]=useState(false);const [iSaved,setISaved]=useState(false);
  const [editItem,setEditItem]=useState(null);
  const [search,setSearch]=useState("");
  const [filterType,setFilterType]=useState("all");
  const {totalInc:totalIncome,totalExp:totalExpense,profit}=calcPnL(capital||{transactions:[]},feeds,sales,expenses,incomes);
  const totalSaleInc=sales.reduce((s,l)=>s+(l.total||0),0);
  const totalOtherInc=incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalFeedCost=feeds.reduce((s,l)=>s+(l.cost||0),0);
  const totalOtherExp=expenses.reduce((s,l)=>s+(l.amount||0),0);
  const margin=totalIncome>0?((profit/totalIncome)*100).toFixed(1):"—";

  const allTx=[
    ...sales.map(s=>({id:s.id,date:s.date,type:"income",cat:"Pig Sale",desc:`${s.buyer||"Buyer"} — ${s.weight||0}kg @ RWF ${s.priceKg||0}/kg`,amount:s.total,src:"sale",worker:s.worker})),
    ...incomes.map(i=>({...i,type:"income",cat:i.category,src:"income",desc:i.description||i.category,worker:i.worker||"Admin"})),
    ...feeds.map(f=>({id:f.id,date:f.date,type:"expense",cat:"Feed Purchase",desc:`${f.feedType} ${f.kg}kg — ${f.worker}`,amount:f.cost,src:"feed",worker:f.worker})),
    ...expenses.map(e=>({...e,type:"expense",cat:e.category,src:"expense",desc:e.description||e.category,worker:e.worker||"Admin"}))
  ].sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  // Running balance (chronological)
  let runBalance=capital.initial||0;
  const txWithBalance=[...allTx].reverse().map(tx=>{
    runBalance+=tx.type==="income"?tx.amount:-tx.amount;
    return{...tx,runBal:runBalance};
  }).reverse();

  const filtered=txWithBalance.filter(tx=>{
    if(filterType==="income"&&tx.type!=="income") return false;
    if(filterType==="expense"&&tx.type!=="expense") return false;
    if(search){
      const q=search.toLowerCase();
      if(!(tx.cat||"").toLowerCase().includes(q)&&!(tx.desc||"").toLowerCase().includes(q)&&!(tx.worker||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Income by category
  const incByCat={};
  sales.forEach(s=>{incByCat["Pig Sale"]=(incByCat["Pig Sale"]||0)+(s.total||0);});
  incomes.forEach(i=>{incByCat[i.category]=(incByCat[i.category]||0)+(i.amount||0);});
  // Expense by category
  const expByCat={};
  feeds.forEach(f=>{expByCat["Feed Purchase"]=(expByCat["Feed Purchase"]||0)+(f.cost||0);});
  expenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+(e.amount||0);});

  function addExpense(){
    if(!eForm.amount)return;
    const newE={...eForm,id:uid(),amount:parseFloat(eForm.amount),worker:"Admin"};
    setExpenses(p=>{const updated=[...p,newE];fsSet("expenses",updated);return updated;});
    if(setCapital) capitalTx(capital,setCapital,{type:"expense",category:eForm.category,amount:parseFloat(eForm.amount),description:eForm.description,date:eForm.date});
    setESaved(true);setTimeout(()=>{setESaved(false);setEForm({date:toDay(),category:"Feed Purchase",amount:"",description:""});},2000);
  }
  function addIncome(){
    if(!iForm.amount)return;
    const newI={...iForm,id:uid(),amount:parseFloat(iForm.amount),worker:"Admin"};
    setIncomes(p=>{const updated=[...p,newI];fsSet("incomes",updated);return updated;});
    if(setCapital) capitalTx(capital,setCapital,{type:"income",category:iForm.category,amount:parseFloat(iForm.amount),description:iForm.description,date:iForm.date});
    setISaved(true);setTimeout(()=>{setISaved(false);setIForm({date:toDay(),category:"Pig Sale",amount:"",description:""});},2000);
  }
  function deleteIncome(id){setIncomes(p=>{const updated=p.filter(i=>i.id!==id);fsSet("incomes",updated);return updated;});}
  function deleteExpense(id){setExpenses(p=>{const updated=p.filter(e=>e.id!==id);fsSet("expenses",updated);return updated;});}
  function saveEdit(){
    if(!editItem)return;
    if(editItem.src==="income") setIncomes(p=>{const updated=p.map(i=>i.id===editItem.id?{...i,...editItem,amount:parseFloat(editItem.amount)||i.amount}:i);fsSet("incomes",updated);return updated;});
    if(editItem.src==="expense") setExpenses(p=>{const updated=p.map(e=>e.id===editItem.id?{...e,...editItem,amount:parseFloat(editItem.amount)||e.amount}:e);fsSet("expenses",updated);return updated;});
    setEditItem(null);
  }

  return(<div>
    <div style={S.h1}>📒 Income & Expense Ledger</div>
    <div style={S.sub}>Full financial record — all transactions, running balance & analytics</div>

    {/* Summary stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:14}}>
      {[
        {l:"Total Income",v:fmtRWF(totalIncome),c:"#10b981"},
        {l:"Total Expenses",v:fmtRWF(totalExpense),c:C.red},
        {l:"Net Profit",v:fmtRWF(profit),c:profit>=0?C.accent:C.red},
        {l:"Net Margin",v:margin+"%",c:parseFloat(margin)>=20?C.accent:parseFloat(margin)>=0?C.amber:C.red},
      ].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:s.v.length>10?13:18}}>{s.v}</div></div>
      ))}
    </div>

    {/* Visual profit bar */}
    <div style={{...S.card,padding:"13px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
        <span style={{color:C.muted,fontWeight:600}}>Expense Ratio</span>
        <span style={{color:profit>=0?C.accent:C.red,fontWeight:700}}>{profit>=0?"✅ Profitable":"⚠️ Running at loss"}</span>
      </div>
      <div style={{height:12,background:C.elevated,borderRadius:8,overflow:"hidden",marginBottom:5}}>
        <div style={{height:"100%",width:(totalIncome>0?Math.min((totalExpense/totalIncome)*100,100):0)+"%",background:totalExpense>totalIncome?"linear-gradient(90deg,#ef4444,#dc2626)":"linear-gradient(90deg,#f59e0b,#d97706)",borderRadius:8,transition:"width .4s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.faint}}>
        <span>Expenses: <b style={{color:C.red}}>{fmtRWF(totalExpense)}</b></span>
        <span>Income: <b style={{color:"#10b981"}}>{fmtRWF(totalIncome)}</b></span>
        <span>Profit: <b style={{color:profit>=0?C.accent:C.red}}>{fmtRWF(profit)}</b></span>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["overview","📊 Overview"],["income","💚 Add Income"],["expenses","🔴 Add Expense"],["all","📋 All Transactions"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="overview"&&(<div style={S.g2}>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12}}>💚 Income Sources</div>
        {Object.entries(incByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
          const pct=totalIncome>0?((amt/totalIncome)*100).toFixed(0):0;
          return(<div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.muted}}>{cat}</span>
              <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400}}>({pct}%)</span></span>
            </div>
            <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:"#10b981",borderRadius:3}}/>
            </div>
          </div>);
        })}
        {Object.keys(incByCat).length===0&&<div style={{color:C.faint,fontSize:13}}>No income yet.</div>}
        <div style={{...S.row,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:7,marginTop:8}}>
          <span style={{fontWeight:700,color:C.text}}>TOTAL</span>
          <span style={{color:"#10b981",fontWeight:800}}>{fmtRWF(totalIncome)}</span>
        </div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:12}}>🔴 Expense Categories</div>
        {Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
          const pct=totalExpense>0?((amt/totalExpense)*100).toFixed(0):0;
          return(<div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:C.muted}}>{cat}</span>
              <span style={{color:C.red,fontWeight:700}}>{fmtRWF(amt)} <span style={{color:C.faint,fontWeight:400}}>({pct}%)</span></span>
            </div>
            <div style={{height:5,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:C.red,borderRadius:3}}/>
            </div>
          </div>);
        })}
        {Object.keys(expByCat).length===0&&<div style={{color:C.faint,fontSize:13}}>No expenses yet.</div>}
        <div style={{...S.row,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:7,marginTop:8}}>
          <span style={{fontWeight:700,color:C.text}}>TOTAL</span>
          <span style={{color:C.red,fontWeight:800}}>{fmtRWF(totalExpense)}</span>
        </div>
      </div>
    </div>)}

    {tab==="income"&&(<div style={{maxWidth:500}}>
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,color:"#10b981",marginBottom:14}}>💚 Record Manual Income</div>
        {iSaved&&<div style={{padding:10,background:"rgba(16,185,129,.08)",borderRadius:8,marginBottom:12,color:"#10b981",fontSize:13,fontWeight:600}}>✅ Income recorded!</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={S.lbl}>Date</label><input type="date" value={iForm.date} onChange={e=>setIForm({...iForm,date:e.target.value})} style={S.inp}/></div>
          <div><label style={S.lbl}>Category</label><select value={iForm.category} onChange={e=>setIForm({...iForm,category:e.target.value})} style={S.inp}>{INCOME_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={S.lbl}>Amount (RWF) *</label><input type="number" placeholder="e.g. 50000" value={iForm.amount} onChange={e=>setIForm({...iForm,amount:e.target.value})} style={S.inp}/></div>
          <div><label style={S.lbl}>Description</label><input placeholder="e.g. Manure sale" value={iForm.description} onChange={e=>setIForm({...iForm,description:e.target.value})} style={S.inp}/></div>
        </div>
        {iForm.amount&&parseFloat(iForm.amount)>0&&<div style={{padding:"9px 13px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:8,marginBottom:12,fontSize:13,color:"#10b981",fontWeight:600}}>
          Capital will increase by {fmtRWF(parseFloat(iForm.amount))}
        </div>}
        <button disabled={!iForm.amount||parseFloat(iForm.amount)<=0} style={{...S.btn("#166534"),width:"100%",padding:12,fontSize:14,opacity:!iForm.amount?0.5:1}} onClick={addIncome}>💚 Record Income →</button>
      </div>
    </div>)}

    {tab==="expenses"&&(<div style={{maxWidth:500}}>
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:14}}>🔴 Record Manual Expense</div>
        {eSaved&&<div style={{padding:10,background:"rgba(239,68,68,.08)",borderRadius:8,marginBottom:12,color:C.red,fontSize:13,fontWeight:600}}>✅ Expense recorded!</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={S.lbl}>Date</label><input type="date" value={eForm.date} onChange={e=>setEForm({...eForm,date:e.target.value})} style={S.inp}/></div>
          <div><label style={S.lbl}>Category</label><select value={eForm.category} onChange={e=>setEForm({...eForm,category:e.target.value})} style={S.inp}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={S.lbl}>Amount (RWF) *</label><input type="number" placeholder="e.g. 15000" value={eForm.amount} onChange={e=>setEForm({...eForm,amount:e.target.value})} style={S.inp}/></div>
          <div><label style={S.lbl}>Description</label><input placeholder="e.g. 3 bags Maize bran" value={eForm.description} onChange={e=>setEForm({...eForm,description:e.target.value})} style={S.inp}/></div>
        </div>
        {eForm.amount&&parseFloat(eForm.amount)>0&&<div style={{padding:"9px 13px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,marginBottom:12,fontSize:13,color:C.red,fontWeight:600}}>
          Capital will decrease by {fmtRWF(parseFloat(eForm.amount))}
        </div>}
        <button disabled={!eForm.amount||parseFloat(eForm.amount)<=0} style={{...S.btn(C.red),width:"100%",padding:12,fontSize:14,opacity:!eForm.amount?0.5:1}} onClick={addExpense}>🔴 Record Expense →</button>
      </div>
    </div>)}

    {tab==="all"&&(<div>
      {/* Search & filter bar */}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:12}}>
        <input placeholder="🔍 Search by category, description, worker…" value={search} onChange={e=>setSearch(e.target.value)} style={S.inp}/>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{...S.inp,width:"auto"}}>
          <option value="all">All Types</option>
          <option value="income">Income Only</option>
          <option value="expense">Expenses Only</option>
        </select>
      </div>
      {/* Summary for filtered set */}
      {(search||filterType!=="all")&&<div style={{...S.card,padding:"10px 14px",marginBottom:12,background:"rgba(22,163,74,.04)"}}>
        <div style={{fontSize:12,color:C.muted}}>Showing {filtered.length} of {allTx.length} transactions
          {filterType==="income"&&<span style={{color:"#10b981",fontWeight:700,marginLeft:8}}>Total: {fmtRWF(filtered.reduce((s,t)=>s+(t.amount||0),0))}</span>}
          {filterType==="expense"&&<span style={{color:C.red,fontWeight:700,marginLeft:8}}>Total: {fmtRWF(filtered.reduce((s,t)=>s+(t.amount||0),0))}</span>}
        </div>
      </div>}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>All Transactions ({allTx.length})</div>
        {filtered.length===0&&<div style={{color:C.faint,fontSize:13,textAlign:"center",padding:20}}>{search?"No results for your search.":"No transactions yet."}</div>}
        {filtered.map((tx,i)=>(
          <div key={i} style={{borderBottom:"1px solid "+C.elevated,paddingBottom:8,marginBottom:8}}>
            {editItem&&editItem.id===tx.id?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><label style={S.lbl}>Amount (RWF)</label><input type="number" value={editItem.amount} onChange={e=>setEditItem({...editItem,amount:e.target.value})} style={S.inp}/></div>
                  <div><label style={S.lbl}>Date</label><input type="date" value={editItem.date} onChange={e=>setEditItem({...editItem,date:e.target.value})} style={S.inp}/></div>
                  <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Description</label><input value={editItem.desc||editItem.description||""} onChange={e=>setEditItem({...editItem,desc:e.target.value,description:e.target.value})} style={S.inp}/></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveEdit} style={{...S.btn(C.accent),flex:1,padding:"7px",fontSize:12}}>✓ Save</button>
                  <button onClick={()=>setEditItem(null)} style={{...S.btn("#374151"),flex:1,padding:"7px",fontSize:12}}>Cancel</button>
                </div>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                    <span style={{fontSize:11,padding:"2px 7px",borderRadius:12,background:tx.type==="income"?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",color:tx.type==="income"?"#10b981":C.red,fontWeight:700}}>{tx.type==="income"?"↑ IN":"↓ OUT"}</span>
                    <span style={{color:C.text,fontWeight:600,fontSize:12}}>{tx.cat}</span>
                    {tx.worker&&<span style={{fontSize:10,color:C.faint}}>· {tx.worker}</span>}
                  </div>
                  {(tx.desc||tx.description)&&<div style={{fontSize:11,color:C.faint,paddingLeft:38}}>{tx.desc||tx.description}</div>}
                  <div style={{fontSize:10,color:C.faint,paddingLeft:38,marginTop:1}}>{tx.date}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:700,color:tx.type==="income"?"#10b981":C.red,fontSize:14}}>{tx.type==="income"?"+":"-"}{fmtRWF(tx.amount)}</div>
                  <div style={{fontSize:10,color:C.faint,marginTop:1}}>Bal: {fmtRWF(tx.runBal)}</div>
                  <div style={{display:"flex",gap:4,marginTop:4,justifyContent:"flex-end"}}>
                    {(tx.src==="income"||tx.src==="expense")&&<button onClick={()=>setEditItem({...tx})} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"1px solid "+C.border,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>}
                    <button onClick={()=>{if(window.confirm("Delete this record? This will reverse the capital effect.")){
                      if(tx.src==="income") deleteIncome(tx.id);
                      else if(tx.src==="expense") deleteExpense(tx.id);
                      else if(tx.src==="sale"){setSales(p=>{const u=p.filter(s=>s.id!==tx.id);fsSet("sales",u);return u;});}
                      else if(tx.src==="feed"){setFeeds(p=>{const u=p.filter(f=>f.id!==tx.id);fsSet("feeds",u);return u;});}
                    }}} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {allTx.length>0&&<div style={{padding:"9px 13px",background:profit>=0?"rgba(22,163,74,.06)":"rgba(239,68,68,.06)",borderRadius:8,display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{color:C.muted,fontSize:12}}>{allTx.length} transactions total</span>
          <span style={{fontWeight:700,color:profit>=0?C.accent:C.red,fontSize:13}}>Net: {fmtRWF(profit)}</span>
        </div>}
      </div>
    </div>)}
  </div>);
}

/* ─── AI Messages ─── */
function AIMessages({users,messages,setMessages,pigs,feeds,sales,logs,expenses,incomes,reproductions,stock}){
  const [tab,setTab]=useState("compose");
  const [text,setText]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [sending,setSending]=useState(false);
  const [waStatus,setWaStatus]=useState("");
  const [search,setSearch]=useState("");
  const [filterDate,setFilterDate]=useState("all");
  const [expandedId,setExpandedId]=useState(null);
  const [selectedWorkers,setSelectedWorkers]=useState([]); // empty = all
  const workers=users.filter(u=>u.role==="worker"&&u.approved);

  // recipient toggle helpers
  function toggleWorker(uid){
    setSelectedWorkers(prev=>prev.includes(uid)?prev.filter(x=>x!==uid):[...prev,uid]);
  }
  const targetWorkers=selectedWorkers.length===0?workers:workers.filter(w=>selectedWorkers.includes(w.uid||w.id));

  async function generateMsg(){
    if(!getApiKey()){setText("⚠️ Please set your Groq API key to generate AI messages.");return;}
    setAiLoading(true);
    const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
    const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);
    const sick=logs.reduce((s,l)=>s+(l.sick||0),0);
    const pregnant=(reproductions||[]).filter(r=>r.status==="pregnant").length;
    const lowStock=(stock||[]).filter(s=>s.quantity<=s.minLevel).length;
    const todayLogs=logs.filter(l=>l.date===toDay());
    const ctx=`Rwanda pig farm manager. Farm status: ${pigs.filter(p=>p.status==="active").length} active pigs, income=${fmtRWF(totalInc)}, profit=${fmtRWF(totalInc-totalExp)}, sick=${sick}, pregnant_sows=${pregnant}, low_stock_alerts=${lowStock}, logs_today=${todayLogs.length}/${workers.length}. Write a clear motivating daily message to farm workers (2-3 sentences). Simple language. Mention today's priorities.`;
    const res=await askAI(ctx,{pigs,feeds,sales,logs,expenses,incomes,reproductions:reproductions||[],stock:stock||[]});
    if(res.source==="ai") setText(res.text);
    else if(res.source==="auth_error") setText("⚠️ Invalid API key.");
    else if(res.source==="timeout") setText("⚠️ Request timed out.");
    else if(res.source==="network") setText("⚠️ Network error.");
    else setText("⚠️ AI unavailable: "+res.text);
    setAiLoading(false);
  }

  async function send(){
    if(!text.trim()||targetWorkers.length===0)return;
    setSending(true);
    const now=new Date();
    const recipientNames=selectedWorkers.length===0?"All workers":targetWorkers.map(w=>w.name).join(", ");
    const newMsg={
      id:uid(),
      text:text.trim(),
      from:"Farm Owner (Admin)",
      date:toDay(),
      time:now.toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"}),
      recipients:targetWorkers.length,
      recipientNames,
      recipientIds:targetWorkers.map(w=>w.uid||w.id),
      broadcast:selectedWorkers.length===0,
      aiGenerated:false
    };
    setMessages(p=>{const updated=[...p,newMsg];fsSet("messages",updated);return updated;});
    setText("");setSelectedWorkers([]);setSending(false);
    setTab("history");
    // WhatsApp to admin
    if(isWAEnabled()){
      sendWhatsApp(`📢 FarmIQ Message — ${toDay()}\nTo: ${recipientNames}\n\n${newMsg.text}`);
      setWaStatus("📱 WhatsApp copy sent to admin!");
    }
    // WhatsApp to worker contacts
    const contacts=getWorkerWAContacts().filter(c=>c.phone&&c.apikey&&(selectedWorkers.length===0||selectedWorkers.includes(c.uid)));
    if(contacts.length>0){
      let sent=0;
      for(const c of contacts){
        const ok=await sendWhatsAppToNumber(c.phone,c.apikey,`📢 FarmIQ — Message from Admin\n${toDay()}\n\n${newMsg.text}`);
        if(ok) sent++;
      }
      setWaStatus(prev=>(prev?prev+" · ":"")+`📱 WhatsApp sent to ${sent}/${contacts.length} worker(s)!`);
    }
    setTimeout(()=>setWaStatus(""),6000);
  }

  function deleteMsg(id){
    if(!window.confirm("Delete this message from history?"))return;
    setMessages(p=>{const updated=p.filter(m=>m.id!==id);fsSet("messages",updated);return updated;});
  }

  // History filters
  const today=toDay();
  const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
  const weekStr=weekAgo.toISOString().slice(0,10);
  let filtered=[...messages].reverse();
  if(filterDate==="today") filtered=filtered.filter(m=>m.date===today);
  if(filterDate==="week")  filtered=filtered.filter(m=>m.date>=weekStr);
  if(search.trim()) filtered=filtered.filter(m=>(m.text+m.recipientNames+m.date).toLowerCase().includes(search.trim().toLowerCase()));

  // Stats
  const todayCount=messages.filter(m=>m.date===today).length;
  const totalWorkersCovered=new Set(messages.flatMap(m=>m.recipientIds||[])).size;

  return(<div>
    <div style={S.h1}>📢 Messages to Workers</div>
    <div style={S.sub}>{workers.length} active worker(s) · {messages.length} message(s) sent</div>

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["compose","✍️ Compose"],["history","📋 History"+(messages.length?" ("+messages.length+")":"")]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* ── COMPOSE TAB ── */}
    {tab==="compose"&&(<div>
      <div style={S.card}>
        {/* Recipient selector */}
        <div style={{marginBottom:14}}>
          <label style={S.lbl}>Send to</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:4}}>
            {/* All button */}
            <button onClick={()=>setSelectedWorkers([])} style={{
              padding:"5px 13px",borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700,
              border:"1.5px solid "+(selectedWorkers.length===0?C.accent:C.border),
              background:selectedWorkers.length===0?C.accent:"transparent",
              color:selectedWorkers.length===0?"#fff":C.muted
            }}>👥 All Workers ({workers.length})</button>
            {/* Individual workers */}
            {workers.map(w=>{
              const wid=w.uid||w.id;
              const sel=selectedWorkers.includes(wid);
              return(
                <button key={wid} onClick={()=>toggleWorker(wid)} style={{
                  padding:"5px 13px",borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?700:400,
                  border:"1.5px solid "+(sel?C.accent:C.border),
                  background:sel?C.accentSoft:"transparent",
                  color:sel?C.accent:C.muted
                }}>
                  {sel?"✓ ":""}{w.name}
                </button>
              );
            })}
          </div>
          {workers.length===0&&<div style={{fontSize:12,color:C.amber,marginTop:6}}>⚠️ No approved workers yet. Approve workers first.</div>}
          <div style={{fontSize:11,color:C.faint,marginTop:6}}>
            📬 Will send to: <b style={{color:C.accent}}>{targetWorkers.length===workers.length?"All "+workers.length+" workers":targetWorkers.map(w=>w.name).join(", ")||"—"}</b>
          </div>
        </div>

        {/* Message composer */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={S.lbl}>Message</label>
            <button onClick={generateMsg} disabled={aiLoading} style={{padding:"5px 11px",borderRadius:7,border:"1px solid rgba(167,139,250,.4)",background:"rgba(167,139,250,.08)",color:C.purple,fontSize:11,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
              {aiLoading?<><span className="spin" style={{...S.loader,borderTopColor:C.purple}}/>Generating…</>:"✦ AI Write Message"}
            </button>
          </div>
          <textarea rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="Type your message here or use ✦ AI Write Message…" style={{...S.inp,resize:"vertical"}}/>
        </div>

        <button style={{...S.btn(),width:"100%",padding:"11px",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:(!text.trim()||targetWorkers.length===0)?0.5:1}} onClick={send} disabled={!text.trim()||sending||targetWorkers.length===0}>
          {sending?<><span className="spin" style={S.loader}/>Sending…</>:<>📤 Send to {targetWorkers.length===workers.length?"All Workers":targetWorkers.length+" Worker(s)"}</>}
        </button>
        {waStatus&&<div className="fade-in" style={{marginTop:10,padding:"9px 13px",background:"rgba(37,211,102,.08)",border:"1px solid rgba(37,211,102,.3)",borderRadius:8,fontSize:12,color:"#128C7E",fontWeight:600}}>{waStatus}</div>}
      </div>
    </div>)}

    {/* ── HISTORY TAB ── */}
    {tab==="history"&&(<div>
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[
          ["Total Sent",messages.length,C.accent],
          ["Sent Today",todayCount,C.blue],
          ["Workers Reached",totalWorkersCovered,C.purple],
        ].map(([l,v,c])=>(
          <div key={l} style={{...S.card,padding:"11px 14px",marginBottom:0,textAlign:"center"}}>
            <div style={{fontSize:10,color:C.faint,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{l}</div>
            <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search messages…" style={{...S.inp,flex:1,minWidth:160,fontSize:12}}/>
        <div style={{display:"flex",gap:5,flexShrink:0}}>
          {[["all","All"],["today","Today"],["week","This Week"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilterDate(v)} style={{
              padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:11,
              background:filterDate===v?"linear-gradient(135deg,#16a34a,#10b981)":"rgba(22,163,74,.08)",
              color:filterDate===v?"#fff":"#16a34a"
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Message list */}
      {filtered.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:32,marginBottom:8}}>📭</div>
        <div style={{fontWeight:600}}>{search?"No messages match your search":"No messages sent yet"}</div>
        <div style={{fontSize:12,marginTop:4}}>{!search&&<button onClick={()=>setTab("compose")} style={{color:C.accent,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,textDecoration:"underline"}}>Compose your first message →</button>}</div>
      </div>}

      {filtered.map((m)=>{
        const isExpanded=expandedId===m.id;
        const isToday=m.date===today;
        return(
          <div key={m.id} style={{...S.card,marginBottom:10,borderLeft:"3px solid "+(isToday?C.accent:C.border)}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.text}}>📢 {m.from||"Admin"}</span>
                  {isToday&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:10,background:"rgba(22,163,74,.12)",color:C.accent,fontWeight:700}}>Today</span>}
                  {m.aiGenerated&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:6,background:"rgba(124,58,237,.1)",color:C.purple,fontWeight:700}}>✦ AI</span>}
                  {m.broadcast&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:6,background:"rgba(37,99,235,.1)",color:C.blue,fontWeight:700}}>📡 Broadcast</span>}
                </div>
                <div style={{fontSize:11,color:C.faint}}>
                  🕐 {m.date} {m.time&&"· "+m.time} · 👥 {m.recipients||0} worker{(m.recipients||0)!==1?"s":""}
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  To: <span style={{color:C.accent,fontWeight:600}}>{m.recipientNames||"All workers"}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                <button onClick={()=>setExpandedId(isExpanded?null:m.id)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>
                  {isExpanded?"▲ Less":"▼ More"}
                </button>
                <button onClick={()=>deleteMsg(m.id)} style={{fontSize:11,padding:"3px 9px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
              </div>
            </div>
            {/* Message preview / full */}
            <div style={{
              padding:"10px 13px",background:C.elevated,borderRadius:8,fontSize:13,color:C.text,lineHeight:1.75,
              ...(isExpanded?{}:{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"})
            }}>{m.text}</div>
          </div>
        );
      })}
    </div>)}
  </div>);
}

/* ─── Main App ─── */

/* ─── Remote Work System ─── */
/* ─── Remote Work Registration & Approval System ─── */

/* ── Shared online simulation store ── */
// We use a shared localStorage key so all "devices" on same browser can simulate multi-user
const REMOTE_KEY="fiq_remote_sessions";
const PENDING_KEY="fiq_pending_workers";

/* ── RemoteWorkPanel: what workers see after login ── */
function RemoteWorkPanel({user,sessions,setSessions,messages}){
  const [tab,setTab]=useState("status");
  const [form,setForm]=useState({computerName:"",computerSpec:"",location:"",purpose:"",notes:""});
  const [saved,setSaved]=useState(false);
  const [err,setErr]=useState("");

  const myActive=sessions.filter(s=>s.workerId===user.id&&s.status==="active");
  const myAll=sessions.filter(s=>s.workerId===user.id).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  const currentSession=myActive[0]||null;

  function requestSession(){
    setErr("");
    if(!form.computerName||!form.location||!form.purpose) return setErr("Please fill all required fields.");
    const newSess={
      id:uid(), workerId:user.id, workerName:user.name, workerUsername:user.username,
      computerName:form.computerName, computerSpec:form.computerSpec||"Not specified",
      location:form.location, purpose:form.purpose, notes:form.notes,
      status:"pending", requestedAt:new Date().toISOString().slice(0,16).replace("T"," "),
      startedAt:new Date().toISOString(), approvedAt:null, endedAt:null, adminNote:""
    };
    setSessions(p=>{const updated=[...p,newSess];setOnlineFarmData({sessions:updated});return updated;});
    setSaved(true); setErr("");
    setForm({computerName:"",computerSpec:"",location:"",purpose:"",notes:""});
    setTimeout(()=>setSaved(false),3000);
    setTab("status");
  }

  function endSession(){
    if(!currentSession)return;
    setSessions(p=>{const updated=p.map(s=>s.id===currentSession.id?{...s,status:"ended",endedAt:new Date().toISOString().slice(0,16).replace("T"," ")}:s);setOnlineFarmData({sessions:updated});return updated;});
  }

  const statusColor={pending:"#f59e0b",active:"#16a34a",ended:"#6b7280",rejected:"#ef4444"};
  const statusBg={pending:"rgba(245,158,11,.1)",active:"rgba(22,163,74,.1)",ended:"rgba(107,114,128,.08)",rejected:"rgba(239,68,68,.08)"};

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
      <div>
        <div style={S.h1}>🖥️ Remote Work Portal</div>
        <div style={S.sub}>Register your computer & get admin approval to work remotely</div>
      </div>
      {currentSession&&<div style={{padding:"7px 13px",borderRadius:8,background:"rgba(22,163,74,.12)",border:"1px solid rgba(22,163,74,.3)",fontSize:12,color:C.accent,fontWeight:700}}>
        <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:C.accent,marginRight:6,animation:"pulse 1.5s ease-in-out infinite"}}/>ACTIVE SESSION
      </div>}
    </div>

    {/* Active session banner */}
    {currentSession&&(<div style={{padding:"14px 16px",background:"rgba(22,163,74,.07)",border:"1px solid rgba(22,163,74,.25)",borderRadius:10,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:8}}>✅ You are currently working remotely</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10,fontSize:12}}>
        {[["🖥️ Computer",currentSession.computerName],["📍 Location",currentSession.location],["🎯 Purpose",currentSession.purpose],["⏱️ Since",currentSession.approvedAt||currentSession.startedAt]].map(([l,v])=>(
          <div key={l} style={{background:C.elevated,borderRadius:6,padding:"5px 9px"}}><span style={{color:C.faint}}>{l}: </span><span style={{color:C.text,fontWeight:600}}>{v}</span></div>
        ))}
      </div>
      <button onClick={endSession} style={{...S.btn("#991b1b"),fontSize:12,padding:"7px 16px"}}>🔴 End Session</button>
    </div>)}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:8,padding:3,gap:2,border:"1px solid "+C.border,marginBottom:16}}>
      {[["status","📋 My Sessions"],["request","➕ New Request"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="request"&&(<div style={{maxWidth:520}}>
      {saved&&<div style={{padding:"10px 14px",background:C.accentSoft,borderRadius:8,marginBottom:12,color:C.accent,fontSize:13,border:"1px solid rgba(22,163,74,.3)"}}>✅ Request submitted! Waiting for admin approval.</div>}
      {err&&<div style={{padding:"10px 14px",background:"rgba(239,68,68,.08)",borderRadius:8,marginBottom:12,color:C.red,fontSize:13,border:"1px solid rgba(239,68,68,.25)"}}>{err}</div>}
      {currentSession&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.08)",borderRadius:8,marginBottom:14,color:C.amber,fontSize:13}}>⚠️ You already have an active session. End it before requesting a new one.</div>}
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>🖥️ Remote Work Registration</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Computer Name / ID <span style={{color:C.red}}>*</span></label>
            <input value={form.computerName} onChange={e=>setForm({...form,computerName:e.target.value})} placeholder="e.g. Laptop-HP-237 or Home PC" style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Computer Specs (optional)</label>
            <input value={form.computerSpec} onChange={e=>setForm({...form,computerSpec:e.target.value})} placeholder="e.g. Windows 11, i5, 8GB RAM" style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Work Location <span style={{color:C.red}}>*</span></label>
            <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Home - Kigali, Nyamirambo" style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Purpose / Task <span style={{color:C.red}}>*</span></label>
            <select value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} style={S.inp}>
              <option value="">— Select purpose —</option>
              <option>Daily Report Submission</option>
              <option>Feeding Log Entry</option>
              <option>Sales Recording</option>
              <option>Inventory Update</option>
              <option>Financial Data Entry</option>
              <option>Health Monitoring Reports</option>
              <option>General Farm Management</option>
              <option>Other</option>
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Additional Notes</label>
            <textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any special requirements or context..." style={{...S.inp,resize:"vertical"}}/>
          </div>
        </div>
        <button disabled={!!currentSession} onClick={requestSession} style={{...S.btn(currentSession?"#374151":C.accent),width:"100%",padding:12,fontSize:14,opacity:currentSession?0.5:1}}>
          📤 Submit Remote Work Request →
        </button>
        <div style={{fontSize:11,color:C.faint,marginTop:8,textAlign:"center"}}>Your request will be reviewed and approved by the admin before your session starts.</div>
      </div>
    </div>)}

    {tab==="status"&&(<div>
      {myAll.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:8}}>🖥️</div>
        <div>No remote work sessions yet.</div>
        <div style={{marginTop:6}}>Use the "New Request" tab to register your computer.</div>
      </div>}
      {myAll.map((s,i)=>(
        <div key={i} style={{...S.card,marginBottom:10,border:"1px solid "+(s.status==="active"?"rgba(22,163,74,.3)":C.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontWeight:700,color:C.text,fontSize:14}}>🖥️ {s.computerName}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:2}}>📍 {s.location} · Requested: {s.requestedAt}</div>
            </div>
            <span style={{padding:"3px 10px",borderRadius:20,background:statusBg[s.status],color:statusColor[s.status],fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{s.status}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11,marginBottom:s.adminNote?8:0}}>
            {[["Specs",s.computerSpec],["Purpose",s.purpose],["Approved",s.approvedAt||"—"],["Ended",s.endedAt||"—"]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:5,padding:"4px 8px"}}><span style={{color:C.faint}}>{l}: </span><span style={{color:C.text}}>{v}</span></div>
            ))}
          </div>
          {s.adminNote&&<div style={{marginTop:8,padding:"7px 10px",background:"rgba(96,165,250,.08)",borderRadius:6,fontSize:12,color:C.blue,border:"1px solid rgba(96,165,250,.2)"}}>
            💬 Admin note: {s.adminNote}
          </div>}
        </div>
      ))}
    </div>)}
  </div>);
}

/* ── Admin Remote Work Management ── */
function RemoteWorkAdmin({sessions,setSessions,users}){
  const [tab,setTab]=useState("pending");
  const [noteInput,setNoteInput]=useState({});

  const pending=sessions.filter(s=>s.status==="pending");
  const active=sessions.filter(s=>s.status==="active");
  const all=sessions.slice().sort((a,b)=>b.startedAt.localeCompare(a.startedAt));

  function approve(id){
    const note=noteInput[id]||"";
    setSessions(p=>{const updated=p.map(s=>s.id===id?{...s,status:"active",approvedAt:new Date().toISOString().slice(0,16).replace("T"," "),adminNote:note}:s);setOnlineFarmData({sessions:updated});return updated;});
    setNoteInput(p=>({...p,[id]:""}));
  }
  function reject(id){
    const note=noteInput[id]||"Rejected by admin";
    setSessions(p=>{const updated=p.map(s=>s.id===id?{...s,status:"rejected",adminNote:note}:s);setOnlineFarmData({sessions:updated});return updated;});
    setNoteInput(p=>({...p,[id]:""}));
  }
  function terminate(id){
    setSessions(p=>{const updated=p.map(s=>s.id===id?{...s,status:"ended",endedAt:new Date().toISOString().slice(0,16).replace("T"," ")}:s);setOnlineFarmData({sessions:updated});return updated;});
  }

  const statusColor={pending:"#f59e0b",active:"#16a34a",ended:"#6b7280",rejected:"#ef4444"};
  const statusBg={pending:"rgba(245,158,11,.1)",active:"rgba(22,163,74,.1)",ended:"rgba(107,114,128,.08)",rejected:"rgba(239,68,68,.08)"};

  return(<div>
    <div style={S.h1}>🖥️ Remote Work Approval</div>
    <div style={S.sub}>Approve or reject worker remote computer registration requests</div>

    {/* Stats */}
    <div style={S.g4}>
      {[{l:"Pending",v:pending.length,c:C.amber},{l:"Active Sessions",v:active.length,c:C.accent},{l:"Total Requests",v:sessions.length,c:C.text},{l:"Workers Online",v:new Set(active.map(s=>s.workerId)).size,c:"#10b981"}].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c}}>{s.v}</div></div>
      ))}
    </div>

    {pending.length>0&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,marginBottom:14,fontSize:13,color:C.amber}}>
      ⚠️ {pending.length} worker(s) waiting for remote work approval
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:8,padding:3,gap:2,border:"1px solid "+C.border,marginBottom:16}}>
      {[["pending","⏳ Pending"+(pending.length?` (${pending.length})`:"")] ,["active","✅ Active"+(active.length?` (${active.length})`:"")],["all","📋 All Sessions"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="pending"&&(<div>
      {pending.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:8}}>✅</div>
        <div>No pending requests. All clear!</div>
      </div>}
      {pending.map((s,i)=>(
        <div key={i} style={{...S.card,marginBottom:12,border:"1px solid rgba(245,158,11,.3)",background:"rgba(245,158,11,.03)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,color:C.text,fontSize:14}}>👤 {s.workerName} <span style={{fontSize:11,color:C.faint}}>@{s.workerUsername}</span></div>
              <div style={{fontSize:11,color:C.faint,marginTop:2}}>Requested: {s.requestedAt}</div>
            </div>
            <span style={{padding:"3px 10px",borderRadius:20,background:statusBg.pending,color:statusColor.pending,fontSize:11,fontWeight:700}}>PENDING</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10,fontSize:12}}>
            {[["🖥️ Computer",s.computerName],["⚙️ Specs",s.computerSpec],["📍 Location",s.location],["🎯 Purpose",s.purpose]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:6,padding:"5px 9px"}}><span style={{color:C.faint}}>{l}: </span><span style={{color:C.text,fontWeight:600}}>{v||"—"}</span></div>
            ))}
            {s.notes&&<div style={{gridColumn:"1/-1",background:C.elevated,borderRadius:6,padding:"5px 9px"}}>
              <span style={{color:C.faint}}>📝 Notes: </span><span style={{color:C.text}}>{s.notes}</span>
            </div>}
          </div>
          <div style={{marginBottom:10}}>
            <label style={S.lbl}>Admin Note (optional)</label>
            <input value={noteInput[s.id]||""} onChange={e=>setNoteInput(p=>({...p,[s.id]:e.target.value}))} placeholder="Add a note for the worker..." style={S.inp}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>approve(s.id)} style={{...S.btn("#166534"),flex:1,padding:"9px",fontSize:13}}>✅ Approve Session</button>
            <button onClick={()=>reject(s.id)} style={{...S.btn("#991b1b"),flex:1,padding:"9px",fontSize:13}}>✗ Reject</button>
          </div>
        </div>
      ))}
    </div>)}

    {tab==="active"&&(<div>
      {active.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center",padding:40}}>
        <div style={{fontSize:32,marginBottom:8}}>🖥️</div>
        <div>No active remote sessions.</div>
      </div>}
      {active.map((s,i)=>(
        <div key={i} style={{...S.card,marginBottom:10,border:"1px solid rgba(22,163,74,.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <div style={{fontWeight:700,color:C.text}}>👤 {s.workerName}</div>
              <div style={{fontSize:11,color:C.faint}}>🖥️ {s.computerName} · 📍 {s.location}</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{padding:"3px 10px",borderRadius:20,background:statusBg.active,color:statusColor.active,fontSize:11,fontWeight:700}}>● LIVE</span>
              <button onClick={()=>terminate(s.id)} style={{...S.btn("#991b1b"),padding:"5px 11px",fontSize:11}}>End Session</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:11}}>
            {[["Purpose",s.purpose],["Approved",s.approvedAt||"—"]].map(([l,v])=>(
              <div key={l} style={{background:C.elevated,borderRadius:5,padding:"4px 8px"}}><span style={{color:C.faint}}>{l}: </span><span style={{color:C.text}}>{v}</span></div>
            ))}
          </div>
        </div>
      ))}
    </div>)}

    {tab==="all"&&(<div>
      {all.length===0&&<div style={{...S.card,color:C.faint,fontSize:13}}>No sessions recorded.</div>}
      {all.map((s,i)=>(
        <div key={i} style={{...S.card,marginBottom:8,padding:"10px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,color:C.text,fontSize:13}}>{s.workerName} · {s.computerName}</div>
              <div style={{fontSize:11,color:C.faint}}>📍 {s.location} · {s.purpose} · {s.requestedAt}</div>
            </div>
            <span style={{padding:"2px 9px",borderRadius:20,background:statusBg[s.status],color:statusColor[s.status],fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{s.status}</span>
          </div>
          {s.adminNote&&<div style={{fontSize:11,color:C.blue,marginTop:5}}>💬 {s.adminNote}</div>}
        </div>
      ))}
    </div>)}
  </div>);
}


/* ═══════════════════════════════════════════════════
   APPROVAL PANEL — Admin reviews all pending entries
═══════════════════════════════════════════════════ */
function ApprovalPanel({feeds,setFeeds,logs,setLogs,sales,setSales,expenses,setExpenses,pigs,setPigs,capital,setCapital,pendingPigs,setPendingPigs,pushUndo}){
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState("all");
  const [editPigId,setEditPigId]=useState(null);
  const [editPigForm,setEditPigForm]=useState(null);
  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3000);}

  const pendingFeeds=feeds.filter(x=>x.approved===false);
  const pendingLogs=logs.filter(x=>x.approved===false);
  const pendingSales=sales.filter(x=>x.approved===false);
  const pendingExp=expenses.filter(x=>x.approved===false);
  const pendingPigList=(pendingPigs||[]).filter(x=>x.approved===false&&!x.rejected);
  const total=pendingFeeds.length+pendingLogs.length+pendingSales.length+pendingExp.length+pendingPigList.length;

  function approveItem(type,id){
    if(type==="feed"){
      const item=feeds.find(x=>x.id===id);
      if(!item)return;
      const updated=feeds.map(x=>x.id===id?{...x,approved:true}:x);
      setFeeds(updated);fsSet("feeds",updated);
      capitalTx(capital,setCapital,{type:"expense",category:"Feed Purchase",amount:item.cost,description:`${item.kg}kg ${item.feedType} — by ${item.worker}`,date:item.date,refId:"feed_"+id});
      showToast(`✅ Feed log by ${item.worker} approved`);
    } else if(type==="log"){
      const item=logs.find(x=>x.id===id);
      const updated=logs.map(x=>x.id===id?{...x,approved:true}:x);
      setLogs(updated);fsSet("logs",updated);
      if(item&&item.deaths>0&&parseFloat(item.deathLossAmount)>0){
        capitalTx(capital,setCapital,{type:"expense",category:"Pig Death Loss",amount:parseFloat(item.deathLossAmount),description:`${item.deaths} pig(s) died — ${item.worker}`,date:item.date});
      }
      showToast(`✅ Daily log by ${item?item.worker:"worker"} approved`);
    } else if(type==="sale"){
      const item=sales.find(x=>x.id===id);
      if(!item)return;
      const updated=sales.map(x=>x.id===id?{...x,approved:true}:x);
      setSales(updated);fsSet("sales",updated);
      if(item.pigId) setPigs(p=>{const u=p.map(pig=>pig.id===item.pigId?{...pig,status:"sold"}:pig);fsSet("pigs",u);return u;});
      capitalTx(capital,setCapital,{type:"income",category:"Pig Sale",amount:item.total,description:`${item.weight}kg @ RWF ${item.priceKg}/kg to ${item.buyer||"buyer"} — by ${item.worker}`,date:item.date,refId:"sale_"+id});
      showToast(`✅ Sale of ${fmtRWF(item.total)} by ${item.worker} approved`);
    } else if(type==="expense"){
      const item=expenses.find(x=>x.id===id);
      if(!item)return;
      const updated=expenses.map(x=>x.id===id?{...x,approved:true}:x);
      setExpenses(updated);fsSet("expenses",updated);
      capitalTx(capital,setCapital,{type:"expense",category:item.category,amount:item.amount,description:`${item.item||item.category} — by ${item.worker}`,date:item.date,refId:"exp_"+id});
      showToast(`✅ Purchase of ${fmtRWF(item.amount)} by ${item.worker} approved`);
    }
  }

  function rejectItem(type,id){
    if(!window.confirm("Reject and delete this entry permanently?"))return;
    if(type==="feed"){
      const deleted=feeds.find(x=>x.id===id);
      const u=feeds.filter(x=>x.id!==id);setFeeds(u);fsSet("feeds",u);showToast("🗑️ Feed log rejected","error");
      if(pushUndo&&deleted) pushUndo("Feed log ("+deleted.feedType+" "+deleted.kg+"kg)",()=>{const r=[...feeds.filter(x=>x.id!==deleted.id),deleted];setFeeds(r);fsSet("feeds",r);});
    }
    else if(type==="log"){
      const deleted=logs.find(x=>x.id===id);
      const u=logs.filter(x=>x.id!==id);setLogs(u);fsSet("logs",u);showToast("🗑️ Daily log rejected","error");
      if(pushUndo&&deleted) pushUndo("Daily log ("+deleted.worker+" "+deleted.date+")",()=>{const r=[...logs.filter(x=>x.id!==deleted.id),deleted];setLogs(r);fsSet("logs",r);});
    }
    else if(type==="sale"){
      const deleted=sales.find(x=>x.id===id);
      const u=sales.filter(x=>x.id!==id);setSales(u);fsSet("sales",u);showToast("🗑️ Sale rejected","error");
      if(pushUndo&&deleted) pushUndo("Sale ("+fmtRWF(deleted.total)+" — "+deleted.worker+")",()=>{const r=[...sales.filter(x=>x.id!==deleted.id),deleted];setSales(r);fsSet("sales",r);});
    }
    else if(type==="expense"){
      const deleted=expenses.find(x=>x.id===id);
      const u=expenses.filter(x=>x.id!==id);setExpenses(u);fsSet("expenses",u);showToast("🗑️ Purchase rejected","error");
      if(pushUndo&&deleted) pushUndo("Purchase ("+(deleted.item||deleted.category)+")",()=>{const r=[...expenses.filter(x=>x.id!==deleted.id),deleted];setExpenses(r);fsSet("expenses",r);});
    }
  }

  function approvePig(id,editedForm){
    const pig=pendingPigList.find(x=>x.id===id);
    if(!pig)return;
    const finalPig={...(editedForm||pig),id:uid(),status:"active",measurements:[],approved:true};
    // Remove from pending, add to real pigs
    const updPending=(pendingPigs||[]).map(x=>x.id===id?{...x,approved:true}:x);
    setPendingPigs(updPending);fsSet("pendingPigs",updPending);
    setPigs(p=>{const u=[...p,finalPig];fsSet("pigs",u);return u;});
    // Record purchase cost if any
    if(setCapital&&parseFloat(finalPig.purchasePrice)>0){
      capitalTx(capital,setCapital,{type:"expense",category:"Pig Purchase",amount:parseFloat(finalPig.purchasePrice),description:`Pig ${finalPig.tag} (${finalPig.stage}) from ${finalPig.source||"worker submission"}`,date:finalPig.arrivalDate||toDay()});
    }
    setEditPigId(null);setEditPigForm(null);
    showToast(`✅ Pig ${finalPig.tag} approved and added to herd`);
  }

  function rejectPig(id,note){
    const updPending=(pendingPigs||[]).map(x=>x.id===id?{...x,rejected:true,adminNote:note||"Rejected by admin"}:x);
    setPendingPigs(updPending);fsSet("pendingPigs",updPending);
    showToast("✗ Pig registration rejected","error");
  }

  function approveAll(){
    if(!window.confirm(`Approve all ${total} pending entries?`))return;
    // Approve all feeds
    if(pendingFeeds.length){
      const u=feeds.map(x=>x.approved===false?{...x,approved:true}:x);
      setFeeds(u);fsSet("feeds",u);
      pendingFeeds.forEach(f=>capitalTx(capital,setCapital,{type:"expense",category:"Feed Purchase",amount:f.cost,description:`${f.kg}kg ${f.feedType} — by ${f.worker}`,date:f.date,refId:"feed_"+f.id}));
    }
    // Approve all logs
    if(pendingLogs.length){
      const u=logs.map(x=>x.approved===false?{...x,approved:true}:x);
      setLogs(u);fsSet("logs",u);
      pendingLogs.forEach(l=>{if(l.deaths>0&&parseFloat(l.deathLossAmount)>0)capitalTx(capital,setCapital,{type:"expense",category:"Pig Death Loss",amount:parseFloat(l.deathLossAmount),description:`${l.deaths} pig(s) died — ${l.worker}`,date:l.date});});
    }
    // Approve all sales
    if(pendingSales.length){
      const u=sales.map(x=>x.approved===false?{...x,approved:true}:x);
      setSales(u);fsSet("sales",u);
      pendingSales.forEach(s=>{
        if(s.pigId)setPigs(p=>{const u2=p.map(pig=>pig.id===s.pigId?{...pig,status:"sold"}:pig);fsSet("pigs",u2);return u2;});
        capitalTx(capital,setCapital,{type:"income",category:"Pig Sale",amount:s.total,description:`${s.weight}kg @ RWF ${s.priceKg}/kg to ${s.buyer||"buyer"} — by ${s.worker}`,date:s.date,refId:"sale_"+s.id});
      });
    }
    // Approve all expenses
    if(pendingExp.length){
      const u=expenses.map(x=>x.approved===false?{...x,approved:true}:x);
      setExpenses(u);fsSet("expenses",u);
      pendingExp.forEach(e=>capitalTx(capital,setCapital,{type:"expense",category:e.category,amount:e.amount,description:`${e.item||e.category} — by ${e.worker}`,date:e.date,refId:"exp_"+e.id}));
    }
    // Approve all pig registrations
    if(pendingPigList.length){
      const newPigObjects=pendingPigList.map(p=>({...p,id:uid(),status:"active",measurements:[],approved:true}));
      setPigs(prev=>{const u=[...prev,...newPigObjects];fsSet("pigs",u);return u;});
      const updPending=(pendingPigs||[]).map(x=>!x.rejected&&x.approved===false?{...x,approved:true}:x);
      setPendingPigs(updPending);fsSet("pendingPigs",updPending);
      newPigObjects.forEach(p=>{
        if(parseFloat(p.purchasePrice)>0) capitalTx(capital,setCapital,{type:"expense",category:"Pig Purchase",amount:parseFloat(p.purchasePrice),description:`Pig ${p.tag} (${p.stage}) — bulk approval`,date:p.arrivalDate||toDay()});
      });
    }
    showToast(`✅ All ${total} entries approved!`);
  }

  const tabs=[{id:"all",l:"All ("+total+")"},{id:"pig",l:"🐷 Pigs ("+pendingPigList.length+")"},{id:"sale",l:"💰 Sales ("+pendingSales.length+")"},{id:"feed",l:"🌾 Feeds ("+pendingFeeds.length+")"},{id:"expense",l:"🛒 Purchases ("+pendingExp.length+")"},{id:"log",l:"📋 Logs ("+pendingLogs.length+")"}];

  function Card({type,item,extra}){
    const colors={sale:"#10b981",feed:C.amber,expense:C.red,log:C.blue};
    const labels={sale:"💰 Sale",feed:"🌾 Feed Log",expense:"🛒 Purchase",log:"📋 Daily Log"};
    return(
      <div style={{...S.card,marginBottom:10,borderLeft:"3px solid "+(colors[type]||C.border)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(245,158,11,.12)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>
              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{labels[type]}</span>
              <span style={{fontSize:11,color:C.muted}}>by {item.worker}</span>
            </div>
            <div style={{fontSize:11,color:C.faint}}>{extra}</div>
            <div style={{fontSize:10,color:C.faint,marginTop:2}}>📅 {item.date}</div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <button onClick={()=>approveItem(type,item.id)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Approve</button>
            <button onClick={()=>rejectItem(type,item.id)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✗ Reject</button>
          </div>
        </div>
      </div>
    );
  }

  return(<div>
    {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,padding:"10px 18px",borderRadius:10,background:toast.type==="error"?"#dc2626":"#16a34a",color:"#fff",fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>{toast.msg}</div>}
    <div style={S.h1}>✅ Data Approval Panel</div>
    <div style={S.sub}>Review and approve all entries submitted by workers before they affect the system</div>

    {total===0?(
      <div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:40,marginBottom:12}}>✅</div>
        <div style={{fontSize:16,fontWeight:700,color:C.accent}}>All caught up!</div>
        <div style={{fontSize:13,marginTop:6}}>No pending entries to review.</div>
      </div>
    ):(
      <>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
          <div style={{padding:"10px 16px",background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.35)",borderRadius:10,fontSize:13,fontWeight:700,color:"#92400e"}}>
            ⏳ {total} pending entr{total===1?"y":"ies"} waiting for your review
          </div>
          <button onClick={approveAll} style={{padding:"10px 20px",borderRadius:9,border:"none",background:"#16a34a",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Approve All ({total})</button>
        </div>

        <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",flexWrap:"wrap"}}>
          {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 13px",borderRadius:8,border:"none",background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.muted,fontWeight:tab===t.id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.l}</button>)}
        </div>

        {(tab==="all"||tab==="sale")&&pendingSales.map(s=><Card key={s.id} type="sale" item={s} extra={`${s.weight}kg @ RWF ${fmtNum(s.priceKg)}/kg → ${s.buyer||"—"} · Total: ${fmtRWF(s.total)}`}/>)}
        {(tab==="all"||tab==="feed")&&pendingFeeds.map(f=><Card key={f.id} type="feed" item={f} extra={`${f.kg}kg ${f.feedType} · Cost: ${fmtRWF(f.cost)}`}/>)}
        {(tab==="all"||tab==="expense")&&pendingExp.map(e=><Card key={e.id} type="expense" item={e} extra={`${e.item||e.category}${e.quantity?" · "+e.quantity+" "+e.unit:""} · ${fmtRWF(e.amount)}`}/>)}
        {(tab==="all"||tab==="log")&&pendingLogs.map(l=><Card key={l.id} type="log" item={l} extra={`Checked: ${l.checked} · Sick: ${l.sick} · Deaths: ${l.deaths} · Notes: ${l.notes||"—"}`}/>)}

        {/* ── Pig registration cards ── */}
        {(tab==="all"||tab==="pig")&&pendingPigList.map(p=>{
          const isEditing=editPigId===p.id;
          const ef=isEditing?editPigForm:null;
          const BREEDS=["Landrace","Large White","Duroc","Hampshire","Mixed/Local"];
          const STAGES=["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];
          return(
            <div key={p.id} style={{...S.card,marginBottom:10,borderLeft:"3px solid #a78bfa"}}>
              {isEditing?(
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#7c3aed",marginBottom:10}}>✏️ Edit Before Approving — {p.tag}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:10}}>
                    <div><label style={S.lbl}>Tag Code</label><input value={ef.tag} onChange={e=>setEditPigForm({...ef,tag:e.target.value})} style={{...S.inp,fontFamily:"monospace",fontWeight:700}}/></div>
                    <div><label style={S.lbl}>Breed</label><select value={ef.breed} onChange={e=>{const b=e.target.value;setEditPigForm(f=>({...f,breed:b,tag:genPigTag(b,f.stage,pigs)}));}} style={S.inp}>{BREEDS.map(o=><option key={o}>{o}</option>)}</select></div>
                    <div><label style={S.lbl}>Stage</label><select value={ef.stage} onChange={e=>{const s=e.target.value;setEditPigForm(f=>({...f,stage:s,tag:genPigTag(f.breed,s,pigs)}));}} style={S.inp}>{STAGES.map(o=><option key={o}>{o}</option>)}</select></div>
                    <div><label style={S.lbl}>Gender</label><select value={ef.gender} onChange={e=>setEditPigForm({...ef,gender:e.target.value})} style={S.inp}><option>Female</option><option>Male</option></select></div>
                    <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={ef.weight} onChange={e=>setEditPigForm({...ef,weight:e.target.value})} style={S.inp}/></div>
                    <div><label style={S.lbl}>Source</label><input value={ef.source||""} onChange={e=>setEditPigForm({...ef,source:e.target.value})} style={S.inp}/></div>
                    <div><label style={S.lbl}>Purchase Price (RWF)</label><input type="number" value={ef.purchasePrice||""} onChange={e=>setEditPigForm({...ef,purchasePrice:e.target.value})} style={S.inp}/></div>
                    <div><label style={S.lbl}>Admin Note</label><input placeholder="Optional note to worker" value={ef.adminNote||""} onChange={e=>setEditPigForm({...ef,adminNote:e.target.value})} style={S.inp}/></div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>approvePig(p.id,ef)} style={{...S.btn("#166534"),flex:1,padding:"9px",fontSize:13}}>✅ Approve with Edits</button>
                    <button onClick={()=>approvePig(p.id,null)} style={{...S.btn(C.accent),flex:1,padding:"9px",fontSize:13}}>✅ Approve As-Is</button>
                    <button onClick={()=>{setEditPigId(null);setEditPigForm(null);}} style={{...S.btn("#374151"),padding:"9px 13px",fontSize:12}}>Cancel</button>
                  </div>
                </div>
              ):(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(245,158,11,.12)",color:"#d97706",fontWeight:700}}>⏳ Pending</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>🐷 Pig Registration</span>
                        <span style={{fontSize:11,color:C.muted}}>by {p.submittedByName}</span>
                      </div>
                      <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:C.text,marginBottom:4}}>{p.tag}</div>
                      <div style={{fontSize:11,color:C.faint}}>{p.breed} · {p.stage} · {p.gender} · {p.weight||0}kg{p.source?" · from "+p.source:""}</div>
                      {p.purchasePrice&&parseFloat(p.purchasePrice)>0&&<div style={{fontSize:11,color:C.red,marginTop:2}}>💰 Purchase: {fmtRWF(parseFloat(p.purchasePrice))}</div>}
                      {p.notes&&<div style={{fontSize:11,color:C.faint,marginTop:2,fontStyle:"italic"}}>Notes: {p.notes}</div>}
                      <div style={{fontSize:10,color:C.faint,marginTop:3}}>📅 Submitted: {(p.submittedAt||"").slice(0,10)}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                      <button onClick={()=>approvePig(p.id,null)} style={{padding:"6px 13px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Approve</button>
                      <button onClick={()=>{setEditPigId(p.id);setEditPigForm({...p});}} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,.4)",background:"rgba(99,102,241,.06)",color:"#6366f1",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                      <button onClick={()=>{const n=prompt("Rejection reason (optional):");rejectPig(p.id,n||"");}} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✗ Reject</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </>
    )}
  </div>);
}

/* ═══════════════════════════════════════════════════
   WORKER — WEEKLY PIG ASSESSMENT
   Records weight + length + BCS for each active pig
   Submitted for admin approval; approved data updates
   pig weights and feeds into profitability analytics
═══════════════════════════════════════════════════ */
function WorkerPigAssessment({user,pigs,assessments,setAssessments}){
  const active=pigs.filter(p=>p.status==="active");
  const [tab,setTab]=useState("form");
  const [rows,setRows]=useState(()=>active.map(p=>({pigId:p.id,tag:p.tag,breed:p.breed,stage:p.stage,currentWeight:p.weight,weight:"",length:"",bcs:"3",notes:"",done:false})));
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [toast,setToast]=useState(null);
  const [confirm,setConfirm]=useState(false);

  // Reset rows if pigs list changes
  const myHistory=(assessments||[]).filter(a=>a.workerId===user.id).slice().reverse();
  const pending=myHistory.filter(a=>a.approved===false);
  const thisWeek=()=>{const d=new Date();const mon=new Date(d);mon.setDate(d.getDate()-d.getDay()+1);return mon.toISOString().slice(0,10);}
  const weekStart=thisWeek();
  const alreadyThisWeek=myHistory.some(a=>a.weekStart===weekStart);

  function updateRow(pigId,field,val){setRows(r=>r.map(x=>x.pigId===pigId?{...x,[field]:val,done:!!(x.weight||(field==="weight"&&val))}:x));}

  const filledCount=rows.filter(r=>r.weight).length;
  const allFilled=filledCount===rows.length&&rows.length>0;

  async function submit(){
    setConfirm(false);setSaving(true);
    const batch=rows.filter(r=>r.weight).map(r=>({
      id:uid(),
      pigId:r.pigId,
      pigTag:r.tag,
      pigBreed:r.breed,
      pigStage:r.stage,
      prevWeight:r.currentWeight,
      weight:parseFloat(r.weight)||r.currentWeight,
      length:r.length?parseFloat(r.length):null,
      bcs:parseInt(r.bcs)||3,
      notes:r.notes||"",
      workerId:user.id,
      worker:user.name,
      date:toDay(),
      weekStart,
      approved:false,
      submittedAt:new Date().toISOString()
    }));
    const updated=[...(assessments||[]),...batch];
    setAssessments(updated);
    fsSet("assessments",updated);
    try{
      const data=await getOnlineFarmData()||{};
      await setOnlineFarmData({...data,assessments:updated});
      setToast({type:"success",message:`✅ ${batch.length} pig assessment${batch.length>1?"s":""} submitted! Awaiting admin approval.`});
      setSaved(true);
    }catch(e){
      setToast({type:"error",message:"Saved locally. Sync failed — check internet."});
      setSaved(true);
    }
    setSaving(false);
  }

  const BCS_DESC={"1":"Emaciated — ribs & spine very prominent","2":"Thin — ribs easily felt","3":"Ideal — slight fat cover","4":"Fat — ribs hard to feel","5":"Obese — fat deposits visible"};

  if(saved)return(<div style={{textAlign:"center",padding:60,maxWidth:460,margin:"0 auto"}}>
    <div style={{fontSize:52,marginBottom:12}}>📏</div>
    <div style={{fontSize:19,fontWeight:700,color:C.accent,marginBottom:6}}>Assessment Submitted!</div>
    <div style={{fontSize:13,color:C.faint,marginBottom:20}}>The farm owner will review and approve your measurements. Once approved, pig weights will be updated automatically.</div>
    <button onClick={()=>{setSaved(false);setTab("history");}} style={S.btn(C.accent)}>📋 View My Submissions →</button>
  </div>);

  return(<div className="fade-in">
    {confirm&&<ConfirmDialog title="Submit Weekly Assessment?" body={`You're submitting measurements for ${filledCount} pig(s). Unmeasured pigs will be skipped. Submit now?`} onConfirm={submit} onCancel={()=>setConfirm(false)}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}

    <div style={S.h1}>📏 Weekly Pig Assessment</div>
    <div style={S.sub}>Measure weight & length for each pig — submitted for admin approval</div>

    {alreadyThisWeek&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,marginBottom:14,fontSize:13,color:C.amber}}>
      ⚠️ You already submitted an assessment this week ({weekStart}). You can submit again if measurements were missed or corrected.
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border}}>
      {[["form","📝 New Assessment"],["history","📋 My History"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {tab==="form"&&(<div>
      {/* Progress bar */}
      <div style={{...S.card,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
          <span style={{fontWeight:700,color:C.text}}>Progress: {filledCount}/{rows.length} pigs measured</span>
          <span style={{color:allFilled?C.accent:C.amber}}>{allFilled?"✅ All done!":"⏳ In progress"}</span>
        </div>
        <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:(rows.length>0?filledCount/rows.length*100:0)+"%",background:allFilled?C.accent:"#f59e0b",borderRadius:4,transition:"width .4s"}}/>
        </div>
      </div>

      {/* Instructions */}
      <div style={{...S.card,background:"rgba(37,99,235,.04)",border:"1px solid rgba(37,99,235,.2)",padding:"10px 14px",marginBottom:14,fontSize:12,color:C.muted}}>
        📐 <b>Weight:</b> Use a weighing scale (kg) &nbsp;|&nbsp; 📏 <b>Length:</b> Measure from snout tip to tail base (cm) &nbsp;|&nbsp; 🔢 <b>BCS:</b> Body Condition Score 1–5
      </div>

      {rows.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>No active pigs found. Ask admin to add pigs first.</div>}

      {rows.map(r=>(
        <div key={r.pigId} style={{...S.card,marginBottom:10,borderLeft:"4px solid "+(r.weight?C.accent:C.border)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>🐷 {r.tag}</div>
              <div style={{fontSize:11,color:C.faint}}>{r.breed} · {r.stage} · Current: <b>{r.currentWeight}kg</b></div>
            </div>
            {r.weight&&<span style={{fontSize:10,padding:"2px 9px",borderRadius:20,background:"rgba(22,163,74,.1)",color:C.accent,fontWeight:700}}>✓ Measured</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:8}}>
            <div>
              <label style={S.lbl}>⚖️ Weight (kg) *</label>
              <input type="number" min="1" max="500" step="0.1" value={r.weight} onChange={e=>updateRow(r.pigId,"weight",e.target.value)} placeholder={r.currentWeight} style={{...S.inp,borderColor:r.weight?"rgba(22,163,74,.5)":undefined}}/>
            </div>
            <div>
              <label style={S.lbl}>📏 Length (cm)</label>
              <input type="number" min="20" max="250" step="0.5" value={r.length} onChange={e=>updateRow(r.pigId,"length",e.target.value)} placeholder="e.g. 95" style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>🔢 BCS (1–5)</label>
              <select value={r.bcs} onChange={e=>updateRow(r.pigId,"bcs",e.target.value)} style={S.inp}>
                {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {r.bcs&&<div style={{fontSize:11,color:C.faint,marginBottom:6,padding:"4px 8px",background:C.elevated,borderRadius:5}}>BCS {r.bcs}: {BCS_DESC[r.bcs]}</div>}
          {r.weight&&r.currentWeight&&(()=>{const gain=parseFloat(r.weight)-r.currentWeight;return(<div style={{fontSize:11,color:gain>0?C.accent:gain<0?C.red:C.muted,marginBottom:6}}>
            {gain>0?"📈":"gain"===0?"➡️":"📉"} Weight change from last record: <b>{gain>0?"+":""}{gain.toFixed(1)}kg</b>
          </div>);})()}
          <div>
            <label style={S.lbl}>📝 Notes (optional)</label>
            <input value={r.notes} onChange={e=>updateRow(r.pigId,"notes",e.target.value)} placeholder="Any observations, injuries, behavior changes..." style={S.inp}/>
          </div>
        </div>
      ))}

      {rows.length>0&&<div style={{position:"sticky",bottom:16,zIndex:10}}>
        <button onClick={()=>filledCount>0&&setConfirm(true)} disabled={saving||filledCount===0} style={{...S.btn(filledCount>0?C.accent:"#94a3b8"),width:"100%",padding:13,fontSize:14,fontWeight:700,boxShadow:"0 4px 20px rgba(22,163,74,.35)"}}>
          {saving?<><span className="spin" style={{...S.loader,borderTopColor:"#fff",width:15,height:15,marginRight:8}}/>Submitting…</>:`📤 Submit Assessment (${filledCount}/${rows.length} pigs)`}
        </button>
      </div>}
    </div>)}

    {tab==="history"&&(<div>
      {myHistory.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>No assessments submitted yet.</div>}
      {pending.length>0&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:9,marginBottom:12,fontSize:13,color:C.amber}}>
        ⏳ {pending.length} assessment(s) awaiting admin approval
      </div>}
      {/* Group by weekStart */}
      {Object.entries(myHistory.reduce((acc,a)=>{const k=a.weekStart||a.date;if(!acc[k])acc[k]=[];acc[k].push(a);return acc;},{})).map(([week,items])=>(
        <div key={week} style={{...S.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13,color:C.text}}>📅 Week of {week}</div>
            <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,fontWeight:700,
              background:items.some(a=>a.approved===false)?"rgba(245,158,11,.1)":"rgba(22,163,74,.1)",
              color:items.some(a=>a.approved===false)?C.amber:C.accent}}>
              {items.some(a=>a.approved===false)?"⏳ Pending":"✅ Approved"}
            </span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
            {items.map(a=>(
              <div key={a.id} style={{background:C.elevated,borderRadius:8,padding:"8px 10px",border:"1px solid "+C.border}}>
                <div style={{fontWeight:700,fontSize:12,color:C.text}}>🐷 {a.pigTag}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>⚖️ {a.weight}kg {a.length?"· 📏 "+a.length+"cm":""}</div>
                <div style={{fontSize:11,color:C.faint}}>BCS {a.bcs} · {a.date}</div>
                {a.notes&&<div style={{fontSize:10,color:C.faint,marginTop:3,fontStyle:"italic"}}>{a.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════
   ADMIN — PIG ASSESSMENT HISTORY & APPROVAL
   Reviews all submitted assessments, approves/rejects
   Approved assessments update pig weights and feed
   into growth analytics and profitability reports
═══════════════════════════════════════════════════ */
function PigAssessmentHistory({pigs,setPigs,assessments,setAssessments,users}){
  const [tab,setTab]=useState("pending");
  const [selPig,setSelPig]=useState("all");
  const [selWorker,setSelWorker]=useState("all");
  const [toast,setToast]=useState(null);

  const pending=(assessments||[]).filter(a=>a.approved===false);
  const approved=(assessments||[]).filter(a=>a.approved===true);
  const activePigs=pigs.filter(p=>p.status==="active");

  function approve(a){
    // Update pig's current weight
    setPigs(p=>{
      const u=p.map(pig=>pig.id===a.pigId?{...pig,weight:a.weight}:pig);
      fsSet("pigs",u);
      return u;
    });
    const updated=(assessments||[]).map(x=>x.id===a.id?{...x,approved:true,approvedAt:toDay()}:x);
    setAssessments(updated);
    fsSet("assessments",updated);
    getOnlineFarmData().then(data=>setOnlineFarmData({...data,assessments:updated,
      pigs:pigs.map(pig=>pig.id===a.pigId?{...pig,weight:a.weight}:pig)
    })).catch(()=>{});
    setToast({type:"success",message:`✅ Approved! ${a.pigTag} weight updated to ${a.weight}kg`});
  }

  function approveAll(batch){
    let updatedPigs=[...pigs];
    batch.forEach(a=>{
      updatedPigs=updatedPigs.map(pig=>pig.id===a.pigId?{...pig,weight:a.weight}:pig);
    });
    setPigs(updatedPigs);
    fsSet("pigs",updatedPigs);
    const updatedA=(assessments||[]).map(x=>batch.find(b=>b.id===x.id)?{...x,approved:true,approvedAt:toDay()}:x);
    setAssessments(updatedA);
    fsSet("assessments",updatedA);
    getOnlineFarmData().then(data=>setOnlineFarmData({...data,assessments:updatedA,pigs:updatedPigs})).catch(()=>{});
    setToast({type:"success",message:`✅ Approved ${batch.length} assessments! Pig weights updated.`});
  }

  function reject(id){
    const updated=(assessments||[]).filter(x=>x.id!==id);
    setAssessments(updated);
    fsSet("assessments",updated);
    getOnlineFarmData().then(data=>setOnlineFarmData({...data,assessments:updated})).catch(()=>{});
    setToast({type:"error",message:"🗑️ Assessment rejected and removed."});
  }

  // Per-pig growth history (approved only)
  function pigGrowthHistory(pigId){
    return (assessments||[]).filter(a=>a.pigId===pigId&&a.approved===true).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  }

  // ADG from assessment history
  function calcADG(history){
    if(history.length<2) return null;
    const first=history[0];const last=history[history.length-1];
    const days=Math.round((new Date(last.date)-new Date(first.date))/(1000*60*60*24));
    if(days<=0) return null;
    return ((last.weight-first.weight)/days).toFixed(3);
  }

  // Group pending by week
  const pendingByWeek=pending.reduce((acc,a)=>{const k=a.weekStart||a.date;if(!acc[k])acc[k]=[];acc[k].push(a);return acc;},{});

  // Filter approved
  let filteredApproved=approved;
  if(selPig!=="all") filteredApproved=filteredApproved.filter(a=>a.pigId===selPig);
  if(selWorker!=="all") filteredApproved=filteredApproved.filter(a=>a.workerId===selWorker);

  // Growth analytics — per pig
  const pigAnalytics=activePigs.map(pig=>{
    const hist=pigGrowthHistory(pig.id);
    const adg=calcADG(hist);
    const lastA=hist[hist.length-1];
    const weightGain=hist.length>=2?hist[hist.length-1].weight-hist[0].weight:null;
    const weekCount=hist.length;
    const avgBCS=hist.length>0?(hist.reduce((s,h)=>s+(h.bcs||3),0)/hist.length).toFixed(1):null;
    // Profitability signal: ADG vs stage benchmark
    const ADG_BENCH={Piglet:0.20,Weaner:0.35,Grower:0.50,Finisher:0.65,Gilt:0.40,Sow:0.05,Boar:0.05};
    const bench=ADG_BENCH[pig.stage]||0.5;
    const perf=adg?((parseFloat(adg)/bench)*100).toFixed(0):null;
    return{pig,hist,adg,lastA,weightGain,weekCount,avgBCS,perf};
  }).filter(x=>x.weekCount>0).sort((a,b)=>b.weekCount-a.weekCount);

  const BCS_COLOR={1:C.red,2:C.amber,3:C.accent,4:C.amber,5:C.red};

  return(<div className="fade-in">
    {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}

    <div style={S.h1}>📏 Growth Assessments</div>
    <div style={S.sub}>Weekly pig measurements · Weight & length tracking · Growth analytics · Profitability signals</div>

    {/* KPI row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
      {[
        {l:"Pending Approval",v:pending.length,c:pending.length>0?C.amber:C.accent},
        {l:"Total Approved",v:approved.length,c:C.accent},
        {l:"Pigs Tracked",v:pigAnalytics.length,c:C.blue},
        {l:"This Week",v:(assessments||[]).filter(a=>{const d=new Date(a.date);const now=new Date();return(now-d)/(1000*60*60*24)<=7;}).length,c:C.purple},
      ].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:20}}>{s.v}</div></div>
      ))}
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:C.elevated,borderRadius:9,padding:3,marginBottom:16,gap:2,border:"1px solid "+C.border,flexWrap:"wrap"}}>
      {[["pending","⏳ Pending"+(pending.length?" ("+pending.length+")":"")],["analytics","📈 Growth Analytics"],["history","📋 All Records"]].map(([t,l])=>(
        <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{l}</button>
      ))}
    </div>

    {/* ── PENDING TAB ── */}
    {tab==="pending"&&(<div>
      {pending.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:36,marginBottom:8}}>✅</div>No pending assessments. All measurements are approved.
      </div>}

      {Object.entries(pendingByWeek).sort((a,b)=>b[0].localeCompare(a[0])).map(([week,items])=>(
        <div key={week} style={{...S.card,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>📅 Week of {week}</div>
              <div style={{fontSize:11,color:C.faint}}>
                {items.length} pig(s) measured by {[...new Set(items.map(a=>a.worker))].join(", ")}
              </div>
            </div>
            <button onClick={()=>approveAll(items)} style={{...S.btn(C.accent),fontSize:12,padding:"7px 14px"}}>
              ✅ Approve All ({items.length})
            </button>
          </div>

          {items.map(a=>{
            const pig=pigs.find(p=>p.id===a.pigId);
            const weightChange=a.weight-(a.prevWeight||0);
            const isGood=weightChange>0;
            return(<div key={a.id} style={{...S.row,marginBottom:8,flexDirection:"column",alignItems:"stretch",padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.text}}>🐷 {a.pigTag} <span style={{fontWeight:400,color:C.faint,fontSize:11}}>({a.pigBreed} · {a.pigStage})</span></div>
                  <div style={{fontSize:11,color:C.faint}}>Submitted by {a.worker} · {a.date}</div>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>approve(a)} style={{...S.btn(C.accent),fontSize:11,padding:"5px 12px"}}>✅ Approve</button>
                  <button onClick={()=>reject(a.id)} style={{padding:"5px 12px",borderRadius:7,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✗ Reject</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                {[
                  ["Previous Weight",a.prevWeight+"kg",C.muted],
                  ["New Weight",a.weight+"kg",isGood?C.accent:C.red],
                  ["Weight Change",(weightChange>=0?"+":"")+weightChange.toFixed(1)+"kg",isGood?C.accent:C.red],
                  ...(a.length?[["Length",a.length+"cm",C.blue]]:[]),
                  ["BCS",""+a.bcs+"/5",BCS_COLOR[a.bcs]||C.text],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 9px",textAlign:"center",border:"1px solid "+C.border}}>
                    <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                    <div style={{fontWeight:700,color:c,fontSize:13}}>{v}</div>
                  </div>
                ))}
              </div>
              {a.notes&&<div style={{marginTop:8,fontSize:11,color:C.muted,fontStyle:"italic",padding:"5px 9px",background:C.elevated,borderRadius:6}}>📝 {a.notes}</div>}
            </div>);
          })}
        </div>
      ))}
    </div>)}

    {/* ── GROWTH ANALYTICS TAB ── */}
    {tab==="analytics"&&(<div>
      {pigAnalytics.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:36,marginBottom:8}}>📈</div>No approved assessments yet. Approve worker submissions to see growth analytics.
      </div>}

      {pigAnalytics.length>0&&<div style={{...S.card,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.2)",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>💡 Farm Growth Summary</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,fontSize:12}}>
          {(()=>{
            const adgs=pigAnalytics.filter(x=>x.adg!==null).map(x=>parseFloat(x.adg));
            const avgADG=adgs.length>0?(adgs.reduce((s,v)=>s+v,0)/adgs.length).toFixed(3):null;
            const aboveTarget=pigAnalytics.filter(x=>x.perf&&parseInt(x.perf)>=90).length;
            const belowTarget=pigAnalytics.filter(x=>x.perf&&parseInt(x.perf)<70).length;
            return[
              ["Avg Daily Gain",avgADG?avgADG+"kg/day":"—",C.accent],
              ["On Target (≥90%)",aboveTarget+" pigs",C.accent],
              ["Below Target (<70%)",belowTarget+" pigs",belowTarget>0?C.red:C.faint],
              ["Total Tracked",pigAnalytics.length+" pigs",C.blue],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:C.surface,borderRadius:8,padding:"9px 11px",textAlign:"center",border:"1px solid "+C.border}}>
                <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
                <div style={{fontWeight:700,color:c,fontSize:14}}>{v}</div>
              </div>
            ));
          })()}
        </div>
      </div>}

      {pigAnalytics.map(({pig,hist,adg,weightGain,weekCount,avgBCS,perf})=>{
        const perfNum=perf?parseInt(perf):null;
        const perfColor=perfNum===null?C.faint:perfNum>=90?C.accent:perfNum>=70?C.amber:C.red;
        const perfLabel=perfNum===null?"No data":perfNum>=90?"🟢 On Target":perfNum>=70?"🟡 Below Target":"🔴 Poor Growth";
        return(<div key={pig.id} style={{...S.card,marginBottom:12,borderLeft:"4px solid "+perfColor}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>🐷 {pig.tag} <span style={{fontWeight:400,color:C.faint,fontSize:11}}>({pig.breed} · {pig.stage})</span></div>
              <div style={{fontSize:11,color:C.faint}}>{weekCount} assessment{weekCount>1?"s":""} recorded</div>
            </div>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:perfColor+"18",color:perfColor,fontWeight:700,border:"1px solid "+perfColor+"33"}}>{perfLabel}</span>
          </div>

          {/* Metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:10}}>
            {[
              ["Current Weight",pig.weight+"kg",C.text],
              ["Total Gain",weightGain!==null?(weightGain>=0?"+":"")+weightGain.toFixed(1)+"kg":hist.length===1?hist[0].weight+"kg (1 reading)":"—",weightGain>=0?C.accent:C.red],
              ["Avg Daily Gain",adg?adg+"kg":"—",C.blue],
              ["vs Benchmark",perf?perf+"%":"—",perfColor],
              ["Avg BCS",avgBCS?avgBCS+"/5":"—",BCS_COLOR[Math.round(parseFloat(avgBCS||3))]||C.text],
              ["Weeks Tracked",weekCount,C.purple],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:C.elevated,borderRadius:7,padding:"6px 9px",textAlign:"center",border:"1px solid "+C.border}}>
                <div style={{fontSize:9,color:C.faint,marginBottom:2}}>{l}</div>
                <div style={{fontWeight:700,color:c,fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Weight trend chart (simple bars) */}
          {hist.length>=2&&<div style={{marginBottom:8}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>📊 Weight trend (kg)</div>
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:52}}>
              {hist.map((h,i)=>{
                const min=Math.min(...hist.map(x=>x.weight));
                const max=Math.max(...hist.map(x=>x.weight));
                const range=max-min||1;
                const ht=Math.max(((h.weight-min)/range)*40+10,8);
                return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:8,color:C.faint}}>{h.weight}</div>
                  <div style={{width:"100%",height:ht,background:i===hist.length-1?"linear-gradient(180deg,"+C.accent+",#10b981)":"linear-gradient(180deg,#93c5fd,#60a5fa)",borderRadius:3,transition:"height .4s"}}/>
                  <div style={{fontSize:7,color:C.faint,textAlign:"center"}}>{(h.date||"").slice(5)}</div>
                </div>);
              })}
            </div>
          </div>}

          {/* Profitability signal */}
          {adg&&<div style={{padding:"7px 10px",borderRadius:7,fontSize:11,background:perfColor+"0d",border:"1px solid "+perfColor+"33",color:perfColor}}>
            {perfNum>=90&&"✅ Growing well above target — ideal time to maintain feed and plan for market sale."}
            {perfNum>=70&&perfNum<90&&"⚠️ Growth is slightly below target. Review feed quality and quantity."}
            {perfNum<70&&"🔴 Poor growth rate vs benchmark. Check for illness, parasites, or feed issues. Consider vet visit."}
          </div>}
        </div>);
      })}
    </div>)}

    {/* ── HISTORY TAB ── */}
    {tab==="history"&&(<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <select value={selPig} onChange={e=>setSelPig(e.target.value)} style={{...S.inp,width:"auto"}}>
          <option value="all">All Pigs</option>
          {activePigs.map(p=><option key={p.id} value={p.id}>{p.tag} ({p.stage})</option>)}
        </select>
        <select value={selWorker} onChange={e=>setSelWorker(e.target.value)} style={{...S.inp,width:"auto"}}>
          <option value="all">All Workers</option>
          {[...new Set((assessments||[]).map(a=>a.workerId))].map(wid=>{
            const w=users.find(u=>u.id===wid);
            return w?<option key={wid} value={wid}>{w.name}</option>:null;
          })}
        </select>
      </div>
      {filteredApproved.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>No approved records match the selected filter.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {filteredApproved.slice().reverse().map(a=>(
          <div key={a.id} style={{...S.card,padding:"10px 13px",marginBottom:0}}>
            <div style={{fontWeight:700,fontSize:13,color:C.text}}>🐷 {a.pigTag}</div>
            <div style={{fontSize:11,color:C.faint,marginTop:2}}>{a.pigStage} · {a.date}</div>
            <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:700,color:C.accent}}>⚖️ {a.weight}kg</span>
              {a.length&&<span style={{fontSize:12,color:C.blue}}>📏 {a.length}cm</span>}
              <span style={{fontSize:12,color:BCS_COLOR[a.bcs]||C.text}}>BCS {a.bcs}</span>
            </div>
            <div style={{fontSize:10,color:C.faint,marginTop:4}}>By {a.worker}</div>
            {a.notes&&<div style={{fontSize:10,color:C.muted,marginTop:4,fontStyle:"italic"}}>{a.notes}</div>}
          </div>
        ))}
      </div>
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════
   WHATSAPP ALERTS SETTINGS (CallMeBot)
═══════════════════════════════════════════════════ */
function WorkerWAContacts(){
  const [contacts,setContacts]=useState(()=>getWorkerWAContacts());
  const [newName,setNewName]=useState("");
  const [newPhone,setNewPhone]=useState("");
  const [newApiKey,setNewApiKey]=useState("");
  const [broadcastMsg,setBroadcastMsg]=useState("");
  const [sending,setSending]=useState(false);
  const [sendStatus,setSendStatus]=useState("");
  const [showAdd,setShowAdd]=useState(false);

  function addContact(){
    if(!newName.trim()||!newPhone.trim()||!newApiKey.trim())return;
    const updated=[...contacts,{id:uid(),name:newName.trim(),phone:newPhone.trim(),apikey:newApiKey.trim()}];
    setContacts(updated);setWorkerWAContacts(updated);
    setNewName("");setNewPhone("");setNewApiKey("");setShowAdd(false);
  }
  function removeContact(id){
    const updated=contacts.filter(c=>c.id!==id);
    setContacts(updated);setWorkerWAContacts(updated);
  }

  async function broadcast(){
    if(!broadcastMsg.trim()||contacts.length===0)return;
    setSending(true);setSendStatus("");
    const msg=`📢 FarmIQ — ${toDay()}\n${broadcastMsg.trim()}`;
    let sent=0;
    for(const c of contacts){
      const ok=await sendWhatsAppToNumber(c.phone,c.apikey,msg);
      if(ok)sent++;
      await new Promise(r=>setTimeout(r,300));// small delay between sends
    }
    setSendStatus(`✅ Message sent to ${sent}/${contacts.length} worker(s). Check their WhatsApp.`);
    setBroadcastMsg("");
    setSending(false);
    setTimeout(()=>setSendStatus(""),6000);
  }

  return(<>
    {/* Worker Contacts Card */}
    <div style={S.card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>👷 Worker WhatsApp Contacts</div>
        <button onClick={()=>setShowAdd(p=>!p)} style={{...S.btn(C.accent),padding:"5px 12px",fontSize:11}}>
          {showAdd?"✕ Cancel":"➕ Add Worker"}
        </button>
      </div>
      <div style={{fontSize:11,color:C.faint,marginBottom:10}}>
        Each worker must activate CallMeBot once (send <span style={{fontFamily:"monospace",background:C.elevated,padding:"1px 5px",borderRadius:3}}>I allow callmebot to send me messages</span> to <b>+34 644 65 00 63</b>) to get their API key.
      </div>

      {showAdd&&<div style={{background:"rgba(22,163,74,.05)",border:"1px solid rgba(22,163,74,.2)",borderRadius:9,padding:12,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:10}}>➕ Add Worker Contact</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:9}}>
          <div>
            <label style={S.lbl}>Worker Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Jean Pierre" style={S.inp}/>
          </div>
          <div>
            <label style={S.lbl}>📞 WhatsApp Phone</label>
            <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+250788123456" style={S.inp}/>
          </div>
        </div>
        <div style={{marginBottom:9}}>
          <label style={S.lbl}>🔑 Worker's CallMeBot API Key</label>
          <input value={newApiKey} onChange={e=>setNewApiKey(e.target.value)} placeholder="Worker's personal API key from CallMeBot" style={S.inp}/>
        </div>
        <button onClick={addContact} disabled={!newName||!newPhone||!newApiKey} style={{...S.btn(C.accent),width:"100%"}}>
          💾 Save Worker Contact
        </button>
      </div>}

      {contacts.length===0&&!showAdd&&<div style={{color:C.faint,fontSize:13,textAlign:"center",padding:"10px 0"}}>No worker contacts yet. Add workers above.</div>}
      {contacts.map(c=>(
        <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:C.elevated,borderRadius:8,marginBottom:7,border:"1px solid "+C.border}}>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:C.text}}>👤 {c.name}</div>
            <div style={{fontSize:11,color:C.faint}}>{c.phone}</div>
          </div>
          <button onClick={()=>removeContact(c.id)} style={{...S.btn(C.red),padding:"4px 10px",fontSize:11}}>Remove</button>
        </div>
      ))}
    </div>

    {/* Broadcast Message Card */}
    <div style={{...S.card,background:"linear-gradient(135deg,rgba(37,211,102,.06),rgba(22,163,74,.03))",border:"1px solid rgba(37,211,102,.25)"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#128C7E",marginBottom:6}}>📢 Send Message to Workers</div>
      <div style={{fontSize:11,color:C.faint,marginBottom:12}}>
        Type a message and send it directly to all {contacts.length} worker(s) via WhatsApp.
      </div>
      <textarea
        value={broadcastMsg}
        onChange={e=>setBroadcastMsg(e.target.value)}
        placeholder="Type your message to workers here…\ne.g. Please check pigs in pen 3 today. Make sure feeding is done by 8am."
        rows={4}
        style={{...S.inp,resize:"vertical",lineHeight:1.6,marginBottom:10}}
      />
      <button
        onClick={broadcast}
        disabled={sending||!broadcastMsg.trim()||contacts.length===0}
        style={{...S.btn("#128C7E"),width:"100%",opacity:(sending||!broadcastMsg.trim()||contacts.length===0)?0.6:1}}
      >
        {sending
          ?<><span className="spin" style={{...S.loader,borderTopColor:"#fff"}}/>Sending to {contacts.length} worker(s)…</>
          :`📱 Send to ${contacts.length} Worker(s)`
        }
      </button>
      {contacts.length===0&&<div style={{marginTop:8,fontSize:11,color:C.amber,textAlign:"center"}}>⚠️ Add worker contacts above first.</div>}
      {sendStatus&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(37,211,102,.08)",border:"1px solid rgba(37,211,102,.3)",borderRadius:7,fontSize:12,color:"#128C7E"}}>{sendStatus}</div>}
    </div>
  </>);
}


function WorkerWASetup(){
  const saved=getWAConfig();
  const [phone,setPhone]=useState(saved.phone||"");
  const [apikey,setApikey]=useState(saved.apikey||"");
  const [enabled,setEnabled]=useState(!!saved.enabled);
  const [feedback,setFeedback]=useState("");
  const [testStatus,setTestStatus]=useState("");
  const [testing,setTesting]=useState(false);

  function save(){
    setWAConfig({...saved,phone:phone.trim(),apikey:apikey.trim(),enabled});
    setFeedback("✅ Saved!");
    setTimeout(()=>setFeedback(""),3000);
  }

  async function test(){
    setTesting(true);setTestStatus("");
    const p=phone.trim();const k=apikey.trim();
    if(!p||!k){setTestStatus("❌ Enter phone and API key first.");setTesting(false);return;}
    const msg="🐷 FarmIQ Test Alert!\nWorker WhatsApp setup is working!\nDate: "+toDay();
    const url="https://api.callmebot.com/whatsapp.php?phone="+encodeURIComponent(p)+"&text="+encodeURIComponent(msg)+"&apikey="+encodeURIComponent(k);
    try{
      await fetch(url,{method:"GET",mode:"no-cors"});
      setTestStatus("📨 Test sent! Check your WhatsApp.");
    }catch(e){setTestStatus("❌ Error: "+e.message);}
    setTesting(false);
  }

  return(<div className="fade-in">
    <div style={S.h1}>📱 My WhatsApp Setup</div>
    <div style={S.sub}>Receive farm alerts on your WhatsApp phone</div>

    <div style={{...S.card,background:"linear-gradient(135deg,rgba(37,211,102,.07),rgba(22,163,74,.04))",border:"1px solid rgba(37,211,102,.3)",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:"#128C7E",marginBottom:8}}>📋 One-time Setup Steps</div>
      <div style={{fontSize:12,color:C.muted,lineHeight:1.9}}>
        <b>1.</b> Open WhatsApp and message <b>+34 644 65 00 63</b>:<br/>
        <span style={{fontFamily:"monospace",background:C.elevated,padding:"2px 8px",borderRadius:4,display:"inline-block",margin:"4px 0",color:C.text}}>I allow callmebot to send me messages</span><br/>
        <b>2.</b> You will receive your personal <b>API key</b> back.<br/>
        <b>3.</b> Enter your number (with country code e.g. <b>+250788123456</b>) and the API key below.<br/>
        <b>4.</b> Click <b>Save</b> then <b>Test</b> to confirm it works.
      </div>
    </div>

    <div style={S.card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>⚙️ My Settings</div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{fontSize:12,color:enabled?C.accent:C.muted,fontWeight:600}}>{enabled?"🟢 On":"⚪ Off"}</span>
          <div onClick={()=>setEnabled(p=>!p)} style={{width:40,height:22,borderRadius:11,background:enabled?C.accent:"#cbd5e1",position:"relative",cursor:"pointer",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:enabled?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div><label style={S.lbl}>📞 My WhatsApp Number</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+250788123456" style={S.inp}/></div>
        <div><label style={S.lbl}>🔑 My CallMeBot API Key</label><input value={apikey} onChange={e=>setApikey(e.target.value)} placeholder="1234567" type="password" style={S.inp}/></div>
      </div>
      <div style={{display:"flex",gap:9}}>
        <button onClick={save} style={{...S.btn(C.accent),flex:1}}>💾 Save</button>
        <button onClick={test} disabled={testing} style={S.btn("#128C7E")}>{testing?"Sending…":"📨 Test"}</button>
      </div>
      {feedback&&<div style={{marginTop:10,padding:"8px 12px",background:C.accentSoft,border:"1px solid rgba(22,163,74,.3)",borderRadius:7,fontSize:13,color:C.accent}}>{feedback}</div>}
      {testStatus&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(37,211,102,.07)",border:"1px solid rgba(37,211,102,.3)",borderRadius:7,fontSize:12,color:C.muted}}>{testStatus}</div>}
    </div>

    <div style={{...S.card,background:enabled&&phone&&apikey?"rgba(22,163,74,.04)":"rgba(245,158,11,.04)",border:"1px solid "+(enabled&&phone&&apikey?"rgba(22,163,74,.25)":"rgba(245,158,11,.3)")}}>
      <div style={{fontSize:12,color:C.muted}}>
        <b>Status:</b> {enabled&&phone&&apikey?"✅ You will receive WhatsApp alerts from FarmIQ.":"⚠️ Alerts inactive. "+(!phone?"Enter your phone. ":"")+(!apikey?"Enter your API key. ":"")+(!enabled?"Toggle On above. ":"")}
      </div>
    </div>
  </div>);
}

function WhatsAppSettings({pigs,feeds,logs,sales,expenses,incomes,reproductions,stock}){
  const saved=getWAConfig();
  const [phone,setPhone]=useState(saved.phone||"");
  const [apikey,setApikey]=useState(saved.apikey||"");
  const [enabled,setEnabled]=useState(!!saved.enabled);
  const [prefs,setPrefs]=useState({
    onSickPig:    saved.onSickPig    !==false,
    onDeath:      saved.onDeath      !==false,
    onSale:       saved.onSale       !==false,
    onLowStock:   saved.onLowStock   !==false,
    onFarrowingSoon: saved.onFarrowingSoon!==false,
    onLoss:       saved.onLoss       !==false,
  });
  const [saveFeedback,setSaveFeedback]=useState("");
  const [testStatus,setTestStatus]=useState("");
  const [testing,setTesting]=useState(false);

  function save(){
    setWAConfig({phone:phone.trim(),apikey:apikey.trim(),enabled,...prefs});
    setSaveFeedback("✅ Settings saved!");
    setTimeout(()=>setSaveFeedback(""),3000);
  }

  async function test(){
    setTesting(true);setTestStatus("");
    const phone2=phone.trim();const apikey2=apikey.trim();
    if(!phone2||!apikey2){setTestStatus("❌ Enter phone and API key first.");setTesting(false);return;}
    const msg=`🐷 FarmIQ Test Alert!\nFarm: ${pigs.filter(p=>p.status==="active").length} active pigs\nDate: ${toDay()}\nWhatsApp alerts are working!`;
    const url=`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone2)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(apikey2)}`;
    try{
      await fetch(url,{method:"GET",mode:"no-cors"});
      setTestStatus("📨 Test message sent! Check your WhatsApp. (If it doesn't arrive, verify your phone number and API key.)");
    }catch(e){
      setTestStatus("❌ Failed: "+e.message);
    }
    setTesting(false);
  }

  const alertOptions=[
    {key:"onSickPig",    icon:"🏥", label:"Sick pig reported in daily log"},
    {key:"onDeath",      icon:"💀", label:"Pig death recorded"},
    {key:"onSale",       icon:"💰", label:"Pig sale completed"},
    {key:"onLowStock",   icon:"📦", label:"Feed/stock falls below minimum"},
    {key:"onFarrowingSoon",icon:"🐖",label:"Sow due to farrow within 7 days"},
    {key:"onLoss",       icon:"📉", label:"Farm running at a financial loss"},
  ];

  return(<div className="fade-in">
    <div style={S.h1}>📱 WhatsApp Alerts</div>
    <div style={S.sub}>Get real-time farm alerts on WhatsApp via CallMeBot (free service)</div>

    {/* Setup guide */}
    <div style={{...S.card,background:"linear-gradient(135deg,rgba(37,211,102,.07),rgba(22,163,74,.04))",border:"1px solid rgba(37,211,102,.3)",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:"#128C7E",marginBottom:8}}>📋 How to Set Up (One-time)</div>
      <div style={{fontSize:12,color:C.muted,lineHeight:1.8}}>
        <b>1.</b> Open WhatsApp and send this message to <b>+34 644 65 00 63</b>:<br/>
        <span style={{fontFamily:"monospace",background:C.elevated,padding:"2px 7px",borderRadius:4,display:"inline-block",margin:"4px 0",color:C.text}}>I allow callmebot to send me messages</span><br/>
        <b>2.</b> You will receive a reply with your personal <b>API key</b>.<br/>
        <b>3.</b> Enter your WhatsApp phone number (with country code, e.g. <b>+250788123456</b>) and the API key below.<br/>
        <b>4.</b> Click "Save" then "Send Test Message" to verify.
      </div>
      <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer"
        style={{fontSize:11,color:"#128C7E",display:"inline-block",marginTop:8,textDecoration:"underline"}}>
        📖 Full CallMeBot documentation →
      </a>
    </div>

    {/* Config form */}
    <div style={S.card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>⚙️ Configuration</div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{fontSize:12,color:enabled?C.accent:C.muted,fontWeight:600}}>{enabled?"🟢 Enabled":"⚪ Disabled"}</span>
          <div onClick={()=>setEnabled(p=>!p)} style={{width:40,height:22,borderRadius:11,background:enabled?C.accent:"#cbd5e1",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:enabled?21:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <label style={S.lbl}>📞 WhatsApp Phone (with country code)</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+250788123456" style={S.inp}/>
        </div>
        <div>
          <label style={S.lbl}>🔑 CallMeBot API Key</label>
          <input value={apikey} onChange={e=>setApikey(e.target.value)} placeholder="1234567" type="password" style={S.inp}/>
        </div>
      </div>
      <div style={{display:"flex",gap:9}}>
        <button onClick={save} style={{...S.btn(C.accent),flex:1}}>💾 Save Settings</button>
        <button onClick={test} disabled={testing} style={{...S.btn("#128C7E")}}>
          {testing?<><span className="spin" style={{...S.loader,borderTopColor:"#fff"}}/>Testing…</>:"📨 Send Test Message"}
        </button>
      </div>
      {saveFeedback&&<div style={{marginTop:10,padding:"8px 12px",background:C.accentSoft,border:"1px solid rgba(22,163,74,.3)",borderRadius:7,fontSize:13,color:C.accent}}>{saveFeedback}</div>}
      {testStatus&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(37,211,102,.07)",border:"1px solid rgba(37,211,102,.3)",borderRadius:7,fontSize:12,color:C.muted,lineHeight:1.6}}>{testStatus}</div>}
    </div>

    {/* Alert preferences */}
    <div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>🔔 Alert Preferences</div>
      <div style={{fontSize:11,color:C.faint,marginBottom:12}}>Choose which events trigger a WhatsApp message:</div>
      {alertOptions.map(({key,icon,label})=>(
        <div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:prefs[key]?"rgba(22,163,74,.05)":C.elevated,borderRadius:8,marginBottom:7,border:"1px solid "+(prefs[key]?"rgba(22,163,74,.2)":C.border)}}>
          <span style={{fontSize:13,color:C.text}}>{icon} {label}</span>
          <div onClick={()=>setPrefs(p=>({...p,[key]:!p[key]}))} style={{width:36,height:20,borderRadius:10,background:prefs[key]?C.accent:"#cbd5e1",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
            <div style={{position:"absolute",top:2,left:prefs[key]?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
          </div>
        </div>
      ))}
      <button onClick={save} style={{...S.btn(C.accent),marginTop:4,width:"100%"}}>💾 Save Preferences</button>
    </div>

    {/* Status */}
    <div style={{...S.card,background:enabled&&phone&&apikey?"rgba(22,163,74,.04)":"rgba(245,158,11,.04)",border:"1px solid "+(enabled&&phone&&apikey?"rgba(22,163,74,.25)":"rgba(245,158,11,.3)")}}>
      <div style={{fontSize:12,color:C.muted}}>
        <b>Status:</b> {enabled&&phone&&apikey?"✅ WhatsApp alerts are active. FarmIQ will send you messages for selected events.":"⚠️ WhatsApp alerts are inactive. "+(!phone?"Enter your phone number. ":"")+(!apikey?"Enter your API key. ":"")+(!enabled?"Toggle 'Enabled' above. ":"")}
      </div>
    </div>

    {/* Worker WhatsApp Contacts */}
    <WorkerWAContacts/>
  </div>);
}

/* ═══════════════════════════════════════════════════
   SALARY ADVANCE MODULE
   Worker: request an advance (amount + reason + month)
   Admin : see all requests, approve or reject each one
   Approved advances auto-add as deduction on next salary
═══════════════════════════════════════════════════ */
const ADVANCE_REASONS=["Medical Emergency","School Fees","Rent","Travel","Family Emergency","Other"];
const ADVANCE_MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

function AdvanceManager({user,users,advances,setAdvances,salaries,setSalaries}){
  const isAdmin=isAdminUser(user);
  const now=new Date();
  const [tab,setTab]=useState(isAdmin?"pending":"request");
  const [toast,setToast]=useState(null);
  const [saving,setSaving]=useState(false);
  const defForm={amount:"",reason:ADVANCE_REASONS[0],notes:"",repayMonth:String(now.getMonth()+2>12?1:now.getMonth()+2),repayYear:String(now.getMonth()+2>12?now.getFullYear()+1:now.getFullYear())};
  const [form,setForm]=useState(defForm);

  function showToast(msg,type="success"){setToast({msg,type});setTimeout(()=>setToast(null),3800);}

  const myAdvances=(advances||[]).filter(a=>a.workerId===user.uid||a.workerId===user.id);
  const allPending=(advances||[]).filter(a=>a.status==="pending");
  const allApproved=(advances||[]).filter(a=>a.status==="approved");
  const allRejected=(advances||[]).filter(a=>a.status==="rejected");

  async function submitRequest(){
    if(!form.amount||parseFloat(form.amount)<=0){showToast("Enter a valid advance amount.","error");return;}
    setSaving(true);
    const rec={
      id:uid(),
      workerId:user.uid||user.id,
      workerName:user.name,
      amount:parseFloat(form.amount),
      reason:form.reason,
      notes:form.notes,
      repayMonth:parseInt(form.repayMonth),
      repayYear:parseInt(form.repayYear),
      status:"pending",
      requestedAt:new Date().toISOString(),
    };
    const updated=[...(advances||[]),rec];
    setAdvances(updated);
    try{await fsSet("advances",updated);}catch(e){}
    showToast("✅ Advance request submitted! Admin will review it shortly.");
    setForm(defForm);
    setTab("mylist");
    setSaving(false);
  }

  async function approve(id){
    const adv=(advances||[]).find(a=>a.id===id);
    if(!adv) return;
    const updated=(advances||[]).map(a=>a.id===id?{...a,status:"approved",approvedAt:new Date().toISOString(),approvedBy:user.name}:a);
    setAdvances(updated);
    try{await fsSet("advances",updated);}catch(e){}
    showToast(`✅ Advance approved for ${adv.workerName} — ${fmtRWF(adv.amount)}`);
  }

  async function reject(id,reason){
    const adv=(advances||[]).find(a=>a.id===id);
    if(!adv) return;
    const updated=(advances||[]).map(a=>a.id===id?{...a,status:"rejected",rejectedAt:new Date().toISOString(),rejectedBy:user.name,rejectionReason:reason||"Not approved"}:a);
    setAdvances(updated);
    try{await fsSet("advances",updated);}catch(e){}
    showToast(`❌ Advance rejected for ${adv.workerName}`,"error");
  }

  const adminTabs=[["pending","⏳ Pending ("+allPending.length+")"],["approved","✅ Approved"],["rejected","❌ Rejected"],["all","📋 All"]];
  const workerTabs=[["request","💸 Request Advance"],["mylist","📋 My Requests"]];
  const tabs=isAdmin?adminTabs:workerTabs;

  const statusBadge=(s)=>{
    if(s==="pending") return<span className="status-pending">⏳ Pending</span>;
    if(s==="approved") return<span className="status-paid">✅ Approved</span>;
    return<span className="status-overdue">❌ Rejected</span>;
  };

  const listToShow=isAdmin?(tab==="pending"?allPending:tab==="approved"?allApproved:tab==="rejected"?allRejected:(advances||[])):myAdvances;

  return(<div className="fade-in">
    {toast&&<div style={{position:"fixed",top:18,right:18,zIndex:9998,padding:"12px 20px",background:toast.type==="error"?"rgba(254,242,242,.98)":"rgba(240,253,244,.98)",border:"1px solid "+(toast.type==="error"?"rgba(252,165,165,.8)":"rgba(110,231,183,.8)"),borderRadius:12,fontWeight:700,fontSize:13,color:toast.type==="error"?"#dc2626":"#065f46",boxShadow:"0 8px 30px rgba(0,0,0,.15)"}}>{toast.msg}</div>}

    {/* Header banner */}
    <div style={{background:"linear-gradient(135deg,#0c1f18 0%,#122d20 55%,#0e2218 100%)",borderRadius:14,padding:"22px 24px",marginBottom:18,position:"relative",overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,.2)"}}>
      <div style={{position:"absolute",top:-40,right:-30,width:160,height:160,background:"radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 65%)",pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:4}}>💸 Salary Advance</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{isAdmin?"Review and manage worker advance requests":"Request an advance on your salary"}</div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[{l:"Pending",v:allPending.length,c:"#fbbf24"},{l:"Approved",v:allApproved.length,c:"#4ade80"},{l:"Rejected",v:allRejected.length,c:"#f87171"}].map(x=>(
            <div key={x.l} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.14)",borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:70}}>
              <div style={{fontSize:9,color:x.c,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{x.l}</div>
              <div style={{fontSize:20,fontWeight:800,color:x.c}}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",background:"#f1f5f9",borderRadius:10,padding:3,marginBottom:18,gap:3,border:"1px solid #e2e8f0",flexWrap:"wrap"}}>
      {tabs.map(([t,l])=>(
        <button key={t} onClick={()=>setTab(t)} style={{...S.tab(tab===t),flex:1,borderRadius:8,fontSize:12,padding:"8px 10px"}}>{l}</button>
      ))}
    </div>

    {/* ── WORKER: REQUEST FORM ── */}
    {!isAdmin&&tab==="request"&&(<div style={{maxWidth:540}}>
      <div style={{...S.card,border:"1px solid rgba(99,102,241,.2)",background:"linear-gradient(135deg,rgba(99,102,241,.04),rgba(124,58,237,.02))"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#6366f1",marginBottom:4}}>💸 Request Salary Advance</div>
        <div style={{fontSize:12,color:C.faint,marginBottom:18}}>Your request will be reviewed by the admin. Approved advances are deducted from your future salary.</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>💵 Advance Amount (RWF) *</label>
            <input type="number" min="0" placeholder="e.g. 30000" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>📋 Reason for Advance *</label>
            <select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} style={S.inp}>
              {ADVANCE_REASONS.map(r=><option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>📅 Repay from Month</label>
            <select value={form.repayMonth} onChange={e=>setForm({...form,repayMonth:e.target.value})} style={S.inp}>
              {ADVANCE_MONTHS.map((m,i)=><option key={i+1} value={String(i+1)}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Year</label>
            <input type="number" min="2024" max="2030" value={form.repayYear} onChange={e=>setForm({...form,repayYear:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>📝 Additional Notes (optional)</label>
            <textarea rows={2} placeholder="Any extra details for the admin…" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{...S.inp,resize:"vertical"}}/>
          </div>
        </div>

        {form.amount&&parseFloat(form.amount)>0&&<div style={{padding:"12px 16px",background:"rgba(99,102,241,.07)",border:"1.5px solid rgba(99,102,241,.2)",borderRadius:10,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#6366f1",marginBottom:6}}>📄 Request Preview</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}>
            <span style={{color:C.muted}}>Advance Amount</span>
            <span style={{fontWeight:700,color:"#6366f1"}}>{fmtRWF(parseFloat(form.amount)||0)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.faint}}>
            <span>Repayment target</span>
            <span>{ADVANCE_MONTHS[(parseInt(form.repayMonth)||1)-1]} {form.repayYear}</span>
          </div>
          <div style={{marginTop:8,fontSize:11,color:C.faint}}>Admin will review and approve or reject this request.</div>
        </div>}

        <button onClick={submitRequest} disabled={saving||!form.amount||parseFloat(form.amount)<=0}
          style={{...S.btn("#6366f1"),width:"100%",padding:13,fontSize:14,fontWeight:700,opacity:saving||!form.amount?0.55:1}}>
          {saving?"⏳ Submitting…":"💸 Submit Advance Request →"}
        </button>
      </div>
    </div>)}

    {/* ── WORKER: MY REQUESTS LIST ── */}
    {!isAdmin&&tab==="mylist"&&(<div>
      {myAdvances.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:36,marginBottom:8}}>💸</div>
        <div style={{fontWeight:600,fontSize:14}}>No advance requests yet</div>
        <div style={{fontSize:12,marginTop:4}}>Use the "Request Advance" tab to apply.</div>
      </div>}
      {myAdvances.slice().reverse().map(a=>(
        <div key={a.id} className="card-hover" style={{...S.card,marginBottom:10,borderLeft:"4px solid "+(a.status==="approved"?C.accent:a.status==="rejected"?C.red:C.amber)}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:15,color:C.text}}>{fmtRWF(a.amount)}</span>
                {statusBadge(a.status)}
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:3}}>📋 {a.reason}</div>
              <div style={{fontSize:11,color:C.faint}}>Requested: {a.requestedAt?.slice(0,10)} · Repay: {ADVANCE_MONTHS[(a.repayMonth||1)-1]} {a.repayYear}</div>
              {a.notes&&<div style={{fontSize:11,color:C.muted,marginTop:4,fontStyle:"italic"}}>📝 "{a.notes}"</div>}
              {a.status==="approved"&&<div style={{fontSize:11,color:C.accent,marginTop:4}}>✅ Approved on {a.approvedAt?.slice(0,10)} by {a.approvedBy}</div>}
              {a.status==="rejected"&&<div style={{fontSize:11,color:C.red,marginTop:4}}>❌ Rejected: {a.rejectionReason||"Not approved"}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>)}

    {/* ── ADMIN: PENDING / APPROVED / ALL LIST ── */}
    {isAdmin&&(tab==="pending"||tab==="approved"||tab==="rejected"||tab==="all")&&(<div>
      {listToShow.length===0&&<div style={{...S.card,textAlign:"center",padding:40,color:C.faint}}>
        <div style={{fontSize:36,marginBottom:8}}>{tab==="pending"?"⏳":"📋"}</div>
        <div style={{fontWeight:600,fontSize:14}}>{tab==="pending"?"No pending advance requests":"No records in this category"}</div>
      </div>}
      {listToShow.slice().reverse().map(a=>{
        const [rejectReason,setRejectReason]=[null,()=>{}]; // placeholder
        return(<AdvanceAdminCard key={a.id} adv={a} onApprove={()=>approve(a.id)} onReject={(r)=>reject(a.id,r)}/>);
      })}
    </div>)}
  </div>);
}

function AdvanceAdminCard({adv,onApprove,onReject}){
  const [rejecting,setRejecting]=useState(false);
  const [reason,setReason]=useState("");
  const borderCol=adv.status==="approved"?C.accent:adv.status==="rejected"?C.red:C.amber;
  return(<div className="card-hover" style={{...S.card,marginBottom:10,borderLeft:"4px solid "+borderCol}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontSize:14,color:C.text}}>👷 {adv.workerName}</span>
          <span style={{fontWeight:800,fontSize:15,color:"#6366f1"}}>{fmtRWF(adv.amount)}</span>
          {adv.status==="pending"&&<span className="status-pending">⏳ Pending</span>}
          {adv.status==="approved"&&<span className="status-paid">✅ Approved</span>}
          {adv.status==="rejected"&&<span className="status-overdue">❌ Rejected</span>}
        </div>
        <div style={{fontSize:12,color:C.muted,marginBottom:2}}>📋 Reason: <strong>{adv.reason}</strong></div>
        <div style={{fontSize:11,color:C.faint}}>Requested: {adv.requestedAt?.slice(0,10)} · Repay by: {ADVANCE_MONTHS[(adv.repayMonth||1)-1]} {adv.repayYear}</div>
        {adv.notes&&<div style={{fontSize:11,color:C.muted,marginTop:4,fontStyle:"italic"}}>📝 "{adv.notes}"</div>}
        {adv.status==="approved"&&<div style={{fontSize:11,color:C.accent,marginTop:4}}>✅ Approved {adv.approvedAt?.slice(0,10)} by {adv.approvedBy}</div>}
        {adv.status==="rejected"&&<div style={{fontSize:11,color:C.red,marginTop:4}}>Reason: {adv.rejectionReason}</div>}
      </div>
      {adv.status==="pending"&&<div style={{display:"flex",flexDirection:"column",gap:7,flexShrink:0}}>
        <button onClick={onApprove} style={{...S.btn(C.accent),fontSize:12,padding:"7px 16px",borderRadius:9}}>✅ Approve</button>
        <button onClick={()=>setRejecting(r=>!r)} style={{padding:"7px 16px",borderRadius:9,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>❌ Reject</button>
      </div>}
    </div>
    {rejecting&&<div style={{marginTop:12,padding:"12px 14px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.2)",borderRadius:9}}>
      <div style={{fontSize:12,fontWeight:700,color:C.red,marginBottom:8}}>Reason for rejection (optional)</div>
      <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Advance limit reached, insufficient balance…" style={{...S.inp,marginBottom:8}}/>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>{onReject(reason);setRejecting(false);}} style={{...S.btn(C.red),fontSize:12,padding:"7px 14px"}}>Confirm Reject</button>
        <button onClick={()=>setRejecting(false)} style={{padding:"7px 12px",borderRadius:7,border:"1px solid "+C.border,background:C.elevated,color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   SALARY & PAYMENT MODULE  v2
   Admin : schedule salaries, add deductions & bonuses,
           mark paid (auto-expense + capital deduct)
   Worker: full payslip breakdown — every line item visible
   Net Pay = Gross + Bonuses − Deductions
