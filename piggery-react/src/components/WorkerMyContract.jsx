// src/components/worker/WorkerMyContract.jsx
// §23a — Worker views & prints their own employment contract

import React, { useState, useEffect } from 'react'
import { C, S } from '../../utils/constants'
import { getBusinessProfile, downloadContractPDF } from '../../utils/pdf'
import { _db } from '../../firebase/config'

const ctypeLabel = { permanent: 'Permanent Employment', fixed: 'Fixed-Term Contract', probation: 'Probationary Contract' }
const roleLabels = {
  farm_manager: 'Farm Manager', pig_caretaker: 'Pig Caretaker', feed_officer: 'Feed Officer',
  sales_officer: 'Sales Officer', health_officer: 'Health Officer', field_worker: 'Field Worker',
  data_entry: 'Data Entry', other: 'Other',
}

export default function WorkerMyContract({ user }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const uid = user.uid || user.id
        const snap = await _db.collection('contracts').where('workerId', '==', uid).get()
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        docs.sort((a, b) => b.createdAt > a.createdAt ? 1 : -1)
        setContracts(docs)
      } catch (e) { console.error('WorkerMyContract load:', e); setContracts([]) }
      setLoading(false)
    }
    load()
  }, [])

  function openContract(c) {
    const w = { name: c.workerName, email: c.workerEmail, jobTitle: c.workerRole, uid: c.workerId }
    setPrinting(true)
    try { const blocked = downloadContractPDF(c, w); setPopupBlocked(!!blocked) }
    catch (e) { alert('PDF error: ' + e.message) }
    setTimeout(() => setPrinting(false), 2500)
  }

  if (loading) return <div className="fade-in" style={{ textAlign: 'center', color: C.faint, padding: '40px 20px', fontSize: 13 }}>⏳ Loading your contract…</div>

  const biz = getBusinessProfile()

  return (
    <div className="fade-in">
      <div style={{ ...S.h1, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span>📄</span> My Employment Contract</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Your official contract issued by <strong>{biz.farmName || 'Alexis Gold Piggery'}</strong>.</div>

      {contracts.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
          <div style={{ fontWeight: 700, color: C.muted, marginBottom: 6 }}>No contract issued yet</div>
          <div style={{ fontSize: 12, color: C.faint }}>Your admin hasn't created your contract yet. Please contact them.</div>
        </div>
      )}

      {contracts.map((c, i) => {
        const isLatest = i === 0
        return (
          <div key={c.id} style={{ ...S.card, border: '2px solid ' + (isLatest ? 'rgba(22,163,74,.3)' : C.border), marginBottom: 14, position: 'relative' }}>
            {isLatest && <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 10, fontWeight: 700, background: 'rgba(22,163,74,.12)', color: C.accent, borderRadius: 20, padding: '2px 10px', border: '1px solid rgba(22,163,74,.3)' }}>✅ Current</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(22,163,74,.1)', border: '1.5px solid rgba(22,163,74,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{ctypeLabel[c.contractType] || 'Employment Contract'}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{roleLabels[c.workerRole] || 'Farm Worker'} · Start: {c.startDate || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                ['👤 Employee',  c.workerName || user.name || '—'],
                ['🏢 Employer',  biz.farmName || 'Alexis Gold Piggery'],
                ['📅 Start Date', c.startDate || '—'],
                [c.contractType === 'fixed' ? '📅 End Date' : '⏳ Probation', (c.contractType === 'fixed' ? c.endDate : (c.probationWeeks + ' weeks')) || '—'],
                ['💰 Gross Salary', c.salary ? `RWF ${Number(c.salary).toLocaleString()}/mo` : 'As agreed'],
                ['🕐 Work Hours',  c.workHours || 'Mon–Sat, 07:00–17:00'],
                ['🏖️ Leave Days', (c.leaveDays || '18') + ' days/year'],
                ['📋 Notice Period', (c.noticePeriod || '30') + ' days'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: C.elevated, borderRadius: 8, padding: '8px 10px', border: '1px solid ' + C.border }}>
                  <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 12 }}>{val}</div>
                </div>
              ))}
            </div>
            {isLatest && (
              <div>
                {popupBlocked && <div style={{ padding: '9px 12px', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 8, marginBottom: 8, fontSize: 12, color: C.accent }}>✅ Contract downloading. Open in Chrome → Print → Save as PDF.</div>}
                <button onClick={() => openContract(c)} disabled={printing} style={{ width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {printing
                    ? <><span className="spin" style={S.loader} />Opening…</>
                    : <><span>📄</span>Open &amp; Print My Contract</>}
                </button>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 6, textAlign: 'center' }}>Opens print preview · tap <strong>Save as PDF</strong></div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
