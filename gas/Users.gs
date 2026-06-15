// ─────────────────────────────────────────────────────────────
// Users.gs — User identity actions
// Phase 0: stubs only. Fleshed out in Phase 1.
// ─────────────────────────────────────────────────────────────

/**
 * Return the list of users for the first-install picker.
 * Returns only display name, user_id, user_type, and gender.
 * Never returns PIN hashes.
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
    }));
}

/**
 * Bind a device to a user identity.
 * Requires parent PIN.
 * Phase 1: implement full logic.
 */
function bindDeviceIdentity(payload) {
  // TODO Phase 1
  throw new Error('bindDeviceIdentity not yet implemented.');
}

/**
 * Reset device identity binding.
 * Requires parent PIN.
 * Phase 1: implement full logic.
 */
function resetDeviceIdentity(payload) {
  // TODO Phase 1
  throw new Error('resetDeviceIdentity not yet implemented.');
}

// ── Stubs for later phases ───────────────────────────────────

function getChildDashboard(payload)   { throw new Error('getChildDashboard not yet implemented.'); }
function getParentDashboard(payload)  { throw new Error('getParentDashboard not yet implemented.'); }
function getSettings(payload)         { throw new Error('getSettings not yet implemented.'); }
function updateSettings(payload)      { throw new Error('updateSettings not yet implemented.'); }
function getUsers(payload)            { throw new Error('getUsers not yet implemented.'); }
function getHistory(payload)          { throw new Error('getHistory not yet implemented.'); }
function getAuditLog(payload)         { throw new Error('getAuditLog not yet implemented.'); }
