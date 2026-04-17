// src/utils/constants.js
// ── Design tokens & shared style helpers used across all page components ───────

// ── Colour palette ────────────────────────────────────────────────────────────
export const C = {
  accent:      '#16a34a',
  accentSoft:  'rgba(22,163,74,.08)',
  accentBorder:'rgba(22,163,74,.25)',
  red:         '#ef4444',
  redSoft:     'rgba(239,68,68,.08)',
  amber:       '#f59e0b',
  amberSoft:   'rgba(245,158,11,.08)',
  blue:        '#2563eb',
  blueSoft:    'rgba(37,99,235,.08)',
  pink:        '#ec4899',
  pinkSoft:    'rgba(236,72,153,.08)',
  text:        '#111827',
  muted:       '#6b7280',
  faint:       '#9ca3af',
  border:      '#e5e7eb',
  elevated:    '#f3f4f6',
  surface:     '#ffffff',
  bg:          '#f0f4f0',
};

// ── Shared style objects & helpers ────────────────────────────────────────────
export const S = {
  // Card container
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: '16px 16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 6px rgba(0,0,0,.06)',
    marginBottom: 14,
  },

  // Section heading
  h1: {
    fontSize: 20,
    fontWeight: 800,
    color: '#111827',
    letterSpacing: -0.3,
  },

  // Sub-heading / caption
  sub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Form label
  lbl: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Text / select input
  inp: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 13,
    background: '#fff',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },

  // Button factory — pass an optional hex colour (defaults to accent green)
  btn: (bg = '#16a34a', color = '#fff') => ({
    padding: '8px 16px',
    borderRadius: 9,
    border: 'none',
    background: bg,
    color,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }),

  // Small badge / pill
  badge: (bg = '#e5e7eb', color = '#374151') => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: bg,
    color,
  }),
};
