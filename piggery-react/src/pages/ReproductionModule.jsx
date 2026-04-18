import { C, S } from '../styles/theme';
import { fsSet } from '../lib/firestore';
import { getOnlineFarmData, setOnlineFarmData } from '../utils/storage';
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import {
  uid, toDay, addDays, daysDiff, fmtRWF, fmtNum,
  capitalTx, GESTATION,
  
} from '../utils/helpers';
import AIPrediction from './AIPrediction';

export default function ReproductionModule({
  pigs, reproductions, setReproductions,
  feeds, sales, logs, expenses, incomes, stock, capital, setCapital
}) {
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ sowId: '', boarId: '', matingDate: toDay(), notes: '', method: 'Natural Service' });
  const [saved, setSaved] = useState(false);
  const [farrowingId, setFarrowingId] = useState(null);
  const [farrowingConfirm, setFarrowingConfirm] = useState(null);
  const [pigletCount, setPigletCount] = useState('10');
  const [stillbornCount, setStillbornCount] = useState('0');

  const sows = pigs.filter(p => p.status === 'active' && (p.stage === 'Sow' || p.stage === 'Gilt'));
  const boars = pigs.filter(p => p.status === 'active' && p.stage === 'Boar');

  const STAGES = [
    { day: 0,   label: 'Mating',       icon: '🐖', desc: 'Breeding recorded',          color: '#8b5cf6' },
    { day: 21,  label: 'Heat Check',   icon: '🔍', desc: 'Check if returned to heat',   color: '#f59e0b' },
    { day: 35,  label: 'Confirm Preg', icon: '✅', desc: 'Physical signs visible',      color: '#3b82f6' },
    { day: 75,  label: 'Mid Preg',     icon: '🤰', desc: 'Increase feed to 2.5kg/day',  color: '#ec4899' },
    { day: 100, label: 'Prep Pen',     icon: '🏠', desc: 'Prepare farrowing pen',       color: '#f97316' },
    { day: 110, label: 'Near Birth',   icon: '⚠️', desc: 'Watch closely, reduce feed',  color: '#ef4444' },
    { day: 114, label: 'Farrowing',    icon: '🐣', desc: 'Birth expected today!',       color: '#16a34a' },
  ];

  async function logMating() {
    if (!form.sowId || !form.matingDate) return;
    const expectedFarrow = addDays(form.matingDate, GESTATION);
    const newRecord = {
      id: uid(), sowId: form.sowId, boarId: form.boarId,
      matingDate: form.matingDate, expectedFarrow,
      heatCheckDate: addDays(form.matingDate, 21),
      preparePenDate: addDays(form.matingDate, 100),
      method: form.method, status: 'pregnant', piglets: 0,
      notes: form.notes, loggedDate: toDay()
    };
    setReproductions(r => { const updated = [...r, newRecord]; fsSet('reproductions', updated); return updated; });
    window._addAuditLog && window._addAuditLog('add', `Breeding record added: sow ${newRecord.sowId} (${newRecord.method || 'Natural'})`);
    setSaved(true);
    setTimeout(() => { setSaved(false); setForm({ sowId: '', boarId: '', matingDate: toDay(), notes: '', method: 'Natural Service' }); }, 2500);
  }

  async function updateStatus(id, status, piglets, stillborn) {
    const record = reproductions.find(x => x.id === id);
    const farrowDate = status === 'farrowed' ? toDay() : undefined;
    let weeklyChecks = undefined;
    if (status === 'farrowed' && piglets > 0 && farrowDate) {
      weeklyChecks = [1, 2, 3, 4, 5, 6, 7, 8].map(wk => ({ week: wk, dueDate: addDays(farrowDate, wk * 7), completed: false, notes: '' }));
    }
    const updated = reproductions.map(x => x.id === id ? {
      ...x, status,
      piglets: piglets || x.piglets,
      stillborn: stillborn || 0,
      farrowDate: farrowDate || x.farrowDate,
      ...(weeklyChecks ? { weeklyChecks } : {})
    } : x);
    setReproductions(updated);
    fsSet('reproductions', updated);
    window._addAuditLog && window._addAuditLog('edit', `Reproduction status updated → ${status}${piglets ? ' (' + piglets + ' piglets)' : ''}`);
    if (status === 'farrowed' && piglets > 0 && setCapital) {
      const sow = pigs.find(p => p.id === record?.sowId);
      const pigletValue = piglets * 10000;
      capitalTx(capital, setCapital, { type: 'income', category: 'Piglet Sale', amount: pigletValue, description: `${piglets} piglets born from ${sow ? sow.tag : 'sow'} — est. value @ RWF 10,000/piglet`, date: toDay() });
    }
    try {
      const data = await getOnlineFarmData() || {};
      await setOnlineFarmData({ ...data, reproductions: updated });
    } catch (e) { console.error(e); }
  }

  const pregnant = reproductions.filter(r => r.status === 'pregnant');
  const farrowed = reproductions.filter(r => r.status === 'farrowed');
  const upcomingFarrows = pregnant.filter(r => daysDiff(r.expectedFarrow) <= 14 && daysDiff(r.expectedFarrow) >= 0);
  const overdue = pregnant.filter(r => daysDiff(r.expectedFarrow) < 0);
  const totalPiglets = farrowed.reduce((s, r) => s + (r.piglets || 0), 0);
  const avgLitter = farrowed.length > 0 ? (totalPiglets / farrowed.length).toFixed(1) : 0;
  const farrowRate = reproductions.length > 0 ? Math.round((farrowed.length / reproductions.length) * 100) : 0;

  function pregProgress(matingDate) {
    const elapsed = GESTATION - daysDiff(addDays(matingDate, GESTATION));
    return Math.min(100, Math.max(0, Math.round((elapsed / GESTATION) * 100)));
  }

  function currentStage(matingDate) {
    const elapsed = GESTATION - daysDiff(addDays(matingDate, GESTATION));
    let stage = STAGES[0];
    for (let s of STAGES) { if (elapsed >= s.day) stage = s; }
    return stage;
  }

  function sowScore(sowId) {
    const records = reproductions.filter(r => r.sowId === sowId);
    const farrowedR = records.filter(r => r.status === 'farrowed');
    const totalP = farrowedR.reduce((s, r) => s + (r.piglets || 0), 0);
    return { litters: farrowedR.length, avg: farrowedR.length > 0 ? (totalP / farrowedR.length).toFixed(1) : 0, rate: records.length > 0 ? Math.round((farrowedR.length / records.length) * 100) : 0, totalPiglets: totalP };
  }

  return (
    <div>
      <div style={S.h1}>🐖 Pregnancy & Reproduction</div>
      <div style={S.sub}>Full breeding cycle · Birth predictions · Sow performance</div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.08)', border: '1.5px solid rgba(239,68,68,.4)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: C.red, fontSize: 14, marginBottom: 6 }}>🚨 OVERDUE — Immediate Attention!</div>
          {overdue.map(r => { const sow = pigs.find(p => p.id === r.sowId); return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(239,68,68,.2)' }}>
              <span style={{ color: C.text, fontWeight: 600 }}>🐷 {sow ? sow.tag : 'Unknown'}</span>
              <span style={{ color: C.red, fontWeight: 700 }}>{Math.abs(daysDiff(r.expectedFarrow))}d overdue — check now!</span>
            </div>
          ); })}
        </div>
      )}
      {upcomingFarrows.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,.08)', border: '1.5px solid rgba(245,158,11,.4)', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: C.amber, fontSize: 14, marginBottom: 6 }}>🔔 Farrowing Soon — Prepare Pens!</div>
          {upcomingFarrows.map(r => { const sow = pigs.find(p => p.id === r.sowId); return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(245,158,11,.2)' }}>
              <span style={{ color: C.text, fontWeight: 600 }}>🐷 {sow ? sow.tag : '—'} · Due: {r.expectedFarrow}</span>
              <span style={{ color: C.amber, fontWeight: 700 }}>{daysDiff(r.expectedFarrow) === 0 ? 'TODAY!' : daysDiff(r.expectedFarrow) + 'd'}</span>
            </div>
          ); })}
        </div>
      )}

      {/* Stats Row 1 */}
      <div style={S.g4}>
        {[
          { l: 'Pregnant', v: pregnant.length, c: C.amber },
          { l: 'Total Litters', v: farrowed.length, c: C.accent },
          { l: 'Avg Litter', v: avgLitter + ' 🐷', c: C.purple },
          { l: 'Farrowing Rate', v: farrowRate + '%', c: farrowRate >= 70 ? C.accent : C.red }
        ].map(s => (
          <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{ ...S.sv, color: s.c, fontSize: 18 }}>{s.v}</div></div>
        ))}
      </div>
      {/* Stats Row 2 */}
      <div style={S.g4}>
        {[
          { l: 'Total Piglets Born', v: fmtNum(totalPiglets), c: C.accent },
          { l: 'Piglet Value', v: fmtRWF(totalPiglets * 10000), c: '#10b981' },
          { l: 'Breeding Females', v: sows.length, c: C.pink },
          { l: 'Active Boars', v: boars.length, c: '#6366f1' }
        ].map(s => (
          <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{ ...S.sv, color: s.c, fontSize: s.v.length > 8 ? 14 : 18 }}>{s.v}</div></div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[['overview', '🐷 Active'], ['predict', '📅 Predictions'], ['log', '➕ Log Mating'], ['sows', '⭐ Sow Records'], ['guide', '📖 Guide'], ['ai', '🤖 AI']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ACTIVE PREGNANCIES */}
      {tab === 'overview' && (
        <div>
          {pregnant.length === 0 && (
            <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🐖</div>No pregnant sows. Log a mating to start tracking.
            </div>
          )}
          {pregnant.map((r, i) => {
            const sow = pigs.find(p => p.id === r.sowId);
            const boar = pigs.find(p => p.id === r.boarId);
            const daysLeft = daysDiff(r.expectedFarrow);
            const progress = pregProgress(r.matingDate);
            const stage = currentStage(r.matingDate);
            const elapsed = GESTATION - daysLeft;
            return (
              <div key={i} style={{ ...S.card, marginBottom: 14, border: '1px solid ' + stage.color + '44' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>🐷 {sow ? sow.tag : 'Unknown'} <span style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>{sow ? '(' + sow.breed + ')' : ''}</span></div>
                    <div style={{ fontSize: 11, color: C.faint }}>{boar ? '♂ ' + boar.tag + ' · ' : ''}Mated: {r.matingDate} · {r.method || 'Natural'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: daysLeft < 0 ? C.red : daysLeft <= 7 ? C.amber : C.accent }}>
                      {daysLeft < 0 ? Math.abs(daysLeft) + 'd' : daysLeft === 0 ? 'TODAY' : daysLeft + 'd'}
                    </div>
                    <div style={{ fontSize: 9, color: C.faint }}>{daysLeft < 0 ? 'OVERDUE' : daysLeft === 0 ? 'BIRTH DAY' : 'UNTIL BIRTH'}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.faint, marginBottom: 3 }}>
                    <span>Day {elapsed} of {GESTATION}</span>
                    <span style={{ color: stage.color, fontWeight: 700 }}>{stage.icon} {stage.label} — {stage.desc}</span>
                    <span>{progress}%</span>
                  </div>
                  <div style={{ height: 10, background: C.elevated, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: progress + '%', background: 'linear-gradient(90deg,#8b5cf6,' + stage.color + ')', borderRadius: 10, transition: 'width .5s' }} />
                  </div>
                </div>
                {/* Stage dots */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: 10 }}>
                  {STAGES.map((s, si) => {
                    const passed = elapsed >= s.day;
                    const current = s.label === stage.label;
                    return (
                      <React.Fragment key={si}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: current ? 26 : 18, height: current ? 26 : 18, borderRadius: '50%', background: passed ? s.color : 'rgba(100,116,139,.15)', border: current ? '3px solid ' + s.color : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: current ? 13 : 9, boxShadow: current ? '0 0 8px ' + s.color + '66' : 'none', transition: 'all .3s' }}>{passed ? s.icon : ''}</div>
                          <div style={{ fontSize: 7, color: passed ? s.color : C.faint, textAlign: 'center', maxWidth: 36, lineHeight: 1.2 }}>{s.label}</div>
                        </div>
                        {si < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: elapsed > s.day ? 'linear-gradient(90deg,' + s.color + ',' + STAGES[si + 1].color + ')' : 'rgba(100,116,139,.15)', margin: '0 1px', marginBottom: 16 }} />}
                      </React.Fragment>
                    );
                  })}
                </div>
                {/* Key dates */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                  {[['🔍 Heat Check', r.heatCheckDate || addDays(r.matingDate, 21)], ['🏠 Prep Pen', r.preparePenDate || addDays(r.matingDate, 100)], ['🐣 Birth Due', r.expectedFarrow]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.faint }}>{l}</div>
                      <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginTop: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* Birth approval flow */}
                {farrowingId === r.id ? (
                  <div style={{ background: 'rgba(22,163,74,.06)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>🐣 Birth Approval — Step 2 of 2</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
                      <div>
                        <label style={S.lbl}>🐷 Piglets Born *</label>
                        <input type="number" min="1" max="30" value={pigletCount} onChange={e => setPigletCount(e.target.value)} style={{ ...S.inp, fontSize: 14, textAlign: 'center' }} autoFocus />
                      </div>
                      <div>
                        <label style={S.lbl}>💀 Stillborn</label>
                        <input type="number" min="0" max="20" value={stillbornCount || '0'} onChange={e => setStillbornCount(e.target.value)} style={{ ...S.inp, fontSize: 14, textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 10, padding: '7px 10px', background: C.elevated, borderRadius: 7 }}>
                      📋 Confirm all details are accurate. Once approved, piglet weekly monitoring will begin automatically.
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button style={{ ...S.btn(C.accent), flex: 1, padding: 9, fontSize: 13 }} onClick={() => { updateStatus(r.id, 'farrowed', parseInt(pigletCount) || 10, parseInt(stillbornCount) || 0); setFarrowingId(null); setPigletCount('10'); setStillbornCount('0'); }}>✅ Approve Birth & Start Monitoring</button>
                      <button style={{ ...S.btn('#6b7280'), padding: '9px 12px', fontSize: 12 }} onClick={() => { setFarrowingId(null); setPigletCount('10'); }}>Cancel</button>
                    </div>
                  </div>
                ) : farrowingConfirm === r.id ? (
                  <div style={{ background: 'rgba(245,158,11,.06)', border: '1.5px solid rgba(245,158,11,.4)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 8 }}>🐣 Birth Approval — Step 1 of 2</div>
                    <div style={{ fontSize: 12, color: C.text, marginBottom: 10, lineHeight: 1.6 }}>
                      Confirm that <strong>{(pigs.find(p => p.id === r.sowId) || {}).tag || 'this sow'}</strong> has given birth.
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button style={{ ...S.btn(C.amber), flex: 1, padding: 9, fontSize: 13, color: '#fff' }} onClick={() => { setFarrowingConfirm(null); setFarrowingId(r.id); }}>✓ Birth Confirmed — Enter Piglet Details</button>
                      <button style={{ ...S.btn('#6b7280'), padding: '9px 12px', fontSize: 12 }} onClick={() => setFarrowingConfirm(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button style={{ ...S.btn(C.accent), flex: 1, padding: 9, fontSize: 12 }} onClick={() => setFarrowingConfirm(r.id)}>🐣 Approve Birth</button>
                    <button style={{ ...S.btn(C.red), padding: '9px 14px', fontSize: 12 }} onClick={() => { if (window.confirm('Mark as failed/aborted?')) updateStatus(r.id, 'failed', 0, 0); }}>✗ Failed</button>
                    <button style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { if (window.confirm('Delete this reproduction record?')) { const updated = reproductions.filter(x => x.id !== r.id); setReproductions(updated); fsSet('reproductions', updated); window._addAuditLog && window._addAuditLog('delete', 'Reproduction record deleted'); } }}>🗑️</button>
                  </div>
                )}
                {r.notes && <div style={{ fontSize: 11, color: C.faint, marginTop: 8, fontStyle: 'italic', padding: '5px 9px', background: C.elevated, borderRadius: 6 }}>📝 {r.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* BIRTH PREDICTIONS */}
      {tab === 'predict' && (
        <div>
          {pregnant.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No pregnant sows to predict.</div>}
          {pregnant.sort((a, b) => a.expectedFarrow?.localeCompare(b.expectedFarrow)).map((r, i) => {
            const sow = pigs.find(p => p.id === r.sowId);
            const daysLeft = daysDiff(r.expectedFarrow);
            const stage = currentStage(r.matingDate);
            const progress = pregProgress(r.matingDate);
            return (
              <div key={i} style={{ ...S.card, marginBottom: 12, border: '1px solid ' + (daysLeft < 0 ? C.red : daysLeft <= 7 ? C.amber : C.border) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>🐷 {sow ? sow.tag : '—'} <span style={{ fontSize: 11, color: stage.color }}>{stage.icon} {stage.label}</span></div>
                  <div style={{ padding: '4px 14px', borderRadius: 20, background: daysLeft < 0 ? C.red : daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? C.amber : C.accentSoft, color: daysLeft <= 7 ? '#fff' : C.accent, fontWeight: 800, fontSize: 13 }}>
                    {daysLeft < 0 ? Math.abs(daysLeft) + 'd OVERDUE' : daysLeft === 0 ? '🐣 TODAY!' : daysLeft + 'd left'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 10 }}>
                  {[['🗓️ Expected Birth', r.expectedFarrow], ['📊 Progress', progress + '%'], ['🔍 Heat Check', r.heatCheckDate || addDays(r.matingDate, 21)], ['🏠 Pen Prep By', r.preparePenDate || addDays(r.matingDate, 100)], ['🐷 Est. Piglets', '8–12 piglets'], ['💰 Est. Value', fmtRWF(100000)]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: '7px 9px' }}>
                      <div style={{ fontSize: 9, color: C.faint }}>{l}</div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600, marginTop: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {daysLeft <= 14 && daysLeft >= 0 && (
                  <div style={{ padding: '9px 12px', background: 'rgba(245,158,11,.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,.2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>📋 Pre-Farrowing Checklist:</div>
                    {['Clean & disinfect farrowing pen', 'Prepare heat lamp & bedding (32°C for piglets)', 'Stock ORS sachets, clean towels, iodine', 'Reduce feed to 1.5kg/day from day 112', 'Prepare iron injection for newborn piglets', 'Watch for swollen udder — sign of imminent birth'].map((item, ii) => (
                      <div key={ii} style={{ fontSize: 11, color: C.muted, padding: '2px 0', display: 'flex', gap: 6 }}><span style={{ color: C.amber }}>□</span>{item}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {farrowed.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>✅ Completed Farrowings ({farrowed.length})</div>
              {farrowed.slice().reverse().map((r, i) => {
                const sow = pigs.find(p => p.id === r.sowId);
                const pendingChecks = (r.weeklyChecks || []).filter(c => !c.completed && daysDiff(c.dueDate) <= 0);
                return (
                  <div key={i} style={{ ...S.card, marginBottom: 10, padding: '11px 14px', border: '1px solid ' + (pendingChecks.length > 0 ? 'rgba(245,158,11,.4)' : C.border) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: pendingChecks.length > 0 ? 10 : 0 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{sow ? sow.tag : '—'} <span style={{ fontSize: 10, color: C.faint }}>Mated: {r.matingDate} · Born: {r.farrowDate || r.expectedFarrow}</span></div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          🐷 {r.piglets || 0} born ·{r.stillborn > 0 ? <span style={{ color: C.red }}> 💀 {r.stillborn} stillborn ·</span> : ''}
                          <span style={{ color: '#10b981', fontWeight: 600 }}> {fmtRWF((r.piglets || 0) * 10000)} est. value</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: C.faint, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {r.weeklyChecks && <span style={{ padding: '2px 7px', borderRadius: 12, background: pendingChecks.length > 0 ? 'rgba(245,158,11,.12)' : 'rgba(22,163,74,.1)', color: pendingChecks.length > 0 ? C.amber : C.accent, fontWeight: 600, fontSize: 10 }}>{pendingChecks.length > 0 ? '⏰ ' + pendingChecks.length + ' check(s) due' : '✅ On track'}</span>}
                        <button onClick={() => { if (window.confirm('Delete this farrowing record?')) { const updated = reproductions.filter(x => x.id !== r.id); setReproductions(updated); fsSet('reproductions', updated); window._addAuditLog && window._addAuditLog('delete', 'Farrowing record deleted'); } }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑️</button>
                      </div>
                    </div>
                    {/* Weekly piglet monitoring */}
                    {r.weeklyChecks && r.weeklyChecks.length > 0 && (() => {
                      const today = toDay();
                      const due = r.weeklyChecks.filter(c => c.dueDate <= today);
                      const upcoming = r.weeklyChecks.filter(c => c.dueDate > today).slice(0, 2);
                      return (
                        <div style={{ background: C.elevated, borderRadius: 8, padding: '9px 12px', marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 7 }}>📅 Weekly Piglet Monitoring</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {due.map(c => (
                              <div key={c.week}
                                style={{ padding: '4px 10px', borderRadius: 20, background: c.completed ? 'rgba(22,163,74,.1)' : 'rgba(245,158,11,.1)', border: '1px solid ' + (c.completed ? 'rgba(22,163,74,.3)' : 'rgba(245,158,11,.4)'), fontSize: 10, fontWeight: 600, color: c.completed ? C.accent : C.amber, cursor: c.completed ? 'default' : 'pointer' }}
                                onClick={() => {
                                  if (!c.completed) {
                                    const updated = reproductions.map(x => x.id === r.id ? { ...x, weeklyChecks: (x.weeklyChecks || []).map(wc => wc.week === c.week ? { ...wc, completed: true, completedDate: toDay() } : wc) } : x);
                                    setReproductions(updated); fsSet('reproductions', updated);
                                    window._addAuditLog && window._addAuditLog('edit', 'Farrowing weekly check marked complete');
                                  }
                                }}>
                                {c.completed ? '✅' : '⏰'} Wk {c.week} · {c.dueDate}
                              </div>
                            ))}
                            {upcoming.map(c => (
                              <div key={c.week} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(100,116,139,.08)', border: '1px solid rgba(100,116,139,.2)', fontSize: 10, color: C.faint }}>
                                📆 Wk {c.week} · {c.dueDate}
                              </div>
                            ))}
                          </div>
                          {due.filter(c => !c.completed).length > 0 && <div style={{ marginTop: 7, fontSize: 10, color: C.amber, fontWeight: 600 }}>⏰ {due.filter(c => !c.completed).length} overdue check(s) — tap to mark complete</div>}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              <div style={{ marginTop: 8, padding: '9px 12px', background: C.accentSoft, borderRadius: 7, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.muted, fontSize: 12 }}>Total: {totalPiglets} piglets · Avg: {avgLitter}/litter</span>
                <span style={{ color: C.accent, fontWeight: 700 }}>{fmtRWF(totalPiglets * 10000)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOG MATING */}
      {tab === 'log' && (
        <div style={{ maxWidth: 540 }}>
          {saved && <div style={{ padding: '11px 14px', background: C.accentSoft, borderRadius: 8, marginBottom: 14, color: C.accent, fontSize: 13, fontWeight: 600 }}>
            ✅ Mating recorded! Expected birth: <strong>{form.matingDate ? addDays(form.matingDate, GESTATION) : '—'}</strong>
          </div>}
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.pink, marginBottom: 14 }}>🐖 Log Mating Event</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Sow / Gilt *</label>
                <select value={form.sowId} onChange={e => setForm({ ...form, sowId: e.target.value })} style={S.inp}>
                  <option value="">Select sow/gilt</option>
                  {sows.map(p => { const sc = sowScore(p.id); return <option key={p.id} value={p.id}>{p.tag} ({p.breed}) — {sc.litters} litters</option>; })}
                </select>
                {sows.length === 0 && <div style={{ fontSize: 10, color: C.amber, marginTop: 3 }}>No sows found. Add female pigs first.</div>}
              </div>
              <div>
                <label style={S.lbl}>Boar (optional)</label>
                <select value={form.boarId} onChange={e => setForm({ ...form, boarId: e.target.value })} style={S.inp}>
                  <option value="">Select boar</option>
                  {boars.map(p => <option key={p.id} value={p.id}>{p.tag} ({p.breed})</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Method</label>
                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={S.inp}>
                  {['Natural Service', 'Artificial Insemination', 'Hand Mating'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Mating Date *</label><input type="date" value={form.matingDate} onChange={e => setForm({ ...form, matingDate: e.target.value })} style={S.inp} /></div>
            </div>

            {/* Genetic Compatibility Check */}
            {(() => {
              if (!form.sowId || !form.boarId) return null;
              const sow = pigs.find(p => p.id === form.sowId);
              const boar = pigs.find(p => p.id === form.boarId);
              if (!sow || !boar) return null;
              const warnings = [];
              const infos = [];
              if (sow.batchName && boar.batchName && sow.batchName === boar.batchName) warnings.push('⚠️ Same batch origin (' + sow.batchName + ') — possible siblings. Risk of inbreeding!');
              if (sow.source && boar.source && sow.source === boar.source && sow.arrivalDate && boar.arrivalDate && sow.arrivalDate === boar.arrivalDate) warnings.push('⚠️ Same source farm & arrival date — may be related. Consider a different boar.');
              const prevMatings = reproductions.filter(r => r.sowId === sow.id && r.boarId === boar.id);
              if (prevMatings.length >= 3) warnings.push('⚠️ This pair has mated ' + prevMatings.length + ' times — rotate boar to improve genetic diversity.');
              const alreadyPreg = reproductions.find(r => r.sowId === sow.id && r.status === 'pregnant');
              if (alreadyPreg) warnings.push('🚫 ' + sow.tag + ' is already pregnant! Expected birth: ' + alreadyPreg.expectedFarrow);
              if (sow.breed === boar.breed) infos.push('✅ Same breed (' + sow.breed + ') — purebred litter expected.');
              else infos.push('✅ Cross-breed match: ' + sow.breed + ' × ' + boar.breed + ' — hybrid vigour expected (higher growth rate).');
              const sc2 = reproductions.filter(r => r.sowId === sow.id && r.status === 'farrowed');
              if (sc2.length > 0) { const avgP = sc2.reduce((s, r) => s + (r.piglets || 0), 0) / sc2.length; infos.push('ℹ️ ' + sow.tag + ' has ' + sc2.length + ' previous litter(s), avg ' + avgP.toFixed(1) + ' piglets.'); }
              if (warnings.length === 0 && !alreadyPreg) infos.push('✅ No inbreeding risks detected. Mating approved.');
              const hasBlock = warnings.some(w => w.startsWith('🚫'));
              return (
                <div style={{ marginBottom: 12, borderRadius: 9, border: '1.5px solid ' + (warnings.length > 0 ? 'rgba(239,68,68,.4)' : 'rgba(22,163,74,.3)'), background: warnings.length > 0 ? 'rgba(239,68,68,.04)' : 'rgba(22,163,74,.04)', padding: '11px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🧬 Genetic Compatibility Check</div>
                  {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: w.startsWith('🚫') ? C.red : C.amber, marginBottom: 5, display: 'flex', gap: 6 }}>{w}</div>)}
                  {infos.map((inf, i) => <div key={i} style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{inf}</div>)}
                  {hasBlock && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: C.red, padding: '6px 10px', background: 'rgba(239,68,68,.08)', borderRadius: 6 }}>⛔ This mating is blocked. Resolve the issue above before proceeding.</div>}
                </div>
              );
            })()}

            {/* Auto-calculated key dates */}
            {form.matingDate && (
              <div style={{ background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>📅 Auto-Calculated Key Dates:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 12 }}>
                  {[['🔍 Heat Check (Day 21)', addDays(form.matingDate, 21), 'No heat = pregnant!'], ['✅ Confirm Preg (Day 35)', addDays(form.matingDate, 35), 'Physical signs visible'], ['🍽️ Increase Feed (Day 75)', addDays(form.matingDate, 75), '2.5kg/day'], ['🏠 Prepare Pen (Day 100)', addDays(form.matingDate, 100), 'Clean & disinfect'], ['⚠️ Near Birth (Day 110)', addDays(form.matingDate, 110), 'Watch closely'], ['🐣 Expected Birth (Day 114)', addDays(form.matingDate, 114), 'Farrowing day!']].map(([l, v, h]) => (
                    <div key={l} style={{ background: '#fff', borderRadius: 7, padding: '7px 10px' }}>
                      <div style={{ fontWeight: 600, color: C.accent, fontSize: 10 }}>{l}</div>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{v}</div>
                      <div style={{ fontSize: 9, color: C.faint }}>{h}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}><label style={S.lbl}>Notes</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. first mating, AI done twice..." style={{ ...S.inp, resize: 'vertical' }} /></div>
            {(() => {
              const sow = pigs.find(p => p.id === form.sowId);
              const alreadyPreg = sow && reproductions.find(r => r.sowId === sow.id && r.status === 'pregnant');
              const blocked = !!alreadyPreg;
              return (
                <button style={{ ...S.btn(blocked ? '#9ca3af' : C.pink), width: '100%', padding: 13, fontSize: 14, fontWeight: 700, cursor: blocked ? 'not-allowed' : 'pointer' }} onClick={blocked ? null : logMating} disabled={blocked}>
                  {blocked ? '⛔ Mating Blocked — Sow Already Pregnant' : '🐖 Record Mating & Generate Timeline →'}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* SOW RECORDS */}
      {tab === 'sows' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>⭐ Sow Performance</div>
          {sows.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No sows registered yet.</div>}
          {sows.map((sow, i) => {
            const sc = sowScore(sow.id);
            const currentPreg = reproductions.find(r => r.sowId === sow.id && r.status === 'pregnant');
            const lastFarrow = reproductions.filter(r => r.sowId === sow.id && r.status === 'farrowed').slice(-1)[0];
            const nextHeat = lastFarrow ? addDays(lastFarrow.farrowDate || lastFarrow.expectedFarrow, 33) : null;
            const rating = sc.litters === 0 ? 'New' : sc.avg >= 10 ? '⭐ Excellent' : sc.avg >= 8 ? '✅ Good' : sc.avg >= 6 ? '⚠️ Average' : '❌ Poor';
            const ratingColor = sc.litters === 0 ? C.faint : parseFloat(sc.avg) >= 10 ? C.amber : parseFloat(sc.avg) >= 8 ? C.accent : parseFloat(sc.avg) >= 6 ? C.amber : C.red;
            return (
              <div key={i} style={{ ...S.card, marginBottom: 12, border: '1px solid ' + (currentPreg ? 'rgba(245,158,11,.3)' : C.border) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>🐷 {sow.tag} <span style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>({sow.breed})</span></div>
                    <div style={{ fontSize: 11, color: C.faint }}>DOB: {sow.dob || '—'} · {sow.weight}kg</div>
                  </div>
                  <span style={{ padding: '3px 11px', borderRadius: 20, background: ratingColor + '22', color: ratingColor, fontSize: 12, fontWeight: 700 }}>{rating}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 8 }}>
                  {[['Litters', sc.litters, C.accent], ['Avg Size', sc.avg + ' 🐷', C.purple], ['Piglets', sc.totalPiglets, C.amber], ['Rate', sc.rate + '%', sc.rate >= 70 ? C.accent : C.red]].map(([l, v, c]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: '7px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {currentPreg && <div style={{ padding: '6px 10px', background: 'rgba(245,158,11,.07)', borderRadius: 7, fontSize: 12, color: C.amber }}>🤰 Pregnant · Birth: <strong>{currentPreg.expectedFarrow}</strong> ({daysDiff(currentPreg.expectedFarrow)}d)</div>}
                {nextHeat && !currentPreg && <div style={{ padding: '6px 10px', background: C.accentSoft, borderRadius: 7, fontSize: 12, color: C.accent }}>🔥 Next heat ~<strong>{nextHeat}</strong></div>}
              </div>
            );
          })}
        </div>
      )}

      {/* GUIDE */}
      {tab === 'guide' && (
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 14 }}>📖 Pig Breeding Guide</div>
          {[
            { t: '🗓️ Gestation', items: ['114 days total (3 months, 3 weeks, 3 days)', 'Normal range: 112–116 days', 'Over 116 days: call vet immediately'] },
            { t: '🔥 Heat Signs', items: ['Swollen red vulva', 'Stands still when pressed on back', 'Restless, loss of appetite', 'Every 21 days if not pregnant', 'Breed on day 2 of heat for best results'] },
            { t: '✅ Pregnancy Signs', items: ['No return to heat at day 21 = likely pregnant', 'Swollen abdomen visible from day 35', 'Udder enlarges from day 90', 'Nesting behavior 24–48h before birth'] },
            { t: '🏠 Prepare Farrowing Pen', items: ['Move sow at day 100–107', 'Clean, disinfect, dry bedding', 'Heat lamp (32°C for piglets)', 'Prepare: towels, iodine, iron injection'] },
            { t: '🐣 Birth Signs', items: ['Nesting & restlessness 12–24h before', 'Milk drops from teats', 'Vulva swollen and relaxed', 'Contractions 30 min before first piglet'] },
            { t: '🐷 Newborn Care', items: ['Clear mucus from nose and mouth', 'Dry with clean towel', 'Disinfect umbilical cord with iodine', 'Iron injection within 3 days', 'Ensure nursing within 1 hour'] },
            { t: '💉 After Farrowing', items: ['Placenta expelled within 4 hours', 'Feed 2–3kg/day, increase after day 3', 'Wean piglets at 28 days', 'Sow in heat 5–7 days after weaning'] },
          ].map(({ t, items }, i) => (
            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < 6 ? '1px solid ' + C.elevated : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 7 }}>{t}</div>
              {items.map((item, ii) => (
                <div key={ii} style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 12, color: C.muted }}>
                  <span style={{ color: C.accent, flexShrink: 0 }}>•</span>{item}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} reproductions={reproductions} stock={stock}
          topic={`Pig reproduction advisor. Pregnant: ${pregnant.length}, upcoming farrows 14d: ${upcomingFarrows.length}, overdue: ${overdue.length}, litters: ${farrowed.length}, avg litter: ${avgLitter}, total piglets: ${totalPiglets}. Give: 1) breeding optimization, 2) health risks for pregnant sows, 3) best selling age for piglets, 4) seasonal breeding tips, 5) genetic improvement for local breeds.`}
          label="AI Reproduction Advisor" icon="🐖" autoRun={false} />
      )}
    </div>
  );
}
