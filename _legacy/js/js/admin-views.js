function App(){
  const [users,setUsers]=useState(INIT_USERS);
  const [usersLoaded,setUsersLoaded]=useState(false);
  const [pigs,setPigs]=useState(INIT_PIGS);
  const [pigsLoaded,setPigsLoaded]=useState(false);
  const [feeds,setFeeds]=useState([]);
  const [feedsLoaded,setFeedsLoaded]=useState(false);
  const [sales,setSales]=useState([]);
  const [salesLoaded,setSalesLoaded]=useState(false);
  const [logs,setLogs]=useState([]);
  const [logsLoaded,setLogsLoaded]=useState(false);
  const [expenses,setExpenses]=useState([]);
  const [expensesLoaded,setExpensesLoaded]=useState(false);
  const [incomes,setIncomes]=useState([]);
  const [incomesLoaded,setIncomesLoaded]=useState(false);
  const [messages,setMessages]=useState([]);
  const [messagesLoaded,setMessagesLoaded]=useState(false);
  const [reproductions,setReproductions]=useState([]);
  const [reproLoaded,setReproLoaded]=useState(false);
  const [sessions,setSessions]=useState([]);
  const [sessionsLoaded,setSessionsLoaded]=useState(false);
  const [stock,setStock]=useState(INIT_STOCK);
  const [stockLoaded,setStockLoaded]=useState(false);
  const [tasks,setTasks]=useState([]);
  const [vaccinations,setVaccinations]=useState([]);
  const [pendingPigs,setPendingPigs]=useState([]);
  const [assessments,setAssessments]=useState([]);
  const [capital,setCapital]=useState({initial:0,transactions:[],updatedAt:""});
  const [capitalLoaded,setCapitalLoaded]=useState(false);
  const [salaries,setSalaries]=useState([]);
  const [advances,setAdvances]=useState([]);
  const [sessionLoaded,setSessionLoaded]=useState(false);
  const [user,setUser]=useState(null);
  const [pendingApproval,setPendingApproval]=useState(false);
  const [globalRefreshing,setGlobalRefreshing]=useState(false);
  const [lastRefresh,setLastRefresh]=useState("");
  const [undoStack,setUndoStack]=useState([]);
  const [undoToast,setUndoToast]=useState(null);
  const [sideOpen,setSideOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<=768);
  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<=768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const undoTimerRef=useRef(null);
  function pushUndo(label,undoFn){
    if(undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({label,onUndo:undoFn});
    undoTimerRef.current=setTimeout(()=>setUndoToast(null),5500);
  }
  function clearUndo(){setUndoToast(null);if(undoTimerRef.current)clearTimeout(undoTimerRef.current);}

  async function refreshAll(){
    if(globalRefreshing) return;
    setGlobalRefreshing(true);
    try{
      const [freshUsers,freshFarm]=await Promise.all([getAllUserProfiles(),getOnlineFarmData()]);
      if(freshUsers&&freshUsers.length>0){
        const corrected=freshUsers.map(u=>
          (isAdminEmail(u.email)||u.role?.toLowerCase().trim()==="admin")&&u.name==="Alexis Ndayishimiye"
            ? {...u, role:"admin", approved:true, email:u.email||ADMIN_EMAIL}
            : u
        );
        setUsers(corrected);
      }
      if(freshFarm) applyFarmData({...freshFarm, __loadCapital:true});
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){console.error("refresh error",e);}
    setGlobalRefreshing(false);
  }

  const [page,setPage]=useState("home");
  // Reset page to "home" on login — keyed on uid so it fires once per login
  useEffect(()=>{if(user?.uid) setPage("home");},[user?.uid]);
  const [showApiModal,setShowApiModal]=useState(false);
  const syncStatus=useSyncStatus();

  // ═══ FIREBASE DATA LOADING ═══
  // Load everything from Firestore once on mount, then poll every 8s
  const dataLoaded=useRef(false);

  function applyFarmData(data){
    if(!data) return;
    if(Array.isArray(data.pigs)&&data.pigs.length>0) setPigs(data.pigs);
    if(Array.isArray(data.feeds))    setFeeds(data.feeds);
    if(Array.isArray(data.sales))    setSales(data.sales);
    if(Array.isArray(data.logs))     setLogs(data.logs);
    if(Array.isArray(data.expenses)) setExpenses(data.expenses);
    if(Array.isArray(data.incomes))  setIncomes(data.incomes);
    if(Array.isArray(data.messages)) setMessages(data.messages);
    if(Array.isArray(data.reproductions)) setReproductions(data.reproductions);
    if(Array.isArray(data.stock)&&data.stock.length>0) setStock(data.stock);
    if(Array.isArray(data.tasks))        setTasks(data.tasks);
    if(Array.isArray(data.vaccinations)) setVaccinations(data.vaccinations);
    if(Array.isArray(data.sessions))   setSessions(data.sessions);
    if(Array.isArray(data.pendingPigs)) setPendingPigs(data.pendingPigs);
    if(Array.isArray(data.assessments)) setAssessments(data.assessments);
    if(Array.isArray(data.salaries)) setSalaries(data.salaries);
    if(Array.isArray(data.advances)) setAdvances(data.advances);
    // Restore market surveys and biz profile from Firestore into localStorage
    if(Array.isArray(data.marketSurveys)&&data.marketSurveys.length>0){
      try{localStorage.setItem("farmiq_market_surveys",JSON.stringify(data.marketSurveys));}catch(e){}
    }
    if(data.bizProfile&&data.bizProfile.farmName){
      try{localStorage.setItem("farmiq_biz_profile",JSON.stringify(data.bizProfile));}catch(e){}
    }
    // Capital: only load if explicitly present AND strip all refId transactions
    // refId transactions are orphan-prone — balance is derived from actual arrays
    if(data.capital&&typeof data.capital==="object"&&data.__loadCapital===true){
      const cleanTxs=(data.capital.transactions||[]).filter(t=>!t.refId);
      setCapital({...data.capital, transactions:cleanTxs});
    }
  }

  useEffect(()=>{
    // Load users from Firestore users collection
    getAllUserProfiles().then(fresh=>{
      if(fresh&&fresh.length>0){
        const corrected=fresh.map(u=>
          (isAdminEmail(u.email)||u.role?.toLowerCase().trim()==="admin")&&u.name==="Alexis Ndayishimiye"
            ? {...u, role:"admin", approved:true, email:u.email||ADMIN_EMAIL}
            : u
        );
        setUsers(corrected);
      }
      setUsersLoaded(true);
    }).catch(()=>{setUsersLoaded(true);});

    // Load all farm data once
    getOnlineFarmData().then(async(data)=>{
      applyFarmData({...data, __loadCapital:true});
      dataLoaded.current=true;
      setPigsLoaded(true);setFeedsLoaded(true);setSalesLoaded(true);
      setLogsLoaded(true);setExpensesLoaded(true);setIncomesLoaded(true);
      setMessagesLoaded(true);setReproLoaded(true);setStockLoaded(true);
      setCapitalLoaded(true);setSessionsLoaded(true);

      // ── BULLETPROOF CAPITAL WIPE ──
      // Uses already-loaded data — no extra Firestore read needed.
      try{
        const oldTxs=(data&&data.capital&&data.capital.transactions)||[];
        const cleanTxs=oldTxs.filter(t=>!t.refId);
        const wipedCapital={...(data&&data.capital||{initial:0}), transactions:cleanTxs};
        await FS_FARM_DOC.set({...(data||{}), capital:wipedCapital, _capitalFixed:true, updatedAt:new Date().toISOString()});
        // Update local cache too
        _latestFarmData={...(_latestFarmData||{}), capital:wipedCapital};
        setCapital(prev=>({...prev, transactions:cleanTxs}));
      }catch(e){console.error("capital wipe error",e);}
    }).catch(e=>{
      console.error("initial farm load error",e);
      dataLoaded.current=true;
      setPigsLoaded(true);setFeedsLoaded(true);setSalesLoaded(true);
      setLogsLoaded(true);setExpensesLoaded(true);setIncomesLoaded(true);
      setMessagesLoaded(true);setReproLoaded(true);setStockLoaded(true);
      setCapitalLoaded(true);setSessionsLoaded(true);
    });

    // Poll every 4s for new worker registrations
    const pollUsers=setInterval(async()=>{
      if(document.hidden) return;
      try{
        const fresh=await getAllUserProfiles();
        if(fresh&&fresh.length>0){
          const corrected=fresh.map(u=>
            isAdminEmail(u.email)
              ? {...u, role:"admin", approved:true}
              : u
          );
          setUsers(corrected);
        }
      }catch(e){}
    },4000);

    // Pause polling when tab is hidden — saves mobile data for workers
    const pollFarm=setInterval(async()=>{
      if(document.hidden) return;
      try{
        const serverData=await getOnlineFarmData();
        if(!serverData) return;
        const {capital:_ignoredCapital, ...farmWithoutCapital}=serverData;
        if(farmWithoutCapital) applyFarmData(farmWithoutCapital);
      }catch(e){}
    },4000);

    // Handle Google redirect result — must be called on every page load.
    // When the user returns from Google sign-in (signInWithRedirect),
    // this resolves the pending auth result BEFORE onAuthStateChanged fires.
    // If there's no pending redirect, result.user is null and we do nothing.
    _auth.getRedirectResult().then(async result=>{
      if(result&&result.user){
        await ensureUserProfile(result.user);
        // onAuthStateChanged below will fire automatically and call setUser
      }
    }).catch(e=>{
      // Swallow "no-auth-event" (normal when no redirect is pending).
      // Log anything else so we can debug if needed.
      if(e.code!=="auth/no-auth-event"){
        console.warn("getRedirectResult error:",e.code,e.message);
      }
    });

    // Listen for Firebase auth state — fires on page load AND after Google sign-in
    const unsubAuth = _auth.onAuthStateChanged(async fbUser=>{
      if(fbUser){
        // Always clear stale localStorage role cache before resolving profile
        const forceAdmin = isAdminEmail(fbUser.email);
        const profile = await ensureUserProfile(fbUser);
        // Force role to admin if email matches — never trust Firestore role alone
        const resolvedRole = forceAdmin ? "admin" : (profile?.role?.toLowerCase()||"worker");
        const resolvedProfile = {...profile, uid:fbUser.uid, email:fbUser.email, role:resolvedRole, approved: forceAdmin?true:(profile?.approved||false)};
        if(resolvedProfile && (resolvedProfile.approved || forceAdmin)){
          setUser(resolvedProfile);
        } else if(profile&&!profile.approved){
          await _auth.signOut();
          setPendingApproval(true);
        } else {
          await _auth.signOut();
        }
      }
      setSessionLoaded(true);
    });

    return()=>{clearInterval(pollUsers);clearInterval(pollFarm);unsubAuth();};
  },[]);

  // Save capital to Firestore whenever it changes (after initial load)
  const capitalSynced=useRef(false);
  useEffect(()=>{
    if(!capitalLoaded) return;
    if(!capitalSynced.current){capitalSynced.current=true;return;}
    // Strip refId transactions before saving — balance is derived from arrays, not transactions
    const capitalToSave={...capital, transactions:(capital.transactions||[]).filter(t=>!t.refId)};
    setOnlineFarmData({capital:capitalToSave});
  },[capital,capitalLoaded]);

  // Save sessions to Firestore whenever they change
  const sessionsSynced=useRef(false);
  useEffect(()=>{
    if(!sessionsLoaded) return;
    if(!sessionsSynced.current){sessionsSynced.current=true;return;}
    setOnlineFarmData({sessions});
  },[sessions,sessionsLoaded]);

  /* ─── Auto WhatsApp Notifications ─────────────────────────────────────────
     Fires automatically when farm data changes — no manual push needed.
     Tracks what was already notified via localStorage to avoid duplicates.
  ──────────────────────────────────────────────────────────────────────────── */
  const waNotified=useRef(new Set(JSON.parse(localStorage.getItem("farmiq_wa_notified")||"[]")));
  function waFired(key){
    if(waNotified.current.has(key)) return false;
    waNotified.current.add(key);
    // Persist last 200 keys to avoid re-alerting on reload
    const arr=[...waNotified.current].slice(-200);
    try{localStorage.setItem("farmiq_wa_notified",JSON.stringify(arr));}catch(e){}
    return true;
  }
  useEffect(()=>{
    if(!isWAEnabled()) return;
    const prefs=getWAAlertPrefs();
    const today=toDay();
    const alerts=[];

    // 1. New sales
    if(prefs.onSale){
      sales.filter(s=>s.date===today).forEach(s=>{
        const key=`sale_${s.id}`;
        if(waFired(key)) alerts.push(`💰 Pig Sale!\nTag: ${s.pigTag||"—"} · ${s.weight||"?"}kg\nBuyer: ${s.buyer||"—"}\nAmount: RWF ${(s.total||0).toLocaleString()}\nDate: ${today}`);
      });
    }
    // 2. Sick pigs in daily logs
    if(prefs.onSickPig){
      logs.filter(l=>l.date===today&&l.sick>0).forEach(l=>{
        const key=`sick_${l.id}`;
        if(waFired(key)) alerts.push(`🏥 Sick Pig Alert!\n${l.sick} pig(s) reported sick\nBy: ${l.worker||"Worker"} · ${today}\nCheck pens immediately.`);
      });
    }
    // 3. Deaths
    if(prefs.onDeath){
      logs.filter(l=>l.date===today&&l.deaths>0).forEach(l=>{
        const key=`death_${l.id}`;
        if(waFired(key)) alerts.push(`💀 Pig Death!\n${l.deaths} pig(s) died · ${today}\nBy: ${l.worker||"Worker"}\nInvestigate cause immediately.`);
      });
    }
    // 4. Low stock
    if(prefs.onLowStock){
      stock.filter(s=>s.quantity<=s.minLevel).forEach(s=>{
        const key=`lowstock_${s.id}_${today}`;
        if(waFired(key)) alerts.push(`📦 Low Stock Alert!\n${s.name}: ${s.quantity} ${s.unit} left\nMinimum: ${s.minLevel} ${s.unit}\nPlease restock urgently.`);
      });
    }
    // 5. Farrowing soon
    if(prefs.onFarrowingSoon){
      reproductions.filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)<=7&&daysDiff(r.expectedFarrow)>=0).forEach(r=>{
        const key=`farrow_${r.id}`;
        const sow=pigs.find(p=>p.id===r.sowId);
        if(waFired(key)) alerts.push(`🐖 Farrowing Soon!\nSow: ${sow?sow.tag:"—"}\nExpected: ${r.expectedFarrow}\n${daysDiff(r.expectedFarrow)} day(s) left. Prepare farrowing pen.`);
      });
    }
    // 6. Financial loss
    if(prefs.onLoss){
      const totalInc=sales.reduce((s,l)=>s+(l.total||0),0)+incomes.reduce((s,l)=>s+(l.amount||0),0);
      const totalExp=feeds.reduce((s,l)=>s+(l.cost||0),0)+expenses.reduce((s,l)=>s+(l.amount||0),0);
      if(totalInc>0&&totalInc<totalExp){
        const key=`loss_${today}`;
        if(waFired(key)) alerts.push(`📉 Farm Running at a Loss!\nIncome: RWF ${totalInc.toLocaleString()}\nExpenses: RWF ${totalExp.toLocaleString()}\nLoss: RWF ${(totalExp-totalInc).toLocaleString()}\nReview costs now.`);
      }
    }

    // Fire all alerts (spaced 2s apart to avoid API rate limits)
    alerts.forEach((msg,i)=>{
      setTimeout(()=>sendWhatsApp(`🐷 FarmIQ Alert\n${msg}`),i*500);
    });
  },[sales.length,logs.length,stock,reproductions.length,feeds.length,expenses.length,incomes.length]);

  const [forceShow,setForceShow]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setForceShow(true),2000);return()=>clearTimeout(t);},[]);

  /* ── ALL HOOKS BEFORE ANY RETURN — React Rules of Hooks ── */
  const emailIsAdmin = isAdminEmail(user?.email);
  useEffect(()=>{
    if(user && emailIsAdmin && user.role?.toLowerCase() !== "admin"){
      setUser(u=>({...u, role:"admin", approved:true}));
    }
  },[user?.uid, emailIsAdmin]);
  const isAdmin = emailIsAdmin || (user?.role?.toLowerCase() === "admin");
  const allData=useMemo(()=>({pigs,feeds,sales,logs,expenses,incomes,users,messages,reproductions,stock}),[pigs,feeds,sales,logs,expenses,incomes,users,messages,reproductions,stock]);

  if(!forceShow&&(!sessionLoaded||!usersLoaded||!sessionsLoaded||!pigsLoaded||!feedsLoaded||!salesLoaded||!logsLoaded||!expensesLoaded||!incomesLoaded||!messagesLoaded||!reproLoaded||!stockLoaded||!capitalLoaded)) return(<div style={{minHeight:"100vh",background:"linear-gradient(160deg,#071410 0%,#0c1f14 45%,#0a1a10 100%)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
    <div style={{position:"relative"}}><div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,rgba(74,222,128,.15),rgba(22,163,74,.08))",border:"1.5px solid rgba(74,222,128,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:"0 0 40px rgba(74,222,128,.12),0 8px 24px rgba(0,0,0,.3)"}}>🐷</div></div>
    <div style={{textAlign:"center"}}><div style={{color:"#fff",fontSize:22,fontWeight:800,letterSpacing:-.3,marginBottom:4}}>FarmIQ</div><div style={{color:"rgba(74,222,128,.6)",fontSize:11,fontWeight:600,letterSpacing:3,textTransform:"uppercase"}}>AI Farm Manager · Rwanda</div></div>
    <div style={{width:160,height:3,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden"}}><div className="load-bar-inner" style={{height:"100%",background:"linear-gradient(90deg,#16a34a,#4ade80)",borderRadius:3}}/></div>
    <div style={{color:"rgba(255,255,255,.3)",fontSize:11,letterSpacing:1}}>Loading your farm data…</div>
  </div>);

  if(!user)return <Login setUser={setUser} pendingApproval={pendingApproval} setPendingApproval={setPendingApproval}/>;

  const pending=users.filter(u=>u.role==="worker"&&!u.approved);
  const lowStockCount=(stock||[]).filter(s=>s.quantity<=s.minLevel).length;
  const upcomingFarrows=reproductions.filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)>=0&&daysDiff(r.expectedFarrow)<=7).length;
  const pendingDataCount=[...feeds,...logs,...sales,...expenses].filter(x=>x.approved===false).length + (pendingPigs||[]).filter(x=>x.approved===false&&!x.rejected).length + (assessments||[]).filter(x=>x.approved===false).length;

  // Compute alert count for nav badge
  const alerts_overdue=(reproductions||[]).filter(r=>r.status==="pregnant"&&daysDiff(r.expectedFarrow)<0).length;
  const alerts_sick=logs.filter(l=>l.date===toDay()&&l.sick>0).reduce((s,l)=>s+(l.sick||0),0);
  const alerts_stock=(stock||[]).filter(s=>s.quantity<=s.minLevel).length;
  const alerts_count=alerts_overdue+Math.min(alerts_sick,1)+Math.min(alerts_stock,1)+Math.min(pendingDataCount,1);
  const adminNav=[
    {id:"home",l:"📊 Overview"},
    {id:"alerts",l:"🔔 Alerts"+(alerts_count>0?" ("+alerts_count+")":"")},
    {id:"profitinsight",l:"💡 Profit Insight"},
    {id:"feedefficiency",l:"🌾 Feed Efficiency"},
    {id:"pigperformance",l:"🧬 Herd Intelligence"},
    {id:"approvals",l:"✅ Approvals"+(pendingDataCount>0?" 🔴"+pendingDataCount:"")},
    {id:"ai",l:"🤖 AI Advisor"},
    {id:"bigdata",l:"🧠 Big Data"},
    {id:"pnl",l:"💹 P&L Analysis"},
    {id:"market",l:"📈 RW Market"},
    {id:"reproduction",l:"🐖 Reproduction"+(upcomingFarrows>0?" ("+upcomingFarrows+")":"")},
    {id:"stock",l:"📦 Stock"+(lowStockCount>0?" ⚠️"+lowStockCount:"")},
    {id:"ledger",l:"📒 Ledger"},
    {id:"capital",l:"💵 Capital"},
    {id:"salary",l:"💼 Salary & Pay"+(salaries.filter(s=>s.status==="pending").length?" 🟡"+salaries.filter(s=>s.status==="pending").length:"")},
    {id:"advance",l:"💸 Advances"+(advances.filter(a=>a.status==="pending").length?" 🔴"+advances.filter(a=>a.status==="pending").length:"")},
    {id:"finance",l:"💰 Financials"},
    {id:"pigs",l:"🐷 Pigs"},
    {id:"assessmenthistory",l:"📏 Growth Assessments"+(assessments.filter(a=>a.approved===false).length?" 🔴"+assessments.filter(a=>a.approved===false).length:"")},
    {id:"feeding",l:"🌾 Feeding"},
    {id:"adminfeed",l:"🌾 Add Feed Log"},
    {id:"sales",l:"🏷️ Sales"},
    {id:"adminbuy",l:"🛒 Record Purchase"},
    {id:"adminsell",l:"💰 Record Sale"},
    {id:"adminlog",l:"📝 Add Daily Log"},
    {id:"daylogs",l:"📋 Daily Logs"},
    {id:"messages",l:"📢 Messages"+(messages.length?" ("+messages.length+")":"")},
    {id:"workers",l:"👷 Workers"+((pending||[]).length?" ("+(pending||[]).length+")":"")},
    {id:"workerdata",l:"🛠️ Edit Worker Data"},
    {id:"remote",l:"🖥️ Remote Work"+(sessions.filter(s=>s.status==="pending").length?" ⚠️"+sessions.filter(s=>s.status==="pending").length:"")},
    {id:"performance",l:"👷 Performance"},
    {id:"weekly",l:"📊 Weekly Report"},
    {id:"tasks",l:"✅ Tasks"+(tasks.filter(t=>t.status==="pending").length?" ("+tasks.filter(t=>t.status==="pending").length+")":"")},
    {id:"vaccination",l:"💉 Vaccinations"+(vaccinations.filter(v=>daysDiff(v.nextDue)<=7&&daysDiff(v.nextDue)>=0).length?" 🔔":"")},
    {id:"changepassword",l:"🔒 Change Password"},
    {id:"whatsapp",l:"📱 WhatsApp Alerts"+(isWAEnabled()?" 🟢":"")},
    {id:"marketsurvey",l:"📊 Market Survey"},
    {id:"bizprofile",l:"🏢 Business Profile"},
    {id:"pdfgen",l:"📄 PDF Reports"},
    {id:"systemreset",l:"🔄 System Reset"},
  ];
  const workerNav=[
    {id:"home",l:"🏠 Dashboard"},
    {id:"inbox",l:"📬 Inbox"+(messages.length?" ("+messages.length+")":"")},
    {id:"dailyentry",l:"📝 Daily Report"},
    {id:"feedentry",l:"🌾 Log Feeding"},
    {id:"saleentry",l:"🏷️ Log Sale"},
    {id:"buyentry",l:"🛒 Log Purchase"},
    {id:"pigentry",l:"🐷 Register Pig"},
    {id:"assessment",l:"📏 Weekly Assessment"+(assessments.filter(a=>a.workerId===user.id&&a.approved===false).length?" ⏳":"")},
    {id:"salary",l:"💼 My Salary"+(salaries.filter(s=>(s.workerId===user.uid||s.workerId===user.id)&&s.status==="pending").length?" ⏳":"")},
    {id:"advance",l:"💸 Salary Advance"+(advances.filter(a=>(a.workerId===user.uid||a.workerId===user.id)&&a.status==="pending").length?" ⏳":"")},
    {id:"remotework",l:"🖥️ Remote Work"+(sessions.filter(s=>s.workerId===user.id&&s.status==="active").length?" ●":"")},
    {id:"performance",l:"👷 Performance"},
    {id:"weekly",l:"📊 Weekly Report"},
    {id:"tasks",l:"✅ My Tasks"+(tasks.filter(t=>t.workerId===user.id&&t.status==="pending").length?" ("+tasks.filter(t=>t.workerId===user.id&&t.status==="pending").length+")":"")},
    {id:"vaccination",l:"💉 Vaccinations"+(vaccinations.filter(v=>daysDiff(v.nextDue)<=7&&daysDiff(v.nextDue)>=0).length?" 🔔":"")},
    {id:"changepassword",l:"🔒 Change Password"},
  ];
  const nav=isAdmin?adminNav:workerNav;

  return(<div style={S.app}>
    {showApiModal&&<ApiKeyModal onClose={()=>setShowApiModal(false)}/>}
    {undoToast&&<UndoToast label={undoToast.label} onUndo={undoToast.onUndo} onClose={clearUndo}/>}
    {/* Hamburger */}
    <button className="mob-hamburger" onClick={()=>setSideOpen(o=>!o)}>☰</button>
    {/* Overlay */}
    {sideOpen&&<div className={"mob-overlay"+(isMobile?" mob-overlay-show":"")} onClick={()=>setSideOpen(false)}/>}
    <div style={S.side} className={isMobile?(sideOpen?"mob-side-open":"mob-side-closed"):""}>
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,.07)",marginBottom:4,flexShrink:0,background:"linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.08))"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,rgba(74,222,128,.18),rgba(22,163,74,.1))",border:"1px solid rgba(74,222,128,.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,boxShadow:"0 2px 10px rgba(0,0,0,.2)"}}>🐷</div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:"#fff",letterSpacing:-.2,lineHeight:1.1}}>FarmIQ</div>
              <div style={{fontSize:8.5,color:"rgba(74,222,128,.55)",letterSpacing:1.8,textTransform:"uppercase",marginTop:1,fontWeight:700}}>Rwanda · AI</div>
            </div>
          </div>
          <button onClick={refreshAll} disabled={globalRefreshing} title="Refresh all data from server" style={{
            width:32,height:32,borderRadius:9,border:"1px solid rgba(74,222,128,.3)",
            background:globalRefreshing?"rgba(74,222,128,.18)":"rgba(74,222,128,.07)",
            color:"#4ade80",fontSize:14,cursor:"pointer",fontFamily:"inherit",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0,
            transition:"all .18s",
          }}>
            <span style={globalRefreshing?{display:"inline-block",animation:"spin .8s linear infinite"}:{}}>{globalRefreshing?"⏳":"↻"}</span>
          </button>
        </div>
        {lastRefresh&&<div style={{fontSize:9,color:"rgba(74,222,128,.4)",marginTop:6,paddingLeft:44}}>synced {lastRefresh}</div>}
      </div>
      {/* ── Offline / Sync status badge ── */}
      <div style={{padding:"6px 14px 2px",flexShrink:0}}>
        {syncStatus.online?(
          syncStatus.syncing?(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:7,background:"rgba(37,99,235,.1)",border:"1px solid rgba(37,99,235,.3)"}}>
              <span className="spin" style={{display:"inline-block",width:8,height:8,border:"1.5px solid rgba(37,99,235,.3)",borderTop:"1.5px solid #60a5fa",borderRadius:"50%"}}/>
              <span style={{fontSize:10,color:"#60a5fa",fontWeight:600}}>Syncing…</span>
            </div>
          ):syncStatus.queueLen>0?(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:7,background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.3)"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#fbbf24",flexShrink:0}}/>
              <span style={{fontSize:10,color:"#fbbf24",fontWeight:600}}>{syncStatus.queueLen} change{syncStatus.queueLen>1?"s":""} pending sync</span>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:"rgba(74,222,128,.05)",border:"1px solid rgba(74,222,128,.18)"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",flexShrink:0}}/>
              <span style={{fontSize:10,color:"rgba(74,222,128,.8)",fontWeight:600}}>Online{syncStatus.lastSync?" · "+syncStatus.lastSync:""}</span>
            </div>
          )
        ):(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:7,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.4)"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#f87171",flexShrink:0,animation:"pulse 1.5s ease-in-out infinite"}}/>
            <span style={{fontSize:10,color:"#f87171",fontWeight:700}}>Offline — saving locally{syncStatus.queueLen>0?" ("+syncStatus.queueLen+")":" "}</span>
          </div>
        )}
      </div>
      <div style={{padding:"8px 14px 6px",flexShrink:0}}>
        <button onClick={()=>setShowApiModal(true)} style={{width:"100%",padding:"7px 11px",borderRadius:8,border:"1px solid "+(getApiKey()?"rgba(74,222,128,.3)":"rgba(245,158,11,.4)"),background:getApiKey()?"rgba(74,222,128,.08)":"rgba(245,158,11,.07)",color:getApiKey()?"#4ade80":"#fbbf24",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:7,justifyContent:"center"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:getApiKey()?"#4ade80":"#fbbf24",flexShrink:0}}/>
          {getApiKey()?"✦ AI Online · Groq":"🔑 Set Groq Key"}
        </button>
      </div>
      {nav.map(n=>{
        // Insert section separators for admin nav
        const adminSections={
          alerts:"⚡ Intelligence",
          pigs:"📋 Farm Records",
          salary:"👥 People",
          whatsapp:"⚙️ Settings",
          marketsurvey:"🆕 New Features",
        };
        const sectionLabel=isAdmin&&adminSections[n.id];
        return(<React.Fragment key={n.id}>
          {sectionLabel&&<div style={{padding:"10px 18px 2px",fontSize:9,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginTop:4}}>{sectionLabel}</div>}
          <button style={{...S.nb(page===n.id),...(["marketsurvey","bizprofile","pdfgen","systemreset"].includes(n.id)&&page!==n.id?{color:"rgba(74,222,128,.7)",borderLeft:"2px solid rgba(74,222,128,.25)"}:{})}} onClick={()=>{setPage(n.id);if(isMobile)setSideOpen(false);}}>
            {page===n.id&&<span className="nav-active-dot"/>}{n.l}
          </button>
        </React.Fragment>);
      })}
      {isAdmin&&(<div style={{padding:"12px 18px",borderTop:"1px solid rgba(255,255,255,.12)",marginTop:6,flexShrink:0}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,.45)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>📄 Download Reports</div>
        <button onClick={()=>{setPage("pdfgen");if(isMobile)setSideOpen(false);}} style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1px solid rgba(74,222,128,.3)",background:"rgba(74,222,128,.08)",color:"#4ade80",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600,marginBottom:6,textAlign:"left"}}>📄 Professional PDFs →</button>
        <PDFBtn label="Full Report" type="farm" getData={()=>allData} icon="📄" color="#16a34a"/>
        <div style={{marginTop:6}}><PDFBtn label="P&L Report" type="pnl" getData={()=>allData} icon="💹" color="#16a34a"/></div>
      </div>)}
      <div style={{marginTop:"auto",padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,rgba(74,222,128,.18),rgba(22,163,74,.1))",border:"1px solid rgba(74,222,128,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#4ade80",flexShrink:0}}>
            {(user.name||"U").slice(0,1).toUpperCase()}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
            <div style={{fontSize:10,color:"rgba(74,222,128,.55)",fontWeight:600,letterSpacing:.5,textTransform:"capitalize"}}>{isAdmin?"Admin":"Worker"}</div>
          </div>
        </div>
        <button style={{width:"100%",padding:"7px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.28)",background:"rgba(239,68,68,.07)",color:"#f87171",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all .18s",letterSpacing:.1}} onClick={async()=>{await _auth.signOut();setUser(null);}}>Sign Out →</button>
      </div>
    </div>
    <div style={S.main} className={isMobile?"mob-main":""}>
      {/* Real-time pending worker alert banner for admin */}
      {isAdmin&&pending.length>0&&page!=="workers"&&(
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,
          padding:"12px 16px",marginBottom:16,
          background:"linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.06))",
          border:"1.5px solid rgba(245,158,11,.45)",borderRadius:14,
          animation:"pulse 2s ease-in-out infinite",boxShadow:"0 4px 20px rgba(245,158,11,.1)"
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🔔</span>
            <div>
              <div style={{fontWeight:700,color:"#92400e",fontSize:14}}>
                {pending.length} Worker{pending.length>1?"s":""} Waiting for Approval
              </div>
              <div style={{fontSize:12,color:"#b45309",marginTop:2}}>
                {pending.map(w=>w.name).join(", ")} registered and need{pending.length===1?"s":""} your approval to log in.
              </div>
            </div>
          </div>
          <button onClick={()=>setPage("workers")} style={{
            padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",
            background:"linear-gradient(135deg,#d97706,#b45309)",
            color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit",
            boxShadow:"0 2px 8px rgba(180,83,9,.4)",whiteSpace:"nowrap"
          }}>✓ Review Now →</button>
        </div>
      )}
      {isAdmin&&pendingDataCount>0&&page!=="approvals"&&(
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,
          padding:"12px 16px",marginBottom:16,
          background:"linear-gradient(135deg,rgba(239,68,68,.10),rgba(239,68,68,.04))",
          border:"1.5px solid rgba(239,68,68,.35)",borderRadius:14,boxShadow:"0 4px 20px rgba(239,68,68,.08)"
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>⏳</span>
            <div>
              <div style={{fontWeight:700,color:"#991b1b",fontSize:14}}>{pendingDataCount} Pending Entr{pendingDataCount===1?"y":"ies"} Need Your Approval</div>
              <div style={{fontSize:12,color:"#b91c1c",marginTop:2}}>Worker-submitted feeds, sales, purchases, logs, and pig registrations waiting to be counted.</div>
            </div>
          </div>
          <button onClick={()=>setPage("approvals")} style={{padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,fontFamily:"inherit",whiteSpace:"nowrap"}}>✅ Review Now →</button>
        </div>
      )}
      {isAdmin&&page==="alerts"&&<SmartAlerts pigs={pigs} feeds={feeds} logs={logs} sales={sales} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} users={users} tasks={tasks} vaccinations={vaccinations} capital={capital} setPage={setPage}/>}
      {isAdmin&&page==="profitinsight"&&<ProfitInsight pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} capital={capital}/>}
      {isAdmin&&page==="feedefficiency"&&<FeedEfficiency pigs={pigs} feeds={feeds} logs={logs} expenses={expenses} sales={sales} incomes={incomes}/>}
      {isAdmin&&page==="pigperformance"&&<PigPerformance pigs={pigs} logs={logs} feeds={feeds} sales={sales} expenses={expenses} incomes={incomes} reproductions={reproductions}/>}
      {isAdmin&&page==="approvals"&&<ApprovalPanel feeds={feeds} setFeeds={setFeeds} logs={logs} setLogs={setLogs} sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} pigs={pigs} setPigs={setPigs} capital={capital} setCapital={setCapital} pendingPigs={pendingPigs} setPendingPigs={setPendingPigs} pushUndo={pushUndo}/>}
      {isAdmin&&page==="bigdata"&&<BigData pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} users={users} capital={capital}/>}
      {isAdmin&&page==="home"&&<AHome pigs={pigs} feeds={feeds} sales={sales} logs={logs} users={users} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} allData={allData} setPage={setPage} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="ai"&&<AIAdvisor pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}/>}
      {isAdmin&&page==="pnl"&&<ProfitLossAnalysis pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} allData={allData} capital={capital}/>}
      {isAdmin&&page==="market"&&<RwandaMarket pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} capital={capital}/>}
      {isAdmin&&page==="reproduction"&&<ReproductionModule pigs={pigs} reproductions={reproductions} setReproductions={setReproductions} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} stock={stock} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="stock"&&<StockManager stock={stock} setStock={setStock} feeds={feeds} pigs={pigs} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="ledger"&&<Ledger expenses={expenses} setExpenses={setExpenses} incomes={incomes} setIncomes={setIncomes} feeds={feeds} setFeeds={setFeeds} sales={sales} setSales={setSales} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="finance"&&<Fin feeds={feeds} sales={sales} pigs={pigs} logs={logs} expenses={expenses} incomes={incomes} allData={allData} capital={capital}/>}
      {isAdmin&&page==="pigs"&&<Pigs pigs={pigs} setPigs={setPigs} logs={logs} allData={allData} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="feeding"&&<FeedLog feeds={feeds} setFeeds={setFeeds} pigs={pigs} logs={logs} sales={sales} expenses={expenses} incomes={incomes} allData={allData} user={user}/>}
      {isAdmin&&page==="sales"&&<SaleLog sales={sales} setSales={setSales} pigs={pigs} feeds={feeds} logs={logs} expenses={expenses} incomes={incomes} allData={allData} user={user}/>}
      {isAdmin&&page==="daylogs"&&<DLogs logs={logs} setLogs={setLogs} pigs={pigs} feeds={feeds} sales={sales} expenses={expenses} incomes={incomes} allData={allData} user={user}/>}
      {isAdmin&&page==="messages"&&<AIMessages users={users} messages={messages} setMessages={setMessages} pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}/>}
      {isAdmin&&page==="workers"&&<Workers users={users} setUsers={setUsers} tasks={tasks}/>}
      {isAdmin&&page==="workerdata"&&<AdminWorkerDataEditor feeds={feeds} setFeeds={setFeeds} logs={logs} setLogs={setLogs} sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} incomes={incomes} capital={capital} setCapital={setCapital} pigs={pigs} users={users} pushUndo={pushUndo}/>}
      {isAdmin&&page==="remote"&&<RemoteWorkAdmin sessions={sessions} setSessions={setSessions} users={users}/>}
      {isAdmin&&page==="capital"&&<CapitalManager capital={capital} setCapital={setCapital} feeds={feeds} sales={sales} expenses={expenses} incomes={incomes} pigs={pigs} user={user}/>}
      {isAdmin&&page==="adminbuy"&&<BEntry user={user} expenses={expenses} setExpenses={setExpenses} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="adminsell"&&<SEntry user={user} pigs={pigs} setPigs={setPigs} sales={sales} setSales={setSales} capital={capital} setCapital={setCapital}/>}
      {isAdmin&&page==="adminfeed"&&<FEntry user={user} pigs={pigs} feeds={feeds} setFeeds={setFeeds} capital={capital} setCapital={setCapital} tasks={tasks} setTasks={setTasks}/>}
      {isAdmin&&page==="adminlog"&&<DEntry user={user} pigs={pigs} logs={logs} setLogs={setLogs} capital={capital} setCapital={setCapital}/>}
      {/* ── Worker offline banner ── */}
      {!isAdmin&&!syncStatus.online&&(
        <div style={{
          position:"sticky",top:0,zIndex:200,
          display:"flex",alignItems:"center",gap:10,
          padding:"10px 16px",marginBottom:10,
          background:"linear-gradient(135deg,rgba(239,68,68,.97),rgba(185,28,28,.97))",
          borderRadius:10,border:"1px solid rgba(239,68,68,.5)",
          boxShadow:"0 4px 16px rgba(239,68,68,.25)",
          backdropFilter:"blur(6px)"
        }}>
          <span style={{fontSize:18,flexShrink:0}}>📵</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:"#fff",fontSize:13}}>You are offline</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:2}}>
              Your entries are saved on this device and will sync automatically when you reconnect.
            </div>
          </div>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#fca5a5",flexShrink:0,animation:"pulse 1.5s ease-in-out infinite"}}/>
        </div>
      )}
      {!isAdmin&&syncStatus.online&&syncStatus.queueLen>0&&(
        <div style={{
          display:"flex",alignItems:"center",gap:10,
          padding:"8px 14px",marginBottom:10,
          background:"rgba(245,158,11,.1)",
          borderRadius:9,border:"1px solid rgba(245,158,11,.35)"
        }}>
          <span style={{fontSize:15,flexShrink:0}}>⏳</span>
          <div style={{fontSize:12,color:"#d97706",fontWeight:600}}>
            {syncStatus.queueLen} change{syncStatus.queueLen>1?"s":""} syncing to server…
          </div>
        </div>
      )}
      {!isAdmin&&page==="home"&&<WHome user={user} logs={logs} feeds={feeds} sales={sales} messages={messages} assessments={assessments} pendingPigs={pendingPigs} tasks={tasks} expenses={expenses}/>}
      {!isAdmin&&page==="inbox"&&<WorkerInbox messages={messages} setMessages={setMessages} user={user}/>}
      {!isAdmin&&page==="dailyentry"&&<DEntry user={user} pigs={pigs} logs={logs} setLogs={setLogs} capital={capital} setCapital={setCapital}/>}
      {!isAdmin&&page==="feedentry"&&<FEntry user={user} pigs={pigs} feeds={feeds} setFeeds={setFeeds} capital={capital} setCapital={setCapital} tasks={tasks} setTasks={setTasks}/>}
      {!isAdmin&&page==="saleentry"&&<SEntry user={user} pigs={pigs} setPigs={setPigs} sales={sales} setSales={setSales} capital={capital} setCapital={setCapital}/>}
      {!isAdmin&&page==="buyentry"&&<BEntry user={user} expenses={expenses} setExpenses={setExpenses} capital={capital} setCapital={setCapital}/>}
      {!isAdmin&&page==="pigentry"&&<WorkerPigEntry user={user} pigs={pigs} setPigs={setPigs} pendingPigs={pendingPigs} setPendingPigs={setPendingPigs}/>}
      {!isAdmin&&page==="remotework"&&<RemoteWorkPanel user={user} sessions={sessions.filter(s=>s.workerId===user.uid||s.workerId===user.id)} setSessions={setSessions} messages={messages}/>}
      {isAdmin&&page==="performance"&&<WorkerPerformance users={users} logs={logs} feeds={feeds} sales={sales}/>}
      {!isAdmin&&page==="performance"&&<WorkerPerformance users={users.filter(u=>u.uid===user.uid)} logs={logs.filter(l=>l.worker===user.name)} feeds={feeds.filter(f=>f.worker===user.name)} sales={sales.filter(s=>s.worker===user.name)}/>}
      {isAdmin&&page==="weekly"&&<WeeklyReport pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} users={users} stock={stock}/>}
      {!isAdmin&&page==="weekly"&&<WeeklyReport pigs={pigs} feeds={feeds.filter(f=>f.worker===user.name)} sales={sales.filter(s=>s.worker===user.name)} logs={logs.filter(l=>l.worker===user.name)} expenses={expenses} incomes={incomes} users={users.filter(u=>u.uid===user.uid)} stock={stock}/>}
      {isAdmin&&page==="tasks"&&<TaskManager user={user} users={users} tasks={tasks} setTasks={setTasks} feeds={feeds}/>}
      {!isAdmin&&page==="tasks"&&<TaskManager user={user} users={users} tasks={tasks.filter(t=>t.workerId===user.uid||t.workerId===user.id)} setTasks={setTasks} feeds={feeds}/>}
      {page==="vaccination"&&<VaccinationTracker pigs={pigs} users={users} vaccinations={vaccinations} setVaccinations={setVaccinations} user={user} capital={capital} setCapital={setCapital}/>}
      {page==="changepassword"&&<ChangePassword user={user}/>}
      {isAdmin&&page==="whatsapp"&&<WhatsAppSettings pigs={pigs} feeds={feeds} logs={logs} sales={sales} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}/>}
      {isAdmin&&page==="marketsurvey"&&<MarketPriceSurvey pigs={pigs}/>}
      {isAdmin&&page==="bizprofile"&&<BusinessProfileSettings/>}
      {isAdmin&&page==="pdfgen"&&<ProfessionalPDFGenerator pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock} capital={capital} users={users}/>}
      {isAdmin&&page==="systemreset"&&<SystemReset pigs={pigs} setPigs={setPigs} feeds={feeds} setFeeds={setFeeds} sales={sales} setSales={setSales} logs={logs} setLogs={setLogs} expenses={expenses} setExpenses={setExpenses} incomes={incomes} setIncomes={setIncomes} messages={messages} setMessages={setMessages} reproductions={reproductions} setReproductions={setReproductions} stock={stock} setStock={setStock} tasks={tasks} setTasks={setTasks} vaccinations={vaccinations} setVaccinations={setVaccinations} pendingPigs={pendingPigs} setPendingPigs={setPendingPigs} assessments={assessments} setAssessments={setAssessments} salaries={salaries} setSalaries={setSalaries} advances={advances} setAdvances={setAdvances} capital={capital} setCapital={setCapital} sessions={sessions} setSessions={setSessions}/>}
      {!isAdmin&&page==="assessment"&&<WorkerPigAssessment user={user} pigs={pigs} assessments={assessments} setAssessments={setAssessments}/>}
      {isAdmin&&page==="assessmenthistory"&&<PigAssessmentHistory pigs={pigs} setPigs={setPigs} assessments={assessments} setAssessments={setAssessments} users={users}/>}
      {page==="salary"&&<SalaryManager user={user} users={users} salaries={salaries} setSalaries={setSalaries} expenses={expenses} setExpenses={setExpenses} capital={capital} setCapital={setCapital}/>}
      {page==="advance"&&<AdvanceManager user={user} users={users} advances={advances} setAdvances={setAdvances} salaries={salaries} setSalaries={setSalaries}/>}
    </div>
    {isMobile&&<nav className="mob-bottom-nav">
      {[
        ...(isAdmin?[
          {id:"overview",icon:"📊",l:"Home"},
          {id:"pigs",icon:"🐷",l:"Pigs"},
          {id:"feeding",icon:"🌾",l:"Feed"},
          {id:"capital",icon:"💰",l:"Capital"},
        ]:[
          {id:"overview",icon:"📊",l:"Home"},
          {id:"pigs",icon:"🐷",l:"Pigs"},
          {id:"feeding",icon:"🌾",l:"Feed"},
          {id:"assessment",icon:"📏",l:"Assess"},
        ]),
        {id:"__more__",icon:"☰",l:"More"},
      ].map(n=>n.id==="__more__"
        ?<button key="more" className="mob-nav-btn" onClick={()=>setSideOpen(true)}><span className="mob-icon">{n.icon}</span><span>{n.l}</span></button>
        :<button key={n.id} className={"mob-nav-btn"+(page===n.id?" mob-active":"")} onClick={()=>setPage(n.id)}><span className="mob-icon">{n.icon}</span><span>{n.l}</span></button>
      )}
    </nav>}
  </div>);
}


