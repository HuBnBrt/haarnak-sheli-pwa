// ─────────────────────────────────────────────────────────────
// views/setup.js — First-install setup screen
//
// Two-step flow:
//
//   Step 1 — GAS URL entry (shown when no URL is stored)
//     Parent enters the GAS Web App URL.
//     App runs a ping test to verify CORS + connectivity.
//     If ping passes, URL is saved to localStorage.
//     This is a blocking gate: nothing else loads until ping succeeds.
//
//   Step 2 — User selection (shown when URL is set, no identity)
//     Phase 0: placeholder message.
//     Phase 1: real user list fetched from GAS + PIN confirmation.
//
// The GAS URL is stored ONLY in localStorage (never in the repo).
// config.js is for local development only and is git-ignored.
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

        <!-- Troubleshooting guide -->
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
            אם הדפדפן מדווח על שגיאת CORS, בדוק את ה-Console (F12) ודווח
            את השגיאה המדויקת לפני שמתקדמים לשלב הבא.
          </div>
        </details>
      </div>
    `;

    const input   = document.getElementById('gas-url-input');
    const btn     = document.getElementById('ping-btn');
    const resultEl = document.getElementById('ping-result');

    // Pre-fill if there's already a URL stored (e.g., user navigated back)
    const existing = API.getGasUrl();
    if (existing) input.value = existing;

    btn.addEventListener('click', () => this._runPingTest(input, btn, resultEl));

    // Allow Enter key in the input
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

    // Temporarily set the URL so callGAS can use it
    API.setGasUrl(url);

    try {
      // callGASWithFallback tries text/plain first, then url-encoded.
      // Returns { data, method: 'plain' | 'urlencoded' }
      const { data, method } = await API.callGASWithFallback('ping');

      const methodLabel = method === 'plain'
        ? 'text/plain (ראשי)'
        : 'url-encoded (גיבוי)';

      // Ping succeeded — CORS works, URL is valid
      resultEl.innerHTML = `
        <div class="card" style="background:#F0FDF4; border-color:#22C55E; text-align:center;">
          <div style="font-size:2rem; margin-bottom:8px;">✓</div>
          <strong style="color:#15803D; font-size:1.1rem;">החיבור תקין!</strong><br>
          <small style="color:#166534;">${data.message}</small><br>
          <small style="color:#94A3B8; font-size:0.8rem;">${data.timestamp}</small><br>
          <small style="color:#6B7280; font-size:0.78rem;">שיטה: ${methodLabel}</small>
          <br><br>
          <button class="btn btn-primary btn-full" id="continue-btn">
            המשך להגדרת משתמשים
          </button>
        </div>`;

      document.getElementById('continue-btn').addEventListener('click', () => {
        // GAS URL already saved. Move to user selection.
        Views.Setup._renderUserSelection(document.getElementById('app'));
      });

    } catch (err) {
      // Ping failed — clear the URL so we don't accidentally lock in a bad one
      API.clearGasUrl();

      resultEl.innerHTML = `
        <div class="error-banner">
          <strong>הבדיקה נכשלה</strong><br>
          <span style="font-family:monospace; font-size:0.85rem; word-break:break-all;">
            ${_escapeHtml(err.message)}
          </span>
        </div>
        <div class="card mt-8" style="font-size:0.85rem; background:var(--color-bg-gray);">
          <strong>מה לבדוק:</strong><br>
          • פתח את כלי המפתחים (F12) ← Console<br>
          • חפש שגיאות CORS, network, או 302 redirect<br>
          • ודא שה-GAS פורס כ-Web App עם גישה <em>Anyone</em><br>
          • העתק את השגיאה המדויקת לדיווח
        </div>`;
    }

    btn.disabled = false;
    btn.textContent = 'בדוק חיבור';
  },

  // ── Step 2: User selection ────────────────────────────────

  _renderUserSelection(container) {
    const gasUrl = API.getGasUrl();
    const shortUrl = gasUrl ? gasUrl.slice(0, 60) + '...' : '';

    container.innerHTML = `
      <div class="page">
        <h1 class="text-center" style="margin-bottom:6px;">הארנק שלי</h1>
        <p class="text-center text-muted" style="margin-bottom:32px;">
          מי משתמש במכשיר הזה?
        </p>

        <div class="card text-center">
          <span class="empty-state-icon">👛</span>
          <p class="text-muted">
            רשימת המשתמשים תוצג כאן.<br>
            <em>(Phase 1)</em>
          </p>
        </div>

        <!-- Dev info + reset option -->
        <div class="card card-gray mt-24" style="font-size:0.82rem;">
          <strong>מצב Phase 0 — חיבור תקין ✓</strong><br>
          <span style="word-break:break-all; font-family:monospace;">
            ${_escapeHtml(shortUrl)}
          </span>
          <br><br>
          <button class="btn btn-ghost" id="change-url-btn" style="font-size:0.85rem; padding:8px 16px; min-height:auto;">
            שנה כתובת שרת
          </button>
        </div>
      </div>
    `;

    document.getElementById('change-url-btn').addEventListener('click', () => {
      API.clearGasUrl();
      Views.Setup._renderUrlEntry(document.getElementById('app'));
    });
  },

};

// ── Helpers ──────────────────────────────────────────────────
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
