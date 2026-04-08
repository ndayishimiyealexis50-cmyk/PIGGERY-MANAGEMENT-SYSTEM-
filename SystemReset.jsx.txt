// pages/SystemReset.jsx
// System data reset — function SystemReset()
// Props: { pigs, setPigs, feeds, setFeeds, sales, setSales, logs, setLogs,
//          expenses, setExpenses, incomes, setIncomes, messages, setMessages,
//          reproductions, setReproductions, stock, setStock, tasks, setTasks,
//          vaccinations, setVaccinations, pendingPigs, setPendingPigs,
//          assessments, setAssessments, salaries, setSalaries,
//          advances, setAdvances, capital, setCapital, sessions, setSessions }

import { useState } from 'react';
import { S, C } from '../utils/styles';
import { INIT_PIGS, INIT_STOCK, lsSetFarm, _latestFarmData, FS_FARM_DOC } from '../firebase';

const REQUIRED_TEXT = 'RESET FARM DATA';

const RESET_OPTIONS = [
  { key: 'pigs',         label: '🐷 Pig Records',          desc: 'All pig registrations (resets to 3 demo pigs)' },
  { key: 'feeds',        label: '🌾 Feeding Logs',          desc: 'All feeding records and costs' },
  { key: 'sales',        label: '🏷️ Sales Records',         desc: 'All pig sale transactions' },
  { key: 'logs',         label: '📋 Daily Logs',            desc: 'All daily health reports' },
  { key: 'expenses',     label: '🛒 Expenses',              desc: 'All purchase and expense records' },
  { key: 'incomes',      label: '💚 Income Records',        desc: 'All manual income entries' },
  { key: 'reproductions',label: '🐖 Reproduction Records',  desc: 'All mating and farrowing records' },
  { key: 'capital',      label: '💵 Capital Balance',       desc: 'Reset capital to zero' },
  { key: 'messages',     label: '📢 Messages',              desc: 'All admin-to-worker messages' },
  { key: 'tasks',        label: '✅ Tasks',                  desc: 'All worker tasks' },
  { key: 'vaccinations', label: '💉 Vaccinations',          desc: 'All vaccination records' },
  { key: 'salaries',     label: '💼 Salaries',              desc: 'All salary and payroll records' },
  { key: 'advances',     label: '💸 Advance Requests',      desc: 'All salary advance requests' },
  { key: 'stock',        label: '📦 Stock Inventory',       desc: 'Reset to default stock items' },
];

