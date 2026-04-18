import { C, S } from "../styles";
import { setOnlineFarmData } from '../utils/storage';
// ════════════════════════════════════════════════════════════════
// FarmIQ — Admin Audit Log (Module #27)
// Migrated from near §21 of index_migration_to_vite_react.html
//
// Immutable log of all farm actions: who did what and when.
// Admin-only view.
//
// Props
//   auditLogs    {Array}   - array of {ts, action, actor, detail}
//   setAuditLogs {Function}
//
// Migration note on the window._addAuditLog bridge
// ──────────────────────────────────────────────────
// The single-file app uses a global  window._addAuditLog(action, detail)
// that is called by every other module when mutations happen.
// After full Vite migration, replace this with a React Context:
//
//   // src/context/AuditContext.jsx
//   export const AuditContext = createContext();
//   export function useAudit() { return useContext(AuditContext); }
//
// Then wrap the app in <AuditContext.Provider> and import useAudit()
// wherever a log entry is needed.
// ════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { C, S } from '../utils/constants';

// ── Config ────────────────────────────────────────────────────
const ACTIONS = ['all', 'login', 'logout', 'add', 'edit', 'delete', 'approve', 'reject', 'reset'];

const ACTION_COLOR = {
  login: '#22c55e', logout: '#f87171', add: '#34d399', edit: '#60a5fa',
  delete: '#f87171', approve: '#a3e635', reject: '#fb923c', reset: '#e879f9', other: '#94a3b8',
};

const ACTION_ICON = {
  login: '🔑', logout: '🚪', add: '➕', edit: '✏️',
  delete: '🗑️', approve: '✅', reject: '❌', reset: '🔄', other: '📋',
};

// ── Component ─────────────────────────────────────────────────
export default function AuditLog({ auditLogs, setAuditLogs }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // ── Mutations ───────────────────────────────────────────────

  function deleteEntry(idx) {
    if (!window.confirm('Delete this audit entry?')) return;
    const sorted = [...(auditLogs || [])].sort((a, b) => b.ts.localeCompare(a.ts));
    const entry  = sorted[idx];
    const updated = (auditLogs || []).filter((l) => l !== entry);
    setAuditLogs(updated);
    setOnlineFarmData({ auditLogs: updated });
  }

  function clearOld(days) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const count  = (auditLogs || []).filter((l) => (l.ts || '').slice(0, 10) < cutoff).length;
    if (count === 0) { alert(`No entries older than ${days} days found.`); return; }
    if (!window.confirm(`Delete ${count} audit entries older than ${days} days?`)) return;
    const updated = (auditLogs || []).filter((l) => (l.ts || '').slice(0, 10) >= cutoff);
    setAuditLogs(updated);
    setOnlineFarmData({ auditLogs: updated });
  }

  function clearAll() {
    if (!window.confirm(`Delete ALL ${(auditLogs || []).length} audit log entries? This cannot be undone.`)) return;
    setAuditLogs([]);
    setOnlineFarmData({ auditLogs: [] });
  }

  // ── Derived ──────────────────────────────────────────────────
  const logs     = [...(auditLogs || [])].sort((a, b) => b.ts.localeCompare(a.ts));
  const filtered = logs
    .map((l, i) => ({ ...l, _origIdx: i }))
    .filter((l) => {
      const matchAction = filter === 'all' || l.action === filter;
      const q           = search.toLowerCase();
      const matchSearch =
        !q ||
        (l.actor  || '').toLowerCase().includes(q) ||
        (l.detail || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q);
      return matchAction && matchSearch;
    });

  // today counter uses UTC+2 offset consistent with toDay()
  const todayStr = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ── Header card ── */}
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          🔍 Admin Audit Log
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>
          Full record of who did what and when — admin-only view
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, color: C.muted, alignSelf: 'center', marginRight: 4 }}>🗑️ Clear old:</span>
          {[30, 90, 180].map((d) => (
            <button key={d} onClick={() => clearOld(d)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid rgba(239,68,68,.3)', background: 'transparent',
              color: C.red, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {d}+ days
            </button>
          ))}
          <button onClick={clearAll} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 6,
            border: '1px solid rgba(239,68,68,.5)', background: 'rgba(239,68,68,.08)',
            color: C.red, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
          }}>
            Clear All
          </button>
        </div>
      </div>

      {/* ── Search & filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user or action…"
          style={{
            flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
            color: C.text, fontSize: 13, fontFamily: 'inherit',
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
            color: C.text, fontSize: 13, fontFamily: 'inherit',
          }}
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a} style={{ background: '#1a2a1a' }}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { l: 'Total Events', v: logs.length,                                              c: C.accent  },
          { l: 'Today',        v: logs.filter((l) => l.ts.startsWith(todayStr)).length,     c: '#60a5fa' },
          { l: 'Logins',       v: logs.filter((l) => l.action === 'login').length,          c: '#22c55e' },
          { l: 'Deletes',      v: logs.filter((l) => l.action === 'delete').length,         c: '#f87171' },
        ].map((s) => (
          <div key={s.l} style={{ ...S.card, flex: 1, minWidth: 90, textAlign: 'center', padding: '10px 8px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Log entries ── */}
      {filtered.length === 0 ? (
        <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: 'center', padding: '28px 16px' }}>
          No audit events found{search ? ` matching "${search}"` : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((l) => {
            const ac  = l.action || 'other';
            const col = ACTION_COLOR[ac] || ACTION_COLOR.other;
            const ico = ACTION_ICON[ac]  || ACTION_ICON.other;
            return (
              <div key={l._origIdx} style={{
                ...S.card,
                padding: '10px 14px',
                borderLeft: `3px solid ${col}`,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{ico}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>
                      {l.actor || 'Unknown'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: C.faint }}>
                        {l.ts ? l.ts.replace('T', ' ').slice(0, 16) : ''}
                      </span>
                      <button
                        onClick={() => deleteEntry(l._origIdx)}
                        title="Delete entry"
                        style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 5,
                          border: '1px solid rgba(239,68,68,.3)', background: 'transparent',
                          color: C.red, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
                        }}
                      >🗑️</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: col,
                      background: `${col}20`, padding: '1px 7px', borderRadius: 10, marginRight: 6,
                    }}>
                      {ac.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted }}>{l.detail || ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
