const {useState,useEffect,useRef,useCallback,useMemo}=React;
const uid=()=>Math.random().toString(36).slice(2,10);
const toDay=()=>new Date().toISOString().slice(0,10);

/* ─── Auto Pig Tag Generator ───────────────────────────────────────────────
   Format:  [BREED_CODE]-[STAGE_CODE]-[YYMM]-[SEQ]
   Examples:
     Landrace Sow registered Mar 2025, 3rd of that type → LR-S-2503-003
     Large White / Duroc (mixed) Grower → LW-D-GR-2503-001
     Mixed/Local Boar → ML-B-2503-002
   Rules:
     • Pure breed  : first 2 letters of breed (capitalised)
     • Mixed breed : first letters of EACH breed in the mix, separated by -
     • Mixed/Local : ML
     • Stage code  : P=Piglet W=Weaner G=Grower F=Finisher GL=Gilt S=Sow B=Boar
     • Sequence    : count of existing pigs with same breed+stage combo, +1
──────────────────────────────────────────────────────────────────────────── */
const STAGE_CODE={Piglet:"P",Weaner:"W",Grower:"G",Finisher:"F",Gilt:"GL",Sow:"S",Boar:"B"};
function breedCode(breed){
  if(!breed) return "XX";
  const b=breed.trim();
  // Mixed/Local shorthand
  if(b==="Mixed/Local") return "ML";
  // Detect slash-separated mix e.g. "Landrace/Duroc"
  if(b.includes("/")){
    return b.split("/").map(p=>p.trim().slice(0,2).toUpperCase()).join("-");
  }
  // Detect space-separated mix e.g. "Landrace Duroc cross"
  const words=b.split(/\s+/).filter(w=>w.length>2);
  if(words.length>=2){
    // Only use the first two meaningful words
    return words.slice(0,2).map(w=>w.slice(0,2).toUpperCase()).join("-");
  }
  return b.slice(0,2).toUpperCase();
}
function genPigTag(breed,stage,existingPigs){
  const now=new Date();
  const yymm=String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,"0");
  const sc=STAGE_CODE[stage]||"X";
  const bc=breedCode(breed);
  // Count existing pigs with same breed+stage as sequence seed
  const sameType=(existingPigs||[]).filter(p=>
    breedCode(p.breed)===bc && (STAGE_CODE[p.stage]||"X")===sc
  ).length;
  const seq=String(sameType+1).padStart(3,"0");
  return `${bc}-${sc}-${yymm}-${seq}`;
}
const fmtRWF=(n)=>"RWF "+Math.round(n||0).toLocaleString();
const fmtNum=(n)=>Math.round(n||0).toLocaleString();

/* ─── CallMeBot WhatsApp Integration ──────────────────────────────────────
   Sends WhatsApp messages via CallMeBot free API.
   Setup: https://www.callmebot.com/blog/free-api-whatsapp-messages/
   User must first activate their number by messaging CallMeBot on WhatsApp.
──────────────────────────────────────────────────────────────────────────── */
function getWAConfig(){
  try{return JSON.parse(localStorage.getItem("farmiq_wa_config")||"{}");}
  catch{return {};}
}
function setWAConfig(cfg){
  localStorage.setItem("farmiq_wa_config",JSON.stringify(cfg));
}
async function sendWhatsApp(message){
  const {phone,apikey,enabled}=getWAConfig();
  if(!enabled||!phone||!apikey) return {ok:false,reason:"not_configured"};
  const url=`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  try{
    // Use no-cors (fire-and-forget) — CallMeBot doesn't support CORS headers
    await fetch(url,{method:"GET",mode:"no-cors"});
    return {ok:true};
  }catch(e){
    return {ok:false,reason:e.message};
  }
}
function isWAEnabled(){const c=getWAConfig();return !!(c.enabled&&c.phone&&c.apikey);}
function getWorkerWAContacts(){
  try{return JSON.parse(localStorage.getItem("farmiq_wa_workers")||"[]");}
  catch{return [];}
}
function setWorkerWAContacts(list){
  localStorage.setItem("farmiq_wa_workers",JSON.stringify(list));
}
async function sendWhatsAppToNumber(phone,apikey,message){
  const url=`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  try{await fetch(url,{method:"GET",mode:"no-cors"});return true;}catch{return false;}
}
function getWAAlertPrefs(){
  const c=getWAConfig();
  return{
    onSickPig:    c.onSickPig    !==false,
    onDeath:      c.onDeath      !==false,
    onSale:       c.onSale       !==false,
    onLowStock:   c.onLowStock   !==false,
    onFarrowingSoon: c.onFarrowingSoon!==false,
    onLoss:       c.onLoss       !==false,
  };
}

/* ─── Capital Helpers ─── */

