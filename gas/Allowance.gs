// ─────────────────────────────────────────────────────────────
// Allowance.gs — Monthly allowance and quarterly bonus
//
// ── Monthly allowance (Phase 3) ──────────────────────────────
// Called by the GAS time trigger installed in setupSheets() on
// the 1st of every month, and optionally by the parent dashboard.
//
// Idempotent: checks the transactions tab before writing.
// If this month's allowance already exists for a child, it is
// skipped silently. Running this multiple times in the same month
// will only pay out once per child.
//
// Default split (all amounts configurable in `settings` tab):
//   savings_split_agorot = 1500  (15 ₪)
//   giving_split_agorot  =  500  (5 ₪)
//   Physical wallet: 0 — no automatic cash is ever added.
//
// ── Quarterly bonus (Phase 4) ────────────────────────────────
// getSavingsBonusPreview and applyQuarterlySavingsBonus are
// stubs — implemented in Phase 4.
// ─────────────────────────────────────────────────────────────

/**
 * Run the monthly allowance for all active children if it hasn't
 * already been run this calendar month.
 *
 * Called by:
 *   - GAS time-based trigger (installed by setupSheets())
 *   - Parent dashboard manual trigger (fallback / testing)
 *
 * Returns:
 *   {
 *     processed:  ['u_child1', ...],  — received allowance now
 *     alreadyDone: ['u_child2', ...], — already had it this month
 *   }
 */
function runMonthlyAllowanceIfDue() {
  const savingsAgorot = parseInt(getSetting('savings_split_agorot'), 10) || 1500;
  const givingAgorot  = parseInt(getSetting('giving_split_agorot'),  10) || 500;

  // All active children
  const users    = readTab('users');
  const children = users.filter(u => u['user_type'] === 'child' && u['active'] === true);

  if (children.length === 0) {
    return { processed: [], alreadyDone: [], message: 'No active children found.' };
  }

  // Determine current year-month for idempotency check ("2026-06")
  const now       = new Date();
  const yearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // Read all transactions once (cheaper than per-child lookups)
  const allTx = readTab('transactions');

  const processed   = [];
  const alreadyDone = [];

  children.forEach(child => {
    const userId = child['user_id'];

    // Idempotency: has this child already received an allowance this month?
    const alreadyPaid = allTx.some(tx =>
      tx['user_id'] === userId &&
      tx['type']    === 'allowance' &&
      String(tx['timestamp']).startsWith(yearMonth)
    );

    if (alreadyPaid) {
      alreadyDone.push(userId);
      return;
    }

    // ── Credit savings ────────────────────────────────────────
    const savingsBefore = _addToAccountBalance(userId, 'savings', savingsAgorot);
    _appendTransaction({
      userId,
      fromAccount:  'system',
      toAccount:    'savings',
      amountAgorot: savingsAgorot,
      type:         'allowance',
      description:  'דמי כיס חודשיים — חיסכון',
      initiatedBy:  'system',
      notes:        'yearMonth=' + yearMonth,
    });
    appendAuditLog({
      actingUserId:       'system',
      childUserId:        userId,
      actionType:         'allowance_savings',
      accountAffected:    'savings',
      amountBeforeAgorot: savingsBefore.before,
      amountAfterAgorot:  savingsBefore.after,
      source:             'system',
      notes:              'monthly allowance ' + yearMonth,
    });

    // ── Credit giving ─────────────────────────────────────────
    const givingBefore = _addToAccountBalance(userId, 'giving', givingAgorot);
    _appendTransaction({
      userId,
      fromAccount:  'system',
      toAccount:    'giving',
      amountAgorot: givingAgorot,
      type:         'allowance',
      description:  'דמי כיס חודשיים — נתינה',
      initiatedBy:  'system',
      notes:        'yearMonth=' + yearMonth,
    });
    appendAuditLog({
      actingUserId:       'system',
      childUserId:        userId,
      actionType:         'allowance_giving',
      accountAffected:    'giving',
      amountBeforeAgorot: givingBefore.before,
      amountAfterAgorot:  givingBefore.after,
      source:             'system',
      notes:              'monthly allowance ' + yearMonth,
    });

    processed.push(userId);
  });

  return { processed, alreadyDone };
}

/**
 * Preview the upcoming quarterly savings bonus for a child.
 * Returns: { daysUntil, bonusAgorot, nextBonusDate }
 *
 * Phase 4: implement full logic.
 */
function getSavingsBonusPreview(payload) {
  // TODO Phase 4
  throw new Error('getSavingsBonusPreview: לא מומש עדיין (Phase 4).');
}

/**
 * Apply the quarterly savings bonus to a child's savings account.
 * Requires parent PIN verification (done by the caller in Code.gs).
 * bonus = floor(savings_balance_agorot × bonus_rate_pct / 100)
 *
 * Phase 4: implement full logic.
 */
function applyQuarterlySavingsBonus(payload) {
  // TODO Phase 4
  throw new Error('applyQuarterlySavingsBonus: לא מומש עדיין (Phase 4).');
}
