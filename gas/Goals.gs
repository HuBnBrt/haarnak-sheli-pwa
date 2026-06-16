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
  // Future Phase 5 columns (referenced in commented section below):
  // const iTitle  = headers.indexOf('title');
  // const iTarget = headers.indexOf('target_amount_agorot');

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

  // ── Phase 5+: title and targetAgorot ─────────────────────────
  // Uncomment when Phase 5 goal editing UI is implemented.
  // if (payload.title !== undefined && iTitle >= 0) {
  //   const newTitle = String(payload.title).trim();
  //   if (newTitle) sheet.getRange(sheetRow, iTitle + 1).setValue(newTitle);
  // }
  // if (payload.targetAgorot !== undefined && iTarget >= 0) {
  //   const t = parseInt(payload.targetAgorot, 10);
  //   if (t > 0) sheet.getRange(sheetRow, iTarget + 1).setValue(t);
  // }

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
 * Mark a goal as completed after a purchase.
 * Phase 5: implement as part of the purchase helper flow.
 */
function completeGoal(payload) {
  throw new Error('completeGoal: לא מומש עדיין (Phase 5).');
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
