import React, { useState } from 'react';
import { uid } from '../utils/helpers';
import { fsSet } from '../lib/firestore';

export default function WHome({ user, feeds, sales, logs, pigs, setPage, logout, advances }) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const myAdvances = (advances || []).filter(a => a.workerId === (user?.uid || user?.id));

  const btn = { padding: '14px 16px', borderRadius: 12, border: 'none', background: '#e8f5e9', color: '#0f3d1e', fontWeight: 600, fontSize: 15, textAlign: 'left', cursor: 'pointer' };

  async function submitAdvance() {
    if (!amount || parseFloat(amount) <= 0) return alert('Enter a valid amount.');
    setSaving(true);
    const rec = {
      id: uid(),
      workerId: user?.uid || user?.id,
      workerName: user?.name || user?.email,
      amount: parseFloat(amount),
      reason: reason || '',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    const updated = [...(advances || []), rec];
    try { await fsSet('advances', updated); } catch(e) {}
    setAmount(''); setReason(''); setShowForm(false); setSaving(false);
  }

  const statusColor = s => s === 'approved' ? '#16a34a' : s === 'rejected' ? '#dc2626' : '#d97706';

  const buttons = [
    { label: '📋 Daily Report', page: 'dailyentry' },
    { label: '🌾 Feed Entry', page: 'feedentry' },
    { label: '💰 Sale Entry', page: 'saleentry' },
    { label: '🛒 Buy Entry', page: 'buyentry' },
    { label: '🐷 Register Pig', page: 'pigentry' },
  ];

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ background: '#0f3d1e', borderRadius: 16, padding: 20, color: '#fff', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>👋 Welcome, {user?.name || 'Worker'}</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{user?.email}</div>
      </div>

      {buttons.map((b, i) => (
        <button key={i} onClick={() => setPage(b.page)} style={{ ...btn, width: '100%', marginBottom: 8, display: 'block' }}>
          {b.label}
        </button>
      ))}

      <button onClick={() => setShowForm(!showForm)} style={{ ...btn, width: '100%', marginBottom: 8, background: '#fff3cd', color: '#856404', display: 'block' }}>
        💵 Request Salary Advance
      </button>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Advance Request</div>
          <input type="number" placeholder="Amount (RWF)" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8, boxSizing: 'border-box' }} />
          <input type="text" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8, boxSizing: 'border-box' }} />
          <button onClick={submitAdvance} disabled={saving}
            style={{ ...btn, background: '#0f3d1e', color: '#fff', width: '100%' }}>
            {saving ? 'Submitting...' : '✅ Submit Request'}
          </button>
        </div>
      )}

      {myAdvances.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>My Advance Requests</div>
          {myAdvances.map(a => (
            <div key={a.id} style={{ padding: 10, borderRadius: 8, background: '#f9f9f9', marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{a.amount?.toLocaleString()} RWF</div>
              <div style={{ fontSize: 12, color: '#666' }}>{a.reason || 'No reason'}</div>
              <div style={{ fontSize: 12, color: statusColor(a.status), fontWeight: 600 }}>
                {a.status === 'pending' ? '⏳ Pending' : a.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
              </div>
              {a.rejectionReason && <div style={{ fontSize: 11, color: '#dc2626' }}>Reason: {a.rejectionReason}</div>}
            </div>
          ))}
        </div>
      )}

      <button onClick={logout} style={{ ...btn, width: '100%', background: '#fff5f5', color: '#c0392b', border: '1px solid #fee', display: 'block' }}>
        🚪 Sign Out
      </button>
    </div>
  );
}
