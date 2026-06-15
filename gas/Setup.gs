// ─────────────────────────────────────────────────────────────
// Setup.gs — One-time family Sheet setup
//
// Run this ONCE after creating your Google Sheet and setting
// SHEET_ID in Script Properties.
//
// What setupSheets() does:
//   1. Creates all required tabs with correct headers.
//   2. Seeds `settings` with configurable defaults.
//   3. Seeds `users` with placeholder identities.
//   4. Seeds `wallet_denominations` rows (count = 0) for each child.
//   5. Seeds `accounts` rows (balance = 0) for each child.
//   6. Seeds `chores` bank with default chores.
//   7. Installs a monthly GAS time trigger for runMonthlyAllowanceIfDue().
//
// All money values stored as integer agorot (1 ₪ = 100 agorot).
//
// After running:
//   - Replace placeholder display names in the `users` tab with real names.
//   - Set parent PINs via the parent dashboard (Phase 1).
//   - Deploy the GAS as a Web App and paste the URL into config.js.
// ─────────────────────────────────────────────────────────────

function setupSheets() {
  const ss = getSpreadsheet();
  Logger.log('Setting up הארנק שלי sheets in: ' + ss.getName());

  _createSettings(ss);
  _createUsers(ss);
  _createAccounts(ss);
  _createWalletDenominations(ss);
  _createTransactions(ss);
  _createGoals(ss);
  _createGoalImages(ss);
  _createChores(ss);
  _createChoreRequests(ss);
  _createNotifications(ss);
  _createSettlements(ss);
  _createAuditLog(ss);
  _createSkills(ss);
  _createResponsibilities(ss);

  _installMonthlyTrigger();

  Logger.log('✓ Setup complete. Edit placeholder names in the `users` tab before first use.');
}

// ── Helper: create or clear a tab ────────────────────────────
function _getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    Logger.log('Created tab: ' + name);
  }
  return sheet;
}

function _setHeaders(sheet, headers) {
  sheet.clearContents();
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
  range.setBackground('#E8F0FE');
  sheet.setFrozenRows(1);
}

// ─────────────────────────────────────────────────────────────
// 1. settings
// ─────────────────────────────────────────────────────────────
function _createSettings(ss) {
  const sheet = _getOrCreateSheet(ss, 'settings');
  _setHeaders(sheet, ['key', 'value', 'description']);

  const rows = [
    // Money values stored in agorot
    ['monthly_allowance_total_agorot', 2000,        'Monthly allowance per child in agorot (2000 = 20 ₪)'],
    ['savings_split_agorot',           1500,         'Monthly deposit to savings in agorot (1500 = 15 ₪)'],
    ['giving_split_agorot',             500,         'Monthly deposit to giving in agorot (500 = 5 ₪)'],
    // Bonus
    ['bonus_rate_pct',                   50,         'Quarterly savings bonus as % of current savings balance'],
    ['bonus_months',              '1,4,7,10',        'Calendar months when quarterly bonus is applied (Jan/Apr/Jul/Oct)'],
    ['bonus_day',                         1,         'Day of month when quarterly bonus is applied'],
    // Chores
    ['late_chore_reward_pct',            50,         'Reward % for chore completed late (before parent does it)'],
    ['missed_visibility_days',            7,         'Days a missed/parent-completed chore message stays visible'],
    // Gray money reminders
    ['gray_money_reminder_days',         14,         'Days after gray money is added before reminder fires'],
    ['gray_bonus_warning_days',           5,         'Days before quarterly bonus to warn about undistributed gray money'],
    // Redemption
    ['redemption_increment_agorot',    1000,         'Min increment for savings→wallet redemption in agorot (1000 = 10 ₪)'],
    // App
    ['app_name',                  'הארנק שלי',       'Application display name'],
  ];

  rows.forEach(row => sheet.appendRow(row));
  Logger.log('✓ settings');
}

