import React from 'react';
import { toDay, fmtRWF } from '../utils/helpers';

export default function WHome({ user, feeds, sales, logs, pigs, setPage, logout }) {
  const myFeeds = (feeds || []).filter(f => f.worker === user?.name).length;
  const myLogs = (logs || []).filter(l => l.worker === user?.name).length;
  const today = toDay();

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ background: '#0f3d1e', borderRadius: 16, padding: 20, color: '#fff', marginBottom: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>👷 Worker Dashboard</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          Hello, {user?.name || 'Worker'} 👋
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{today} · FarmIQ</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'My Feed Entries', value: myFeeds, icon: '🌾' },
          { label: 'My Daily Logs', value: myLogs, icon: '📋' },
          { label: 'Active Pigs', value: (pigs || []).filter(p => p.status === 'active').length, icon: '🐖' },
          { label: 'Today', value: today, icon: '📅' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <div style={{ fontSize: 20 }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f3d1e' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: '📋 Daily Report', page: 'dailyentry' },
          { label: '🌾 Feed Entry', page: 'feedentry' },
          { label: '💰 Sale Entry', page: 'saleentry' },
          { label: '🛒 Buy Entry', page: 'buyentry' },
          { label: '🐖 Register Pig', page: 'pigentry' },
        ].map((btn, i) => (
          <button key={i} onClick={() => setPage(btn.page)}
            style={{ padding: '14px 16px', borderRadius: 12, border: 'none', background: '#e8f5e9',
              color: '#0f3d1e', fontWeight: 600, fontSize: 15, textAlign: 'left', cursor: 'pointer' }}>
            {btn.label}
          </button>
        ))}
        <button onClick={logout}
          style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #fee', background: '#fff5f5',
            color: '#c0392b', fontWeight: 600, fontSize: 15, textAlign: 'left', cursor: 'pointer', marginTop: 8 }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
