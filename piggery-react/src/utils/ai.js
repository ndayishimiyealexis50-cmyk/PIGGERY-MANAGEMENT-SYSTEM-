// src/lib/ai.js
// Replaces: §7 API KEY HELPERS (Gemini) in index.html

export function getApiKey() {
  return localStorage.getItem('fiq_apikey') || '';
}

export function setApiKey(k) {
  localStorage.setItem('fiq_apikey', k);
}

/**
 * Send a prompt to Google Gemini 2.0 Flash Lite.
 * Returns { text, source } where source is one of:
 *   'ai' | 'no_key' | 'auth_error' | 'timeout' | 'network' | 'api_error' | 'empty'
 */
export async function askAI(prompt) {
  const key = getApiKey();
  if (!key) return { text: '__NO_KEY__', source: 'no_key' };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1200 },
        }),
      }
    );
    clearTimeout(t);

    if (r.status === 400 || r.status === 403)
      return { text: '__AUTH_ERROR__', source: 'auth_error' };

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return { text: `__API_ERROR__:${err?.error?.message || r.status}`, source: 'api_error' };
    }

    const d = await r.json();
    const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt) return { text: txt, source: 'ai' };
    return { text: '__EMPTY__', source: 'empty' };

  } catch (e) {
    if (e.name === 'AbortError') return { text: '__TIMEOUT__', source: 'timeout' };
    return { text: `__NETWORK__:${e.message}`, source: 'network' };
  }
}
