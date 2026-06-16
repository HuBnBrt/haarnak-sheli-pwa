// ─────────────────────────────────────────────────────────────
// Wallet.gs — Physical wallet denomination management (Phase 2)
//
// Sheet tab: wallet_denominations
// Schema (one row per user × denomination):
//   user_id | denomination_agorot | count | last_updated
//
// All monetary values are integer agorot. Counts ≥ 0.
// ─────────────────────────────────────────────────────────────

// Canonical denomination list in agorot, largest → smallest.
// Must match the DENOMINATIONS constant in currency.js.
const WALLET_DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 10];

/**
 * Read the physical wallet contents for a child.
 *
 * @param {{ userId: string }} payload
 * @returns {{
 *   counts: { [denominationAgorot: number]: number },
 *   totalAgorot: number
 * }}
 */
function getWalletDenominations(payload) {
  const { userId } = payload;
  if (!userId) throw new Error('getWalletDenominations: userId נדרש.');

  const rows = readTab('wallet_denominations');

  // Build count map — default every denomination to 0
  const counts = {};
  WALLET_DENOMS.forEach(d => { counts[d] = 0; });

  rows
    .filter(r => r['user_id'] === userId)
    .forEach(r => {
      const denom = parseInt(r['denomination_agorot'], 10);
      const count = Math.max(0, parseInt(r['count'], 10) || 0);
      if (WALLET_DENOMS.includes(denom)) counts[denom] = count;
    });

  let totalAgorot = 0;
  WALLET_DENOMS.forEach(d => { totalAgorot += counts[d] * d; });

  return { counts, totalAgorot };
}

/**
 * Overwrite the physical wallet contents for a child (parent action).
 * Replaces ALL denomination counts; omitted denominations are set to 0.
 *
 * @param {{
 *   userId:   string,
 *   parentId: string,
 *   counts:   { [denominationAgorot: string|number]: number }
 * }} payload
 * @returns {{ ok: true, totalAgorot: number }}
 */
function updatePhysicalWallet(payload) {
  const { userId, parentId, counts } = payload;
  if (!userId)  throw new Error('updatePhysicalWallet: userId נדרש.');
  if (!parentId) throw new Error('updatePhysicalWallet: parentId נדרש.');
  if (!counts || typeof counts !== 'object') throw new Error('updatePhysicalWallet: counts נדרש.');

  // Verify parentId is an active parent
  const users  = readTab('users');
  const parent = users.find(
    u => u['user_id'] === parentId && u['user_type'] === 'parent' && u['active'] === true
  );
  if (!parent) throw new Error('הורה מאשר לא נמצא או אינו פעיל.');

  const sheet   = getSheet('wallet_denominations');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const iUserId  = headers.indexOf('user_id');
  const iDenom   = headers.indexOf('denomination_agorot');
  const iCount   = headers.indexOf('count');
  const iUpdated = headers.indexOf('last_updated');

  if ([iUserId, iDenom, iCount, iUpdated].some(i => i === -1)) {
    throw new Error(
      'wallet_denominations: חסרות עמודות חובה. ' +
      'ודא שהרצת setupSheets() ושהטאב קיים.'
    );
  }

  const now = new Date().toISOString();

  // Calculate before-total for audit
  let totalBefore = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][iUserId] === userId) {
      totalBefore +=
        (parseInt(data[i][iCount], 10) || 0) *
        (parseInt(data[i][iDenom],  10) || 0);
    }
  }

  // Helper: get new count from payload, normalising string/number keys
  function _newCount(denom) {
    const v = counts[denom] != null ? counts[denom] : (counts[String(denom)] != null ? counts[String(denom)] : 0);
    return Math.max(0, parseInt(v, 10) || 0);
  }

  let totalAfter = 0;

  WALLET_DENOMS.forEach(denom => {
    const newCount = _newCount(denom);
    totalAfter += newCount * denom;

    // Find the existing row for this (user, denomination) pair
    let sheetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][iUserId] === userId && parseInt(data[i][iDenom], 10) === denom) {
        sheetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (sheetRow > 0) {
      // Update existing row in-place (only count + timestamp — avoids row reorder)
      sheet.getRange(sheetRow, iCount   + 1).setValue(newCount);
      sheet.getRange(sheetRow, iUpdated + 1).setValue(now);
    } else {
      // Row not found (setupSheets() seeds these, but append defensively)
      const newRow = new Array(headers.length).fill('');
      newRow[iUserId]  = userId;
      newRow[iDenom]   = denom;
      newRow[iCount]   = newCount;
      newRow[iUpdated] = now;
      sheet.appendRow(newRow);
    }
  });

  // Append to audit log
  appendAuditLog({
    actingUserId:       parentId,
    childUserId:        userId,
    actionType:         'wallet_update',
    accountAffected:    'wallet',
    amountBeforeAgorot: totalBefore,
    amountAfterAgorot:  totalAfter,
    notes:              'counts=' + JSON.stringify(counts),
    source:             'parent',
  });

  return { ok: true, totalAgorot: totalAfter };
}

// ── Phase 5 stubs ─────────────────────────────────────────────
function getPurchaseSuggestions(payload) {
  throw new Error('getPurchaseSuggestions: לא מומש עדיין (Phase 5).');
}
function recordPurchase(payload) {
  throw new Error('recordPurchase: לא מומש עדיין (Phase 5).');
}
function redeemSavingsToWallet(payload) {
  throw new Error('redeemSavingsToWallet: לא מומש עדיין (Phase 5).');
}
