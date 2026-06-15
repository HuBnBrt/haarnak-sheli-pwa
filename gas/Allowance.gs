// ─────────────────────────────────────────────────────────────
// Allowance.gs — Monthly allowance and quarterly bonus
// Phase 0: stubs only. Fleshed out in Phase 3-4.
// ─────────────────────────────────────────────────────────────

/**
 * Run the monthly allowance for all active children if it hasn't
 * already been run this calendar month.
 *
 * Called by:
 *   - GAS time-based trigger (installed by setupSheets())
 *   - Parent dashboard manual trigger (fallback)
 *
 * Idempotent: checks `transactions` for an allowance entry this month
 * before proceeding.
 *
 * Default split (configurable in `settings`):
 *   savings_split_agorot = 1500  (15 ₪)
 *   giving_split_agorot  = 500   (5 ₪)
 *   Physical wallet: 0 (cash is never added automatically)
 *
 * Phase 3: implement full logic.
 */
function runMonthlyAllowanceIfDue() {
  // TODO Phase 3
  throw new Error('runMonthlyAllowanceIfDue not yet implemented.');
}

/**
 * Preview the upcoming quarterly bonus for a child.
 * Returns: { daysUntil, bonusAgorot, nextBonusDate }
 * Phase 4: implement full logic.
 */
function getSavingsBonusPreview(payload) {
  // TODO Phase 4
  throw new Error('getSavingsBonusPreview not yet implemented.');
}

/**
 * Apply the quarterly savings bonus to a child's savings account.
 * Requires parent PIN.
 * bonus = floor(savings_balance_agorot × bonus_rate_pct / 100)
 * Phase 4: implement full logic.
 */
function applyQuarterlySavingsBonus(payload) {
  // TODO Phase 4
  throw new Error('applyQuarterlySavingsBonus not yet implemented.');
}