export default function SystemReset({
  pigs, setPigs, feeds, setFeeds, sales, setSales, logs, setLogs,
  expenses, setExpenses, incomes, setIncomes, messages, setMessages,
  reproductions, setReproductions, stock, setStock, tasks, setTasks,
  vaccinations, setVaccinations, pendingPigs, setPendingPigs,
  assessments, setAssessments, salaries, setSalaries,
  advances, setAdvances, capital, setCapital, sessions, setSessions,
}) {
  const [step,        setStep]        = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [resetting,   setResetting]   = useState(false);
  const [done,        setDone]        = useState(false);
  const [whatToReset, setWhatToReset] = useState({
    pigs: true, feeds: true, sales: true, logs: true, expenses: true,
    incomes: true, messages: false, reproductions: true, stock: false,
    tasks: false, vaccinations: false, capital: false, salaries: false, advances: false,
  });

  const selectedCount = Object.values(whatToReset).filter(Boolean).length;

  async function performReset() {
    setResetting(true);
    window._farmResetting = true;
    const patch = {};
    if (whatToReset.pigs)          { setPigs(INIT_PIGS); setPendingPigs([]); setAssessments([]); patch.pigs = INIT_PIGS; patch.pendingPigs = []; patch.assessments = []; }
    if (whatToReset.feeds)         { setFeeds([]);        patch.feeds = []; }
    if (whatToReset.sales)         { setSales([]);        patch.sales = []; }
    if (whatToReset.logs)          { setLogs([]);         patch.logs  = []; }
    if (whatToReset.expenses)      { setExpenses([]);     patch.expenses = []; }
    if (whatToReset.incomes)       { setIncomes([]);      patch.incomes  = []; }
    if (whatToReset.messages)      { setMessages([]);     patch.messages = []; }
    if (whatToReset.reproductions) { setReproductions([]); patch.reproductions = []; }
    if (whatToReset.stock)         { setStock(INIT_STOCK); patch.stock = INIT_STOCK; }
    if (whatToReset.tasks)         { setTasks([]);        patch.tasks  = []; }
    if (whatToReset.vaccinations)  { setVaccinations([]); patch.vaccinations = []; }
    if (whatToReset.salaries)      { setSalaries([]);     patch.salaries = []; patch.bonusRequests = []; patch.salaryConfigs = []; }
    if (whatToReset.advances)      { setAdvances([]);     patch.advances = []; }
    if (whatToReset.capital)       { setCapital({ initial: 0, transactions: [] }); patch.capital = { initial: 0, transactions: [] }; }

    try {
      const current  = _latestFarmData || {};
      const resetAt  = new Date().toISOString();
      const fullReset = { ...current, ...patch, updatedAt: resetAt, _resetAt: resetAt };
      lsSetFarm(fullReset);
      await FS_FARM_DOC.set(fullReset);
    } catch (e) { console.error('Reset write failed', e); }

    setResetting(false); setDone(true); setStep(0); setConfirmText('');
    setTimeout(() => { window._farmResetting = false; }, 3000);
  }

  if (done) return (
    <div className="fade-in" style={{ ...S.card, textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, marginBottom: 8 }}>System Reset Complete</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Selected data has been cleared. The system is now fresh.</div>
      <button onClick={() => setDone(false)} style={{ ...S.btn(), padding: '10px 24px' }}>Start Fresh →</button>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={S.h1}>🔄 System Reset</div>
      <div style={S.sub}>Selectively clear farm data — use this to start a new season or clean test data</div>

      {/* Warning */}
      <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,.08)', border: '2px solid rgba(239,68,68,.35)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠️ WARNING — This action is PERMANENT</div>
        <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.7 }}>
          • Deleted data <strong>cannot be recovered</strong><br />
          • This affects ALL users of this farm system<br />
          • Worker accounts will NOT be deleted<br />
          • Business profile and market surveys will NOT be deleted<br />
          • Consider downloading PDF reports before resetting
        </div>
      </div>

      {/* Step 0 — Select */}
      {step === 0 && (
        <>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Select What to Reset</div>
            {RESET_OPTIONS.map(({ key, label, desc }) => (
              <div key={key} onClick={() => setWhatToReset(p => ({ ...p, [key]: !p[key] }))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9, marginBottom: 7, cursor: 'pointer', background: whatToReset[key] ? 'rgba(239,68,68,.06)' : 'rgba(0,0,0,.02)', border: whatToReset[key] ? '1.5px solid rgba(239,68,68,.35)' : '1px solid ' + C.border, transition: 'all .15s' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: whatToReset[key] ? C.red : 'transparent', border: '2px solid ' + (whatToReset[key] ? C.red : C.border), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {whatToReset[key] ? '✓' : ''}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: whatToReset[key] ? C.red : C.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{desc}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,.2)', marginTop: 4, fontSize: 12, color: C.amber }}>
              {selectedCount} categor{selectedCount === 1 ? 'y' : 'ies'} selected for reset
            </div>
          </div>
          <button onClick={() => { if (selectedCount > 0) setStep(1); }} disabled={selectedCount === 0} style={{ ...S.btn(C.red), width: '100%', padding: 13, fontSize: 14, opacity: selectedCount === 0 ? 0.5 : 1, marginTop: 8 }}>
            ⚠️ Continue to Confirmation →
          </button>
        </>
      )}

      {/* Step 1 — Confirm */}
      {step === 1 && (
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 10 }}>⚠️ Final Confirmation Required</div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 12, lineHeight: 1.7 }}>
            You are about to permanently delete <strong style={{ color: C.red }}>{selectedCount} categor{selectedCount === 1 ? 'y' : 'ies'}</strong> of farm data.
            This action <strong>cannot be undone</strong>.<br /><br />
            To confirm, type exactly: <strong style={{ fontFamily: 'monospace', background: C.elevated, padding: '2px 8px', borderRadius: 4 }}>{REQUIRED_TEXT}</strong>
          </div>
          <input value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())} placeholder={`Type "${REQUIRED_TEXT}" to confirm`}
            autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck="false"
            style={{ ...S.inp, marginBottom: 4, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, letterSpacing: 1, border: confirmText.trim() === REQUIRED_TEXT ? '2px solid ' + C.red : '1.5px solid ' + C.border, background: confirmText.trim() === REQUIRED_TEXT ? 'rgba(239,68,68,.06)' : '#fff' }} />
          <div style={{ fontSize: 11, color: confirmText.trim() === REQUIRED_TEXT ? C.red : C.faint, marginBottom: 12, fontFamily: 'monospace' }}>
            {confirmText.trim() === REQUIRED_TEXT ? '✅ Confirmed — ready to reset' : '⌨️ Type exactly: RESET FARM DATA (auto-uppercased)'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={performReset} disabled={confirmText.trim() !== REQUIRED_TEXT || resetting}
              style={{ ...S.btn(C.red), flex: 1, padding: 12, fontSize: 13, opacity: confirmText.trim() !== REQUIRED_TEXT ? 0.4 : 1 }}>
              {resetting ? '⏳ Resetting…' : '🔄 Confirm Reset — DELETE DATA'}
            </button>
            <button onClick={() => { setStep(0); setConfirmText(''); }} style={{ ...S.btn('#374151'), padding: 12, fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
