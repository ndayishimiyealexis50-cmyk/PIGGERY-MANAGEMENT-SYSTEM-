// src/lib/whatsapp.js
// Replaces: §3 WHATSAPP INTEGRATION (CallMeBot API) in index.html

function getWAConfig() {
  try {
    return JSON.parse(localStorage.getItem('farmiq_wa_config') || '{}');
  } catch {
    return {};
  }
}

export function setWAConfig(cfg) {
  localStorage.setItem('farmiq_wa_config', JSON.stringify(cfg));
}

export function isWAEnabled() {
  const c = getWAConfig();
  return !!(c.enabled && c.phone && c.apikey);
}

export function getWorkerWAContacts() {
  try { return JSON.parse(localStorage.getItem('farmiq_wa_workers') || '[]'); }
  catch { return []; }
}

export function setWorkerWAContacts(list) {
  localStorage.setItem('farmiq_wa_workers', JSON.stringify(list));
}

/** Send a WhatsApp message to the admin phone via CallMeBot (fire-and-forget). */
export async function sendWhatsApp(message) {
  const { phone, apikey, enabled } = getWAConfig();
  if (!enabled || !phone || !apikey) return { ok: false, reason: 'not_configured' };
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors' });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/** Send a WhatsApp message to a specific worker number. */
export async function sendWhatsAppToNumber(phone, apikey, message) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  try { await fetch(url, { method: 'GET', mode: 'no-cors' }); return true; }
  catch { return false; }
}

export function getWAAlertPrefs() {
  const c = getWAConfig();
  return {
    onSickPig:        c.onSickPig        !== false,
    onDeath:          c.onDeath          !== false,
    onSale:           c.onSale           !== false,
    onLowStock:       c.onLowStock       !== false,
    onFarrowingSoon:  c.onFarrowingSoon  !== false,
    onLoss:           c.onLoss           !== false,
  };
}
