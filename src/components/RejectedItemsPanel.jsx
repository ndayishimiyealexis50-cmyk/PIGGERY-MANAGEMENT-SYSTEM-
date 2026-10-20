import { C, S } from "../styles";
// src/components/RejectedItemsPanel.jsx
// Worker panel to edit & resubmit rejected feeds, logs, sales, expenses

import React, { useState } from 'react'
import { C, S } from '../utils/constants'
import { fmtRWF } from '../utils/helpers'
import { fsSet } from '../firebase/db'

export default function RejectedItemsPanel({
  rejectedFeeds, rejectedLogs, rejectedSales, rejectedExp,
  feeds, logs, sales, expenses,
  setFeeds, setLogs, setSales, setExpenses,
}) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(null) // {type, id, fields}

  function startEdit(type, item) { setEditing({ type, id: item.id, fields: { ...item } }) }
  function cancelEdit() { setEditing(null) }

  function saveEdit() {
    if (!editing) return
    const { type, id, fields } = editing
    const resubmitted = {
      ...fields,
      rejected: false, approved: false,
      rejectionReason: undefined, rejectedAt: undefined,
      resubmittedAt: new Date().toISOString(),
    }
    if (type === 'feed')    { const u = feeds.map(x => x.id === id ? resubmitted : x);    setFeeds(u);    fsSet('feeds', u) }
    else if (type === 'log')  { const u = logs.map(x => x.id === id ? resubmitted : x);     setLogs(u);     fsSet('logs', u) }
    else if (type === 'sale') { const u = sales.map(x => x.id === id ? resubmitted : x);    setSales(u);    fsSet('sales', u) }
    else if (type === 'expense') { const u = expenses.map(x => x.id === id ? resubmitted : x); setExpenses(u); fsSet('expenses', u) }
    window._addAuditLog?.('edit', `Worker resubmitted rejected ${type}: edited and awaiting re-approval`)
    setEditing(null)
  }

  const allRejected = [
    ...rejectedFeeds.map(x => ({ ...x, _type: 'feed',    _label: 'Feed Log',      _desc: `${x.feedType || ''} · ${x.kg || ''}kg · ${x.date || ''}` })),
    ...rejectedLogs.map(x  => ({ ...x, _type: 'log',     _label: 'Daily Report',  _desc: `${x.date || ''} · Sick: ${x.sick || 0} · Deaths: ${x.deaths || 0}` })),
    ...rejectedSales.map(x => ({ ...x, _type: 'sale',    _label: 'Sale',          _desc: `${x.pigTag || ''} · ${fmtRWF(x.total || 0)} · ${x.date || ''}` })),
    ...rejectedExp.map(x   => ({ ...x, _type: 'expense', _label: 'Purchase',      _desc: `${x.item || x.category || ''} · ${fmtRWF(x.amount || 0)} · ${x.date || ''}` })),
  ]

  // ── Edit form ──
  if (editing) {
    const f = editing.fields
    const set = (k, v) => setEditing(e => ({ ...e, fields: { ...e.fields, [k]: v } }))
    const typeLabel = { feed: 'Feed Log', log: 'Daily Report', sale: 'Sale', expense: 'Purchase' }

    return (
      <div style={{ background: 'rgba(239,68,68,.06)', border: '2px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: C.red, fontSize: 13, marginBottom: 10 }}>
          ✏️ Edit & Resubmit — {typeLabel[editing.type]}
        </div>

        {editing.type === 'feed' && (
          <>
            <div style={S.lbl}>Feed Type</div>
            <input style={{ ...S.inp, marginBottom: 8 }} value={f.feedType || ''} onChange={e => set('feedType', e.target.value)} placeholder="Feed type" />
            <div style={S.lbl}>Quantity (kg)</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.kg || ''} onChange={e => set('kg', e.target.value)} placeholder="kg" />
            <div style={S.lbl}>Cost (RWF)</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.cost || ''} onChange={e => set('cost', e.target.value)} placeholder="Cost" />
            <div style={S.lbl}>Date</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
            <div style={S.lbl}>Notes</div>
            <textarea style={{ ...S.inp, marginBottom: 8, minHeight: 60 }} value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notes" />
          </>
        )}
        {editing.type === 'log' && (
          <>
            <div style={S.lbl}>Date</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
            <div style={S.lbl}>Sick Pigs</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.sick || ''} onChange={e => set('sick', e.target.value)} placeholder="0" />
            <div style={S.lbl}>Deaths</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.deaths || ''} onChange={e => set('deaths', e.target.value)} placeholder="0" />
            <div style={S.lbl}>Notes</div>
            <textarea style={{ ...S.inp, marginBottom: 8, minHeight: 60 }} value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notes" />
          </>
        )}
        {editing.type === 'sale' && (
          <>
            <div style={S.lbl}>Pig Tag</div>
            <input style={{ ...S.inp, marginBottom: 8 }} value={f.pigTag || ''} onChange={e => set('pigTag', e.target.value)} placeholder="Pig tag" />
            <div style={S.lbl}>Buyer</div>
            <input style={{ ...S.inp, marginBottom: 8 }} value={f.buyer || ''} onChange={e => set('buyer', e.target.value)} placeholder="Buyer name" />
            <div style={S.lbl}>Amount (RWF)</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.total || ''} onChange={e => set('total', e.target.value)} placeholder="Amount" />
            <div style={S.lbl}>Date</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
            <div style={S.lbl}>Notes</div>
            <textarea style={{ ...S.inp, marginBottom: 8, minHeight: 60 }} value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notes" />
          </>
        )}
        {editing.type === 'expense' && (
          <>
            <div style={S.lbl}>Item / Category</div>
            <input style={{ ...S.inp, marginBottom: 8 }} value={f.item || f.category || ''} onChange={e => set('item', e.target.value)} placeholder="Item" />
            <div style={S.lbl}>Amount (RWF)</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="number" value={f.amount || ''} onChange={e => set('amount', e.target.value)} placeholder="Amount" />
            <div style={S.lbl}>Date</div>
            <input style={{ ...S.inp, marginBottom: 8 }} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
            <div style={S.lbl}>Notes</div>
            <textarea style={{ ...S.inp, marginBottom: 8, minHeight: 60 }} value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notes" />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={saveEdit} style={{ ...S.btn(C.accent), flex: 1, fontSize: 13 }}>✅ Resubmit for Approval</button>
          <button onClick={cancelEdit} style={{ ...S.btn('#6b7280'), flex: 1, fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div style={{ background: 'rgba(239,68,68,.05)', border: '2px solid rgba(239,68,68,.25)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>❌</span>
          <span style={{ fontWeight: 700, color: C.red, fontSize: 13 }}>
            {allRejected.length} Submission{allRejected.length > 1 ? 's' : ''} Rejected — Tap to Edit & Resubmit
          </span>
        </div>
        <span style={{ fontSize: 11, color: C.faint }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,.15)' }}>
          {allRejected.map((item, i) => (
            <div key={item.id} style={{ padding: '10px 14px', borderBottom: i < allRejected.length - 1 ? '1px solid rgba(239,68,68,.1)' : 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: C.red, borderRadius: 4, padding: '1px 6px' }}>{item._label}</span>
                  <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._desc}</span>
                </div>
                {item.rejectionReason && <div style={{ fontSize: 11, color: C.red, fontStyle: 'italic' }}>Reason: {item.rejectionReason}</div>}
              </div>
              <button onClick={() => startEdit(item._type, item)} style={{ ...S.btn(C.accent), fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>✏️ Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
