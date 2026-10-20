// src/modules/AIMessages.jsx
// Replaces: §10 AIMessages in index.html
//
// Props:
//   users         – full users array
//   messages      – array from app state
//   setMessages   – state setter
//   pigs / feeds / sales / logs / expenses / incomes / reproductions / stock
//                 – read-only farm data used for AI context

import { useState } from 'react';
import { C, S } from '../styles/theme';
import { uid, toDay, fmtRWF } from '../lib/utils';
import { fsSet } from '../lib/firestore';
import { askAI, getApiKey } from '../lib/ai';
import { isWAEnabled, sendWhatsApp, sendWhatsAppToNumber, getWorkerWAContacts } from '../lib/whatsapp';
import { FX } from '../lib/fx';

export default function AIMessages({
  users, messages, setMessages,
  pigs, feeds, sales, logs, expenses, incomes, reproductions, stock,
}) {
  const [tab, setTab]             = useState('compose');
  const [text, setText]           = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending]     = useState(false);
  const [waStatus, setWaStatus]   = useState('');
  const [search, setSearch]       = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);

  const workers = users.filter(u => u.role === 'worker' && u.approved);

  function toggleWorker(wid) {
    setSelectedWorkers(prev => prev.includes(wid) ? prev.filter(x => x !== wid) : [...prev, wid]);
  }
  const targetWorkers = selectedWorkers.length === 0
    ? workers
    : workers.filter(w => selectedWorkers.includes(w.uid || w.id));

  // ── AI message generation ──────────────────────────────────────
  async function generateMsg() {
    if (!getApiKey()) { setText('⚠️ Please set your Gemini API key to generate AI messages.'); return; }
    setAiLoading(true);
    const totalInc = sales.reduce((s, l) => s + (l.total || 0), 0) + incomes.reduce((s, l) => s + (l.amount || 0), 0);
    const totalExp = feeds.reduce((s, l) => s + (l.cost  || 0), 0) + expenses.reduce((s, l) => s + (l.amount || 0), 0);
    const sick        = logs.reduce((s, l) => s + (l.sick || 0), 0);
    const pregnant    = (reproductions || []).filter(r => r.status === 'pregnant').length;
    const lowStock    = (stock || []).filter(s => s.quantity <= s.minLevel).length;
    const todayLogs   = logs.filter(l => l.date === toDay());
    const ctx = `Rwanda pig farm manager. Farm status: ${pigs.filter(p => p.status === 'active').length} active pigs, income=${fmtRWF(totalInc)}, profit=${fmtRWF(totalInc - totalExp)}, sick=${sick}, pregnant_sows=${pregnant}, low_stock_alerts=${lowStock}, logs_today=${todayLogs.length}/${workers.length}. Write a clear motivating daily message to farm workers (2-3 sentences). Simple language. Mention today's priorities.`;
    const res = await askAI(ctx);
    if      (res.source === 'ai')         setText(res.text);
    else if (res.source === 'auth_error') setText('⚠️ Invalid API key.');
    else if (res.source === 'timeout')    setText('⚠️ Request timed out.');
    else if (res.source === 'network')    setText('⚠️ Network error.');
    else                                  setText('⚠️ AI unavailable: ' + res.text);
    setAiLoading(false);
  }

  // ── Send message ───────────────────────────────────────────────
  async function send() {
    if (!text.trim() || targetWorkers.length === 0) return;
    setSending(true);
    const now = new Date();
    const recipientNames = selectedWorkers.length === 0
      ? 'All workers'
      : targetWorkers.map(w => w.name).join(', ');
    const newMsg = {
      id: uid(),
      text: text.trim(),
      from: 'Farm Owner (Admin)',
      date: toDay(),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' }),
      recipients: targetWorkers.length,
      recipientNames,
      recipientIds: targetWorkers.map(w => w.uid || w.id),
      broadcast: selectedWorkers.length === 0,
      aiGenerated: false,
    };
    setMessages(p => { const updated = [...p, newMsg]; fsSet('messages', updated); return updated; });
    window._addAuditLog?.('add', `Message sent to ${recipientNames}: "${text.trim().slice(0, 60)}${text.trim().length > 60 ? '...' : ''}"`);
    FX.message();
    setText(''); setSelectedWorkers([]); setSending(false);
    setTab('history');

    // WhatsApp to admin
    if (isWAEnabled()) {
      sendWhatsApp(`📢 FarmIQ Message — ${toDay()}\nTo: ${recipientNames}\n\n${newMsg.text}`);
      setWaStatus('📱 WhatsApp copy sent to admin!');
    }
    // WhatsApp to worker contacts
    const contacts = getWorkerWAContacts().filter(c => c.phone && c.apikey && (selectedWorkers.length === 0 || selectedWorkers.includes(c.uid)));
    if (contacts.length > 0) {
      let sent = 0;
      for (const c of contacts) {
        const ok = await sendWhatsAppToNumber(c.phone, c.apikey, `📢 FarmIQ — Message from Admin\n${toDay()}\n\n${newMsg.text}`);
        if (ok) sent++;
      }
      setWaStatus(prev => (prev ? prev + ' · ' : '') + `📱 WhatsApp sent to ${sent}/${contacts.length} worker(s)!`);
    }
    setTimeout(() => setWaStatus(''), 6000);
  }

  function deleteMsg(id) {
    if (!window.confirm('Delete this message from history?')) return;
    const _msg = messages.find(m => m.id === id);
    setMessages(p => { const updated = p.filter(m => m.id !== id); fsSet('messages', updated); return updated; });
    window._addAuditLog?.('delete', `Message deleted: "${_msg ? _msg.text.slice(0, 60) : ''}..."`);
  }

  // ── History filters ────────────────────────────────────────────
  const today   = toDay();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);
  let filtered  = [...messages].reverse();
  if (filterDate === 'today') filtered = filtered.filter(m => m.date === today);
  if (filterDate === 'week')  filtered = filtered.filter(m => m.date >= weekStr);
  if (search.trim()) filtered = filtered.filter(m => (m.text + m.recipientNames + m.date).toLowerCase().includes(search.trim().toLowerCase()));

  const todayCount          = messages.filter(m => m.date === today).length;
  const totalWorkersCovered = new Set(messages.flatMap(m => m.recipientIds || [])).size;

  return (
    <div>
      <div style={S.h1}>📢 Messages to Workers</div>
      <div style={S.sub}>{workers.length} active worker(s) · {messages.length} message(s) sent</div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border }}>
        {[['compose', '✍️ Compose'], ['history', '📋 History' + (messages.length ? ` (${messages.length})` : '')]].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── COMPOSE TAB ── */}
      {tab === 'compose' && (
        <div>
          <div style={S.card}>
            {/* Recipient selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Send to</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                <button
                  onClick={() => setSelectedWorkers([])}
                  style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, border: '1.5px solid ' + (selectedWorkers.length === 0 ? C.accent : C.border), background: selectedWorkers.length === 0 ? C.accent : 'transparent', color: selectedWorkers.length === 0 ? '#fff' : C.muted }}
                >
                  👥 All Workers ({workers.length})
                </button>
                {workers.map(w => {
                  const wid = w.uid || w.id;
                  const sel = selectedWorkers.includes(wid);
                  return (
                    <button key={wid} onClick={() => toggleWorker(wid)} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: sel ? 700 : 400, border: '1.5px solid ' + (sel ? C.accent : C.border), background: sel ? C.accentSoft : 'transparent', color: sel ? C.accent : C.muted }}>
                      {sel ? '✓ ' : ''}{w.name}
                    </button>
                  );
                })}
              </div>
              {workers.length === 0 && <div style={{ fontSize: 12, color: C.amber, marginTop: 6 }}>⚠️ No approved workers yet. Approve workers first.</div>}
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
                📬 Will send to: <b style={{ color: C.accent }}>{targetWorkers.length === workers.length ? `All ${workers.length} workers` : targetWorkers.map(w => w.name).join(', ') || '—'}</b>
              </div>
            </div>

            {/* Message composer */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={S.lbl}>Message</label>
                <button onClick={generateMsg} disabled={aiLoading} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.08)', color: C.purple, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {aiLoading ? <><span className="spin" style={{ ...S.loader, borderTopColor: C.purple }} />Generating…</> : '✦ AI Write Message'}
                </button>
              </div>
              <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Type your message here or use ✦ AI Write Message…" style={{ ...S.inp, resize: 'vertical' }} />
            </div>

            <button
              style={{ ...S.btn(), width: '100%', padding: '11px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (!text.trim() || targetWorkers.length === 0) ? 0.5 : 1 }}
              onClick={send}
              disabled={!text.trim() || sending || targetWorkers.length === 0}
            >
              {sending ? <><span className="spin" style={S.loader} />Sending…</> : <>📤 Send to {targetWorkers.length === workers.length ? 'All Workers' : `${targetWorkers.length} Worker(s)`}</>}
            </button>
            {waStatus && <div className="fade-in" style={{ marginTop: 10, padding: '9px 13px', background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.3)', borderRadius: 8, fontSize: 12, color: '#128C7E', fontWeight: 600 }}>{waStatus}</div>}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['Total Sent', messages.length, C.accent], ['Sent Today', todayCount, C.blue], ['Workers Reached', totalWorkersCovered, C.purple]].map(([l, v, c]) => (
              <div key={l} style={{ ...S.card, padding: '11px 14px', marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search messages…" style={{ ...S.inp, flex: 1, minWidth: 160, fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {[['all', 'All'], ['today', 'Today'], ['week', 'This Week']].map(([v, l]) => (
                <button key={v} onClick={() => setFilterDate(v)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, background: filterDate === v ? 'linear-gradient(135deg,#16a34a,#10b981)' : 'rgba(22,163,74,.08)', color: filterDate === v ? '#fff' : '#16a34a' }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Bulk delete controls */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, padding: '8px 10px', background: C.elevated, borderRadius: 8, border: '1px solid ' + C.border, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>🗑️ Clear old:</span>
              {[7, 14, 30].map(d => {
                const cutoff = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
                const count  = messages.filter(m => (m.date || '') <= cutoff).length;
                return (
                  <button key={d} onClick={() => { if (count === 0) { alert(`No messages older than ${d} days.`); return; } if (!window.confirm(`Delete ${count} message(s) older than ${d} days?`)) return; const updated = messages.filter(m => (m.date || '') > cutoff); setMessages(updated); fsSet('messages', updated); window._addAuditLog?.('delete', `${count} old messages cleared (>${d} days)`); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {d}+ days {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
              <button onClick={() => { if (!window.confirm(`Delete ALL ${messages.length} messages?`)) return; setMessages([]); fsSet('messages', []); window._addAuditLog?.('delete', `All ${messages.length} messages cleared`); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.5)', background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Clear All</button>
            </div>
          )}

          {/* Message list */}
          {filtered.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: C.faint }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600 }}>{search ? 'No messages match your search' : 'No messages sent yet'}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {!search && <button onClick={() => setTab('compose')} style={{ color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textDecoration: 'underline' }}>Compose your first message →</button>}
              </div>
            </div>
          )}

          {filtered.map(m => {
            const isExpanded = expandedId === m.id;
            const isToday    = m.date === today;
            return (
              <div key={m.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid ' + (isToday ? C.accent : C.border) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📢 {m.from || 'Admin'}</span>
                      {isToday    && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(22,163,74,.12)', color: C.accent, fontWeight: 700 }}>Today</span>}
                      {m.aiGenerated && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(124,58,237,.1)', color: C.purple, fontWeight: 700 }}>✦ AI</span>}
                      {m.broadcast  && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: 'rgba(37,99,235,.1)', color: C.blue, fontWeight: 700 }}>📡 Broadcast</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.faint }}>🕐 {m.date} {m.time && '· ' + m.time} · 👥 {m.recipients || 0} worker{(m.recipients || 0) !== 1 ? 's' : ''}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>To: <span style={{ color: C.accent, fontWeight: 600 }}>{m.recipientNames || 'All workers'}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : m.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>{isExpanded ? '▲ Less' : '▼ More'}</button>
                    <button onClick={() => deleteMsg(m.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑️</button>
                  </div>
                </div>
                <div style={{ padding: '10px 13px', background: C.elevated, borderRadius: 8, fontSize: 13, color: C.text, lineHeight: 1.75, ...(isExpanded ? {} : { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }) }}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
