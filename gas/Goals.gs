// ─────────────────────────────────────────────────────────────
// Goals.gs — Savings goal management (Phase 4)
//
// Sheet tab: goals
// Schema:
//   goal_id | user_id | title | target_amount_agorot |
//   image_drive_id | status | sort_order |
//   created_at | completed_at | cancelled_at | notes
//
// Notes field stores metadata as JSON:
//   Phase 4: {"emoji":"🎮","store":"טויס אר אס"}
//   Phase 9: {"emoji":"🎮","store":"טויס אר אס","imageId":"<drive_file_id>"}
// The `image_drive_id` column is reserved for Phase 9 and left blank here.
//
// Status values: active | completed | cancelled
//
// Goals are personal per child (user_id scoped).
// No parent PIN required to create, view, or update icon/store.
// Completing or cancelling a goal (Phase 5+) will require parent approval.
// ─────────────────────────────────────────────────────────────

/**
 * Return all active goals for a child, sorted by sort_order ascending.
 *
 * @param {{ userId: string }} payload
 * @returns {Array<{
 *   goalId:        string,
 *   title:         string,
 *   targetAgorot:  number,
 *   emoji:         string,
 *   store:         string,   — optional, e.g. "טויס אר אס"
 *   status:        string,
 *   sortOrder:     number,
 *   createdAt:     string,
 * }>}
 */
function getGoals(payload) {
  const { userId } = payload;
  if (!userId) throw new Error('getGoals: userId נדרש.');

  const rows = readTab('goals');

  return rows
    .filter(r => r['user_id'] === userId && r['status'] === 'active')
    .map(r => {
      const meta = _parseGoalNotes(r['notes']);
      return {
        goalId:       String(r['goal_id']),
        title:        String(r['title']),
        targetAgorot: Math.max(1, parseInt(r['target_amount_agorot'], 10) || 0),
        emoji:        meta.emoji || '🎯',
        store:        meta.store || '',
        status:       String(r['status']),
        sortOrder:    parseInt(r['sort_order'], 10) || 0,
        createdAt:    String(r['created_at']),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Create a new savings goal for a child.
 * No parent PIN required — this is the child's primary savings planning action.
 *
 * @param {{
 *   userId:       string,
 *   title:        string,
 *   targetAgorot: number,   — must be > 0
 *   emoji?:       string,   — single emoji; defaults to '🎯'
 *   store?:       string,   — optional store/location memo
 * }} payload
 * @returns {{ ok: true, goalId: string }}
 */
function createGoal(payload) {
  const { userId, title, targetAgorot, emoji, store } = payload;
  if (!userId)                  throw new Error('createGoal: userId נדרש.');
  if (!title || !title.trim())  throw new Error('createGoal: שם המטרה נדרש.');

  const target = parseInt(targetAgorot, 10);
  if (!target || target <= 0)  throw new Error('createGoal: סכום יעד חייב להיות גדול מאפס.');

  // Validate user exists and is active
  const users = readTab('users');
  const user  = users.find(u => u['user_id'] === userId && u['active'] === true);
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Determine next sort_order
  const existing  = readTab('goals').filter(r => r['user_id'] === userId);
  const sortOrder = existing.length + 1;

  const goalId = makeId('goal');
  const now    = new Date().toISOString();

  // Store emoji + store in notes JSON (extensible for Phase 9)
  const notes = JSON.stringify({
    emoji: emoji || '🎯',
    store: (store || '').trim(),
  });

  appendRow('goals', {
    goal_id:              goalId,
    user_id:              userId,
    title:                title.trim(),
    target_amount_agorot: target,
    image_drive_id:       '',        // Phase 9: Drive file ID goes here
    status:               'active',
    sort_order:           sortOrder,
    created_at:           now,
    completed_at:         '',
    cancelled_at:         '',
    notes:                notes,
  });

  appendAuditLog({
    actingUserId:       userId,
    childUserId:        userId,
    actionType:         'goal_created',
    accountAffected:    'savings',
    amountBeforeAgorot: 0,
    amountAfterAgorot:  target,
    notes:              'goal_id=' + goalId + ' title=' + title.trim(),
    source:             'child',
  });

  return { ok: true, goalId };
}

/**
 * Update fields on an existing active goal.
 *
 * Phase 4 supports: emoji, store (both stored in the notes JSON field).
 * Phase 5+: title and targetAgorot editing (commented out below — uncomment when UI is ready).
 *
 * No parent PIN required for icon/store changes.
 * Title/target changes (Phase 5) may require parent approval — decide then.
 *
 * @param {{
 *   userId:        string,
 *   goalId:        string,
 *   emoji?:        string,
 *   store?:        string,
 * }} payload
 * @returns {{ ok: true }}
 */
function updateGoal(payload) {
  const { userId, goalId } = payload;
  if (!userId) throw new Error('updateGoal: userId נדרש.');
  if (!goalId) throw new Error('updateGoal: goalId נדרש.');

  const sheet   = getSheet('goals');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const iGoalId = headers.indexOf('goal_id');
  const iUserId = headers.indexOf('user_id');
  const iNotes  = headers.indexOf('notes');
  // Phase 6: targetAgorot column (used for price edits from goals-display)
  const iTarget = headers.indexOf('target_amount_agorot');

  if ([iGoalId, iUserId].some(i => i === -1)) {
    throw new Error('goals: חסרות עמודות חובה. ודא שהרצת setupSheets().');
  }

  // Find the goal row for this user
  let sheetRow = -1;
  let rowData  = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iGoalId]) === String(goalId) &&
        String(data[i][iUserId]) === String(userId)) {
      sheetRow = i + 1; // 1-indexed
      rowData  = data[i];
      break;
    }
  }

  if (sheetRow < 0) throw new Error('מטרה לא נמצאה.');

  // ── Update notes (emoji and/or store) ─────────────────────────
  // Both are stored in the notes JSON field.
  if (payload.emoji !== undefined || payload.store !== undefined) {
    if (iNotes < 0) throw new Error('goals: עמודת notes חסרה.');

    const existing = String(rowData[iNotes] || '{}');
    const meta     = _parseGoalNotes(existing);

    if (payload.emoji !== undefined) meta.emoji = payload.emoji;
    if (payload.store !== undefined) meta.store = (payload.store || '').trim();

    sheet.getRange(sheetRow, iNotes + 1).setValue(JSON.stringify(meta));
  }

  // ── Phase 6: targetAgorot price update ───────────────────────
  if (payload.targetAgorot !== undefined && iTarget >= 0) {
    const t = parseInt(payload.targetAgorot, 10);
    if (t > 0) sheet.getRange(sheetRow, iTarget + 1).setValue(t);
  }

  appendAuditLog({
    actingUserId:       userId,
    childUserId:        userId,
    actionType:         'goal_updated',
    accountAffected:    'savings',
    amountBeforeAgorot: 0,
    amountAfterAgorot:  0,
    notes:              'goal_id=' + goalId + ' fields=' + Object.keys(payload).filter(k => k !== 'userId' && k !== 'goalId').join(','),
    source:             'child',
  });

  return { ok: true };
}

