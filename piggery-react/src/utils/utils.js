// src/lib/utils.js
// Replaces: §1 REACT HOOKS DESTRUCTURE + BASIC UTILS in index.html
// Pure functions — no React, no Firebase.

/** Short random ID (8 hex chars). */
export const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Returns today's date as YYYY-MM-DD in Rwanda time (UTC+2).
 * Matches the original toDay() behaviour exactly.
 */
export const toDay = () =>
  new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

/** Format a number as Rwandan Francs: "RWF 1,234" */
export const fmtRWF = (n) => 'RWF ' + Math.round(n || 0).toLocaleString();

/** Format a number with thousands separators. */
export const fmtNum = (n) => Math.round(n || 0).toLocaleString();

/**
 * Add n days to a YYYY-MM-DD string. Returns "" for empty input.
 * Used by VaccinationTracker for nextDue calculations.
 */
export function addDays(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Days from today until dateStr (negative = overdue).
 * Returns 999 for empty/invalid input.
 */
export function daysDiff(dateStr) {
  if (!dateStr) return 999;
  return Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}
