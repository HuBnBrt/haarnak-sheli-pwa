// ─────────────────────────────────────────────────────────────
// Auth.gs — Parent PIN verification
//
// PINs are stored as SHA-256 hashes in the `users` sheet.
// PIN hashing uses GAS Utilities.computeDigest (SHA-256).
//
// Setting a PIN:
//   Parents set their PIN via the parent dashboard (Phase 1).
//   The raw PIN is never stored — only the hash.
//
// Security note:
//   This is appropriate for a private family app.
//   For a public/multi-family product, use OAuth or stronger auth.
// ─────────────────────────────────────────────────────────────

/**
 * Hash a PIN string using SHA-256.
 * @param {string} pin
 * @returns {string} hex string
 */
function hashPin(pin) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(pin),
    Utilities.Charset.UTF_8
  );
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verify a parent PIN against all parent users in the sheet.
 *
 * @param {{ pin: string }} payload
 * @returns {{ valid: boolean, userId?: string, displayName?: string, gender?: string }}
 */
function verifyParentPin(payload) {
  const { pin } = payload;
  if (!pin) return { valid: false };

  const pinHash = hashPin(pin);
  const users   = readTab('users');

  for (const user of users) {
    if (
      user['user_type'] === 'parent' &&
      user['active']    === true  &&
      user['pin_hash']  === pinHash
    ) {
      return {
        valid:       true,
        userId:      user['user_id'],
        displayName: user['display_name'],
        gender:      user['gender'],
      };
    }
  }

  return { valid: false };
}

/**
 * Require and verify parent PIN from payload.
 * Throws if PIN is missing or invalid.
 * Used internally by all sensitive action handlers.
 *
 * @param {Object} payload - Must include { parentPin: string }
 * @returns {{ userId: string, displayName: string, gender: string }} acting parent
 */
function requirePin(payload) {
  const result = verifyParentPin({ pin: payload.parentPin });
  if (!result.valid) throw new Error('קוד הורה שגוי או חסר.');
  return result;
}

/**
 * Set a parent's PIN for the first time (bootstrap only).
 *
 * Rules:
 *   - Target user must be a parent role.
 *   - Only allowed when the user currently has NO pin_hash.
 *   - PIN must be 4–8 digits.
 *   - No existing PIN required (this IS the first-time setup gate).
 *
 * @param {{ userId: string, newPin: string }} payload
 * @returns {{ ok: true }}
 */
function setInitialParentPin(payload) {
  const { userId, newPin } = payload;

  if (!userId || !newPin) throw new Error('userId ו-newPin הם שדות חובה.');

  const pinStr = String(newPin).trim();
  if (!/^\d{4,8}$/.test(pinStr)) throw new Error('קוד חייב להכיל 4–8 ספרות בלבד.');

  const users = readTab('users');
  const user  = users.find(u => u['user_id'] === userId);
  if (!user)                          throw new Error('משתמש לא נמצא.');
  if (user['user_type'] !== 'parent') throw new Error('ניתן להגדיר קוד רק להורים.');
  if (user['pin_hash'])               throw new Error('קוד הורה כבר הוגדר. לשינוי השתמש בלוח ההורה.');

  const newHash = hashPin(pinStr);

  // Update the pin_hash cell directly (no appendRow — we're updating an existing row)
  const sheet      = getSheet('users');
  const headers    = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pinHashCol = headers.indexOf('pin_hash') + 1;
  const userIdCol  = headers.indexOf('user_id')  + 1;
  if (pinHashCol === 0) throw new Error('עמודת pin_hash לא נמצאה בגיליון users.');

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][userIdCol - 1] === userId) {
      sheet.getRange(i + 1, pinHashCol).setValue(newHash);
      return { ok: true };
    }
  }
  throw new Error('שורת משתמש לא נמצאה בגיליון.');
}