// ─────────────────────────────────────────────────────────────
// 2. users  (placeholders — replace names privately in Sheet)
// ─────────────────────────────────────────────────────────────
function _createUsers(ss) {
  const sheet = _getOrCreateSheet(ss, 'users');
  _setHeaders(sheet, [
    'user_id', 'display_name', 'role_key', 'user_type', 'gender',
    'pin_hash', 'active', 'theme_palette', 'created_at'
  ]);

  const now = new Date().toISOString();
  const rows = [
    ['u_child1',  'ילד1',   'child1',  'child',  'm', '', true, 'ים וגיבור',   now],
    ['u_child2',  'ילדה1',  'child2',  'child',  'f', '', true, 'חלל סגול',    now],
    ['u_parent1', 'אבא1',   'parent1', 'parent', 'm', '', true, '',            now],
    ['u_parent2', 'אמא1',   'parent2', 'parent', 'f', '', true, '',            now],
  ];

  rows.forEach(row => sheet.appendRow(row));
  Logger.log('✓ users (placeholders — replace display_name values with real names)');
}

// ─────────────────────────────────────────────────────────────
// 3. accounts  (one row per child × account type)
// ─────────────────────────────────────────────────────────────
function _createAccounts(ss) {
  const sheet = _getOrCreateSheet(ss, 'accounts');
  _setHeaders(sheet, ['account_id', 'user_id', 'account_type', 'balance_agorot', 'last_updated']);

  const now   = new Date().toISOString();
  const types = ['savings', 'giving', 'gifts', 'chores'];
  const child_ids = ['u_child1', 'u_child2'];

  child_ids.forEach(uid => {
    types.forEach(type => {
      sheet.appendRow([
        uid + '_' + type,
        uid,
        type,
        0,
        now,
      ]);
    });
  });

  Logger.log('✓ accounts');
}

// ─────────────────────────────────────────────────────────────
// 4. wallet_denominations  (one row per child × denomination)
//    Denominations in agorot — no decimal values.
// ─────────────────────────────────────────────────────────────
function _createWalletDenominations(ss) {
  const sheet = _getOrCreateSheet(ss, 'wallet_denominations');
  _setHeaders(sheet, ['user_id', 'denomination_agorot', 'count', 'last_updated']);

  const now   = new Date().toISOString();
  // All denominations in agorot, largest first
  const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 10];
  const child_ids = ['u_child1', 'u_child2'];

  child_ids.forEach(uid => {
    DENOMS.forEach(denom => {
      sheet.appendRow([uid, denom, 0, now]);
    });
  });

  Logger.log('✓ wallet_denominations');
}

// ─────────────────────────────────────────────────────────────
// 5. transactions
// ─────────────────────────────────────────────────────────────
function _createTransactions(ss) {
  const sheet = _getOrCreateSheet(ss, 'transactions');
  _setHeaders(sheet, [
    'tx_id', 'timestamp', 'user_id', 'from_account', 'to_account',
    'amount_agorot', 'type', 'description', 'initiated_by',
    'parent_id', 'device_id', 'notes'
  ]);
  // No seed data — populated by financial actions
  Logger.log('✓ transactions');
}

// ─────────────────────────────────────────────────────────────
// 6. goals
// ─────────────────────────────────────────────────────────────
function _createGoals(ss) {
  const sheet = _getOrCreateSheet(ss, 'goals');
  _setHeaders(sheet, [
    'goal_id', 'user_id', 'title', 'target_amount_agorot',
    'image_drive_id', 'status', 'sort_order',
    'created_at', 'completed_at', 'cancelled_at', 'notes'
  ]);
  Logger.log('✓ goals');
}

// ─────────────────────────────────────────────────────────────
// 7. goal_images  (Phase 9 — schema ready, no data yet)
// ─────────────────────────────────────────────────────────────
function _createGoalImages(ss) {
  const sheet = _getOrCreateSheet(ss, 'goal_images');
  _setHeaders(sheet, [
    'image_id', 'goal_id', 'user_id', 'drive_file_id',
    'drive_folder_id', 'status', 'uploaded_at', 'archived_at'
  ]);
  Logger.log('✓ goal_images (Phase 9 schema ready)');
}

