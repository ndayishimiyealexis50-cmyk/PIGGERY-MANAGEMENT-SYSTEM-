// ════════════════════════════════════════════════════════════════
// FarmIQ — Shared Utility Helpers
// Migrated from §1, §4 of index_migration_to_vite_react.html
// ════════════════════════════════════════════════════════════════

// ── Identity & Date ────────────────────────────────────────────

/** Random 8-char alphanumeric ID */
export const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Today's date in Rwanda timezone (UTC+2), formatted as YYYY-MM-DD.
 * Rwanda does not observe DST so the +2h offset is fixed.
 */
export const toDay = () =>
  new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Difference in whole days from today to a future/past dateStr.
 * Positive = future, negative = past.
 */
export const daysDiff = (dateStr) => {
  if (!dateStr) return 999;
  return Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

/** Add n calendar days to a YYYY-MM-DD string */
export const addDays = (dateStr, n) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── Formatting ─────────────────────────────────────────────────

/** Format a number as "RWF 1,234,567" */
export const fmtRWF = (n) => 'RWF ' + Math.round(n || 0).toLocaleString();

/** Format a number with thousand separators, no currency */
export const fmtNum = (n) => Math.round(n || 0).toLocaleString();

// ── Financial Calculations ─────────────────────────────────────

/**
 * Capital balance = initial + all approved income − all approved expenses.
 */
export function calcCapitalBalance(capital, feeds, sales, expenses, incomes) {
  const ok = (x) => x.approved !== false;
  const initial  = capital.initial || 0;
  const saleInc  = (sales    || []).filter(ok).reduce((s, x) => s + (x.total   || 0), 0);
  const otherInc = (incomes  || []).filter(ok).reduce((s, x) => s + (x.amount  || 0), 0);
  const feedExp  = (feeds    || []).filter(ok).reduce((s, x) => s + (x.cost    || 0), 0);
  const otherExp = (expenses || []).filter(ok).reduce((s, x) => s + (x.amount  || 0), 0);
  return initial + saleInc + otherInc - feedExp - otherExp;
}

/**
 * P&L — same source of truth as calcCapitalBalance.
 */
export function calcPnL(capital, feeds, sales, expenses, incomes) {
  const ok = (x) => x.approved !== false;
  const totalInc =
    sales.filter(ok).reduce((s, l) => s + (l.total  || 0), 0) +
    incomes.filter(ok).reduce((s, l) => s + (l.amount || 0), 0);
  const totalExp =
    feeds.filter(ok).reduce((s, l) => s + (l.cost   || 0), 0) +
    expenses.filter(ok).reduce((s, l) => s + (l.amount || 0), 0);
  return { totalInc, totalExp, profit: totalInc - totalExp };
}

/**
 * Add a capital transaction with dedup guard via refId.
 */
export function capitalTx(capital, setCapital, { type, category, amount, description, date, refId }) {
  const amt = Math.round(parseFloat(amount) || 0);
  if (amt <= 0) return null;
  if (refId) {
    const existing = (capital.transactions || []).find((t) => t.refId === refId);
    if (existing) return existing;
  }
  const tx = {
    id:          Math.random().toString(36).slice(2, 10),
    type, category, amount: amt,
    description: description || '',
    date:        date || new Date().toISOString().slice(0, 10),
    createdAt:   new Date().toISOString(),
    refId:       refId || null,
  };
  setCapital((prev) => ({ ...prev, transactions: [...(prev.transactions || []), tx] }));
  return tx;
}

/**
 * Remove capital transactions whose refId no longer maps to a real record.
 */
export function purgeOrphanedCapitalTx(capital, setCapital, feeds, sales, expenses, logs) {
  const validFeedIds = new Set((feeds    || []).map((x) => 'feed_'      + x.id));
  const validSaleIds = new Set((sales    || []).map((x) => 'sale_'      + x.id));
  const validExpIds  = new Set((expenses || []).map((x) => 'exp_'       + x.id));
  const validLogIds  = new Set((logs     || []).map((x) => 'deathloss_' + x.id));
  const clean = (capital.transactions || []).filter((t) => {
    if (!t.refId) return true;
    if (t.refId.startsWith('feed_'))      return validFeedIds.has(t.refId);
    if (t.refId.startsWith('sale_'))      return validSaleIds.has(t.refId);
    if (t.refId.startsWith('exp_'))       return validExpIds.has(t.refId);
    if (t.refId.startsWith('deathloss_')) return validLogIds.has(t.refId);
    return true;
  });
  if (clean.length !== (capital.transactions || []).length) {
    setCapital((prev) => ({ ...prev, transactions: clean }));
  }
}

// ── Constants ──────────────────────────────────────────────────

export const GESTATION  = 114;
export const HEAT_CYCLE = 21;

export const EXPENSE_CATS = [
  'Feed Purchase', 'Pig Purchase', 'Veterinary', 'Medicine',
  'Equipment', 'Labour', 'Transport', 'Utilities',
  'Maintenance', 'Salary', 'Salary Advance', 'Other',
];

export const INCOME_CATS = [
  'Pig Sale', 'Piglet Sale', 'Manure Sale', 'Other Income',
];

// ── Market Helpers ─────────────────────────────────────────────

export function getMarketPrice() {
  return null;
}

export function getMarketSurveys() {
  return [];
}
