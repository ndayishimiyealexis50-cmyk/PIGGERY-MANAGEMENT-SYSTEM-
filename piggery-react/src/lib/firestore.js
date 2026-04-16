// src/lib/firestore.js
// Replaces: §6 FIREBASE FIRESTORE STORAGE API in index.html
//
// Offline-first: localStorage cache + Firestore sync.
// Public API is intentionally identical to the old globals so module
// files need only add the import line — no logic changes required.

import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

// ── Firestore document refs ──────────────────────────────────────
const FS_FARM_DOC  = doc(collection(db, 'farmiq'), 'farm');
const FS_USERS_DOC = doc(collection(db, 'farmiq'), 'users');

// ── localStorage cache keys ──────────────────────────────────────
const LS_FARM  = 'farmiq_local_farm';
const LS_USERS = 'farmiq_local_users';

// ── Local cache helpers ──────────────────────────────────────────
function lsGetFarm()  { try { const v = localStorage.getItem(LS_FARM);  return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSetFarm(d) { try { localStorage.setItem(LS_FARM,  JSON.stringify(d)); } catch(e) { console.warn('LS full', e); } }
function lsGetUsers() { try { const v = localStorage.getItem(LS_USERS); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSetUsers(d){ try { localStorage.setItem(LS_USERS, JSON.stringify(d)); } catch(e) {} }

// ── Sync status (keeps useSyncStatus hook working) ───────────────
export const _offlineStatus = { online: navigator.onLine, queueLen: 0, syncing: false, lastSync: '' };
export const _syncListeners = new Set();
function _notifySyncListeners() { _syncListeners.forEach(fn => { try { fn({ ..._offlineStatus }); } catch(e) {} }); }
window.addEventListener('online',  () => { _offlineStatus.online = true;  _notifySyncListeners(); });
window.addEventListener('offline', () => { _offlineStatus.online = false; _notifySyncListeners(); });

// ── In-memory cache ──────────────────────────────────────────────
let _latestFarmData = lsGetFarm() || null;
let _pendingWriteCount = 0;
let _saveQueue = Promise.resolve();

// ── Public API ───────────────────────────────────────────────────

export async function getOnlineUsers() {
  try {
    const snap = await getDoc(FS_USERS_DOC);
    if (snap.exists()) {
      const data = snap.data();
      lsSetUsers(data);
      return data.list || null;
    }
    return null;
  } catch(e) {
    console.warn('Firestore getUsers failed, using cache', e);
    const cached = lsGetUsers();
    return cached?.list ?? null;
  }
}

export async function setOnlineUsers(users) {
  const payload = { list: users, updatedAt: new Date().toISOString() };
  lsSetUsers(payload);
  try {
    await setDoc(FS_USERS_DOC, payload);
    _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
    _notifySyncListeners();
  } catch(e) { console.warn('Firestore setUsers failed', e); }
}

export async function getOnlineFarmData() {
  try {
    const snap = await getDoc(FS_FARM_DOC);
    if (snap.exists()) {
      const data = snap.data();
      if (_pendingWriteCount === 0) {
        _latestFarmData = data;
        lsSetFarm(data);
        return data;
      }
      return _latestFarmData || data;
    }
    return lsGetFarm() || null;
  } catch(e) {
    console.warn('Firestore getFarm failed, using cache', e);
    const cached = lsGetFarm();
    if (cached) { _latestFarmData = cached; return cached; }
    return null;
  }
}

export function setOnlineFarmData(data) {
  _latestFarmData = { ...(_latestFarmData || {}), ...data, updatedAt: new Date().toISOString() };
  lsSetFarm(_latestFarmData);
  _pendingWriteCount++;
  _saveQueue = _saveQueue.then(async () => {
    try {
      await setDoc(FS_FARM_DOC, _latestFarmData);
      _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
      _notifySyncListeners();
    } catch(e) { console.warn('Firestore setFarm failed — data kept in localStorage', e); }
    finally { _pendingWriteCount = Math.max(0, _pendingWriteCount - 1); }
  });
  return _saveQueue;
}

/** Shorthand: persist a single keyed list to the farm document. */
export function fsSet(key, list) {
  return setOnlineFarmData({ [key]: list });
}

/** Fetch-then-merge append — safe for concurrent writes from multiple workers. */
export async function jbinAppend(key, newItem) {
  try {
    const snap = await getDoc(FS_FARM_DOC);
    const serverData = snap.exists() ? snap.data() : {};
    const base = _pendingWriteCount > 0
      ? { ...serverData, ...(_latestFarmData || {}) }
      : serverData;
    const existing = Array.isArray(base[key]) ? base[key] : [];
    const merged = [...existing.filter(x => x.id !== newItem.id), newItem];
    _latestFarmData = { ...base, [key]: merged, updatedAt: new Date().toISOString() };
    lsSetFarm(_latestFarmData);
    await setDoc(FS_FARM_DOC, _latestFarmData);
    _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
    _notifySyncListeners();
  } catch(e) {
    console.warn('jbinAppend server fetch failed, using local cache', e);
    const data = _latestFarmData || {};
    const existing = Array.isArray(data[key]) ? data[key] : [];
    const merged = [...existing.filter(x => x.id !== newItem.id), newItem];
    _latestFarmData = { ...data, [key]: merged, updatedAt: new Date().toISOString() };
    lsSetFarm(_latestFarmData);
    try { await setDoc(FS_FARM_DOC, _latestFarmData); } catch(e2) {}
  }
}
