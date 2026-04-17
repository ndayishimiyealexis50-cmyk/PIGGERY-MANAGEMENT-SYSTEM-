src/utils/formatters.js

/** Format a number as Rwandan Francs — e.g. "RWF 12,500" */
export function fmtRWF(value) {
  const n = Math.round(parseFloat(value) || 0);
  return 'RWF ' + n.toLocaleString('en-US');
}

/** Format a number with commas — e.g. "12,500" */
export function fmtNum(value) {
  const n = Math.round(parseFloat(value) || 0);
  return n.toLocaleString('en-US');
