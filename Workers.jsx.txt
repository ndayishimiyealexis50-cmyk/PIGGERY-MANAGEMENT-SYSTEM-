// pages/Workers.jsx
// Extracted from farmiq-gemini-2.html — function Workers() + WorkerTaskChart()
// Props: { users, setUsers, tasks }

import { useEffect } from 'react';
import { S, C } from '../utils/styles';
import { toDay } from '../utils/helpers';
import {
  _db,
  _auth,
  _profileCache,
  getAllUserProfiles,
  updateUserProfile,
} from '../firebase';

// ─── WorkerTaskChart (sub-component, lives in this file) ─────────────────────
function WorkerTaskChart({ users, tasks }) {
  const workers = users.filter(u => u.role === 'worker' && u.approved);
  if (workers.length === 0) return null;
  const today = toDay();

  const data = workers.map(w => {
    const myTasks       = tasks.filter(t => t.workerId === (w.uid || w.id));
    const pending       = myTasks.filter(t => t.status === 'pending');
    const done          = myTasks.filter(t => t.status === 'done');
    const overdue       = pending.filter(t => t.due && t.due < today);
    const autoFeedDone  = myTasks.filter(t => t.autoFeed && t.status === 'done'    && t.due === today).length;
    const autoFeedPend  = myTasks.filter(t => t.autoFeed && t.status === 'pending' && t.due === today).length;
    return { w, pending: pending.length, done: done.length, overdue: overdue.length, autoFeedDone, autoFeedPend, total: myTasks.length };
  });
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>📊 Worker Task Overview</div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 14 }}>Tasks assigned per worker · Today's feeding status</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {data.map(({ w, pending, done, overdue, total }) => {
          const pct       = total > 0 ? (done / total) * 100 : 0;
          const amFedToday = tasks.some(t => t.workerId === (w.uid || w.id) && t.autoFeed && t.slot === 'AM' && t.status === 'done' && t.due === today);
          const pmFedToday = tasks.some(t => t.workerId === (w.uid || w.id) && t.autoFeed && t.slot === 'PM' && t.status === 'done' && t.due === today);

          return (
            <div key={w.uid || w.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#16a34a,#10b981)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0,
                  }}>
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>
                      <span style={{ color: amFedToday ? C.accent : C.red }}>{amFedToday ? '✅' : '⏳'} 07:00</span>
                      <span style={{ margin: '0 5px', color: C.border }}>·</span>
                      <span style={{ color: pmFedToday ? C.accent : C.red }}>{pmFedToday ? '✅' : '⏳'} 18:00</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11 }}>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{done}</span>
                  <span style={{ color: C.faint }}> / {total} done</span>
                  {overdue > 0 && <span style={{ color: C.red, fontWeight: 700, marginLeft: 6 }}>⚠️ {overdue} overdue</span>}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: Math.min((total / maxTotal) * 100, 100) + '%',
                  background: C.elevated, borderRadius: 4,
                }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: pct + '%',
                  background: pct === 100
                    ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                    : pct > 50
                      ? 'linear-gradient(90deg,#f59e0b,#16a34a)'
                      : 'linear-gradient(90deg,#ef4444,#f59e0b)',
                  borderRadius: 4, transition: 'width .5s',
                }} />
              </div>

              {/* Pending task pills */}
              {pending > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {tasks.filter(t => t.workerId === (w.uid || w.id) && t.status === 'pending').slice(0, 4).map(t => (
                    <span key={t.id} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      background: t.autoFeed ? 'rgba(22,163,74,.1)' : 'rgba(99,102,241,.1)',
                      color: t.autoFeed ? C.accent : '#6366f1', fontWeight: 600,
                      border: '1px solid ' + (t.autoFeed ? 'rgba(22,163,74,.2)' : 'rgba(99,102,241,.2)'),
                    }}>
                      {t.autoFeed ? '🤖' : ''}{t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title}
                    </span>
                  ))}
                  {pending > 4 && <span style={{ fontSize: 9, color: C.faint, padding: '2px 5px' }}>+{pending - 4} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid ' + C.border }}>
        {[
          ['🤖 AI Auto Task', 'rgba(22,163,74,.2)', C.accent],
          ['📋 Manual Task',  'rgba(99,102,241,.2)', '#6366f1'],
          ['⚠️ Overdue',      'rgba(239,68,68,.2)',  C.red],
        ].map(([l, bg, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: '1px solid ' + c }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Workers (main page) ──────────────────────────────────────────────────────
export default function Workers({ users, setUsers, tasks = [] }) {
  const [saving,     setSaving]     = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastCheck,  setLastCheck]  = React.useState('');

  const pending = users.filter(u => u.role === 'worker' && !u.approved && !u.removed);
  const approved= users.filter(u => u.role === 'worker' &&  u.approved && !u.removed);
  const removed = users.filter(u => u.role === 'worker' &&  u.removed);

  // Auto-refresh every 4 seconds
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await getAllUserProfiles();
      if (fresh && fresh.length > 0) setUsers(fresh);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e) {}
    setRefreshing(false);
  }

  async function approve(uid) {
    setSaving(uid);
    try {
      await updateUserProfile(uid, { approved: true });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, approved: true } : u));
    } catch (e) { console.error('approve error', e); }
    setSaving(null);
  }

  async function reject(uid) {
    setSaving(uid);
    try {
      await _db.collection('users').doc(uid).delete();
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (e) { console.error('reject error', e); }
    setSaving(null);
  }

  async function removeWorker(uid) {
    const w = users.find(u => (u.uid || u.id) === uid);
    if (!window.confirm(`Remove ${w ? w.name : 'this worker'}? They will lose access but ALL their submitted data (feeds, logs, sales) stays intact and can be restored.`)) return;
    setSaving(uid);
    try {
      await _db.collection('users').doc(uid).update({
        approved: false, removed: true, removedAt: new Date().toISOString(),
      });
      _profileCache.delete(uid);
      setUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, approved: false, removed: true } : u));
    } catch (e) { console.error('remove error', e); }
    setSaving(null);
  }

  async function restoreWorker(uid) {
    setSaving(uid);
    try {
      await _db.collection('users').doc(uid).update({ approved: true, removed: false, removedAt: null });
      _profileCache.delete(uid);
      setUsers(prev => prev.map(u => (u.uid || u.id) === uid ? { ...u, approved: true, removed: false } : u));
    } catch (e) { console.error('restore error', e); }
    setSaving(null);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={S.h1}>Worker Management</div>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(22,163,74,.12)', color: C.accent, fontWeight: 700,
            fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={refreshing ? { display: 'inline-block', animation: 'spin .8s linear infinite' } : {}}>🔄</span>
          {refreshing ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <div style={{ ...S.sub, marginBottom: 14 }}>
        {approved.length} active · {pending.length} pending{lastCheck && ' · Last checked: ' + lastCheck}
      </div>

      {/* Pending approvals */}
      {pending.length > 0 ? (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>
            ⏳ Pending Approval ({pending.length})
          </div>
          {pending.map(w => (
            <div key={w.uid || w.id} style={{ ...S.row, background: 'rgba(245,158,11,.05)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{w.name}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{w.email || w.username}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={S.btn('#166534')}
                  disabled={saving === (w.uid || w.id)}
                  onClick={() => approve(w.uid || w.id)}
                >
                  {saving === (w.uid || w.id) ? '⏳' : '✓ Approve'}
                </button>
                <button
                  style={S.btn('#991b1b')}
                  disabled={saving === (w.uid || w.id)}
                  onClick={() => reject(w.uid || w.id)}
                >
                  {saving === (w.uid || w.id) ? '⏳' : '✗ Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', color: C.faint, fontSize: 13 }}>✅ No pending approvals.</div>
      )}

      {/* Active workers */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>
          ✅ Active Workers ({approved.length})
        </div>
        {approved.length === 0
          ? <div style={{ color: C.faint, fontSize: 13 }}>No workers yet.</div>
          : approved.map(w => (
              <div key={w.uid || w.id} style={S.row}>
                <div>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{w.email || w.username}</div>
                </div>
                <button
                  style={{ ...S.btn(C.red), padding: '5px 11px', fontSize: 11 }}
                  disabled={saving === (w.uid || w.id)}
                  onClick={() => removeWorker(w.uid || w.id)}
                >
                  {saving === (w.uid || w.id) ? '⏳' : 'Remove'}
                </button>
              </div>
            ))}
      </div>

      {/* Removed workers */}
      {removed.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 10 }}>
            🚫 Removed Workers ({removed.length})
          </div>
          {removed.map(w => (
            <div key={w.uid || w.id} style={{ ...S.row, opacity: 0.7 }}>
              <div>
                <div style={{ fontWeight: 600, color: C.muted }}>{w.name}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{w.email || w.username}</div>
              </div>
              <button
                style={{ ...S.btn('#1d4ed8'), padding: '5px 11px', fontSize: 11 }}
                disabled={saving === (w.uid || w.id)}
                onClick={() => restoreWorker(w.uid || w.id)}
                title="Restore worker — they will be re-approved and can log in immediately"
              >
                {saving === (w.uid || w.id) ? '⏳' : '↩ Restore & Re-approve'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Task chart — only when there are active workers */}
      {approved.length > 0 && <WorkerTaskChart users={users} tasks={tasks} />}
    </div>
  );
}
