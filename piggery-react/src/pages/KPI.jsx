import React, { useState } from "react";
// ════════════════════════════════════════════════════════════════
// FarmIQ — KPI Card Component
// Migrated from §17 of index_migration_to_vite_react.html
// ════════════════════════════════════════════════════════════════
import { C } from '../styles/theme';

/**
 * Single KPI stat card with count-up animation class.
 *
 * @prop {string}  icon   - Emoji icon
 * @prop {string}  label  - Metric label
 * @prop {string|number} value - Primary display value
 * @prop {string}  [sub]  - Small sub-label below value
 * @prop {string}  [color] - Override text color for value
 */
export default function KPI({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background:   C.surface,
      border:       `1px solid ${C.border}`,
      borderRadius: 14,
      padding:      '14px 16px',
      boxShadow:    '0 1px 4px rgba(0,0,0,.05),0 2px 8px rgba(0,0,0,.04)',
      display:      'flex',
      flexDirection:'column',
      gap:          4,
    }}>
      <div style={{ fontSize: 20, lineHeight: 1 }}>{icon}</div>
      <div style={{
        fontSize:      10,
        color:         C.faint,
        textTransform: 'uppercase',
        letterSpacing: .8,
        fontWeight:    700,
        marginTop:     4,
      }}>{label}</div>
      <div style={{
        fontSize:    20,
        fontWeight:  800,
        color:       color || C.accent,
        letterSpacing: -.3,
        lineHeight:  1.1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}
