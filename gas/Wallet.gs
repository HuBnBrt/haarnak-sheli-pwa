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

  return _writeWalletCounts({
    userId,
    counts,
    actionType:   'wallet_update',
    actingUserId: parentId,
    source:       'parent',
  });
}

/**
 * Child self-service wallet recount.
 * No parent PIN required — this is the child's primary wallet action.
 * The child sits with their physical wallet, counts each denomination,
 * and saves the counts here.
 *
 * Audit source is 'child' to distinguish from parent corrections.
 * Action type is 'wallet_count' (not 'wallet_update') for clarity.
 *
 * @param {{
 *   userId: string,
 *   counts: { [denominationAgorot: string|number]: number }
 * }} payload
 * @returns {{ ok: true, totalAgorot: number }}
 */
function countWallet(payload) {
  const { userId, counts } = payload;
  if (!userId) throw new Error('countWallet: userId נדרש.');
  if (!counts || typeof counts !== 'object') throw new Error('countWallet: counts נדרש.');

  // Verify the user exists and is active (any user type is fine —
  // parent-bound devices could in theory call this, but the child UI
  // only exposes it on child-bound devices).
  const users = readTab('users');
  const user  = users.find(u => u['user_id'] === userId && u['active'] === true);
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Reuse the shared write helper with source='child'
  return _writeWalletCounts({
    userId,
    counts,
    actionType:    'wallet_count',
    actingUserId:  userId,
    source:        'child',
  });
}

/**
 * Shared write path for wallet denomination updates.
 * Called by both updatePhysicalWallet (parent) and countWallet (child).
 *
 * @private
 */
function _writeWalletCounts({ userId, counts, actionType, actingUserId, source }) {
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

  // Read current totals for audit
  let totalBefore = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][iUserId] === userId) {
      totalBefore +=
        (parseInt(data[i][iCount], 10) || 0) *
        (parseInt(data[i][iDenom],  10) || 0);
    }
  }

  function _resolve(denom) {
    const v = counts[denom] != null ? counts[denom] : (counts[String(denom)] != null ? counts[String(denom)] : 0);
    return Math.max(0, parseInt(v, 10) || 0);
  }

  let totalAfter = 0;

  WALLET_DENOMS.forEach(denom => {
    const newCount = _resolve(denom);
    totalAfter += newCount * denom;

    let sheetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][iUserId] === userId && parseInt(data[i][iDenom], 10) === denom) {
        sheetRow = i + 1;
        break;
      }
    }

    if (sheetRow > 0) {
      sheet.getRange(sheetRow, iCount   + 1).setValue(newCount);
      sheet.getRange(sheetRow, iUpdated + 1).setValue(now);
    } else {
      const newRow = new Array(headers.length).fill('');
      newRow[iUserId]  = userId;
      newRow[iDenom]   = denom;
      newRow[iCount]   = newCount;
      newRow[iUpdated] = now;
      sheet.appendRow(newRow);
    }
  });

  appendAuditLog({
    actingUserId:       actingUserId,
    childUserId:        userId,
    actionType:         actionType,
    accountAffected:    'wallet',
    amountBeforeAgorot: totalBefore,
    amountAfterAgorot:  totalAfter,
    notes:              'counts=' + JSON.stringify(counts),
    source:             source,
  });

  return { ok: true, totalAgorot: totalAfter };
}

// ── Phase 5: Purchase Helper ──────────────────────────────────

/**
 * Compute payment suggestions for a purchase price.
 * Returns wallet contents and 1-2 smart suggestions.
 *
 * @param {{ userId: string, priceAgorot: number }} payload
 * @returns {{
 *   walletCounts:      { [denom: number]: number },
 *   walletTotalAgorot: number,
 *   savingsAgorot:     number,
 *   priceAgorot:       number,
 *   canAfford:         boolean,
 *   suggestions:       Array<{
 *     label:            string,
 *     denomCounts:      { [denom: number]: number },
 *     totalPaidAgorot:  number,
 *     changeAgorot:     number,
 *     exact:            boolean,
 *   }>
 * }}
 */