// ══════════════════════════════════════════════════════════
// CAPITAL BALANCE = Initial + Sales + Other Income
//                  - Feed Costs - Other Expenses
// 100% derived from actual data arrays. ZERO dependency on
// capital.transactions — so no stale/orphaned data can ever
// affect the balance again.
// ══════════════════════════════════════════════════════════
function calcCapitalBalance(capital, feeds, sales, expenses, incomes){
  const ok=x=>x.approved!==false;
  const initial = capital.initial || 0;
  const saleInc  = (sales   ||[]).filter(ok).reduce((s,x)=>s+(x.total   ||0),0);
  const otherInc = (incomes  ||[]).filter(ok).reduce((s,x)=>s+(x.amount  ||0),0);
  const feedExp  = (feeds    ||[]).filter(ok).reduce((s,x)=>s+(x.cost    ||0),0);
  const otherExp = (expenses ||[]).filter(ok).reduce((s,x)=>s+(x.amount  ||0),0);
  return initial + saleInc + otherInc - feedExp - otherExp;
}

// Purge orphaned capital transactions whose refId no longer maps to a real record.
// Call this after any delete to keep capital.transactions clean.
function purgeOrphanedCapitalTx(capital, setCapital, feeds, sales, expenses, logs){
  const validFeedIds  = new Set((feeds   ||[]).map(x=>"feed_"      +x.id));
  const validSaleIds  = new Set((sales   ||[]).map(x=>"sale_"      +x.id));
  const validExpIds   = new Set((expenses||[]).map(x=>"exp_"       +x.id));
  const validLogIds   = new Set((logs    ||[]).map(x=>"deathloss_" +x.id));
  const clean = (capital.transactions||[]).filter(t=>{
    if(!t.refId) return true; // keep manual entries
    if(t.refId.startsWith("feed_"))       return validFeedIds.has(t.refId);
    if(t.refId.startsWith("sale_"))       return validSaleIds.has(t.refId);
    if(t.refId.startsWith("exp_"))        return validExpIds.has(t.refId);
    if(t.refId.startsWith("deathloss_"))  return validLogIds.has(t.refId);
    return true; // unknown refId pattern → keep to be safe
  });
  if(clean.length !== (capital.transactions||[]).length){
    setCapital(prev=>({...prev, transactions:clean}));
  }
}

// Add a capital transaction with dedup guard via refId
function capitalTx(capital,setCapital,{type,category,amount,description,date,refId}){
  const amt=Math.round(parseFloat(amount)||0);
  if(amt<=0) return null;
  if(refId){
    const existing=(capital.transactions||[]).find(t=>t.refId===refId);
    if(existing) return existing;
  }
  const tx={id:Math.random().toString(36).slice(2,10),type,category,amount:amt,description:description||"",date:date||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),refId:refId||null};
  setCapital(prev=>({...prev,transactions:[...(prev.transactions||[]),tx]}));
  return tx;
}

// P&L — same source of truth as calcCapitalBalance (actual data arrays)
function calcPnL(capital,feeds,sales,expenses,incomes){
  const ok=x=>x.approved!==false; // undefined (old data) = approved; false = pending
  const totalInc=sales.filter(ok).reduce((s,l)=>s+(l.total||0),0)+incomes.filter(ok).reduce((s,l)=>s+(l.amount||0),0);
  const totalExp=feeds.filter(ok).reduce((s,l)=>s+(l.cost||0),0)+expenses.filter(ok).reduce((s,l)=>s+(l.amount||0),0);
  return{totalInc,totalExp,profit:totalInc-totalExp};
}

/* ─── Initial Data ─── */
const INIT_USERS=[];
const INIT_PIGS=[
  {id:"p1",tag:"RW-001",breed:"Landrace",gender:"Female",stage:"Sow",weight:120,status:"active",dob:"2022-03-10"},
  {id:"p2",tag:"RW-002",breed:"Large White",gender:"Male",stage:"Boar",weight:145,status:"active",dob:"2021-11-05"},
  {id:"p3",tag:"RW-003",breed:"Duroc",gender:"Female",stage:"Gilt",weight:85,status:"active",dob:"2023-06-20"},
];
const INIT_STOCK=[
  {id:"st1",name:"Maize Bran",category:"Feed",quantity:200,unit:"kg",minLevel:50,costPerUnit:350,lastUpdated:toDay()},
  {id:"st2",name:"Soya Meal",category:"Feed",quantity:50,unit:"kg",minLevel:20,costPerUnit:800,lastUpdated:toDay()},
  {id:"st3",name:"Pellets",category:"Feed",quantity:30,unit:"kg",minLevel:15,costPerUnit:950,lastUpdated:toDay()},
  {id:"st4",name:"Ivermectin",category:"Medicine",quantity:10,unit:"doses",minLevel:5,costPerUnit:2000,lastUpdated:toDay()},
  {id:"st5",name:"CSF Vaccine",category:"Vaccine",quantity:20,unit:"doses",minLevel:10,costPerUnit:1500,lastUpdated:toDay()},
  {id:"st6",name:"ORS Sachets",category:"Medicine",quantity:15,unit:"pcs",minLevel:5,costPerUnit:500,lastUpdated:toDay()},
];
const EXPENSE_CATS=["Feed Purchase","Pig Purchase","Veterinary","Medicine","Equipment","Labour","Transport","Utilities","Maintenance","Other"];
const INCOME_CATS=["Pig Sale","Piglet Sale","Manure Sale","Other Income"];