/* ── KPI card (shared across Analytics, Capital, etc.) ── */
function KPI({icon,label,value,sub,color}){
  return(<div className="card-hover" style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"15px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.05),0 2px 8px rgba(0,0,0,.04)",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:-12,right:-8,fontSize:36,opacity:.07,lineHeight:1,pointerEvents:"none",transform:"rotate(8deg)"}}>{icon}</div>
    <div style={{fontSize:22,marginBottom:7,lineHeight:1}}>{icon}</div>
    <div style={{fontSize:10,color:C.faint,textTransform:"uppercase",letterSpacing:.9,marginBottom:5,fontWeight:700}}>{label}</div>
    <div style={{fontSize:21,fontWeight:800,color:color||C.text,letterSpacing:-.3,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.faint,marginTop:5,lineHeight:1.4}}>{sub}</div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   BIG DATA ANALYTICS
═══════════════════════════════════════════════════ */
function BigData({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,users,capital}){
  const [tab,setTab]=useState("overview");
  const tabs=[
    {id:"overview",l:"📊 Overview"},
    {id:"herd",l:"🐷 Herd Analytics"},
    {id:"finance",l:"💰 Financial Trends"},
    {id:"health",l:"🏥 Health Patterns"},
    {id:"feed",l:"🌾 Feed Efficiency"},
    {id:"breed",l:"🐖 Breeding Stats"},
  ];

  /* ── Derived data ── */
  const active=pigs.filter(p=>p.status==="active");
  const sold=pigs.filter(p=>p.status==="sold");
  const {totalInc,totalExp,profit}=calcPnL(capital||{transactions:[]},feeds,sales,expenses,incomes);
  const herdVal=active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0);
  const workers=users.filter(u=>u.role==="worker"&&u.approved);

  /* ── Monthly buckets (last 6 months) ── */
  function getMonths(n=6){
    const months=[];
    for(let i=n-1;i>=0;i--){
      const d=new Date();d.setMonth(d.getMonth()-i);
      months.push(d.toISOString().slice(0,7));
    }
    return months;
  }
  const months=getMonths(6);
  const monthLabel=m=>{const[y,mo]=m.split("-");return["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]+" "+y.slice(2);};

  const monthlyInc=months.map(m=>
    sales.filter(s=>(s.date||"").startsWith(m)).reduce((s,l)=>s+(l.total||0),0)+
    incomes.filter(s=>(s.date||"").startsWith(m)).reduce((s,l)=>s+(l.amount||0),0)
  );
  const monthlyExp=months.map(m=>
    feeds.filter(s=>(s.date||"").startsWith(m)).reduce((s,l)=>s+(l.cost||0),0)+
    expenses.filter(s=>(s.date||"").startsWith(m)).reduce((s,l)=>s+(l.amount||0),0)
  );
  const monthlyProfit=months.map((m,i)=>monthlyInc[i]-monthlyExp[i]);

  /* ── Stage distribution ── */
  const stages=["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];
  const stageCounts=stages.map(s=>({stage:s,count:active.filter(p=>p.stage===s).length})).filter(s=>s.count>0);

  /* ── Breed distribution ── */
  const breedMap={};
  active.forEach(p=>{breedMap[p.breed]=(breedMap[p.breed]||0)+1;});
  const breeds=Object.entries(breedMap).map(([b,c])=>({breed:b,count:c})).sort((a,b)=>b.count-a.count);

  /* ── Health stats ── */
  const totalSick=logs.reduce((s,l)=>s+(l.sick||0),0);
  const totalDeaths=logs.reduce((s,l)=>s+(l.deaths||0),0);
  const sickRate=active.length>0?((totalSick/Math.max(active.length,1))*100).toFixed(1):0;
  const mortalityRate=pigs.length>0?((totalDeaths/Math.max(pigs.length,1))*100).toFixed(1):0;
  const sickDays=logs.filter(l=>l.sick>0).length;

  /* ── Feed efficiency ── */
  const totalFeedKg=feeds.reduce((s,f)=>s+(f.kg||0),0);
  const totalFeedCost=feeds.reduce((s,f)=>s+(f.cost||0),0);
  const costPerKgFeed=totalFeedKg>0?(totalFeedCost/totalFeedKg).toFixed(0):0;
  const avgWeightGain=active.length>0?(active.reduce((s,p)=>s+(p.weight||0),0)/active.length).toFixed(1):0;
  const feedCostPerPig=active.length>0?(totalFeedCost/Math.max(active.length,1)).toFixed(0):0;

  /* ── Breeding stats ── */
  const farrowed=reproductions.filter(r=>r.status==="farrowed");
  const pregnant=reproductions.filter(r=>r.status==="pregnant");
  const totalPiglets=farrowed.reduce((s,r)=>s+(r.piglets||0),0);
  const avgLitter=farrowed.length>0?(totalPiglets/farrowed.length).toFixed(1):0;
  const totalMatings=reproductions.length;
  const conceptionRate=totalMatings>0?((farrowed.length/totalMatings)*100).toFixed(1):0;

  /* ── Simple bar chart renderer ── */
  function MiniBar({values,labels,color,maxVal,prefix="RWF "}){
    const max=maxVal||Math.max(...values,1);
    return(<div style={{width:"100%"}}>
      {values.map((v,i)=>(
        <div key={i} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginBottom:3}}>
            <span>{labels[i]}</span>
            <span style={{fontWeight:600,color:C.text}}>{prefix}{Math.round(v).toLocaleString()}</span>
          </div>
          <div style={{background:C.elevated,borderRadius:4,height:8,width:"100%",overflow:"hidden"}}>
            <div style={{height:"100%",width:max>0?(v/max*100)+"%":"0%",background:v<0?"#dc2626":color,borderRadius:4,transition:"width .4s ease",minWidth:v>0?4:0}}/>
          </div>
        </div>
      ))}
    </div>);
  }

  return(<div className="fade-in" style={{maxWidth:960,margin:"0 auto"}}>
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,rgba(124,58,237,.1),rgba(124,58,237,.05))",border:"1px solid rgba(124,58,237,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧠</div><div style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:-.3}}>Big Data Analytics</div></div>
      <div style={{fontSize:12,color:C.muted,marginTop:2}}>Deep insights across all farm data — herd, finance, health, feed, breeding</div>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{
          padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(tab===t.id?C.accent:C.border),
          background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.muted,
          fontSize:12,fontWeight:tab===t.id?700:400,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"
        }}>{t.l}</button>
      ))}
    </div>

    {/* ── OVERVIEW TAB ── */}
    {tab==="overview"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="🐷" label="Active Pigs" value={active.length} sub={`${sold.length} sold total`} color={C.accent}/>
        <KPI icon="💰" label="Net Profit" value={fmtRWF(profit)} sub={profit>=0?"✅ Positive":"⚠️ Negative"} color={profit>=0?C.accent:C.red}/>
        <KPI icon="📦" label="Herd Value" value={fmtRWF(herdVal)} sub="at market prices" color={C.purple}/>
        <KPI icon="🌾" label="Feed Cost" value={fmtRWF(totalFeedCost)} sub={`${fmtNum(totalFeedKg)} kg fed`} color={C.amber}/>
        <KPI icon="🏥" label="Sick Rate" value={sickRate+"%"} sub={`${totalSick} sick events`} color={parseFloat(sickRate)>10?C.red:C.accent}/>
        <KPI icon="🐖" label="Avg Litter" value={avgLitter} sub={`${farrowed.length} farrowings`} color={C.blue}/>
        <KPI icon="👷" label="Workers" value={workers.length} sub="approved accounts" color={C.muted}/>
        <KPI icon="📋" label="Daily Logs" value={logs.length} sub="total entries" color={C.text}/>
      </div>

      {/* Monthly profit trend */}
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>📈 6-Month Profit Trend</div>
        <MiniBar values={monthlyProfit} labels={months.map(monthLabel)} color={C.accent} prefix="RWF "/>
      </div>

      {/* Stage & breed breakdown */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>🐷 Herd by Stage</div>
          <MiniBar values={stageCounts.map(s=>s.count)} labels={stageCounts.map(s=>s.stage)} color={C.blue} prefix=""/>
        </div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>🧬 Herd by Breed</div>
          <MiniBar values={breeds.map(b=>b.count)} labels={breeds.map(b=>b.breed)} color={C.purple} prefix=""/>
        </div>
      </div>

      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Big data farm analysis Rwanda. Herd=${active.length} active, profit=${fmtRWF(profit)}, herd_value=${fmtRWF(herdVal)}, sick_rate=${sickRate}%, avg_litter=${avgLitter}, feed_cost=${fmtRWF(totalFeedCost)}, workers=${workers.length}. Give: 1) top 3 strengths, 2) top 3 weaknesses, 3) biggest opportunity to increase profit, 4) biggest risk to manage, 5) one action to do this week.`}
        label="🤖 AI Farm Intelligence Report" icon="🧠"/>
    </div>)}

    {/* ── HERD TAB ── */}
    {tab==="herd"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="🐷" label="Total Active" value={active.length} color={C.accent}/>
        <KPI icon="⚖️" label="Avg Weight" value={avgWeightGain+"kg"} sub="across active herd" color={C.blue}/>
        <KPI icon="🏷️" label="Market Ready" value={active.filter(p=>p.weight>=80).length} sub="80kg+ pigs" color={C.amber}/>
        <KPI icon="♀️" label="Females" value={active.filter(p=>p.gender==="Female").length} sub={`${active.filter(p=>p.gender==="Male").length} males`} color={C.pink}/>
        <KPI icon="💎" label="Top Value Pig" value={fmtRWF(Math.max(...active.map(p=>getMarketPrice(p.stage,p.weight)),0))} color={C.purple}/>
        <KPI icon="📉" label="Sold Pigs" value={sold.length} sub="historical sales" color={C.muted}/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>📊 Weight Distribution</div>
        {[["Under 10kg",active.filter(p=>p.weight<10).length],["10–25kg",active.filter(p=>p.weight>=10&&p.weight<25).length],["25–50kg",active.filter(p=>p.weight>=25&&p.weight<50).length],["50–80kg",active.filter(p=>p.weight>=50&&p.weight<80).length],["80kg+",active.filter(p=>p.weight>=80).length]].map(([l,v])=>(
          <div key={l} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:3}}>
              <span>{l}</span><span style={{fontWeight:600,color:C.text}}>{v} pigs</span>
            </div>
            <div style={{background:C.elevated,borderRadius:4,height:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:active.length>0?(v/active.length*100)+"%":"0%",background:C.accent,borderRadius:4}}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14,overflowX:"auto"}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>🏆 Top 10 Pigs by Value</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid "+C.border}}>
            {["Rank","Tag","Breed","Stage","Weight","Value"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:C.muted,fontWeight:600}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {active.sort((a,b)=>getMarketPrice(b.stage,b.weight)-getMarketPrice(a.stage,a.weight)).slice(0,10).map((p,i)=>(
              <tr key={p.id} style={{borderBottom:"1px solid "+C.border+"55"}}>
                <td style={{padding:"7px 10px",color:i<3?C.amber:C.muted,fontWeight:700}}>#{i+1}</td>
                <td style={{padding:"7px 10px",fontWeight:700,color:C.text}}>{p.tag}</td>
                <td style={{padding:"7px 10px",color:C.muted}}>{p.breed}</td>
                <td style={{padding:"7px 10px",color:C.muted}}>{p.stage}</td>
                <td style={{padding:"7px 10px",color:C.muted}}>{p.weight}kg</td>
                <td style={{padding:"7px 10px",fontWeight:700,color:C.accent}}>{fmtRWF(getMarketPrice(p.stage,p.weight))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>)}

    {/* ── FINANCE TAB ── */}
    {tab==="finance"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="💚" label="Total Income" value={fmtRWF(totalInc)} color={C.accent}/>
        <KPI icon="🔴" label="Total Expenses" value={fmtRWF(totalExp)} color={C.red}/>
        <KPI icon="📊" label="Net Profit" value={fmtRWF(profit)} color={profit>=0?C.accent:C.red}/>
        <KPI icon="📈" label="ROI" value={totalExp>0?((profit/totalExp)*100).toFixed(1)+"%":"—"} color={C.blue}/>
        <KPI icon="🏷️" label="Sales Revenue" value={fmtRWF(sales.reduce((s,l)=>s+(l.total||0),0))} sub={sales.length+" sales"} color={C.purple}/>
        <KPI icon="🌾" label="Feed Spend" value={fmtRWF(totalFeedCost)} sub={((totalFeedCost/Math.max(totalExp,1))*100).toFixed(0)+"% of expenses"} color={C.amber}/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>💰 Monthly Income vs Expenses</div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:8}}>📥 Income</div>
          <MiniBar values={monthlyInc} labels={months.map(monthLabel)} color={C.accent} prefix="RWF "/>
        </div>
        <div>
          <div style={{fontSize:11,color:C.red,fontWeight:600,marginBottom:8}}>📤 Expenses</div>
          <MiniBar values={monthlyExp} labels={months.map(monthLabel)} color={C.red} prefix="RWF "/>
        </div>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>📊 Expense Breakdown by Category</div>
        {(()=>{
          const cats={};
          expenses.forEach(e=>{cats[e.category]=(cats[e.category]||0)+(e.amount||0);});
          feeds.forEach(f=>{cats["Feed Purchase"]=(cats["Feed Purchase"]||0)+(f.cost||0);});
          const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
          const total=sorted.reduce((s,[,v])=>s+v,0);
          return <MiniBar values={sorted.map(([,v])=>v)} labels={sorted.map(([k])=>k)} color={C.red} maxVal={total} prefix="RWF "/>;
        })()}
      </div>

      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Rwanda farm financial analysis. Income=${fmtRWF(totalInc)}, expenses=${fmtRWF(totalExp)}, profit=${fmtRWF(profit)}, ROI=${totalExp>0?((profit/totalExp)*100).toFixed(1):0}%, feed_spend=${fmtRWF(totalFeedCost)}. Give: 1) financial health score out of 10, 2) biggest cost to reduce, 3) fastest way to increase income, 4) Rwanda-specific financial tips, 5) cash flow advice.`}
        label="🤖 AI Financial Intelligence" icon="💰"/>
    </div>)}

    {/* ── HEALTH TAB ── */}
    {tab==="health"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="🏥" label="Sick Events" value={totalSick} sub={sickDays+" days with sickness"} color={totalSick>0?C.red:C.accent}/>
        <KPI icon="💀" label="Deaths" value={totalDeaths} sub={mortalityRate+"% mortality"} color={totalDeaths>0?C.red:C.accent}/>
        <KPI icon="📊" label="Sick Rate" value={sickRate+"%"} sub="of active herd" color={parseFloat(sickRate)>10?C.red:C.amber}/>
        <KPI icon="✅" label="Healthy Days" value={logs.length-sickDays} sub={"of "+logs.length+" logged days"} color={C.accent}/>
        <KPI icon="💉" label="Vaccinations" value={(pigs.length>0?"Active":0)} sub="via vaccination module" color={C.blue}/>
        <KPI icon="📋" label="Total Log Days" value={logs.length} sub="health records" color={C.muted}/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>🗓️ Monthly Sick Events</div>
        <MiniBar
          values={months.map(m=>logs.filter(l=>(l.date||"").startsWith(m)).reduce((s,l)=>s+(l.sick||0),0))}
          labels={months.map(monthLabel)} color={C.red} prefix=""/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>⚠️ High-Risk Pigs</div>
        {active.filter(p=>p.weight<20||p.stage==="Piglet").length===0?(
          <div style={{color:C.accent,fontSize:13}}>✅ No high-risk pigs identified</div>
        ):(
          active.filter(p=>p.weight<20||p.stage==="Piglet").map(p=>(
            <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.elevated,borderRadius:8,marginBottom:6,fontSize:12,border:"1px solid "+C.border}}>
              <span style={{fontWeight:700,color:C.text}}>{p.tag} — {p.stage}</span>
              <span style={{color:C.amber}}>{p.weight}kg · Monitor closely</span>
            </div>
          ))
        )}
      </div>

      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Rwanda pig health analytics. Sick_events=${totalSick}, deaths=${totalDeaths}, sick_rate=${sickRate}%, mortality=${mortalityRate}%, active=${active.length}. Give: 1) disease risk assessment for Rwanda climate, 2) top 3 diseases to watch for, 3) prevention protocol, 4) when to call a vet, 5) health score out of 10.`}
        label="🤖 AI Health Intelligence" icon="🏥"/>
    </div>)}

    {/* ── FEED EFFICIENCY TAB ── */}
    {tab==="feed"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="🌾" label="Total Feed" value={fmtNum(totalFeedKg)+"kg"} sub={feeds.length+" feed logs"} color={C.accent}/>
        <KPI icon="💰" label="Feed Cost" value={fmtRWF(totalFeedCost)} color={C.amber}/>
        <KPI icon="📊" label="Cost/kg Feed" value={"RWF "+costPerKgFeed} sub="average unit cost" color={C.blue}/>
        <KPI icon="🐷" label="Feed/Pig" value={fmtRWF(feedCostPerPig)} sub="total cost per pig" color={C.purple}/>
        <KPI icon="⚖️" label="Avg Pig Weight" value={avgWeightGain+"kg"} color={C.text}/>
        <KPI icon="📦" label="Low Stock Items" value={stock.filter(s=>s.quantity<=s.minLevel).length} sub="need restocking" color={C.red}/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>🌾 Monthly Feed Cost</div>
        <MiniBar values={months.map(m=>feeds.filter(f=>(f.date||"").startsWith(m)).reduce((s,f)=>s+(f.cost||0),0))} labels={months.map(monthLabel)} color={C.amber} prefix="RWF "/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📦 Current Stock Levels</div>
        {stock.map(s=>{
          const pct=Math.min(100,Math.round((s.quantity/Math.max(s.minLevel*2,1))*100));
          const low=s.quantity<=s.minLevel;
          return(<div key={s.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span style={{color:C.text,fontWeight:600}}>{s.name}</span>
              <span style={{color:low?C.red:C.muted}}>{s.quantity} {s.unit} {low?"⚠️ LOW":""}</span>
            </div>
            <div style={{background:C.elevated,borderRadius:4,height:8,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:low?C.red:C.accent,borderRadius:4,transition:"width .4s"}}/>
            </div>
          </div>);
        })}
      </div>

      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Rwanda pig feed efficiency analysis. Total_feed=${fmtNum(totalFeedKg)}kg, feed_cost=${fmtRWF(totalFeedCost)}, cost_per_kg=RWF ${costPerKgFeed}, avg_pig_weight=${avgWeightGain}kg, active_pigs=${active.length}. Give: 1) feed efficiency score, 2) ideal feed-to-weight ratio for Rwanda breeds, 3) cheapest local feed sources in Rwanda, 4) feeding schedule optimization, 5) how to reduce feed costs by 20%.`}
        label="🤖 AI Feed Intelligence" icon="🌾"/>
    </div>)}

    {/* ── BREEDING TAB ── */}
    {tab==="breed"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI icon="🐖" label="Total Matings" value={reproductions.length} color={C.blue}/>
        <KPI icon="🤰" label="Pregnant Now" value={pregnant.length} color={C.pink}/>
        <KPI icon="🐣" label="Farrowings" value={farrowed.length} color={C.accent}/>
        <KPI icon="🐷" label="Total Piglets" value={totalPiglets} sub="from all litters" color={C.purple}/>
        <KPI icon="📊" label="Avg Litter Size" value={avgLitter} sub="piglets per farrowing" color={C.amber}/>
        <KPI icon="✅" label="Conception Rate" value={conceptionRate+"%"} color={parseFloat(conceptionRate)>70?C.accent:C.red}/>
      </div>

      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>🐣 Monthly Piglet Production</div>
        <MiniBar
          values={months.map(m=>reproductions.filter(r=>(r.farrowDate||"").startsWith(m)).reduce((s,r)=>s+(r.piglets||0),0))}
          labels={months.map(monthLabel)} color={C.pink} prefix=""/>
      </div>

      {farrowed.length>0&&(
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:18,marginBottom:14,overflowX:"auto"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>🏆 Best Performing Sows</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"1px solid "+C.border}}>
              {["Sow Tag","Litters","Total Piglets","Avg/Litter","Rating"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:C.muted,fontWeight:600}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(()=>{
                const sowMap={};
                farrowed.forEach(r=>{
                  if(!sowMap[r.sowId]) sowMap[r.sowId]={tag:r.sowTag||r.sowId,litters:0,piglets:0};
                  sowMap[r.sowId].litters++;
                  sowMap[r.sowId].piglets+=(r.piglets||0);
                });
                return Object.values(sowMap).sort((a,b)=>b.piglets-a.piglets).slice(0,8).map((s,i)=>{
                  const avg=(s.piglets/s.litters).toFixed(1);
                  const rating=parseFloat(avg)>=10?"⭐ Excellent":parseFloat(avg)>=8?"✅ Good":parseFloat(avg)>=6?"⚠️ Average":"❌ Poor";
                  return(<tr key={s.tag} style={{borderBottom:"1px solid "+C.border+"55"}}>
                    <td style={{padding:"7px 10px",fontWeight:700,color:C.text}}>{s.tag}</td>
                    <td style={{padding:"7px 10px",color:C.muted}}>{s.litters}</td>
                    <td style={{padding:"7px 10px",color:C.accent,fontWeight:700}}>{s.piglets}</td>
                    <td style={{padding:"7px 10px",color:C.muted}}>{avg}</td>
                    <td style={{padding:"7px 10px"}}>{rating}</td>
                  </tr>);
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
        topic={`Rwanda pig breeding analytics. Total_matings=${reproductions.length}, farrowed=${farrowed.length}, conception_rate=${conceptionRate}%, avg_litter=${avgLitter}, total_piglets=${totalPiglets}, pregnant_now=${pregnant.length}. Give: 1) breeding performance score, 2) how to improve litter size for Rwanda breeds, 3) optimal breeding schedule, 4) genetic improvement tips, 5) best boar-to-sow ratio.`}
        label="🤖 AI Breeding Intelligence" icon="🐖"/>
    </div>)}

  </div>);
}

/* ═══════════════════════════════════════════════════
   1. WORKER PERFORMANCE & ATTENDANCE
═══════════════════════════════════════════════════ */
function WorkerPerformance({users,logs,feeds,sales}){
  const workers=users.filter(u=>u.role==="worker"&&u.approved);
  // Get last 30 days
  const today=new Date();
  const days30=Array.from({length:30},(_,i)=>{
    const d=new Date(today);d.setDate(d.getDate()-i);
    return d.toISOString().slice(0,10);
  });
  const workdays=days30.length;

  function score(w){
    const wLogs=logs.filter(l=>l.workerId===(w.uid||w.id));
    const wFeeds=feeds.filter(f=>f.workerId===(w.uid||w.id));
    const wSales=sales.filter(s=>s.workerId===(w.uid||w.id));
    const daysReported=new Set(wLogs.map(l=>l.date)).size;
    const attendance=Math.round((daysReported/workdays)*100);
    const pts=Math.min(100,Math.round((daysReported*3)+(wFeeds.length*2)+(wSales.length*5)));
    const revenue=wSales.reduce((s,x)=>s+(x.total||0),0);
    const sick=wLogs.reduce((s,l)=>s+(l.sick||0),0);
    return{logs:wLogs.length,feeds:wFeeds.length,sales:wSales.length,attendance,pts,revenue,sick,daysReported};
  }

  const ranked=workers.map(w=>({...w,...score(w)})).sort((a,b)=>b.pts-a.pts);
  const medal=["🥇","🥈","🥉"];

  return(<div>
    <div style={S.h1}>👷 Worker Performance</div>
    <div style={S.sub}>Last 30 days · Ranked by performance score</div>
    {workers.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center"}}>No workers yet.</div>}
    {ranked.map((w,i)=>{
      const color=i===0?C.amber:i===1?"#94a3b8":i===2?"#b45309":C.accent;
      const pct=Math.min(100,w.pts);
      return(<div key={w.uid||w.id} style={{...S.card,marginBottom:12,border:i===0?"1.5px solid rgba(245,158,11,.4)":"1px solid "+C.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{medal[i]||"👤"}</span>
            <div>
              <div style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</div>
              <div style={{fontSize:11,color:C.faint}}>@{w.username}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:800,color:color}}>{w.pts}</div>
            <div style={{fontSize:10,color:C.faint}}>SCORE</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:6,background:C.elevated,borderRadius:6,marginBottom:10,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:color,borderRadius:6,transition:"width .4s"}}/>
        </div>
        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {[
            ["📅 Attendance",w.attendance+"%",w.attendance>=80?C.accent:w.attendance>=50?C.amber:C.red],
            ["📝 Reports",w.logs,C.accent],
            ["🌾 Feedings",w.feeds,C.amber],
            ["🏷️ Sales",w.sales,"#10b981"],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:C.elevated,borderRadius:7,padding:"7px 8px",textAlign:"center"}}>
              <div style={{fontSize:10,color:C.faint,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:700,color:c,fontSize:14}}>{v}</div>
            </div>
          ))}
        </div>
        {w.revenue>0&&<div style={{marginTop:8,fontSize:12,color:"#10b981",textAlign:"right",fontWeight:600}}>💰 Revenue: {fmtRWF(w.revenue)}</div>}
        {w.sick>0&&<div style={{marginTop:4,fontSize:11,color:C.red}}>⚠️ Reported {w.sick} sick pig(s)</div>}
      </div>);
    })}
    {/* Attendance summary */}
    {workers.length>0&&<div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📅 Attendance — Last 30 Days</div>
      {ranked.map(w=>(
        <div key={w.uid||w.id} style={{...S.row,marginBottom:8}}>
          <span style={{color:C.text,fontSize:13}}>{w.name}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:80,height:5,background:C.elevated,borderRadius:5,overflow:"hidden"}}>
              <div style={{height:"100%",width:w.attendance+"%",background:w.attendance>=80?C.accent:w.attendance>=50?C.amber:C.red,borderRadius:5}}/>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:w.attendance>=80?C.accent:w.attendance>=50?C.amber:C.red,minWidth:35}}>{w.attendance}%</span>
          </div>
        </div>
      ))}
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   2. WEEKLY REPORT
═══════════════════════════════════════════════════ */
function WeeklyReport({pigs,feeds,sales,logs,expenses,incomes,users,stock}){
  // Get this week's date range
  const today=new Date();
  const dayOfWeek=today.getDay();
  const monday=new Date(today);monday.setDate(today.getDate()-(dayOfWeek===0?6:dayOfWeek-1));
  const weekStart=monday.toISOString().slice(0,10);
  const lastMonday=new Date(monday);lastMonday.setDate(monday.getDate()-7);
  const lastWeekStart=lastMonday.toISOString().slice(0,10);
  const lastWeekEnd=new Date(monday);lastWeekEnd.setDate(monday.getDate()-1);
  const lastWeekEndStr=lastWeekEnd.toISOString().slice(0,10);

  function inRange(date,start,end){return date>=start&&date<=end;}

  // This week
  const wLogs=logs.filter(l=>l.date>=weekStart);
  const wFeeds=feeds.filter(f=>f.date>=weekStart);
  const wSales=sales.filter(s=>s.date>=weekStart);
  const wInc=wSales.reduce((s,x)=>s+(x.total||0),0)+incomes.filter(i=>i.date>=weekStart).reduce((s,x)=>s+(x.amount||0),0);
  const wExp=wFeeds.reduce((s,x)=>s+(x.cost||0),0)+expenses.filter(e=>e.date>=weekStart).reduce((s,x)=>s+(x.amount||0),0);
  const wProfit=wInc-wExp;
  const wSick=wLogs.reduce((s,l)=>s+(l.sick||0),0);
  const wDeaths=wLogs.reduce((s,l)=>s+(l.deaths||0),0);
  const wBirths=wLogs.reduce((s,l)=>s+(l.births||0),0);

  // Last week
  const lwSales=sales.filter(s=>inRange(s.date,lastWeekStart,lastWeekEndStr));
  const lwInc=lwSales.reduce((s,x)=>s+(x.total||0),0)+incomes.filter(i=>inRange(i.date,lastWeekStart,lastWeekEndStr)).reduce((s,x)=>s+(x.amount||0),0);
  const lwExp=feeds.filter(f=>inRange(f.date,lastWeekStart,lastWeekEndStr)).reduce((s,x)=>s+(x.cost||0),0)+expenses.filter(e=>inRange(e.date,lastWeekStart,lastWeekEndStr)).reduce((s,x)=>s+(x.amount||0),0);
  const lwProfit=lwInc-lwExp;

  const profitChange=lwProfit>0?Math.round(((wProfit-lwProfit)/lwProfit)*100):0;
  const lowStock=stock.filter(s=>s.quantity<=s.minLevel);
  const workers=users.filter(u=>u.role==="worker"&&u.approved);
  const activeToday=new Set(logs.filter(l=>l.date===toDay()).map(l=>l.workerId)).size;

  return(<div>
    <div style={S.h1}>📊 Weekly Report</div>
    <div style={S.sub}>Week from {weekStart} · Auto-generated</div>

    {/* This week summary */}
    <div style={S.g4}>
      {[
        {l:"This Week Income",v:fmtRWF(wInc),c:"#10b981"},
        {l:"This Week Expenses",v:fmtRWF(wExp),c:C.red},
        {l:"This Week Profit",v:fmtRWF(wProfit),c:wProfit>=0?C.accent:C.red},
        {l:"vs Last Week",v:(profitChange>=0?"+":"")+profitChange+"%",c:profitChange>=0?C.accent:C.red},
      ].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c,fontSize:14}}>{s.v}</div></div>
      ))}
    </div>

    {/* Health this week */}
    <div style={S.g4}>
      {[
        {l:"Daily Reports",v:wLogs.length,c:C.accent},
        {l:"Sick Pigs Reported",v:wSick,c:wSick>0?C.red:C.accent},
        {l:"Deaths",v:wDeaths,c:wDeaths>0?C.red:C.accent},
        {l:"New Births",v:wBirths,c:C.purple},
      ].map(s=>(
        <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{...S.sv,color:s.c}}>{s.v}</div></div>
      ))}
    </div>

    {/* Low stock alerts */}
    {lowStock.length>0&&<div style={{...S.card,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.25)",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:8}}>📦 Low Stock Alerts ({lowStock.length})</div>
      {lowStock.map(s=>(
        <div key={s.id} style={S.row}>
          <span style={{color:C.text}}>{s.name}</span>
          <span style={{color:C.red,fontWeight:700}}>{s.quantity}{s.unit} left (min: {s.minLevel})</span>
        </div>
      ))}
    </div>}

    {/* Worker activity */}
    <div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>👷 Worker Activity This Week</div>
      {workers.length===0&&<div style={{color:C.faint,fontSize:13}}>No workers yet.</div>}
      {workers.map(w=>{
        const wl=wLogs.filter(l=>l.workerId===(w.uid||w.id)).length;
        const wf=wFeeds.filter(f=>f.workerId===(w.uid||w.id)).length;
        const ws=wSales.filter(s=>s.workerId===(w.uid||w.id)).length;
        const active=logs.some(l=>l.workerId===(w.uid||w.id)&&l.date===toDay());
        return(<div key={w.uid||w.id} style={{...S.row,marginBottom:6}}>
          <div>
            <span style={{fontWeight:600,color:C.text}}>{w.name}</span>
            <span style={{marginLeft:8,fontSize:10,padding:"2px 7px",borderRadius:10,background:active?"rgba(22,163,74,.12)":"rgba(239,68,68,.1)",color:active?C.accent:C.red}}>{active?"● Active today":"○ No report today"}</span>
          </div>
          <div style={{fontSize:11,color:C.faint}}>{wl} logs · {wf} feeds · {ws} sales</div>
        </div>);
      })}
    </div>

    {/* Sales this week */}
    {wSales.length>0&&<div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:"#10b981",marginBottom:10}}>🏷️ Sales This Week ({wSales.length})</div>
      {wSales.map((s,i)=>{
        const pig=pigs.find(p=>p.id===s.pigId);
        return(<div key={i} style={S.row}>
          <span style={{color:C.muted,fontSize:12}}>{s.date} · {s.worker} · {pig?pig.tag:"—"}</span>
          <span style={{color:"#10b981",fontWeight:700}}>{fmtRWF(s.total)}</span>
        </div>);
      })}
    </div>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   3. TASK ASSIGNMENT
