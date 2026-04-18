import { C, S } from '../styles/theme';
// src/pages/PigCard.jsx
import React from 'react';
import { C, S } from '../utils/constants';
import { fmtRWF, getMarketPrice } from '../utils/helpers';

export default function PigCard({
  p, sc, logs,
  editPigId, editForm,
  setEditPigId, setEditForm,
  saveEdit, setGrowthPig,
  setPigs, deletePig,
  onLongPress,
}) {
  const isEditing = editPigId === p.id;
  const stageColor = sc[p.stage] || C.accent;
  const isActive = p.status === 'active';

  // Long-press support for mobile
  const pressTimer = React.useRef(null);
  function handleTouchStart() {
    pressTimer.current = setTimeout(() => { onLongPress && onLongPress(); }, 500);
  }
  function handleTouchEnd() { clearTimeout(pressTimer.current); }

  // Recent feed logs for this pig
  const pigLogs = (logs || []).filter(l => l.pigId === p.id).slice(-3);

  const STAGES = ['Piglet', 'Weaner', 'Grower', 'Finisher', 'Gilt', 'Sow', 'Boar'];
  const BREEDS = ['Landrace', 'Large White', 'Duroc', 'Hampshire', 'Mixed/Local'];

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={e => { e.preventDefault(); onLongPress && onLongPress(); }}
      style={{
        ...S.card,
        marginBottom: 0,
        borderLeft: `4px solid ${stageColor}`,
        opacity: isActive ? 1 : 0.6,
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Status badge */}
      {!isActive && (
        <div style={{ position: 'absolute', top: 10, right: 10, ...S.badge('#fef3c7', '#92400e') }}>
          {p.status === 'sold' ? '🏷️ Sold' : p.status}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.text, fontFamily: 'monospace' }}>{p.tag}</div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{p.breed} · {p.gender}</div>
        </div>
        <span style={{ ...S.badge(stageColor + '22', stageColor), fontSize: 10 }}>{p.stage}</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.muted }}>
          ⚖️ <strong style={{ color: C.text }}>{p.weight || 0} kg</strong>
        </div>
        {p.length && (
          <div style={{ fontSize: 12, color: C.muted }}>
            📏 <strong style={{ color: C.text }}>{p.length} cm</strong>
          </div>
        )}
        <div style={{ fontSize: 12, color: C.muted }}>
          💰 <strong style={{ color: C.accent }}>{fmtRWF(getMarketPrice(p.stage, p.weight))}</strong>
        </div>
        {p.dob && (
          <div style={{ fontSize: 12, color: C.muted }}>
            🎂 <strong style={{ color: C.text }}>{p.dob}</strong>
          </div>
        )}
      </div>

      {p.source && (
        <div style={{ fontSize: 11, color: C.faint, marginBottom: 6 }}>📍 {p.source}</div>
      )}

      {/* Inline edit form */}
      {isEditing && editForm && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid ' + C.border }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 8 }}>✏️ Edit Pig</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={S.lbl}>Weight (kg)</label>
              <input type="number" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: e.target.value })} style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>Length (cm)</label>
              <input type="number" value={editForm.length} onChange={e => setEditForm({ ...editForm, length: e.target.value })} style={S.inp} />
            </div>
            <div>
              <label style={S.lbl}>Stage</label>
              <select value={editForm.stage} onChange={e => setEditForm({ ...editForm, stage: e.target.value })} style={S.inp}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Breed</label>
              <select value={editForm.breed} onChange={e => setEditForm({ ...editForm, breed: e.target.value })} style={S.inp}>
                {BREEDS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.lbl}>Source</label>
              <input value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })} style={S.inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...S.btn(), flex: 1, padding: 8, fontSize: 12 }} onClick={saveEdit}>✅ Save</button>
            <button style={{ ...S.btn('#6b7280'), padding: 8, fontSize: 12 }} onClick={() => { setEditPigId(null); setEditForm(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Quick action buttons (desktop) */}
      {!isEditing && isActive && (
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setGrowthPig(p)}
            style={{ ...S.btn(C.accentSoft, C.accent), padding: '5px 10px', fontSize: 11, border: '1px solid ' + C.accentBorder }}
          >📏 Growth</button>
          <button
            onClick={() => { setEditPigId(p.id); setEditForm({ weight: String(p.weight), length: String(p.length || ''), stage: p.stage, breed: p.breed, source: p.source || '' }); }}
            style={{ ...S.btn(C.blueSoft, C.blue), padding: '5px 10px', fontSize: 11, border: '1px solid rgba(37,99,235,.25)' }}
          >✏️ Edit</button>
          <button
            onClick={() => deletePig(p)}
            style={{ ...S.btn(C.redSoft, C.red), padding: '5px 10px', fontSize: 11, border: '1px solid rgba(239,68,68,.25)' }}
          >🗑️</button>
        </div>
      )}
    </div>
  );
}
