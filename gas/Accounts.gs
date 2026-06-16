// ─────────────────────────────────────────────────────────────
// Accounts.gs — Virtual account reads and balance helpers
//
// Sheet tab: accounts
// Schema (one row per child × account type):
//   account_id | user_id | account_type | balance_agorot | last_updated
//
// Account types: savings | giving | gifts | chores
//
// All monetary values are integer agorot. Balances ≥ 0.
//
// Public entry points:
//   getChildDashboard({ userId }) — returns all four balances in one call
//
// Internal helpers used by Allowance.gs and future action files:
//   _getAccountBalances(userId) → { savings, giving, gifts, chores }
//   _getAccountBalance(userId, accountType) → agorot (integer)
//   _addToAccountBalance(userId, accountType, deltaAgorot) → { before, after }
//   _setAccountBalance(userId, accountType, newBalanceAgorot) → { before, after }
// ─────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['savings', 'giving', 'gifts', 'chores'];

/**
 * Return all virtual account balances for a child in a single call.
 * This is the primary fetch for the child dashboard.
 *
 * @param {{ userId: string }} payload
 * @returns {{
 *   savings: { balanceAgorot: number },
 *   giving:  { balanceAgorot: number },
 *   gifts:   { balanceAgorot: number },
 *   chores:  { balanceAgorot: number },
 * }}
 */
function getChildDashboard(payload) {
  const { userId } = payload;
  if (!userId) throw new Error('getChildDashboard: userId נדרש.');

  // Validate user exists
  const users = readTab('users');
  const user  = users.find(u => u['user_id'] === userId && u['active'] === true);
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  const balances = _getAccountBalances(userId);

  return {
    savings: { balanceAgorot: balances.savings },
    giving:  { balanceAgorot: balances.giving  },
    gifts:   { balanceAgorot: balances.gifts   },
    chores:  { balanceAgorot: balances.chores  },
  };
}

// ── Internal helpers ──────────────────────────────────────────
// These are called by Allowance.gs, future action files, and
// possibly the parent dashboard. They share the same accounts tab.

/**
 * Read all four account balances for a child into a plain map.
 * Missing account rows default to 0 (setupSheets seeds them, but
 * defensive defaults protect against partial setups).
 *
 * @param {string} userId
 * @returns {{ savings: number, giving: number, gifts: number, chores: number }}
 */
function _getAccountBalances(userId) {
  const rows    = readTab('accounts');
  const result  = { savings: 0, giving: 0, gifts: 0, chores: 0 };

  rows
    .filter(r => r['user_id'] === userId)
    .forEach(r => {
      const type    = String(r['account_type']).trim();
      const balance = Math.max(0, parseInt(r['balance_agorot'], 10) || 0);
      if (type in result) result[type] = balance;
    });

  return result;
}

/**
 * Read the current balance for a single account.
 *
 * @param {string} userId
 * @param {string} accountType — 'savings' | 'giving' | 'gifts' | 'chores'
 * @returns {number} balance in agorot
 */
function _getAccountBalance(userId, accountType) {
  return _getAccountBalances(userId)[accountType] ?? 0;
}

/**
 * Add (or subtract) agorot to an account balance.
 * Throws if the result would go below 0.
 *
 * @param {string} userId
 * @param {string} accountType
 * @param {number} deltaAgorot — positive = credit, negative = debit
 * @returns {{ before: number, after: number }}
 */
function _addToAccountBalance(userId, accountType, deltaAgorot) {
  const before = _getAccountBalance(userId, accountType);
  const after  = before + deltaAgorot;

  if (after < 0) {
    throw new Error(
      'יתרה לא מספיקה ב' + accountType +
      ': יש ' + before + ' אג׳, מנסה להפחית ' + Math.abs(deltaAgorot) + ' אג׳.'
    );
  }

  _writeAccountBalance(userId, accountType, after);
  return { before, after };
}

/**
 * Overwrite an account balance with an absolute value.
 * Use only for corrections — prefer _addToAccountBalance for normal transactions.
 *
 * @param {string} userId
 * @param {string} accountType
 * @param {number} newBalanceAgorot — must be ≥ 0
 * @returns {{ before: number, after: number }}
 */
function _setAccountBalance(userId, accountType, newBalanceAgorot) {
  if (newBalanceAgorot < 0) throw new Error('_setAccountBalance: balance אינו יכול להיות שלילי.');
  const before = _getAccountBalance(userId, accountType);
  _writeAccountBalance(userId, accountType, newBalanceAgorot);
  return { before, after: newBalanceAgorot };
}

/**
 * Write a balance value to the accounts sheet (in-place update).
 * If the row doesn't exist, appends a new one defensively.
 *
 * @private
 */
function _writeAccountBalance(userId, accountType, newBalance) {
  const sheet   = getSheet('accounts');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const iUserId    = headers.indexOf('user_id');
  const iType      = headers.indexOf('account_type');
  const iBalance   = headers.indexOf('balance_agorot');
  const iUpdated   = headers.indexOf('last_updated');
  const iAccountId = headers.indexOf('account_id');

  if ([iUserId, iType, iBalance, iUpdated].some(i => i === -1)) {
    throw new Error(
      'accounts: חסרות עמודות חובה. ' +
      'ודא שהרצת setupSheets() ושהטאב קיים.'
    );
  }

  const now = new Date().toISOString();

  // Find existing row for (userId, accountType)
  let sheetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][iUserId] === userId && String(data[i][iType]).trim() === accountType) {
      sheetRow = i + 1; // 1-indexed
      break;
    }
  }

  if (sheetRow > 0) {
    sheet.getRange(sheetRow, iBalance + 1).setValue(newBalance);
    sheet.getRange(sheetRow, iUpdated + 1).setValue(now);
  } else {
    // Defensive: row missing (setupSheets seeds these, but append if needed)
    const newRow = new Array(headers.length).fill('');
    if (iAccountId >= 0) newRow[iAccountId] = userId + '_' + accountType;
    newRow[iUserId]  = userId;
    newRow[iType]    = accountType;
    newRow[iBalance] = newBalance;
    newRow[iUpdated] = now;
    sheet.appendRow(newRow);
  }
}

/**
 * Append a transaction row to the transactions tab.
 * Used by allowance, future giving/gifts/chores actions.
 *
 * @param {{
 *   userId:        string,
 *   fromAccount:   string,   — 'system' | 'savings' | 'giving' | 'wallet' | ...
 *   toAccount:     string,
 *   amountAgorot:  number,
 *   type:          string,   — 'allowance' | 'gift' | 'giving' | ...
 *   description:   string,
 *   initiatedBy:   string,   — 'system' | userId
 *   parentId?:     string,
 *   deviceId?:     string,
 *   notes?:        string,
 * }}
 */
function _appendTransaction(t) {
  appendRow('transactions', {
    tx_id:         makeId('tx'),
    timestamp:     new Date().toISOString(),
    user_id:       t.userId,
    from_account:  t.fromAccount,
    to_account:    t.toAccount,
    amount_agorot: t.amountAgorot,
    type:          t.type,
    description:   t.description  || '',
    initiated_by:  t.initiatedBy  || 'system',
    parent_id:     t.parentId     || '',
    device_id:     t.deviceId     || '',
    notes:         t.notes        || '',
  });
}
