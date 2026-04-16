// ════════════════════════════════════════════════════════════════
// FarmIQ — Firebase / Firestore Storage API
// Migrated from §6 of index_migration_to_vite_react.html
//
// These wrappers write partial updates to the single farm document
// in Firestore (farmiq/farm) and keep the in-memory cache
// (_latestFarmData) in sync.
//
// TODO (migration):
//   • Import `db` from your firebase.js initialisation file
//     instead of relying on the global `window.FS_FARM_DOC`.
//   • Replace window._latestFarmData with a Zustand store or
//     React Context so modules don't need globals.
// ════════════════════════════════════════════════════════════════

/**
 * Merge `data` into the global _latestFarmData cache, persist to
 * localStorage for offline resilience, then write to Firestore.
 *
 * @param {Object} data - Partial farm document to merge/overwrite.
 * @returns {Promise<void>}
 */
export async function setOnlineFarmData(data) {
  // 1. Update in-memory cache immediately so the UI stays responsive
  if (window._latestFarmData) {
    window._latestFarmData = { ...window._latestFarmData, ...data };
  }

  // 2. Persist to localStorage (offline / PWA resilience)
  try {
    const prev = JSON.parse(localStorage.getItem('farmiq_farm') || '{}');
    localStorage.setItem('farmiq_farm', JSON.stringify({ ...prev, ...data }));
  } catch (_) { /* storage full / private browsing */ }

  // 3. Write to Firestore
  // window.FS_FARM_DOC is the Firestore DocumentReference set up in the
  // original single-file app. After full migration, replace this with:
  //
  //   import { doc, setDoc } from 'firebase/firestore';
  //   import { db } from '../firebase/firebase';
  //   await setDoc(doc(db, 'farmiq', 'farm'), data, { merge: true });
  //
  try {
    if (window.FS_FARM_DOC) {
      await window.FS_FARM_DOC.update(data);
    }
  } catch (e) {
    console.warn('[FarmIQ] setOnlineFarmData Firestore write failed:', e);
  }
}

/**
 * Convenience wrapper — overwrite a single top-level array/object key.
 *
 * @example
 *   fsSet('pigs', updatedPigsArray);
 *   fsSet('expenses', updatedExpenses);
 */
export function fsSet(key, list) {
  return setOnlineFarmData({ [key]: list });
}
