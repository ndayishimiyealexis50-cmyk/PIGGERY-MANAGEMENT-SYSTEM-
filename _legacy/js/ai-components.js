function PDFBtn({label,type,getData,icon,color}){
  const [busy,setBusy]=useState(false);
  function go(){setBusy(true);try{downloadPDF(type,getData(),label);}catch(e){alert("PDF error: "+e.message);}setBusy(false);}
  return(<button style={{...S.btn(color||C.purple),display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"7px 13px"}} onClick={go} disabled={busy}>{busy?<span className="spin" style={S.loader}/>:<span>{icon||"📄"}</span>}{busy?"Opening…":label}</button>);
}

/* ─── AI Prediction ─── */
/* ─── AI Error Display Helper ─── */
function AIErrorMsg({source,text,onSetKey}){
  if(source==="no_key") return(<div style={{padding:"11px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:8,fontSize:13,color:C.amber}}>
    🔑 No API key set. <button onClick={onSetKey} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontWeight:700,fontSize:13,padding:0,fontFamily:"inherit",textDecoration:"underline"}}>Click here to add your Groq API key</button> to enable live AI.
  </div>);
  if(source==="auth_error") return(<div style={{padding:"11px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,fontSize:13,color:C.red}}>
    🔑 Invalid API key. <button onClick={onSetKey} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontWeight:700,fontSize:13,padding:0,fontFamily:"inherit",textDecoration:"underline"}}>Update your key</button>
  </div>);
  if(source==="timeout") return(<div style={{padding:"11px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,fontSize:13,color:C.red}}>⏱️ Request timed out. Check your internet connection and try again.</div>);
  if(source==="network") return(<div style={{padding:"11px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,fontSize:13,color:C.red}}>🌐 Network error. Make sure you're connected to the internet.</div>);
  if(source==="api_error") return(<div style={{padding:"11px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,fontSize:13,color:C.red}}>⚠️ API error: {text?.replace("__API_ERROR__:","")}</div>);
  return null;
}

/* ─── API Key Modal ─── */
function ApiKeyModal({onClose}){
  const [val,setVal]=useState(getApiKey());
  const [saved,setSaved]=useState(false);
  function save(){if(!val.trim())return;setApiKey(val.trim());setSaved(true);setTimeout(()=>{setSaved(false);onClose();},1200);}
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"#fff",border:"1px solid "+C.border,borderRadius:18,padding:28,width:430,boxShadow:"0 28px 70px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.07)"}}>
      <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>🔑 Groq API Key (Free)</div>
      <div style={{fontSize:12,color:C.faint,marginBottom:16,lineHeight:1.6}}>
        Your free Groq key is stored only in this browser and sent directly to Groq. It never goes through any third-party server.
        <br/><a href="https://aistudio.Groq.com/app/apikey" target="_blank" rel="noreferrer" style={{color:C.accent}}>Get your FREE key at aistudio.Groq.com →</a>
      </div>
      <input value={val} onChange={e=>setVal(e.target.value)} placeholder="sk-ant-..." type="password" style={{...{background:"#fff",border:"1px solid #cbd5e1",color:C.text,borderRadius:8,padding:"10px 13px",width:"100%",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},marginBottom:12}}/>
      {saved&&<div style={{padding:"8px 12px",background:C.accentSoft,border:"1px solid rgba(22,163,74,.3)",borderRadius:7,fontSize:13,color:C.accent,marginBottom:10}}>✅ Key saved! AI is now active.</div>}
      <div style={{display:"flex",gap:9}}>
        <button onClick={save} style={{...{padding:"9px 18px",borderRadius:8,border:"none",background:C.accent,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"},flex:1}}>Save Key</button>
        {getApiKey()&&<button onClick={()=>{setApiKey("");onClose();}} style={{padding:"9px 14px",borderRadius:8,border:"1px solid rgba(239,68,68,.4)",background:"rgba(239,68,68,.06)",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Remove Key</button>}
        <button onClick={onClose} style={{padding:"9px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.elevated,color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  </div>);
}

/* ─── AI Status Pill ─── */
function AIStatusPill({onSetKey}){
  const hasKey=!!getApiKey();
  return(<button onClick={onSetKey} title={hasKey?"AI active — click to manage key":"Set API key to enable AI"} style={{padding:"4px 12px",borderRadius:20,border:"1px solid "+(hasKey?"rgba(22,163,74,.35)":"rgba(245,158,11,.45)"),background:hasKey?"rgba(22,163,74,.07)":"rgba(245,158,11,.07)",color:hasKey?C.accent:C.amber,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,transition:"all .18s",letterSpacing:.2}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:hasKey?C.accent:C.amber,display:"inline-block"}}/>
    {hasKey?"✦ AI Online":"🔑 Set API Key"}
  </button>);
}

function AIPrediction({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,topic,label,icon,autoRun}){
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const [showKeyModal,setShowKeyModal]=useState(false);

  async function predict(){
    if(loading||done)return;
    setLoading(true);setResult(null);
    const active=pigs.filter(p=>p.status==="active");
    const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
    const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);
    const sick=logs.reduce((s,l)=>s+(l.sick||0),0);
    const deaths=logs.reduce((s,l)=>s+(l.deaths||0),0);
    const stages=active.reduce((a,p)=>{a[p.stage]=(a[p.stage]||0)+1;return a;},{});
    const pregnant=(reproductions||[]).filter(r=>r.status==="pregnant").length;
    const herdVal=active.reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);
    const lowStock=(stock||[]).filter(s=>s.quantity<=s.minLevel).map(s=>s.name).join(", ")||"none";
    const ctx=`Expert pig farm advisor Rwanda. active=${active.length} stages=${JSON.stringify(stages)} income=${Math.round(totalInc)} expenses=${Math.round(totalExp)} profit=${Math.round(totalInc-totalExp)} sick=${sick} deaths=${deaths} pregnant_sows=${pregnant} herd_market_value=${Math.round(herdVal)} low_stock=${lowStock} sales=${sales.length} logs=${logs.length}. Topic: ${topic}. Give 5-7 Rwanda-specific bullet points. Use RWF. Today is ${toDay()}.`;
    const res=await askAI(ctx,{});
    setResult(res);setLoading(false);
    if(res.source!=="no_key"&&res.source!=="auth_error"&&res.source!=="timeout"&&res.source!=="network"&&res.source!=="api_error")setDone(true);
  }

  useEffect(()=>{if(autoRun&&getApiKey())predict();},[]);

  const isError=result&&["no_key","auth_error","timeout","network","api_error","empty"].includes(result.source);
  return(<div style={S.aiCard} className="ai-glow fade-in">
    {showKeyModal&&<ApiKeyModal onClose={()=>{setShowKeyModal(false);}}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:17}}>{icon}</span>
        <span style={{fontWeight:600,fontSize:14,color:C.text}}>{label}</span>
      </div>
      <AIStatusPill onSetKey={()=>setShowKeyModal(true)}/>
    </div>
    {!done&&!loading&&!isError&&<button style={{...S.btn("#16a34a"),fontSize:12,padding:"7px 16px",borderRadius:20,letterSpacing:.3}} onClick={predict}>✦ Generate Insight</button>}
    {loading&&<div style={{display:"flex",alignItems:"center",gap:10,color:C.accent,fontSize:13}}><span className="spin" style={S.loader}></span>Asking Groq AI online…</div>}
    {isError&&<><AIErrorMsg source={result.source} text={result.text} onSetKey={()=>setShowKeyModal(true)}/><button style={{...S.btn("#166534"),fontSize:11,padding:"5px 11px",marginTop:8}} onClick={()=>{setResult(null);setDone(false);predict();}}>Retry →</button></>}
    {done&&result&&result.source==="ai"&&<div style={{fontSize:13,color:C.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.text}</div>}
  </div>);
}

/* ─── AI Chat ─── */
function AIAdvisor({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock}){
  const [q,setQ]=useState("");
  const [chat,setChat]=useState([]);
  const [loading,setLoading]=useState(false);
  const [showKeyModal,setShowKeyModal]=useState(false);
  const ref=useRef(null);
  const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);

  async function send(){
    if(!q.trim()||loading)return;
    const question=q.trim();setQ("");
    setChat(c=>[...c,{role:"user",text:question}]);setLoading(true);
    const herdVal=pigs.filter(p=>p.status==="active").reduce((s,pig)=>s+getMarketPrice(pig.stage,pig.weight),0);
    const pregnant=(reproductions||[]).filter(r=>r.status==="pregnant").length;
    const ctx=`FarmIQ AI Rwanda pig farm advisor. Farm snapshot: ${pigs.filter(p=>p.status==="active").length} active pigs, income=${fmtRWF(totalInc)}, expenses=${fmtRWF(totalExp)}, profit=${fmtRWF(totalInc-totalExp)}, herd_value=${fmtRWF(herdVal)}, pregnant_sows=${pregnant}, today=${toDay()}. Worker question: "${question}". Give practical, specific advice for Rwanda pig farming. Use RWF for money.`;
    const res=await askAI(ctx,{});
    setChat(c=>[...c,{role:"ai",...res}]);setLoading(false);
  }

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[chat,loading]);
  const quickQ=["Predict my profit next 30 days","Which pigs should I sell first?","When should I breed my sows?","Best time to sell in Rwanda?","How to reduce feed costs?","What disease risks this season?"];
  const hasKey=!!getApiKey();

  return(<div>
    {showKeyModal&&<ApiKeyModal onClose={()=>setShowKeyModal(false)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,rgba(22,163,74,.12),rgba(22,163,74,.06))",border:"1px solid rgba(22,163,74,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🤖</div><div><div style={S.h1}>AI Farm Advisor</div><div style={S.sub}>Live AI Advisor (Groq) — ask anything about your farm</div></div></div>
      <AIStatusPill onSetKey={()=>setShowKeyModal(true)}/>
    </div>

    {!hasKey&&<div style={{padding:"13px 16px",background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.3)",borderRadius:10,marginBottom:14,fontSize:13,color:C.amber}}>
      🔑 Add your free Groq API key to enable AI. <button onClick={()=>setShowKeyModal(true)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontWeight:700,fontSize:13,padding:0,fontFamily:"inherit",textDecoration:"underline"}}>Set Groq Key →</button>
    </div>}

    <div style={{...S.card,display:"flex",flexDirection:"column"}}>
      <div style={{minHeight:280,maxHeight:420,overflowY:"auto",marginBottom:14}}>
        {chat.length===0&&<div style={{textAlign:"center",padding:"36px 16px"}}>
          <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,rgba(22,163,74,.1),rgba(22,163,74,.05))",border:"1px solid rgba(22,163,74,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,marginBottom:12,animation:"float 3s ease-in-out infinite"}}>🧠</div>
          <div style={{color:C.muted,fontSize:13,marginBottom:6,fontWeight:600}}>Ask your AI farm advisor anything</div>
          <div style={{color:C.faint,fontSize:12,marginBottom:16}}>Get insights on profit, breeding, market prices and more.</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center"}}>
            {quickQ.map(qq=><button key={qq} onClick={()=>setQ(qq)} style={{padding:"6px 13px",borderRadius:20,border:"1px solid rgba(22,163,74,.25)",background:"rgba(22,163,74,.05)",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,transition:"all .15s",letterSpacing:.1}}>{qq}</button>)}
          </div>
        </div>}
        {chat.map((m,i)=>{
          const isErr=m.role==="ai"&&m.source&&m.source!=="ai";
          return(<div key={i} className="fade-in" style={{marginBottom:12,display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-start"}}>
            {m.role==="ai"&&<div style={{width:27,height:27,borderRadius:"50%",background:"rgba(22,163,74,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,marginRight:9,flexShrink:0}}>🤖</div>}
            <div style={{maxWidth:"76%"}}>
              {m.role==="ai"&&<div style={{fontSize:10,color:isErr?C.amber:C.accent,marginBottom:3,fontWeight:600}}>{isErr?"⚠️ Error":"✦ Groq AI · Live"}</div>}
              {isErr
                ?<AIErrorMsg source={m.source} text={m.text} onSetKey={()=>setShowKeyModal(true)}/>
                :<div style={{padding:"11px 14px",borderRadius:12,background:m.role==="user"?"linear-gradient(135deg,#dbeafe,#bfdbfe)":"linear-gradient(135deg,#f7faf7,#f0fdf4)",border:"1px solid "+(m.role==="user"?"rgba(147,197,253,.6)":"rgba(22,163,74,.12)"),fontSize:13,color:C.text,lineHeight:1.75,whiteSpace:"pre-wrap",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>{m.text}</div>
              }
            </div>
            {m.role==="user"&&<div style={{width:27,height:27,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,marginLeft:9,flexShrink:0,color:"#fff",fontWeight:700}}>U</div>}
          </div>);
        })}
        {loading&&<div style={{display:"flex",alignItems:"center",gap:9,color:C.accent,fontSize:13,paddingLeft:36}}><span className="spin" style={S.loader}></span>AI is thinking…</div>}
        <div ref={ref}/>
      </div>
      <div style={{display:"flex",gap:9}}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={hasKey?"Ask about profit, breeding, market prices, health…":"Set your API key first to chat with AI…"} style={{...{background:"#fff",border:"1px solid #cbd5e1",color:C.text,borderRadius:8,padding:"9px 12px",width:"100%",fontSize:13,fontFamily:"inherit",outline:"none",transition:"border-color .2s"},flex:1}} disabled={!hasKey}/>
        <button style={{...S.btn(),flexShrink:0,padding:"9px 18px"}} onClick={send} disabled={loading||!hasKey}>Send →</button>
      </div>
    </div>
  </div>);
}

/* ─── PigHealthAI ─── */
function PigHealthAI({pig,logs}){
  const [result,setResult]=useState(null);const [loading,setLoading]=useState(false);const [open,setOpen]=useState(false);
  async function run(){
    if(loading)return;
    if(!getApiKey()){setResult({source:"no_key",text:""});setOpen(true);return;}
    setLoading(true);setOpen(true);
    const res=await askAI(`Rwanda pig vet advisor. Pig: ${pig.tag} ${pig.breed} ${pig.gender} ${pig.stage} ${pig.weight}kg DOB=${pig.dob||"unknown"}. Total sick log entries for farm: ${logs.filter(l=>l.sick>0).length}. Give: 1) health risk assessment, 2) 3 specific care tips, 3) estimated market value = ${fmtRWF(getMarketPrice(pig.stage,pig.weight))} and whether to sell now or wait. Be concise.`,{});
    setResult(res);setLoading(false);
  }
  const isErr=result&&result.source!=="ai";
  return(<div style={{marginTop:9}}>
    <button onClick={run} style={{width:"100%",padding:6,borderRadius:7,border:"1px solid rgba(22,163,74,.3)",background:C.elevated,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{loading?"Claude analyzing…":"🤖 AI Health Check →"}</button>
    {open&&isErr&&<div style={{marginTop:7,fontSize:11,color:C.amber,padding:"6px 10px",background:"rgba(245,158,11,.07)",borderRadius:6,border:"1px solid rgba(245,158,11,.25)"}}>{result.source==="no_key"?"🔑 Set API key (sidebar) to use AI health checks.":result.source==="auth_error"?"🔑 Invalid API key.":"⚠️ "+result.source}</div>}
    {open&&result&&result.source==="ai"&&<div style={{marginTop:7,padding:"9px 11px",background:"#f0fdf4",borderRadius:7,border:"1px solid rgba(22,163,74,.2)",fontSize:11,color:C.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{result.text}</div>}
  </div>);
}

/* ─── REPRODUCTION MODULE ─── */
