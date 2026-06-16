// ─────────────────────────────────────────────────────────────
// Goals.gs — Savings goal management (Phase 4)
//
// Sheet tab: goals
// Schema:
//   goal_id | user_id | title | target_amount_agorot |
//   image_drive_id | status | sort_order |
//   created_at | completed_at | cancelled_at | notes
//
// Emoji is stored in the `notes` field as JSON:
//   {"emoji":"🎮"}
// In Phase 9, notes will also carry image metadata:
//   {"emoji":"🎮","imageId":"<drive_file_id>"}
// The `image_drive_id` column is reserved for Phase 9 and left blank here.
//
// Status values: active | completed | cancelled
//
// Goals are personal per child (user_id scoped).
// No parent PIN is required to create or view goals.
// Completing or cancelling a goal (future phases) will require parent approval.
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
    .map(r => ({
      goalId:       String(r['goal_id']),
      title:        String(r['title']),
      targetAgorot: Math.max(1, parseInt(r['target_amount_agorot'], 10) || 0),
      emoji:        _parseGoalEmoji(r['notes']),
      status:       String(r['status']),
      sortOrder:    parseInt(r['sort_order'], 10) || 0,
      createdAt:    String(r['created_at']),
    }))
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
 *   emoji?:       string,   — single emoji character; defaults to '🎯'
 * }} payload
 * @returns {{ ok: true, goalId: string }}
 */
function createGoal(payload) {
  const { userId, title, targetAgorot, emoji } = payload;
  if (!userId)           throw new Error('createGoal: userId נדרש.');
  if (!title || !title.trim()) throw new Error('createGoal: שם המטרה נדרש.');

  const target = parseInt(targetAgorot, 10);
  if (!target || target <= 0) throw new Error('createGoal: סכום יעד חייב להיות גדול מאפס.');

  // Validate user exists and is active
  const users = readTab('users');
  const user  = users.find(u => u['user_id'] === userId && u['active'] === true);
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Determine next sort_order
  const existing  = readTab('goals').filter(r => r['user_id'] === userId);
  const sortOrder = existing.length + 1;

  const goalId = makeId('goal');
  const now    = new Date().toISOString();

  // Encode emoji in notes as JSON so Phase 9 can extend it with {"emoji":"🎮","imageId":"..."}
  const notes = JSON.stringify({ emoji: emoji || '🎯' });

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

// ── Phase 5+ stubs ────────────────────────────────────────────
// These are pre-routed in Code.gs. Define them here so GAS does
// not throw a ReferenceError if they are accidentally called.

/**
 * Update goal title, target, or sort order.
 * Phase 5+: implement when goal editing UI is built.
 */
function updateGoal(payload) {
  throw new Error('updateGoal: לא מומש עדיין (Phase 5+).');
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
 * Parse the emoji stored in a goal's notes field.
 * Notes format: {"emoji":"🎮"} — may also contain other keys in Phase 9.
 * Falls back to '🎯' if missing or malformed.
 *
 * @param {string|*} notes
 * @returns {string}
 */
function _parseGoalEmoji(notes) {
  try {
    const parsed = JSON.parse(String(notes || '{}'));
    return (typeof parsed.emoji === 'string' && parsed.emoji.length > 0)
      ? parsed.emoji
      : '🎯';
  } catch (_) {
    return '🎯';
  }
}
