// ════════════════════════════════════════════════════════════════
// FarmIQ — AIPrediction Component
// Migrated from §10 of index_migration_to_vite_react.html
//
// Renders a "Generate Insight" card that calls Gemini AI via the
// askAI global helper (to be replaced with a proper hook once the
// full AI layer is migrated).
// ════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { C, S } from '../../styles/constants';
import { fmtRWF, toDay } from '../../utils/helpers';
import { getMarketPrice } from '../../utils/market';

// ── Temporary shims ────────────────────────────────────────────
// TODO: replace these with proper imports once the AI layer and
//       API key management are extracted into their own modules.

/** Read the stored Gemini API key */
const getApiKey = () => {
  try { return localStorage.getItem('farmiq_gemini_key') || ''; }
  catch { return ''; }
};

/**
 * Call the Gemini AI helper.
 * In the single-file app this is a global. After full migration,
 * extract to src/utils/ai.js and import directly.
 */
const askAI = async (prompt, opts) => {
  if (typeof window.askAI === 'function') return window.askAI(prompt, opts);
  return { source: 'no_key', text: '' };
};

// ── Sub-components ─────────────────────────────────────────────

function AIErrorMsg({ source, onSetKey }) {
  const msgs = {
    no_key:     { text: '🔑 No Gemini API key set. Add your key to use AI insights.', action: 'Set Key →', fn: onSetKey },
    auth_error: { text: '🔑 Invalid Gemini API key. Please check and update it.',      action: 'Update Key →', fn: onSetKey },
    timeout:    { text: '⏳ Request timed out. Check your connection and retry.',       action: null },
    network:    { text: '📶 Network error. Check your connection and retry.',           action: null },
    api_error:  { text: '⚠️ Gemini API error. Try again shortly.',                     action: null },
    empty:      { text: '⚠️ AI returned an empty response. Try again.',                action: null },
  };
  const m = msgs[source] || msgs.api_error;
  return (
    <div style={{
      padding:      '10px 14px',
      background:   'rgba(245,158,11,.07)',
      border:       '1px solid rgba(245,158,11,.3)',
      borderRadius: 9,
      fontSize:     12,
      color:        C.amber,
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      gap:          10,
    }}>
      <span>{m.text}</span>
      {m.action && m.fn && (
        <button onClick={m.fn} style={{
          background: 'none', border: 'none', color: C.accent,
          cursor: 'pointer', fontWeight: 700, fontSize: 12,
          padding: 0, fontFamily: 'inherit', textDecoration: 'underline',
        }}>{m.action}</button>
      )}
    </div>
  );
}

