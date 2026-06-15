// ─────────────────────────────────────────────────────────────
// views/setup.js — First-install setup screen
//
// ── Step 1: GAS URL entry ────────────────────────────────────
//   Shown when no GAS URL is in localStorage.
//   Parent pastes the Web App URL and runs a ping test.
//   URL saved only after ping succeeds.
//
// ── Step 2: User picker ──────────────────────────────────────
//   Shown when GAS URL is set but device has no identity.
//   Fetches user list from GAS.
//   For parents with no PIN yet: shows initial PIN setup form.
//   For parents with PIN:   shows PIN modal (self-verify).
//   For children:           shows PIN modal (parent verifies).
//   On success: calls Auth.bindDeviceIdentity → App.navigate.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.Setup = {

  render(container) {
    if (!API.isConfigured()) {
      this._renderUrlEntry(container);
    } else {
      this._renderUserSelection(container);
    }
  },

  // ── Step 1: GAS URL entry + CORS ping test ───────────────

  _renderUrlEntry(container) {
    container.innerHTML = `
      <div class="page">
        <h1 class="text-center" style="margin-bottom:6px;">הארנק שלי</h1>
        <p class="text-center text-muted" style="margin-bottom:32px; font-size:0.95rem;">
          הגדרה ראשונית — חיבור לשרת המשפחתי
        </p>

        <div class="card">
          <h3 style="margin-bottom:12px;">כתובת שרת GAS</h3>
          <p class="text-muted" style="font-size:0.9rem; margin-bottom:16px;">
            הדבק כאן את כתובת ה-Web App שקיבלת לאחר פריסת ה-Apps Script.
            זו כתובת פרטית — שמור אותה בסוד.
          </p>

          <input
            type="url"
            id="gas-url-input"
            placeholder="https://script.google.com/macros/s/..."
            style="
              width: 100%;
              padding: 12px 14px;
              font-size: 0.95rem;
              border: 2px solid var(--color-border);
              border-radius: var(--radius-md);
              background: var(--color-bg);
              color: var(--color-text);
              direction: ltr;
              text-align: left;
              margin-bottom: 12px;
              box-sizing: border-box;
            "
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          >

          <button class="btn btn-primary btn-full" id="ping-btn">
            בדוק חיבור
          </button>
        </div>

        <div id="ping-result" class="mt-16"></div>

        <details style="margin-top: 24px;">
          <summary style="cursor:pointer; color:var(--color-text-muted); font-size:0.9rem;">
            לא עובד? לחץ לעזרה
          </summary>
          <div class="card mt-8" style="font-size:0.88rem; line-height:1.7;">
            <strong>שלבי בדיקה:</strong><br>
            1. ודא שה-GAS פורס כ-Web App עם גישה: <em>Anyone</em><br>
            2. ודא ש-Execute as מוגדר לחשבון שלך<br>
            3. לאחר שינוי בקוד — פרוס <em>גרסה חדשה</em> (New Deployment)<br>
            4. ודא שה-URL מתחיל ב- <code>https://script.google.com/macros/s/</code><br>
            <br>
            <strong>שגיאת CORS?</strong><br>
            פתח Console (F12) ודווח את השגיאה המדויקת.
          </div>
        </details>
      </div>
    `;

    const input    = document.getElementById('gas-url-input');
    const btn      = document.getElementById('ping-btn');
    const resultEl = document.getElementById('ping-result');

    const existing = API.getGasUrl();
    if (existing) input.value = existing;

    btn.addEventListener('click', () => this._runPingTest(input, btn, resultEl));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._runPingTest(input, btn, resultEl);
    });
  },

  async _runPingTest(input, btn, resultEl) {
    const url = input.value.trim();

    if (!url || !url.startsWith('https://script.google.com/')) {
      resultEl.innerHTML = `
        <div class="error-banner">
          הכתובת אינה תקינה. היא חייבת להתחיל ב-<br>
          <code>https://script.google.com/macros/s/</code>
        </div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'בודק...';
    resultEl.innerHTML = `<p class="text-muted text-center">שולח בקשת ping לשרת...</p>`;

    API.setGasUrl(url);

    try {
      const { data, method } = await API.callGASWithFallback('ping');
      const methodLabel = method === 'plain' ? 'text/plain (ראשי)' : 'url-encoded (גיבוי)';

      resultEl.innerHTML = `
        <div class="card" style="background:#F0FDF4; border-color:#22C55E; text-align:center;">
          <div style="font-size:2rem; margin-bottom:8px;">✓</div>
          <strong style="color:#15803D; font-size:1.1rem;">החיבור תקין!</strong><br>
          <small style="color:#166534;">${data.message}</small><br>
          <small style="color:#94A3B8; font-size:0.8rem;">${data.timestamp}</small><br>
          <small style="color:#6B7280; font-size:0.78rem;">שיטה: ${methodLabel}</small>
          <br><br>
          <button class="btn btn-primary btn-full" id="continue-btn">
            המשך לבחירת משתמש
          </button>
        </div>`;

      document.getElementById('continue-btn').addEventListener('click', () => {
        Views.Setup._renderUserSelection(document.getElementById('app'));
      });

    } catch (err) {
      API.clearGasUrl();

      resultEl.innerHTML = `
        <div class="error-banner">
          <strong>הבדיקה נכשלה</strong><br>
          <span style="font-family:monospace; font-size:0.85rem; word-break:break-all;">
            ${_escHtml(err.message)}
          </span>
        </div>
        <div class="card mt-8" style="font-size:0.85rem; background:var(--color-bg-gray);">
          <strong>מה לבדוק:</strong><br>
          • פתח כלי מפתחים (F12) ← Console<br>
          • חפש שגיאות CORS, network, או 302 redirect<br>
          • ודא שה-GAS פורס כ-Web App עם גישה <em>Anyone</em>
        </div>`;
    }

    btn.disabled = false;
    btn.textContent = 'בדוק חיבור';
  },

  // ── Step 2: User picker ──────────────────────────────────

  async _renderUserSelection(container) {
    container.innerHTML = `
      <div class="page">
        <h1 class="text-center" style="margin-bottom:4px;">הארנק שלי</h1>
        <p class="text-center text-muted" style="margin-bottom:28px;">מי משתמש במכשיר הזה?</p>
        <div id="user-picker-area">
          <p class="text-muted text-center">טוען משתמשים...</p>
        </div>
      </div>
    `;

    const area = document.getElementById('user-picker-area');

    try {
      // callGASWithFallback returns { data, method } — unwrap data
      const { data: users } = await API.callGASWithFallback('getInitialUsers');

      if (!users || users.length === 0) {
        area.innerHTML = `
          <div class="card text-center">
            <p class="text-muted">לא נמצאו משתמשים בגיליון.<br>
            ודא שהרצת את <code>setupSheets()</code> ב-GAS.</p>
          </div>`;
        return;
      }

      const children = users.filter(u => u.userType === 'child');
      const parents  = users.filter(u => u.userType === 'parent');

      let html = '';

      if (children.length > 0) {
        html += `<p class="text-muted" style="font-size:0.88rem; margin-bottom:10px;">ילדים</p>`;
        html += `<div style="display:grid; gap:12px; margin-bottom:20px;">`;
        children.forEach(u => {
          const emoji  = u.gender === 'f' ? '👧' : '👦';
          const theme  = Auth.THEME_CLASS_MAP[u.theme] || Auth.DEFAULT_THEME;
          const accent = _themeAccentColor(theme);
          html += `
            <button class="user-card-btn" data-user-id="${_escHtml(u.userId)}" style="
              display:flex; align-items:center; gap:14px;
              background:var(--color-bg-card);
              border:2px solid ${accent};
              border-radius:var(--radius-lg);
              padding:16px 18px;
              cursor:pointer;
              text-align:right;
              width:100%;
            ">
              <span style="font-size:2.2rem; line-height:1;">${emoji}</span>
              <div style="flex:1;">
                <div style="font-size:1.1rem; font-weight:700; color:var(--color-text);">
                  ${_escHtml(u.displayName)}
                </div>
                <div style="font-size:0.82rem; color:var(--color-text-muted);">
                  ילד/ה • ${_escHtml(u.theme || 'ים וגיבור')}
                </div>
              </div>
              <span style="color:${accent}; font-size:1.1rem;">›</span>
            </button>`;
        });
        html += `</div>`;
      }

      if (parents.length > 0) {
        html += `<p class="text-muted" style="font-size:0.88rem; margin-bottom:10px;">הורים</p>`;
        html += `<div style="display:grid; gap:12px; margin-bottom:20px;">`;
        parents.forEach(u => {
          const emoji = u.gender === 'f' ? '👩' : '👨';
          const noPinBadge = !u.hasPinSet
            ? `<span style="
                font-size:0.72rem; background:#FEF3C7; color:#92400E;
                border-radius:999px; padding:2px 8px; margin-right:6px;
              ">קוד לא הוגדר</span>`
            : '';
          html += `
            <button class="user-card-btn" data-user-id="${_escHtml(u.userId)}" style="
              display:flex; align-items:center; gap:14px;
              background:var(--color-bg-card);
              border:2px solid var(--color-border);
              border-radius:var(--radius-lg);
              padding:16px 18px;
              cursor:pointer;
              text-align:right;
              width:100%;
            ">
              <span style="font-size:2.2rem; line-height:1;">${emoji}</span>
              <div style="flex:1;">
                <div style="font-size:1.1rem; font-weight:700; color:var(--color-text);">
                  ${_escHtml(u.displayName)} ${noPinBadge}
                </div>
                <div style="font-size:0.82rem; color:var(--color-text-muted);">הורה</div>
              </div>
              <span style="color:var(--color-text-muted); font-size:1.1rem;">›</span>
            </button>`;
        });
        html += `</div>`;
      }

      html += `
        <div style="text-align:center; margin-top:8px;">
          <button class="btn btn-ghost" id="change-url-btn"
            style="font-size:0.85rem; padding:8px 16px; min-height:auto;">
            שנה כתובת שרת
          </button>
        </div>`;

      area.innerHTML = html;

      // Build user lookup map and wire cards
      const userMap = {};
      users.forEach(u => { userMap[u.userId] = u; });

      area.querySelectorAll('.user-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const user = userMap[btn.dataset.userId];
          if (user) Views.Setup._onUserSelected(container, user);
        });
      });

      document.getElementById('change-url-btn').addEventListener('click', () => {
        API.clearGasUrl();
        Views.Setup._renderUrlEntry(document.getElementById('app'));
      });

    } catch (err) {
      area.innerHTML = `
        <div class="error-banner">
          <strong>שגיאה בטעינת משתמשים</strong><br>
          <span style="font-size:0.85rem;">${_escHtml(err.message)}</span>
        </div>
        <button class="btn btn-ghost btn-full mt-16" id="retry-users-btn">נסה שוב</button>`;
      document.getElementById('retry-users-btn').addEventListener('click', () => {
        Views.Setup._renderUserSelection(container);
      });
    }
  },

  // ── User tapped ──────────────────────────────────────────

  async _onUserSelected(container, user) {
    // Case A: parent with no PIN yet — show bootstrap form
    if (user.userType === 'parent' && !user.hasPinSet) {
      Views.Setup._renderSetInitialPin(container, user);
      return;
    }

    // Case B: parent — self-verifies own PIN
    // Case C: child — parent verifies on child's behalf
    const promptText = user.userType === 'parent'
      ? `הזן את קוד ההורה שלך, ${_escHtml(user.displayName)}`
      : `הורה יקר, אשר שזה המכשיר של ${_escHtml(user.displayName)}`;

    try {
      const { parentId } = await Auth.requireParentPin(promptText);
      await _setupBindAndNavigate(user, parentId);
    } catch (err) {
      if (err.message !== 'cancelled') {
        _showPickerError(err.message);
      }
    }
  },

  // ── Bootstrap: set first-ever parent PIN ─────────────────

  _renderSetInitialPin(container, user) {
    container.innerHTML = `
      <div class="page">
        <button class="btn btn-ghost" id="back-to-picker-btn"
          style="font-size:0.85rem; padding:8px 12px; min-height:auto; margin-bottom:20px;">
          ← חזרה
        </button>

        <h2 style="margin-bottom:4px;">הגדרת קוד הורה</h2>
        <p class="text-muted" style="margin-bottom:24px;">
          שלום <strong>${_escHtml(user.displayName)}</strong>!
          בחר קוד אישי בן 4–8 ספרות.
        </p>

        <div class="card">
          <label style="display:block; font-size:0.9rem; margin-bottom:6px;">קוד חדש</label>
          <input
            type="password" inputmode="numeric" pattern="[0-9]*"
            maxlength="8" id="new-pin-input" placeholder="••••"
            autocomplete="new-password"
            style="
              width:100%; padding:12px; font-size:1.3rem; letter-spacing:0.3em;
              text-align:center; border:2px solid var(--color-border);
              border-radius:var(--radius-md); background:var(--color-bg);
              color:var(--color-text); box-sizing:border-box; margin-bottom:16px;
            "
          >

          <label style="display:block; font-size:0.9rem; margin-bottom:6px;">אשר קוד</label>
          <input
            type="password" inputmode="numeric" pattern="[0-9]*"
            maxlength="8" id="confirm-pin-input" placeholder="••••"
            autocomplete="new-password"
            style="
              width:100%; padding:12px; font-size:1.3rem; letter-spacing:0.3em;
              text-align:center; border:2px solid var(--color-border);
              border-radius:var(--radius-md); background:var(--color-bg);
              color:var(--color-text); box-sizing:border-box; margin-bottom:8px;
            "
          >

          <p id="set-pin-error"
            style="min-height:1.4em; font-size:0.85rem; color:var(--color-danger); margin:0 0 16px;">
          </p>

          <button class="btn btn-primary btn-full" id="set-pin-btn">
            הגדר קוד ולחץ להמשך
          </button>
        </div>
      </div>
    `;

    document.getElementById('back-to-picker-btn').addEventListener('click', () => {
      Views.Setup._renderUserSelection(document.getElementById('app'));
    });

    const newPinEl     = document.getElementById('new-pin-input');
    const confirmPinEl = document.getElementById('confirm-pin-input');
    const errorEl      = document.getElementById('set-pin-error');
    const setBtn       = document.getElementById('set-pin-btn');

    newPinEl.focus();

    setBtn.addEventListener('click', async () => {
      const newPin     = newPinEl.value.trim();
      const confirmPin = confirmPinEl.value.trim();

      if (!/^\d{4,8}$/.test(newPin)) {
        errorEl.textContent = 'קוד חייב להכיל 4–8 ספרות בלבד.';
        return;
      }
      if (newPin !== confirmPin) {
        errorEl.textContent = 'הקודים אינם תואמים.';
        confirmPinEl.value = '';
        confirmPinEl.focus();
        return;
      }

      setBtn.disabled    = true;
      setBtn.textContent = 'שומר...';
      errorEl.textContent = '';

      try {
        // Save PIN to GAS
        await Auth.setInitialParentPin(user.userId, newPin);

        // Immediately verify to get parentId, then bind device
        // callGASWithFallback returns { data, method } — unwrap data
        const { data: verifyResult } = await API.callGASWithFallback('verifyParentPin', {
          pin:      newPin,
          deviceId: Auth.getDeviceId(),
        });
        if (!verifyResult.valid) throw new Error('הקוד נשמר אך האימות נכשל. נסה שוב.');

        await _setupBindAndNavigate(user, verifyResult.userId);
      } catch (err) {
        errorEl.textContent    = err.message;
        setBtn.disabled        = false;
        setBtn.textContent     = 'הגדר קוד ולחץ להמשך';
      }
    });
  },

};

// ── Module-level helpers ──────────────────────────────────────

/** Bind device identity and navigate to the appropriate dashboard. */
async function _setupBindAndNavigate(user, parentId) {
  await Auth.bindDeviceIdentity(user.userId, parentId);
  App.navigate(user.userType === 'parent' ? 'parent' : 'child');
}

/** Show an error banner above the user picker cards. */
function _showPickerError(message) {
  const area = document.getElementById('user-picker-area');
  if (!area) return;
  const existing = area.querySelector('.picker-error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner picker-error-banner';
  banner.style.marginBottom = '12px';
  banner.innerHTML = `<strong>שגיאה</strong><br>
    <span style="font-size:0.85rem;">${_escHtml(message)}</span>`;
  area.insertBefore(banner, area.firstChild);
}

/** Return a hex accent color for a theme CSS class (for card borders). */
function _themeAccentColor(themeClass) {
  const map = {
    'theme-sea-hero':     '#0EA5E9',
    'theme-purple-space': '#8B5CF6',
    'theme-fire-sun':     '#F97316',
    'theme-forest-mint':  '#10B981',
  };
  return map[themeClass] || '#0EA5E9';
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
