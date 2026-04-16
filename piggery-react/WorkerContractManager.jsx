// src/components/worker/WorkerContractManager.jsx
// §23b — Admin creates & manages employment contracts per worker

import React, { useState, useEffect } from 'react'
import { C, S } from '../../utils/constants'
import { toDay } from '../../utils/helpers'
import { getBusinessProfile, downloadContractPDF } from '../../utils/pdf'
import { _db } from '../../firebase/config'

const DUTY_DEFAULTS = {
  farm_manager:  '• Oversee all daily farm operations and staff activities\n• Maintain comprehensive records in the FarmIQ management system\n• Plan and manage feed procurement, health protocols, and budgets\n• Report farm performance and financial summaries to the owner\n• Ensure biosecurity standards and animal welfare compliance at all times',
  pig_caretaker: '• Daily feeding, watering and health monitoring of assigned pigs\n• Record all observations in the FarmIQ system accurately\n• Report sick, injured or deceased animals immediately to the Farm Manager\n• Maintain hygiene and cleanliness of pens and feeding equipment\n• Assist with farrowing, vaccinations and treatment procedures',
  feed_officer:  '• Manage and record all incoming feed stock and inventory\n• Prepare and distribute feed rations according to farm schedules\n• Monitor feed consumption and flag any waste or shortfalls\n• Log all feed purchases and usage in the FarmIQ system\n• Maintain feed storage areas in clean, pest-free condition',
  sales_officer: '• Record all pig sales, purchases and income transactions\n• Coordinate with buyers and confirm market-ready pig selections\n• Maintain accurate sales receipts and buyer contact records\n• Log all transactions promptly in the FarmIQ system\n• Assist with market price surveys and valuation updates',
  health_officer:'• Administer vaccinations and treatments per the farm health schedule\n• Monitor all animals daily for signs of illness or injury\n• Maintain complete health records for every pig in the FarmIQ system\n• Quarantine sick animals promptly and notify the Farm Manager\n• Coordinate with veterinary services when required',
  field_worker:  '• Carry out general farm maintenance and cleaning duties\n• Assist with feeding, herding and handling of pigs as directed\n• Support other staff during farrowing, loading and farm events\n• Follow all biosecurity protocols at all times\n• Report any maintenance issues or safety hazards promptly',
  data_entry:    '• Accurately enter all paper-based farm records into the FarmIQ system\n• Verify data entries for completeness and accuracy before submission\n• Maintain filing and organization of physical farm documents\n• Flag any data discrepancies to the Farm Manager immediately\n• Generate daily and weekly data summary reports as required',
}

const roleLabels = { farm_manager:'Farm Manager', pig_caretaker:'Pig Caretaker', feed_officer:'Feed Officer', sales_officer:'Sales Officer', health_officer:'Health Officer', field_worker:'Field Worker', data_entry:'Data Entry', other:'Other' }
const ctypeCol   = { permanent:'#16a34a', fixed:'#2563eb', probation:'#d97706' }
const ctypeLabel = { permanent:'Permanent', fixed:'Fixed-Term', probation:'Probation' }

const BLANK = { workerId:'', nationalId:'', contractType:'permanent', startDate:toDay(), endDate:'', probationWeeks:'12', salary:'', workHours:'Monday – Saturday, 07:00 – 17:00', leaveDays:'18', noticePeriod:'30', duties:'', specialTerms:'' }