// ─────────────────────────────────────────────────────────────
// 8. chores  (default chore bank — fully editable in Sheet)
//    All reward amounts in agorot.
// ─────────────────────────────────────────────────────────────
function _createChores(ss) {
  const sheet = _getOrCreateSheet(ss, 'chores');
  _setHeaders(sheet, [
    'chore_id', 'title', 'suggested_reward_agorot',
    'time_limit_value', 'time_limit_unit', 'late_reward_pct',
    'category', 'active', 'created_at'
  ]);

  const now = new Date().toISOString();

  // [id, title_he, reward_agorot, time_value, time_unit, late_pct, category]
  const CHORES = [
    // 100 agorot = 1 ₪
    ['ch_01', 'סידור נעליים בכניסה',            100, 24, 'hours', 50, 'light'],
    ['ch_02', 'איסוף כביסה לסל',                100, 24, 'hours', 50, 'light'],
    ['ch_03', 'ריקון פח קטן',                   100, 24, 'hours', 50, 'light'],
    ['ch_04', 'השקיית עציץ אחד לפי הוראה',      100, 24, 'hours', 50, 'light'],
    ['ch_05', 'מיון טושים יבשים',               100, 24, 'hours', 50, 'light'],
    // 200 agorot = 2 ₪
    ['ch_06', 'ניקוי אבק מדף קטן',              200, 24, 'hours', 50, 'light'],
    ['ch_07', 'קיפול מגבות קטנות',              200, 24, 'hours', 50, 'light'],
    ['ch_08', 'מיון גרביים',                    200, 24, 'hours', 50, 'light'],
    ['ch_09', 'פינוי שולחן אחרי ארוחה',         200, 24, 'hours', 50, 'light'],
    ['ch_10', 'סידור אזור משחקים משפחתי',       200, 24, 'hours', 50, 'light'],
    // 300 agorot = 3 ₪
    ['ch_11', 'סידור מדיח חלקי',                300, 24, 'hours', 50, 'medium'],
    ['ch_12', 'ניקוי אבק אזור מלא',             300, 24, 'hours', 50, 'medium'],
    ['ch_13', 'טאטוא אזור קטן',                 300, 24, 'hours', 50, 'medium'],
    ['ch_14', 'הכנסת קניות קלות למקום',         300, 24, 'hours', 50, 'medium'],
    ['ch_15', 'קיפול מגבות מלא',                300, 24, 'hours', 50, 'medium'],
    // 400–500 agorot = 4–5 ₪
    ['ch_16', 'טאטוא ואיסוף לליעה',             400, 48, 'hours', 50, 'medium'],
    ['ch_17', 'סידור מדיח מלא',                 400, 48, 'hours', 50, 'medium'],
    ['ch_18', 'ניקוי שולחן אוכל וכיסאות',       400, 48, 'hours', 50, 'medium'],
    ['ch_19', 'סידור סלון לפני שבת או אורחים',  500, 48, 'hours', 50, 'medium'],
    ['ch_20', 'ניקוי אבק יסודי באזור גדול',     500, 48, 'hours', 50, 'medium'],
    // 600–800 agorot = 6–8 ₪
    ['ch_21', 'פרויקט סידור מגירה',             600, 72, 'hours', 50, 'heavy'],
    ['ch_22', 'מיון בקבוקים למחזור',            600, 72, 'hours', 50, 'heavy'],
    ['ch_23', 'עזרה משמעותית בקניות',           700, 72, 'hours', 50, 'heavy'],
    ['ch_24', 'ניקוי מקלחון או אמבטיה קלה',    700, 72, 'hours', 50, 'heavy'],
    ['ch_25', 'סידור אזור גדול בבית',           800, 72, 'hours', 50, 'heavy'],
  ];

  CHORES.forEach(([id, title, reward, timeVal, timeUnit, latePct, cat]) => {
    sheet.appendRow([id, title, reward, timeVal, timeUnit, latePct, cat, true, now]);
  });

  Logger.log('✓ chores (' + CHORES.length + ' default chores seeded)');
}

// ─────────────────────────────────────────────────────────────
// 9. chore_requests
// ─────────────────────────────────────────────────────────────
function _createChoreRequests(ss) {
  const sheet = _getOrCreateSheet(ss, 'chore_requests');
  _setHeaders(sheet, [
    'request_id', 'chore_id', 'user_id', 'chore_title',
    'reward_amount_agorot', 'requested_by', 'requested_at', 'deadline_at',
    'acknowledged_at', 'completed_at', 'completed_by', 'status', 'notes'
  ]);
  // Status values: pending | acknowledged | completed_on_time | completed_late | missed | parent_completed
  Logger.log('✓ chore_requests');
}

