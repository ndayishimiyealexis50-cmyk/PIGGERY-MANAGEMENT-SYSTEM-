import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

let _actor = null;
export function setActor(u) { _actor = u; }

export async function notifyChange(section, action, item) {
  try {
    if (!_actor) return;
    const isAdmin = _actor.role === 'admin';
    await addDoc(collection(db, 'notifications'), {
      from: _actor.uid || _actor.id || _actor.name || 'unknown',
      fromName: _actor.name || _actor.email || 'Unknown',
      fromRole: _actor.role || 'worker',
      to: isAdmin ? (item?.workerId || item?.assignedTo || 'all-workers') : 'admin',
      section,
      action,
      summary: item?.title || item?.name || item?.id || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) { /* never block saving */ }
}
