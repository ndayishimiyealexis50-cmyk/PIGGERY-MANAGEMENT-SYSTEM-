import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

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

export function fsSet(key, list) {
  return setOnlineFarmData({ [key]: list });
}
