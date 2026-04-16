// src/modules/BonusRequestManager.jsx
// Replaces: §14c BonusRequestManager in index.html
//
// Props:
//   user            – logged-in user object
//   users           – full users array
//   bonusRequests   – array from app state
//   setBonusRequests – state setter
//   salaries        – array (passed through, not mutated here)
//   setSalaries     – state setter (reserved for future use)

import { useState } from 'react';
import { C, S } from '../styles/theme';
import { uid, toDay, fmtRWF } from '../lib/utils';
import { fsSet } from '../lib/firestore';
import { isAdminUser } from '../lib/constants';

// ── Internal sub-component ───────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  { c: '#d97706', bg: 'rgba(245,158,11,.1)',  b: 'rgba(245,158,11,.3)',  l: '⏳ Pending'   },
    consulted:{ c: '#2563eb', bg: 'rgba(37,99,235,.1)',   b: 'rgba(37,99,235,.3)',   l: '💬 Consulted' },
    approved: { c: '#16a34a', bg: 'rgba(22,163,74,.1)',   b: 'rgba(22,163,74,.3)',   l: '✅ Approved'  },
    rejected: { c: '#dc2626', bg: 'rgba(239,68,68,.1)',   b: 'rgba(239,68,68,.3)',   l: '❌ Rejected'  },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.c, border: '1px solid ' + s.b,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      {s.l}
    </span>
  );
}

const BONUS_REASONS = [
  'Night duty / overnight watch',
  'Emergency care (pig giving birth)',
  'Extra weekend work',
  'Sick pig emergency response',
  'Farm cleaning extra session',
  'Market day assistance',
  'Special event / overtime',
  'Other extra work',
];