/**
 * Cancel an active goal (requires parent approval).
 * Phase 5+: implement with parent PIN verification.
 */
function cancelGoal(payload) {
  throw new Error('cancelGoal: לא מומש עדיין (Phase 5+).');
}

/**
 * Mark a goal as completed and deduct the purchase price from the savings account.
 * Called when the child confirms a goal purchase in the purchase helper (Phase 5.2).
 *
 * The actual purchase price may differ from the saved target price
 * (e.g. if the store price changed). Both values are recorded.
 *
 * @param {{
 *   userId:            string,
 *   goalId:            string,
 *   actualPriceAgorot: number,  — actual price paid (may differ from target)
 * }} payload
 * @returns {{ ok: true, newSavingsAgorot: number }}
 */
function completeGoal(payload) {
  var userId               = payload.userId;
  var goalId               = payload.goalId;
  var priceInput           = payload.actualPriceAgorot;
  // When true: physical wallet payment was already recorded by recordPurchase.
  // Skip savings deduction — savings reconciliation is handled separately
  // (e.g. via redeemSavingsToWallet, which is a separate parent action).
  var skipSavingsDeduction = payload.skipSavingsDeduction === true;

  if (!userId)     throw new Error('completeGoal: userId נדרש.');
  if (!goalId)     throw new Error('completeGoal: goalId נדרש.');
  if (!priceInput) throw new Error('completeGoal: actualPriceAgorot נדרש.');

  var actualPrice = Math.round(Number(priceInput));
  if (!actualPrice || actualPrice <= 0) throw new Error('completeGoal: מחיר חוקי נדרש (גדול מ-0).');

  // Validate user
  var users = readTab('users');
  var user  = users.filter(function(u) {
    return u['user_id'] === userId && u['active'] === true;
  })[0];
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Find goal row in the goals sheet
  var sheet   = getSheet('goals');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });

  var iGoalId      = headers.indexOf('goal_id');
  var iUserId      = headers.indexOf('user_id');
  var iTitle       = headers.indexOf('title');
  var iTarget      = headers.indexOf('target_amount_agorot');
  var iStatus      = headers.indexOf('status');
  var iCompletedAt = headers.indexOf('completed_at');
  var iNotes       = headers.indexOf('notes');

  var sheetRow = -1;
  var rowData  = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iGoalId]) === String(goalId) &&
        String(data[i][iUserId]) === String(userId)) {
      sheetRow = i + 1; // 1-indexed
      rowData  = data[i];
      break;
    }
  }

  if (sheetRow < 0) throw new Error('מטרה לא נמצאה.');
  if (String(rowData[iStatus]) !== 'active') throw new Error('המטרה כבר לא פעילה (אולי כבר נקנתה?).');

  var goalTitle    = String(rowData[iTitle]);
  var targetAgorot = Math.max(1, parseInt(rowData[iTarget], 10) || 0);

  // ── Financial side ───────────────────────────────────────────
  var balResult;
  if (!skipSavingsDeduction) {
    // Standard virtual path: deduct from savings account (savings → external).
    // Used when the goal is paid directly from savings without going through
    // the physical wallet (future flow, or savings-only purchases).
    var savingsBefore = _getAccountBalance(userId, 'savings');
    if (savingsBefore < actualPrice) {
      var missingAgorot = actualPrice - savingsBefore;
      throw new Error(
        'יתרת החיסכון (' + (savingsBefore / 100).toFixed(2) + '₪) ' +
        'אינה מספיקה לקנייה (' + (actualPrice / 100).toFixed(2) + '₪). ' +
        'חסרים ' + (missingAgorot / 100).toFixed(2) + '₪.'
      );
    }
    balResult = _addToAccountBalance(userId, 'savings', -actualPrice);
    _appendTransaction({
      userId:       userId,
      fromAccount:  'savings',
      toAccount:    'external',
      amountAgorot: actualPrice,
      type:         'goal_purchase',
      description:  goalTitle,
      initiatedBy:  'child',
      notes:        JSON.stringify({ goalId: goalId, targetAgorot: targetAgorot }),
    });
  } else {
    // Wallet-purchase path: recordPurchase already recorded the financial
    // transaction (physical_wallet → external). Savings balance is not
    // touched here — reconciliation via redeemSavingsToWallet is separate.
    var currentSavings = _getAccountBalance(userId, 'savings');
    balResult = { before: currentSavings, after: currentSavings };
  }

  // ── Mark goal completed ──────────────────────────────────────
  var now = new Date().toISOString();
  sheet.getRange(sheetRow, iStatus + 1).setValue('completed');
  if (iCompletedAt >= 0) sheet.getRange(sheetRow, iCompletedAt + 1).setValue(now);

  // Update notes JSON with actual purchase price and completion timestamp
  if (iNotes >= 0) {
    var meta = _parseGoalNotes(String(rowData[iNotes] || '{}'));
    meta.actualPriceAgorot    = actualPrice;
    meta.completedAt          = now;
    meta.walletPurchase       = skipSavingsDeduction; // true = paid from physical wallet
    sheet.getRange(sheetRow, iNotes + 1).setValue(JSON.stringify(meta));
  }

  appendAuditLog({
    actingUserId:       userId,
    childUserId:        userId,
    actionType:         'goal_purchased',
    accountAffected:    skipSavingsDeduction ? 'wallet' : 'savings',
    amountBeforeAgorot: balResult.before,
    amountAfterAgorot:  balResult.after,
    notes:              'goal_id=' + goalId + ' title=' + goalTitle +
                        ' target=' + targetAgorot + ' actual_price=' + actualPrice +
                        (skipSavingsDeduction ? ' source=wallet' : ' source=savings'),
    source:             'child',
  });

  return { ok: true, newSavingsAgorot: balResult.after };
}

