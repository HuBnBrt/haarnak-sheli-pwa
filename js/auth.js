// ─────────────────────────────────────────────────────────────
// auth.js — Device identity, PIN modal, and mode management
//
// ── localStorage keys ────────────────────────────────────────
//   haarnak_identity   { userId, displayName, userType, gender,
//                        theme, deviceId, boundAt }
//   haarnak_device_id  stable UUID, survives identity resets
//
// ── Theme palette → CSS class ────────────────────────────────
//   "ים וגיבור"  → theme-sea-hero
//   "חלל סגול"   → theme-purple-space
//   "אש ושמש"    → theme-fire-sun
//   "יער ונענע"  → theme-forest-mint
//
// ── PIN security model ───────────────────────────────────────
//   PIN never stored on device.
//   Verification happens in GAS (SHA-256 comparison).
//   For binding: frontend calls verifyParentPin → gets parentId
//   → passes parentId to bindDeviceIdentity (GAS validates parentId).
// ─────────────────────────────────────────────────────────────

'use strict';

const IDENTITY_KEY  = 'haarnak_identity';
const DEVICE_ID_KEY = 'haarnak_device_id';

const THEME_CLASS_MAP = {
  'ים וגיבור':  'theme-sea-hero',
  'חלל סגול':   'theme-purple-space',
  'אש ושמש':    'theme-fire-sun',
  'יער ונענע':  'theme-forest-mint',
};
const DEFAULT_THEME = 'theme-sea-hero';

// ── Device ID ─────────────────────────────────────────────────

/**
 * Return the stable device identifier.
 * Generated once, persists in localStorage even after identity resets.
 */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Identity ──────────────────────────────────────────────────

/** Return the stored identity object, or null if not set. */
function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist identity and apply the theme. */
function setIdentity(identity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  applyTheme(identity.theme);
}

/**
 * Remove stored identity (called after parent PIN reset).
 * Device ID is intentionally preserved.
 */
function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
  applyTheme(DEFAULT_THEME);
}

// ── Theme ─────────────────────────────────────────────────────

/** Apply a theme by palette name (Hebrew label) or CSS class name. */
function applyTheme(themeKey) {
  const themeClass = THEME_CLASS_MAP[themeKey] || themeKey || DEFAULT_THEME;
  const body = document.body;
  Object.values(THEME_CLASS_MAP).forEach(cls => body.classList.remove(cls));
  body.classList.add(themeClass);
}

// ── Mode helpers ──────────────────────────────────────────────

function isChildDevice() {
  const id = getIdentity();
  return !!(id && id.userType === 'child');
}

function isParentDevice() {
  const id = getIdentity();
  return !!(id && id.userType === 'parent');
}

// ── Parent PIN modal ──────────────────────────────────────────

/**
 * Show a PIN entry modal and verify against GAS.
 * Keeps the modal open on wrong PIN; closes on success or cancel.
 *
 * @param {string} [promptText] - Hebrew instruction shown in the modal
 * @returns {Promise<{ parentId: string, displayName: string, gender: string }>}
 *   Resolves on correct PIN. Rejects with Error('cancelled') on cancel.
 */
