// ─────────────────────────────────────────────────────────────
// AuditLog.gs — Append-only financial audit log
//
// RULE: Never delete or overwrite audit_log rows.
//       Corrections are new rows with type 'correction'.
//
// Called by every handler that mutates money or account state.
// ─────────────────────────────────────────────────────────────

/**
 * Append one entry to the audit_log tab.
 *
 * @param {Object} entry
 * @param {string} entry.actingUserId      - Parent or system user who performed the action
 * @param {string} entry.childUserId       - Child whose account was affected (may equal actingUserId for parent accounts)
 * @param {string} entry.actionType        - e.g., 'allowance', 'bonus', 'purchase', 'chore_reward', 'correction'
 * @param {string} entry.accountAffected   - e.g., 'savings', 'giving', 'gifts', 'chores', 'wallet'
 * @param {number} entry.amountBeforeAgorot
 * @param {number} entry.amountAfterAgorot
 * @param {string} [entry.notes]
 * @param {string} [entry.deviceId]
 * @param {string} [entry.source]          - 'child' | 'parent' | 'system'
 */
function appendAuditLog(entry) {
  const now   = new Date();
  const delta = (entry.amountAfterAgorot - entry.amountBeforeAgorot);

  appendRow('audit_log', {
    'log_id':               makeId('log'),
    'timestamp':            now.toISOString(),
    'acting_user_id':       entry.actingUserId      || '',
    'child_user_id':        entry.childUserId        || '',
    'action_type':          entry.actionType         || '',
    'account_affected':     entry.accountAffected    || '',
    'amount_before_agorot': entry.amountBeforeAgorot != null ? entry.amountBeforeAgorot : '',
    'amount_after_agorot':  entry.amountAfterAgorot  != null ? entry.amountAfterAgorot  : '',
    'amount_delta_agorot':  delta,
    'notes':                entry.notes              || '',
    'device_id':            entry.deviceId           || '',
    'source':               entry.source             || 'system',
  });
}
