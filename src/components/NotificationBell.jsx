import { useEffect, useState } from 'react';
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
    }, () => {});
  }, [user, uid]);

  const unread = items.filter((i) => !i.read).length;
  const markRead = (id) => updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
        🔔{unread > 0 && <span style={{ background: 'red', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 12, marginLeft: 2 }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 36, width: 290, maxHeight: 380, overflowY: 'auto', background: '#fff', color: '#111', border: '1px solid #ccc', borderRadius: 8, zIndex: 9999, boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          {items.length === 0 && <div style={{ padding: 12 }}>No notifications</div>}
          {items.map((i) => (
            <div key={i.id} onClick={() => markRead(i.id)} style={{ padding: 10, borderBottom: '1px solid #eee', opacity: i.read ? 0.5 : 1, cursor: 'pointer' }}>
              <b>{i.fromName}</b> {i.action} in {i.section}{i.summary ? ': ' + i.summary : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