═══════════════════════════════════════════════════ */
/* ─── Auto Feeding Task Generator ───────────────────────────────────────────
   Generates two AI feeding reminder tasks per worker per day:
     • Morning feeding — 07:00
     • Evening feeding — 18:00
   Keyed as: autoFeed_{workerId}_{date}_{slot}  (slot = "AM" | "PM")
   Auto-marks done when worker logs a feed entry on that date.
──────────────────────────────────────────────────────────────────────────── */
function useAutoFeedingTasks(tasks,setTasks,users,feeds){
  useEffect(()=>{
    const workers=users.filter(u=>u.role==="worker"&&u.approved);
    if(workers.length===0) return;
    const today=toDay();
    let changed=false;
    const updated=[...tasks];

    workers.forEach(w=>{
      ["AM","PM"].forEach(slot=>{
        const taskId=`autoFeed_${w.uid||w.id}_${today}_${slot}`;
        const exists=updated.find(t=>t.id===taskId);
        const title=slot==="AM"?"🌅 Morning Feeding (07:00)":"🌆 Evening Feeding (18:00)";
        const desc=slot==="AM"?"Feed all pigs by 7:00 AM and log the feeding entry.":"Feed all pigs by 6:00 PM and log the feeding entry.";

        // Check if worker logged a feed today
        const fedToday=feeds.some(f=>f.workerId===(w.uid||w.id)&&f.date===today);

        if(!exists){
          // Create new auto task
          updated.push({
            id:taskId,
            title,
            desc,
            workerId:w.uid||w.id,
            priority:"High",
            due:today,
            createdBy:"🤖 AI Auto-Task",
            createdAt:today,
            status:fedToday?"done":"pending",
            autoFeed:true,
            slot
          });
          changed=true;
        } else if(exists.status==="pending"&&fedToday){
          // Auto-mark done when feed was logged
          const idx=updated.findIndex(t=>t.id===taskId);
          if(idx>=0){updated[idx]={...updated[idx],status:"done",autoCompletedAt:new Date().toISOString()};changed=true;}
        }
      });
    });

    if(changed){
      setTasks(updated);
      fsSet("tasks",updated);
    }
  },[users,feeds,tasks.length]);
}

