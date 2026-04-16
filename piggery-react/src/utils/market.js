// ════════════════════════════════════════════════════════════════
// FarmIQ — Rwanda Market Data & Price Helpers
// Migrated from §5, §20 of index_migration_to_vite_react.html
// ════════════════════════════════════════════════════════════════

// ── Base price table ───────────────────────────────────────────

/** Rwanda pig market base prices (RWF).
 *  These are fallback estimates when no field survey exists.
 */
export const RW_BASE_PRICES = {
  Piglet:   { base: 10000,  unit: 'head', desc: 'Under 10kg',        trend: 'stable' },
  Weaner:   { base: 32000,  unit: 'head', desc: '10–25kg',           trend: 'up'     },
  Grower:   { base: 57000,  unit: 'head', desc: '25–50kg',           trend: 'up'     },
  Finisher: { base: 105000, unit: 'head', desc: '50–80kg',           trend: 'stable' },
  Gilt:     { base: 135000, unit: 'head', desc: 'Young female',      trend: 'up'     },
  Sow:      { base: 210000, unit: 'head', desc: 'Breeding female',   trend: 'stable' },
  Boar:     { base: 240000, unit: 'head', desc: 'Breeding male',     trend: 'stable' },
  heavy:    { base: 2600,   unit: 'kg',   desc: 'Over 80kg',         trend: 'up'     },
};

/** Main livestock markets in Rwanda */
export const MARKETS = [
  'Kimironko Market, Kigali',
  'Nyabugogo Market, Kigali',
  'Musanze Livestock Market',
  'Huye Market',
  'Muhanga Market',
];

/**
 * Estimated typical weights per stage.
 * Used when a pig has no weight recorded (purchased by head).
 */
export const STAGE_EST_WEIGHTS = {
  Piglet:   5,   // under 10kg — midpoint ~5kg
  Weaner:   17,  // 10–25kg   — midpoint ~17kg
  Grower:   37,  // 25–50kg   — midpoint ~37kg
  Finisher: 65,  // 50–80kg   — midpoint ~65kg
  Gilt:     90,  // young female ~90kg
  Sow:      120, // breeding female ~120kg
  Boar:     140, // breeding male ~140kg
  heavy:    85,  // over 80kg — minimum ~85kg
};

// ── Price helpers ──────────────────────────────────────────────

/**
 * Small daily price variance seeded from today's date.
 * Keeps prices stable within a day but slightly different day-to-day.
 */
export function getDailyVariance() {
  const d    = new Date();
  const seed = (d.getDate() * 17 + d.getMonth() * 31) % 100;
  return 1 + (seed - 50) / 800;
}

/**
 * Resolve the effective price-bracket stage from actual weight.
 * Breeding/special pigs (Sow, Boar, Gilt) always use their registered stage.
 */
export function getWeightBasedStage(stage, weight) {
  if (stage === 'Sow' || stage === 'Boar' || stage === 'Gilt') return stage;
  const w = parseFloat(weight) || 0;
  if (w < 10)  return 'Piglet';
  if (w < 25)  return 'Weaner';
  if (w < 50)  return 'Grower';
  if (w <= 80) return 'Finisher';
  return 'heavy';
}

// ── Survey data access ─────────────────────────────────────────

/**
 * Returns all market price surveys from the app's latest Firestore cache
 * (via the global _latestFarmData), falling back to localStorage.
 *
 * TODO (migration): replace _latestFarmData global with a Zustand/Context
 * store once the full app is ported to Vite+React.
 */
export function getMarketSurveys() {
  try {
    // eslint-disable-next-line no-undef
    if (
      window._latestFarmData &&
      Array.isArray(window._latestFarmData.marketSurveys) &&
      window._latestFarmData.marketSurveys.length > 0
    ) {
      return window._latestFarmData.marketSurveys;
    }
  } catch (_) { /* ignore */ }
  try {
    return JSON.parse(localStorage.getItem('farmiq_market_surveys') || '[]');
  } catch {
    return [];
  }
}

/** Returns the prices object from the latest market survey, or null. */
export function getLatestSurveyPrices() {
  const surveys = getMarketSurveys();
  if (surveys.length === 0) return null;
  const latest = surveys.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest.prices;
}

/**
 * Compute market value for a single pig.
 *
 * Priority order:
 *   1. Latest field survey prices  (most accurate)
 *   2. Returns 0 if no survey data exists
 *      (herd value should only use verified survey prices)
 */
export function getMarketPrice(stage, weight) {
  try {
    const surveys = getMarketSurveys();
    if (surveys.length > 0) {
      const latest = surveys.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest && latest.prices) {
        const actualW  = parseFloat(weight) || 0;
        const estW     = actualW || STAGE_EST_WEIGHTS[stage] || STAGE_EST_WEIGHTS.Grower;
        const effStage = getWeightBasedStage(stage, estW);

        if (effStage === 'Piglet' && latest.prices.Piglet)
          return latest.prices.Piglet;

        if (effStage === 'heavy') {
          const ppkg = latest.prices.heavy || latest.prices.Finisher;
          if (ppkg) return Math.round(estW * ppkg);
        }

        const pricePerKg = latest.prices[effStage];
        if (pricePerKg) return Math.round(estW * pricePerKg);

        const fallback = latest.prices[stage] || latest.prices.heavy;
        if (fallback) return Math.round(estW * fallback);
      }
    }
  } catch (_) { /* ignore */ }
  return 0; // no survey data → no herd value
}

/** Alias — same logic as getMarketPrice (unified for consistency). */
export const getSurveyOrEstimatedPrice = getMarketPrice;

// ── Business Profile ───────────────────────────────────────────

/**
 * Reads the farm's business profile.
 * Prefers the Firestore cache, falls back to localStorage.
 *
 * TODO (migration): inject via Context instead of global.
 */
export function getBusinessProfile() {
  try {
    // eslint-disable-next-line no-undef
    if (window._latestFarmData?.bizProfile?.farmName) {
      return window._latestFarmData.bizProfile;
    }
  } catch (_) { /* ignore */ }
  try {
    return JSON.parse(localStorage.getItem('farmiq_biz_profile') || '{}');
  } catch {
    return {};
  }
}
