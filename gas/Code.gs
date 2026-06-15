// ─────────────────────────────────────────────────────────────
// Code.gs — GAS Web App entry point
//
// ── CORS / content-type handling ─────────────────────────────
// The frontend never uses Content-Type: application/json because
// that triggers a CORS preflight OPTIONS request. GAS does not
// handle OPTIONS, so the browser would block the response.
//
// Two "simple" content types are supported (no preflight):
//
//   1. text/plain;charset=utf-8  (primary)
//      Body: raw JSON string  { action, payload }
//      GAS reads: e.postData.contents → JSON.parse()
//
//   2. application/x-www-form-urlencoded  (fallback)
//      Body: data=<URL-encoded JSON string>
//      GAS reads: e.parameter.data → JSON.parse()
//
// The _parseRequest() helper handles both transparently.
//
// ── Response format ──────────────────────────────────────────
// Always returns JSON via ContentService:
//   { ok: true,  data: { ... } }    on success
//   { ok: false, error: 'message' } on any error
//
// ContentService.MimeType.JSON adds Content-Type: application/json
// to the response, which is fine — CORS restrictions apply to
// requests, not to response content types.
// ─────────────────────────────────────────────────────────────

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = _parseRequest(e);
    const action  = body.action;
    const payload = body.payload || {};

    if (!action) throw new Error('Missing action field in request body.');

    let result;

    switch (action) {

      // ── Connectivity ──────────────────────────────────────
      case 'ping':
        result = {
          ok:        true,
          message:   'הארנק שלי GAS is running',
          timestamp: new Date().toISOString(),
        };
        break;

      // ── Identity (Phase 1) ────────────────────────────────
      case 'getInitialUsers':       result = getInitialUsers(payload);      break;
      case 'bindDeviceIdentity':    result = bindDeviceIdentity(payload);   break;
      case 'resetDeviceIdentity':   result = resetDeviceIdentity(payload);  break;
      case 'verifyParentPin':       result = verifyParentPin(payload);      break;

      // ── Dashboard (Phase 3) ───────────────────────────────
      case 'getChildDashboard':     result = getChildDashboard(payload);    break;
      case 'getParentDashboard':    result = getParentDashboard(payload);   break;

      // ── Allowance & Bonus (Phase 3-4) ─────────────────────
      case 'runMonthlyAllowanceIfDue':    result = runMonthlyAllowanceIfDue(payload);   break;
      case 'getSavingsBonusPreview':      result = getSavingsBonusPreview(payload);     break;
      case 'applyQuarterlySavingsBonus':  result = applyQuarterlySavingsBonus(payload); break;

      // ── Wallet & Purchase (Phase 2, 5) ────────────────────
      case 'getWalletDenominations':  result = getWalletDenominations(payload);  break;
      case 'updatePhysicalWallet':    result = updatePhysicalWallet(payload);    break;
      case 'getPurchaseSuggestions':  result = getPurchaseSuggestions(payload);  break;
      case 'recordPurchase':          result = recordPurchase(payload);          break;
      case 'redeemSavingsToWallet':   result = redeemSavingsToWallet(payload);   break;

      // ── Goals (Phase 4) ───────────────────────────────────
      case 'getGoals':        result = getGoals(payload);       break;
      case 'createGoal':      result = createGoal(payload);     break;
      case 'updateGoal':      result = updateGoal(payload);     break;
      case 'cancelGoal':      result = cancelGoal(payload);     break;
      case 'completeGoal':    result = completeGoal(payload);   break;

      // ── Goal Images (Phase 9) ─────────────────────────────
      case 'uploadGoalImage':  result = uploadGoalImage(payload);  break;
      case 'archiveGoalImage': result = archiveGoalImage(payload); break;

      // ── Accounts / Gray (Phase 6) ─────────────────────────
      case 'recordGift':                   result = recordGift(payload);                   break;
      case 'recordChoreReward':            result = recordChoreReward(payload);            break;
      case 'distributeGrayMoney':          result = distributeGrayMoney(payload);          break;
      case 'recordGiving':                 result = recordGiving(payload);                 break;
      case 'recordParentTemporaryPayment': result = recordParentTemporaryPayment(payload); break;
      case 'recordSettlement':             result = recordSettlement(payload);             break;

      // ── Chores (Phase 7) ──────────────────────────────────
      case 'getChoreBank':             result = getChoreBank(payload);             break;
      case 'getChoreRequests':         result = getChoreRequests(payload);         break;
      case 'sendChoreRequest':         result = sendChoreRequest(payload);         break;
      case 'acknowledgeChoreRequest':  result = acknowledgeChoreRequest(payload);  break;
      case 'approveChoreCompletion':   result = approveChoreCompletion(payload);   break;
      case 'markParentCompletedChore': result = markParentCompletedChore(payload); break;

      // ── Notifications (Phase 8) ───────────────────────────
      case 'getNotifications':     result = getNotifications(payload);    break;
      case 'markNotificationRead': result = markNotificationRead(payload); break;

      // ── History / Settings (Phase 8) ──────────────────────
      case 'getHistory':    result = getHistory(payload);    break;
      case 'getAuditLog':   result = getAuditLog(payload);  break;
      case 'getSettings':   result = getSettings(payload);  break;
      case 'updateSettings':result = updateSettings(payload);break;
      case 'getUsers':      result = getUsers(payload);     break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    output.setContent(JSON.stringify({ ok: true, data: result }));

  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.message }));
  }

  return output;
}

// ── GET: simple health check (not used by the app) ────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok:      true,
      message: 'הארנק שלי API is live. Send POST requests.',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Request parser ────────────────────────────────────────────
/**
 * Parse the incoming POST request body regardless of content type.
 *
 * Supports:
 *   text/plain;charset=utf-8 (primary)
 *     e.postData.contents = '{"action":"ping","payload":{}}'
 *
 *   application/x-www-form-urlencoded (fallback)
 *     e.parameter.data = '{"action":"ping","payload":{}}'
 *
 * @param {Object} e - GAS event object from doPost(e)
 * @returns {{ action: string, payload: Object }}
 */
function _parseRequest(e) {
  // 1. Check for url-encoded fallback: parameter named 'data'
  if (e.parameter && e.parameter.data) {
    try {
      return JSON.parse(e.parameter.data);
    } catch {
      throw new Error('Could not parse url-encoded "data" parameter as JSON.');
    }
  }

  // 2. Default: raw body (text/plain or anything else with a body)
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch {
      throw new Error(
        'Could not parse request body as JSON. ' +
        'Body starts with: ' + String(e.postData.contents).slice(0, 80)
      );
    }
  }

  throw new Error('Request has no parseable body (no postData.contents or parameter.data).');
}
