/**
 * §36 — PigAssessmentHistory
 * Page key: "assessmenthistory"
 * Admin-only. Review, approve, or reject weekly pig weight/BCS assessments
 * submitted by workers. Approved measurements update pig weights and feed
 * into growth analytics and profitability reports.
 *
 * Tabs:
 *   ⏳ Pending   — grouped by week, bulk-approve per batch
 *   📈 Analytics — per-pig ADG, weight trend chart, performance vs benchmark
 *   📋 History   — filterable approved record grid
 *
 * Dependencies:
 *   fsSet(key, list)                              — write array to Firestore
 *   getOnlineFarmData() / setOnlineFarmData(patch) — Firestore r/w
 *   toDay()                                       — Rwanda UTC+2 date string
 *   Toast (component)                             — shared toast UI
 *   C, S                                          — style constants
 *   window._addAuditLog                           — optional audit logger
 */

import { useState } from 'react';
import { C, S } from '../utils/constants';
import { fsSet, getOnlineFarmData, setOnlineFarmData } from '../utils/storage';
import { toDay } from '../utils/helpers';
import Toast from '../components/Toast';

// ADG benchmark per stage (kg/day)
const ADG_BENCH = { Piglet: 0.20, Weaner: 0.35, Grower: 0.50, Finisher: 0.65, Gilt: 0.40, Sow: 0.05, Boar: 0.05 };
const BCS_COLOR  = { 1: '#dc2626', 2: '#d97706', 3: '#16a34a', 4: '#d97706', 5: '#dc2626' };

