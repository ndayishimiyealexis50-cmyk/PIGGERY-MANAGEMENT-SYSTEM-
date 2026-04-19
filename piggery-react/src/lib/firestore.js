// src/lib/firestore.js
// ─── Firestore storage layer — offline-first ─────────────────────────────────
// Two documents inside the "farmiq" collection:
//   • farmiq/farm   — all farm data (pigs, feeds, sales, logs, …)
//   • farmiq/users  — user list
//
// Strategy: write to localStorage immediately (instant UI), then sync to
// Firestore. Reads always prefer the server, falling back to localStorage
// when offline.  Public API is identical to the HTML version so all
// existing component code can be copy-pasted without changes.

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// ── Firestore document refs ───────────────────────────────────────────────────
// Exported so App can perform one-shot operations (e.g. capital wipe).
export const FS_FARM_DOC  = doc(db, 'farmiq', 'farm');
export const FS_USERS_DOC = doc(db, 'farmiq', 'users');

// ── localStorage cache keys ───────────────────────────────────────────────────
const LS_FARM  = 'farmiq_local_farm';
const LS_USERS = 'farmiq_local_users';

// ── Local cache helpers ───────────────────────────────────────────────────────
function lsGetFarm()  {
  try { const v = localStorage.getItem(LS_FARM);  return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function lsSetFarm(d) {
  try { localStorage.setItem(LS_FARM, JSON.stringify(d)); }
  catch (e) { console.warn('localStorage full', e); }
}
function lsGetUsers() {
  try { const v = localStorage.getItem(LS_USERS); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function lsSetUsers(d) {
  try { localStorage.setItem(LS_USERS, JSON.stringify(d)); }
  catch (e) { /* swallow — not critical */ }
}

// ── Sync status — keeps useSyncStatus hook working ───────────────────────────
export const _offlineStatus = {
  online:   navigator.onLine,
  queueLen: 0,
  syncing:  false,
  lastSync: '',
};
export const _syncListeners = new Set();
function _notifySyncListeners() {
  _syncListeners.forEach(fn => {
    try { fn({ ..._offlineStatus }); } catch (e) { /* swallow */ }
  });
}
window.addEventListener('online',  () => { _offlineStatus.online = true;  _notifySyncListeners(); });
window.addEventListener('offline', () => { _offlineStatus.online = false; _notifySyncListeners(); });

// ── In-memory cache (for instant reads between saves) ────────────────────────
let _latestFarmData    = lsGetFarm() || null;
let _pendingWriteCount = 0;
let _saveQueue         = Promise.resolve();

/** Synchronous read of the in-memory farm cache. */
export function getLatestFarmData() { return _latestFarmData; }

/** Directly overwrite the in-memory cache (used after capital wipe in App). */
export function setLatestFarmData(data) { _latestFarmData = data; }

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch the user list from Firestore. Falls back to localStorage on error. */
export async function getOnlineUsers() {
  try {
    const snap = await getDoc(FS_USERS_DOC);
    if (snap.exists()) {
      const data = snap.data();
      lsSetUsers(data);
      return data.list || null;
    }
    return null;
  } catch (e) {
    console.warn('Firestore getUsers failed, using cache', e);
    return lsGetUsers()?.list ?? null;
  }
}

/** Persist the user list to localStorage and Firestore. */
export async function setOnlineUsers(users) {
  const payload = { list: users, updatedAt: new Date().toISOString() };
  lsSetUsers(payload);
  try {
    await setDoc(FS_USERS_DOC, payload);
    _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali',
    });
    _notifySyncListeners();
  } catch (e) {
    console.warn('Firestore setUsers failed', e);
  }
}

/**
 * Fetch all farm data from Firestore.
 * When there are pending writes, returns the in-memory state (most recent truth)
 * rather than potentially stale server data.
 */
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
      // Pending writes exist → return in-memory state
      return _latestFarmData || data;
    }
    return lsGetFarm() || null;
  } catch (e) {
    console.warn('Firestore getFarm failed, using cache', e);
    const cached = lsGetFarm();
    if (cached) { _latestFarmData = cached; return cached; }
    return null;
  }
}

/**
 * Merge data into the farm document, writing immediately to localStorage and
 * queueing a Firestore write.  Returns the save promise so callers can await it.
 */
export function setOnlineFarmData(data) {
  _latestFarmData = {
    ...(_latestFarmData || {}),
    ...data,
    updatedAt: new Date().toISOString(),
  };
  lsSetFarm(_latestFarmData);
  _pendingWriteCount++;

  _saveQueue = _saveQueue.then(async () => {
    try {
      await setDoc(FS_FARM_DOC, _latestFarmData, { merge: true });
      _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali',
      });
      _notifySyncListeners();
    } catch (e) {
      console.warn('Firestore setFarm failed — data kept in localStorage', e);
    } finally {
      _pendingWriteCount = Math.max(0, _pendingWriteCount - 1);
    }
  });

  return _saveQueue;
}

/** Shorthand: persist a single keyed list to the farm document. */
export function fsSet(key, list) {
  return setOnlineFarmData({ [key]: list });
}

/**
 * Fetch-then-merge append — safe for concurrent writes from multiple workers.
 * Reads the latest server state, merges newItem (de-duped by id), then writes.
 */
export async function jbinAppend(key, newItem) {
  try {
    const snap       = await getDoc(FS_FARM_DOC);
    const serverData = snap.exists() ? snap.data() : {};
    const base       = _pendingWriteCount > 0
      ? { ...serverData, ...(_latestFarmData || {}) }
      : serverData;
    const existing = Array.isArray(base[key]) ? base[key] : [];
    const merged   = [...existing.filter(x => x.id !== newItem.id), newItem];

    _latestFarmData = {
      ...base,
      [key]:     merged,
      updatedAt: new Date().toISOString(),
    };
    lsSetFarm(_latestFarmData);
    await setDoc(FS_FARM_DOC, _latestFarmData, { merge: true });
    _offlineStatus.lastSync = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali',
    });
    _notifySyncListeners();
  } catch (e) {
    console.warn('jbinAppend server fetch failed, using local cache', e);
    const data     = _latestFarmData || {};
    const existing = Array.isArray(data[key]) ? data[key] : [];
    const merged   = [...existing.filter(x => x.id !== newItem.id), newItem];
    _latestFarmData = {
      ...data,
      [key]:     merged,
      updatedAt: new Date().toISOString(),
    };
    lsSetFarm(_latestFarmData);
    try { await setDoc(FS_FARM_DOC, _latestFarmData, { merge: true }); } catch (e2) { /* offline */ }
  }
}

// ── Real-time subscription ─────────────────────────────
export function subscribeToFarmData(callback) {
  return onSnapshot(FS_FARM_DOC, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      _latestFarmData = data;
      try { localStorage.setItem('farmiq_farm', JSON.stringify(data)); } catch(e) {}
      callback(data);
    }
  });
}
