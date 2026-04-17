/**
 * styles.js — Design tokens & shared style helpers for FarmIQ
 * Place this file at:  piggery-react/src/styles.js
 *
 * Exports:
 *   C  — color tokens
 *   S  — reusable style objects / factory functions
 */

// ─── Color tokens ─────────────────────────────────────────────────────────────
export const C = {
  // Brand
  accent:   "#16a34a",   // green-600  — primary action / success
  amber:    "#f59e0b",   // amber-400  — warnings / pending
  red:      "#dc2626",   // red-600    — errors / negative change

  // Text
  text:     "#111827",   // gray-900
  muted:    "#6b7280",   // gray-500
  faint:    "#9ca3af",   // gray-400

  // Surfaces
  bg:       "#f9fafb",   // gray-50
  elevated: "#f3f4f6",   // gray-100  — cards, tabs background
  border:   "#e5e7eb",   // gray-200
  white:    "#ffffff",
};

// ─── Style helpers ─────────────────────────────────────────────────────────────
export const S = {
  // Page-level heading
  h1: {
    fontSize: 20,
    fontWeight: 800,
    color: C.text,
    marginBottom: 4,
  },

  // Sub-heading / description line
  sub: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 16,
  },

  // Card surface
  card: {
    background: C.white,
    border: "1px solid " + C.border,
    borderRadius: 12,
    padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,.06)",
  },

  // Form label
  lbl: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  // Input / select
  inp: {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid " + C.border,
    fontSize: 13,
    color: C.text,
    background: C.white,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },

  /**
   * Primary button factory
   * @param {string} bg  — background color, e.g. C.accent
   * @returns {React.CSSProperties}
   */
  btn: (bg) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 18px",
    borderRadius: 9,
    border: "none",
    background: bg,
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity .15s",
  }),

  /**
   * Pill tab factory
   * @param {boolean} active
   * @returns {React.CSSProperties}
   */
  tab: (active) => ({
    flex: 1,
    padding: "7px 10px",
    borderRadius: 7,
    border: "none",
    background: active ? C.white : "transparent",
    color: active ? C.accent : C.muted,
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,.1)" : "none",
    transition: "all .15s",
  }),
};
