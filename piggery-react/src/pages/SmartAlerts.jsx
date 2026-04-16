// ════════════════════════════════════════════════════════════════
// MODULE 21 — SmartAlerts
// High priority — auto notifications
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../styles/theme';
import { fmtRWF } from '../utils/formatters';
import { toDay, daysDiff, getMarketPrice } from '../utils/helpers';
import { sendWhatsApp } from '../utils/whatsapp';

export default function SmartAlerts({
  pigs, feeds, logs, sales, expenses, incomes,
  reproductions, stock, users, tasks, vaccinations, capital, setPage,
}) {
  const active = pigs.filter(p => p.status === 'active');
  const today  = toDay();
  const [waSending, setWASending] = useState(false);
  const [waStatus,  setWAStatus]  = useState('');

  // ── Build alerts ─────────────────────────────────────────────
  const alerts = [];

  // Market-ready pigs
  const ready = active.filter(p => p.weight >= 80);
  if (ready.length > 0) alerts.push({
    cat: '💰 Sales', priority: 1, color: '#16a34a',
    title: `${ready.length} pig${ready.length > 1 ? 's' : ''} market-ready (80kg+)`,
    body:  `Potential revenue: ${fmtRWF(ready.reduce((s, p) => s + getMarketPrice(p.stage, p.weight), 0))}`,
    action: () => setPage && setPage('performance'),
  });

  // Almost ready
  const almost = active.filter(p => p.weight >= 65 && p.weight < 80);
  if (almost.length > 0) alerts.push({
    cat: '📈 Growth', priority: 2, color: C.amber,
    title: `${almost.length} pig${almost.length > 1 ? 's' : ''} almost at market weight (65–79kg)`,
    body:  'Start preparing buyers and transport',
    action: null,
  });

  // Low stock
  const lowStock = (stock || []).filter(s => s.quantity <= s.minLevel);
  if (lowStock.length > 0) alerts.push({
    cat: '📦 Stock', priority: 1, color: C.red,
    title: `Low stock: ${lowStock.map(s => s.name).join(', ')}`,
    body:  `${lowStock.length} item${lowStock.length > 1 ? 's' : ''} below minimum level`,
    action: () => setPage && setPage('stock'),
  });

  // Reproduction — overdue
  const overdue = (reproductions || []).filter(r => r.status === 'pregnant' && daysDiff(r.expectedFarrow) < 0);
  overdue.forEach(r => {
    const sow = pigs.find(p => p.id === r.sowId);
    alerts.push({
      cat: '🐖 Breeding', priority: 0, color: C.red,
      title: `🚨 OVERDUE: ${sow ? sow.tag : 'Sow'} is ${Math.abs(daysDiff(r.expectedFarrow))} day(s) overdue!`,
      body:  'Check immediately — may need veterinary assistance',
      action: () => setPage && setPage('reproduction'),
    });
  });

  // Farrowing soon
  const farrowSoon = (reproductions || []).filter(r =>
    r.status === 'pregnant' && daysDiff(r.expectedFarrow) >= 0 && daysDiff(r.expectedFarrow) <= 7
  );
  if (farrowSoon.length > 0) alerts.push({
    cat: '🐖 Breeding', priority: 1, color: C.purple,
    title: `${farrowSoon.length} sow${farrowSoon.length > 1 ? 's' : ''} due to farrow within 7 days`,
    body:  'Prepare farrowing pens, bedding, and heat lamps',
    action: () => setPage && setPage('reproduction'),
  });

  // Sick pigs from today's logs
  const todayLogs = logs.filter(l => l.date === today && l.sick > 0);
  if (todayLogs.length > 0) {
    const totalSick = todayLogs.reduce((s, l) => s + (l.sick || 0), 0);
    alerts.push({
      cat: '🏥 Health', priority: 0, color: C.red,
      title: `${totalSick} sick pig${totalSick > 1 ? 's' : ''} reported today`,
      body:  'Review health logs and contact vet if needed',
      action: () => setPage && setPage('daylogs'),
    });
  }

  // Deaths this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const recentDeaths = logs.filter(l => {
    if (!l.date || l.deaths <= 0) return false;
    return new Date(l.date) >= weekAgo;
  });
  if (recentDeaths.length > 0) {
    const total = recentDeaths.reduce((s, l) => s + (l.deaths || 0), 0);
    alerts.push({
      cat: '🏥 Health', priority: 1, color: C.red,
      title: `${total} death${total > 1 ? 's' : ''} recorded this week`,
      body:  'Review cause — consider vaccination or biosecurity review',
      action: null,
    });
  }

  // No daily log today
  const todayLogExists = logs.some(l => l.date === today);
  if (!todayLogExists) alerts.push({
    cat: '📋 Operations', priority: 2, color: C.amber,
    title: 'No daily log submitted today',
    body:  'Remind workers to submit their daily health check report',
    action: () => setPage && setPage('adminlog'),
  });

  // Pending worker approvals
  const pending = users.filter(u => u.role === 'worker' && !u.approved && !u.removed);
  if (pending.length > 0) alerts.push({
    cat: '👷 Workers', priority: 2, color: C.blue,
    title: `${pending.length} worker registration${pending.length > 1 ? 's' : ''} awaiting approval`,
    body:  pending.map(u => u.name).join(', '),
    action: () => setPage && setPage('workers'),
  });

  // Pending data approvals
  const pendingData = [...feeds, ...logs, ...sales, ...expenses].filter(x => x.approved === false);
  if (pendingData.length > 0) alerts.push({
    cat: '✅ Approvals', priority: 1, color: C.amber,
    title: `${pendingData.length} worker record${pendingData.length > 1 ? 's' : ''} awaiting approval`,
    body:  'Worker-submitted data needs admin review',
    action: () => setPage && setPage('approvals'),
  });

  // Overdue / due vaccinations
  if (vaccinations) {
    const overdueVax = vaccinations.filter(v => daysDiff(v.nextDue) < 0);
    const dueVax     = vaccinations.filter(v => daysDiff(v.nextDue) >= 0 && daysDiff(v.nextDue) <= 7);
    if (overdueVax.length > 0) alerts.push({
      cat: '💉 Vaccines', priority: 1, color: C.red,
      title: `${overdueVax.length} overdue vaccination${overdueVax.length > 1 ? 's' : ''}`,
      body:  'Overdue vaccines increase disease risk',
      action: () => setPage && setPage('vaccination'),
    });
    if (dueVax.length > 0) alerts.push({
      cat: '💉 Vaccines', priority: 2, color: C.amber,
      title: `${dueVax.length} vaccination${dueVax.length > 1 ? 's' : ''} due within 7 days`,
      body:  'Schedule vet visit to keep herd protected',
      action: () => setPage && setPage('vaccination'),
    });
  }

  // Financial: running at a loss
  const totalInc = sales.reduce((s, l) => s + (l.total || 0), 0) + incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalExp = feeds.reduce((s, l) => s + (l.cost || 0), 0)  + expenses.reduce((s, l) => s + (l.amount || 0), 0);
  if (totalInc > 0 && totalExp > totalInc * 1.1) alerts.push({
    cat: '💹 Finance', priority: 1, color: C.red,
    title: 'Farm is running at a loss',
    body:  `Expenses (${fmtRWF(totalExp)}) exceed income (${fmtRWF(totalInc)}) by ${fmtRWF(totalExp - totalInc)}`,
    action: () => setPage && setPage('pnl'),
  });

  // Overdue tasks
  if (tasks && tasks.length > 0) {
    const overdueT = tasks.filter(t => t.status === 'pending' && t.dueDate && daysDiff(t.dueDate) < 0);
    if (overdueT.length > 0) alerts.push({
      cat: '✅ Tasks', priority: 2, color: C.amber,
      title: `${overdueT.length} overdue task${overdueT.length > 1 ? 's' : ''}`,
      body:  overdueT.slice(0, 3).map(t => t.title).join(', '),
      action: () => setPage && setPage('tasks'),
    });
  }

  // All good
  if (alerts.length === 0) alerts.push({
    cat: '✅ All Good', priority: 3, color: C.accent,
    title: 'No urgent alerts today!',
    body:  'Farm is running smoothly. Keep up the great work!',
    action: null,
  });

  alerts.sort((a, b) => a.priority - b.priority);

  const critCount = alerts.filter(a => a.priority === 0).length;
  const highCount = alerts.filter(a => a.priority === 1).length;

  // ── WhatsApp sender ───────────────────────────────────────────
  async function sendAlertsToWA() {
    if (waSending) return;
    setWASending(true); setWAStatus('');
    const critical = alerts.filter(a => a.priority <= 1);
    if (critical.length === 0) { setWAStatus('ℹ️ No critical/high alerts to send.'); setWASending(false); return; }
    const lines = [`🐷 *FarmIQ Alert — ${toDay()}*`, ''];
    critical.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.title}`);
      if (a.body) lines.push(`   ${a.body}`);
    });
    lines.push('', '_Via FarmIQ Rwanda_');
    const res = await sendWhatsApp(lines.join('\n'));
    if (res.ok) setWAStatus(`✅ Sent ${critical.length} alert(s) to WhatsApp!`);
    else if (res.reason === 'not_configured') setWAStatus('⚠️ WhatsApp not configured. Go to 📱 WhatsApp Alerts in the menu.');
    else setWAStatus('⚠️ Sent (delivery unconfirmed — CallMeBot doesn\'t support CORS confirmation).');
    setWASending(false);
    setTimeout(() => setWAStatus(''), 6000);
  }

  const priorityLabel = ['🚨 CRITICAL', '🔴 High', '🟡 Medium', '🟢 Info'];
  const priorityBg    = [
    'rgba(239,68,68,.06)', 'rgba(239,68,68,.04)',
    'rgba(245,158,11,.04)', 'rgba(22,163,74,.04)',
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ ...S.h1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔔</span> Smart Alerts
          </div>
          <div style={S.sub}>
            All farm alerts in one place · {alerts.length} alert{alerts.length !== 1 ? 's' : ''} · {critCount > 0 ? critCount + ' critical' : 'No critical issues'}
          </div>
        </div>
        <button
          onClick={sendAlertsToWA}
          disabled={waSending}
          style={{ ...S.btn('#128C7E'), display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '8px 14px' }}
        >
          {waSending
            ? <><span className="spin" style={{ ...S.loader, borderTopColor: '#fff' }} />Sending…</>
            : <>📱 Send to WhatsApp</>}
        </button>
      </div>

      {waStatus && (
        <div style={{ padding: '9px 14px', background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.3)', borderRadius: 9, fontSize: 12, color: C.muted, marginBottom: 12 }}>
          {waStatus}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Critical',      v: critCount,                               c: C.red,   bg: 'rgba(239,68,68,.06)' },
          { l: 'High Priority', v: highCount,                               c: C.amber, bg: 'rgba(245,158,11,.06)' },
          { l: 'Medium',        v: alerts.filter(a => a.priority === 2).length, c: C.blue,  bg: 'rgba(37,99,235,.06)' },
          { l: 'Total Alerts',  v: alerts.length,                           c: C.text,  bg: C.elevated },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Alert list */}
      {alerts.map((a, i) => (
        <div
          key={i}
          className="fade-in"
          style={{ ...S.card, marginBottom: 10, borderLeft: '4px solid ' + a.color, background: priorityBg[a.priority] || C.surface }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: a.color + '18', color: a.color, fontWeight: 700 }}>{a.cat}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: C.elevated, color: C.faint, fontWeight: 600 }}>{priorityLabel[a.priority]}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 3 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{a.body}</div>
            </div>
            {a.action && (
              <button
                onClick={a.action}
                style={{ padding: '6px 13px', borderRadius: 8, border: '1px solid ' + a.color + '44', background: a.color + '12', color: a.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                View →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