function requireParentPin(promptText) {
  const prompt = promptText || 'נדרש אישור קוד הורה';

  return new Promise((resolve, reject) => {
    const deviceId = getDeviceId();

    // ── Build overlay ────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:16px',
      'background:rgba(0,0,0,0.65)',
      'backdrop-filter:blur(2px)',
      '-webkit-backdrop-filter:blur(2px)',
    ].join(';');

    overlay.innerHTML = `
      <div style="
        background:var(--color-bg-card);
        border-radius:var(--radius-lg);
        padding:28px 24px 20px;
        width:100%;
        max-width:320px;
        text-align:center;
        box-shadow:0 8px 32px rgba(0,0,0,0.3);
      ">
        <div style="font-size:2.2rem; margin-bottom:8px;">🔑</div>
        <h3 style="margin:0 0 6px; font-size:1.1rem;">קוד הורה</h3>
        <p id="pin-prompt-text" style="
          font-size:0.88rem;
          color:var(--color-text-muted);
          margin:0 0 20px;
          line-height:1.5;
        ">${_escapeHtml(prompt)}</p>

        <input
          id="pin-input"
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="8"
          placeholder="••••"
          autocomplete="off"
          style="
            width:100%;
            padding:14px;
            font-size:1.4rem;
            letter-spacing:0.3em;
            text-align:center;
            border:2px solid var(--color-border);
            border-radius:var(--radius-md);
            background:var(--color-bg);
            color:var(--color-text);
            box-sizing:border-box;
            margin-bottom:8px;
            outline:none;
          "
        >

        <p id="pin-error" style="
          min-height:1.4em;
          font-size:0.85rem;
          color:var(--color-danger);
          margin:0 0 16px;
        "></p>

        <button id="pin-confirm-btn" class="btn btn-primary btn-full" style="margin-bottom:10px;">
          אשר
        </button>
        <button id="pin-cancel-btn" class="btn btn-ghost btn-full">
          ביטול
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const input      = overlay.querySelector('#pin-input');
    const confirmBtn = overlay.querySelector('#pin-confirm-btn');
    const cancelBtn  = overlay.querySelector('#pin-cancel-btn');
    const errorEl    = overlay.querySelector('#pin-error');

    // Auto-focus the PIN field
    setTimeout(() => input.focus(), 60);

    function cleanup() { overlay.remove(); }

    // ── Submit handler ────────────────────────────────────────
    async function submit() {
      const pin = input.value.trim();
      if (!pin) {
        errorEl.textContent = 'יש להזין קוד.';
        return;
      }

      confirmBtn.disabled   = true;
      confirmBtn.textContent = 'בודק...';
      errorEl.textContent    = '';

      try {
        // callGASWithFallback returns { data, method } — unwrap data
        const { data: result } = await API.callGASWithFallback('verifyParentPin', { pin, deviceId });

        if (result.valid) {
          cleanup();
          resolve({
            parentId:    result.userId,
            displayName: result.displayName,
            gender:      result.gender,
          });
        } else {
          // Wrong PIN — keep modal open
          input.value = '';
          input.focus();
          errorEl.textContent = 'קוד שגוי. נסה שוב.';
        }

      } catch (err) {
        errorEl.textContent = 'שגיאת תקשורת: ' + err.message;
      } finally {
        confirmBtn.disabled   = false;
        confirmBtn.textContent = 'אשר';
      }
    }

    confirmBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      reject(new Error('cancelled'));
    });

    // Tap outside card → cancel
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        cleanup();
        reject(new Error('cancelled'));
      }
    });
  });
}

// ── Device binding ────────────────────────────────────────────

/**
 * Bind this device to a user, authorized by an already-verified parent.
 * Stores the returned identity in localStorage.
 *
 * @param {string} selectedUserId - The user this device will be locked to
 * @param {string} parentId       - The parent who verified PIN (from requireParentPin)
 * @returns {Promise<Object>} identity object stored in localStorage
 */
async function bindDeviceIdentity(selectedUserId, parentId) {
  const deviceId = getDeviceId();
  // callGASWithFallback returns { data, method } — unwrap data
  const { data: userData } = await API.callGASWithFallback('bindDeviceIdentity', {
    userId:   selectedUserId,
    parentId: parentId,
    deviceId: deviceId,
  });
  const identity = {
    userId:      userData.userId,
    displayName: userData.displayName,
    userType:    userData.userType,
    gender:      userData.gender,
    theme:       userData.theme,
    deviceId:    deviceId,
    boundAt:     new Date().toISOString(),
  };
  setIdentity(identity);
  return identity;
}

/**
 * Reset this device's identity binding.
 * Shows the parent PIN modal, then calls GAS to log the reset.
 * After resolution, clearIdentity() is called.
 * Caller is responsible for navigation (e.g., App.navigate('setup')).
 *
 * @returns {Promise<void>}
 */
async function resetDeviceIdentity() {
  const currentIdentity = getIdentity();
  const deviceId        = getDeviceId();

  const { parentId } = await requireParentPin('הזן קוד הורה לאיפוס מכשיר זה');

  await API.callGASWithFallback('resetDeviceIdentity', {
    parentId:     parentId,
    deviceId:     deviceId,
    targetUserId: currentIdentity ? currentIdentity.userId : '',
  });

  clearIdentity();
}

/**
 * Set a parent's PIN for the very first time (bootstrap, no existing PIN needed).
 * Calls GAS — only succeeds when pin_hash is empty for that user.
 *
 * @param {string} userId
 * @param {string} newPin
 * @returns {Promise<{ ok: true }>}
 */
async function setInitialParentPin(userId, newPin) {
  return API.callGASWithFallback('setInitialParentPin', { userId, newPin });
}

// ── Exports ───────────────────────────────────────────────────

window.Auth = {
  getDeviceId,
  getIdentity,
  setIdentity,
  clearIdentity,
  applyTheme,
  isChildDevice,
  isParentDevice,
  requireParentPin,
  bindDeviceIdentity,
  resetDeviceIdentity,
  setInitialParentPin,
  THEME_CLASS_MAP,
  DEFAULT_THEME,
};

// ── Helpers ───────────────────────────────────────────────────

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}
