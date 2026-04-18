// ════════════════════════════════════════════════════════════════
// MODULE 25 — PigPerformance  (Herd Intelligence)
// Medium priority — pig-level analytics
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../utils/constants';
import { fmtRWF } from '../utils/formatters';
import { getMarketPrice } from '../utils/helpers';

// ── Constants ────────────────────────────────────────────────────
const ADG        = { Piglet: 0.20, Weaner: 0.35, Grower: 0.50, Finisher: 0.65, Gilt: 0.40, Sow: 0.05, Boar: 0.05 };
const IDEAL_FCR  = { Piglet: 1.8,  Weaner: 2.2,  Grower: 2.5,  Finisher: 2.8,  Gilt: 2.6,  Sow: 3.0,  Boar: 3.0  };
const STAGE_FEED = { Piglet: 0.5,  Weaner: 1.0,  Grower: 1.8,  Finisher: 2.8,  Gilt: 2.2,  Sow: 2.5,  Boar: 2.0  };
const IDEAL_ADG  = { Piglet: 0.22, Weaner: 0.38, Grower: 0.55, Finisher: 0.70, Gilt: 0.45, Sow: 0.05, Boar: 0.05 };

export default function PigPerformance({ pigs, feeds, sales, logs, expenses, incomes, reproductions }) {
  const [tab,       setTab]       = useState('growth');
  const [sortGrowth, setSortGrowth] = useState('score');
  const [sortSow,   setSortSow]   = useState('piglets');

  const active  = pigs.filter(p => p.status === 'active');
  const allSold = pigs.filter(p => p.status === 'sold');

  // ── Per-pig feed cost ─────────────────────────────────────────
  function pigFeedKgCost(pig) {
    const pf        = feeds.filter(f => f.pigId === pig.id);
    const allFeeds  = feeds.filter(f => !f.pigId);
    const perHead   = active.length > 0 ? allFeeds.reduce((s, f) => s + (f.cost || 0), 0) / active.length : 0;
    const directCost = pf.reduce((s, f) => s + (f.cost || 0), 0);
    const directKg   = pf.reduce((s, f) => s + (f.kg   || 0), 0);
    return {
      feedCost: Math.round(directCost + perHead),
      feedKg:   Math.round((directKg + (allFeeds.reduce((s, f) => s + (f.kg || 0), 0) / Math.max(active.length, 1))) * 10) / 10,
    };
  }

  // ── Per-pig sale revenue ──────────────────────────────────────
  function pigSaleRevenue(pig) {
    return sales.filter(x => x.pigId === pig.id).reduce((t, x) => t + (x.total || 0), 0);
  }

  // ── Growth score ──────────────────────────────────────────────
  function growthScore(pig) {
    const ageDays   = pig.dob ? Math.round((new Date() - new Date(pig.dob)) / (1000 * 60 * 60 * 24)) : null;
    const adg       = ADG[pig.stage] || 0.5;
    const { feedKg, feedCost } = pigFeedKgCost(pig);

    const estGain   = ageDays && ageDays > 0 ? Math.min(pig.weight, adg * ageDays) : pig.weight;
    const fcr       = estGain > 0 && feedKg > 0 ? Math.round((feedKg / estGain) * 10) / 10 : null;
    const idealFcr  = IDEAL_FCR[pig.stage] || 2.8;
    const fcrScore  = fcr ? Math.max(0, Math.min(40, Math.round((idealFcr / fcr) * 40))) : 20;

    const benchmarks = { Piglet: 8, Weaner: 20, Grower: 40, Finisher: 70, Gilt: 75, Sow: 130, Boar: 150 };
    const bench      = benchmarks[pig.stage] || 40;
    const wtScore    = Math.min(40, Math.round((pig.weight / bench) * 40));

    const adgEst    = ageDays && ageDays > 30 ? pig.weight / ageDays : adg;
    const adgIdeal  = IDEAL_ADG[pig.stage] || 0.5;
    const adgScore  = Math.min(20, Math.round((adgEst / adgIdeal) * 20));

    const total = Math.min(100, fcrScore + wtScore + adgScore);
    return { total, fcrScore, wtScore, adgScore, fcr, feedCost, feedKg, ageDays, adgEst: Math.round(adgEst * 100) / 100 };
  }

  // ── Decision engine ───────────────────────────────────────────
  function decision(pig, score, repr) {
    const s      = score.total;
    const val    = getMarketPrice(pig.stage, pig.weight);
    const isSow  = pig.stage === 'Sow' || pig.stage === 'Gilt';
    const isBoar = pig.stage === 'Boar';
    const reprRecords  = repr.filter(r => r.sowId === pig.id);
    const farrowedR    = reprRecords.filter(r => r.status === 'farrowed');
    const avgLitter    = farrowedR.length > 0 ? farrowedR.reduce((t, r) => t + (r.piglets || 0), 0) / farrowedR.length : 0;

    if (pig.weight >= 80 && !isSow && !isBoar)
      return { label: '🏷️ SELL NOW',     color: '#16a34a', bg: 'rgba(22,163,74,.08)',   reason: `Market ready at ${pig.weight}kg — est. ${fmtRWF(val)}` };
    if (isSow && farrowedR.length > 0 && avgLitter < 6)
      return { label: '⚠️ REVIEW SOW',   color: C.amber,   bg: 'rgba(245,158,11,.06)', reason: `Low avg litter size: ${avgLitter.toFixed(1)} piglets/litter (target ≥8). Consider culling.` };
    if (isSow && farrowedR.length >= 2 && avgLitter >= 9)
      return { label: '⭐ KEEP — TOP SOW', color: C.purple, bg: 'rgba(124,58,237,.06)', reason: `Excellent: ${avgLitter.toFixed(1)} piglets/litter avg. Priority breeding animal.` };
    if (isSow && reprRecords.length === 0)
      return { label: '🐖 BREED SOON',   color: C.blue,    bg: 'rgba(37,99,235,.06)',  reason: 'No mating recorded yet. Schedule mating to generate income.' };
    if (s >= 80)
      return { label: '✅ GROWING WELL', color: C.accent,  bg: 'rgba(22,163,74,.06)',  reason: `High growth score (${s}/100). Continue current feeding routine.` };
    if (s >= 55)
      return { label: '⏳ ON TRACK',     color: C.muted,   bg: C.elevated,             reason: `Moderate score (${s}/100). Monitor closely and maintain feed quality.` };
    if (s < 40 && score.feedCost > val * 0.8)
      return { label: '🔴 CULL / SELL',  color: C.red,     bg: 'rgba(239,68,68,.06)',  reason: `Poor growth (${s}/100) + high feed cost vs value. Selling now reduces losses.` };
    return   { label: '📋 MONITOR',      color: C.amber,   bg: 'rgba(245,158,11,.06)', reason: `Below average growth (${s}/100). Adjust diet or check for illness.` };
  }

  // ── Sow stats ─────────────────────────────────────────────────
  function sowStats(sow) {
    const records       = reproductions.filter(r => r.sowId === sow.id);
    const farrowed      = records.filter(r => r.status === 'farrowed');
    const totalPiglets  = farrowed.reduce((s, r) => s + (r.piglets || 0), 0);
    const avgLitter     = farrowed.length > 0 ? totalPiglets / farrowed.length : 0;
    const pigletValue   = totalPiglets * 10000;
    const { feedCost }  = pigFeedKgCost(sow);
    const roi           = feedCost > 0 ? Math.round(((pigletValue - feedCost) / feedCost) * 100) : null;
    const pregnant      = records.find(r => r.status === 'pregnant');
    return { records: records.length, farrowed: farrowed.length, totalPiglets, avgLitter: Math.round(avgLitter * 10) / 10, pigletValue, feedCost, roi, pregnant };
  }

  // ── Compute data ──────────────────────────────────────────────
  const sows   = active.filter(p => p.stage === 'Sow' || p.stage === 'Gilt');
  const growers = active.filter(p => ['Grower','Finisher','Weaner','Piglet'].includes(p.stage));

  const growthData = active.map(pig => {
    const score = growthScore(pig);
    const dec   = decision(pig, score, reproductions || []);
    const val   = getMarketPrice(pig.stage, pig.weight);
    const dtm   = pig.weight >= 80 ? 0 : Math.round((80 - pig.weight) / (ADG[pig.stage] || 0.5));
    return { pig, score, dec, val, dtm };
  }).sort((a, b) => {
    if (sortGrowth === 'score') return b.score.total - a.score.total;
    if (sortGrowth === 'dtm')   return a.dtm - b.dtm;
    if (sortGrowth === 'fcr')   return (a.score.fcr || 99) - (b.score.fcr || 99);
    if (sortGrowth === 'value') return b.val - a.val;
    return 0;
  });

  const sowData = sows.map(sow => ({ sow, st: sowStats(sow) })).sort((a, b) => {
    if (sortSow === 'piglets') return b.st.totalPiglets - a.st.totalPiglets;
    if (sortSow === 'litter')  return b.st.avgLitter - a.st.avgLitter;
    if (sortSow === 'roi')     return (b.st.roi || 0) - (a.st.roi || 0);
    return 0;
  });

  // ── Summary stats ─────────────────────────────────────────────
  const readyNow           = active.filter(p => p.weight >= 80 && p.stage !== 'Sow' && p.stage !== 'Boar');
  const sellPotential      = readyNow.reduce((s, p) => s + getMarketPrice(p.stage, p.weight), 0);
  const bestSow            = sowData.length > 0 ? [...sowData].sort((a, b) => b.st.totalPiglets - a.st.totalPiglets)[0] : null;
  const avgGrowthScore     = growthData.length > 0 ? Math.round(growthData.reduce((s, d) => s + d.score.total, 0) / growthData.length) : 0;
  const cullCount          = growthData.filter(d => d.dec.label.includes('CULL') || d.dec.label.includes('REVIEW')).length;
  const totalPigletsAllSows = sowData.reduce((s, d) => s + d.st.totalPiglets, 0);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div style={S.h1}>🧬 Herd Intelligence</div>
      <div style={S.sub}>Growth vs feed · Sow productivity · Profit per pig · Smart decisions</div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Market Ready',      v: readyNow.length + ' pigs',  c: C.accent },
          { l: 'Sell Potential',    v: fmtRWF(sellPotential),        c: '#10b981' },
          { l: 'Avg Growth Score',  v: avgGrowthScore + '/100',      c: avgGrowthScore >= 70 ? C.accent : avgGrowthScore >= 50 ? C.amber : C.red },
          { l: 'Action Needed',     v: cullCount + ' pigs',          c: cullCount > 0 ? C.red : C.accent },
          { l: 'Total Sows',        v: sows.length,                  c: C.pink },
          { l: 'Total Piglets Born', v: totalPigletsAllSows,         c: C.purple },
        ].map(s => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: s.v.toString().length > 9 ? 13 : 20 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Banners */}
      {readyNow.length > 0 && (
        <div style={{ padding: '11px 16px', background: 'rgba(22,163,74,.08)', border: '1.5px solid rgba(22,163,74,.35)', borderRadius: 10, marginBottom: 10, fontSize: 13, color: C.accent, fontWeight: 600 }}>
          🏷️ {readyNow.length} pig{readyNow.length > 1 ? 's' : ''} ready to sell — {fmtRWF(sellPotential)} potential revenue
        </div>
      )}
      {cullCount > 0 && (
        <div style={{ padding: '11px 16px', background: 'rgba(239,68,68,.06)', border: '1.5px solid rgba(239,68,68,.3)', borderRadius: 10, marginBottom: 10, fontSize: 13, color: C.red }}>
          ⚠️ {cullCount} pig{cullCount > 1 ? 's' : ''} flagged for review — poor growth relative to feed cost
        </div>
      )}
      {bestSow && (
        <div style={{ padding: '11px 16px', background: 'rgba(124,58,237,.06)', border: '1.5px solid rgba(124,58,237,.3)', borderRadius: 10, marginBottom: 14, fontSize: 13, color: C.purple }}>
          ⭐ Best sow: <b>{bestSow.sow.tag}</b> — {bestSow.st.totalPiglets} piglets born, avg litter {bestSow.st.avgLitter} — worth {fmtRWF(bestSow.st.pigletValue)}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[['growth','📈 Growth & Feed'],['sows','🐖 Sow Productivity'],['decisions','🎯 Decision Board'],['profit','💰 Profit per Pig']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ══ GROWTH & FEED TAB ══ */}
      {tab === 'growth' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.faint }}>Sort by:</span>
            {[['score','Growth Score'],['dtm','Days to Market'],['fcr','Feed Efficiency'],['value','Market Value']].map(([v, l]) => (
              <button key={v} onClick={() => setSortGrowth(v)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid ' + (sortGrowth === v ? C.accent : C.border), background: sortGrowth === v ? C.accent : 'transparent', color: sortGrowth === v ? '#fff' : C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: sortGrowth === v ? 700 : 400 }}>{l}</button>
            ))}
          </div>
          {growthData.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No active pigs.</div>}
          {growthData.map(({ pig, score, dec, val, dtm }) => {
            const scoreColor = score.total >= 75 ? C.accent : score.total >= 50 ? C.amber : C.red;
            const fcrGood    = score.fcr && score.fcr <= IDEAL_FCR[pig.stage];
            return (
              <div key={pig.id} style={{ ...S.card, marginBottom: 12, borderLeft: '4px solid ' + dec.color }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>🐷 {pig.tag}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: dec.bg, color: dec.color, fontWeight: 700, border: '1px solid ' + dec.color + '33' }}>{dec.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{pig.breed} · {pig.gender} · {pig.stage} · {pig.weight}kg</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.purple }}>{fmtRWF(val)}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>{dtm === 0 ? 'Ready to sell' : dtm + ' days to market'}</div>
                  </div>
                </div>

                {/* Growth score bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: C.muted, fontWeight: 600 }}>Overall Growth Score</span>
                    <span style={{ color: scoreColor, fontWeight: 800 }}>{score.total}/100</span>
                  </div>
                  <div style={{ height: 10, background: C.elevated, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: score.total + '%', background: score.total >= 75 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : score.total >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)', borderRadius: 6, transition: 'width .6s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 10, color: C.faint }}>
                    <span style={{ color: C.blue }}>Weight: {score.wtScore}/40</span>
                    <span>·</span>
                    <span style={{ color: C.accent }}>Feed Conv.: {score.fcrScore}/40</span>
                    <span>·</span>
                    <span style={{ color: C.amber }}>Growth Rate: {score.adgScore}/20</span>
                  </div>
                </div>

                {/* Weight progress to 80kg */}
                {pig.stage !== 'Sow' && pig.stage !== 'Boar' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: C.muted }}>Progress to market (80kg)</span>
                      <span style={{ fontWeight: 700, color: pig.weight >= 80 ? C.accent : C.text }}>{pig.weight}kg / 80kg</span>
                    </div>
                    <div style={{ height: 7, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min((pig.weight / 80) * 100, 100) + '%', background: pig.weight >= 80 ? '#16a34a' : pig.weight >= 65 ? '#f59e0b' : '#3b82f6', borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                  </div>
                )}

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 7, fontSize: 11, marginBottom: 10 }}>
                  {[
                    ['Feed Used',  score.feedKg + 'kg'],
                    ['Feed Cost',  fmtRWF(score.feedCost)],
                    ['FCR',        score.fcr ? score.fcr + 'x' : 'N/A'],
                    ['ADG Est.',   score.adgEst + 'kg/day'],
                    ['Age',        score.ageDays ? score.ageDays + 'd' : 'Unknown'],
                    ['Market Val', fmtRWF(val)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: l === 'FCR' && score.fcr ? (fcrGood ? 'rgba(22,163,74,.07)' : 'rgba(239,68,68,.06)') : C.elevated, borderRadius: 6, padding: '6px 8px', textAlign: 'center', border: '1px solid ' + (l === 'FCR' && score.fcr ? (fcrGood ? 'rgba(22,163,74,.2)' : 'rgba(239,68,68,.2)') : C.border) }}>
                      <div style={{ color: C.faint, fontSize: 9, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: l === 'FCR' && score.fcr ? (fcrGood ? C.accent : C.red) : C.text, fontSize: 11 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Decision reason */}
                <div style={{ padding: '7px 11px', background: dec.bg, borderRadius: 7, fontSize: 12, color: dec.color, fontWeight: 500, border: '1px solid ' + dec.color + '22' }}>
                  💡 {dec.reason}
                </div>

                {/* FCR warning */}
                {score.fcr && !fcrGood && (
                  <div style={{ marginTop: 7, fontSize: 11, color: C.red, padding: '5px 10px', background: 'rgba(239,68,68,.05)', borderRadius: 6 }}>
                    ⚠️ FCR {score.fcr}x exceeds ideal ({IDEAL_FCR[pig.stage]}x for {pig.stage}) — pig consuming more feed per kg of body weight than expected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SOW PRODUCTIVITY TAB ══ */}
      {tab === 'sows' && (
        <div>
          {sows.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No sows or gilts in herd.</div>}

          {/* Leaderboard */}
          {sowData.length > 0 && (
            <div style={{ ...S.card, background: 'linear-gradient(135deg,rgba(124,58,237,.06),rgba(219,39,119,.04))', border: '1px solid rgba(124,58,237,.2)', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 10 }}>🏆 Sow Productivity Leaderboard</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {[['piglets','Most Piglets'],['litter','Best Litter Size'],['roi','Best ROI']].map(([v, l]) => (
                  <button key={v} onClick={() => setSortSow(v)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid ' + (sortSow === v ? C.purple : C.border), background: sortSow === v ? C.purple : 'transparent', color: sortSow === v ? '#fff' : C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                ))}
              </div>
              {sowData.slice(0, 3).map(({ sow, st }, i) => (
                <div key={sow.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: i === 0 ? 'rgba(124,58,237,.08)' : C.elevated, marginBottom: 6, border: '1px solid ' + (i === 0 ? 'rgba(124,58,237,.2)' : C.border) }}>
                  <span style={{ fontSize: 20, minWidth: 28, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{sow.tag} <span style={{ fontWeight: 400, color: C.faint, fontSize: 11 }}>({sow.breed})</span></div>
                    <div style={{ fontSize: 11, color: C.muted }}>Litters: {st.farrowed} · Avg: {st.avgLitter} piglets · Total: {st.totalPiglets} 🐷</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: C.purple, fontSize: 13 }}>{fmtRWF(st.pigletValue)}</div>
                    {st.roi !== null && <div style={{ fontSize: 10, color: st.roi >= 0 ? C.accent : C.red }}>ROI: {st.roi}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full sow cards */}
          {sowData.map(({ sow, st }, idx) => {
            const pregnant   = st.pregnant;
            const noRecord   = st.records === 0;
            const lowLitter  = st.farrowed > 0 && st.avgLitter < 6;
            const topSow     = st.farrowed >= 2 && st.avgLitter >= 9;
            let badge = { label: '', color: C.muted };
            if (topSow)      badge = { label: '⭐ Top Sow',   color: C.purple };
            else if (noRecord)   badge = { label: '🐖 Not Mated', color: C.blue };
            else if (pregnant)   badge = { label: '🤰 Pregnant',  color: C.amber };
            else if (lowLitter)  badge = { label: '⚠️ Low Litter', color: C.red };
            else if (st.farrowed > 0) badge = { label: '✅ Active', color: C.accent };

            return (
              <div key={sow.id} style={{ ...S.card, marginBottom: 12, borderLeft: '4px solid ' + badge.color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>🐖 {sow.tag}</span>
                      {badge.label && <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: badge.color + '18', color: badge.color, fontWeight: 700, border: '1px solid ' + badge.color + '33' }}>{badge.label}</span>}
                      {idx === 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,.1)', color: C.purple, fontWeight: 700 }}>🏆 #1 Producer</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{sow.breed} · {sow.stage} · {sow.weight}kg</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.purple }}>{fmtRWF(st.pigletValue)}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>Lifetime piglet value</div>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 8, marginBottom: 12 }}>
                  {[
                    { l: 'Litters',       v: st.farrowed,                c: C.text },
                    { l: 'Avg Litter',    v: st.avgLitter + ' 🐷',       c: st.avgLitter >= 9 ? C.accent : st.avgLitter >= 7 ? C.amber : st.farrowed > 0 ? C.red : C.faint },
                    { l: 'Total Piglets', v: st.totalPiglets,             c: C.purple },
                    { l: 'Piglet Value',  v: fmtRWF(st.pigletValue),      c: '#10b981' },
                    { l: 'Feed Cost',     v: fmtRWF(st.feedCost),         c: C.red },
                    { l: 'ROI',           v: st.roi !== null ? st.roi + '%' : 'N/A', c: st.roi === null ? C.faint : st.roi >= 0 ? C.accent : C.red },
                  ].map(s => (
                    <div key={s.l} style={{ background: C.elevated, borderRadius: 7, padding: '7px 8px', textAlign: 'center', border: '1px solid ' + C.border }}>
                      <div style={{ fontSize: 9, color: C.faint, marginBottom: 2 }}>{s.l}</div>
                      <div style={{ fontWeight: 700, color: s.c, fontSize: 12 }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* Litter size bar */}
                {st.farrowed > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Avg litter vs target (≥8 piglets)</div>
                    <div style={{ height: 7, background: C.elevated, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min((st.avgLitter / 10) * 100, 100) + '%', background: st.avgLitter >= 9 ? '#16a34a' : st.avgLitter >= 7 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.faint, marginTop: 2 }}>
                      <span>0</span><span style={{ color: C.amber }}>▲6 min</span><span style={{ color: C.accent }}>▲8 target</span><span>10+</span>
                    </div>
                  </div>
                )}

                {/* Decision */}
                <div style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid ' + badge.color + '33', background: badge.color + '0d', color: badge.color }}>
                  {topSow    && '💡 Keep and prioritize breeding — top genetic asset for your herd'}
                  {lowLitter && !topSow && '💡 Low litter size. Consider replacing with a younger, more productive sow.'}
                  {noRecord  && '💡 No mating on record. Schedule mating to start generating piglet income.'}
                  {pregnant  && !topSow && !lowLitter && !noRecord && '💡 Currently pregnant. Prepare farrowing pen and increase feed to 3kg/day.'}
                  {!topSow && !lowLitter && !noRecord && !pregnant && st.farrowed > 0 && '💡 Performing adequately. Continue monitoring litter size trends.'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ DECISION BOARD TAB ══ */}
      {tab === 'decisions' && (
        <div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Recommended actions for each pig based on growth score, feed cost, and market value.</div>
          {[
            { key: 'SELL NOW',     label: '🏷️ Sell Now',          color: '#16a34a', desc: 'Market-ready or cost-effective to sell immediately' },
            { key: 'TOP SOW',      label: '⭐ Top Sows — Keep',    color: C.purple,  desc: 'High-producing sows — protect and breed regularly' },
            { key: 'BREED',        label: '🐖 Breed Soon',          color: C.blue,    desc: 'Unmated sows — schedule mating now' },
            { key: 'GROWING WELL', label: '✅ Growing Well',        color: C.accent,  desc: 'On track — maintain current routine' },
            { key: 'ON TRACK',     label: '⏳ Monitor',              color: C.muted,   desc: 'Average progress — watch feed efficiency' },
            { key: 'REVIEW SOW',   label: '⚠️ Review Sow',         color: C.amber,   desc: 'Low litter size — evaluate culling' },
            { key: 'MONITOR',      label: '📋 Monitor Closely',     color: C.amber,   desc: 'Below average growth — check feed and health' },
            { key: 'CULL',         label: '🔴 Cull / Sell',         color: C.red,     desc: 'Poor growth + high cost — act soon' },
          ].map(({ key, label, color, desc }) => {
            const group = growthData.filter(d => d.dec.label.includes(key));
            if (group.length === 0) return null;
            return (
              <div key={key} style={{ ...S.card, marginBottom: 12, borderLeft: '4px solid ' + color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color }}>{label} ({group.length})</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {group.map(({ pig, score, val }) => (
                    <div key={pig.id} style={{ background: color + '0f', border: '1px solid ' + color + '33', borderRadius: 8, padding: '7px 12px', minWidth: 130 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🐷 {pig.tag}</div>
                      <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>{pig.stage} · {pig.weight}kg</div>
                      <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 3 }}>{fmtRWF(val)}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Score: {score.total}/100</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ PROFIT PER PIG TAB ══ */}
      {tab === 'profit' && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Estimated profit per pig = market value − estimated feed cost share.</div>

          {/* Sold pigs */}
          {allSold.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 10 }}>✅ Sold Pigs — Actual Profit</div>
              {allSold.map(pig => {
                const rev          = pigSaleRevenue(pig);
                const { feedCost } = pigFeedKgCost(pig);
                const profit       = rev - feedCost;
                return (
                  <div key={pig.id} style={{ ...S.card, marginBottom: 8, borderLeft: '3px solid ' + (profit >= 0 ? C.accent : C.red) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🐷 {pig.tag} <span style={{ fontSize: 10, color: C.faint, fontWeight: 400 }}>({pig.stage} · {pig.breed})</span></div>
                        <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>Sale revenue: {fmtRWF(rev)} · Feed cost: {fmtRWF(feedCost)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: profit >= 0 ? C.accent : C.red }}>{profit >= 0 ? '+' : ''}{fmtRWF(profit)}</div>
                        <div style={{ fontSize: 10, color: C.faint }}>Net profit</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active pigs estimated profit */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📊 Active Pigs — Estimated Profit at Sale</div>
          {growthData.map(({ pig, score, val }) => {
            const feedCost  = score.feedCost;
            const estProfit = val - feedCost;
            const margin    = val > 0 ? Math.round((estProfit / val) * 100) : 0;
            return (
              <div key={pig.id} style={{ ...S.card, marginBottom: 8, borderLeft: '3px solid ' + (estProfit >= 0 ? C.accent : C.red) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>🐷 {pig.tag} <span style={{ fontSize: 10, color: C.faint, fontWeight: 400 }}>{pig.stage} · {pig.weight}kg</span></div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.faint, marginTop: 3, flexWrap: 'wrap' }}>
                      <span>Market value: <b style={{ color: C.purple }}>{fmtRWF(val)}</b></span>
                      <span>Feed cost: <b style={{ color: C.red }}>{fmtRWF(feedCost)}</b></span>
                      <span>Margin: <b style={{ color: margin >= 30 ? C.accent : margin >= 0 ? C.amber : C.red }}>{margin}%</b></span>
                    </div>
                    <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
                      <div style={{ height: '100%', width: Math.max(0, Math.min(margin, 100)) + '%', background: margin >= 30 ? C.accent : margin >= 0 ? C.amber : C.red, borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: estProfit >= 0 ? C.accent : C.red }}>{estProfit >= 0 ? '+' : ''}{fmtRWF(estProfit)}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>Est. profit</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