/* ─── Worker Task Chart ─────────────────────────────────────────────────── */
function WorkerTaskChart({users,tasks}){
  const workers=users.filter(u=>u.role==="worker"&&u.approved);
  if(workers.length===0) return null;
  const today=toDay();

  const data=workers.map(w=>{
    const myTasks=tasks.filter(t=>t.workerId===(w.uid||w.id));
    const pending=myTasks.filter(t=>t.status==="pending");
    const done=myTasks.filter(t=>t.status==="done");
    const todayDone=myTasks.filter(t=>t.status==="done"&&(t.autoCompletedAt||"").slice(0,10)===today||t.completedAt===today).length;
    const overdue=pending.filter(t=>t.due&&t.due<today);
    const autoFeedDone=myTasks.filter(t=>t.autoFeed&&t.status==="done"&&t.due===today).length;
    const autoFeedPending=myTasks.filter(t=>t.autoFeed&&t.status==="pending"&&t.due===today).length;
    return{w,pending:pending.length,done:done.length,overdue:overdue.length,autoFeedDone,autoFeedPending,total:myTasks.length};
  });
  const maxTotal=Math.max(...data.map(d=>d.total),1);

  return(<div style={{...S.card,marginBottom:14}}>
    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>📊 Worker Task Overview</div>
    <div style={{fontSize:11,color:C.faint,marginBottom:14}}>Tasks assigned per worker · Today's feeding status</div>

    {/* Bar chart */}
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
      {data.map(({w,pending,done,overdue,autoFeedDone,autoFeedPending,total})=>{
        const pct=total>0?(done/total)*100:0;
        const amFedToday=tasks.some(t=>t.workerId===(w.uid||w.id)&&t.autoFeed&&t.slot==="AM"&&t.status==="done"&&t.due===today);
        const pmFedToday=tasks.some(t=>t.workerId===(w.uid||w.id)&&t.autoFeed&&t.slot==="PM"&&t.status==="done"&&t.due===today);
        return(<div key={w.uid||w.id}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#16a34a,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700,flexShrink:0}}>
                {w.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{fontWeight:600,fontSize:12,color:C.text}}>{w.name}</div>
                <div style={{fontSize:10,color:C.faint}}>
                  <span style={{color:amFedToday?C.accent:C.red}}>{amFedToday?"✅":"⏳"} 07:00</span>
                  <span style={{margin:"0 5px",color:C.border}}>·</span>
                  <span style={{color:pmFedToday?C.accent:C.red}}>{pmFedToday?"✅":"⏳"} 18:00</span>
                </div>
              </div>
            </div>
            <div style={{textAlign:"right",fontSize:11}}>
              <span style={{color:C.accent,fontWeight:700}}>{done}</span>
              <span style={{color:C.faint}}> / {total} done</span>
              {overdue>0&&<span style={{color:C.red,fontWeight:700,marginLeft:6}}>⚠️ {overdue} overdue</span>}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden",position:"relative"}}>
            <div style={{
              position:"absolute",left:0,top:0,height:"100%",
              width:Math.min((total/maxTotal)*100,100)+"%",
              background:C.elevated,borderRadius:4
            }}/>
            <div style={{
              position:"absolute",left:0,top:0,height:"100%",
              width:pct+"%",
              background:pct===100?"linear-gradient(90deg,#22c55e,#16a34a)":pct>50?"linear-gradient(90deg,#f59e0b,#16a34a)":"linear-gradient(90deg,#ef4444,#f59e0b)",
              borderRadius:4,transition:"width .5s"
            }}/>
          </div>
          {/* Pending task pills */}
          {pending>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>
            {tasks.filter(t=>t.workerId===(w.uid||w.id)&&t.status==="pending").slice(0,4).map(t=>(
              <span key={t.id} style={{
                fontSize:9,padding:"2px 7px",borderRadius:10,
                background:t.autoFeed?"rgba(22,163,74,.1)":"rgba(99,102,241,.1)",
                color:t.autoFeed?C.accent:"#6366f1",fontWeight:600,border:"1px solid "+(t.autoFeed?"rgba(22,163,74,.2)":"rgba(99,102,241,.2)")
              }}>{t.autoFeed?"🤖":""}{t.title.length>22?t.title.slice(0,22)+"…":t.title}</span>
            ))}
            {pending>4&&<span style={{fontSize:9,color:C.faint,padding:"2px 5px"}}>+{pending-4} more</span>}
          </div>}
        </div>);
      })}
    </div>

    {/* Legend */}
    <div style={{display:"flex",gap:14,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid "+C.border}}>
      {[["🤖 AI Auto Task","rgba(22,163,74,.2)",C.accent],["📋 Manual Task","rgba(99,102,241,.2)","#6366f1"],["⚠️ Overdue","rgba(239,68,68,.2)",C.red]].map(([l,bg,c])=>(
        <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:c}}>
          <div style={{width:10,height:10,borderRadius:3,background:bg,border:"1px solid "+c}}/>
          {l}
        </div>
      ))}
    </div>
  </div>);
}

function TaskManager({user,users,tasks,setTasks,feeds}){
  const isAdmin=isAdminUser(user);
  const workers=users.filter(u=>u.role==="worker"&&u.approved);
  const [form,setForm]=useState({title:"",desc:"",workerId:"",priority:"Normal",due:toDay()});
  const [saved,setSaved]=useState(false);
  const [tab,setTab]=useState("all"); // "all" | "chart"
  const myTasks=isAdmin?tasks:tasks.filter(t=>t.workerId===user.id);

  // Auto-generate daily feeding tasks
  useAutoFeedingTasks(tasks,setTasks,users,feeds||[]);

  async function addTask(){
    if(!form.title||(!isAdmin?false:!form.workerId)) return;
    const newTask={...form,id:uid(),createdBy:user.name,createdAt:toDay(),status:"pending",workerId:isAdmin?form.workerId:user.id};
    const updated=[...tasks,newTask];
    setTasks(updated);
    fsSet("tasks",updated);
    try{await jbinAppend("tasks",newTask);setSaved(true);setTimeout(()=>{setSaved(false);setForm({title:"",desc:"",workerId:"",priority:"Normal",due:toDay()});},2000);}
    catch(e){console.error("task save error",e);}
  }

  async function updateStatus(id,status){
    const updated=tasks.map(t=>t.id===id?{...t,status,completedAt:status==="done"?toDay():undefined}:t);
    setTasks(updated);
    fsSet("tasks",updated);
    try{
      const data=await getOnlineFarmData()||{};
      await setOnlineFarmData({...data,tasks:updated});
    }catch(e){console.error("task update error",e);}
  }

  const pending=myTasks.filter(t=>t.status==="pending");
  const done=myTasks.filter(t=>t.status==="done");
  const priorityColor={High:C.red,Normal:C.accent,Low:C.muted};
  const today=toDay();

  return(<div>
    <div style={S.h1}>✅ Task Manager</div>
    <div style={S.sub}>{pending.length} pending · {done.length} completed · 🤖 AI auto-generates daily feeding reminders</div>

    {/* Tab bar — admin only */}
    {isAdmin&&<div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["all","📋 All Tasks"],["chart","📊 Worker Chart"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{
          padding:"7px 14px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",
          fontWeight:700,fontSize:12,
          background:tab===id?"linear-gradient(135deg,#16a34a,#10b981)":"rgba(22,163,74,.08)",
          color:tab===id?"#fff":C.accent
        }}>{lbl}</button>
      ))}
    </div>}

    {/* Worker task chart */}
    {isAdmin&&tab==="chart"&&<WorkerTaskChart users={users} tasks={tasks}/>}

    {tab==="all"&&<>
    {/* Add task — admin only */}
    {isAdmin&&<div style={{...S.card,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:12}}>➕ Assign New Task</div>
      {saved&&<div style={{padding:8,background:C.accentSoft,borderRadius:7,marginBottom:10,color:C.accent,fontSize:13}}>✓ Task assigned!</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Task Title *</label><input placeholder="e.g. Clean pig pens" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Assign To *</label>
          <select value={form.workerId} onChange={e=>setForm({...form,workerId:e.target.value})} style={S.inp}>
            <option value="">Select worker</option>
            {workers.map(w=><option key={w.uid||w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Priority</label>
          <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={S.inp}>
            {["High","Normal","Low"].map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Due Date</label><input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Description</label><input placeholder="Details..." value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} style={S.inp}/></div>
      </div>
      <button onClick={addTask} style={{...S.btn(),width:"100%",padding:11,fontSize:14}}>Assign Task →</button>
    </div>}

    {/* AI auto-task info banner */}
    <div style={{padding:"10px 14px",background:"rgba(22,163,74,.05)",border:"1px solid rgba(22,163,74,.2)",borderRadius:9,marginBottom:14,fontSize:12,color:C.muted}}>
      🤖 <strong style={{color:C.accent}}>AI Auto-Tasks:</strong> Two daily feeding tasks (07:00 & 18:00) are automatically assigned to each worker every day. They are marked ✅ Done automatically when the worker logs a feed entry.
    </div>

    {/* Pending tasks */}
    {pending.length===0&&<div style={{...S.card,color:C.faint,fontSize:13,textAlign:"center"}}>
      {isAdmin?"No pending tasks. Assign one above!":"No tasks assigned to you yet."}
    </div>}
    {pending.map(t=>{
      const worker=users.find(u=>u.id===t.workerId);
      const overdue=t.due&&t.due<today;
      return(<div key={t.id} style={{...S.card,marginBottom:10,border:"1px solid "+(overdue?"rgba(239,68,68,.3)":t.autoFeed?"rgba(22,163,74,.25)":C.border)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,color:C.text,fontSize:14,display:"flex",alignItems:"center",gap:6}}>
              {t.autoFeed&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:"rgba(22,163,74,.12)",color:C.accent,fontWeight:700}}>🤖 AUTO</span>}
              {t.title}
            </div>
            {t.desc&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{t.desc}</div>}
          </div>
          <span style={{padding:"2px 9px",borderRadius:12,background:priorityColor[t.priority]+"22",color:priorityColor[t.priority],fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{t.priority}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:C.faint,marginBottom:10}}>
          <span>👤 {worker?worker.name:"—"} · 📅 Due: <span style={{color:overdue?C.red:C.muted,fontWeight:overdue?700:400}}>{t.due}{overdue?" ⚠️ OVERDUE":""}</span></span>
          <span style={{color:t.autoFeed?C.accent:C.faint}}>{t.autoFeed?"🤖 AI":"By: "+t.createdBy}</span>
        </div>
        <button onClick={()=>updateStatus(t.id,"done")} style={{...S.btn(C.accent),fontSize:12,padding:"6px 14px",width:"100%"}}>✓ Mark as Done</button>
      </div>);
    })}

    {/* Completed tasks */}
    {done.length>0&&<div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>✅ Completed ({done.length})</div>
      {done.slice().reverse().map(t=>{
        const worker=users.find(u=>u.id===t.workerId);
        return(<div key={t.id} style={{...S.row,opacity:.7}}>
          <span style={{color:C.muted,fontSize:12,textDecoration:"line-through"}}>{t.title} · {worker?worker.name:"—"}</span>
          <span style={{color:C.accent,fontSize:11}}>{t.autoFeed?"🤖 ":""}✓ Done</span>
        </div>);
      })}
    </div>}
    </>}
  </div>);
}

