import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';

const FARM_DOC = doc(db, 'farmiq', 'farm');
let _latestFarmData = {};

export async function getOnlineFarmData() {
  try {
    const snap = await getDoc(FARM_DOC);
    if (snap.exists()) {
      _latestFarmData = snap.data();
      localStorage.setItem('farmData', JSON.stringify(_latestFarmData));
      return _latestFarmData;
    }
  } catch (e) {
    console.warn('[FarmIQ] getOnlineFarmData failed:', e);
    const cached = localStorage.getItem('farmData');
    if (cached) return JSON.parse(cached);
  }
  return {};
}

export async function setOnlineFarmData(data) {
  _latestFarmData = { ..._latestFarmData, ...data };
  localStorage.setItem('farmData', JSON.stringify(_latestFarmData));
  try {
    await setDoc(FARM_DOC, _latestFarmData, { merge: true });
  } catch (e) {
    console.warn('[FarmIQ] setOnlineFarmData Firestore write failed:', e);
  }
}

export function subscribeToFarmData(callback) {
  return onSnapshot(FARM_DOC, (snap) => {
    if (snap.exists()) {
      _latestFarmData = snap.data();
      localStorage.setItem('farmData', JSON.stringify(_latestFarmData));
      callback(_latestFarmData);
    }
  });
}

export async function fsSet(key, list) {
  const idOf = (x) => (x && typeof x === 'object' && x.id !== undefined ? String(x.id) : null);
  const base = Array.isArray(_latestFarmData[key]) ? _latestFarmData[key] : [];
  if (!Array.isArray(list) || !list.every((x) => idOf(x) !== null)) {
    return setOnlineFarmData({ [key]: list });
  }
  const newIds = new Set(list.map(idOf));
  const deleted = new Set(base.map(idOf).filter((i) => i !== null && !newIds.has(i)));
  try {
    const merged = await runTransaction(db, async (tx) => {
      const snap = await tx.get(FARM_DOC);
      const server = snap.exists() && Array.isArray(snap.data()[key]) ? snap.data()[key] : [];
      const extra = server.filter((x) => { const i = idOf(x); return i !== null && !newIds.has(i) && !deleted.has(i); });
      const out = [...extra, ...list];
      tx.set(FARM_DOC, { [key]: out }, { merge: true });
      return out;
    });
    _latestFarmData = { ..._latestFarmData, [key]: merged };
    localStorage.setItem('farmData', JSON.stringify(_latestFarmData));
  } catch (e) {
    console.error('[FarmIQ] fsSet failed:', key, e);
    alert('Sync failed for ' + key + ': ' + (e.code || e.message));
  }
}