/* ─── Rwanda Market Prices ─── */
const RW_BASE_PRICES={
  Piglet:  {base:10000,unit:"head",desc:"Under 10kg",trend:"stable"},
  Weaner:  {base:32000,unit:"head",desc:"10–25kg",trend:"up"},
  Grower:  {base:57000,unit:"head",desc:"25–50kg",trend:"up"},
  Finisher:{base:105000,unit:"head",desc:"50–80kg",trend:"stable"},
  Gilt:    {base:135000,unit:"head",desc:"Young female",trend:"up"},
  Sow:     {base:210000,unit:"head",desc:"Breeding female",trend:"stable"},
  Boar:    {base:240000,unit:"head",desc:"Breeding male",trend:"stable"},
  heavy:   {base:2600,unit:"kg",desc:"Over 80kg",trend:"up"},
};
const MARKETS=["Kimironko Market, Kigali","Nyabugogo Market, Kigali","Musanze Livestock Market","Huye Market","Muhanga Market"];

function getDailyVariance(){
  const d=new Date();
  const seed=(d.getDate()*17+d.getMonth()*31)%100;
  return 1+((seed-50)/800);
}
function getMarketPrice(stage,weight){
  // Try survey prices first (set by admin from field visits)
  try{
    const surveys=JSON.parse(localStorage.getItem("farmiq_market_surveys")||"[]");
    if(surveys.length>0){
      const latest=surveys.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
      if(latest&&latest.prices){
        if(weight>=80&&latest.prices.heavy) return Math.round(weight*latest.prices.heavy);
        if(latest.prices[stage]) return latest.prices[stage];
      }
    }
  }catch(e){}
  // Fall back to built-in estimates with daily variance
  const v=getDailyVariance();
  if(weight>=80) return Math.round(weight*(RW_BASE_PRICES.heavy.base*v));
  const p=RW_BASE_PRICES[stage];
  return p?Math.round(p.base*v):Math.round(weight*1800*v);
}
function addDays(dateStr,n){
  if(!dateStr)return "";
  const d=new Date(dateStr);
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function daysDiff(dateStr){
  if(!dateStr)return 999;
  return Math.round((new Date(dateStr)-new Date())/(1000*60*60*24));
}
const GESTATION=114;
const HEAT_CYCLE=21;

/* ═══════════════════════════════════════════════════
   FIREBASE FIRESTORE STORAGE SYSTEM
   Two documents in "farmiq" collection:
     • farmiq/farm   — all farm data
     • farmiq/users  — user list
   Offline-first: localStorage cache + Firestore sync
═══════════════════════════════════════════════════ */
const FS_FARM_DOC  = _db.collection("farmiq").doc("farm");
const FS_USERS_DOC = _db.collection("farmiq").doc("users");

/* ── localStorage cache keys ── */
const LS_FARM  = "farmiq_local_farm";
const LS_USERS = "farmiq_local_users";

/* ── Sync status (keeps existing useSyncStatus hook working) ── */
window._offlineStatus = {online: navigator.onLine, queueLen: 0, syncing: false, lastSync: ""};
window._syncListeners = new Set();
function _notifySyncListeners(){window._syncListeners.forEach(fn=>{try{fn({...window._offlineStatus});}catch(e){}});}
window.addEventListener("online",  ()=>{window._offlineStatus.online=true;  _notifySyncListeners();});
window.addEventListener("offline", ()=>{window._offlineStatus.online=false; _notifySyncListeners();});

/* ── Local cache helpers ── */
function lsGetFarm(){try{const v=localStorage.getItem(LS_FARM);return v?JSON.parse(v):null;}catch{return null;}}
function lsSetFarm(d){try{localStorage.setItem(LS_FARM,JSON.stringify(d));}catch(e){console.warn("LS full",e);}}
function lsGetUsers(){try{const v=localStorage.getItem(LS_USERS);return v?JSON.parse(v):null;}catch{return null;}}
function lsSetUsers(d){try{localStorage.setItem(LS_USERS,JSON.stringify(d));}catch(e){}}

/* ── In-memory cache (for instant reads between saves) ── */
let _latestFarmData = lsGetFarm() || null;

/* ══ PUBLIC API — same signatures as before ══ */

async function getOnlineUsers(){
  try{
    const snap = await FS_USERS_DOC.get();
    if(snap.exists){
      const data = snap.data();
      lsSetUsers(data);
      return data.list || null;
    }
    return null;
  }catch(e){
    console.warn("Firestore getUsers failed, using cache",e);
    const cached = lsGetUsers();
    return cached && cached.list ? cached.list : null;
  }
}

async function setOnlineUsers(users){
  const payload = {list: users, updatedAt: new Date().toISOString()};
  lsSetUsers(payload);
  try{
    await FS_USERS_DOC.set(payload);
    window._offlineStatus.lastSync = new Date().toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"});
    _notifySyncListeners();
  }catch(e){console.warn("Firestore setUsers failed",e);}
}

async function getOnlineFarmData(){
  try{
    const snap = await FS_FARM_DOC.get();
    if(snap.exists){
      const data = snap.data();
      _latestFarmData = data;
      lsSetFarm(data);
      return data;
    }
    return lsGetFarm() || null;
  }catch(e){
    console.warn("Firestore getFarm failed, using cache",e);
    const cached = lsGetFarm();
    if(cached){_latestFarmData = cached; return cached;}
    return null;
  }
}

let _saveQueue = Promise.resolve();
function setOnlineFarmData(data){
  _latestFarmData = {...(_latestFarmData||{}), ...data, updatedAt: new Date().toISOString()};
  lsSetFarm(_latestFarmData);
  _saveQueue = _saveQueue.then(async()=>{
    try{
      await FS_FARM_DOC.set(_latestFarmData);
      window._offlineStatus.lastSync = new Date().toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"});
      _notifySyncListeners();
    }catch(e){console.warn("Firestore setFarm failed — data kept in localStorage",e);}
  });
  return _saveQueue;
}

function fsSet(key, list){
  return setOnlineFarmData({[key]: list});
}

function fsListen(key, setter, setLoaded, fallback){
  if(setLoaded) setTimeout(()=>setLoaded(true), 0);
  return ()=>{};
}

async function jbinAppend(key, newItem){
  try{
    // Always fetch fresh from Firestore so we never overwrite another worker's data
    const snap = await FS_FARM_DOC.get();
    const serverData = snap.exists ? snap.data() : {};
    const existing = Array.isArray(serverData[key]) ? serverData[key] : [];
    const merged = [...existing.filter(x=>x.id!==newItem.id), newItem];
    _latestFarmData = {...serverData, [key]: merged, updatedAt: new Date().toISOString()};
    lsSetFarm(_latestFarmData);
    await FS_FARM_DOC.set(_latestFarmData);
    window._offlineStatus.lastSync = new Date().toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"});
    _notifySyncListeners();
  }catch(e){
    console.warn("jbinAppend server fetch failed, using local cache",e);
    const data = _latestFarmData || {};
    const existing = Array.isArray(data[key]) ? data[key] : [];
    const merged = [...existing.filter(x=>x.id!==newItem.id), newItem];
    _latestFarmData = {...data, [key]: merged, updatedAt: new Date().toISOString()};
    lsSetFarm(_latestFarmData);
    try{ await FS_FARM_DOC.set(_latestFarmData); }catch(e2){}
  }
}

async function getOnlineSession(){return null;}
async function setOnlineSession(user){}

/* ── React hook for sync status ── */
function useSyncStatus(){
  const [status,setStatus] = React.useState({...window._offlineStatus});
  React.useEffect(()=>{
    window._syncListeners.add(setStatus);
    return ()=>window._syncListeners.delete(setStatus);
  },[]);
  return status;
}

/* ─── API Key Store ─── */
function getApiKey(){return localStorage.getItem("fiq_apikey")||"";}
function setApiKey(k){localStorage.setItem("fiq_apikey",k);}

/* ─── AI helper — Groq API (Free) ─── */
async function askAI(prompt,farmData){
  const key=getApiKey();
  if(!key) return{text:"__NO_KEY__",source:"no_key"};
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),10000);
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",signal:ctrl.signal,
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({model:"llama-3.1-8b-instant",max_tokens:1200,messages:[{role:"user",content:prompt}]})
    });
    clearTimeout(t);
    if(r.status===401||r.status===403) return{text:"__AUTH_ERROR__",source:"auth_error"};
    if(!r.ok){const err=await r.json().catch(()=>({}));return{text:`__API_ERROR__:${err?.error?.message||r.status}`,source:"api_error"};}
    const d=await r.json();
    const txt=d.choices?.[0]?.message?.content;
    if(txt) return{text:txt,source:"ai"};
    return{text:"__EMPTY__",source:"empty"};
  }catch(e){
    if(e.name==="AbortError") return{text:"__TIMEOUT__",source:"timeout"};
    return{text:`__NETWORK__:${e.message}`,source:"network"};
  }
}
