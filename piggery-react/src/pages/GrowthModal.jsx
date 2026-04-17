// src/pages/GrowthModal.jsx
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import { toDay } from '../utils/helpers';

export default function GrowthModal({ pig, onSave, onClose }) {
  const [weight, setWeight] = useState(String(pig.weight || ''));
  const [length, setLength] = useState(String(pig.length || ''));
  const [note, setNote]     = useState('');
  const [date, setDate]     = useState(toDay());

  function handleSave() {
    const w = parseFloat(weight);
    const l = parseFloat(length) || null;
    if (!w || w <= 0) { alert('Enter a valid weight'); return; }

    const measurement = {
      date,
      weight: w,
      length: l,
      note,
      recordedAt: new Date().toISOString(),
    };

    onSave({
      weight: w,
      length: l || pig.length,
      measurements: [...(pig.measurements || []), measurement],
    });
  }

  // Weight gain since last measurement
  const prevWeight = pig.weight || 0;
  const newWeight  = parseFloat(weight) || 0;
  const gain       = newWeight - prevWeight;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>📏 Record Growth</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{pig.tag} · {pig.breed} · {pig.stage}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Previous stats */}
        <div style={{ background: C.elevated, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Previous measurements</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>⚖️ <strong>{pig.weight || 0} kg</strong></span>
            {pig.length && <span>📏 <strong>{pig.length} cm</strong></span>}
            <span style={{ color: C.faint }}>({(pig.measurements || []).length} records)</span>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.lbl}>New Weight (kg) *</label>
            <input
              type="number" step="0.1" autoFocus
              value={weight} onChange={e => setWeight(e.target.value)}
              style={{ ...S.inp, fontWeight: 700, fontSize: 15 }}
              placeholder="e.g. 45.5"
            />
            {gain !== 0 && newWeight > 0 && (
              <div style={{ fontSize: 11, marginTop: 3, color: gain > 0 ? C.accent : C.red, fontWeight: 600 }}>
                {gain > 0 ? '↑' : '↓'} {Math.abs(gain).toFixed(1)} kg {gain > 0 ? 'gained' : 'lost'}
              </div>
            )}
          </div>
          <div>
            <label style={S.lbl}>Length (cm)</label>
            <input
              type="number" step="0.5"
              value={length} onChange={e => setLength(e.target.value)}
              style={S.inp}
              placeholder="e.g. 95"
            />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.lbl}>Measurement Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.inp} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.lbl}>Note (optional)</label>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              style={S.inp}
              placeholder="e.g. After deworming"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn(), flex: 1, padding: 11 }} onClick={handleSave}>✅ Save Growth Record</button>
          <button style={{ ...S.btn('#6b7280'), padding: '11px 16px' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
