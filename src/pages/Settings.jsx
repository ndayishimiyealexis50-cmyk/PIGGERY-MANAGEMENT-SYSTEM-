import React, { useState, useEffect } from "react";
const toDay = () => new Date().toISOString().slice(0,10);
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


export default WhatsAppSettings;
