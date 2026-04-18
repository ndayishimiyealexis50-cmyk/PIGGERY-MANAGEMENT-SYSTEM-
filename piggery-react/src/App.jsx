// src/App.jsx
// ─── Root application component ───────────────────────────────────────────────
// Responsibilities:
//   • Wrap everything in <AuthProvider>
//   • Load / poll all farm data from Firestore on mount
//   • Handle session timeout (6 min inactivity auto-logout)
//   • Expose window._addAuditLog globally (used by all child components)
//   • Render <Login> when unauthenticated, full shell when authenticated
//
// All auth state is managed by AuthContext — this file never calls
// signInWithEmailAndPassword or onAuthStateChanged directly.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

import {
  isAdminEmail,
  isAdminUser,
  getAllUserProfiles,
  ADMIN_EMAIL,
} from './lib/firebase';
import {
  getOnlineFarmData,
  setOnlineFarmData,
  getOnlineUsers,
  FS_FARM_DOC,
  _offlineStatus,
  _syncListeners,
  getLatestFarmData,
  setLatestFarmData,
} from './lib/firestore';
import { setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

// ── Page components ──────────────────────────────────
import AHome              from './pages/AHome';
import WHome from './pages/WHome';
import ErrorBoundary from './components/ErrorBoundary';
import SmartAlerts        from './pages/SmartAlerts';
import ProfitInsight      from './pages/ProfitInsight';
import FeedEfficiency     from './pages/FeedEfficiency';
import PigPerformance     from './pages/PigPerformance';
import AIAdvisor          from './pages/AIAdvisor';
import KPI                from './pages/KPI';
import ProfitLossAnalysis from './pages/ProfitLossAnalysis';
import ReproductionModule from './pages/ReproductionModule';
import StockManager       from './pages/StockManager';
import Ledger             from './pages/Ledger';
import CapitalManager     from './pages/CapitalManager';
import Pigs               from './pages/Pigs';
import FeedLog            from './pages/FeedLog';
import SaleLog            from './pages/SaleLog';
import DLogs              from './pages/DLogs';
import SalaryManager      from './pages/SalaryManager';
import AuditLog           from './pages/AuditLog';
import PigAssessmentHistory from './pages/PigAssessmentHistory';
import WeeklyReport       from './pages/WeeklyReport';
import AIPrediction       from './pages/AIPrediction';
// ── Sub-components used as pages ──────────────────────
import ApprovalPanel      from './components/ApprovalPanel';
import TaskManager        from './components/TaskManager';
import VaccinationTracker from './components/VaccinationTracker';
import WorkerPigAssessment from './components/WorkerPigAssessment';

// ── Initial data shapes (keep consistent with HTML version) ──────────────────
const INIT_USERS = [];
const INIT_STOCK = [];

// ── Rwanda clock helper (UTC+2) ───────────────────────────────────────────────
function rwandaISO() {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('Z', '') + '+02:00';
}

// ── useSyncStatus hook — kept here so it can be used by App shell ─────────────
function useSyncStatus() {
  const [status, setStatus] = useState({ ..._offlineStatus });
  useEffect(() => {
    const fn = s => setStatus({ ...s });
    _syncListeners.add(fn);
    return () => _syncListeners.delete(fn);
  }, []);
  return status;
}

// ═════════════════════════════════════════════════════════════════════════════
// Inner shell — rendered only when the user is authenticated
// ═════════════════════════════════════════════════════════════════════════════
function AppShell() {
  const { user, setUser, logout } = useAuth();

  // ── All farm data states ──────────────────────────────────────────────────
  const [users,          setUsers]          = useState(INIT_USERS);
  const [usersLoaded,    setUsersLoaded]    = useState(false);
  const [pigs,           setPigs]           = useState([]);
  const [pigsLoaded,     setPigsLoaded]     = useState(false);
  const [feeds,          setFeeds]          = useState([]);
  const [feedsLoaded,    setFeedsLoaded]    = useState(false);
  const [sales,          setSales]          = useState([]);
  const [salesLoaded,    setSalesLoaded]    = useState(false);
  const [logs,           setLogs]           = useState([]);
  const [logsLoaded,     setLogsLoaded]     = useState(false);
  const [expenses,       setExpenses]       = useState([]);
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [incomes,        setIncomes]        = useState([]);
  const [incomesLoaded,  setIncomesLoaded]  = useState(false);
  const [messages,       setMessages]       = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [reproductions,  setReproductions]  = useState([]);
  const [reproLoaded,    setReproLoaded]    = useState(false);
  const [sessions,       setSessions]       = useState([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [stock,          setStock]          = useState(INIT_STOCK);
  const [stockLoaded,    setStockLoaded]    = useState(false);
  const [tasks,          setTasks]          = useState([]);
  const [vaccinations,   setVaccinations]   = useState([]);
  const [pendingPigs,    setPendingPigs]     = useState([]);
  const [assessments,    setAssessments]    = useState([]);
  const [capital,        setCapital]        = useState({ initial: 0, transactions: [], updatedAt: '' });
  const [capitalLoaded,  setCapitalLoaded]  = useState(false);
  const [salaries,       setSalaries]       = useState([]);
  const [advances,       setAdvances]       = useState([]);
  const [bonusRequests,  setBonusRequests]  = useState([]);
  const [salaryConfigs,  setSalaryConfigs]  = useState([]);
  const [auditLogs,      setAuditLogs]      = useState([]);

  // ── UI states ─────────────────────────────────────────────────────────────
  const [page,           setPage]           = useState('home');
  const [sideOpen,       setSideOpen]       = useState(false);
  const [isMobile,       setIsMobile]       = useState(window.innerWidth <= 768);
  const [pageKey,        setPageKey]        = useState(0);
  const [pageDir,        setPageDir]        = useState('right');
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [lastRefresh,    setLastRefresh]    = useState('');
  const [undoStack,      setUndoStack]      = useState([]);
  const [undoToast,      setUndoToast]      = useState(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [showApiModal,   setShowApiModal]   = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const syncStatus    = useSyncStatus();
  const dataLoaded    = useRef(false);
  const undoTimerRef  = useRef(null);
  const inactivityTimer   = useRef(null);
  const timeoutWarnTimer  = useRef(null);
  const INACTIVITY_MS = 6 * 60 * 1000; // 6 minutes

  // ── Navigate to home when user resolves ──────────────────────────────────
  useEffect(() => { if (user?.uid) { const admin = isAdminEmail(user.email) || user.role?.toLowerCase() === "admin"; setPage(admin ? "home" : "whome"); } }, [user?.uid]);

  // ── Mobile resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ── Auto-delete messages older than 2 days ────────────────────────────────
  const toDay = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  useEffect(() => {
    if (!messages.length) return;
    const cutoff    = new Date();
    cutoff.setDate(cutoff.getDate() - 2);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const fresh     = messages.filter(m => (m.date || '') >= cutoffStr);
    if (fresh.length < messages.length) {
      setMessages(fresh);
      setOnlineFarmData({ messages: fresh });
    }
  }, [messages.length]);

  // ── Audit log helper ──────────────────────────────────────────────────────
  function addAuditLog(action, detail, actor) {
    const entry = {
      id:     'al_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      ts:     rwandaISO(),
      action,
      detail: detail || '',
      actor:  actor || (user?.name || user?.email || 'unknown'),
    };
    setAuditLogs(prev => {
      const updated = [entry, ...prev].slice(0, 500);
      setOnlineFarmData({ auditLogs: updated });
      return updated;
    });
  }
  // Expose globally so all child components can log without prop-drilling
  window._addAuditLog = addAuditLog;

  // ── Session timeout ───────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    clearTimeout(inactivityTimer.current);
    clearTimeout(timeoutWarnTimer.current);
    setShowTimeoutWarning(false);
    timeoutWarnTimer.current = setTimeout(
      () => setShowTimeoutWarning(true),
      INACTIVITY_MS - 60000
    );
    inactivityTimer.current = setTimeout(async () => {
      setShowTimeoutWarning(false);
      addAuditLog('logout', 'Auto-logout: session timeout after 6 min inactivity', user?.name || user?.email);
      try { localStorage.removeItem('farmiq_user_cache'); } catch (e) { /* */ }
      await logout();
    }, INACTIVITY_MS);
  }, [user, logout]);

  useEffect(() => {
    if (!user) {
      clearTimeout(inactivityTimer.current);
      clearTimeout(timeoutWarnTimer.current);
      setShowTimeoutWarning(false);
      return;
    }
    const events  = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearTimeout(inactivityTimer.current);
      clearTimeout(timeoutWarnTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // ── Mobile swipe navigation ───────────────────────────────────────────────
  const swipeRef = useRef({ x: 0, y: 0, startY: 0 });
  const pageList = useCallback(() => {
    return isAdminEmail(user?.email) || user?.role?.toLowerCase() === 'admin'
      ? ['home', 'alerts', 'pigs', 'feeding', 'sales', 'daylogs', 'reproduction', 'stock', 'ledger', 'capital', 'pnl', 'bigdata', 'ai']
      : ['home', 'dailyentry', 'feedentry', 'saleentry', 'buyentry', 'pigentry', 'assessment'];
  }, [user]);

  useEffect(() => {
    if (!isMobile) return;
    const onStart = e => { swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, startY: e.touches[0].clientY }; };
    const onEnd   = e => {
      const dx  = e.changedTouches[0].clientX - swipeRef.current.x;
      const dy  = e.changedTouches[0].clientY - swipeRef.current.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (dy > 80 && ady > adx && swipeRef.current.startY < 60 && window.scrollY === 0) {
        setPullRefreshing(true);
        refreshAll().finally(() => setTimeout(() => setPullRefreshing(false), 600));
        return;
      }
      if (adx < 60 || ady > 50) return;
      const pages = pageList();
      const cur   = pages.indexOf(page);
      if (cur === -1) return;
      if (dx < -60 && cur < pages.length - 1) { setPageDir('left');  setPage(pages[cur + 1]); setPageKey(k => k + 1); }
      if (dx >  60 && cur > 0)                { setPageDir('right'); setPage(pages[cur - 1]); setPageKey(k => k + 1); }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend',   onEnd,   { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [isMobile, page, pageList]);

  // ── Undo helpers ──────────────────────────────────────────────────────────
  function clearUndo() { setUndoToast(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }
  function pushUndo(label, undoFn) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ label, onUndo: undoFn });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5500);
  }

  // ── Apply farm data to state ──────────────────────────────────────────────
  function applyFarmData(data) {
    if (!data) return;
    if (Array.isArray(data.pigs))          setPigs(data.pigs);
    if (Array.isArray(data.feeds))         setFeeds(data.feeds);
    if (Array.isArray(data.sales))         setSales(data.sales);
    if (Array.isArray(data.logs))          setLogs(data.logs);
    if (Array.isArray(data.expenses))      setExpenses(data.expenses);
    if (Array.isArray(data.incomes))       setIncomes(data.incomes);
    if (Array.isArray(data.messages))      setMessages(data.messages);
    if (Array.isArray(data.reproductions)) setReproductions(data.reproductions);
    if (Array.isArray(data.stock))         setStock(data.stock);
    else if (data.hasOwnProperty?.('stock')) setStock([]);
    if (Array.isArray(data.tasks))         setTasks(data.tasks);
    if (Array.isArray(data.vaccinations))  setVaccinations(data.vaccinations);
    if (Array.isArray(data.sessions))      setSessions(data.sessions);
    if (Array.isArray(data.pendingPigs))   setPendingPigs(data.pendingPigs);
    if (Array.isArray(data.assessments))   setAssessments(data.assessments);
    if (Array.isArray(data.salaries))      setSalaries(data.salaries);
    if (Array.isArray(data.advances))      setAdvances(data.advances);
    if (Array.isArray(data.bonusRequests)) setBonusRequests(data.bonusRequests);
    if (Array.isArray(data.salaryConfigs)) setSalaryConfigs(data.salaryConfigs);
    if (Array.isArray(data.auditLogs))     setAuditLogs(data.auditLogs);
    // Restore market surveys and biz profile from Firestore into localStorage
    if (Array.isArray(data.marketSurveys) && data.marketSurveys.length > 0) {
      try { localStorage.setItem('farmiq_market_surveys', JSON.stringify(data.marketSurveys)); } catch (e) { /* */ }
    }
    if (data.bizProfile?.farmName) {
      try { localStorage.setItem('farmiq_biz_profile', JSON.stringify(data.bizProfile)); } catch (e) { /* */ }
    }
    // Capital — only load if explicitly requested (avoids overwriting pending edits)
    if (data.capital && typeof data.capital === 'object' && data.__loadCapital === true) {
      const cleanTxs = (data.capital.transactions || []).filter(t => !t.refId);
      setCapital({ ...data.capital, transactions: cleanTxs });
    }
  }

  // ── Refresh all data ──────────────────────────────────────────────────────
  async function refreshAll() {
    if (globalRefreshing) return;
    setGlobalRefreshing(true);
    try {
      const [freshUsers, freshFarm] = await Promise.all([getAllUserProfiles(), getOnlineFarmData()]);
      if (freshUsers?.length > 0) {
        const corrected = freshUsers.map(u =>
          isAdminEmail(u.email) ? { ...u, role: 'admin', approved: true } : u
        );
        setUsers(corrected);
      }
      if (freshFarm) applyFarmData({ ...freshFarm, __loadCapital: true });
      setLastRefresh(
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })
      );
    } catch (e) { console.error('refresh error', e); }
    setGlobalRefreshing(false);
  }

  // ── Initial data load + polling ───────────────────────────────────────────
  useEffect(() => {
    // Load users
    getAllUserProfiles()
      .then(fresh => {
        if (fresh?.length > 0) {
          const corrected = fresh.map(u =>
            isAdminEmail(u.email) ? { ...u, role: 'admin', approved: true } : u
          );
          setUsers(corrected);
        }
        setUsersLoaded(true);
      })
      .catch(() => setUsersLoaded(true));

    // Load all farm data once
    getOnlineFarmData()
      .then(async data => {
        applyFarmData({ ...data, __loadCapital: true });
        dataLoaded.current = true;
        setPigsLoaded(true); setFeedsLoaded(true); setSalesLoaded(true);
        setLogsLoaded(true); setExpensesLoaded(true); setIncomesLoaded(true);
        setMessagesLoaded(true); setReproLoaded(true); setStockLoaded(true);
        setCapitalLoaded(true); setSessionsLoaded(true);

        // ── Bulletproof capital wipe on first load ──────────────────────────
        // Strips all refId transactions (orphan-prone) from Firestore.
        // Uses already-loaded data — no extra read needed.
        try {
          const oldTxs    = (data?.capital?.transactions) || [];
          const cleanTxs  = oldTxs.filter(t => !t.refId);
          const wipedCap  = { ...(data?.capital || { initial: 0 }), transactions: cleanTxs };
          const latestFarm = getLatestFarmData();
          await setDoc(FS_FARM_DOC, {
            ...(data || {}),
            capital:       wipedCap,
            _capitalFixed: true,
            updatedAt:     new Date().toISOString(),
          });
          setLatestFarmData({ ...(latestFarm || {}), capital: wipedCap });
          setCapital(prev => ({ ...prev, transactions: cleanTxs }));
        } catch (e) { console.error('capital wipe error', e); }
      })
      .catch(e => {
        console.error('initial farm load error', e);
        dataLoaded.current = true;
        setPigsLoaded(true); setFeedsLoaded(true); setSalesLoaded(true);
        setLogsLoaded(true); setExpensesLoaded(true); setIncomesLoaded(true);
        setMessagesLoaded(true); setReproLoaded(true); setStockLoaded(true);
        setCapitalLoaded(true); setSessionsLoaded(true);
      });

    // Poll users every 4 s (catches new worker registrations)
    const pollUsers = setInterval(async () => {
      if (document.hidden) return;
      try {
        const fresh = await getAllUserProfiles();
        if (fresh?.length > 0) {
          setUsers(fresh.map(u => isAdminEmail(u.email) ? { ...u, role: 'admin', approved: true } : u));
        }
      } catch (e) { /* network — silently ignore */ }
    }, 4000);

    // Poll farm data every 4 s
    const pollFarm = setInterval(async () => {
      if (document.hidden) return;
      if (window._farmResetting) return; // pause during SystemReset
      try {
        const serverData = await getOnlineFarmData();
        if (!serverData) return;
        const { capital: _cap, ...farmWithoutCapital } = serverData;
        applyFarmData(farmWithoutCapital);
      } catch (e) { /* offline — silently ignore */ }
    }, 4000);

    return () => { clearInterval(pollUsers); clearInterval(pollFarm); };
  }, []);

  // ── Persist capital to Firestore whenever it changes (after initial load) ─
  const capitalSynced = useRef(false);
  useEffect(() => {
    if (!capitalLoaded) return;
    if (!capitalSynced.current) { capitalSynced.current = true; return; }
    const capitalToSave = {
      ...capital,
      transactions: (capital.transactions || []).filter(t => !t.refId),
    };
    setOnlineFarmData({ capital: capitalToSave });
  }, [capital, capitalLoaded]);

  // ── Persist sessions whenever they change ─────────────────────────────────
  const sessionsSynced = useRef(false);
  useEffect(() => {
    if (!sessionsLoaded) return;
    if (!sessionsSynced.current) { sessionsSynced.current = true; return; }
    setOnlineFarmData({ sessions });
  }, [sessions, sessionsLoaded]);

  // ── Fix admin role if stale cache has wrong role ──────────────────────────
  const emailIsAdmin = isAdminEmail(user?.email);
  useEffect(() => {
    if (user && emailIsAdmin && user.role?.toLowerCase() !== 'admin') {
      setUser(u => ({ ...u, role: 'admin', approved: true }));
    }
  }, [user?.uid, emailIsAdmin]);

  const isAdmin = emailIsAdmin || (user?.role?.toLowerCase() === 'admin');

  // ── Memoised allData passed to components that need it ───────────────────
  const allData = useMemo(
    () => ({ pigs, feeds, sales, logs, expenses, incomes, users, messages, reproductions, stock }),
    [pigs, feeds, sales, logs, expenses, incomes, users, messages, reproductions, stock]
  );

  // ── Sign-out helper (available to nav buttons) ────────────────────────────
  async function handleSignOut() {
    addAuditLog('logout', 'Manual sign-out', user?.name || user?.email);
    try { localStorage.removeItem('farmiq_user_cache'); } catch (e) { /* */ }
    await logout();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORTANT: all hooks must appear before any conditional return.
  // ─────────────────────────────────────────────────────────────────────────

  // Computed nav helpers
  const pending         = users.filter(u => u.role === 'worker' && !u.approved && !u.removed);
  const lowStockCount   = (stock || []).filter(s => s.quantity <= s.minLevel).length;
  const daysDiff        = dateStr => dateStr ? Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)) : 999;
  const upcomingFarrows = reproductions.filter(r => r.status === 'pregnant' && daysDiff(r.expectedFarrow) >= 0 && daysDiff(r.expectedFarrow) <= 7).length;
  const pendingDataCount = (
    [...feeds, ...logs, ...sales, ...expenses].filter(x => x.approved === false && !x.rejected).length +
    (pendingPigs || []).filter(x => !x.approved && !x.rejected).length +
    (assessments || []).filter(x => x.approved === false).length
  );
  const alerts_overdue = (reproductions || []).filter(r => r.status === 'pregnant' && daysDiff(r.expectedFarrow) < 0).length;
  const alerts_sick    = logs.filter(l => l.date === toDay() && l.sick > 0).reduce((s, l) => s + (l.sick || 0), 0);
  const alerts_stock   = (stock || []).filter(s => s.quantity <= s.minLevel).length;
  const alerts_count   = alerts_overdue + Math.min(alerts_sick, 1) + Math.min(alerts_stock, 1) + Math.min(pendingDataCount, 1);

  // Admin nav items
  const adminNav = [
    { id: 'home',          l: '📊 Overview' },
    { id: 'alerts',        l: `🔔 Alerts${alerts_count > 0 ? ` (${alerts_count})` : ''}` },
    { id: 'profitinsight', l: '💡 Profit Insight' },
    { id: 'feedefficiency',l: '🌾 Feed Efficiency' },
    { id: 'pigperformance',l: '🧬 Herd Intelligence' },
    { id: 'approvals',     l: `✅ Approvals${pendingDataCount > 0 ? ` 🔴${pendingDataCount}` : ''}` },
    { id: 'ai',            l: '🤖 AI Advisor' },
    { id: 'bigdata',       l: '🧠 Big Data' },
    { id: 'pnl',           l: '💹 P&L Analysis' },
    { id: 'market',        l: '📈 RW Market' },
    { id: 'reproduction',  l: `🐖 Reproduction${upcomingFarrows > 0 ? ` (${upcomingFarrows})` : ''}` },
    { id: 'stock',         l: `📦 Stock${lowStockCount > 0 ? ` ⚠️${lowStockCount}` : ''}` },
    { id: 'ledger',        l: '📒 Ledger' },
    { id: 'capital',       l: '💰 Capital' },
    { id: 'pigs',          l: '🐷 Pig Records' },
    { id: 'feeding',       l: '🌾 Feeding' },
    { id: 'sales',         l: '💵 Sales' },
    { id: 'daylogs',       l: '📋 Daily Logs' },
    { id: 'health',        l: '🏥 Health' },
    { id: 'payroll',       l: `👷 Payroll${pending.length > 0 ? ` 🔴${pending.length}` : ''}` },
    { id: 'tasks',         l: '✅ Tasks' },
    { id: 'settings',      l: '⚙️ Settings' },
    { id: 'audit',         l: '🔐 Audit Log' },
  ];

  const workerNav = [
    { id: 'home',        l: '🏠 My Home' },
    { id: 'dailyentry',  l: '📋 Daily Report' },
    { id: 'feedentry',   l: '🌾 Feed Entry' },
    { id: 'saleentry',   l: '💵 Sale Entry' },
    { id: 'buyentry',    l: '🛒 Buy Entry' },
    { id: 'pigentry',    l: '🐷 Register Pig' },
    { id: 'assessment',  l: '📐 Assessment' },
  ];

  const navItems = isAdmin ? adminNav : workerNav;

  // ── Common props passed to all page components ────────────────────────────
  const commonProps = {
    user, setUser, isAdmin,
    pigs, setPigs, feeds, setFeeds, sales, setSales, logs, setLogs,
    expenses, setExpenses, incomes, setIncomes, messages, setMessages,
    reproductions, setReproductions, stock, setStock, tasks, setTasks,
    vaccinations, setVaccinations, pendingPigs, setPendingPigs,
    assessments, setAssessments, capital, setCapital,
    salaries, setSalaries, advances, setAdvances, bonusRequests, setBonusRequests,
    salaryConfigs, setSalaryConfigs, auditLogs, setAuditLogs,
    users, setUsers,
    pushUndo, clearUndo, syncStatus, lastRefresh,
    globalRefreshing, refreshAll, page, setPage,
    allData,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      background: '#eef3ee', minHeight: '100vh', display: 'flex', color: '#111a11',
      backgroundImage: 'radial-gradient(ellipse 90% 50% at 50% -8%,rgba(22,163,74,.07) 0%,transparent 60%)',
    }}>

      {/* ── Session timeout warning ── */}
      {showTimeoutWarning && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 9997, background: 'rgba(245,158,11,.95)', color: '#fff', padding: '13px 22px', borderRadius: 14, fontWeight: 700, fontSize: 13, boxShadow: '0 8px 32px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 12 }}>
          ⏱️ Session expiring soon — tap anywhere to stay logged in
          <button onClick={resetInactivityTimer} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#fff', color: '#d97706', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Keep me in</button>
        </div>
      )}

      {/* ── Mobile hamburger ── */}
      <button className="mob-hamburger" onClick={() => setSideOpen(o => !o)}>☰</button>
      {sideOpen && <div className="mob-overlay mob-overlay-show" onClick={() => setSideOpen(false)} />}

      {/* ── Sidebar ── */}
      <div
        className={isMobile ? (sideOpen ? 'mob-side-open' : 'mob-side-closed') : ''}
        style={{
          width: 238, minHeight: '100vh',
          background: 'linear-gradient(175deg,#071510 0%,#0c1f13 40%,#0f2516 100%)',
          borderRight: '1px solid rgba(74,222,128,.08)',
          padding: 0, display: 'flex', flexDirection: 'column', flexShrink: 0,
          boxShadow: '6px 0 32px rgba(0,0,0,.28)',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,rgba(74,222,128,.22),rgba(22,163,74,.12))', border: '1.5px solid rgba(74,222,128,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐷</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>Farm<span style={{ color: '#4ade80' }}>IQ</span></div>
              <div style={{ color: 'rgba(74,222,128,.5)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Rwanda</div>
            </div>
          </div>
          {/* Sync status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 10, color: syncStatus.online ? '#4ade80' : '#f87171' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: syncStatus.online ? '#4ade80' : '#f87171' }} />
            {syncStatus.online ? (syncStatus.lastSync ? `Synced ${syncStatus.lastSync}` : 'Online') : 'Offline — changes saved locally'}
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(({ id, l }) => {
            const active = page === id;
            return (
              <button
                key={id}
                className="side-nav-btn"
                onClick={() => { setPage(id); setPageKey(k => k + 1); if (isMobile) setSideOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '9px 16px 9px 20px',
                  background: active ? 'rgba(74,222,128,.14)' : 'transparent',
                  border: 'none',
                  color: active ? '#c8f0d4' : 'rgba(255,255,255,.72)',
                  fontSize: 12.5, cursor: 'pointer',
                  borderLeft: active ? '3px solid #4ade80' : '3px solid transparent',
                  marginBottom: 1, fontFamily: 'inherit',
                  fontWeight: active ? 650 : 420, letterSpacing: active ? 0.1 : 0,
                  borderRadius: '0 10px 10px 0', transition: 'all .16s',
                  position: 'relative',
                }}
              >
                {active && <span className="nav-active-dot" style={{ marginRight: 2 }} />}
                {l}
              </button>
            );
          })}
        </nav>

        {/* User info + sign out */}
        <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.09)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: isAdmin ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
              {isAdmin ? '👑' : '👷'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email}</div>
              <div style={{ color: isAdmin ? '#4ade80' : '#93c5fd', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>{isAdmin ? 'Admin' : 'Worker'}</div>
            </div>
          </div>
          <button
            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.07)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s', letterSpacing: 0.1 }}
            onClick={handleSignOut}
          >
            Sign Out →
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <ErrorBoundary><main
        className={isMobile ? 'mob-main' : ''}
        style={{ flex: 1, padding: '22px 22px 22px 24px', overflowY: 'auto', background: 'transparent', minWidth: 0, maxWidth: 900 }}
      >
        {/* Pull-to-refresh indicator */}
        {pullRefreshing && (
          <div style={{ textAlign: 'center', padding: '8px 0', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
            <span className="pull-refresh-icon">🔄</span> Refreshing…
          </div>
        )}

        {/*
          ── Page router ──────────────────────────────────────────────────────
          Each page component below receives commonProps spread in.
          Copy your existing page components from the HTML (§10–§28) and
          import them here — the props interface is identical to the HTML
          version, so no logic changes are needed.

          Example:
            import Dashboard    from './pages/Dashboard';
            import PigRecords   from './pages/PigRecords';
            ...

          Then in the router section below replace the <PlaceholderPage>
          tags with <Dashboard {...commonProps} />, etc.

          All the page components use these globals (still available via window):
            window._addAuditLog(action, detail, actor?)

          And these imported functions from firestore.js:
            setOnlineFarmData, getOnlineFarmData, fsSet, jbinAppend

          And these from firebase.js:
            isAdminUser, isAdminEmail, ADMIN_EMAIL

          No changes to component logic are needed — just imports.
        ────────────────────────────────────────────────────────────────────── */}

        <div key={pageKey} className={pageDir === 'left' ? 'fade-in' : 'fade-in'}>
          {page === 'home'          && <AHome {...commonProps} />}
{page === 'whome' && <WHome {...commonProps} logout={handleSignOut} />}
          {page === 'alerts'        && <SmartAlerts {...commonProps} />}
          {page === 'profitinsight' && <ProfitInsight {...commonProps} />}
          {page === 'feedefficiency'&& <FeedEfficiency {...commonProps} />}
          {page === 'pigperformance'&& <PigPerformance {...commonProps} />}
          {page === 'approvals'     && <ApprovalPanel {...commonProps} />}
          {page === 'ai'            && <AIAdvisor {...commonProps} />}
          {page === 'bigdata'       && <KPI {...commonProps} />}
          {page === 'pnl'           && <ProfitLossAnalysis {...commonProps} />}
          {page === 'market'        && <PlaceholderPage name="RW Market" {...commonProps} />}
          {page === 'reproduction'  && <ReproductionModule {...commonProps} />}
          {page === 'stock'         && <StockManager {...commonProps} />}
          {page === 'ledger'        && <Ledger {...commonProps} />}
          {page === 'capital'       && <CapitalManager {...commonProps} />}
          {page === 'pigs'          && <Pigs {...commonProps} />}
          {page === 'feeding'       && <FeedLog {...commonProps} />}
          {page === 'sales'         && <SaleLog {...commonProps} />}
          {page === 'daylogs'       && <DLogs {...commonProps} />}
          {page === 'health'        && <VaccinationTracker {...commonProps} />}
          {page === 'payroll'       && <SalaryManager {...commonProps} />}
          {page === 'tasks'         && <TaskManager {...commonProps} />}
          {page === 'settings'      && <PlaceholderPage name="Settings" {...commonProps} />}
          {page === 'audit'         && <AuditLog {...commonProps} />}
          {/* Worker-only routes */}
          {page === 'dailyentry'    && <DLogs {...commonProps} />}
          {page === 'feedentry'     && <FeedLog {...commonProps} />}
          {page === 'saleentry'     && <SaleLog {...commonProps} />}
          {page === 'buyentry'      && <PlaceholderPage name="Buy Entry" {...commonProps} />}
          {page === 'pigentry'      && <Pigs {...commonProps} />}
          {page === 'assessment'    && <WorkerPigAssessment {...commonProps} />}
        </div>
      </main></ErrorBoundary>

      {/* ── Mobile bottom nav ── */}
      <nav className="mob-bottom-nav">
        {(isAdmin
          ? [['home','📊','Home'],['alerts','🔔','Alerts'],['pigs','🐷','Pigs'],['feeding','🌾','Feed'],['sales','💵','Sales']]
          : [['home','🏠','Home'],['dailyentry','📋','Report'],['feedentry','🌾','Feed'],['saleentry','💵','Sale'],['pigentry','🐷','Pig']]
        ).map(([id, icon, label]) => (
          <button key={id} className={`mob-nav-btn${page === id ? ' mob-active' : ''}`} onClick={() => { setPage(id); setPageKey(k => k + 1); }}>
            <span className="mob-icon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

    </div>
  );
}

// ── Temporary placeholder shown until you wire in your page components ────────
function PlaceholderPage({ name }) {
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #dde7dd', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111a11', marginBottom: 8 }}>{name}</div>
      <div style={{ color: '#526b58', fontSize: 14 }}>
        Import your existing <code>{name.replace(/\s/g, '')}</code> component from the HTML source and replace this placeholder in <code>App.jsx</code>.
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Root export — wraps everything in AuthProvider
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

/** Reads auth state from context and decides what to render. */
function AppContent() {
  const { user, loading, pendingApproval } = useAuth();

  // Show nothing while Firebase resolves initial auth state.
  // The splash screen (in index.html / main.jsx) handles the visual gap.
  if (loading && !user) return null;

  // Not logged in → show Login
  if (!user) return <Login />;

  // Logged in → show full app shell
  return <AppShell />;
}
