import { C, S } from '../utils/constants';
// ════════════════════════════════════════════════════════════════
// MODULE 22 — AIAdvisor
// Medium priority — AI insights
// ════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { fmtRWF } from '../utils/formatters';
import { toDay, getMarketPrice } from '../utils/helpers';

export default function AIAdvisor({ pigs, feeds, sales, logs, expenses, incomes, reproductions, stock }) {
  const [q,       setQ]       = useState('');
  const [chat,    setChat]    = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const totalInc = sales.reduce((s, l) => s + (l.total  || 0), 0) + incomes.reduce((s, l)  => s + (l.amount || 0), 0);
  const totalExp = feeds.reduce((s, l) => s + (l.cost   || 0), 0) + expenses.reduce((s, l) => s + (l.amount || 0), 0);

  async function send() {
    if (!q.trim() || loading) return;
    const question = q.trim();
    setQ('');
    setChat(c => [...c, { role: 'user', text: question }]);
    setLoading(true);

    const herdVal  = pigs.filter(p => p.status === 'active').reduce((s, pig) => s + getMarketPrice(pig.stage, pig.weight), 0);
    const pregnant = (reproductions || []).filter(r => r.status === 'pregnant').length;
    const ctx      = `You are FarmIQ AI, a Rwanda pig farm advisor. Farm snapshot: ${pigs.filter(p => p.status === 'active').length} active pigs, income=${fmtRWF(totalInc)}, expenses=${fmtRWF(totalExp)}, profit=${fmtRWF(totalInc - totalExp)}, herd_value=${fmtRWF(herdVal)}, pregnant_sows=${pregnant}, today=${toDay()}. Worker question: "${question}". Give practical, specific advice for Rwanda pig farming. Use RWF for money.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: ctx }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || 'No response received.';
      setChat(c => [...c, { role: 'ai', text }]);
    } catch (err) {
      setChat(c => [...c, { role: 'ai', text: '⚠️ Could not reach AI. Check your connection or API key.' }]);
    }

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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,rgba(22,163,74,.12),rgba(22,163,74,.06))', border: '1px solid rgba(22,163,74,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          🤖
        </div>
        <div>
          <div style={S.h1}>AI Farm Advisor</div>
          <div style={S.sub}>Live AI Advisor — ask anything about your farm</div>
        </div>
      </div>

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
          {chat.map((m, i) => (
            <div key={i} className="fade-in" style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {m.role === 'ai' && (
                <div style={{ width: 27, height: 27, borderRadius: '50%', background: 'rgba(22,163,74,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 9, flexShrink: 0 }}>🤖</div>
              )}
              <div style={{ maxWidth: '76%' }}>
                {m.role === 'ai' && (
                  <div style={{ fontSize: 10, color: C.accent, marginBottom: 3, fontWeight: 600 }}>✦ AI Advisor · Live</div>
                )}
                <div style={{ padding: '11px 14px', borderRadius: 12, background: m.role === 'user' ? 'linear-gradient(135deg,#dbeafe,#bfdbfe)' : 'linear-gradient(135deg,#f7faf7,#f0fdf4)', border: '1px solid ' + (m.role === 'user' ? 'rgba(147,197,253,.6)' : 'rgba(22,163,74,.12)'), fontSize: 13, color: C.text, lineHeight: 1.75, whiteSpace: 'pre-wrap', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                  {m.text}
                </div>
              </div>
              {m.role === 'user' && (
                <div style={{ width: 27, height: 27, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, marginLeft: 9, flexShrink: 0, color: '#fff', fontWeight: 700 }}>U</div>
              )}
            </div>
          ))}

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
            placeholder="Ask about profit, breeding, market prices, health…"
            style={{ ...{ background: '#fff', border: '1px solid #cbd5e1', color: C.text, borderRadius: 8, padding: '9px 12px', width: '100%', fontSize: 13, fontFamily: 'inherit', outline: 'none', transition: 'border-color .2s' }, flex: 1 }}
          />
          <button style={{ ...S.btn(), flexShrink: 0, padding: '9px 18px' }} onClick={send} disabled={loading}>
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
