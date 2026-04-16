// ════════════════════════════════════════════════════════════════
// MODULE 22 — AIAdvisor
// Medium priority — AI insights
// ════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { C, S } from '../styles/theme';
import { fmtRWF } from '../utils/formatters';
import { toDay, getMarketPrice } from '../utils/helpers';
import { askAI, getApiKey } from '../utils/ai';
import ApiKeyModal   from '../components/ApiKeyModal';
import AIStatusPill  from '../components/AIStatusPill';
import AIErrorMsg    from '../components/AIErrorMsg';

export default function AIAdvisor({ pigs, feeds, sales, logs, expenses, incomes, reproductions, stock }) {
  const [q,            setQ]            = useState('');
  const [chat,         setChat]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const ref = useRef(null);

  const totalInc = sales.reduce((s, l) => s + (l.total || 0), 0)  + incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalExp = feeds.reduce((s, l) => s + (l.cost  || 0), 0)  + expenses.reduce((s, l) => s + (l.amount || 0), 0);

  async function send() {
    if (!q.trim() || loading) return;
    const question = q.trim();
    setQ('');
    setChat(c => [...c, { role: 'user', text: question }]);
    setLoading(true);

    const herdVal  = pigs.filter(p => p.status === 'active').reduce((s, pig) => s + getMarketPrice(pig.stage, pig.weight), 0);
    const pregnant = (reproductions || []).filter(r => r.status === 'pregnant').length;
    const ctx      = `FarmIQ AI Rwanda pig farm advisor. Farm snapshot: ${pigs.filter(p => p.status === 'active').length} active pigs, income=${fmtRWF(totalInc)}, expenses=${fmtRWF(totalExp)}, profit=${fmtRWF(totalInc - totalExp)}, herd_value=${fmtRWF(herdVal)}, pregnant_sows=${pregnant}, today=${toDay()}. Worker question: "${question}". Give practical, specific advice for Rwanda pig farming. Use RWF for money.`;

    const res = await askAI(ctx, {});
    setChat(c => [...c, { role: 'ai', ...res }]);
    setLoading(false);
  }

  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, loading]);

  const quickQ = [
    'Predict my profit next 30 days',
    'Which pigs should I sell first?',
    'When should I breed my sows?',
    'Best time to sell in Rwanda?',
    'How to reduce feed costs?',
    'What disease risks this season?',
  ];
  const hasKey = !!getApiKey();

  return (
    <div>
      {showKeyModal && <ApiKeyModal onClose={() => setShowKeyModal(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,rgba(22,163,74,.12),rgba(22,163,74,.06))', border: '1px solid rgba(22,163,74,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            🤖
          </div>
          <div>
            <div style={S.h1}>AI Farm Advisor</div>
            <div style={S.sub}>Live AI Advisor (Gemini) — ask anything about your farm</div>
          </div>
        </div>
        <AIStatusPill onSetKey={() => setShowKeyModal(true)} />
      </div>

      {/* API key banner */}
      {!hasKey && (
        <div style={{ padding: '13px 16px', background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, marginBottom: 14, fontSize: 13, color: C.amber }}>
          🔑 Add your Gemini API key to enable AI.{' '}
          <button
            onClick={() => setShowKeyModal(true)}
            style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            Set Gemini Key →
          </button>
        </div>
      )}

      {/* Chat card */}
      <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
        <div style={{ minHeight: 280, maxHeight: 420, overflowY: 'auto', marginBottom: 14 }}>

          {/* Empty state */}
          {chat.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,rgba(22,163,74,.1),rgba(22,163,74,.05))', border: '1px solid rgba(22,163,74,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>
                🧠
              </div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>Ask your AI farm advisor anything</div>
              <div style={{ color: C.faint, fontSize: 12, marginBottom: 16 }}>Get insights on profit, breeding, market prices and more.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                {quickQ.map(qq => (
                  <button
                    key={qq}
                    onClick={() => setQ(qq)}
                    style={{ padding: '6px 13px', borderRadius: 20, border: '1px solid rgba(22,163,74,.25)', background: 'rgba(22,163,74,.05)', color: C.accent, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >
                    {qq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {chat.map((m, i) => {
            const isErr = m.role === 'ai' && m.source && m.source !== 'ai';
            return (
              <div key={i} className="fade-in" style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
                {m.role === 'ai' && (
                  <div style={{ width: 27, height: 27, borderRadius: '50%', background: 'rgba(22,163,74,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 9, flexShrink: 0 }}>🤖</div>
                )}
                <div style={{ maxWidth: '76%' }}>
                  {m.role === 'ai' && (
                    <div style={{ fontSize: 10, color: isErr ? C.amber : C.accent, marginBottom: 3, fontWeight: 600 }}>
                      {isErr ? '⚠️ Error' : '✦ Gemini AI · Live'}
                    </div>
                  )}
                  {isErr
                    ? <AIErrorMsg source={m.source} text={m.text} onSetKey={() => setShowKeyModal(true)} />
                    : (
                      <div style={{ padding: '11px 14px', borderRadius: 12, background: m.role === 'user' ? 'linear-gradient(135deg,#dbeafe,#bfdbfe)' : 'linear-gradient(135deg,#f7faf7,#f0fdf4)', border: '1px solid ' + (m.role === 'user' ? 'rgba(147,197,253,.6)' : 'rgba(22,163,74,.12)'), fontSize: 13, color: C.text, lineHeight: 1.75, whiteSpace: 'pre-wrap', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                        {m.text}
                      </div>
                    )
                  }
                </div>
                {m.role === 'user' && (
                  <div style={{ width: 27, height: 27, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginLeft: 9, flexShrink: 0, color: '#fff', fontWeight: 700 }}>U</div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: C.accent, fontSize: 13, paddingLeft: 36 }}>
              <span className="spin" style={S.loader} />AI is thinking…
            </div>
          )}
          <div ref={ref} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 9 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={hasKey ? 'Ask about profit, breeding, market prices, health…' : 'Set your API key first to chat with AI…'}
            style={{ ...{ background: '#fff', border: '1px solid #cbd5e1', color: C.text, borderRadius: 8, padding: '9px 12px', width: '100%', fontSize: 13, fontFamily: 'inherit', outline: 'none', transition: 'border-color .2s' }, flex: 1 }}
            disabled={!hasKey}
          />
          <button style={{ ...S.btn(), flexShrink: 0, padding: '9px 18px' }} onClick={send} disabled={loading || !hasKey}>
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