function getPurchaseSuggestions(payload) {
  var userId     = payload.userId;
  var priceInput = payload.priceAgorot;
  if (!userId)      throw new Error('getPurchaseSuggestions: userId נדרש.');
  if (!priceInput)  throw new Error('getPurchaseSuggestions: priceAgorot נדרש.');

  var price = Math.round(Number(priceInput));
  if (!price || price <= 0) throw new Error('getPurchaseSuggestions: מחיר חוקי נדרש.');

  // Verify user
  var users = readTab('users');
  var user  = users.filter(function(u) {
    return u['user_id'] === userId && u['active'] === true;
  })[0];
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Read wallet
  var walletData         = getWalletDenominations({ userId: userId });
  var walletCounts       = walletData.counts;
  var walletTotalAgorot  = walletData.totalAgorot;

  // Read savings balance (for low-wallet hint on frontend)
  var savingsAgorot = 0;
  try { savingsAgorot = _getAccountBalance(userId, 'savings'); } catch (_) {}

  var canAfford  = walletTotalAgorot >= price;
  var suggestions = canAfford ? _computeSuggestions(walletCounts, price) : [];

  return {
    walletCounts:      walletCounts,
    walletTotalAgorot: walletTotalAgorot,
    savingsAgorot:     savingsAgorot,
    priceAgorot:       price,
    canAfford:         canAfford,
    suggestions:       suggestions,
  };
}

/**
 * Record a completed purchase: subtract paid denominations, add received change.
 * Validates amounts, updates wallet, writes transaction + audit log.
 *
 * @param {{
 *   userId:       string,
 *   priceAgorot:  number,
 *   paidCounts:   { [denom: string|number]: number },
 *   changeCounts: { [denom: string|number]: number },
 *   description:  string,
 * }} payload
 * @returns {{ ok: true, newTotalAgorot: number }}
 */
function recordPurchase(payload) {
  var userId      = payload.userId;
  var priceInput  = payload.priceAgorot;
  var paidCounts  = payload.paidCounts  || {};
  var changeCounts = payload.changeCounts || {};
  var description = payload.description || 'קנייה';

  if (!userId)     throw new Error('recordPurchase: userId נדרש.');
  if (!priceInput) throw new Error('recordPurchase: priceAgorot נדרש.');

  var price = Math.round(Number(priceInput));
  if (!price || price <= 0) throw new Error('recordPurchase: מחיר חוקי נדרש.');

  // Verify user
  var users = readTab('users');
  var user  = users.filter(function(u) {
    return u['user_id'] === userId && u['active'] === true;
  })[0];
  if (!user) throw new Error('משתמש לא נמצא או אינו פעיל.');

  // Helper: sum a denomination counts object
  function sumCounts(obj) {
    return WALLET_DENOMS.reduce(function(s, d) {
      var v = obj[d] != null ? obj[d] : (obj[String(d)] || 0);
      return s + Math.max(0, parseInt(v, 10) || 0) * d;
    }, 0);
  }

  // Helper: resolve count for one denomination
  function resolve(obj, denom) {
    var v = obj[denom] != null ? obj[denom] : (obj[String(denom)] || 0);
    return Math.max(0, parseInt(v, 10) || 0);
  }

  var paidTotal    = sumCounts(paidCounts);
  var changeTotal  = sumCounts(changeCounts);
  var expectedChange = paidTotal - price;

  if (paidTotal < price) {
    throw new Error(
      'הסכום ששולם (' + (paidTotal / 100) + '₪) קטן מהמחיר (' + (price / 100) + '₪).'
    );
  }
  if (changeTotal !== expectedChange) {
    throw new Error(
      'עודף שהוכנס (' + (changeTotal / 100) + '₪) לא תואם לצפוי (' + (expectedChange / 100) + '₪).'
    );
  }

  // Get current wallet and validate sufficient denominations
  var current = getWalletDenominations({ userId: userId }).counts;

  WALLET_DENOMS.forEach(function(d) {
    var need = resolve(paidCounts, d);
    var have = current[d] || 0;
    if (need > have) {
      throw new Error(
        'לא מספיק ' + (d / 100) + '₪ בארנק (יש ' + have + ', צריך ' + need + ').'
      );
    }
  });

  // Compute new wallet counts = current − paid + change
  var newCounts = {};
  WALLET_DENOMS.forEach(function(d) {
    var cur  = current[d] || 0;
    var paid = resolve(paidCounts, d);
    var chg  = resolve(changeCounts, d);
    var next = cur - paid + chg;
    if (next < 0) {
      throw new Error('שגיאה פנימית בחישוב ארנק עבור ' + d + 'ag.');
    }
    newCounts[d] = next;
  });

  // Write updated wallet
  var result = _writeWalletCounts({
    userId:       userId,
    counts:       newCounts,
    actionType:   'purchase',
    actingUserId: userId,
    source:       'child',
  });

  // Write transaction record
  _appendTransaction({
    userId:       userId,
    fromAccount:  'wallet',
    toAccount:    'external',
    amountAgorot: price,
    type:         'purchase',
    description:  description,
    initiatedBy:  'child',
    notes: JSON.stringify({
      paidTotal:    paidTotal,
      changeTotal:  changeTotal,
      paidCounts:   paidCounts,
      changeCounts: changeCounts,
    }),
  });

  return { ok: true, newTotalAgorot: result.totalAgorot };
}

