// VahanaIQ: Centralized Constants & Statutory Configurations
// Consolidates CBSL macroprudential loan-to-value (LTV) limits, tenure constraints,
// actuarial defaults, DTI limits, and UI strategy presets.

// ============================================================================
// 1. CBSL Statutory Macroprudential Directions (Directions No. 01 of 2026, cl. 2.1)
// ============================================================================

/**
 * Statutory minimum down payment percentage for motor cars registered in
 * Sri Lanka for over one year (at most 60% LTV financed) and commercial vehicles.
 */
export const DOWN_MIN = 40;

/**
 * Statutory minimum down payment percentage for brand new, reconditioned,
 * and recently registered motor cars (< 1 year in SL) (at most 40% LTV financed).
 */
export const DOWN_MIN_UNREG = 60;

/**
 * Statutory maximum tenure ceiling in months (84 months = 7 years).
 */
export const MAX_TENURE = 84;

/**
 * Statutory / operational minimum tenure in months (6 months).
 */
export const MIN_TENURE = 6;

/**
 * Maximum possible down payment percentage (100% cash purchase).
 */
export const DOWN_MAX = 100;

/**
 * Vehicle condition descriptors matching CBSL regulatory classifications.
 */
export const CONDITIONS = {
  New: "Brand New",
  Recond: "Reconditioned",
  Recent: "Registered under a year",
  Used: "Registered Used"
};

// ============================================================================
// 2. Default Financing & Budgeting Values
// ============================================================================

/**
 * Default annual interest rate percentage (16% per annum).
 */
export const DEFAULT_RATE = 16;

/**
 * Default lease tenure in months (84 months / 7 years).
 */
export const DEFAULT_TENURE = 84;

/**
 * Default down payment percentage (60% standard unregistered/conservative floor).
 */
export const DEFAULT_DOWN = 60;

/**
 * Default rate calculation type ("reducing" or "flat").
 */
export const DEFAULT_RATE_TYPE = "reducing";

/**
 * Default Debt-to-Income (DTI) ratio (0.4 = 40%).
 */
export const DEFAULT_DTI = 0.4;

/**
 * Default monthly gross/net income (0 LKR).
 */
export const DEFAULT_INCOME = 0;

/**
 * Default existing monthly debt service commitments (0 LKR).
 */
export const DEFAULT_DEBT = 0;

/**
 * Default annual comprehensive insurance estimate (0 LKR).
 */
export const DEFAULT_INSURANCE = 0;

/**
 * Default upfront documentation and facility fees (0 LKR).
 */
export const DEFAULT_FEES = 0;

// ============================================================================
// 3. Debt-to-Income (DTI) Limits & Ceilings
// ============================================================================

/**
 * Standard CBSL benchmark Debt-to-Income ceiling (40% of net monthly income).
 */
export const DTI_STANDARD = 0.4;
export const DTI_LIMIT_STANDARD = 0.4;
export const DTI_STANDARD_PCT = 40;

/**
 * Extended / Stretch Debt-to-Income ceiling for higher budgets (50% of net monthly income).
 */
export const DTI_STRETCH = 0.5;
export const DTI_LIMIT_STRETCH = 0.5;
export const DTI_STRETCH_PCT = 50;

/**
 * Lower bound for valid DTI ratio (strictly > 0).
 */
export const DTI_MIN = 0;

/**
 * Upper bound for valid DTI ratio (1.0 = 100%).
 */
export const DTI_MAX = 1.0;

// ============================================================================
// 4. UI Strategy Presets & Interactive Constraints
// ============================================================================

/**
 * Interactive financing strategy presets.
 */
export const STRATEGY_PRESETS = {
  LOWEST_RENTAL: { tenure: 84, down: 60, rateType: "reducing" },
  FAST_PAYOFF: { tenure: 36, down: 60, rateType: "reducing" },
  MIN_CASH: { tenure: 84, down: 40, rateType: "reducing" },
  CASH_PURCHASE: { down: 100 }
};

/**
 * Shorthand strategy references for direct access.
 */
export const STRATEGY_LOWEST_RENTAL = STRATEGY_PRESETS.LOWEST_RENTAL;
export const STRATEGY_FAST_PAYOFF = STRATEGY_PRESETS.FAST_PAYOFF;
export const STRATEGY_MIN_CASH = STRATEGY_PRESETS.MIN_CASH;
export const STRATEGY_CASH_PURCHASE = STRATEGY_PRESETS.CASH_PURCHASE;

/**
 * Fast-payoff tenure preset in months (36 months = 3 years).
 */
export const FAST_PAYOFF_TENURE = 36;

/**
 * Intermediate tenure preset in months (60 months = 5 years).
 */
export const MID_TENURE = 60;

/**
 * Common tenure preset options in months.
 */
export const TENURE_PRESETS = [36, 60, 84];

/**
 * Common down payment preset percentages.
 */
export const DOWN_PRESETS = [40, 60, 70];

/**
 * Rate boundary limits for slider and input validation.
 */
export const MIN_RATE = 0;
export const MAX_RATE = 100;
export const MAX_INPUT_RATE = 40;

/**
 * UI timing constants (milliseconds).
 */
export const TOAST_DURATION = 3500;
export const TOAST_UNDO_DURATION = 6000;
export const AUTOSAVE_DELAY_MS = 400;

/**
 * Numerical safety boundaries and DoS prevention limits.
 */
export const MAX_SAFE_AMOUNT = 1e12; // 1 trillion LKR ceiling for sane arithmetic
export const MAX_SAFE_PRECISION = 10 ** 15; // Floating-point precision threshold
export const MAX_SCHEDULE_MONTHS = 600; // 50 years max schedule iterations
export const MAX_SHARED_CARS = 30; // Max vehicles encoded in share URL
export const MAX_SAVED_GOALS = 30; // Max saved savings scenarios

// Global fallback registration for classic non-module scripts (e.g. curated-catalogue.js)
if (typeof globalThis !== "undefined") {
  globalThis.__VAHANAIQ_CONSTANTS__ = {
    DOWN_MIN,
    DOWN_MIN_UNREG,
    MAX_TENURE,
    MIN_TENURE,
    DOWN_MAX,
    CONDITIONS,
    DEFAULT_RATE,
    DEFAULT_TENURE,
    DEFAULT_DOWN,
    DEFAULT_RATE_TYPE,
    DEFAULT_DTI,
    DEFAULT_INCOME,
    DEFAULT_DEBT,
    DEFAULT_INSURANCE,
    DEFAULT_FEES,
    DTI_STANDARD,
    DTI_LIMIT_STANDARD,
    DTI_STANDARD_PCT,
    DTI_STRETCH,
    DTI_LIMIT_STRETCH,
    DTI_STRETCH_PCT,
    DTI_MIN,
    DTI_MAX,
    STRATEGY_PRESETS,
    STRATEGY_LOWEST_RENTAL,
    STRATEGY_FAST_PAYOFF,
    STRATEGY_MIN_CASH,
    STRATEGY_CASH_PURCHASE,
    FAST_PAYOFF_TENURE,
    MID_TENURE,
    TENURE_PRESETS,
    DOWN_PRESETS,
    MIN_RATE,
    MAX_RATE,
    MAX_INPUT_RATE,
    TOAST_DURATION,
    TOAST_UNDO_DURATION,
    AUTOSAVE_DELAY_MS,
    MAX_SAFE_AMOUNT,
    MAX_SAFE_PRECISION,
    MAX_SCHEDULE_MONTHS,
    MAX_SHARED_CARS,
    MAX_SAVED_GOALS
  };
}