function AIStatusPill({ onSetKey }) {
  const hasKey = !!getApiKey();
  return (
    <div style={{
      fontSize:     10,
      padding:      '3px 9px',
      borderRadius: 20,
      background:   hasKey ? 'rgba(22,163,74,.1)' : 'rgba(239,68,68,.08)',
      color:        hasKey ? C.accent : C.red,
      fontWeight:   700,
      cursor:       hasKey ? 'default' : 'pointer',
      border:       `1px solid ${hasKey ? 'rgba(22,163,74,.25)' : 'rgba(239,68,68,.2)'}`,
    }} onClick={!hasKey ? onSetKey : undefined}>
      {hasKey ? '✦ Gemini Ready' : '🔑 Key Required'}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

/**
 * @prop {Array}   pigs
 * @prop {Array}   feeds
 * @prop {Array}   sales
 * @prop {Array}   logs
 * @prop {Array}   expenses
 * @prop {Array}   incomes
 * @prop {Array}   [reproductions]
 * @prop {Array}   [stock]
 * @prop {string}  topic     - Context string passed to Gemini
 * @prop {string}  label     - Card heading
 * @prop {string}  icon      - Emoji icon
 * @prop {boolean} [autoRun] - Fire prediction automatically on mount
 */
export default function AIPrediction({
  pigs, feeds, sales, logs, expenses, incomes,
  reproductions = [], stock = [],
  topic, label, icon, autoRun,
}) {
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [done,         setDone]         = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  async function predict() {
    if (loading || done) return;
    setLoading(true);
    setResult(null);

    const active   = pigs.filter((p) => p.status === 'active');
    const totalInc = sales.reduce((s, l) => s + (l.total  || 0), 0) +
                     incomes.reduce((s, l) => s + (l.amount || 0), 0);
    const totalExp = feeds.reduce((s, l) => s + (l.cost   || 0), 0) +
                     expenses.reduce((s, l) => s + (l.amount || 0), 0);
    const sick     = logs.reduce((s, l) => s + (l.sick   || 0), 0);
    const deaths   = logs.reduce((s, l) => s + (l.deaths || 0), 0);
    const stages   = active.reduce((a, p) => { a[p.stage] = (a[p.stage] || 0) + 1; return a; }, {});
    const pregnant = reproductions.filter((r) => r.status === 'pregnant').length;
    const herdVal  = active.reduce((s, p) => s + getMarketPrice(p.stage, p.weight), 0);
    const lowStock = stock.filter((s) => s.quantity <= s.minLevel).map((s) => s.name).join(', ') || 'none';

    const ctx =
      `Expert pig farm advisor Rwanda. active=${active.length} stages=${JSON.stringify(stages)} ` +
      `income=${Math.round(totalInc)} expenses=${Math.round(totalExp)} profit=${Math.round(totalInc - totalExp)} ` +
      `sick=${sick} deaths=${deaths} pregnant_sows=${pregnant} herd_market_value=${Math.round(herdVal)} ` +
      `low_stock=${lowStock} sales=${sales.length} logs=${logs.length}. ` +
      `Topic: ${topic}. Give 5-7 Rwanda-specific bullet points. Use RWF. Today is ${toDay()}.`;

    const res = await askAI(ctx, {});
    setResult(res);
    setLoading(false);

    const errorSources = ['no_key', 'auth_error', 'timeout', 'network', 'api_error', 'empty'];
    if (!errorSources.includes(res.source)) setDone(true);
  }

  useEffect(() => {
    if (autoRun && getApiKey()) predict();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = result && ['no_key','auth_error','timeout','network','api_error','empty'].includes(result.source);

  return (
    <div style={S.aiCard} className="ai-glow fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{label}</span>
        </div>
        <AIStatusPill onSetKey={() => setShowKeyModal(true)} />
      </div>

      {/* Actions */}
      {!done && !loading && !isError && (
        <button
          style={{ ...S.btn('#16a34a'), fontSize: 12, padding: '7px 16px', borderRadius: 20, letterSpacing: .3 }}
          onClick={predict}
        >
          ✦ Generate Insight
        </button>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.accent, fontSize: 13 }}>
          <span className="spin" style={S.loader} />
          Asking Gemini AI…
        </div>
      )}

      {isError && (
        <>
          <AIErrorMsg source={result.source} onSetKey={() => setShowKeyModal(true)} />
          <button
            style={{ ...S.btn('#166534'), fontSize: 11, padding: '5px 11px', marginTop: 8 }}
            onClick={() => { setResult(null); setDone(false); predict(); }}
          >
            Retry →
          </button>
        </>
      )}

      {done && result?.source === 'ai' && (
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {result.text}
        </div>
      )}

      {/* Key modal shim — TODO: replace with proper ApiKeyModal import */}
      {showKeyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setShowKeyModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 28,
            width: 340, boxShadow: '0 8px 40px rgba(0,0,0,.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>🔑 Gemini API Key</div>
            <input
              defaultValue={getApiKey()}
              placeholder="Paste your Gemini API key here…"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, marginBottom: 12 }}
              id="farmiq-gemini-key-input"
            />
            <button
              style={{ ...S.btn(), width: '100%', padding: 10 }}
              onClick={() => {
                const val = document.getElementById('farmiq-gemini-key-input')?.value?.trim();
                if (val) { try { localStorage.setItem('farmiq_gemini_key', val); } catch (_) {} }
                setShowKeyModal(false);
              }}
            >
              Save Key →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