/**
 * Compute 1-2 payment suggestions for a given price from available wallet.
 *
 * Strategy A (coin-first): greedy from smallest denominations up — prefers
 *   using small coins/change to "clean out" the wallet.
 * Strategy B (large-first): standard greedy from largest — minimises piece count.
 *
 * Returns at most 2 suggestions; deduplicates identical results.
 * If the wallet can pay exactly, suggestions are exact; otherwise rounds up.
 *
 * @private
 */
function _computeSuggestions(availCounts, priceAgorot) {
  var ALL_DENOMS  = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 10]; // large→small
  var COIN_FIRST  = [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]; // small→large

  // Normalise available counts (handles string or number keys)
  var avail = {};
  ALL_DENOMS.forEach(function(d) {
    var v = availCounts[d] != null ? availCounts[d] : (availCounts[String(d)] || 0);
    avail[d] = Math.max(0, parseInt(v, 10) || 0);
  });

  var walletTotal = ALL_DENOMS.reduce(function(s, d) { return s + avail[d] * d; }, 0);
  if (walletTotal < priceAgorot) return [];

  /**
   * Greedy builder: use denominations in `denomOrder`, then round up if needed.
   * Returns { counts, totalPaid, exact } or null if wallet can't cover price.
   */
  function buildPayment(denomOrder) {
    var counts = {};
    var rem    = priceAgorot;

    for (var i = 0; i < denomOrder.length; i++) {
      var d   = denomOrder[i];
      var avd = avail[d] || 0;
      if (avd === 0 || rem <= 0) continue;
      var use = Math.min(avd, Math.floor(rem / d));
      if (use > 0) { counts[d] = use; rem -= use * d; }
    }

    var exact = rem === 0;

    if (!exact) {
      // Round up: find smallest available denomination >= remaining shortfall
      var asc = ALL_DENOMS.slice().reverse(); // small→large
      var rounded = false;
      for (var j = 0; j < asc.length; j++) {
        var dj   = asc[j];
        var avdj = avail[dj] || 0;
        var usedj = counts[dj] || 0;
        if (avdj > usedj && dj >= rem) {
          counts[dj] = usedj + 1;
          rem -= dj;
          rounded = true;
          break;
        }
      }
      if (!rounded) return null; // wallet can't cover price
    }

    // Validate: never use more of any denomination than available
    for (var k = 0; k < ALL_DENOMS.length; k++) {
      var dk = ALL_DENOMS[k];
      if ((counts[dk] || 0) > (avail[dk] || 0)) return null;
    }

    // Clean: remove zero entries
    var clean = {};
    ALL_DENOMS.forEach(function(d) { if ((counts[d] || 0) > 0) clean[d] = counts[d]; });

    var total = ALL_DENOMS.reduce(function(s, d) { return s + (clean[d] || 0) * d; }, 0);
    return { counts: clean, totalPaid: total, exact: (rem <= 0 && exact) };
  }

  var sA = buildPayment(COIN_FIRST); // coin-reduction strategy
  var sB = buildPayment(ALL_DENOMS); // large-first strategy

  // Stringify counts for deduplication comparison
  function countsKey(c) {
    return ALL_DENOMS.map(function(d) { return c[d] || 0; }).join(',');
  }

  var suggestions = [];

  // B (large-first) is always the fallback suggestion
  if (sB) {
    suggestions.push({
      label:           sB.exact ? 'הכי מעט מטבעות' : 'תשלום עם עודף מינימלי',
      denomCounts:     sB.counts,
      totalPaidAgorot: sB.totalPaid,
      changeAgorot:    sB.totalPaid - priceAgorot,
      exact:           sB.exact,
    });
  }

  // A (coin-first) only if it produces a DIFFERENT result that is not worse
  if (sA && (!sB || countsKey(sA.counts) !== countsKey(sB.counts))) {
    if (sA.exact || !sB || sA.totalPaid <= sB.totalPaid) {
      suggestions.unshift({         // prepend: coin-reduction shown first
        label:           'שימוש במטבעות קטנים',
        denomCounts:     sA.counts,
        totalPaidAgorot: sA.totalPaid,
        changeAgorot:    sA.totalPaid - priceAgorot,
        exact:           sA.exact,
      });
    }
  }

  return suggestions;
}

/**
 * redeemSavingsToWallet — Phase 5.1 (deferred).
 * Will transfer savings balance to physical wallet after parent approval.
 */
function redeemSavingsToWallet(payload) {
  throw new Error('redeemSavingsToWallet: עדיין לא מומש (Phase 5.1).');
}
