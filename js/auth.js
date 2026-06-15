// ─────────────────────────────────────────────────────────────
// auth.js — Device identity and mode management
//
// Device identity is stored in localStorage after first install.
// Identity lock requires parent PIN to set or reset.
//
// Stored identity shape:
//   {
//     userId:      string,    // e.g., "u_child1"
//     displayName: string,    // e.g., "ילד1"
//     userType:    string,    // "child" | "parent"
//     gender:      string,    // "m" | "f"
//     theme:       string,    // CSS theme class
//   }
//
// Theme palette key → CSS class map:
//   "ים וגיבור"  → "theme-sea-hero"
//   "חלל סגול"   → "theme-purple-space"
//   "אש ושמש"    → "theme-fire-sun"
//   "יער ונענע"  → "theme-forest-mint"
// ─────────────────────────────────────────────────────────────

'use strict';

const IDENTITY_KEY    = 'haarnak_identity';
const THEME_CLASS_MAP = {
  'ים וגיבור':  'theme-sea-hero',
  'חלל סגול':   'theme-purple-space',
  'אש ושמש':    'theme-fire-sun',
  'יער ונענע':  'theme-forest-mint',
};
const DEFAULT_THEME = 'theme-sea-hero';

/** Return the stored identity, or null if not set up. */
function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist identity to localStorage and apply the theme. */
function setIdentity(identity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  applyTheme(identity.theme);
}

/** Remove stored identity (requires parent PIN — enforced by caller). */
function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
  applyTheme(DEFAULT_THEME);
}

/** Apply a theme by palette name or CSS class. */
function applyTheme(themeKey) {
  const themeClass = THEME_CLASS_MAP[themeKey] || themeKey || DEFAULT_THEME;
  const body = document.body;
  // Remove any existing theme classes
  Object.values(THEME_CLASS_MAP).forEach(cls => body.classList.remove(cls));
  body.classList.add(themeClass);
}

/** Whether the current device is a child device. */
function isChildDevice() {
  const id = getIdentity();
  return id && id.userType === 'child';
}

/** Whether the current device is a parent device. */
function isParentDevice() {
  const id = getIdentity();
  return id && id.userType === 'parent';
}

/**
 * Show a PIN entry modal and resolve with { valid, userId, displayName }
 * from the GAS verifyParentPin call.
 *
 * Phase 0: returns a pending promise that rejects immediately (no GAS yet).
 * Replaced with real implementation in Phase 1.
 *
 * @returns {Promise<{valid: boolean, userId: string, displayName: string}>}
 */
function requireParentPin() {
  // TODO Phase 1: render PIN modal, call API.callGAS('verifyParentPin', { pin })
  return Promise.reject(new Error('PIN verification not yet implemented (Phase 1).'));
}

window.Auth = {
  getIdentity,
  setIdentity,
  clearIdentity,
  applyTheme,
  isChildDevice,
  isParentDevice,
  requireParentPin,
  THEME_CLASS_MAP,
  DEFAULT_THEME,
};
