import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../lib/firebase';

export default function NotificationBell({ user }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const uid = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!user || !uid) return;
    const targets = user.role === 'admin' ? ['admin'] : [uid, 'all-workers'];
    const q = query(collection(db, 'notifications'), where('to', 'in', targets));
    return onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(list.slice(0, 30));
    }, (e) => console.error('notif listen failed', e));
  }, [user, uid]);

  const unread = items.filter((i) => !i.read).length;
  const markRead = (id) => updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});

  const panel = open && createPortal(
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.4)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 70, left: 12, right: 12, maxWidth: 360, maxHeight: '70vh', overflowY: 'auto', background: '#fff', color: '#111', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.35)' }}>
        <div style={{ padding: 12, fontWeight: 700, borderBottom: '1px solid #eee' }}>Notifications</div>
        {items.length === 0 && <div style={{ padding: 12 }}>No notifications yet</div>}
        {items.map((i) => (
          <div key={i.id} onClick={() => markRead(i.id)} style={{ padding: 12, borderBottom: '1px solid #eee', opacity: i.read ? 0.5 : 1 }}>
            <b>{i.fromName}</b> {i.action} in {i.section}{i.summary ? ': ' + i.summary : ''}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );

  return (
    <div>
      <button onClick={() => setOpen(true)} style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
        🔔{unread > 0 && <span style={{ background: 'red', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 12, marginLeft: 4 }}>{unread}</span>}
      </button>
      {panel}
    </div>
  );
}