export default function WorkerContractManager({ users }) {
  const approved = (users || []).filter(u => u.role === 'worker' && u.approved && !u.removed)

  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [form, setForm] = useState({ ...BLANK })

  function fSet(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function onWorkerChange(wid) {
    const w = approved.find(u => (u.uid || u.id) === wid)
    setForm(p => ({ ...p, workerId: wid, duties: w?.jobTitle && DUTY_DEFAULTS[w.jobTitle] ? DUTY_DEFAULTS[w.jobTitle] : p.duties }))
  }

  useEffect(() => { loadContracts() }, [])

  async function loadContracts() {
    setLoading(true)
    try {
      const snap = await _db.collection('contracts').orderBy('createdAt', 'desc').get()
      setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error('loadContracts error:', e); setContracts([]) }
    setLoading(false)
  }

  async function saveContract() {
    if (!form.workerId) { alert('Please select a worker.'); return }
    if (!form.salary)   { alert('Please enter the monthly salary.'); return }
    setSaving(true)
    try {
      const w = approved.find(u => (u.uid || u.id) === form.workerId) || {}
      const data = { ...form, workerName: w.name || '', workerEmail: w.email || w.username || '', workerRole: w.jobTitle || '', createdAt: new Date().toISOString() }
      await _db.collection('contracts').add(data)
      window._addAuditLog?.('add', `Contract created for ${w.name || form.workerId}`)
      setShowForm(false); setForm({ ...BLANK })
      await loadContracts()
    } catch (e) {
      console.error('saveContract error:', e)
      if (e?.code === 'permission-denied') {
        alert('❌ Permission denied.\n\nYour Firestore Security Rules do not allow writing to the \'contracts\' collection.\n\nPlease update your rules in Firebase Console.')
      } else {
        alert('❌ Failed to save contract.\n\nError: ' + (e.message || e))
      }
    }
    setSaving(false)
  }

  async function deleteContract(id, name) {
    if (!window.confirm(`Delete contract for ${name}? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await _db.collection('contracts').doc(id).delete()
      setContracts(prev => prev.filter(c => c.id !== id))
      window._addAuditLog?.('delete', `Contract deleted for ${name}`)
    } catch (e) { alert('Delete failed.') }
    setDeleting(null)
  }

  function printContract(c) {
    const w = { name: c.workerName, email: c.workerEmail, jobTitle: c.workerRole, uid: c.workerId }
    setPrinting(c.id)
    try { const blocked = downloadContractPDF(c, w); setPopupBlocked(!!blocked) }
    catch (e) { alert('PDF error: ' + e.message) }
    setTimeout(() => setPrinting(null), 2500)
  }

  const taStyle = { ...S.inp, resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit' }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>📄 Employment Contracts</div>
        <button onClick={() => { setShowForm(v => !v); setForm({ ...BLANK }) }}
          style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: showForm ? 'rgba(239,68,68,.12)' : C.accent, color: showForm ? '#f87171' : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showForm ? '✕ Cancel' : '＋ New Contract'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Create &amp; manage official employment contracts. Each contract generates a printable PDF using your farm letterhead.</div>

      {/* New contract form */}
      {showForm && (
        <div style={{ ...S.card, border: '1.5px solid rgba(22,163,74,.3)', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 14 }}>📝 New Employment Contract</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.lbl}>Worker *</label>
              <select value={form.workerId} onChange={e => onWorkerChange(e.target.value)} style={S.inp}>
                <option value="">— Select Worker —</option>
                {approved.map(w => <option key={w.uid || w.id} value={w.uid || w.id}>{w.name} ({roleLabels[w.jobTitle] || w.jobTitle || 'No role'})</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Contract Type *</label>
              <select value={form.contractType} onChange={e => fSet('contractType', e.target.value)} style={S.inp}>
                <option value="permanent">Permanent Employment</option>
                <option value="fixed">Fixed-Term Contract</option>
                <option value="probation">Probationary Contract</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.lbl}>Monthly Salary (RWF) *</label>
              <input type="number" value={form.salary} onChange={e => fSet('salary', e.target.value)} placeholder="e.g. 80000" style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>National ID (optional)</label>
              <input value={form.nationalId} onChange={e => fSet('nationalId', e.target.value)} placeholder="1199780012345678" style={S.inp} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.lbl}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => fSet('startDate', e.target.value)} style={S.inp} />
            </div>
            {form.contractType === 'fixed'
              ? <div><label style={S.lbl}>End Date</label><input type="date" value={form.endDate} onChange={e => fSet('endDate', e.target.value)} style={S.inp} /></div>
              : <div>
                  <label style={S.lbl}>Probation Period</label>
                  <select value={form.probationWeeks} onChange={e => fSet('probationWeeks', e.target.value)} style={S.inp}>
                    {['4','8','12','16','24'].map(w => <option key={w} value={w}>{w} weeks</option>)}
                  </select>
                </div>
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={S.lbl}>Annual Leave (days)</label>
              <select value={form.leaveDays} onChange={e => fSet('leaveDays', e.target.value)} style={S.inp}>
                {['14','15','18','21','25','30'].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Notice Period (days)</label>
              <select value={form.noticePeriod} onChange={e => fSet('noticePeriod', e.target.value)} style={S.inp}>
                {['14','30','60','90'].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Working Hours</label>
              <input value={form.workHours} onChange={e => fSet('workHours', e.target.value)} style={S.inp} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={S.lbl}>Duties &amp; Responsibilities</label>
              {form.workerId && (
                <button onClick={() => {
                  const w = approved.find(u => (u.uid || u.id) === form.workerId)
                  if (w?.jobTitle && DUTY_DEFAULTS[w.jobTitle]) fSet('duties', DUTY_DEFAULTS[w.jobTitle])
                }} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(22,163,74,.4)', background: 'rgba(22,163,74,.07)', color: C.accent, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>↺ Auto-fill from role</button>
              )}
            </div>
            <textarea value={form.duties} onChange={e => fSet('duties', e.target.value)} rows={5} placeholder={'• Duty one\n• Duty two\n• Duty three'} style={taStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.lbl}>Special Terms / Additional Conditions</label>
            <textarea value={form.specialTerms} onChange={e => fSet('specialTerms', e.target.value)} rows={3} placeholder="Housing allowance, performance targets, equipment provided, etc." style={taStyle} />
          </div>

          <div style={{ background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.18)', borderRadius: 8, padding: '10px 13px', marginBottom: 14, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            💡 <strong>Tip:</strong> Select a worker first to auto-fill role-specific duties. The PDF will use your farm letterhead from Business Profile settings.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK }) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={saveContract} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : '💾 Save Contract'}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: C.faint, padding: 30, fontSize: 13 }}>Loading contracts…</div>}

      {!loading && contracts.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: C.faint, fontSize: 13, padding: '28px 20px' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 700, color: C.muted, marginBottom: 4 }}>No contracts yet</div>
          <div>Tap <strong>+ New Contract</strong> above to create the first employment contract.</div>
        </div>
      )}

      {!loading && contracts.map(c => {
        const isExp = expandedId === c.id
        const col = ctypeCol[c.contractType] || C.accent
        const lbl = ctypeLabel[c.contractType] || c.contractType
        return (
          <div key={c.id} style={{ ...S.card, marginBottom: 10, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 15px', cursor: 'pointer' }} onClick={() => setExpandedId(isExp ? null : c.id)}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: col + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{c.workerName || '—'}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roleLabels[c.workerRole] || c.workerRole || 'Worker'} · from {c.startDate || '—'}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: col, background: col + '18', padding: '3px 10px', borderRadius: 12, flexShrink: 0 }}>{lbl}</span>
              <span style={{ color: C.faint, fontSize: 11, marginLeft: 4 }}>{isExp ? '▲' : '▼'}</span>
            </div>
            {isExp && (
              <div style={{ borderTop: '1px solid ' + C.border, padding: '13px 15px', background: C.elevated }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    ['Monthly Salary', 'RWF ' + (c.salary ? Number(c.salary).toLocaleString() : '—')],
                    ['Contract Type', ctypeLabel[c.contractType] || '—'],
                    ['Start Date', c.startDate || '—'],
                    c.contractType === 'fixed' ? ['End Date', c.endDate || '—'] : ['Probation', c.probationWeeks + ' wks'],
                    ['Annual Leave', c.leaveDays + ' days'],
                    ['Notice Period', c.noticePeriod + ' days'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: C.surface, borderRadius: 7, padding: '8px 11px', border: '1px solid ' + C.border }}>
                      <div style={{ fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 2, fontWeight: 600 }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{v}</div>
                    </div>
                  ))}
                </div>
                {c.duties && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9.5, color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>Duties</div>
                    <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'pre-line', background: C.surface, borderRadius: 7, padding: '9px 12px', border: '1px solid ' + C.border, lineHeight: 1.75 }}>{c.duties}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    {popupBlocked && <div style={{ padding: '9px 12px', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 8, marginBottom: 8, fontSize: 12, color: C.accent }}>✅ Contract is downloading. Open in Chrome → Print → Save as PDF.</div>}
                    <button onClick={() => printContract(c)} disabled={printing === c.id} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(22,163,74,.4)', background: 'rgba(22,163,74,.08)', color: C.accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {printing === c.id ? '⏳ Opening…' : '📄 Print Contract PDF'}
                    </button>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>Opens print preview · tap <strong>Save as PDF</strong></div>
                  </div>
                  <button onClick={() => deleteContract(c.id, c.workerName)} disabled={deleting === c.id} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deleting === c.id ? '⏳' : '🗑 Delete'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 8 }}>Created: {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' }) : '—'}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
