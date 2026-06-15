// ─────────────────────────────────────────────────────────────
// views/parent-dashboard.js — Parent mode home screen
// Phase 1: identity display, device reset, back to child.
// Full parent management UI in Phase 8.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ParentDashboard = {

  render(container) {
    const identity = Auth.getIdentity();
    const name     = identity ? identity.displayName : 'הורה';

    container.innerHTML = `
      <div class="page">

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 2px;">שלום, ${_pdEscHtml(name)}!</h2>
            <p class="text-muted" style="margin:0; font-size:0.88rem;">מצב הורה</p>
          </div>
          <button class="btn btn-ghost" id="back-to-child-btn"
            style="font-size:0.82rem; padding:8px 12px; min-height:auto;">
            ← ילד
          </button>
        </div>

        <!-- Management sections (Phase 8 stubs) -->
        <div class="card" style="margin-bottom:12px;">
          <div class="section-title">ניהול ילדים</div>
          <p class="text-muted" style="font-size:0.9rem;">
            <em>יתרות, אישור מטלות, העברות — Phase 3–7</em>
          </p>
        </div>

        <div class="card" style="margin-bottom:12px;">
          <div class="section-title">הגדרות</div>
          <p class="text-muted" style="font-size:0.9rem;">
            <em>דמי כיס, בונוס, מטבעות — Phase 8</em>
          </p>
        </div>

        <div class="card" style="margin-bottom:24px;">
          <div class="section-title">יומן פעולות</div>
          <p class="text-muted" style="font-size:0.9rem;">
            <em>כל הפעולות מתועדות ב-Google Sheets — Phase 8</em>
          </p>
        </div>

        <!-- Device reset -->
        <div style="text-align:center; padding-top:8px; border-top:1px solid var(--color-border);">
          <button class="btn btn-ghost" id="reset-device-btn"
            style="font-size:0.82rem; color:var(--color-text-muted); padding:8px 16px; min-height:auto;">
            החלף משתמש / איפוס מכשיר
          </button>
        </div>

      </div>
    `;

    // ── Back to child view ───────────────────────────────────
    document.getElementById('back-to-child-btn').addEventListener('click', () => {
      App.navigate('child');
    });

    // ── Device reset ─────────────────────────────────────────
    document.getElementById('reset-device-btn').addEventListener('click', async () => {
      try {
        await Auth.resetDeviceIdentity();   // shows PIN modal, calls GAS, clears identity
        App.navigate('setup');
      } catch (err) {
        if (err.message !== 'cancelled') {
          alert('שגיאה באיפוס: ' + err.message);
        }
      }
    });
  },

};

function _pdEscHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