/* ═══════════════════════════════════════════════════
   4. VACCINATION TRACKER
═══════════════════════════════════════════════════ */
function VaccinationTracker({pigs,users,vaccinations,setVaccinations,user,capital,setCapital}){
  const isAdmin=isAdminUser(user);
  const active=pigs.filter(p=>p.status==="active");
  const [form,setForm]=useState({pigId:"",vaccine:"CSF Vaccine",date:toDay(),nextDue:"",notes:"",givenBy:user.name,cost:""});
  const [saved,setSaved]=useState(false);
  const VACCINES=["CSF Vaccine","FMD Vaccine","Ivermectin","Dewormer","Vitamin B12","Other"];

  async function save(){
    if(!form.pigId||!form.date)return;
    const nextDue=form.nextDue||addDays(form.date,180);
    const cost=parseFloat(form.cost)||0;
    const newVac={...form,id:uid(),nextDue,createdAt:toDay()};
    setVaccinations(p=>{const updated=[...p,newVac];fsSet("vaccinations",updated);return updated;});
    if(setCapital&&cost>0){
      const pig=pigs.find(p=>p.id===form.pigId);
      capitalTx(capital,setCapital,{type:"expense",category:"Veterinary",amount:cost,description:`${form.vaccine} for ${pig?pig.tag:"pig"} — by ${form.givenBy}`,date:form.date});
    }
    try{await jbinAppend("vaccinations",newVac);setSaved(true);setTimeout(()=>{setSaved(false);setForm({pigId:"",vaccine:"CSF Vaccine",date:toDay(),nextDue:"",notes:"",givenBy:user.name,cost:""});},2000);}
    catch(e){alert("❌ Failed to save.");}
  }

  const due=vaccinations.filter(v=>{
    const d=daysDiff(v.nextDue);
    return d>=0&&d<=14;
  });
  const overdue=vaccinations.filter(v=>daysDiff(v.nextDue)<0);

  return(<div>
    <div style={S.h1}>💉 Vaccination Tracker</div>
    <div style={S.sub}>Track vaccinations · Get due date alerts</div>

    {/* Alerts */}
    {overdue.length>0&&<div style={{...S.card,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.3)",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:8}}>⚠️ Overdue Vaccinations ({overdue.length})</div>
      {overdue.map(v=>{const pig=pigs.find(p=>p.id===v.pigId);return(
        <div key={v.id} style={S.row}><span style={{color:C.text}}>{pig?pig.tag:"—"} — {v.vaccine}</span><span style={{color:C.red,fontWeight:700}}>{Math.abs(daysDiff(v.nextDue))} days overdue</span></div>
      );})}
    </div>}
    {due.length>0&&<div style={{...S.card,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.3)",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:8}}>🔔 Due Soon ({due.length})</div>
      {due.map(v=>{const pig=pigs.find(p=>p.id===v.pigId);return(
        <div key={v.id} style={S.row}><span style={{color:C.text}}>{pig?pig.tag:"—"} — {v.vaccine}</span><span style={{color:C.amber,fontWeight:700}}>Due in {daysDiff(v.nextDue)} days</span></div>
      );})}
    </div>}

    {/* Log vaccination */}
    <div style={{...S.card,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:12}}>💉 Log Vaccination</div>
      {saved&&<div style={{padding:8,background:C.accentSoft,borderRadius:7,marginBottom:10,color:C.accent,fontSize:13}}>✓ Vaccination recorded!</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={S.lbl}>Pig *</label>
          <select value={form.pigId} onChange={e=>setForm({...form,pigId:e.target.value})} style={S.inp}>
            <option value="">Select pig</option>
            {active.map(p=><option key={p.id} value={p.id}>{p.tag} — {p.stage}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Vaccine *</label>
          <select value={form.vaccine} onChange={e=>setForm({...form,vaccine:e.target.value})} style={S.inp}>
            {VACCINES.map(v=><option key={v}>{v}</option>)}
          </select>
        </div>
        <div><label style={S.lbl}>Date Given</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Next Due Date</label><input type="date" value={form.nextDue} onChange={e=>setForm({...form,nextDue:e.target.value})} style={S.inp}/></div>
        <div><label style={S.lbl}>Cost (RWF) — affects capital</label><input type="number" placeholder="e.g. 2000" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} style={S.inp}/>{form.cost&&parseFloat(form.cost)>0&&<div style={{fontSize:11,color:C.red,marginTop:3}}>💰 RWF {fmtNum(parseFloat(form.cost))} will be deducted from capital as Veterinary</div>}</div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes</label><input placeholder="Any observations..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={S.inp}/></div>
      </div>
      <button onClick={save} style={{...S.btn(C.accent),width:"100%",padding:11,fontSize:14}}>💉 Save Vaccination →</button>
    </div>

    {/* History */}
    <div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>📋 Vaccination History ({vaccinations.length})</div>
      {vaccinations.length===0&&<div style={{color:C.faint,fontSize:13}}>No vaccinations recorded yet.</div>}
      {vaccinations.slice().reverse().map((v,i)=>{
        const pig=pigs.find(p=>p.id===v.pigId);
        const dLeft=daysDiff(v.nextDue);
        return(<div key={i} style={S.row}>
          <div>
            <div style={{fontWeight:600,color:C.text}}>{pig?pig.tag:"—"} — {v.vaccine}</div>
            <div style={{fontSize:11,color:C.faint}}>Given: {v.date} · By: {v.givenBy}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:dLeft<0?C.red:dLeft<=14?C.amber:C.accent,fontWeight:600}}>
              Next: {v.nextDue}
            </div>
            <div style={{fontSize:10,color:C.faint}}>{dLeft<0?"Overdue":dLeft===0?"Today!":"In "+dLeft+" days"}</div>
          </div>
        </div>);
      })}
    </div>
  </div>);
}

/* ─── Capital Manager (Admin Only) ─── */
function CapitalManager({capital,setCapital,feeds,sales,expenses,incomes,pigs,user}){
  const isAdmin=isAdminUser(user);
  const [tab,setTab]=useState("overview");
  const [form,setForm]=useState({type:"income",category:"Other Income",amount:"",description:"",date:toDay()});
  const [saved,setSaved]=useState(false);
  const [editInitial,setEditInitial]=useState(false);
  const [newInitial,setNewInitial]=useState(String(capital.initial||""));
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState(null);

  const txs=capital.transactions||[];
  const balance=calcCapitalBalance(capital,feeds,sales,expenses,incomes);
  // Show actual income/expense from real data (not stale transactions)
  const incomeTotal=sales.reduce((s,x)=>s+(x.total||0),0)+incomes.reduce((s,x)=>s+(x.amount||0),0);
  const expenseTotal=feeds.reduce((s,x)=>s+(x.cost||0),0)+expenses.reduce((s,x)=>s+(x.amount||0),0);

  const INCOME_CATS=["Pig Sale","Piglet Sale","Manure Sale","Investment","Loan","Gift","Other Income"];
  const EXPENSE_CATS=["Feed Purchase","Pig Purchase","Veterinary","Medicine","Equipment","Labour","Transport","Utilities","Maintenance","Pig Death Loss","Other"];

  function addTx(){
    if(!form.amount||parseFloat(form.amount)<=0) return;
    const tx={id:uid(),type:form.type,category:form.category,amount:parseFloat(form.amount),description:form.description,date:form.date,createdAt:new Date().toISOString(),manual:true};
    setCapital(prev=>({...prev,transactions:[...(prev.transactions||[]),tx]}));
    setSaved(true);
    setForm({type:"income",category:"Other Income",amount:"",description:"",date:toDay()});
    setTimeout(()=>setSaved(false),2000);
  }

  function deleteTx(id){
    setCapital(prev=>({...prev,transactions:(prev.transactions||[]).filter(t=>t.id!==id)}));
  }

  function saveEdit(id){
    setCapital(prev=>({...prev,transactions:(prev.transactions||[]).map(t=>t.id===id?{...t,...editForm,amount:parseFloat(editForm.amount)||t.amount}:t)}));
    setEditId(null);setEditForm(null);
  }

  const [capForm,setCapForm]=useState({amount:"",description:"",date:toDay(),source:"Owner Investment"});
  const [capSaved,setCapSaved]=useState(false);
  const CAP_SOURCES=["Owner Investment","Bank Loan","External Investor","Grant/Subsidy","Personal Savings","Other"];

  function addCapital(){
    if(!capForm.amount||parseFloat(capForm.amount)<=0)return;
    const amt=parseFloat(capForm.amount);
    const tx={id:uid(),type:"income",category:"Capital Injection",amount:amt,description:(capForm.description||capForm.source)+" — added by admin",date:capForm.date,source:capForm.source,createdAt:new Date().toISOString(),manual:true};
    setCapital(prev=>({...prev,initial:(prev.initial||0)+amt,transactions:[...(prev.transactions||[]),tx]}));
    setCapSaved(true);
    setCapForm({amount:"",description:"",date:toDay(),source:"Owner Investment"});
    setTimeout(()=>setCapSaved(false),2500);
  }

  const tabs=[{id:"overview",l:"📊 Overview"},{id:"inject",l:"💵 Add Capital"},{id:"add",l:"➕ Transaction"},{id:"history",l:"📋 History"}];

  return(<div>
    <div style={S.h1}>💵 Capital Management</div>
    <div style={S.sub}>Track your business capital · Admin only</div>

    {/* Balance Banner */}
    <div style={{background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",borderRadius:14,padding:"18px 20px",marginBottom:16,position:"relative"}}>
      <div style={{fontSize:11,color:"rgba(74,222,128,.7)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Current Capital Balance</div>
      <div style={{fontSize:34,fontWeight:800,color:balance>=0?"#4ade80":"#f87171",marginBottom:8}}>{fmtRWF(balance)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[["💰 Initial Capital",fmtRWF(capital.initial||0),"rgba(74,222,128,.6)"],["📥 Total Income",fmtRWF(incomeTotal),"#34d399"],["📤 Total Expenses",fmtRWF(expenseTotal),"#f87171"]].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(255,255,255,.06)",borderRadius:9,padding:"8px 11px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.45)",marginBottom:3}}>{l}</div>
            <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      {isAdmin&&<button onClick={()=>{setEditInitial(!editInitial);setNewInitial(String(capital.initial||""));}} style={{position:"absolute",top:16,right:16,padding:"6px 12px",borderRadius:8,border:"1px solid rgba(74,222,128,.35)",background:"rgba(74,222,128,.1)",color:"#4ade80",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>⚙️ Edit Initial</button>}
    </div>

    {isAdmin&&editInitial&&<div style={{...S.card,marginBottom:14,border:"1px solid rgba(74,222,128,.3)"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:10}}>Set Initial Capital (before any transactions)</div>
      <div style={{display:"flex",gap:9}}>
        <input type="number" value={newInitial} onChange={e=>setNewInitial(e.target.value)} placeholder="e.g. 1000000" style={{...S.inp,flex:1}}/>
        <button onClick={()=>{setCapital(prev=>({...prev,initial:parseFloat(newInitial)||0}));setEditInitial(false);}} style={{...S.btn(C.accent),padding:"9px 16px"}}>Save</button>
        <button onClick={()=>setEditInitial(false)} style={{...S.btn("#374151"),padding:"9px 16px"}}>Cancel</button>
      </div>
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto"}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.muted,fontWeight:tab===t.id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.l}</button>)}
    </div>

    {/* Overview */}
    {tab==="overview"&&(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:16}}>
        <KPI icon="💵" label="Net Capital" value={fmtRWF(balance)} color={balance>=0?C.accent:C.red}/>
        <KPI icon="📥" label="Total Income" value={fmtRWF(incomeTotal)} color="#10b981"/>
        <KPI icon="📤" label="Total Expenses" value={fmtRWF(expenseTotal)} color={C.red}/>
        <KPI icon="🔢" label="Transactions" value={txs.length} color={C.blue}/>
        <KPI icon="💰" label="Initial Capital" value={fmtRWF(capital.initial||0)} color={C.purple}/>
        <KPI icon="📊" label="Net Margin" value={incomeTotal>0?((balance-capital.initial||0)/incomeTotal*100).toFixed(0)+"%":"—"} color={C.amber}/>
      </div>
      {/* Capital flow bar */}
      {(incomeTotal>0||expenseTotal>0)&&<div style={{...S.card,padding:"13px 16px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8}}>
          <span style={{fontWeight:700,color:C.text}}>Capital Flow</span>
          <span style={{color:balance>=0?C.accent:C.red,fontWeight:700}}>{balance>=0?"Positive":"Negative"} balance</span>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#10b981",marginBottom:3}}>
            <span>Income</span><span>{fmtRWF(incomeTotal)}</span>
          </div>
          <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.min((incomeTotal/Math.max(incomeTotal,expenseTotal))*100,100)+"%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:4}}/>
          </div>
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.red,marginBottom:3}}>
            <span>Expenses</span><span>{fmtRWF(expenseTotal)}</span>
          </div>
          <div style={{height:8,background:C.elevated,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.min((expenseTotal/Math.max(incomeTotal,expenseTotal))*100,100)+"%",background:"linear-gradient(90deg,#ef4444,#dc2626)",borderRadius:4}}/>
          </div>
        </div>
      </div>}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 Recent Transactions</div>
        {txs.length===0&&<div style={{color:C.faint,fontSize:13}}>No transactions yet. Add one to get started.</div>}
        {txs.slice().reverse().slice(0,8).map((tx,i)=>(
          <div key={i} style={{...S.row,flexWrap:"wrap",gap:4,borderBottom:"1px solid "+C.elevated,paddingBottom:6,marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:11,padding:"2px 7px",borderRadius:12,background:tx.type==="income"?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",color:tx.type==="income"?"#10b981":C.red,fontWeight:700}}>{tx.type==="income"?"↑ IN":"↓ OUT"}</span>
                <span style={{color:C.text,fontWeight:600,fontSize:12}}>{tx.category}</span>
              </div>
              {tx.description&&<div style={{fontSize:11,color:C.faint,marginTop:2,paddingLeft:38}}>{tx.description}</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:tx.type==="income"?"#10b981":C.red,fontSize:13}}>{tx.type==="income"?"+":"-"}{fmtRWF(tx.amount)}</div>
              <div style={{fontSize:10,color:C.faint}}>{tx.date}</div>
            </div>
          </div>
        ))}
        {txs.length>8&&<button onClick={()=>setTab("history")} style={{...S.btn(),width:"100%",marginTop:8,fontSize:12}}>View All {txs.length} Transactions →</button>}
      </div>
    </div>)}

    {/* Add Capital (Inject) */}
    {tab==="inject"&&(<div style={{maxWidth:500}}>
      {capSaved&&<div style={{padding:12,background:"rgba(74,222,128,.12)",border:"1px solid rgba(74,222,128,.35)",borderRadius:9,marginBottom:14,color:"#4ade80",fontSize:13,fontWeight:700}}>✅ Capital added successfully! Balance updated.</div>}
      <div style={{background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",borderRadius:14,padding:"16px 18px",marginBottom:14}}>
        <div style={{fontSize:11,color:"rgba(74,222,128,.7)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Current Balance Before Injection</div>
        <div style={{fontSize:26,fontWeight:800,color:balance>=0?"#4ade80":"#f87171"}}>{fmtRWF(balance)}</div>
        {capForm.amount&&parseFloat(capForm.amount)>0&&<div style={{fontSize:13,color:"rgba(74,222,128,.8)",marginTop:6}}>After injection → <strong style={{color:"#4ade80"}}>{fmtRWF(balance+parseFloat(capForm.amount))}</strong></div>}
      </div>
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,color:"#4ade80",marginBottom:4}}>💵 Inject Capital</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Add funds to your business capital — investment, loan, owner contribution, etc.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Amount (RWF) *</label>
            <input type="number" min="0" placeholder="e.g. 500000" value={capForm.amount} onChange={e=>setCapForm({...capForm,amount:e.target.value})} style={S.inp}/>
          </div>
          <div>
            <label style={S.lbl}>Source</label>
            <select value={capForm.source} onChange={e=>setCapForm({...capForm,source:e.target.value})} style={S.inp}>
              {CAP_SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Date</label>
            <input type="date" value={capForm.date} onChange={e=>setCapForm({...capForm,date:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Description (optional)</label>
            <input placeholder="e.g. Monthly owner contribution, bank loan disbursement…" value={capForm.description} onChange={e=>setCapForm({...capForm,description:e.target.value})} style={S.inp}/>
          </div>
        </div>
        {capForm.amount&&parseFloat(capForm.amount)>0&&<div style={{padding:"10px 14px",background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.25)",borderRadius:9,marginBottom:14,fontSize:13,color:"#4ade80",fontWeight:600}}>
          💰 Capital will increase by {fmtRWF(parseFloat(capForm.amount))} → New balance: {fmtRWF(balance+parseFloat(capForm.amount))}
        </div>}
        <button onClick={addCapital} disabled={!capForm.amount||parseFloat(capForm.amount)<=0}
          style={{background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",border:"none",borderRadius:10,padding:"13px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!capForm.amount||parseFloat(capForm.amount)<=0)?0.5:1}}>
          💵 Add Capital to Farm →
        </button>
        <div style={{fontSize:11,color:C.faint,marginTop:8,textAlign:"center"}}>This increases your initial capital base — visible in Overview and all balance calculations</div>
      </div>
    </div>)}

    {/* Add Transaction */}
    {tab==="add"&&(<div style={{maxWidth:500}}>
      {saved&&<div style={{padding:10,background:C.accentSoft,borderRadius:8,marginBottom:12,color:C.accent,fontSize:13,fontWeight:600}}>✅ Transaction recorded!</div>}
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>➕ Record Transaction</div>
        {/* Type toggle */}
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["income","📥 Income"],["expense","📤 Expense"]].map(([v,l])=>(
            <button key={v} onClick={()=>setForm({...form,type:v,category:v==="income"?"Other Income":"Other"})} style={{flex:1,padding:"10px",borderRadius:10,border:"2px solid "+(form.type===v?v==="income"?C.accent:C.red:C.border),background:form.type===v?v==="income"?C.accentSoft:"rgba(239,68,68,.07)":"transparent",color:form.type===v?v==="income"?C.accent:C.red:C.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={S.lbl}>Category</label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.inp}>
              {(form.type==="income"?INCOME_CATS:EXPENSE_CATS).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Date</label>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Amount (RWF) *</label>
            <input type="number" min="0" placeholder="e.g. 50000" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={S.inp}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={S.lbl}>Description</label>
            <input placeholder="e.g. Bought 50kg maize bran from market" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={S.inp}/>
          </div>
        </div>
        {form.amount&&parseFloat(form.amount)>0&&<div style={{padding:"9px 13px",background:form.type==="income"?C.accentSoft:"rgba(239,68,68,.06)",borderRadius:8,marginBottom:12,fontSize:13,color:form.type==="income"?C.accent:C.red,fontWeight:600}}>
          Capital will {form.type==="income"?"increase":"decrease"} by {fmtRWF(parseFloat(form.amount))} → New balance: {fmtRWF(balance+(form.type==="income"?parseFloat(form.amount):-parseFloat(form.amount)))}
        </div>}
        <button onClick={addTx} disabled={!form.amount||parseFloat(form.amount)<=0} style={{...S.btn(form.type==="income"?C.accent:C.red),width:"100%",padding:12,fontSize:14,opacity:!form.amount?0.5:1}}>
          {form.type==="income"?"📥 Record Income →":"📤 Record Expense →"}
        </button>
      </div>
    </div>)}

    {/* History */}
    {tab==="history"&&(<div>
      <div style={{background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",borderRadius:12,padding:"14px 18px",marginBottom:12}}>
        <div style={{fontSize:10,color:"rgba(74,222,128,.6)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>Current Balance</div>
        <div style={{fontSize:24,fontWeight:800,color:balance>=0?"#4ade80":"#f87171"}}>{fmtRWF(balance)}</div>
        <div style={{display:"flex",gap:14,marginTop:5,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"rgba(74,222,128,.6)"}}>↑ In: <b style={{color:"#4ade80"}}>{fmtRWF(incomeTotal)}</b></span>
          <span style={{fontSize:11,color:"rgba(248,113,113,.6)"}}>↓ Out: <b style={{color:"#f87171"}}>{fmtRWF(expenseTotal)}</b></span>
          <span style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>📋 {txs.length} tx</span>
        </div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 All Transactions ({txs.length})</div>
        {txs.length===0&&<div style={{color:C.faint,fontSize:13}}>No transactions recorded yet.</div>}
        {txs.slice().reverse().map((tx,i)=>(
        <div key={i} style={{...S.card,marginBottom:8,padding:"10px 13px",border:"1px solid "+(tx.type==="income"?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)")}}>
          {editId===tx.id?(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><label style={S.lbl}>Type</label>
                  <select value={editForm.type} onChange={e=>setEditForm({...editForm,type:e.target.value})} style={S.inp}><option value="income">Income</option><option value="expense">Expense</option></select>
                </div>
                <div><label style={S.lbl}>Amount</label><input type="number" value={editForm.amount} onChange={e=>setEditForm({...editForm,amount:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Category</label><input value={editForm.category} onChange={e=>setEditForm({...editForm,category:e.target.value})} style={S.inp}/></div>
                <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm,date:e.target.value})} style={S.inp}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Description</label><input value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} style={S.inp}/></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>saveEdit(tx.id)} style={{...S.btn(C.accent),flex:1,padding:"8px",fontSize:12}}>✓ Save</button>
                <button onClick={()=>{setEditId(null);setEditForm(null);}} style={{...S.btn("#374151"),flex:1,padding:"8px",fontSize:12}}>Cancel</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                  <span style={{fontSize:11,padding:"2px 7px",borderRadius:12,background:tx.type==="income"?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",color:tx.type==="income"?"#10b981":C.red,fontWeight:700}}>{tx.type==="income"?"↑ IN":"↓ OUT"}</span>
                  <span style={{color:C.text,fontWeight:600,fontSize:12}}>{tx.category}</span>
                  {tx.manual&&<span style={{fontSize:9,color:C.faint,background:C.elevated,padding:"1px 5px",borderRadius:5}}>manual</span>}
                </div>
                {tx.description&&<div style={{fontSize:11,color:C.faint,paddingLeft:38}}>{tx.description}</div>}
                <div style={{fontSize:10,color:C.faint,paddingLeft:38,marginTop:2}}>{tx.date}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontWeight:700,color:tx.type==="income"?"#10b981":C.red,fontSize:14}}>{tx.type==="income"?"+":"-"}{fmtRWF(tx.amount)}</div>
                <div style={{display:"flex",gap:5,marginTop:5,justifyContent:"flex-end"}}>
                  <button onClick={()=>{setEditId(tx.id);setEditForm({type:tx.type,category:tx.category,amount:String(tx.amount),description:tx.description||"",date:tx.date});}} style={{fontSize:10,padding:"3px 9px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>✏️ Edit</button>
                  <button onClick={()=>{if(window.confirm("Delete this transaction?"))deleteTx(tx.id);}} style={{fontSize:10,padding:"3px 9px",borderRadius:6,border:"1px solid rgba(239,68,68,.3)",background:"transparent",color:C.red,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                </div>
              </div>
            </div>
          )}
        </div>
        ))}
      </div>
    </div>)}
  </div>);
}

/* ─── Forgot Password Modal ─── */
function ForgotPasswordModal({initialEmail, onClose}){
  const [step,setStep]=useState("choose"); // choose | email_sent | otp_send | otp_enter
  const [email,setEmail]=useState(initialEmail||"");
  const [otpInput,setOtpInput]=useState("");
  const [otpUid,setOtpUid]=useState(null);
  const [countdown,setCountdown]=useState(0);
  const [err,setErr]=useState("");
  const [ok,setOk]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(countdown<=0) return;
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);

  /* Send Firebase reset email */
  async function sendEmail(){
    setErr("");
    const e=(email||"").trim();
    if(!e) return setErr("Please enter your email address.");
    setBusy(true);
    try{
      await _auth.sendPasswordResetEmail(e);
      setStep("email_sent");
    }catch(ex){
      setErr(ex.code==="auth/user-not-found"?"No account found with that email."
        :ex.code==="auth/invalid-email"?"Invalid email address."
        :"Error: "+ex.message);
    }
    setBusy(false);
  }

  /* Look up user by email to get their uid for OTP */
  async function startOTPFlow(){
    setErr("");
    const e=(email||"").trim();
    if(!e) return setErr("Please enter your email address first.");
    setBusy(true);
    try{
      // Query Firestore for user with this email
      const snap=await _db.collection("users").where("email","==",e).limit(1).get();
      if(snap.empty){ setErr("No account found with that email."); setBusy(false); return; }
      const profile=snap.docs[0].data();
      const uid=profile.uid;
      const waConf=getWAConfig();
      if(!waConf.enabled||!waConf.phone||!waConf.apikey){
        setErr("WhatsApp (CallMeBot) is not configured on this account. Use email recovery instead.");
        setBusy(false); return;
      }
      // Generate and store OTP
      const code=generateOTP();
      await storeOTP(uid,code);
      // Send via WhatsApp
      const msg=`🔐 FarmIQ Recovery OTP\n\nYour one-time code: *${code}*\n\nExpires in 10 minutes. Do not share this code.`;
      const url=`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waConf.phone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(waConf.apikey)}`;
      await fetch(url,{method:"GET",mode:"no-cors"});
      setOtpUid(uid);
      setCountdown(60);
      setStep("otp_enter");
      setOk("📱 OTP sent to the WhatsApp linked to this account.");
    }catch(ex){ setErr("Failed: "+ex.message); }
    setBusy(false);
  }

  /* Verify OTP then send reset email */
  async function verifyAndSend(){
    setErr("");
    if(otpInput.length!==6) return setErr("Please enter the full 6-digit code.");
    setBusy(true);
    try{
      const result=await verifyOTP(otpUid,otpInput);
      if(!result.ok){ setErr("❌ "+result.reason); setBusy(false); return; }
      // OTP valid → send Firebase reset email
      await _auth.sendPasswordResetEmail(email.trim());
      setStep("email_sent");
      setOk("✅ OTP verified! Reset link sent to "+email.trim()+".");
    }catch(ex){ setErr("Error: "+ex.message); }
    setBusy(false);
  }

  const overlay={position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16};
  const box={background:"#fff",borderRadius:18,width:"100%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,.2)",overflow:"hidden"};
  const msgBox=(type,txt)=>(<div style={{padding:"10px 14px",background:type==="err"?"rgba(239,68,68,.08)":"rgba(22,163,74,.08)",border:"1px solid "+(type==="err"?"rgba(239,68,68,.25)":"rgba(22,163,74,.25)"),borderRadius:9,color:type==="err"?"#dc2626":"#16a34a",fontSize:13,marginBottom:14,lineHeight:1.5}}>{txt}</div>);
  const inp3={background:"#f8fafc",border:"1.5px solid #e2e8f0",color:"#1e293b",borderRadius:10,padding:"11px 14px",width:"100%",fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  return(<div style={overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={box} className="slide-up">
      {/* Header */}
      <div style={{background:"linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)",padding:"22px 24px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>🔐 Account Recovery</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:3}}>Regain access to your FarmIQ account</div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.7)",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
      </div>

      <div style={{padding:"22px 24px 26px"}}>
        {err&&msgBox("err",err)}
        {ok&&msgBox("ok",ok)}

        {/* STEP: CHOOSE METHOD */}
        {step==="choose"&&(<div>
          <div style={{marginBottom:18}}>
            <label style={{fontSize:11,color:"#64748b",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Your Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inp3} autoCapitalize="none" onKeyDown={e=>e.key==="Enter"&&sendEmail()}/>
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:14,fontWeight:600}}>Choose recovery method:</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Email recovery */}
            <button onClick={sendEmail} disabled={busy} style={{padding:"13px 16px",borderRadius:12,border:"2px solid rgba(37,99,235,.25)",background:"rgba(37,99,235,.04)",color:"#1e293b",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:26}}>📧</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>Send Reset Link via Email</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Receive a secure link directly in your inbox</div>
                </div>
              </div>
            </button>
            {/* WhatsApp OTP */}
            <button onClick={startOTPFlow} disabled={busy} style={{padding:"13px 16px",borderRadius:12,border:"2px solid rgba(34,197,94,.25)",background:"rgba(34,197,94,.04)",color:"#1e293b",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:26}}>📱</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>Verify via WhatsApp OTP</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Get a 6-digit code on WhatsApp, then reset via email</div>
                </div>
              </div>
            </button>
          </div>
          {busy&&<div style={{textAlign:"center",marginTop:14,color:"#64748b",fontSize:13}}>⏳ Please wait…</div>}
        </div>)}

        {/* STEP: OTP ENTRY */}
        {step==="otp_enter"&&(<div>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:36,marginBottom:8}}>📲</div>
            <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:4}}>Enter WhatsApp OTP</div>
            <div style={{fontSize:12,color:"#64748b"}}>Check your WhatsApp for a 6-digit code · expires in 10 min</div>
          </div>
          {/* Digit boxes */}
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} style={{width:40,height:50,borderRadius:9,border:"2px solid "+(i<otpInput.length?"#16a34a":"#e2e8f0"),background:i<otpInput.length?"rgba(22,163,74,.06)":"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#1e293b",transition:"all .15s"}}>
                {otpInput[i]||""}
              </div>
            ))}
          </div>
          <input type="text" inputMode="numeric" maxLength={6} value={otpInput} onChange={e=>setOtpInput(e.target.value.replace(/\D/g,"").slice(0,6))} onKeyDown={e=>e.key==="Enter"&&otpInput.length===6&&verifyAndSend()} placeholder="Tap to enter code" style={{...inp3,letterSpacing:8,fontSize:20,textAlign:"center",fontWeight:700,marginBottom:14}}/>
          <button onClick={verifyAndSend} disabled={busy||otpInput.length<6} style={{width:"100%",padding:"12px",borderRadius:11,border:"none",background:otpInput.length===6?"linear-gradient(135deg,#16a34a,#15803d)":"#cbd5e1",color:"#fff",fontWeight:700,fontSize:14,cursor:otpInput.length===6?"pointer":"default",fontFamily:"inherit",marginBottom:10}}>
            {busy?"⏳ Verifying…":"✅ Verify Code & Send Reset Email"}
          </button>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={()=>{setStep("choose");setOtpInput("");setErr("");setOk("");}} style={{background:"none",border:"none",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
            <button onClick={()=>{if(countdown===0){setStep("choose");setOtpInput("");setErr("");setOk("");}else setErr(`Wait ${countdown}s before retrying.`);}} style={{background:"none",border:"none",color:countdown>0?"#94a3b8":"#16a34a",fontSize:12,cursor:countdown>0?"default":"pointer",fontFamily:"inherit"}}>
              {countdown>0?`Resend in ${countdown}s`:"Try again"}
            </button>
          </div>
        </div>)}

        {/* STEP: EMAIL SENT SUCCESS */}
        {step==="email_sent"&&(<div style={{textAlign:"center",padding:"10px 0"}}>
          <div style={{fontSize:54,marginBottom:14}}>✉️</div>
          <div style={{fontWeight:800,fontSize:18,color:"#1e293b",marginBottom:8}}>Check Your Email!</div>
          <div style={{fontSize:13,color:"#64748b",lineHeight:1.8,marginBottom:20}}>
            A password reset link has been sent to<br/>
            <strong style={{color:"#1e293b"}}>{(email||"").trim()}</strong>
          </div>
          <div style={{padding:"12px 16px",background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.15)",borderRadius:10,fontSize:12,color:"#3b82f6",textAlign:"left",lineHeight:1.7,marginBottom:18}}>
            💡 <strong>Tips:</strong> Check your spam/junk folder. The link expires in 1 hour. Click it on the same device for best results.
          </div>
          <button onClick={onClose} style={{width:"100%",padding:"12px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
            Done — Back to Sign In
          </button>
        </div>)}
      </div>
    </div>
  </div>);
}

/* ─── Login ─── */
function Login({setUser, pendingApproval, setPendingApproval}){
  const [tab,setTab]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:"",confirmPassword:""});
  const [err,setErr]=useState(pendingApproval?"Your account is pending admin approval. Please wait.":"");
  const [ok,setOk]=useState("");
  const [loading,setLoading]=useState(false);
  const [gLoading,setGLoading]=useState(false);
  const [showForgot,setShowForgot]=useState(false);

  /* ── helpers ── */
  const inp2={background:"#f8fafc",border:"1.5px solid #e2e8f0",color:"#1e293b",borderRadius:10,padding:"11px 14px",width:"100%",fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color .2s, box-shadow .2s"};
  const lbl2={fontSize:11,color:"#64748b",display:"block",marginBottom:5,letterSpacing:.5,fontWeight:600,textTransform:"uppercase"};
  const focusIn=e=>{e.target.style.borderColor="#16a34a";e.target.style.boxShadow="0 0 0 3px rgba(22,163,74,.1)";};
  const focusOut=e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";};

  async function handleFirebaseUser(fbUser, extraName){
    // Just ensure profile exists — onAuthStateChanged in App handles setUser
    const profile = await ensureUserProfile(fbUser, extraName?{name:extraName}:{});
    if(!profile){
      await _auth.signOut();
      setErr("Could not load your account. Check your internet and try again.");
      return;
    }
    const forceAdmin = isAdminEmail(fbUser.email);
    if(!profile.approved && !forceAdmin){
      await _auth.signOut();
      setErr("Your account is pending admin approval. Please wait.");
      return;
    }
    // DO NOT call setUser here — onAuthStateChanged handles it with correct role
  }


  async function login(){
    setErr("");
    if(!form.email||!form.password) return setErr("Please enter email and password.");
    setLoading(true);
    try{
      // signInWithEmailAndPassword triggers onAuthStateChanged automatically.
      // onAuthStateChanged already calls ensureUserProfile + setUser, so we
      // do NOT call handleFirebaseUser here — that would double the Firestore
      // round trip and slow down sign-in by ~1-2 seconds.
      await _auth.signInWithEmailAndPassword(form.email.trim(), form.password);
      // Keep spinner on — onAuthStateChanged will resolve and unmount this component.
      // setLoading(false) only runs if auth fails (catch block below).
      return;
    }catch(e){
      const msg=e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"
        ?"Incorrect email or password."
        :e.code==="auth/invalid-email"?"Invalid email address."
        :e.code==="auth/too-many-requests"?"Too many attempts. Try again later."
        :"Sign in failed: "+e.message;
      setErr(msg);
    }
    setLoading(false);
  }

  async function reg(){
    setErr("");
    if(!form.name||!form.email||!form.password) return setErr("Please fill in all required fields.");
    if(form.password.length<6) return setErr("Password must be at least 6 characters.");
    if(form.password!==form.confirmPassword) return setErr("Passwords do not match.");
    setLoading(true);
    try{
      const cred = await _auth.createUserWithEmailAndPassword(form.email.trim(), form.password);
      await ensureUserProfile(cred.user, {name:form.name.trim()});
      _profileCache.delete(cred.user.uid); // clear cache so next login reads fresh
      const isAdmin = isAdminEmail(form.email.trim());
      // Send welcome onboarding message to new worker's inbox
      if(!isAdmin){
        const workerName = form.name.trim();
        const now = new Date();
        const welcomeMsg = {
          id: uid(),
          text: "\uD83D\uDC4B Murakaza neza / Welcome, "+workerName+"!\n\nYour FarmIQ account has been created and is pending admin approval.\n\nOnce approved, you will be able to:\n\uD83D\uDC37 Register & track pigs\n\uD83D\uDCCB Submit daily care logs\n\uD83C\uDF3E Record feeding entries\n\uD83D\uDCCF Submit weekly pig assessments\n\u2705 View & complete assigned tasks\n\uD83D\uDCAC Receive messages from the admin\n\nA farm admin will review and activate your account shortly. We are glad to have you on the team! \uD83C\uDF31\n\n\u2014 FarmIQ Team",
          from: "FarmIQ System",
          date: toDay(),
          time: now.toLocaleTimeString("en-RW",{hour:"2-digit",minute:"2-digit"}),
          recipients: 1,
          recipientNames: workerName,
          recipientIds: [cred.user.uid],
          broadcast: false,
          system: true,
          welcome: true
        };
        try{ await jbinAppend("messages", welcomeMsg); }catch(e){ console.warn("Welcome msg failed",e); }
      }
      await _auth.signOut();
      if(isAdmin){
        setOk("Admin account created! You can now sign in.");
      } else {
        setOk("Account created! An admin must approve your access before you can sign in.");
      }
      setTab("login");
      setForm({name:"",email:"",password:"",confirmPassword:""});
    }catch(e){
      const msg=e.code==="auth/email-already-in-use"?"An account with that email already exists."
        :e.code==="auth/invalid-email"?"Invalid email address."
        :"Registration failed: "+e.message;
      setErr(msg);
    }
    setLoading(false);
  }

  async function googleSignIn(){
    setErr("");setGLoading(true);
    try{
      // Use redirect (not popup) — popup opens as a new tab on mobile Chrome,
      // which breaks Firebase sessionStorage across origins (storage partitioning).
      // Redirect keeps everything in the same window/origin, so no state is lost.
      await _auth.signInWithRedirect(_googleProvider);
      // Page navigates away — nothing executes after this line.
      // Result is handled by getRedirectResult() in the App init useEffect.
    }catch(e){
      const msg=
        e.code==="auth/unauthorized-domain"?"This domain is not authorized. Add it in Firebase → Authentication → Authorized Domains.":
        e.code==="auth/network-request-failed"?"No internet connection. Try email/password sign-in instead.":
        e.code==="auth/too-many-requests"?"Too many attempts. Please wait and try again.":
        "Google sign-in failed: "+e.message;
      if(msg) setErr(msg);
      setGLoading(false);
    }
    // Note: setGLoading(false) is intentionally omitted on success —
    // the page will navigate away, and on return the login state is
    // resolved by onAuthStateChanged.
  }

  async function forgotPassword(){
    if(!form.email) return setErr("Enter your email above first.");
    try{
      await _auth.sendPasswordResetEmail(form.email.trim());
      setOk("Password reset email sent! Check your inbox.");
    }catch(e){setErr("Could not send reset email: "+e.message);}
  }

  return(<>
    <div style={{minHeight:"100vh",background:"linear-gradient(150deg,#eef5ee 0%,#f0fdf4 50%,#e8f5e9 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <div style={{position:"fixed",top:"-10%",right:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(22,163,74,.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"-10%",left:"-5%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.06) 0%,transparent 70%)",pointerEvents:"none"}}/>

      <div style={{width:440,background:"#fff",borderRadius:22,boxShadow:"0 28px 70px rgba(0,0,0,.10),0 6px 20px rgba(22,163,74,.09),0 1px 3px rgba(0,0,0,.06)",overflow:"hidden",border:"1px solid rgba(22,163,74,.12)"}} className="fade-in">

        {/* ── Header ── */}
        <div style={{background:"linear-gradient(135deg,#071410 0%,#0f2316 55%,#0a1f12 100%)",padding:"32px 36px 28px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"rgba(74,222,128,.06)",border:"1px solid rgba(74,222,128,.12)"}}/>
          <div style={{position:"absolute",bottom:-20,left:-20,width:90,height:90,borderRadius:"50%",background:"rgba(74,222,128,.04)"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:14,background:"rgba(74,222,128,.15)",border:"1px solid rgba(74,222,128,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🐷</div>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>FarmIQ</div>
              <div style={{fontSize:9.5,color:"rgba(74,222,128,.8)",letterSpacing:2.5,textTransform:"uppercase",marginTop:2,fontWeight:600}}>AI Pig Farm · Rwanda</div>
            </div>
          </div>
          <div style={{position:"relative",marginTop:18,fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.5}}>
            {tab==="login"?"Welcome back! Sign in to manage your farm.":"Create your account to get started."}
          </div>
          <div style={{position:"absolute",top:16,right:16,padding:"4px 10px",borderRadius:20,background:navigator.onLine?"rgba(74,222,128,.18)":"rgba(239,68,68,.18)",border:"1px solid "+(navigator.onLine?"rgba(74,222,128,.35)":"rgba(239,68,68,.4)"),fontSize:10,color:navigator.onLine?"#4ade80":"#f87171",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:navigator.onLine?"#4ade80":"#f87171",display:"inline-block",animation:"pulse 2s ease-in-out infinite"}}/>
            {navigator.onLine?"ONLINE":"OFFLINE"}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{padding:"28px 36px 32px"}}>
          {/* Tabs */}
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:11,padding:3,marginBottom:24,gap:2}}>
            {[["login","🔐 Sign In"],["register","✏️ Register"]].map(([t,l])=>(
              <button key={t} onClick={()=>{setTab(t);setErr("");setOk("");}} style={{flex:1,padding:"9px 6px",border:"none",borderRadius:9,background:tab===t?"#fff":"transparent",color:tab===t?"#1e293b":"#64748b",fontWeight:tab===t?700:500,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all .2s",boxShadow:tab===t?"0 1px 6px rgba(0,0,0,.08)":"none"}}>{l}</button>
            ))}
          </div>

          {/* Google Button */}
          <button onClick={googleSignIn} disabled={gLoading||loading} style={{width:"100%",padding:"11px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",color:"#374151",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:18,transition:"all .2s",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {gLoading
              ?<span className="spin" style={{width:16,height:16,border:"2px solid #e2e8f0",borderTop:"2px solid #4285f4",borderRadius:"50%",display:"inline-block"}}/>
              :<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.5 2.7 13.6l7.8 6C12.4 13.2 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17z"/><path fill="#FBBC05" d="M10.5 28.4A14.8 14.8 0 0 1 9.5 24c0-1.5.3-3 .7-4.4l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.3z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.2 1.5-5 2.3-8.4 2.3-6.2 0-11.5-4.2-13.4-9.8l-7.8 6C6.7 42.5 14.7 48 24 48z"/></svg>
            }
            {gLoading?"Signing in…":"Continue with Google"}
          </button>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>OR</span>
            <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
          </div>

          {/* Fields */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {tab==="register"&&(
              <div>
                <label style={lbl2}>Full Name <span style={{color:"#ef4444"}}>*</span></label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Jean Pierre Habimana" style={inp2} onFocus={focusIn} onBlur={focusOut}/>
              </div>
            )}
            <div>
              <label style={lbl2}>Email Address <span style={{color:"#ef4444"}}>*</span></label>
              <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" style={inp2} autoCapitalize="none" autoCorrect="off" onFocus={focusIn} onBlur={focusOut}/>
            </div>
            <div>
              <label style={lbl2}>Password <span style={{color:"#ef4444"}}>*</span></label>
              <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&(tab==="login"?login():reg())} style={inp2} onFocus={focusIn} onBlur={focusOut}/>
            </div>
            {tab==="register"&&(
              <div>
                <label style={lbl2}>Confirm Password <span style={{color:"#ef4444"}}>*</span></label>
                <input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&reg()} style={inp2} onFocus={focusIn} onBlur={focusOut}/>
              </div>
            )}
          </div>

          {/* Forgot password */}
          {tab==="login"&&<div style={{textAlign:"right",marginTop:8}}>
            <button onClick={()=>setShowForgot(true)} style={{background:"none",border:"none",color:"#16a34a",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,padding:0}}>Forgot password?</button>
          </div>}

          {/* Messages */}
          {err&&<div style={{marginTop:14,padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:9,color:"#b91c1c",fontSize:13,display:"flex",alignItems:"center",gap:8}}><span>⚠️</span><span>{err}</span></div>}
          {ok&&<div style={{marginTop:14,padding:"10px 14px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:9,color:"#15803d",fontSize:13,display:"flex",alignItems:"center",gap:8}}><span>✅</span><span>{ok}</span></div>}

          {/* Submit */}
          <button onClick={tab==="login"?login:reg} disabled={loading||gLoading} style={{marginTop:20,width:"100%",padding:"13px",borderRadius:11,border:"none",background:loading?"#86efac":"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",fontWeight:700,fontSize:14.5,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":"0 4px 18px rgba(22,163,74,.35)",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><span className="spin" style={{width:14,height:14,border:"2px solid rgba(255,255,255,.4)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"}}/>Processing…</>
            :tab==="login"?"Sign In →":"Create Account →"}
          </button>

          {tab==="register"&&<div style={{marginTop:14,padding:"10px 14px",background:"rgba(59,130,246,.06)",border:"1px solid rgba(59,130,246,.15)",borderRadius:9,fontSize:12,color:"#3b82f6",lineHeight:1.6}}>
            ℹ️ New accounts require <strong>admin approval</strong> before you can log in. The farm admin will be notified.
          </div>}
        </div>
      </div>
    </div>
    {showForgot&&<ForgotPasswordModal initialEmail={form.email} onClose={()=>setShowForgot(false)}/>}
  </>);
}

/* ─── Rwanda Market ─── */
/* ═══════════════════════════════════════════════════
   BUSINESS PROFILE — admin sets farm name, address,
   TIN, phone, email used on all PDF documents
═══════════════════════════════════════════════════ */
function getBusinessProfile(){
  // Read from Firestore cache first, then localStorage
  try{
    if(_latestFarmData&&_latestFarmData.bizProfile&&_latestFarmData.bizProfile.farmName){
      return _latestFarmData.bizProfile;
    }
  }catch(e){}
  try{return JSON.parse(localStorage.getItem("farmiq_biz_profile")||"{}");}catch{return {};}
}
async function setBusinessProfile(p){
  try{localStorage.setItem("farmiq_biz_profile",JSON.stringify(p));}catch(e){}
  try{await setOnlineFarmData({bizProfile:p});}catch(e){console.warn("bizProfile save failed",e);}
}

function BusinessProfileSettings(){
  const saved=getBusinessProfile();
  const [form,setForm]=useState({
    farmName:saved.farmName||"",
    ownerName:saved.ownerName||"",
    address:saved.address||"",
    district:saved.district||"",
    province:saved.province||"",
    phone:saved.phone||"",
    email:saved.email||"",
    tin:saved.tin||"",
    bankName:saved.bankName||"",
    bankAccount:saved.bankAccount||"",
    established:saved.established||"",
    licenseNo:saved.licenseNo||"",
  });
  const [saved2,setSaved2]=useState(false);

  const [saving,setSaving]=useState(false);

  async function save(){
    setSaving(true);
    try{
      await setBusinessProfile(form);
    }catch(e){}
    setSaving(false);
    setSaved2(true);
    setTimeout(()=>setSaved2(false),3000);
  }

  return(<div className="fade-in">
    <div style={S.h1}>🏢 Business Profile</div>
    <div style={S.sub}>This information appears on all PDF reports, payslips, and bank-ready documents</div>
    {saved2&&<div style={{padding:"10px 14px",background:"rgba(22,163,74,.1)",border:"1px solid rgba(22,163,74,.3)",borderRadius:9,marginBottom:14,color:C.accent,fontWeight:600}}>✅ Business profile saved! All PDFs will now include this information.</div>}
    <div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:14}}>🏪 Farm Identity</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Farm / Business Name *</label><input value={form.farmName} onChange={e=>setForm({...form,farmName:e.target.value})} placeholder="e.g. Ndayishimiye Pig Farm Ltd" style={S.inp}/></div>
        <div><label style={S.lbl}>Owner / Manager Name *</label><input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} placeholder="e.g. Alexis Ndayishimiye" style={S.inp}/></div>
        <div><label style={S.lbl}>Year Established</label><input value={form.established} onChange={e=>setForm({...form,established:e.target.value})} placeholder="e.g. 2020" style={S.inp}/></div>
        <div><label style={S.lbl}>Business License No.</label><input value={form.licenseNo} onChange={e=>setForm({...form,licenseNo:e.target.value})} placeholder="e.g. RDB/2020/001234" style={S.inp}/></div>
        <div><label style={S.lbl}>TIN (Tax ID Number)</label><input value={form.tin} onChange={e=>setForm({...form,tin:e.target.value})} placeholder="e.g. 123456789" style={S.inp}/></div>
      </div>
    </div>
    <div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.blue,marginBottom:14}}>📍 Physical Address</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Street / Village Address *</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="e.g. KG 12 Ave, Kacyiru" style={S.inp}/></div>
        <div><label style={S.lbl}>District</label><input value={form.district} onChange={e=>setForm({...form,district:e.target.value})} placeholder="e.g. Gasabo" style={S.inp}/></div>
        <div><label style={S.lbl}>Province</label><input value={form.province} onChange={e=>setForm({...form,province:e.target.value})} placeholder="e.g. Kigali City" style={S.inp}/></div>
      </div>
    </div>
    <div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:14}}>📞 Contact Information</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={S.lbl}>Phone Number</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="e.g. +250 788 123 456" style={S.inp}/></div>
        <div><label style={S.lbl}>Email Address</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="e.g. farm@example.com" style={S.inp}/></div>
      </div>
    </div>
    <div style={{...S.card,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:14}}>🏦 Banking Details (for loan documents)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><label style={S.lbl}>Bank Name</label><input value={form.bankName} onChange={e=>setForm({...form,bankName:e.target.value})} placeholder="e.g. Bank of Kigali" style={S.inp}/></div>
        <div><label style={S.lbl}>Account Number</label><input value={form.bankAccount} onChange={e=>setForm({...form,bankAccount:e.target.value})} placeholder="e.g. 00012345678" style={S.inp}/></div>
      </div>
    </div>
    <div style={{...S.card,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.2)",marginBottom:14}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:8}}>📄 <strong>Preview on PDF header:</strong></div>
      <div style={{fontFamily:"monospace",fontSize:11,color:C.text,lineHeight:1.8,background:"#fff",padding:"12px 14px",borderRadius:8,border:"1px solid "+C.border}}>
        <div style={{fontWeight:700,fontSize:13}}>{form.farmName||"[Farm Name]"}</div>
        <div>{form.ownerName?`Owner: ${form.ownerName}`:""}</div>
        <div>{form.address||"[Address]"}{form.district?`, ${form.district}`:""}{form.province?`, ${form.province}`:""}, Rwanda</div>
        <div>Tel: {form.phone||"[Phone]"} {form.email?`| Email: ${form.email}`:""}</div>
        {form.tin&&<div>TIN: {form.tin}</div>}
        {form.licenseNo&&<div>License: {form.licenseNo}</div>}
      </div>
    </div>
    <button onClick={save} disabled={saving} style={{...S.btn(),width:"100%",padding:13,fontSize:14,opacity:saving?0.7:1}}>
      {saving?"⏳ Saving…":"💾 Save Business Profile →"}
    </button>
  </div>);
}

/* ═══════════════════════════════════════════════════
   MARKET PRICE SURVEY — admin inputs real field prices
   from visits to Kimironko, Nyabugogo, etc.
   These override the built-in estimates and are used
   for ALL herd valuations, PDFs, and decisions.
═══════════════════════════════════════════════════ */
function getMarketSurveys(){
  // Try Firestore cache first (most up to date), fall back to dedicated localStorage key
  try{
    if(_latestFarmData&&Array.isArray(_latestFarmData.marketSurveys)&&_latestFarmData.marketSurveys.length>0){
      return _latestFarmData.marketSurveys;
    }
  }catch(e){}
  try{return JSON.parse(localStorage.getItem("farmiq_market_surveys")||"[]");}catch{return [];}
}
async function saveMarketSurveys(arr){
  try{localStorage.setItem("farmiq_market_surveys",JSON.stringify(arr));}catch(e){}
  try{await setOnlineFarmData({marketSurveys:arr});}catch(e){console.warn("marketSurveys save failed",e);}
}
function getLatestSurveyPrices(){
  const surveys=getMarketSurveys();
  if(surveys.length===0)return null;
  // Latest survey = first item (surveys are newest-first after sort)
  const latest=surveys.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  return latest.prices;
}
// Returns price from latest survey or falls back to computed price
function getSurveyOrEstimatedPrice(stage,weight){
  const surveyPrices=getLatestSurveyPrices();
  if(surveyPrices){
    if(weight>=80&&surveyPrices.heavy) return Math.round(weight*surveyPrices.heavy);
    if(surveyPrices[stage]) return surveyPrices[stage];
  }
  return getMarketPrice(stage,weight);
}

const SURVEY_STAGES=["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];
const SURVEY_DESCS={Piglet:"Under 10kg (per head)",Weaner:"10–25kg (per head)",Grower:"25–50kg (per head)",Finisher:"50–80kg (per head)",Gilt:"Young female (per head)",Sow:"Breeding female (per head)",Boar:"Breeding male (per head)",heavy:"Over 80kg (per kg live weight)"};

function MarketPriceSurvey({pigs}){
  const [surveys,setSurveys]=useState(()=>getMarketSurveys());
  const [tab,setTab]=useState("new");
  const [form,setForm]=useState({
    date:toDay(),
    market:MARKETS[0],
    surveyedBy:"",
    notes:"",
    prices:{Piglet:"",Weaner:"",Grower:"",Finisher:"",Gilt:"",Sow:"",Boar:"",heavy:""},
  });
  const [saved,setSaved]=useState(false);
  const [delConfirm,setDelConfirm]=useState(null);
  const [priceError,setPriceError]=useState(false);

  const active=pigs.filter(p=>p.status==="active");
  const latestPrices=getLatestSurveyPrices();

  const [saving,setSaving]=useState(false);

  async function submitSurvey(){
    const prices={};
    Object.entries(form.prices).forEach(([k,v])=>{if(v&&parseFloat(v)>0)prices[k]=parseFloat(v);});
    if(Object.keys(prices).length===0){
      setPriceError(true);
      setTimeout(()=>setPriceError(false),4000);
      return;
    }
    setPriceError(false);
    setSaving(true);
    const survey={
      id:uid(),
      date:form.date,
      market:form.market,
      surveyedBy:form.surveyedBy,
      notes:form.notes,
      prices,
      createdAt:new Date().toISOString(),
    };
    const updated=[survey,...surveys];
    setSurveys(updated);
    await saveMarketSurveys(updated);
    setSaving(false);
    setSaved(true);
    setForm({date:toDay(),market:MARKETS[0],surveyedBy:"",notes:"",prices:{Piglet:"",Weaner:"",Grower:"",Finisher:"",Gilt:"",Sow:"",Boar:"",heavy:""}});
    setTimeout(()=>setSaved(false),3000);
  }

  function deleteSurvey(id){
    const updated=surveys.filter(s=>s.id!==id);
    setSurveys(updated);
    saveMarketSurveys(updated);
    setDelConfirm(null);
  }

  // Compare survey price vs built-in estimate
  function priceChange(stage,surveyPrice){
    const est=getMarketPrice(stage,stage==="heavy"?85:50);
    if(!surveyPrice)return null;
    const diff=((surveyPrice-est)/est*100).toFixed(0);
    return diff;
  }

  const tabs=[{id:"new",l:"📝 New Survey"},{id:"history",l:"📋 Survey History"},{id:"analysis",l:"📊 Price Analysis"}];

  return(<div className="fade-in">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={S.h1}>📊 Market Price Survey</div>
        <div style={S.sub}>Record actual prices from field visits · These update herd valuations & PDFs</div>
      </div>
      {latestPrices&&<div style={{padding:"6px 12px",background:"rgba(22,163,74,.08)",border:"1px solid rgba(22,163,74,.2)",borderRadius:8,fontSize:11,color:C.accent,fontWeight:600}}>
        ✅ Using survey prices from {(surveys.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]||{}).date}
      </div>}
    </div>

    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:9,border:"none",background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.muted,fontWeight:tab===t.id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>)}
    </div>

    {tab==="new"&&(<div style={{maxWidth:600}}>
      {saved&&<div style={{padding:"10px 14px",background:"rgba(22,163,74,.1)",border:"1px solid rgba(22,163,74,.3)",borderRadius:9,marginBottom:14,color:C.accent,fontWeight:600}}>✅ Market survey saved! Herd valuations updated.</div>}
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 Survey Details</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={S.lbl}>Survey Date *</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.inp}/></div>
          <div><label style={S.lbl}>Market / Location *</label>
            <select value={form.market} onChange={e=>setForm({...form,market:e.target.value})} style={S.inp}>
              {MARKETS.map(m=><option key={m}>{m}</option>)}
              <option value="Other">Other (see notes)</option>
            </select>
          </div>
          <div><label style={S.lbl}>Surveyed By</label><input value={form.surveyedBy} onChange={e=>setForm({...form,surveyedBy:e.target.value})} placeholder="Your name or worker name" style={S.inp}/></div>
          <div><label style={S.lbl}>Notes</label><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Market conditions, season, demand…" style={S.inp}/></div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>💰 Prices Observed (RWF) — leave blank if not observed</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {SURVEY_STAGES.map(stage=>(
            <div key={stage}>
              <label style={S.lbl}>{stage} <span style={{fontWeight:400,color:C.faint}}>({SURVEY_DESCS[stage]})</span></label>
              <input type="number" value={form.prices[stage]} onChange={e=>setForm({...form,prices:{...form.prices,[stage]:e.target.value}})}
                placeholder={`Est: ${fmtRWF(RW_BASE_PRICES[stage]?.base||0)}`} style={S.inp}/>
            </div>
          ))}
          <div>
            <label style={S.lbl}>Heavy Pig <span style={{fontWeight:400,color:C.faint}}>(per kg live weight)</span></label>
            <input type="number" value={form.prices.heavy} onChange={e=>setForm({...form,prices:{...form.prices,heavy:e.target.value}})}
              placeholder={`Est: RWF ${RW_BASE_PRICES.heavy.base}/kg`} style={S.inp}/>
          </div>
        </div>
        <div style={{padding:"10px 13px",background:"rgba(37,99,235,.05)",border:"1px solid rgba(37,99,235,.15)",borderRadius:9,marginBottom:12,fontSize:12,color:C.muted}}>
          ℹ️ Prices entered here will <strong>override the built-in estimates</strong> and be used in herd valuations, P&L, profit forecasts, and all PDF reports.
        </div>
        {priceError&&<div style={{padding:"10px 14px",background:"rgba(239,68,68,.08)",border:"2px solid rgba(239,68,68,.35)",borderRadius:9,marginBottom:10,color:"#dc2626",fontSize:13,fontWeight:600}}>
          ⚠️ Please enter at least one price before saving. The placeholder values (Est: RWF...) are not saved — type real prices into the fields.
        </div>}
        <button onClick={submitSurvey} disabled={saving} style={{...S.btn(),width:"100%",padding:12,fontSize:14,opacity:saving?0.7:1}}>
          {saving?"⏳ Saving…":"📊 Save Market Survey →"}
        </button>
      </div>

      {/* Current herd re-valued at survey prices */}
      {latestPrices&&active.length>0&&(<div style={{...S.card,marginTop:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>🐷 Herd Re-valued at Latest Survey Prices</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{borderBottom:"1px solid "+C.border}}>
              {["Tag","Stage","Weight","Survey Value","Built-in Est.","Difference"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",color:C.muted,fontWeight:600}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {active.map(p=>{
                const sv=getSurveyOrEstimatedPrice(p.stage,p.weight);
                const bv=getMarketPrice(p.stage,p.weight);
                const diff=sv-bv;
                return(<tr key={p.id} style={{borderBottom:"1px solid "+C.border+"44"}}>
                  <td style={{padding:"6px 10px",fontWeight:700}}>{p.tag}</td>
                  <td style={{padding:"6px 10px",color:C.muted}}>{p.stage}</td>
                  <td style={{padding:"6px 10px",color:C.muted}}>{p.weight}kg</td>
                  <td style={{padding:"6px 10px",fontWeight:700,color:C.accent}}>{fmtRWF(sv)}</td>
                  <td style={{padding:"6px 10px",color:C.faint}}>{fmtRWF(bv)}</td>
                  <td style={{padding:"6px 10px",color:diff>0?"#10b981":diff<0?C.red:C.muted,fontWeight:700}}>{diff>0?"+":""}{fmtRWF(diff)}</td>
                </tr>);
              })}
              <tr style={{borderTop:"2px solid "+C.border,background:"rgba(22,163,74,.03)"}}>
                <td colSpan={3} style={{padding:"8px 10px",fontWeight:700}}>TOTAL HERD VALUE</td>
                <td style={{padding:"8px 10px",fontWeight:800,color:C.accent,fontSize:14}}>{fmtRWF(active.reduce((s,p)=>s+getSurveyOrEstimatedPrice(p.stage,p.weight),0))}</td>
                <td style={{padding:"8px 10px",color:C.faint}}>{fmtRWF(active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0))}</td>
                <td style={{padding:"8px 10px",fontWeight:700,color:active.reduce((s,p)=>s+getSurveyOrEstimatedPrice(p.stage,p.weight),0)-active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0)>0?"#10b981":C.red}}>
                  {fmtRWF(active.reduce((s,p)=>s+getSurveyOrEstimatedPrice(p.stage,p.weight),0)-active.reduce((s,p)=>s+getMarketPrice(p.stage,p.weight),0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>)}
    </div>)}

    {tab==="history"&&(<div>
      {surveys.length===0&&<div style={{...S.card,textAlign:"center",color:C.faint,fontSize:13,padding:40}}>No surveys recorded yet. Go to "New Survey" to add your first field visit.</div>}
      {surveys.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((s,i)=>(
        <div key={s.id} style={{...S.card,marginBottom:12,border:i===0?"1.5px solid rgba(22,163,74,.35)":"1px solid "+C.border}}>
          {delConfirm===s.id?(
            <div style={{padding:"12px 0"}}>
              <div style={{fontSize:13,color:C.red,marginBottom:10}}>⚠️ Delete this survey? This cannot be undone.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>deleteSurvey(s.id)} style={{...S.btn(C.red),flex:1}}>🗑️ Yes, Delete</button>
                <button onClick={()=>setDelConfirm(null)} style={{...S.btn("#374151"),flex:1}}>Cancel</button>
              </div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,color:C.text,fontSize:14}}>📍 {s.market}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.date} {s.surveyedBy?`· By ${s.surveyedBy}`:""}{i===0?" · 🟢 ACTIVE":""}</div>
                  {s.notes&&<div style={{fontSize:11,color:C.faint,marginTop:2,fontStyle:"italic"}}>{s.notes}</div>}
                </div>
                <button onClick={()=>setDelConfirm(s.id)} style={{...S.btn(C.red),padding:"4px 10px",fontSize:11}}>🗑️</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                {Object.entries(s.prices).map(([stage,price])=>(
                  <div key={stage} style={{background:C.elevated,borderRadius:8,padding:"7px 10px",border:"1px solid "+C.border}}>
                    <div style={{fontSize:10,color:C.faint}}>{stage==="heavy"?"Heavy (per kg)":stage}</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.accent,marginTop:2}}>{fmtRWF(price)}</div>
                    <div style={{fontSize:9,color:C.muted,marginTop:1}}>
                      {priceChange(stage,price)!=null&&(<span style={{color:parseFloat(priceChange(stage,price))>0?"#10b981":parseFloat(priceChange(stage,price))<0?C.red:C.muted}}>
                        {parseFloat(priceChange(stage,price))>0?"+":""}{priceChange(stage,price)}% vs est.
                      </span>)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>)}

    {tab==="analysis"&&(<div>
      <div style={{...S.card,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>📊 Survey vs Built-in Estimates</div>
        {surveys.length===0&&<div style={{color:C.faint,fontSize:13}}>No surveys yet — add field surveys to compare.</div>}
        {SURVEY_STAGES.map(stage=>{
          const svPrices=surveys.filter(s=>s.prices[stage]).map(s=>({date:s.date,price:s.prices[stage],market:s.market}));
          const est=RW_BASE_PRICES[stage]?.base||0;
          const latest=svPrices.sort((a,b)=>b.date.localeCompare(a.date))[0];
          if(!latest)return null;
          const diff=((latest.price-est)/est*100).toFixed(1);
          return(<div key={stage} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <span style={{fontWeight:700,color:C.text,fontSize:13}}>{stage}</span>
                <span style={{fontSize:11,color:C.faint,marginLeft:8}}>{svPrices.length} survey{svPrices.length!==1?"s":""}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,color:C.accent,fontSize:13}}>{fmtRWF(latest.price)} <span style={{fontSize:10,color:parseFloat(diff)>0?"#10b981":parseFloat(diff)<0?C.red:C.faint}}>({parseFloat(diff)>0?"+":""}{diff}%)</span></div>
                <div style={{fontSize:10,color:C.faint}}>Built-in: {fmtRWF(est)}</div>
              </div>
            </div>
            <div style={{height:6,background:C.elevated,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.min(100,(latest.price/Math.max(est*2,1))*100)+"%",background:parseFloat(diff)>5?"#10b981":parseFloat(diff)<-5?C.red:C.amber,borderRadius:3,transition:"width .5s"}}/>
            </div>
          </div>);
        })}
      </div>

      {/* Price trends over time */}
      {surveys.length>=2&&(<div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📈 Price Trend (All Surveys)</div>
        {SURVEY_STAGES.slice(0,4).map(stage=>{
          const pts=surveys.filter(s=>s.prices[stage]).map(s=>({date:s.date.slice(5),price:s.prices[stage]})).sort((a,b)=>a.date.localeCompare(b.date));
          if(pts.length<2)return null;
          const maxP=Math.max(...pts.map(p=>p.price));
          const minP=Math.min(...pts.map(p=>p.price));
          const range=maxP-minP||1;
          return(<div key={stage} style={{marginBottom:14}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:600}}>{stage}</div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",height:50}}>
              {pts.map((p,i)=>{
                const ht=Math.max(((p.price-minP)/range)*40+8,8);
                return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{fontSize:8,color:C.faint}}>{Math.round(p.price/1000)}k</div>
                  <div style={{width:"100%",height:ht,background:i===pts.length-1?"linear-gradient(180deg,"+C.accent+",#10b981)":"linear-gradient(180deg,#93c5fd,#60a5fa)",borderRadius:3}}/>
                  <div style={{fontSize:7,color:C.faint}}>{p.date}</div>
                </div>);
              })}
            </div>
          </div>);
        })}
      </div>)}
    </div>)}
  </div>);
}

/* ═══════════════════════════════════════════════════
   PROFESSIONAL PDF GENERATOR — bank-loan ready
   Includes business address, proper financial tables,
   verified math, collateral (herd value), etc.
═══════════════════════════════════════════════════ */
function ProfessionalPDFGenerator({pigs,feeds,sales,logs,expenses,incomes,reproductions,stock,capital,users}){
  const [docType,setDocType]=useState("full");
  const [generating,setGenerating]=useState(false);
  const [popupBlocked,setPopupBlocked]=useState(false);
  const biz=getBusinessProfile();
  const latestSurveyPrices=getLatestSurveyPrices();

  const active=pigs.filter(p=>p.status==="active");
  const sold=pigs.filter(p=>p.status==="sold");

  // All math verified centrally
  const totalSalesInc=sales.reduce((s,l)=>s+(l.total||0),0);
  const totalOtherInc=incomes.reduce((s,l)=>s+(l.amount||0),0);
  const totalInc=totalSalesInc+totalOtherInc;
  const totalFeedExp=feeds.reduce((s,l)=>s+(l.cost||0),0);
  const totalOtherExp=expenses.reduce((s,l)=>s+(l.amount||0),0);
  const totalExp=totalFeedExp+totalOtherExp;
  const netProfit=totalInc-totalExp;
  const profitMargin=totalInc>0?((netProfit/totalInc)*100).toFixed(1):0;
  const herdValue=active.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0);
  const capitalBalance=calcCapitalBalance(capital||{initial:0},feeds,sales,expenses,incomes);

  // Break-even
  const avgSalePig=sales.length>0?Math.round(totalSalesInc/sales.length):0;
  const avgCostPig=sales.length>0?Math.round(totalExp/Math.max(sales.length,1)):0;
  const breakEven=avgSalePig>avgCostPig?Math.ceil(totalExp/(avgSalePig-avgCostPig)):null;

  // Expense breakdown
  const expByCat={};
  expenses.forEach(e=>{const k=e.category||"Other";expByCat[k]=(expByCat[k]||0)+(e.amount||0);});
  feeds.forEach(f=>{expByCat["Feed Purchase"]=(expByCat["Feed Purchase"]||0)+(f.cost||0);});

  // Income breakdown
  const incByCat={};
  sales.forEach(s=>{incByCat["Pig Sales"]=(incByCat["Pig Sales"]||0)+(s.total||0);});
  incomes.forEach(i=>{const k=i.category||"Other Income";incByCat[k]=(incByCat[k]||0)+(i.amount||0);});

  // Monthly P&L (last 6 months)
  const months6=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months6.push(d.toISOString().slice(0,7));}
  const monthlyPL=months6.map(m=>{
    const mInc=sales.filter(s=>(s.date||"").startsWith(m)).reduce((s,x)=>s+(x.total||0),0)+incomes.filter(x=>(x.date||"").startsWith(m)).reduce((s,x)=>s+(x.amount||0),0);
    const mExp=feeds.filter(f=>(f.date||"").startsWith(m)).reduce((s,x)=>s+(x.cost||0),0)+expenses.filter(e=>(e.date||"").startsWith(m)).reduce((s,x)=>s+(x.amount||0),0);
    return{month:m,income:mInc,expense:mExp,profit:mInc-mExp};
  });

  function generatePDF(){
    setGenerating(true);
    const bizHeader=biz.farmName?`
      <div style="background:linear-gradient(135deg,#0a1f10,#122918);color:#fff;padding:28px 36px;margin-bottom:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">${biz.farmName}</div>
            <div style="font-size:13px;opacity:.75;margin-bottom:2px;">${biz.ownerName?`Owner: ${biz.ownerName} | `:""}${biz.address||""}${biz.district?`, ${biz.district}`:""}${biz.province?`, ${biz.province}`:""}, Rwanda</div>
            <div style="font-size:12px;opacity:.65;">Tel: ${biz.phone||"—"} | Email: ${biz.email||"—"}${biz.tin?` | TIN: ${biz.tin}`:""}</div>
            ${biz.licenseNo?`<div style="font-size:11px;opacity:.55;">Business License: ${biz.licenseNo}</div>`:""}
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;opacity:.55;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Document Type</div>
            <div style="font-size:15px;font-weight:700;color:#4ade80;">${DOC_TITLES[docType]||"Farm Report"}</div>
            <div style="font-size:11px;opacity:.55;margin-top:4px;">Generated: ${toDay()}</div>
            ${latestSurveyPrices?`<div style="font-size:10px;opacity:.45;margin-top:2px;">Prices: Field Survey Data</div>`:`<div style="font-size:10px;opacity:.45;margin-top:2px;">Prices: Market Estimates</div>`}
          </div>
        </div>
      </div>
    `:`<div style="background:#0a1f10;color:#fff;padding:20px 30px;font-size:18px;font-weight:800;">🐷 FarmIQ Rwanda — ${DOC_TITLES[docType]||"Farm Report"} | ${toDay()}</div>`;

    const css=`
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;font-size:12px;line-height:1.5;}
      .page{max-width:800px;margin:0 auto;}
      h2{font-size:15px;font-weight:700;color:#0a1f10;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #16a34a;}
      h3{font-size:13px;font-weight:700;color:#1a3828;margin:14px 0 8px;}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;}
      th{background:#f0fdf4;color:#1a3828;font-weight:700;padding:7px 10px;text-align:left;border:1px solid #d1fae5;}
      td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top;}
      tr:nth-child(even) td{background:#f9fafb;}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0;}
      .kpi{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;}
      .kpi-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
      .kpi-value{font-size:18px;font-weight:800;color:#16a34a;}
      .kpi-red .kpi-value{color:#dc2626;} .kpi-red{border-color:#fecaca;background:#fff5f5;}
      .kpi-blue .kpi-value{color:#2563eb;} .kpi-blue{border-color:#bfdbfe;background:#eff6ff;}
      .kpi-amber .kpi-value{color:#d97706;} .kpi-amber{border-color:#fde68a;background:#fffbeb;}
      .kpi-purple .kpi-value{color:#7c3aed;} .kpi-purple{border-color:#ddd6fe;background:#faf5ff;}
      .profit-pos{color:#16a34a;font-weight:700;} .profit-neg{color:#dc2626;font-weight:700;}
      .badge-green{background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
      .badge-red{background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
      .badge-amber{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
      .section-note{background:#f0fdf4;border-left:3px solid #16a34a;padding:8px 12px;margin:10px 0;font-size:11px;color:#374151;}
      .total-row td{background:#0a1f10!important;color:#fff!important;font-weight:700;}
      .sub-total td{background:#f0fdf4;font-weight:700;color:#166534;}
      .disclaimer{font-size:10px;color:#9ca3af;text-align:center;margin-top:24px;padding:12px;border-top:1px solid #e5e7eb;}
      @media print{body{font-size:11px;}.page{max-width:100%;}}
    `;

    let body="";
    const DOC_TITLES_LOCAL={full:"Complete Farm Report",pnl:"Profit & Loss Statement",loan:"Bank Loan Application Report",herd:"Herd Inventory & Valuation",capital:"Capital & Balance Sheet"};

    // ── KPI Summary ──
    body+=`<div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Total Income</div><div class="kpi-value">RWF ${Math.round(totalInc).toLocaleString()}</div></div>
      <div class="kpi kpi-red"><div class="kpi-label">Total Expenses</div><div class="kpi-value">RWF ${Math.round(totalExp).toLocaleString()}</div></div>
      <div class="kpi ${netProfit>=0?"":"kpi-red"}"><div class="kpi-label">Net Profit</div><div class="kpi-value ${netProfit>=0?"profit-pos":"profit-neg"}">RWF ${Math.round(netProfit).toLocaleString()}</div></div>
      <div class="kpi kpi-purple"><div class="kpi-label">Herd Value</div><div class="kpi-value">RWF ${Math.round(herdValue).toLocaleString()}</div></div>
    </div>`;

    // ── P&L Statement ──
    if(docType==="full"||docType==="pnl"||docType==="loan"){
      body+=`<h2>📊 Profit & Loss Statement</h2>
      <div class="section-note">All figures in Rwandan Francs (RWF). Financial period: All time as of ${toDay()}.</div>
      <h3>Revenue Breakdown</h3>
      <table><thead><tr><th>Category</th><th style="text-align:right">Amount (RWF)</th><th style="text-align:right">% of Total</th></tr></thead><tbody>
        ${Object.entries(incByCat).map(([cat,amt])=>`<tr><td>${cat}</td><td style="text-align:right;font-weight:700;color:#16a34a">${Math.round(amt).toLocaleString()}</td><td style="text-align:right;color:#6b7280">${totalInc>0?((amt/totalInc)*100).toFixed(1):0}%</td></tr>`).join("")}
        <tr class="sub-total"><td><strong>TOTAL REVENUE</strong></td><td style="text-align:right"><strong>RWF ${Math.round(totalInc).toLocaleString()}</strong></td><td style="text-align:right"><strong>100%</strong></td></tr>
      </tbody></table>
      <h3>Expense Breakdown</h3>
      <table><thead><tr><th>Category</th><th style="text-align:right">Amount (RWF)</th><th style="text-align:right">% of Total</th></tr></thead><tbody>
        ${Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`<tr><td>${cat}</td><td style="text-align:right;font-weight:700;color:#dc2626">${Math.round(amt).toLocaleString()}</td><td style="text-align:right;color:#6b7280">${totalExp>0?((amt/totalExp)*100).toFixed(1):0}%</td></tr>`).join("")}
        <tr class="sub-total"><td><strong>TOTAL EXPENSES</strong></td><td style="text-align:right"><strong>RWF ${Math.round(totalExp).toLocaleString()}</strong></td><td style="text-align:right"><strong>100%</strong></td></tr>
      </tbody></table>
      <table><tbody>
        <tr><td>Gross Revenue</td><td style="text-align:right">RWF ${Math.round(totalInc).toLocaleString()}</td></tr>
        <tr><td>Total Expenses</td><td style="text-align:right;color:#dc2626">– RWF ${Math.round(totalExp).toLocaleString()}</td></tr>
        <tr class="total-row"><td><strong>NET PROFIT / (LOSS)</strong></td><td style="text-align:right"><strong>${netProfit>=0?"RWF":"(RWF)"} ${Math.abs(Math.round(netProfit)).toLocaleString()}</strong></td></tr>
        <tr><td>Profit Margin</td><td style="text-align:right;font-weight:700;color:${netProfit>=0?"#16a34a":"#dc2626"}">${profitMargin}%</td></tr>
        <tr><td>Capital Balance</td><td style="text-align:right;font-weight:700;color:#7c3aed">RWF ${Math.round(capitalBalance).toLocaleString()}</td></tr>
      </tbody></table>`;

      // Monthly trends
      body+=`<h3>Monthly Performance Trend</h3>
      <table><thead><tr><th>Month</th><th style="text-align:right">Income (RWF)</th><th style="text-align:right">Expenses (RWF)</th><th style="text-align:right">Net Profit (RWF)</th><th>Status</th></tr></thead><tbody>
        ${monthlyPL.map(m=>`<tr>
          <td>${m.month}</td>
          <td style="text-align:right;color:#16a34a">${m.income>0?m.income.toLocaleString():"—"}</td>
          <td style="text-align:right;color:#dc2626">${m.expense>0?m.expense.toLocaleString():"—"}</td>
          <td style="text-align:right;font-weight:700;color:${m.profit>=0?"#16a34a":"#dc2626"}">${m.profit>=0?"+":""}${m.profit.toLocaleString()}</td>
          <td>${m.profit>0?'<span class="badge-green">Profit</span>':m.profit<0?'<span class="badge-red">Loss</span>':'<span class="badge-amber">Break-even</span>'}</td>
        </tr>`).join("")}
      </tbody></table>`;
    }

    // ── Break-even analysis ──
    if(docType==="full"||docType==="pnl"||docType==="loan"){
      body+=`<h2>📐 Break-Even Analysis</h2>
      <table><tbody>
        <tr><td>Average Sale Price per Pig</td><td style="text-align:right;font-weight:700">RWF ${avgSalePig.toLocaleString()}</td></tr>
        <tr><td>Average Cost Allocated per Pig</td><td style="text-align:right;font-weight:700">RWF ${avgCostPig.toLocaleString()}</td></tr>
        <tr><td>Contribution Margin per Pig</td><td style="text-align:right;font-weight:700;color:${avgSalePig>avgCostPig?"#16a34a":"#dc2626"}">RWF ${(avgSalePig-avgCostPig).toLocaleString()}</td></tr>
        <tr><td>Total Pigs Sold (to date)</td><td style="text-align:right">${sales.length}</td></tr>
        ${breakEven!==null?`<tr><td>Pigs Required to Break Even</td><td style="text-align:right;font-weight:700;color:#7c3aed">${breakEven} pigs</td></tr>
        <tr><td>Break-Even Status</td><td style="text-align:right">${sales.length>=breakEven?'<span class="badge-green">✅ Break-even Reached</span>':'<span class="badge-amber">⏳ '+sales.length+'/'+breakEven+' pigs</span>'}</td></tr>`:"<tr><td colspan='2'>Insufficient data for break-even calculation.</td></tr>"}
      </tbody></table>`;
    }

    // ── Herd Inventory ──
    if(docType==="full"||docType==="herd"||docType==="loan"){
      body+=`<h2>🐷 Herd Inventory & Valuation</h2>
      <div class="section-note">Prices based on: ${latestSurveyPrices?"Field Market Survey":"Estimated Rwanda Market Prices"} as of ${toDay()}.</div>
      <table><thead><tr><th>Tag</th><th>Breed</th><th>Gender</th><th>Stage</th><th style="text-align:right">Weight (kg)</th><th style="text-align:right">Market Value (RWF)</th><th>Status</th></tr></thead><tbody>
        ${active.map(p=>{const val=latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight);return`<tr><td><strong>${p.tag}</strong></td><td>${p.breed||"—"}</td><td>${p.gender||"—"}</td><td>${p.stage}</td><td style="text-align:right">${p.weight}</td><td style="text-align:right;font-weight:700;color:#16a34a">${val.toLocaleString()}</td><td><span class="badge-green">Active</span></td></tr>`;}).join("")}
        <tr class="total-row"><td colspan="5"><strong>TOTAL HERD VALUE</strong></td><td style="text-align:right"><strong>RWF ${Math.round(herdValue).toLocaleString()}</strong></td><td></td></tr>
      </tbody></table>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Active Pigs</div><div class="kpi-value">${active.length}</div></div>
        <div class="kpi kpi-blue"><div class="kpi-label">Pigs Sold</div><div class="kpi-value">${sold.length}</div></div>
        <div class="kpi kpi-amber"><div class="kpi-label">Avg Weight</div><div class="kpi-value">${active.length>0?Math.round(active.reduce((s,p)=>s+(p.weight||0),0)/active.length):0}kg</div></div>
        <div class="kpi kpi-purple"><div class="kpi-label">Herd Value</div><div class="kpi-value" style="font-size:13px">RWF ${Math.round(herdValue).toLocaleString()}</div></div>
      </div>`;
    }

    // ── Loan-specific sections ──
    if(docType==="loan"){
      const sows=active.filter(p=>p.stage==="Sow");
      const boars=active.filter(p=>p.stage==="Boar");
      body+=`<h2>🏦 Loan Application Summary</h2>
      <div class="section-note">This section summarizes the farm's financial position and collateral for bank review.</div>
      <table><tbody>
        <tr><td><strong>Business Name</strong></td><td>${biz.farmName||"[Farm Name — set in Business Profile]"}</td></tr>
        <tr><td><strong>Owner / Applicant</strong></td><td>${biz.ownerName||"—"}</td></tr>
        <tr><td><strong>Business Address</strong></td><td>${[biz.address,biz.district,biz.province,"Rwanda"].filter(Boolean).join(", ")||"—"}</td></tr>
        <tr><td><strong>TIN Number</strong></td><td>${biz.tin||"—"}</td></tr>
        <tr><td><strong>Business License</strong></td><td>${biz.licenseNo||"—"}</td></tr>
        <tr><td><strong>Established</strong></td><td>${biz.established||"—"}</td></tr>
        <tr><td><strong>Bank / Account</strong></td><td>${biz.bankName||"—"} ${biz.bankAccount?`| Account: ${biz.bankAccount}`:""}</td></tr>
      </tbody></table>
      <h3>💰 Financial Collateral</h3>
      <table><tbody>
        <tr><td>Live Herd Market Value</td><td style="text-align:right;font-weight:700">RWF ${Math.round(herdValue).toLocaleString()}</td></tr>
        <tr><td>Capital Balance (Cash Equivalent)</td><td style="text-align:right;font-weight:700">RWF ${Math.round(capitalBalance).toLocaleString()}</td></tr>
        <tr><td>Annual Revenue (Annualized)</td><td style="text-align:right;font-weight:700">RWF ${Math.round(totalInc).toLocaleString()}</td></tr>
        <tr><td>Net Annual Profit</td><td style="text-align:right;font-weight:700;color:${netProfit>=0?"#16a34a":"#dc2626"}">RWF ${Math.round(netProfit).toLocaleString()}</td></tr>
        <tr class="total-row"><td><strong>ESTIMATED TOTAL COLLATERAL</strong></td><td style="text-align:right"><strong>RWF ${Math.round(herdValue+capitalBalance).toLocaleString()}</strong></td></tr>
      </tbody></table>
      <h3>🐷 Breeding Stock (Core Business Assets)</h3>
      <table><tbody>
        <tr><td>Sows (Breeding Females)</td><td style="text-align:right;font-weight:700">${sows.length} head</td><td style="text-align:right">RWF ${Math.round(sows.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr>
        <tr><td>Boars (Breeding Males)</td><td style="text-align:right;font-weight:700">${boars.length} head</td><td style="text-align:right">RWF ${Math.round(boars.reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr>
        <tr><td>Growing Stock</td><td style="text-align:right;font-weight:700">${active.filter(p=>!["Sow","Boar"].includes(p.stage)).length} head</td><td style="text-align:right">RWF ${Math.round(active.filter(p=>!["Sow","Boar"].includes(p.stage)).reduce((s,p)=>s+(latestSurveyPrices?getSurveyOrEstimatedPrice(p.stage,p.weight):getMarketPrice(p.stage,p.weight)),0)).toLocaleString()}</td></tr>
      </tbody></table>`;
    }

    // ── Capital ──
    if(docType==="full"||docType==="capital"){
      body+=`<h2>💵 Capital & Balance Sheet</h2>
      <table><tbody>
        <tr><td>Opening Capital</td><td style="text-align:right">RWF ${Math.round(capital?.initial||0).toLocaleString()}</td></tr>
        <tr><td>+ Total Revenue (Sales + Other Income)</td><td style="text-align:right;color:#16a34a">+ RWF ${Math.round(totalInc).toLocaleString()}</td></tr>
        <tr><td>– Total Expenses (Feed + Operations)</td><td style="text-align:right;color:#dc2626">– RWF ${Math.round(totalExp).toLocaleString()}</td></tr>
        <tr class="total-row"><td><strong>CAPITAL BALANCE (DERIVED)</strong></td><td style="text-align:right"><strong>RWF ${Math.round(capitalBalance).toLocaleString()}</strong></td></tr>
        <tr><td>+ Live Herd Market Value</td><td style="text-align:right;color:#7c3aed">RWF ${Math.round(herdValue).toLocaleString()}</td></tr>
        <tr class="sub-total"><td><strong>TOTAL NET WORTH (Capital + Herd)</strong></td><td style="text-align:right"><strong>RWF ${Math.round(capitalBalance+herdValue).toLocaleString()}</strong></td></tr>
      </tbody></table>`;
    }

    body+=`<div class="disclaimer">
      This document was generated by FarmIQ Rwanda Farm Management System on ${toDay()}. 
      ${biz.farmName?`Prepared by: ${biz.farmName}${biz.tin?" | TIN: "+biz.tin:""}.`:""} 
      All financial figures are derived from recorded farm transactions. 
      ${latestSurveyPrices?"Herd valuations use actual field survey prices.":"Herd valuations use estimated Rwanda market prices."}
      For official financial reporting, please consult a certified accountant.
    </div>`;

    const DOC_TITLES={full:"Complete Farm Report",pnl:"Profit & Loss Statement",loan:"Bank Loan Application Report",herd:"Herd Inventory & Valuation",capital:"Capital & Balance Sheet"};
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${biz.farmName||"FarmIQ"} — ${DOC_TITLES[docType]}</title><style>${css}</style></head><body><div class="page">${bizHeader}${body}</div></body></html>`;
    // Open window SYNCHRONOUSLY before any async ops — avoids popup blocker on mobile
    const win=window.open("","_blank","width=900,height=700,scrollbars=yes,resizable=yes");
    if(win){
      win.document.write(html);
      win.document.close();
      win.onload=()=>{setTimeout(()=>{win.focus();win.print();},400);};
      setTimeout(()=>win.print(),800); // fallback if onload already fired
    } else {
      // Popup blocked — download as HTML file instead
      setPopupBlocked(true);
      setTimeout(()=>setPopupBlocked(false),6000);
      const blob=new Blob([html],{type:"text/html"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`FarmIQ_${docType}_${toDay()}.html`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    }
    setGenerating(false);
  }

  const DOC_OPTIONS=[
    {id:"full",label:"📄 Complete Farm Report",desc:"Full report: P&L, herd, capital, trends — general use"},
    {id:"pnl",label:"💹 Profit & Loss Statement",desc:"Revenue, expenses, profit margin, monthly trends"},
    {id:"loan",label:"🏦 Bank Loan Application",desc:"Formal report with business address, collateral, TIN — bank-ready"},
    {id:"herd",label:"🐷 Herd Inventory & Valuation",desc:"All pigs with market values, weight, breed"},
    {id:"capital",label:"💵 Capital & Balance Sheet",desc:"Opening capital, cash flow, net worth"},
  ];

  return(<div className="fade-in">
    <div style={S.h1}>📄 Professional PDF Reports</div>
    <div style={S.sub}>Bank-ready documents with business address, verified financials, and proper formatting</div>

    {(!biz.farmName||!biz.address)&&<div style={{padding:"12px 16px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:10,marginBottom:16,fontSize:13,color:C.amber}}>
      ⚠️ <strong>Business Profile incomplete.</strong> Go to <strong>🏢 Business Profile</strong> to add your farm name, address, and TIN. This information will appear on all PDF documents.
    </div>}

    {/* Business profile preview */}
    {biz.farmName&&<div style={{...S.card,marginBottom:16,background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.2)"}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:6}}>📋 Business details on documents:</div>
      <div style={{fontWeight:700,color:C.text}}>{biz.farmName}</div>
      <div style={{fontSize:12,color:C.muted}}>{[biz.address,biz.district,biz.province,"Rwanda"].filter(Boolean).join(", ")}</div>
      <div style={{fontSize:11,color:C.faint}}>Tel: {biz.phone||"—"} | TIN: {biz.tin||"—"}</div>
    </div>}

    {/* Financial snapshot */}
    <div style={{...S.card,marginBottom:16,background:"rgba(22,163,74,.03)"}}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📊 Verified Financial Summary</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
        {[
          ["💚 Total Income",fmtRWF(totalInc),"#10b981"],
          ["🔴 Total Expenses",fmtRWF(totalExp),C.red],
          [netProfit>=0?"✅ Net Profit":"⚠️ Net Loss",fmtRWF(netProfit),netProfit>=0?"#16a34a":C.red],
          ["🐷 Herd Value",fmtRWF(herdValue),C.purple],
          ["💵 Capital Balance",fmtRWF(capitalBalance),C.blue],
          ["📐 Profit Margin",profitMargin+"%",parseFloat(profitMargin)>0?"#16a34a":C.red],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:C.elevated,borderRadius:8,padding:"8px 11px",border:"1px solid "+C.border}}>
            <div style={{fontSize:10,color:C.faint}}>{l}</div>
            <div style={{fontSize:14,fontWeight:700,color:c,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      {breakEven&&<div style={{padding:"8px 12px",background:"rgba(99,102,241,.05)",border:"1px solid rgba(99,102,241,.2)",borderRadius:8,fontSize:12,color:"#6366f1"}}>
        📐 Break-even: {breakEven} pigs to sell | Current: {sales.length} sold {sales.length>=breakEven?"✅ Reached!":"⏳"}
      </div>}
      {latestSurveyPrices&&<div style={{fontSize:11,color:C.accent,marginTop:8}}>✅ Using field survey prices for herd valuation</div>}
    </div>

    {/* Document type selection */}
    <div style={S.card}>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 Select Document Type</div>
      {DOC_OPTIONS.map(opt=>(
        <div key={opt.id} onClick={()=>setDocType(opt.id)} style={{
          padding:"12px 14px",borderRadius:10,marginBottom:8,cursor:"pointer",
          background:docType===opt.id?"rgba(22,163,74,.08)":C.elevated,
          border:docType===opt.id?"1.5px solid rgba(22,163,74,.4)":"1px solid "+C.border,
          transition:"all .15s"
        }}>
          <div style={{fontWeight:700,fontSize:13,color:docType===opt.id?C.accent:C.text}}>{opt.label}</div>
          <div style={{fontSize:11,color:C.faint,marginTop:3}}>{opt.desc}</div>
          {opt.id==="loan"&&<div style={{fontSize:10,color:C.amber,marginTop:4}}>⚠️ Requires complete Business Profile for maximum effectiveness</div>}
        </div>
      ))}
      {popupBlocked&&<div style={{padding:"10px 14px",background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.35)",borderRadius:9,marginBottom:10,fontSize:12,color:C.amber}}>
        ⚠️ Popup was blocked — your PDF has been downloaded as an HTML file instead. Open it in Chrome and use Print → Save as PDF.
      </div>}
      <button onClick={generatePDF} disabled={generating} style={{...S.btn(),width:"100%",padding:13,fontSize:14,marginTop:4}}>
        {generating?"⏳ Generating PDF…":"📄 Generate & Print PDF →"}
      </button>
      <div style={{fontSize:11,color:C.faint,marginTop:8,textAlign:"center"}}>PDF opens in a new tab · If blocked, file downloads automatically</div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════
   SYSTEM RESET — admin only, clears all farm data
   Requires 3-step confirmation for safety
═══════════════════════════════════════════════════ */
function SystemReset({pigs,setPigs,feeds,setFeeds,sales,setSales,logs,setLogs,expenses,setExpenses,incomes,setIncomes,messages,setMessages,reproductions,setReproductions,stock,setStock,tasks,setTasks,vaccinations,setVaccinations,pendingPigs,setPendingPigs,assessments,setAssessments,salaries,setSalaries,advances,setAdvances,capital,setCapital,sessions,setSessions}){
  const [step,setStep]=useState(0);
  const [confirmText,setConfirmText]=useState("");
  const [resetting,setResetting]=useState(false);
  const [done,setDone]=useState(false);
  const [whatToReset,setWhatToReset]=useState({
    pigs:true,feeds:true,sales:true,logs:true,expenses:true,
    incomes:true,messages:false,reproductions:true,stock:false,
    tasks:false,vaccinations:false,capital:false,salaries:false,advances:false,
  });

  const selectedCount=Object.values(whatToReset).filter(Boolean).length;
  const REQUIRED_TEXT="RESET FARM DATA";

  async function performReset(){
    setResetting(true);
    // Build the full reset payload first, then do ONE atomic write
    // Using separate .update() calls bypasses _latestFarmData cache and races with polling
    const patch = {};
    if(whatToReset.pigs){setPigs(INIT_PIGS);setPendingPigs([]);setAssessments([]);patch.pigs=INIT_PIGS;patch.pendingPigs=[];patch.assessments=[];}
    if(whatToReset.feeds){setFeeds([]);patch.feeds=[];}
    if(whatToReset.sales){setSales([]);patch.sales=[];}
    if(whatToReset.logs){setLogs([]);patch.logs=[];}
    if(whatToReset.expenses){setExpenses([]);patch.expenses=[];}
    if(whatToReset.incomes){setIncomes([]);patch.incomes=[];}
    if(whatToReset.messages){setMessages([]);patch.messages=[];}
    if(whatToReset.reproductions){setReproductions([]);patch.reproductions=[];}
    if(whatToReset.stock){setStock(INIT_STOCK);patch.stock=INIT_STOCK;}
    if(whatToReset.tasks){setTasks([]);patch.tasks=[];}
    if(whatToReset.vaccinations){setVaccinations([]);patch.vaccinations=[];}
    if(whatToReset.salaries){setSalaries([]);patch.salaries=[];}
    if(whatToReset.advances){setAdvances([]);patch.advances=[];}
    if(whatToReset.capital){setCapital({initial:0,transactions:[]});patch.capital={initial:0,transactions:[]};}
    // Atomic full-document replace — prevents polling from restoring wiped data
    // We must replace the ENTIRE document, not just patch, so nothing survives
    try{
      const current=_latestFarmData||{};
      const fullReset={
        ...current,
        ...patch,
        updatedAt:new Date().toISOString(),
        _resetAt:new Date().toISOString(),
      };
      _latestFarmData=fullReset;
      lsSetFarm(fullReset);
      await FS_FARM_DOC.set(fullReset);
    }catch(e){
      console.error("Reset write failed",e);
    }
    setResetting(false);setDone(true);setStep(0);setConfirmText("");
  }

  if(done)return(<div className="fade-in" style={{...S.card,textAlign:"center",padding:40}}>
    <div style={{fontSize:40,marginBottom:12}}>✅</div>
    <div style={{fontSize:18,fontWeight:700,color:C.accent,marginBottom:8}}>System Reset Complete</div>
    <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Selected data has been cleared. The system is now fresh.</div>
    <button onClick={()=>setDone(false)} style={{...S.btn(),padding:"10px 24px"}}>Start Fresh →</button>
  </div>);

  return(<div className="fade-in">
    <div style={S.h1}>🔄 System Reset</div>
    <div style={S.sub}>Selectively clear farm data — use this to start a new season or clean test data</div>

    {/* Warning banner */}
    <div style={{padding:"14px 16px",background:"rgba(239,68,68,.08)",border:"2px solid rgba(239,68,68,.35)",borderRadius:12,marginBottom:16}}>
      <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:6}}>⚠️ WARNING — This action is PERMANENT</div>
      <div style={{fontSize:12,color:"#991b1b",lineHeight:1.7}}>
        • Deleted data <strong>cannot be recovered</strong><br/>
        • This affects ALL users of this farm system<br/>
        • Worker accounts will NOT be deleted<br/>
        • Business profile and market surveys will NOT be deleted<br/>
        • Consider downloading PDF reports before resetting
      </div>
    </div>

    {step===0&&(<>
      <div style={S.card}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📋 Select What to Reset</div>
        {[
          {key:"pigs",label:"🐷 Pig Records",desc:"All pig registrations (resets to 3 demo pigs)"},
          {key:"feeds",label:"🌾 Feeding Logs",desc:"All feeding records and costs"},
          {key:"sales",label:"🏷️ Sales Records",desc:"All pig sale transactions"},
          {key:"logs",label:"📋 Daily Logs",desc:"All daily health reports"},
          {key:"expenses",label:"🛒 Expenses",desc:"All purchase and expense records"},
          {key:"incomes",label:"💚 Income Records",desc:"All manual income entries"},
          {key:"reproductions",label:"🐖 Reproduction Records",desc:"All mating and farrowing records"},
          {key:"capital",label:"💵 Capital Balance",desc:"Reset capital to zero"},
          {key:"messages",label:"📢 Messages",desc:"All admin-to-worker messages"},
          {key:"tasks",label:"✅ Tasks",desc:"All worker tasks"},
          {key:"vaccinations",label:"💉 Vaccinations",desc:"All vaccination records"},
          {key:"salaries",label:"💼 Salaries",desc:"All salary and payroll records"},
          {key:"advances",label:"💸 Advance Requests",desc:"All salary advance requests"},
          {key:"stock",label:"📦 Stock Inventory",desc:"Reset to default stock items"},
        ].map(({key,label,desc})=>(
          <div key={key} onClick={()=>setWhatToReset(p=>({...p,[key]:!p[key]}))} style={{
            display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:9,marginBottom:7,cursor:"pointer",
            background:whatToReset[key]?"rgba(239,68,68,.06)":"rgba(0,0,0,.02)",
            border:whatToReset[key]?"1.5px solid rgba(239,68,68,.35)":"1px solid "+C.border,
            transition:"all .15s"
          }}>
            <div style={{width:20,height:20,borderRadius:6,background:whatToReset[key]?C.red:"transparent",border:"2px solid "+(whatToReset[key]?C.red:C.border),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:12,fontWeight:700}}>
              {whatToReset[key]?"✓":""}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:whatToReset[key]?C.red:C.text}}>{label}</div>
              <div style={{fontSize:11,color:C.faint}}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{padding:"10px 12px",background:"rgba(245,158,11,.06)",borderRadius:8,border:"1px solid rgba(245,158,11,.2)",marginTop:4,fontSize:12,color:C.amber}}>
          {selectedCount} categor{selectedCount===1?"y":"ies"} selected for reset
        </div>
      </div>
      <button onClick={()=>{if(selectedCount>0)setStep(1);}} disabled={selectedCount===0} style={{...S.btn(C.red),width:"100%",padding:13,fontSize:14,opacity:selectedCount===0?0.5:1,marginTop:8}}>
        ⚠️ Continue to Confirmation →
      </button>
    </>)}

    {step===1&&(<div style={S.card}>
      <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:10}}>⚠️ Final Confirmation Required</div>
      <div style={{fontSize:13,color:C.text,marginBottom:12,lineHeight:1.7}}>
        You are about to permanently delete <strong style={{color:C.red}}>{selectedCount} categor{selectedCount===1?"y":"ies"}</strong> of farm data.<br/>
        This action <strong>cannot be undone</strong>.<br/><br/>
        To confirm, type exactly: <strong style={{fontFamily:"monospace",background:C.elevated,padding:"2px 8px",borderRadius:4}}>{REQUIRED_TEXT}</strong>
      </div>
      <input
        value={confirmText}
        onChange={e=>setConfirmText(e.target.value.toUpperCase())}
        placeholder={`Type "${REQUIRED_TEXT}" to confirm`}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
        style={{...S.inp,marginBottom:4,fontFamily:"monospace",fontWeight:700,fontSize:13,letterSpacing:1,
          border:confirmText.trim()===REQUIRED_TEXT?"2px solid "+C.red:"1.5px solid "+C.border,
          background:confirmText.trim()===REQUIRED_TEXT?"rgba(239,68,68,.06)":"#fff"}}
      />
      <div style={{fontSize:11,color:confirmText.trim()===REQUIRED_TEXT?C.red:C.faint,marginBottom:12,fontFamily:"monospace"}}>
        {confirmText.trim()===REQUIRED_TEXT?"✅ Confirmed — ready to reset":"⌨️ Type exactly: RESET FARM DATA (auto-uppercased)"}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={performReset} disabled={confirmText.trim()!==REQUIRED_TEXT||resetting}
          style={{...S.btn(C.red),flex:1,padding:12,fontSize:13,opacity:confirmText.trim()!==REQUIRED_TEXT?0.4:1,
            boxShadow:confirmText.trim()===REQUIRED_TEXT?"0 0 0 3px rgba(239,68,68,.25)":"none",
            transition:"all .2s"}}>
          {resetting?"⏳ Resetting…":"🔄 Confirm Reset — DELETE DATA"}
        </button>
        <button onClick={()=>{setStep(0);setConfirmText("");}} style={{...S.btn("#374151"),padding:12,fontSize:13}}>Cancel</button>
      </div>
    </div>)}
  </div>);
}

