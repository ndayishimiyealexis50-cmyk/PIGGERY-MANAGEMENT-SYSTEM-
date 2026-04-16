// ════════════════════════════════════════════════════════════════
// MODULE 24 — FeedEfficiency
// Medium priority — FCR analysis
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../styles/theme';
import { fmtRWF, fmtNum } from '../utils/formatters';

const STAGE_FEED = { Piglet: 0.5, Weaner: 1.0, Grower: 1.8, Finisher: 2.8, Gilt: 2.2, Sow: 2.5, Boar: 2.0 };
const FEED_REF   = { 'Maize bran': 350, 'Soya meal': 800, Pellets: 950, 'Kitchen waste': 0, Mixed: 500, Other: 400 };
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FeedEfficiency({ pigs, feeds, logs, expenses, sales, incomes }) {
  const [tab, setTab] = useState('overview');
  const active = pigs.filter(p => p.status === 'active');

  // Overall totals
  const totalKg   = feeds.reduce((s, f) => s + (parseFloat(f.kg)   || 0), 0);
  const totalCost = feeds.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
  const avgCpk    = totalKg > 0 ? Math.round(totalCost / totalKg) : 0;

  // Expected daily feed based on herd
  const expectedDaily = active.reduce((s, p) => s + (STAGE_FEED[p.stage] || 2.0), 0);
  const logDays       = feeds.length > 0 ? new Set(feeds.map(f => f.date)).size : 1;
  const actualDaily   = logDays > 0 ? Math.round((totalKg / logDays) * 10) / 10 : 0;
  const effPct        = expectedDaily > 0 ? Math.round((actualDaily / expectedDaily) * 100) : null;
  const effColor      = effPct === null ? C.faint : effPct >= 90 && effPct <= 115 ? C.accent : effPct < 80 ? C.red : C.amber;

  // Per-stage breakdown
  const byStage = {};
  active.forEach(p => {
    if (!byStage[p.stage]) byStage[p.stage] = { count: 0, expected: 0, pigs: [] };
    byStage[p.stage].count++;
    byStage[p.stage].expected += STAGE_FEED[p.stage] || 2.0;
    byStage[p.stage].pigs.push(p);
  });

  // Per feed type
  const byType = {};
  feeds.forEach(f => {
    const t = f.feedType || 'Other';
    if (!byType[t]) byType[t] = { kg: 0, cost: 0, count: 0 };
    byType[t].kg   += parseFloat(f.kg)   || 0;
    byType[t].cost += parseFloat(f.cost) || 0;
    byType[t].count++;
  });

  // Last 30 days
  const now    = new Date();
  const days30 = feeds.filter(f => { if (!f.date) return false; return (now - new Date(f.date)) / (1000 * 60 * 60 * 24) <= 30; });
  const days30Kg   = days30.reduce((s, f) => s + (parseFloat(f.kg)   || 0), 0);
  const days30Cost = days30.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
  const days30Cpk  = days30Kg > 0 ? Math.round(days30Cost / days30Kg) : 0;

  const costPerPigDay = active.length > 0 && logDays > 0 ? Math.round(totalCost / logDays / active.length) : 0;
  const overFed       = effPct !== null && effPct > 120;
  const underFed      = effPct !== null && effPct < 75;

  // Monthly cost trend
  const monthMap = {};
  feeds.forEach(f => {
    const m = (f.date || '').slice(0, 7);
    if (!m) return;
    if (!monthMap[m]) monthMap[m] = { kg: 0, cost: 0 };
    monthMap[m].kg   += parseFloat(f.kg)   || 0;
    monthMap[m].cost += parseFloat(f.cost) || 0;
  });
  const months   = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const maxCost  = Math.max(...months.map(([, v]) => v.cost), 1);

  return (
    <div className="fade-in">
      <div style={S.h1}>🌾 Feed Efficiency</div>
      <div style={S.sub}>Actual vs expected · Cost trends · Waste detection · Per-pig analysis</div>

      {/* Alert banner */}
      {(overFed || underFed) && (
        <div style={{ padding: '11px 16px', background: overFed ? 'rgba(245,158,11,.08)' : 'rgba(239,68,68,.08)', border: '1.5px solid ' + (overFed ? 'rgba(245,158,11,.4)' : 'rgba(239,68,68,.4)'), borderRadius: 10, marginBottom: 14, fontSize: 13, color: overFed ? C.amber : C.red }}>
          {overFed
            ? `⚠️ Overfeeding detected! Actual feed is ${effPct}% of target — review portions to reduce waste and costs.`
            : `🔴 Underfeeding alert! Actual feed is only ${effPct}% of target — pigs may not be getting enough nutrition.`}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Feed Efficiency', v: effPct !== null ? effPct + '%' : '—',        c: effColor },
          { l: 'Actual/Day',      v: actualDaily + 'kg',                           c: C.text   },
          { l: 'Expected/Day',    v: Math.round(expectedDaily * 10) / 10 + 'kg',  c: C.muted  },
          { l: 'Avg Cost/kg',     v: 'RWF ' + fmtNum(avgCpk),                     c: C.amber  },
          { l: 'Cost/Pig/Day',    v: fmtRWF(costPerPigDay),                        c: C.blue   },
          { l: 'Last 30d Cost',   v: fmtRWF(days30Cost),                           c: C.red    },
        ].map(s => (
          <div key={s.l} style={S.stat}>
            <div style={S.sl}>{s.l}</div>
            <div style={{ ...S.sv, color: s.c, fontSize: s.v.length > 9 ? 13 : 20 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Efficiency meter */}
      {effPct !== null && (
        <div style={{ ...S.card, padding: '13px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📊 Feed Efficiency Meter</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: effColor }}>{effPct}% of target</span>
          </div>
          <div style={{ height: 14, background: C.elevated, borderRadius: 8, overflow: 'hidden', marginBottom: 6, position: 'relative' }}>
            <div style={{ position: 'absolute', left: '75%',  top: 0, bottom: 0, width: 1, background: 'rgba(239,68,68,.4)',   zIndex: 1 }} />
            <div style={{ position: 'absolute', left: '90%',  top: 0, bottom: 0, width: 1, background: C.accent + '66',        zIndex: 1 }} />
            <div style={{ position: 'absolute', left: '115%', top: 0, bottom: 0, width: 1, background: 'rgba(245,158,11,.4)', zIndex: 1 }} />
            <div style={{ height: '100%', width: Math.min(effPct, 140) + '%', background: effColor, borderRadius: 8, transition: 'width .5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.faint }}>
            <span style={{ color: C.red }}>▲ 75% min</span>
            <span style={{ color: C.accent }}>▲ 90–115% ideal</span>
            <span style={{ color: C.amber }}>▲ 120%+ overfeeding</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[['overview','📊 By Stage'],['type','🌾 By Feed Type'],['trend','📅 Monthly Trend'],['pigs','🐷 Per Pig']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* BY STAGE */}
      {tab === 'overview' && (
        <div>
          {Object.keys(byStage).length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No active pigs. Add pigs to see stage analysis.</div>}
          {Object.entries(byStage).map(([stage, data]) => {
            const expD = Math.round(data.expected * 10) / 10;
            return (
              <div key={stage} style={{ ...S.card, marginBottom: 10, borderLeft: '3px solid ' + C.accent }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{stage}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{data.count} pig{data.count > 1 ? 's' : ''} · {expD}kg/day total expected</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Standard: {STAGE_FEED[stage] || 2}kg/pig/day</div>
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Expected: {expD}kg/day</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {data.pigs.map(p => (
                    <div key={p.id} style={{ background: C.elevated, borderRadius: 7, padding: '6px 10px', fontSize: 11, border: '1px solid ' + C.border }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{p.tag}</div>
                      <div style={{ color: C.faint, marginTop: 2 }}>{p.weight}kg · {STAGE_FEED[p.stage] || 2}kg feed/day</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {active.length > 0 && (
            <div style={{ ...S.card, background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>📐 Total Herd Feed Budget</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
                {[
                  ['Expected/day',    Math.round(expectedDaily * 10) / 10 + 'kg'],
                  ['Expected/month',  Math.round(expectedDaily * 30) + 'kg'],
                  ['Est. monthly cost', fmtRWF(Math.round(expectedDaily * 30 * avgCpk))],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: C.surface, borderRadius: 7, padding: '8px 10px', textAlign: 'center', border: '1px solid ' + C.border }}>
                    <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: C.text, marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BY FEED TYPE */}
      {tab === 'type' && (
        <div>
          {Object.keys(byType).length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No feed records yet.</div>}
          {Object.entries(byType).sort((a, b) => b[1].cost - a[1].cost).map(([type, data]) => {
            const cpk       = data.kg > 0 ? Math.round(data.cost / data.kg) : 0;
            const ref       = FEED_REF[type] || 0;
            const pct       = totalCost > 0 ? ((data.cost / totalCost) * 100).toFixed(1) : 0;
            const expensive = ref > 0 && cpk > ref * 1.25;
            const cheap     = ref > 0 && cpk < ref * 0.75;
            return (
              <div key={type} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>🌾 {type}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{data.count} sessions · {Math.round(data.kg * 10) / 10}kg total</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: C.amber }}>{fmtRWF(data.cost)}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,.1)', color: C.amber }}>{pct}% of feed budget</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12, marginBottom: 8 }}>
                  {[
                    ['Avg Cost/kg', 'RWF ' + fmtNum(cpk)],
                    ['Ref Price',   'RWF ' + (ref ? fmtNum(ref) : 'N/A')],
                    ['vs Reference', ref > 0 ? (cpk > ref ? '+' : '') + (cpk - ref) + ' RWF/kg' : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: '7px 10px', textAlign: 'center' }}>
                      <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: l === 'vs Reference' ? (expensive ? C.red : cheap ? C.accent : C.text) : C.text, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {expensive && <div style={{ fontSize: 11, color: C.red, padding: '6px 10px', background: 'rgba(239,68,68,.06)', borderRadius: 6 }}>⚠️ Price is 25%+ above reference — consider alternative suppliers</div>}
                {cheap     && <div style={{ fontSize: 11, color: C.accent, padding: '6px 10px', background: 'rgba(22,163,74,.06)', borderRadius: 6 }}>✅ Good price — {Math.round((1 - cpk / ref) * 100)}% below reference</div>}
                <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ height: '100%', width: pct + '%', background: C.amber, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MONTHLY TREND */}
      {tab === 'trend' && (
        <div>
          {months.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No feed data yet.</div>}
          {months.map(([m, data]) => {
            const cpk   = data.kg > 0 ? Math.round(data.cost / data.kg) : 0;
            const label = MONTH_LABELS[parseInt(m.split('-')[1]) - 1] + ' ' + m.split('-')[0].slice(2);
            return (
              <div key={m} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: C.text }}>{label}</span>
                  <span style={{ color: C.amber, fontWeight: 700 }}>{fmtRWF(data.cost)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12, marginBottom: 6 }}>
                  {[['Feed (kg)', Math.round(data.kg * 10) / 10 + 'kg'], ['Total Cost', fmtRWF(data.cost)], ['Avg/kg', 'RWF ' + fmtNum(cpk)]].map(([l, v]) => (
                    <div key={l} style={{ background: C.elevated, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
                      <div style={{ fontWeight: 700, color: C.text, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 6, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (data.cost / maxCost * 100) + '%', background: C.amber, borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PER PIG */}
      {tab === 'pigs' && (
        <div>
          {active.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No active pigs.</div>}
          {active.map(p => {
            const pigFeeds = feeds.filter(f => f.pigId === p.id);
            const pigKg    = pigFeeds.reduce((s, f) => s + (parseFloat(f.kg)   || 0), 0);
            const pigCost  = pigFeeds.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
            const pigDays  = pigFeeds.length > 0 ? new Set(pigFeeds.map(f => f.date)).size : 0;
            const pigCpk   = pigKg > 0 ? Math.round(pigCost / pigKg) : 0;
            const stdFeed  = STAGE_FEED[p.stage] || 2.0;
            return (
              <div key={p.id} style={{ ...S.card, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>🐷 {p.tag}</div>
                    <div style={{ fontSize: 11, color: C.faint }}>{p.stage} · {p.weight}kg · {p.breed}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Standard: {stdFeed}kg/day</div>
                    {pigDays > 0 && <div style={{ fontSize: 11, color: C.muted }}>Recorded: {pigDays} days</div>}
                  </div>
                </div>
                {pigDays > 0
                  ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: 12 }}>
                      {[
                        ['Total Feed', Math.round(pigKg * 10) / 10 + 'kg'],
                        ['Total Cost', fmtRWF(pigCost)],
                        ['Avg/kg',     'RWF ' + fmtNum(pigCpk)],
                        ['Avg/day',    (pigDays > 0 ? Math.round(pigKg / pigDays * 10) / 10 : 0) + 'kg'],
                      ].map(([l, v]) => (
                        <div key={l} style={{ background: C.elevated, borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
                          <div style={{ fontWeight: 700, color: C.text, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )
                  : <div style={{ fontSize: 12, color: C.faint, textAlign: 'center', padding: '8px 0' }}>No individual feed logs for this pig. Feeds logged as "All pigs" are not counted per-pig.</div>
                }
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