export default function PigAssessmentHistory({ pigs, setPigs, assessments, setAssessments, users }) {
  const [tab,       setTab]       = useState('pending');
  const [selPig,    setSelPig]    = useState('all');
  const [selWorker, setSelWorker] = useState('all');
  const [toast,     setToast]     = useState(null);

  const pending    = (assessments || []).filter(a => a.approved === false);
  const approved   = (assessments || []).filter(a => a.approved === true);
  const activePigs = pigs.filter(p => p.status === 'active');

  // ── Mutations ────────────────────────────────────────────────────────────────
  function approve(a) {
    setPigs(p => {
      const u = p.map(pig => pig.id === a.pigId ? { ...pig, weight: a.weight } : pig);
      fsSet('pigs', u);
      return u;
    });
    const updated = (assessments || []).map(x => x.id === a.id ? { ...x, approved: true, approvedAt: toDay() } : x);
    setAssessments(updated);
    fsSet('assessments', updated);
    getOnlineFarmData().then(data => setOnlineFarmData({
      ...data, assessments: updated,
      pigs: pigs.map(pig => pig.id === a.pigId ? { ...pig, weight: a.weight } : pig),
    })).catch(() => {});
    window._addAuditLog?.('approve', `Assessment approved: ${a.pigTag} weight ${a.weight}kg (${a.worker || ''})`);
    setToast({ type: 'success', message: `✅ Approved! ${a.pigTag} weight updated to ${a.weight}kg` });
  }

  function approveAll(batch) {
    let updatedPigs = [...pigs];
    batch.forEach(a => { updatedPigs = updatedPigs.map(pig => pig.id === a.pigId ? { ...pig, weight: a.weight } : pig); });
    setPigs(updatedPigs);
    fsSet('pigs', updatedPigs);
    const updatedA = (assessments || []).map(x => batch.find(b => b.id === x.id) ? { ...x, approved: true, approvedAt: toDay() } : x);
    setAssessments(updatedA);
    fsSet('assessments', updatedA);
    getOnlineFarmData().then(data => setOnlineFarmData({ ...data, assessments: updatedA, pigs: updatedPigs })).catch(() => {});
    window._addAuditLog?.('approve', `Bulk assessment approval: ${batch.length} measurements approved`);
    setToast({ type: 'success', message: `✅ Approved ${batch.length} assessments! Pig weights updated.` });
  }

  function reject(id) {
    const updated = (assessments || []).filter(x => x.id !== id);
    setAssessments(updated);
    fsSet('assessments', updated);
    getOnlineFarmData().then(data => setOnlineFarmData({ ...data, assessments: updated })).catch(() => {});
    window._addAuditLog?.('reject', 'Assessment rejected and removed.');
    setToast({ type: 'error', message: '🗑️ Assessment rejected and removed.' });
  }

  // ── Analytics helpers ────────────────────────────────────────────────────────
  function pigGrowthHistory(pigId) {
    return (assessments || [])
      .filter(a => a.pigId === pigId && a.approved === true)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  function calcADG(history) {
    if (history.length < 2) return null;
    const first = history[0]; const last = history[history.length - 1];
    const days = Math.round((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    return ((last.weight - first.weight) / days).toFixed(3);
  }

  // Group pending by week
  const pendingByWeek = pending.reduce((acc, a) => {
    const k = a.weekStart || a.date;
    if (!acc[k]) acc[k] = [];
    acc[k].push(a);
    return acc;
  }, {});

  // Filtered approved records
  let filteredApproved = approved;
  if (selPig    !== 'all') filteredApproved = filteredApproved.filter(a => a.pigId    === selPig);
  if (selWorker !== 'all') filteredApproved = filteredApproved.filter(a => a.workerId === selWorker);

  // Per-pig growth analytics
  const pigAnalytics = activePigs.map(pig => {
    const hist       = pigGrowthHistory(pig.id);
    const adg        = calcADG(hist);
    const weightGain = hist.length >= 2 ? hist[hist.length - 1].weight - hist[0].weight : null;
    const weekCount  = hist.length;
    const avgBCS     = hist.length > 0 ? (hist.reduce((s, h) => s + (h.bcs || 3), 0) / hist.length).toFixed(1) : null;
    const bench      = ADG_BENCH[pig.stage] || 0.5;
    const perf       = adg ? ((parseFloat(adg) / bench) * 100).toFixed(0) : null;
    return { pig, hist, adg, weightGain, weekCount, avgBCS, perf };
  }).filter(x => x.weekCount > 0).sort((a, b) => b.weekCount - a.weekCount);

  // Metric mini-card
  const MetricCard = ({ label, value, color }) => (
    <div style={{ background: C.elevated, borderRadius: 7, padding: '6px 9px', textAlign: 'center', border: '1px solid ' + C.border }}>
      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color, fontSize: 12 }}>{value}</div>
    </div>
  );

  return (
    <div className="fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={S.h1}>📏 Growth Assessments</div>
      <div style={S.sub}>Weekly pig measurements · Weight & length tracking · Growth analytics · Profitability signals</div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Pending Approval', v: pending.length,   c: pending.length > 0 ? C.amber : C.accent },
          { l: 'Total Approved',   v: approved.length,  c: C.accent },
          { l: 'Pigs Tracked',     v: pigAnalytics.length, c: C.blue },
          { l: 'This Week',        v: (assessments || []).filter(a => { const d = new Date(a.date); const now = new Date(); return (now - d) / (1000 * 60 * 60 * 24) <= 7; }).length, c: C.purple },
        ].map(s => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: 20 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[
          ['pending',   '⏳ Pending'         + (pending.length ? ` (${pending.length})` : '')],
          ['analytics', '📈 Growth Analytics'],
          ['history',   '📋 All Records'],
        ].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── PENDING ─────────────────────────────────────────────────────────── */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: C.faint }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              No pending assessments. All measurements are approved.
            </div>
          )}

          {Object.entries(pendingByWeek).sort((a, b) => b[0].localeCompare(a[0])).map(([week, items]) => (
            <div key={week} style={{ ...S.card, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>📅 Week of {week}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>
                    {items.length} pig(s) measured by {[...new Set(items.map(a => a.worker))].join(', ')}
                  </div>
                </div>
                <button onClick={() => approveAll(items)} style={{ ...S.btn(C.accent), fontSize: 12, padding: '7px 14px' }}>
                  ✅ Approve All ({items.length})
                </button>
              </div>

              {items.map(a => {
                const weightChange = a.weight - (a.prevWeight || 0);
                const isGood = weightChange > 0;
                return (
                  <div key={a.id} style={{ ...S.row, marginBottom: 8, flexDirection: 'column', alignItems: 'stretch', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                          🐷 {a.pigTag}{' '}
                          <span style={{ fontWeight: 400, color: C.faint, fontSize: 11 }}>({a.pigBreed} · {a.pigStage})</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.faint }}>Submitted by {a.worker} · {a.date}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => approve(a)} style={{ ...S.btn(C.accent), fontSize: 11, padding: '5px 12px' }}>✅ Approve</button>
                        <button onClick={() => reject(a.id)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: C.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Reject</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                      {[
                        ['Previous Weight', a.prevWeight + 'kg', C.muted],
                        ['New Weight',      a.weight + 'kg',     isGood ? C.accent : C.red],
                        ['Weight Change',   (weightChange >= 0 ? '+' : '') + weightChange.toFixed(1) + 'kg', isGood ? C.accent : C.red],
                        ...(a.length ? [['Length', a.length + 'cm', C.blue]] : []),
                        ['BCS', '' + a.bcs + '/5', BCS_COLOR[a.bcs] || C.text],
                      ].map(([l, v, c]) => <MetricCard key={l} label={l} value={v} color={c} />)}
                    </div>
                    {a.notes && <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontStyle: 'italic', padding: '5px 9px', background: C.elevated, borderRadius: 6 }}>📝 {a.notes}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── GROWTH ANALYTICS ────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <div>
          {pigAnalytics.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: C.faint }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
              No approved assessments yet. Approve worker submissions to see growth analytics.
            </div>
          )}

          {pigAnalytics.length > 0 && (
            <div style={{ ...S.card, background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.2)', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>💡 Farm Growth Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
                {(() => {
                  const adgs        = pigAnalytics.filter(x => x.adg !== null).map(x => parseFloat(x.adg));
                  const avgADG      = adgs.length > 0 ? (adgs.reduce((s, v) => s + v, 0) / adgs.length).toFixed(3) : null;
                  const aboveTarget = pigAnalytics.filter(x => x.perf && parseInt(x.perf) >= 90).length;
                  const belowTarget = pigAnalytics.filter(x => x.perf && parseInt(x.perf) <  70).length;
                  return [
                    ['Avg Daily Gain',     avgADG ? avgADG + 'kg/day' : '—',          C.accent],
                    ['On Target (≥90%)',   aboveTarget + ' pigs',                      C.accent],
                    ['Below Target (<70%)',belowTarget + ' pigs', belowTarget > 0 ? C.red : C.faint],
                    ['Total Tracked',      pigAnalytics.length + ' pigs',              C.blue],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ background: C.surface, borderRadius: 8, padding: '9px 11px', textAlign: 'center', border: '1px solid ' + C.border }}>
                      <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: c, fontSize: 14 }}>{v}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {pigAnalytics.map(({ pig, hist, adg, weightGain, weekCount, avgBCS, perf }) => {
            const perfNum   = perf ? parseInt(perf) : null;
            const perfColor = perfNum === null ? C.faint : perfNum >= 90 ? C.accent : perfNum >= 70 ? C.amber : C.red;
            const perfLabel = perfNum === null ? 'No data' : perfNum >= 90 ? '🟢 On Target' : perfNum >= 70 ? '🟡 Below Target' : '🔴 Poor Growth';

            return (
              <div key={pig.id} style={{ ...S.card, marginBottom: 12, borderLeft: '4px solid ' + perfColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
                      🐷 {pig.tag}{' '}
                      <span style={{ fontWeight: 400, color: C.faint, fontSize: 11 }}>({pig.breed} · {pig.stage})</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.faint }}>{weekCount} assessment{weekCount > 1 ? 's' : ''} recorded</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: perfColor + '18', color: perfColor, fontWeight: 700, border: '1px solid ' + perfColor + '33' }}>
                    {perfLabel}
                  </span>
                </div>

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8, marginBottom: 10 }}>
                  {[
                    ['Current Weight', pig.weight + 'kg',       C.text],
                    ['Total Gain',     weightGain !== null ? (weightGain >= 0 ? '+' : '') + weightGain.toFixed(1) + 'kg' : hist.length === 1 ? hist[0].weight + 'kg (1 reading)' : '—', weightGain >= 0 ? C.accent : C.red],
                    ['Avg Daily Gain', adg ? adg + 'kg' : '—',  C.blue],
                    ['vs Benchmark',   perf ? perf + '%' : '—', perfColor],
                    ['Avg BCS',        avgBCS ? avgBCS + '/5' : '—', BCS_COLOR[Math.round(parseFloat(avgBCS || 3))] || C.text],
                    ['Weeks Tracked',  weekCount,                C.purple],
                  ].map(([l, v, c]) => <MetricCard key={l} label={l} value={v} color={c} />)}
                </div>

                {/* Weight trend mini bar chart */}
                {hist.length >= 2 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>📊 Weight trend (kg)</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52 }}>
                      {hist.map((h, i) => {
                        const min   = Math.min(...hist.map(x => x.weight));
                        const max   = Math.max(...hist.map(x => x.weight));
                        const range = max - min || 1;
                        const ht    = Math.max(((h.weight - min) / range) * 40 + 10, 8);
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ fontSize: 8, color: C.faint }}>{h.weight}</div>
                            <div style={{ width: '100%', height: ht, background: i === hist.length - 1 ? 'linear-gradient(180deg,' + C.accent + ',#10b981)' : 'linear-gradient(180deg,#93c5fd,#60a5fa)', borderRadius: 3, transition: 'height .4s' }} />
                            <div style={{ fontSize: 7, color: C.faint, textAlign: 'center' }}>{(h.date || '').slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Profitability signal */}
                {adg && (
                  <div style={{ padding: '7px 10px', borderRadius: 7, fontSize: 11, background: perfColor + '0d', border: '1px solid ' + perfColor + '33', color: perfColor }}>
                    {perfNum >= 90 && '✅ Growing well above target — ideal time to maintain feed and plan for market sale.'}
                    {perfNum >= 70 && perfNum < 90 && '⚠️ Growth is slightly below target. Review feed quality and quantity.'}
                    {perfNum < 70  && '🔴 Poor growth rate vs benchmark. Check for illness, parasites, or feed issues. Consider vet visit.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <select value={selPig} onChange={e => setSelPig(e.target.value)} style={{ ...S.inp, width: 'auto' }}>
              <option value="all">All Pigs</option>
              {activePigs.map(p => <option key={p.id} value={p.id}>{p.tag} ({p.stage})</option>)}
            </select>
            <select value={selWorker} onChange={e => setSelWorker(e.target.value)} style={{ ...S.inp, width: 'auto' }}>
              <option value="all">All Workers</option>
              {[...new Set((assessments || []).map(a => a.workerId))].map(wid => {
                const w = users.find(u => u.id === wid);
                return w ? <option key={wid} value={wid}>{w.name}</option> : null;
              })}
            </select>
          </div>

          {filteredApproved.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: C.faint }}>
              No approved records match the selected filter.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            {filteredApproved.slice().reverse().map(a => (
              <div key={a.id} style={{ ...S.card, padding: '10px 13px', marginBottom: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🐷 {a.pigTag}</div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{a.pigStage} · {a.date}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>⚖️ {a.weight}kg</span>
                  {a.length && <span style={{ fontSize: 12, color: C.blue }}>📏 {a.length}cm</span>}
                  <span style={{ fontSize: 12, color: BCS_COLOR[a.bcs] || C.text }}>BCS {a.bcs}</span>
                </div>
                <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>By {a.worker}</div>
                {a.notes && <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontStyle: 'italic' }}>{a.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
