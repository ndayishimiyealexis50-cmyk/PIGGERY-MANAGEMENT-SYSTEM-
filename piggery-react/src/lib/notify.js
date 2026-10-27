import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

let _actor = null;
export function setActor(u) { _actor = u; }

export async function notifyChange(section, action, item) {
  try {
    if (!_actor) return;
    const isAdmin = _actor.role === 'admin';
    await addDoc(collection(db, 'notifications'), {
      from: getAuth().currentUser?.uid || 'unknown',
      fromName: _actor.name || _actor.email || 'Unknown',
      fromRole: _actor.role || 'worker',
      to: isAdmin ? (item?.workerId || item?.assignedTo || 'all-workers') : 'admin',
      section,
      action,
      summary: item?.title || item?.name || item?.id || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.error('notify failed', e); }
}

const SKIP = ['updatedAt', 'auditLogs', 'sessions', 'messages', 'notifications'];
const _seen = new Map();

export function diffNotify(oldData, newData) {
  if (!_actor || !oldData || !newData) return;
  let sent = 0;
  for (const key of Object.keys(newData)) {
    if (SKIP.includes(key)) continue;
    const a = oldData[key];
    const b = newData[key];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const old = new Map(a.map((x) => [x?.id, JSON.stringify(x)]));
    const fresh = new Set(b.map((x) => x?.id));
    for (const item of b) {
      if (!item || item.id == null) continue;
      const s = JSON.stringify(item);
      const prev = old.get(item.id);
      if (prev === s) continue;
      const sig = key + '|' + item.id + '|' + s;
      if (_seen.has(sig) && Date.now() - _seen.get(sig) < 8000) continue;
      _seen.set(sig, Date.now());
      if (sent++ < 5) notifyChange(key, prev === undefined ? 'added' : 'updated', item);
    }
    for (const x of a) {
      if (x && x.id != null && !fresh.has(x.id) && sent++ < 5) notifyChange(key, 'deleted', x);
    }
  }
}
