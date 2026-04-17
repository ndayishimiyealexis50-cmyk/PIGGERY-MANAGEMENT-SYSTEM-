// src/modules/ApprovalPanel.jsx
// Replaces: §12 ApprovalPanel in index.html
//
// Props:
//   feeds / setFeeds
//   logs  / setLogs
//   sales / setSales
//   expenses / setExpenses
//   pigs  / setPigs
//   capital / setCapital
//   pendingPigs / setPendingPigs
//   pushUndo
//   stock / setStock

import { useState } from 'react';
import { C, S } from '../styles/theme';
import { uid, toDay, fmtRWF } from '../lib/utils';
import { fsSet } from '../lib/firestore';
import { capitalTx } from '../lib/utils';
import { FX } from '../utils/fx';
import { autoAddToStock, autoRegisterPigsFromPurchase, genPigTag } from '../utils/pigUtils';

export default function ApprovalPanel({
  feeds, setFeeds, logs, setLogs, sales, setSales,
  expenses, setExpenses, pigs, setPigs,
  capital, setCapital, pendingPigs, setPendingPigs,
  pushUndo, stock, setStock,
}) {
  const [toast, setToast]         = useState(null);
  const [tab, setTab]             = useState('all');
  const [editPigId, setEditPigId] = useState(null);
  const [editPigForm, setEditPigForm] = useState(null);

  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  const pendingFeeds   = feeds.filter(x => x.approved === false);
  const pendingLogs    = logs.filter(x => x.approved === false);
  const pendingSales   = sales.filter(x => x.approved === false);
  const pendingExp     = expenses.filter(x => x.approved === false);
  const pendingPigList = (pendingPigs || []).filter(x => x.approved === false && !x.rejected);
  const total = pendingFeeds.length + pendingLogs.length + pendingSales.length + pendingExp.length + pendingPigList.length;

  // ── Approve single item ────────────────────────────────────────
  function approveItem(type, id) {
    if (type === 'feed') {
      const item = feeds.find(x => x.id === id); if (!item) return;
      const updated = feeds.map(x => x.id === id ? { ...x, approved: true } : x);
      setFeeds(updated); fsSet('feeds', updated);
      capitalTx(capital, setCapital, { type: 'expense', category: 'Feed Purchase', amount: item.cost, description: `${item.kg}kg ${item.feedType} — by ${item.worker}`, date: item.date, refId: 'feed_' + id });
      FX.approve();
      showToast(`✅ Feed log by ${item.worker} approved`);
      window._addAuditLog?.('approve', `Feed log: ${item.kg}kg ${item.feedType} by ${item.worker} (${item.date})`);
    } else if (type === 'log') {
      const item = logs.find(x => x.id === id);
      const updated = logs.map(x => x.id === id ? { ...x, approved: true } : x);
      setLogs(updated); fsSet('logs', updated);
      if (item && item.deaths > 0 && parseFloat(item.deathLossAmount) > 0) {
        capitalTx(capital, setCapital, { type: 'expense', category: 'Pig Death Loss', amount: parseFloat(item.deathLossAmount), description: `${item.deaths} pig(s) died — ${item.worker}`, date: item.date });
      }
      FX.approve();
      showToast(`✅ Daily log by ${item ? item.worker : 'worker'} approved`);
      window._addAuditLog?.('approve', `Daily log by ${item ? item.worker : 'worker'} (${item ? item.date : ''})`);
    } else if (type === 'sale') {
      const item = sales.find(x => x.id === id); if (!item) return;
      const updated = sales.map(x => x.id === id ? { ...x, approved: true } : x);
      setSales(updated); fsSet('sales', updated);
      if (item.pigId) setPigs(p => { const u = p.map(pig => pig.id === item.pigId ? { ...pig, status: 'sold' } : pig); fsSet('pigs', u); return u; });
      capitalTx(capital, setCapital, { type: 'income', category: 'Pig Sale', amount: item.total, description: `${item.weight}kg @ RWF ${item.priceKg}/kg to ${item.buyer || 'buyer'} — by ${item.worker}`, date: item.date, refId: 'sale_' + id });
      FX.approve();
      showToast(`✅ Sale of ${fmtRWF(item.total)} by ${item.worker} approved`);
      window._addAuditLog?.('approve', `Sale ${fmtRWF(item.total)} by ${item.worker} to ${item.buyer || 'buyer'} (${item.date})`);
    } else if (type === 'expense') {
      const item = expenses.find(x => x.id === id); if (!item) return;
      const updated = expenses.map(x => x.id === id ? { ...x, approved: true } : x);
      setExpenses(updated); fsSet('expenses', updated);
      capitalTx(capital, setCapital, { type: 'expense', category: item.category, amount: item.amount, description: `${item.item || item.category} — by ${item.worker}`, date: item.date, refId: 'exp_' + id });
      FX.approve();
      showToast(`✅ Purchase of ${fmtRWF(item.amount)} by ${item.worker} approved`);
      window._addAuditLog?.('approve', `Purchase ${item.item || item.category} ${fmtRWF(item.amount)} by ${item.worker} (${item.date})`);
      if (['Feed Purchase', 'Medicine', 'Equipment'].includes(item.category) && item.quantity) autoAddToStock(item, stock, setStock);
      if (item.category === 'Pig Purchase') autoRegisterPigsFromPurchase(item, pigs, setPigs, capital, setCapital);
    }
  }

  // ── Reject single item ────────────────────────────────────────
  function rejectItem(type, id) {
    const reason = window.prompt('Rejection reason (shown to worker):\nLeave blank for default.', '');
    if (reason === null) return;
    const rejectedAt = new Date().toISOString();
    const rejectionReason = reason.trim() || 'Rejected by admin';
    const patch = x => x.id === id ? { ...x, rejected: true, approved: false, rejectionReason, rejectedAt } : x;
    if (type === 'feed')    { const u = feeds.map(patch);    setFeeds(u);    fsSet('feeds', u);    showToast('✗ Feed log rejected — worker can edit & resubmit', 'error'); window._addAuditLog?.('reject', `Feed log rejected: ${rejectionReason}`); }
    if (type === 'log')     { const u = logs.map(patch);     setLogs(u);     fsSet('logs', u);     showToast('✗ Daily log rejected — worker can edit & resubmit', 'error'); window._addAuditLog?.('reject', `Daily log rejected: ${rejectionReason}`); }
    if (type === 'sale')    { const u = sales.map(patch);    setSales(u);    fsSet('sales', u);    showToast('✗ Sale rejected — worker can edit & resubmit', 'error'); window._addAuditLog?.('reject', `Sale rejected: ${rejectionReason}`); }
    if (type === 'expense') { const u = expenses.map(patch); setExpenses(u); fsSet('expenses', u); showToast('✗ Purchase rejected — worker can edit & resubmit', 'error'); window._addAuditLog?.('reject', `Purchase rejected: ${rejectionReason}`); }
  }

  // ── Approve pig registration ───────────────────────────────────
  function approvePig(id, editedForm) {
    const pig = pendingPigList.find(x => x.id === id); if (!pig) return;
    const finalPig = { ...(editedForm || pig), id: uid(), status: 'active', measurements: [], approved: true };
    const updPending = (pendingPigs || []).map(x => x.id === id ? { ...x, approved: true } : x);
    setPendingPigs(updPending); fsSet('pendingPigs', updPending);
    setPigs(p => { const u = [...p, finalPig]; fsSet('pigs', u); return u; });
    if (setCapital && parseFloat(finalPig.purchasePrice) > 0) {
      capitalTx(capital, setCapital, { type: 'expense', category: 'Pig Purchase', amount: parseFloat(finalPig.purchasePrice), description: `Pig ${finalPig.tag} (${finalPig.stage}) from ${finalPig.source || 'worker submission'}`, date: finalPig.arrivalDate || toDay() });
    }
    setEditPigId(null); setEditPigForm(null);
    FX.approve();
    showToast(`✅ Pig ${finalPig.tag} approved and added to herd`);
    window._addAuditLog?.('approve', `Pig ${finalPig.tag} (${finalPig.stage}) approved and added to herd`);
  }

  function rejectPig(id, note) {
    const updPending = (pendingPigs || []).map(x => x.id === id ? { ...x, rejected: true, adminNote: note || 'Rejected by admin' } : x);
    setPendingPigs(updPending); fsSet('pendingPigs', updPending);
    showToast('✗ Pig registration rejected', 'error');
    window._addAuditLog?.('reject', `Pig registration rejected: ${note || 'Rejected by admin'}`);
  }

  // ── Approve all ────────────────────────────────────────────────
  function approveAll() {
    if (!window.confirm(`Approve all ${total} pending entries?`)) return;
    if (pendingFeeds.length)  { const u = feeds.map(x => x.approved === false ? { ...x, approved: true } : x); setFeeds(u); fsSet('feeds', u); pendingFeeds.forEach(f => capitalTx(capital, setCapital, { type: 'expense', category: 'Feed Purchase', amount: f.cost, description: `${f.kg}kg ${f.feedType} — by ${f.worker}`, date: f.date, refId: 'feed_' + f.id })); }
    if (pendingLogs.length)   { const u = logs.map(x => x.approved === false ? { ...x, approved: true } : x); setLogs(u); fsSet('logs', u); }
    if (pendingSales.length)  { const u = sales.map(x => x.approved === false ? { ...x, approved: true } : x); setSales(u); fsSet('sales', u); pendingSales.forEach(s => { capitalTx(capital, setCapital, { type: 'income', category: 'Pig Sale', amount: s.total, description: `${s.weight}kg @ RWF ${s.priceKg}/kg to ${s.buyer || 'buyer'}`, date: s.date, refId: 'sale_' + s.id }); if (s.pigId) setPigs(p => { const pu = p.map(pig => pig.id === s.pigId ? { ...pig, status: 'sold' } : pig); fsSet('pigs', pu); return pu; }); }); }
    if (pendingExp.length)    { const u = expenses.map(x => x.approved === false ? { ...x, approved: true } : x); setExpenses(u); fsSet('expenses', u); pendingExp.forEach(e => { capitalTx(capital, setCapital, { type: 'expense', category: e.category, amount: e.amount, description: `${e.item || e.category} — by ${e.worker}`, date: e.date, refId: 'exp_' + e.id }); if (['Feed Purchase', 'Medicine', 'Equipment'].includes(e.category) && e.quantity) autoAddToStock(e, stock, setStock); if (e.category === 'Pig Purchase') autoRegisterPigsFromPurchase(e, pigs, setPigs, capital, setCapital); }); }
    FX.approve();
    showToast(`✅ All ${total} entries approved!`);
    window._addAuditLog?.('approve', `Bulk approve: ${total} entries`);
  }

  const BREEDS = ['Landrace', 'Large White', 'Duroc', 'Hampshire', 'Mixed/Local'];
  const STAGES = ['Piglet', 'Weaner', 'Grower', 'Finisher', 'Gilt', 'Sow', 'Boar'];

  // ── Render helpers ─────────────────────────────────────────────
  function TabBtn({ id, label, count }) {
    const active = tab === id;
    return (
      <button onClick={() => setTab(id)} style={{ padding: '6px 13px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, background: active ? 'linear-gradient(135deg,#16a34a,#10b981)' : 'rgba(22,163,74,.08)', color: active ? '#fff' : C.accent, position: 'relative' }}>
        {label}
        {count > 0 && <span style={{ marginLeft: 5, background: active ? 'rgba(255,255,255,.3)' : C.accent, color: active ? '#fff' : '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{count}</span>}
      </button>
    );
  }

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 9998, padding: '11px 18px', background: toast.type === 'error' ? 'rgba(254,242,242,.97)' : 'rgba(240,253,244,.97)', border: '1px solid ' + (toast.type === 'error' ? 'rgba(252,165,165,.7)' : 'rgba(110,231,183,.7)'), borderRadius: 10, fontWeight: 700, fontSize: 13, color: toast.type === 'error' ? '#dc2626' : '#065f46', boxShadow: '0 8px 24px rgba(0,0,0,.12)', backdropFilter: 'blur(8px)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...S.h1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, padding: '5px 9px', background: total > 0 ? 'rgba(245,158,11,.12)' : C.accentSoft, borderRadius: 10, border: '1px solid ' + (total > 0 ? 'rgba(245,158,11,.3)' : 'rgba(22,163,74,.2)') }}>{total > 0 ? '⏳' : '✅'}</span>
            Data Approvals
            {total > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 800 }}>{total}</span>}
          </div>
          <div style={S.sub}>Review and approve worker-submitted data before it affects reports</div>
        </div>
        {total > 0 && (
          <button onClick={approveAll} style={{ ...S.btn(C.accent), fontSize: 13, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>✅ Approve All ({total})</button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <TabBtn id="all"     label="📋 All"      count={total} />
        <TabBtn id="feed"    label="🌾 Feeds"    count={pendingFeeds.length} />
        <TabBtn id="log"     label="📓 Logs"     count={pendingLogs.length} />
        <TabBtn id="sale"    label="💰 Sales"    count={pendingSales.length} />
        <TabBtn id="expense" label="🛒 Purchases" count={pendingExp.length} />
        <TabBtn id="pig"     label="🐷 Pigs"     count={pendingPigList.length} />
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>All caught up!</div>
          <div style={{ fontSize: 13, color: C.faint }}>No pending entries — all worker submissions have been reviewed.</div>
        </div>
      )}

      {/* Feed entries */}
      {(tab === 'all' || tab === 'feed') && pendingFeeds.map(f => (
        <div key={f.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid ' + C.accent }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#d97706', fontWeight: 700 }}>⏳ Pending</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>🌾 Feed Log</span>
                <span style={{ fontSize: 11, color: C.muted }}>by {f.worker}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{f.kg}kg {f.feedType}</div>
              <div style={{ fontSize: 11, color: C.faint }}>📅 {f.date}{f.notes ? ` · ${f.notes}` : ''}</div>
              <div style={{ fontSize: 12, color: C.red, fontWeight: 600, marginTop: 2 }}>Cost: {fmtRWF(f.cost)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => approveItem('feed', f.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approve</button>
              <button onClick={() => rejectItem('feed', f.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
            </div>
          </div>
        </div>
      ))}

      {/* Log entries */}
      {(tab === 'all' || tab === 'log') && pendingLogs.map(l => (
        <div key={l.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#d97706', fontWeight: 700 }}>⏳ Pending</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>📓 Daily Log</span>
                <span style={{ fontSize: 11, color: C.muted }}>by {l.worker}</span>
              </div>
              <div style={{ fontSize: 11, color: C.faint }}>📅 {l.date} · Pigs: {l.alive || 0} alive{l.sick > 0 ? ` · ${l.sick} sick` : ''}{l.deaths > 0 ? ` · ${l.deaths} died` : ''}</div>
              {l.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{l.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => approveItem('log', l.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approve</button>
              <button onClick={() => rejectItem('log', l.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
            </div>
          </div>
        </div>
      ))}

      {/* Sale entries */}
      {(tab === 'all' || tab === 'sale') && pendingSales.map(s => (
        <div key={s.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#d97706', fontWeight: 700 }}>⏳ Pending</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>💰 Sale</span>
                <span style={{ fontSize: 11, color: C.muted }}>by {s.worker}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{fmtRWF(s.total)}</div>
              <div style={{ fontSize: 11, color: C.faint }}>📅 {s.date} · {s.weight}kg @ RWF {s.priceKg}/kg → {s.buyer || 'buyer'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => approveItem('sale', s.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approve</button>
              <button onClick={() => rejectItem('sale', s.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
            </div>
          </div>
        </div>
      ))}

      {/* Purchase/expense entries */}
      {(tab === 'all' || tab === 'expense') && pendingExp.map(e => (
        <div key={e.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid ' + C.amber }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#d97706', fontWeight: 700 }}>⏳ Pending</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>🛒 {e.category}</span>
                <span style={{ fontSize: 11, color: C.muted }}>by {e.worker}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{e.item || e.category} — {fmtRWF(e.amount)}</div>
              <div style={{ fontSize: 11, color: C.faint }}>📅 {e.date}{e.supplier ? ` · ${e.supplier}` : ''}{e.quantity ? ` · ${e.quantity} ${e.unit || ''}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => approveItem('expense', e.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approve</button>
              <button onClick={() => rejectItem('expense', e.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
            </div>
          </div>
        </div>
      ))}

      {/* Pig registration entries */}
      {(tab === 'all' || tab === 'pig') && pendingPigList.map(p => {
        const isEditing = editPigId === p.id;
        const ef        = isEditing ? editPigForm : null;
        return (
          <div key={p.id} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid #a78bfa' }}>
            {isEditing ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 10 }}>✏️ Edit Before Approving — {p.tag}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
                  <div><label style={S.lbl}>Tag Code</label><input value={ef.tag} onChange={e => setEditPigForm({ ...ef, tag: e.target.value })} style={{ ...S.inp, fontFamily: 'monospace', fontWeight: 700 }} /></div>
                  <div><label style={S.lbl}>Breed</label><select value={ef.breed} onChange={e => { const b = e.target.value; setEditPigForm(f => ({ ...f, breed: b, tag: genPigTag(b, f.stage, pigs) })); }} style={S.inp}>{BREEDS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label style={S.lbl}>Stage</label><select value={ef.stage} onChange={e => { const s = e.target.value; setEditPigForm(f => ({ ...f, stage: s, tag: genPigTag(f.breed, s, pigs) })); }} style={S.inp}>{STAGES.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label style={S.lbl}>Gender</label><select value={ef.gender} onChange={e => setEditPigForm({ ...ef, gender: e.target.value })} style={S.inp}><option>Female</option><option>Male</option></select></div>
                  <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={ef.weight} onChange={e => setEditPigForm({ ...ef, weight: e.target.value })} style={S.inp} /></div>
                  <div><label style={S.lbl}>Source</label><input value={ef.source || ''} onChange={e => setEditPigForm({ ...ef, source: e.target.value })} style={S.inp} /></div>
                  <div><label style={S.lbl}>Purchase Price (RWF)</label><input type="number" value={ef.purchasePrice || ''} onChange={e => setEditPigForm({ ...ef, purchasePrice: e.target.value })} style={S.inp} /></div>
                  <div><label style={S.lbl}>Admin Note</label><input placeholder="Optional note to worker" value={ef.adminNote || ''} onChange={e => setEditPigForm({ ...ef, adminNote: e.target.value })} style={S.inp} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approvePig(p.id, ef)} style={{ ...S.btn('#166534'), flex: 1, padding: '9px', fontSize: 13 }}>✅ Approve with Edits</button>
                  <button onClick={() => approvePig(p.id, null)} style={{ ...S.btn(C.accent), flex: 1, padding: '9px', fontSize: 13 }}>✅ Approve As-Is</button>
                  <button onClick={() => { setEditPigId(null); setEditPigForm(null); }} style={{ ...S.btn('#374151'), padding: '9px 13px', fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.12)', color: '#d97706', fontWeight: 700 }}>⏳ Pending</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>🐷 Pig Registration</span>
                      <span style={{ fontSize: 11, color: C.muted }}>by {p.submittedByName}</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 4 }}>{p.tag}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{p.breed} · {p.stage} · {p.gender} · {p.weight || 0}kg{p.source ? ' · from ' + p.source : ''}</div>
                    {p.purchasePrice && parseFloat(p.purchasePrice) > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>💰 Purchase: {fmtRWF(parseFloat(p.purchasePrice))}</div>}
                    {p.notes && <div style={{ fontSize: 11, color: C.faint, marginTop: 2, fontStyle: 'italic' }}>Notes: {p.notes}</div>}
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>📅 Submitted: {(p.submittedAt || '').slice(0, 10)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => approvePig(p.id, null)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approve</button>
                    <button onClick={() => { setEditPigId(p.id); setEditPigForm({ ...p }); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,.4)', background: 'rgba(99,102,241,.06)', color: '#6366f1', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Edit</button>
                    <button onClick={() => { const n = prompt('Rejection reason (optional):'); rejectPig(p.id, n || ''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
