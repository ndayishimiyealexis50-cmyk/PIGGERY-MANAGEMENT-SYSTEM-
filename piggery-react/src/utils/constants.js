// src/lib/constants.js
// Replaces: ADMIN_EMAIL, isAdminEmail, isAdminUser, EXPENSE_CATS,
//           INCOME_CATS, MARKETS, GESTATION, HEAT_CYCLE scattered
//           across §4 / §5 of index.html.

// ── Admin identity ────────────────────────────────────────────────
// ⚠️  UI gate only — real access control is in Firestore Rules.
export const ADMIN_EMAIL = 'ndayishimiyealexis50@gmail.com';

/** True if this email belongs to the farm admin. */
export function isAdminEmail(email) {
  return !!(email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase());
}

/**
 * True if a logged-in user object is the admin.
 * Prefers the Firestore `role` field (server-set) over email.
 */
export function isAdminUser(user) {
  return !!(
    user &&
    (user.role?.toLowerCase().trim() === 'admin' || isAdminEmail(user.email))
  );
}

// ── Drop-down option lists ────────────────────────────────────────
export const EXPENSE_CATS = [
  'Feed Purchase', 'Pig Purchase', 'Veterinary', 'Medicine', 'Equipment',
  'Labour', 'Transport', 'Utilities', 'Maintenance', 'Salary',
  'Salary Advance', 'Other',
];

export const INCOME_CATS = [
  'Pig Sale', 'Piglet Sale', 'Manure Sale', 'Other Income',
];

export const MARKETS = [
  'Kimironko Market, Kigali',
  'Nyabugogo Market, Kigali',
  'Musanze Livestock Market',
  'Huye Market',
  'Muhanga Market',
];

// ── Pig biology constants ─────────────────────────────────────────
export const GESTATION  = 114; // days
export const HEAT_CYCLE =  21; // days