/**
 * Return active goals + account balances for the purchase helper's Step 0 screen.
 * "Purchasable" goals are those where the child's current savings balance covers
 * the goal's target price (savingsAgorot >= goal.targetAgorot).
 *
 * Savings is a shared balance across all goals; purchasing one goal reduces
 * what is available for others. The frontend must re-check affordability
 * as the user builds a multi-goal cart.
 *
 * @param {{ userId: string }} payload
 * @returns {{
 *   savingsAgorot:    number,
 *   walletTotalAgorot: number,
 *   goals:            Array,   — all active goals
 *   purchasableGoals: Array,   — active goals where savings >= target
 * }}
 */
function getPurchasableGoals(payload) {
  var userId = payload.userId;
  if (!userId) throw new Error('getPurchasableGoals: userId נדרש.');

  var users = readTab('users');
  var user  = users.filter(function(u) {
    return u['user_id'] === userId && u['active'] === true;
  })[0];
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  var savingsAgorot     = _getAccountBalance(userId, 'savings');
  var walletTotalAgorot = _getWalletTotal(userId);
  var goals             = getGoals({ userId: userId });

  var purchasableGoals = goals.filter(function(g) {
    // Purchasable = physical wallet has enough cash right now.
    // Savings balance is irrelevant here; the child pays from the wallet.
    return g.targetAgorot > 0 && walletTotalAgorot >= g.targetAgorot;
  });

  return {
    savingsAgorot:     savingsAgorot,
    walletTotalAgorot: walletTotalAgorot,
    goals:             goals,
    purchasableGoals:  purchasableGoals,
  };
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Parse goal metadata from the notes JSON field.
 * Returns { emoji, store } with safe defaults.
 * In Phase 9, imageId will also be present.
 *
 * @param {string|*} notes
 * @returns {{ emoji: string, store: string }}
 */
function _parseGoalNotes(notes) {
  try {
    const parsed = JSON.parse(String(notes || '{}'));
    return {
      emoji: (typeof parsed.emoji === 'string' && parsed.emoji.length > 0)
        ? parsed.emoji : '🎯',
      store: typeof parsed.store === 'string' ? parsed.store : '',
    };
  } catch (_) {
    return { emoji: '🎯', store: '' };
  }
}
