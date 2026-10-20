// src/lib/pigUtils.js
// Replaces: §2 PIG TAG GENERATOR + autoAddToStock + autoRegisterPigsFromPurchase
// Pure-ish functions — no React. They receive setters as arguments (same pattern
// as the original globals) but do not import any React hooks themselves.

import { uid, toDay } from './utils';
import { fsSet } from '../lib/firestore';

// ── Pig tag generation ────────────────────────────────────────────

const STAGE_CODE = {
  Piglet: 'P', Weaner: 'W', Grower: 'G', Finisher: 'F',
  Gilt: 'GL', Sow: 'S', Boar: 'B',
};

/**
 * Derive a 2-letter breed code from a breed name string.
 *   "Landrace"         → "LA"
 *   "Mixed/Local"      → "ML"
 *   "Landrace/Duroc"   → "LA-DU"
 */
export function breedCode(breed) {
  if (!breed) return 'XX';
  const b = breed.trim();
  if (b === 'Mixed/Local') return 'ML';
  if (b.includes('/')) {
    return b.split('/').map(p => p.trim().slice(0, 2).toUpperCase()).join('-');
  }
  const words = b.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w.slice(0, 2).toUpperCase()).join('-');
  }
  return b.slice(0, 2).toUpperCase();
}

/**
 * Generate a unique pig tag: [BREED_CODE]-[STAGE_CODE]-[YYMM]-[SEQ]
 * e.g. "LR-S-2503-003"
 *
 * @param {string} breed         - Pig breed name
 * @param {string} stage         - Pig stage (Piglet | Weaner | Grower | …)
 * @param {Array}  existingPigs  - Current pig list (for sequence numbering)
 */
export function genPigTag(breed, stage, existingPigs) {
  const now  = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
  const sc   = STAGE_CODE[stage] || 'X';
  const bc   = breedCode(breed);
  const sameType = (existingPigs || []).filter(
    p => breedCode(p.breed) === bc && (STAGE_CODE[p.stage] || 'X') === sc
  ).length;
  const seq = String(sameType + 1).padStart(3, '0');
  return `${bc}-${sc}-${yymm}-${seq}`;
}

// ── Stock auto-contribution ───────────────────────────────────────

/**
 * When a Feed/Medicine/Equipment purchase is approved, automatically
 * update (or create) a matching stock entry.
 *
 * @param {object}   expense  - The approved expense record
 * @param {Array}    stock    - Current stock array
 * @param {function} setStock - React state setter
 */
export function autoAddToStock(expense, stock, setStock) {
  const catMap = { 'Feed Purchase': 'Feed', Medicine: 'Medicine', Equipment: 'Equipment' };
  const stockCat = catMap[expense.category];
  if (!stockCat) return;

  const qty = parseFloat(expense.quantity) || 0;
  if (qty <= 0) return;

  const itemName = (expense.item || expense.category).trim();
  const unit     = expense.unit || 'kg';
  const cpu      = parseFloat(expense.unitPrice) || (qty > 0 ? Math.round((expense.amount || 0) / qty) : 0);
  const existing = (stock || []).find(
    s => s.name.toLowerCase() === itemName.toLowerCase() && s.unit === unit
  );

  if (existing) {
    const updated = (stock || []).map(s =>
      s.id === existing.id ? { ...s, quantity: s.quantity + qty, lastUpdated: toDay() } : s
    );
    setStock(updated);
    fsSet('stock', updated);
    window._addAuditLog?.('edit', `Stock auto-updated from purchase: ${itemName} +${qty}${unit}`);
  } else {
    const newItem = {
      id: uid(), name: itemName, category: stockCat,
      quantity: qty, unit, costPerUnit: cpu,
      minLevel: 0, lastUpdated: toDay(), source: 'purchase',
    };
    const updated = [...(stock || []), newItem];
    setStock(updated);
    fsSet('stock', updated);
    window._addAuditLog?.('add', `Stock auto-created from purchase: ${itemName} ${qty}${unit}`);
  }
}

// ── Auto pig registration from purchase ──────────────────────────

/**
 * When a "Pig Purchase" expense is approved, automatically register
 * one or more pig records (by head or by kg).
 *
 * @param {object}   expense     - The approved expense record
 * @param {Array}    pigs        - Current pig array
 * @param {function} setPigs     - React state setter
 * @param {object}   capital     - Current capital state
 * @param {function} setCapital  - React state setter
 * @returns {Array} newly created pig records
 */
export function autoRegisterPigsFromPurchase(expense, pigs, setPigs, capital, setCapital) {
  const ITEM_STAGE = {
    'weaner pig': 'Weaner', 'grower pig': 'Grower',
    sow: 'Sow', boar: 'Boar', gilt: 'Gilt',
    piglet: 'Piglet', finisher: 'Finisher',
  };

  const itemLower  = (expense.item || '').toLowerCase().trim();
  const stage      = ITEM_STAGE[itemLower] || 'Weaner';
  const breed      = 'Mixed/Local';
  const gender     = (stage === 'Sow' || stage === 'Gilt') ? 'Female' : 'Male';
  const isByKg     = expense.pigPricingMode === 'kg';
  const qty        = isByKg ? 1 : Math.max(1, parseInt(expense.quantity) || 1);
  const weightKg   = isByKg ? (parseFloat(expense.quantity) || 0) : 0;
  const priceEach  = qty > 0 ? Math.round((expense.amount || 0) / qty) : 0;

  const newPigs = [];
  for (let i = 0; i < qty; i++) {
    const allSoFar = [...(pigs || []), ...newPigs];
    const tag = genPigTag(breed, stage, allSoFar);
    newPigs.push({
      id: uid(), tag, breed, gender, stage,
      weight: weightKg ? String(weightKg) : '',
      length: '', dob: '',
      arrivalDate: expense.date || toDay(),
      source: expense.supplier || 'Purchase',
      purchasePrice: String(priceEach),
      status: 'active', measurements: [], approved: true,
      addedFromPurchase: true, purchaseExpenseId: expense.id,
      notes: `Auto-registered from purchase by ${expense.worker || 'admin'}${
        isByKg ? ` (bought by weight: ${weightKg}kg @ RWF${expense.unitPrice || '?'} /kg)` : ''
      }`,
    });
  }

  setPigs(p => {
    const updated = [...p, ...newPigs];
    fsSet('pigs', updated);
    return updated;
  });

  window._addAuditLog?.('add',
    `${qty} pig(s) auto-registered from purchase: ${stage} — ${newPigs.map(p => p.tag).join(', ')}${
      isByKg ? ` [by weight: ${weightKg}kg]` : ''
    }`
  );

  return newPigs;
}
