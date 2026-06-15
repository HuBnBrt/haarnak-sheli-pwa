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
