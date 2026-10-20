// src/lib/capitalUtils.js
// Replaces: §4 CAPITAL & P&L HELPERS in index.html
// Pure functions — no React, no Firebase.

import { uid } from './utils';

/**
 * Append a debit/credit transaction to the capital state.
 * Deduplicates via refId so approving the same item twice is a no-op.
 *
 * @param {object} capital     - current capital state object
 * @param {function} setCapital - React state setter
 * @param {object} tx          - { type, category, amount, description, date, refId? }
 * @returns {object|null}      - the new transaction, or null if skipped
 */
export function capitalTx(capital, setCapital, { type, category, amount, description, date, refId }) {
  const amt = Math.round(parseFloat(amount) || 0);
  if (amt <= 0) return null;

  // Dedup guard
  if (refId) {
    const existing = (capital.transactions || []).find(t => t.refId === refId);
    if (existing) return existing;
  }

  const tx = {
    id: uid(),
    type,
    category,
    amount: amt,
    description: description || '',
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    refId: refId || null,
  };

  setCapital(prev => ({
    ...prev,
    transactions: [...(prev.transactions || []), tx],
  }));

  return tx;
}

/**
 * True P&L balance derived entirely from actual data arrays.
 * No dependency on capital.transactions — prevents stale data bugs.
 *
 * Balance = initial + sales income + other income − feed costs − other expenses
 */
export function calcCapitalBalance(capital, feeds, sales, expenses, incomes) {
  const ok = x => x.approved !== false; // undefined (old records) treated as approved
  const initial   = capital.initial || 0;
  const saleInc   = (sales    || []).filter(ok).reduce((s, x) => s + (x.total  || 0), 0);
  const otherInc  = (incomes  || []).filter(ok).reduce((s, x) => s + (x.amount || 0), 0);
  const feedExp   = (feeds    || []).filter(ok).reduce((s, x) => s + (x.cost   || 0), 0);
  const otherExp  = (expenses || []).filter(ok).reduce((s, x) => s + (x.amount || 0), 0);
  return initial + saleInc + otherInc - feedExp - otherExp;
}

/**
 * Remove capital transactions whose refId no longer maps to a real record.
 * Call after any delete to keep capital.transactions clean.
 */
export function purgeOrphanedCapitalTx(capital, setCapital, feeds, sales, expenses, logs) {
  const validFeedIds = new Set((feeds    || []).map(x => 'feed_'      + x.id));
  const validSaleIds = new Set((sales    || []).map(x => 'sale_'      + x.id));
  const validExpIds  = new Set((expenses || []).map(x => 'exp_'       + x.id));
  const validLogIds  = new Set((logs     || []).map(x => 'deathloss_' + x.id));

  const clean = (capital.transactions || []).filter(t => {
    if (!t.refId) return true;
    if (t.refId.startsWith('feed_'))       return validFeedIds.has(t.refId);
    if (t.refId.startsWith('sale_'))       return validSaleIds.has(t.refId);
    if (t.refId.startsWith('exp_'))        return validExpIds.has(t.refId);
    if (t.refId.startsWith('deathloss_')) return validLogIds.has(t.refId);
    return true;
  });

  if (clean.length !== (capital.transactions || []).length) {
    setCapital(prev => ({ ...prev, transactions: clean }));
  }
}