// ── Main component ───────────────────────────────────────────────
export default function BonusRequestManager({
  user, users, bonusRequests, setBonusRequests, salaries, setSalaries,
}) {
  const isAdmin = isAdminUser(user);
  const [tab, setTab]           = useState(isAdmin ? 'pending' : 'request');
  const [toast, setToast]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [consultId, setConsultId] = useState(null);
  const [suggestAmt, setSuggestAmt] = useState('');
  const [adminNote, setAdminNote]   = useState('');
  const [reqForm, setReqForm]   = useState({ reason: '', description: '', date: toDay(), workedHours: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  const myRequests      = (bonusRequests || []).filter(r => r.workerId === user.uid || r.workerId === user.id);
  const pendingRequests = (bonusRequests || []).filter(r => r.status === 'pending');
  const allRequests     = (bonusRequests || []).slice().sort((a, b) => b.createdAt?.localeCompare(a.createdAt || '') || 0);

  // ── Worker: submit bonus request ─────────────────────────────
  async function submitRequest() {
    if (!reqForm.reason.trim() || !reqForm.description.trim()) {
      showToast('Please fill in reason and description.', 'error');
      return;
    }
    setSaving(true);
    const rec = {
      id: uid(), workerId: user.uid || user.id, workerName: user.name,
      reason: reqForm.reason, description: reqForm.description,
      date: reqForm.date, workedHours: reqForm.workedHours || '',
      status: 'pending', suggestedAmount: 0, adminNote: '',
      createdAt: new Date().toISOString(),
    };
    const updated = [...(bonusRequests || []), rec];
    setBonusRequests(updated);
    await fsSet('bonusRequests', updated);
    setReqForm({ reason: '', description: '', date: toDay(), workedHours: '' });
    window._addAuditLog?.('add', 'Bonus request submitted by worker');
    showToast('✅ Bonus request submitted! Admin will review it.');
    setSaving(false);
  }

  // ── Admin: consult & suggest amount ──────────────────────────
  async function consultAndSuggest(id) {
    if (!suggestAmt || parseFloat(suggestAmt) <= 0) {
      showToast('Enter a suggested bonus amount.', 'error');
      return;
    }
    setSaving(true);
    const updated = (bonusRequests || []).map(r =>
      r.id === id
        ? { ...r, status: 'consulted', suggestedAmount: parseFloat(suggestAmt), adminNote, consultedAt: new Date().toISOString(), consultedBy: user.name }
        : r
    );
    setBonusRequests(updated);
    await fsSet('bonusRequests', updated);
    setConsultId(null); setSuggestAmt(''); setAdminNote('');
    window._addAuditLog?.('edit', 'Bonus consultation saved — amount suggested to worker');
    showToast('✅ Consultation saved — bonus amount suggested to worker.');
    setSaving(false);
  }

  // ── Admin: approve bonus ──────────────────────────────────────
  async function approveBonus(id, amount) {
    setSaving(true);
    const existing = (bonusRequests || []).find(r => r.id === id);
    let finalAmount = parseFloat(amount) || 0;
    if (finalAmount <= 0) finalAmount = parseFloat(existing?.suggestedAmount) || 0;
    if (finalAmount <= 0) {
      const input = window.prompt('Enter approved bonus amount (RWF):');
      finalAmount = parseFloat(input) || 0;
      if (finalAmount <= 0) { showToast('Please enter a valid bonus amount.', 'error'); setSaving(false); return; }
    }
    const updated = (bonusRequests || []).map(r =>
      r.id === id
        ? { ...r, status: 'approved', suggestedAmount: finalAmount, approvedAt: new Date().toISOString(), approvedBy: user.name }
        : r
    );
    setBonusRequests(updated);
    await fsSet('bonusRequests', updated);
    showToast(`✅ Bonus of ${fmtRWF(finalAmount)} approved! Will be added to next salary.`);
    window._addAuditLog?.('approve', `Bonus approved: ${fmtRWF(finalAmount)}`);
    setSaving(false);
  }

  // ── Admin: reject bonus ───────────────────────────────────────
  async function rejectBonus(id) {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    setSaving(true);
    const updated = (bonusRequests || []).map(r =>
      r.id === id
        ? { ...r, status: 'rejected', rejectedAt: new Date().toISOString(), rejectedBy: user.name, rejectionReason: reason }
        : r
    );
    setBonusRequests(updated);
    await fsSet('bonusRequests', updated);
    window._addAuditLog?.('reject', 'Bonus request rejected');
    showToast('Bonus request rejected.');
    setSaving(false);
  }

  const tabs = isAdmin
    ? [['pending', `🔔 Pending (${pendingRequests.length})`], ['all', '📋 All Requests']]
    : [['request', '➕ Declare Bonus'], ['mine', '📋 My Requests']];

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 18, right: 18, zIndex: 9998,
          padding: '12px 20px',
          background: toast.type === 'error' ? 'rgba(254,242,242,.98)' : 'rgba(240,253,244,.98)',
          border: '1px solid ' + (toast.type === 'error' ? 'rgba(252,165,165,.8)' : 'rgba(110,231,183,.8)'),
          borderRadius: 12, fontWeight: 700, fontSize: 13,
          color: toast.type === 'error' ? '#dc2626' : '#065f46',
          boxShadow: '0 8px 30px rgba(0,0,0,.15)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Consult modal */}
      {consultId && (() => {
        const req = (bonusRequests || []).find(r => r.id === consultId);
        if (!req) return null;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
            onClick={e => e.target === e.currentTarget && setConsultId(null)}
          >
            <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 28px 70px rgba(0,0,0,.18)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>💬 Consult Bonus Request</div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>Review the worker's request and suggest an appropriate bonus amount.</div>
              <div style={{ background: C.elevated, borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid ' + C.border }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>🧑‍🌾 {req.workerName} — {req.reason}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{req.description}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.lbl}>Suggested Bonus Amount (RWF) *</label>
                <input type="number" value={suggestAmt} onChange={e => setSuggestAmt(e.target.value)} placeholder="e.g. 10000" style={S.inp} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.lbl}>Admin Note (optional)</label>
                <input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Feedback for worker..." style={S.inp} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => consultAndSuggest(consultId)} disabled={saving} style={{ ...S.btn(C.blue), flex: 1, padding: '10px' }}>
                  {saving ? '⏳ Saving…' : '💬 Save Consultation'}
                </button>
                <button onClick={() => approveBonus(consultId, suggestAmt)} disabled={saving} style={{ ...S.btn(C.accent), flex: 1, padding: '10px' }}>
                  ✅ Approve Directly
                </button>
                <button onClick={() => { setConsultId(null); setSuggestAmt(''); setAdminNote(''); }} style={{ ...S.btn('#374151'), padding: '10px 14px' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ ...S.h1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🌟</span> Bonus Requests
      </div>
      <div style={S.sub}>
        {isAdmin
          ? `${pendingRequests.length} pending · ${(bonusRequests || []).length} total`
          : 'Declare extra work · Track bonus status'}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border }}>
        {tabs.map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── Worker: request form ── */}
      {!isAdmin && tab === 'request' && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginBottom: 12 }}>🌟 Declare Extra Work</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.lbl}>Reason *</label>
              <select value={reqForm.reason} onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} style={S.inp}>
                <option value="">Select reason…</option>
                {BONUS_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.lbl}>Description *</label>
              <textarea rows={3} value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder="Describe what extra work you did…" style={{ ...S.inp, resize: 'vertical' }} />
            </div>
            <div>
              <label style={S.lbl}>Date</label>
              <input type="date" value={reqForm.date} onChange={e => setReqForm({ ...reqForm, date: e.target.value })} style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>Hours Worked (optional)</label>
              <input type="number" placeholder="e.g. 3" value={reqForm.workedHours} onChange={e => setReqForm({ ...reqForm, workedHours: e.target.value })} style={S.inp} />
            </div>
          </div>
          <button
            onClick={submitRequest}
            disabled={saving || !reqForm.reason || !reqForm.description}
            style={{ ...S.btn('#6366f1'), width: '100%', padding: '11px', fontSize: 14, opacity: (!reqForm.reason || !reqForm.description) ? 0.5 : 1 }}
          >
            {saving
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="spin" style={S.loader} />Submitting…</span>
              : '🌟 Submit Bonus Request'}
          </button>
        </div>
      )}

      {/* ── Worker: my requests ── */}
      {!isAdmin && tab === 'mine' && (
        <div>
          {myRequests.length === 0
            ? <div style={{ ...S.card, textAlign: 'center', padding: 32, color: C.faint }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌟</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No bonus requests yet</div>
                <div style={{ fontSize: 12 }}>Use the "Declare Bonus" tab to submit your first request.</div>
              </div>
            : myRequests.slice().reverse().map(r => (
                <div key={r.id} style={{ ...S.card, borderLeft: '4px solid ' + (r.status === 'approved' ? C.accent : r.status === 'rejected' ? C.red : r.status === 'consulted' ? C.blue : C.amber) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.reason}</div>
                      <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ${r.workedHours} hrs` : ''}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>{r.description}</div>
                  {r.status === 'consulted' && (
                    <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: C.blue, marginBottom: 3 }}>💬 Admin is reviewing your request</div>
                      {r.adminNote && <div style={{ color: C.muted, marginTop: 3 }}>Note: <em>{r.adminNote}</em></div>}
                      <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>The bonus amount will be added to your salary once approved.</div>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <div style={{ background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: C.accent }}>✅ Bonus Approved</div>
                      {r.adminNote && <div style={{ color: C.muted, marginTop: 3 }}>Admin note: <em>{r.adminNote}</em></div>}
                      <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>The bonus has been added to your next salary automatically.</div>
                    </div>
                  )}
                  {r.status === 'rejected' && (
                    <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red }}>
                      ❌ Rejected{r.rejectionReason ? ` — ${r.rejectionReason}` : ''}
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}

      {/* ── Admin: pending requests ── */}
      {isAdmin && tab === 'pending' && (
        <div>
          {pendingRequests.length === 0
            ? <div style={{ ...S.card, textAlign: 'center', padding: 32, color: C.faint }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No pending bonus requests</div>
                <div style={{ fontSize: 12 }}>All worker bonus requests have been reviewed.</div>
              </div>
            : pendingRequests.map(r => (
                <div key={r.id} style={{ ...S.card, borderLeft: '4px solid ' + C.amber }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🧑‍🌾 {r.workerName}</div>
                      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{r.reason}</div>
                      <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ⏱️ ${r.workedHours} hrs` : ''} · Submitted {r.createdAt?.slice(0, 10)}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, background: C.elevated, padding: '10px 12px', borderRadius: 8, marginBottom: 12, border: '1px solid ' + C.border }}>
                    "{r.description}"
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => { setConsultId(r.id); setSuggestAmt(''); setAdminNote(''); }} style={{ ...S.btn(C.blue), fontSize: 12, padding: '7px 13px' }}>💬 Consult & Suggest Amount</button>
                    <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 12, padding: '7px 13px' }}>✅ Approve</button>
                    <button onClick={() => rejectBonus(r.id)} style={{ ...S.btn(C.red), fontSize: 12, padding: '7px 13px' }}>❌ Reject</button>
                  </div>
                </div>
              ))}
        </div>
      )}

      {/* ── Admin: all requests ── */}
      {isAdmin && tab === 'all' && (
        <div>
          {allRequests.length === 0
            ? <div style={{ ...S.card, textAlign: 'center', padding: 24, color: C.faint, fontSize: 13 }}>No bonus requests yet.</div>
            : allRequests.map(r => (
                <div key={r.id} style={{ ...S.card, borderLeft: '4px solid ' + (r.status === 'approved' ? C.accent : r.status === 'rejected' ? C.red : r.status === 'consulted' ? C.blue : C.amber) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.workerName} — {r.reason}</div>
                      <div style={{ fontSize: 11, color: C.faint }}>📅 {r.date} {r.workedHours ? `· ${r.workedHours} hrs` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge status={r.status} />
                      {r.suggestedAmount > 0 && <span style={{ fontWeight: 700, color: C.accent, fontSize: 12 }}>{fmtRWF(r.suggestedAmount)}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: r.status === 'pending' ? 10 : 0 }}>{r.description}</div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <button onClick={() => { setConsultId(r.id); setSuggestAmt(''); setAdminNote(''); }} style={{ ...S.btn(C.blue), fontSize: 11, padding: '5px 11px' }}>💬 Consult</button>
                      <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 11, padding: '5px 11px' }}>✅ Approve</button>
                      <button onClick={() => rejectBonus(r.id)} style={{ ...S.btn(C.red), fontSize: 11, padding: '5px 11px' }}>❌ Reject</button>
                    </div>
                  )}
                  {r.status === 'consulted' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => approveBonus(r.id)} style={{ ...S.btn(C.accent), fontSize: 11, padding: '5px 11px' }}>✅ Approve Now</button>
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