// ─────────────────────────────────────────────────────────────
// 10. notifications
// ─────────────────────────────────────────────────────────────
function _createNotifications(ss) {
  const sheet = _getOrCreateSheet(ss, 'notifications');
  _setHeaders(sheet, [
    'notif_id', 'user_id', 'type', 'title', 'body',
    'status', 'created_at', 'read_at', 'expires_at',
    'related_id', 'related_type'
  ]);
  // Status values: unread | read | active | expired | archived
  Logger.log('✓ notifications');
}

// ─────────────────────────────────────────────────────────────
// 11. settlements
// ─────────────────────────────────────────────────────────────
function _createSettlements(ss) {
  const sheet = _getOrCreateSheet(ss, 'settlements');
  _setHeaders(sheet, [
    'settlement_id', 'user_id', 'total_amount_agorot', 'type',
    'parent_id', 'created_at', 'settled_amount_agorot',
    'settled_at', 'status', 'notes'
  ]);
  // Type values: parent_payment | giving_advance
  // Status values: pending | partial | settled
  Logger.log('✓ settlements');
}

// ─────────────────────────────────────────────────────────────
// 12. audit_log
// ─────────────────────────────────────────────────────────────
function _createAuditLog(ss) {
  const sheet = _getOrCreateSheet(ss, 'audit_log');
  _setHeaders(sheet, [
    'log_id', 'timestamp', 'acting_user_id', 'child_user_id',
    'action_type', 'account_affected',
    'amount_before_agorot', 'amount_after_agorot', 'amount_delta_agorot',
    'notes', 'device_id', 'source'
  ]);
  // Source values: child | parent | system
  // RULE: never delete rows. Add correction rows instead.
  Logger.log('✓ audit_log');
}

// ─────────────────────────────────────────────────────────────
// 13 & 14. skills, responsibilities  (future — empty tabs)
// ─────────────────────────────────────────────────────────────
function _createSkills(ss) {
  const sheet = _getOrCreateSheet(ss, 'skills');
  // Headers TBD when skills feature is designed
  sheet.getRange(1, 1).setValue('# Future tab — headers TBD');
  Logger.log('✓ skills (future tab, empty)');
}

function _createResponsibilities(ss) {
  const sheet = _getOrCreateSheet(ss, 'responsibilities');
  sheet.getRange(1, 1).setValue('# Future tab — headers TBD');
  Logger.log('✓ responsibilities (future tab, empty)');
}

// ─────────────────────────────────────────────────────────────
// Monthly time trigger for allowance
// ─────────────────────────────────────────────────────────────
function _installMonthlyTrigger() {
  // Remove any existing triggers for runMonthlyAllowanceIfDue to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runMonthlyAllowanceIfDue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Run on the 1st of every month at 06:00 Jerusalem time
  ScriptApp.newTrigger('runMonthlyAllowanceIfDue')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();

  Logger.log('✓ Monthly trigger installed: runMonthlyAllowanceIfDue on day 1 at 06:00');
}

// ─────────────────────────────────────────────────────────────
// Utility: remove all tabs EXCEPT the ones this app needs.
// Useful for cleaning up a Sheet that has leftover default tabs.
// Run manually from GAS editor if needed.
// ─────────────────────────────────────────────────────────────
function removeDefaultSheets() {
  const ss        = getSpreadsheet();
  const keepNames = [
    'settings', 'users', 'accounts', 'wallet_denominations',
    'transactions', 'goals', 'goal_images', 'chores', 'chore_requests',
    'notifications', 'settlements', 'audit_log', 'skills', 'responsibilities'
  ];
  ss.getSheets().forEach(sheet => {
    if (!keepNames.includes(sheet.getName())) {
      // Can't delete last sheet — skip silently
      if (ss.getSheets().length > 1) ss.deleteSheet(sheet);
    }
  });
  Logger.log('Removed non-app sheets.');
}
