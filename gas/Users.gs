// ─────────────────────────────────────────────────────────────
// Users.gs — User identity actions
// ─────────────────────────────────────────────────────────────

/**
 * Return the list of users for the first-install picker.
 * Returns display info only — never returns pin_hash.
 * Includes hasPinSet (boolean) for parent users so the frontend
 * knows whether to show initial-PIN setup or the verify modal.
 */
function getInitialUsers() {
  const users = readTab('users');
  return users
    .filter(u => u['active'] === true)
    .map(u => ({
      userId:      u['user_id'],
      displayName: u['display_name'],
      userType:    u['user_type'],
      gender:      u['gender'],
      theme:       u['theme_palette'] || '',
      // Parents: expose whether PIN has been configured yet (bootstrap detection)
      hasPinSet:   u['user_type'] === 'parent' ? !!u['pin_hash'] : undefined,
    }));
}

/**
 * Bind a device to a user identity.
 *
 * @param {{ userId: string, parentId: string, deviceId: string }} payload
 *   userId   — the user this device will be locked to
 *   parentId — the parent who authorised the binding (already verified via verifyParentPin)
 *   deviceId — stable device identifier from localStorage
 * @returns {{ userId, displayName, userType, gender, theme }}
 */
function bindDeviceIdentity(payload) {
  const { userId, parentId, deviceId } = payload;
  if (!userId || !parentId || !deviceId) {
    throw new Error('bindDeviceIdentity: userId, parentId, deviceId הם שדות חובה.');
  }

  const users = readTab('users');

  // Confirm the authorising parent exists and is active
  const parent = users.find(
    u => u['user_id'] === parentId && u['user_type'] === 'parent' && u['active'] === true
  );
  if (!parent) throw new Error('הורה מאשר לא נמצא או אינו פעיל.');

  // Look up the user being bound
  const user = users.find(u => u['user_id'] === userId && u['active'] === true);
  if (!user) throw new Error('משתמש לא נמצא.');

  // Audit log — no money involved, amounts are 0
  appendAuditLog({
    actingUserId:       parentId,
    childUserId:        userId,
    actionType:         'device_bind',
    accountAffected:    'identity',
    amountBeforeAgorot: 0,
    amountAfterAgorot:  0,
    notes:              'device_id=' + deviceId,
    deviceId:           deviceId,
    source:             'parent',
  });

  return {
    userId:      user['user_id'],
    displayName: user['display_name'],
    userType:    user['user_type'],
    gender:      user['gender'],
    theme:       user['theme_palette'] || '',
  };
}

/**
 * Reset (unbind) a device from its current user.
 * Requires a parent to have already been verified via verifyParentPin.
 *
 * @param {{ parentId: string, deviceId: string, targetUserId: string }} payload
 * @returns {{ ok: true }}
 */
function resetDeviceIdentity(payload) {
  const { parentId, deviceId, targetUserId } = payload;
  if (!parentId || !deviceId) {
    throw new Error('resetDeviceIdentity: parentId ו-deviceId הם שדות חובה.');
  }

  const users = readTab('users');

  const parent = users.find(
    u => u['user_id'] === parentId && u['user_type'] === 'parent' && u['active'] === true
  );
  if (!parent) throw new Error('הורה מאשר לא נמצא או אינו פעיל.');

  appendAuditLog({
    actingUserId:       parentId,
    childUserId:        targetUserId || '',
    actionType:         'device_reset',
    accountAffected:    'identity',
    amountBeforeAgorot: 0,
    amountAfterAgorot:  0,
    notes:              'device_id=' + deviceId,
    deviceId:           deviceId,
    source:             'parent',
  });

  return { ok: true };
}

// ── Stubs for later phases ────────────────────────────────────

function getChildDashboard(payload)   { throw new Error('getChildDashboard not yet implemented.'); }
function getParentDashboard(payload)  { throw new Error('getParentDashboard not yet implemented.'); }
function getSettings(payload)         { throw new Error('getSettings not yet implemented.'); }
function updateSettings(payload)      { throw new Error('updateSettings not yet implemented.'); }
function getUsers(payload)            { throw new Error('getUsers not yet implemented.'); }
function getHistory(payload)          { throw new Error('getHistory not yet implemented.'); }
function getAuditLog(payload)         { throw new Error('getAuditLog not yet implemented.'); }
