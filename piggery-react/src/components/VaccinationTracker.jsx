// src/modules/VaccinationTracker.jsx
// Replaces: §18b VaccinationTracker in index.html
//
// Props:
//   pigs            – array of pig objects
//   users           – full users array
//   vaccinations    – array from app state
//   setVaccinations – state setter
//   user            – logged-in user object
//   capital         – capital state object
//   setCapital      – state setter

import { useState } from 'react';
import { C, S } from '../styles/theme';
import { uid, toDay, fmtNum, addDays, daysDiff } from '../lib/utils';
import { fsSet, jbinAppend } from '../lib/firestore';
import { capitalTx } from '../utils/capitalUtils';

const isAdminUser = (u) => u?.role === 'admin' || u?.isAdmin === true;

const VACCINES = ['CSF Vaccine', 'FMD Vaccine', 'Ivermectin', 'Dewormer', 'Vitamin B12', 'Other'];

export default function VaccinationTracker({
  pigs, users, vaccinations, setVaccinations, user, capital, setCapital,
}) {
  const isAdmin = isAdminUser(user);
  const active  = pigs.filter(p => p.status === 'active');

  const [form, setForm] = useState({
    pigId: '', vaccine: 'CSF Vaccine', date: toDay(),
    nextDue: '', notes: '', givenBy: user.name, cost: '',
  });
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!form.pigId || !form.date) return;
    const nextDue = form.nextDue || addDays(form.date, 180);
    const cost    = parseFloat(form.cost) || 0;
    const newVac  = { ...form, id: uid(), nextDue, createdAt: toDay() };

    setVaccinations(p => {
      const updated = [...p, newVac];
      fsSet('vaccinations', updated);
      return updated;
    });

    if (setCapital && cost > 0) {
      const pig = pigs.find(p => p.id === form.pigId);
      capitalTx(capital, setCapital, {
        type: 'expense', category: 'Veterinary', amount: cost,
        description: `${form.vaccine} for ${pig ? pig.tag : 'pig'} — by ${form.givenBy}`,
        date: form.date,
      });
    }

    try {
      await jbinAppend('vaccinations', newVac);
      window._addAuditLog?.('add', `Vaccination: ${newVac.vaccine} given to pig ${(pigs || []).find(p => p.id === newVac.pigId)?.tag || newVac.pigId} by ${newVac.givenBy}`);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setForm({ pigId: '', vaccine: 'CSF Vaccine', date: toDay(), nextDue: '', notes: '', givenBy: user.name, cost: '' });
      }, 2000);
    } catch (e) { alert('❌ Failed to save.'); }
  }

  const due     = vaccinations.filter(v => { const d = daysDiff(v.nextDue); return d >= 0 && d <= 14; });
  const overdue = vaccinations.filter(v => daysDiff(v.nextDue) < 0);

  return (
    <div>
      <div style={S.h1}>💉 Vaccination Tracker</div>
      <div style={S.sub}>Track vaccinations · Get due date alerts</div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{ ...S.card, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.3)', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 8 }}>⚠️ Overdue Vaccinations ({overdue.length})</div>
          {overdue.map(v => {
            const pig = pigs.find(p => p.id === v.pigId);
            return (
              <div key={v.id} style={S.row}>
                <span style={{ color: C.text }}>{pig ? pig.tag : '—'} — {v.vaccine}</span>
                <span style={{ color: C.red, fontWeight: 700 }}>{Math.abs(daysDiff(v.nextDue))} days overdue</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Due-soon alert */}
      {due.length > 0 && (
        <div style={{ ...S.card, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.3)', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>🔔 Due Soon ({due.length})</div>
          {due.map(v => {
            const pig = pigs.find(p => p.id === v.pigId);
            return (
              <div key={v.id} style={S.row}>
                <span style={{ color: C.text }}>{pig ? pig.tag : '—'} — {v.vaccine}</span>
                <span style={{ color: C.amber, fontWeight: 700 }}>Due in {daysDiff(v.nextDue)} days</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Log form */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>💉 Log Vaccination</div>
        {saved && <div style={{ padding: 8, background: C.accentSoft, borderRadius: 7, marginBottom: 10, color: C.accent, fontSize: 13 }}>✓ Vaccination recorded!</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={S.lbl}>Pig *</label>
            <select value={form.pigId} onChange={e => setForm({ ...form, pigId: e.target.value })} style={S.inp}>
              <option value="">Select pig</option>
              {active.map(p => <option key={p.id} value={p.id}>{p.tag} — {p.stage}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Vaccine *</label>
            <select value={form.vaccine} onChange={e => setForm({ ...form, vaccine: e.target.value })} style={S.inp}>
              {VACCINES.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div><label style={S.lbl}>Date Given</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={S.inp} /></div>
          <div><label style={S.lbl}>Next Due Date</label><input type="date" value={form.nextDue} onChange={e => setForm({ ...form, nextDue: e.target.value })} style={S.inp} /></div>
          <div>
            <label style={S.lbl}>Cost (RWF) — affects capital</label>
            <input type="number" placeholder="e.g. 2000" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} style={S.inp} />
            {form.cost && parseFloat(form.cost) > 0 && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 3 }}>
                💰 RWF {fmtNum(parseFloat(form.cost))} will be deducted from capital as Veterinary
              </div>
            )}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.lbl}>Notes</label>
            <input placeholder="Any observations..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={S.inp} />
          </div>
        </div>
        <button onClick={save} style={{ ...S.btn(C.accent), width: '100%', padding: 11, fontSize: 14 }}>💉 Save Vaccination →</button>
      </div>

      {/* History */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📋 Vaccination History ({vaccinations.length})</div>
        {vaccinations.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No vaccinations recorded yet.</div>}
        {vaccinations.slice().reverse().map((v, i) => {
          const pig  = pigs.find(p => p.id === v.pigId);
          const dLeft = daysDiff(v.nextDue);
          return (
            <div key={i} style={S.row}>
              <div>
                <div style={{ fontWeight: 600, color: C.text }}>{pig ? pig.tag : '—'} — {v.vaccine}</div>
                <div style={{ fontSize: 11, color: C.faint }}>Given: {v.date} · By: {v.givenBy}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: dLeft < 0 ? C.red : dLeft <= 14 ? C.amber : C.accent, fontWeight: 600 }}>Next: {v.nextDue}</div>
                <div style={{ fontSize: 10, color: C.faint }}>{dLeft < 0 ? 'Overdue' : dLeft === 0 ? 'Today!' : `In ${dLeft} days`}</div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (!window.confirm('Delete this vaccination record?')) return;
                      const _vac = v;
                      setVaccinations(p => {
                        const updated = p.filter(x => x.id !== v.id);
                        fsSet('vaccinations', updated);
                        window._addAuditLog?.('delete', `Vaccination deleted: ${_vac.vaccine} for pig ${_vac.pigId} (${_vac.date})`);
                        return updated;
                      });
                    }}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
                  >🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );}
