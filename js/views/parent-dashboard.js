// ─────────────────────────────────────────────────────────────
// views/parent-dashboard.js — Parent device home screen
//
// This view is only reachable when the device is bound to a
// parent user identity. Child devices never reach this view —
// they use Views.ParentControls (inline, PIN-gated) instead.
//
// Full management UI in Phase 8.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ParentDashboard = {

  render(container) {
    const identity = Auth.getIdentity();
    const name     = identity ? identity.displayName : 'הורה';

    container.innerHTML = `
      <div class="page">

        <!-- ── Header ──────────────────────────────────────── -->
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 2px;">שלום, ${_pdEscHtml(name)}!</h2>
          <p class="text-muted" style="margin: 0; font-size: 0.88rem;">
            לוח הורה — ניהול הארנק המשפחתי
          </p>
        </div>

        <!-- ── Management sections (Phase stubs) ───────────── -->

        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title">ניהול ילדים</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>יתרות, אישור מטלות, העברות — Phase 3–7</em>
          </p>
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title">הגדרות</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>דמי כיס, בונוס, הגדרות מטלות — Phase 8</em>
          </p>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <div class="section-title">יומן פעולות</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>כל הפעולות מתועדות ב-Google Sheets — Phase 8</em>
          </p>
        </div>

        <!-- ── Device reset ───────────────────────────────── -->
        <!--
          On a parent device, "reset device" unbinds the parent from
          this device and returns to the user picker.
          Requires parent PIN (same as any sensitive action).
        -->
        <div style="
          text-align: center;
          padding-top: 8px;
          border-top: 1px solid var(--color-border);
        ">
          <button
            class="btn btn-ghost"
            id="pd-reset-device-btn"
            style="font-size: 0.82rem; color: var(--color-text-muted); padding: 8px 16px; min-height: auto;"
          >
            החלף משתמש / איפוס מכשיר
          </button>
        </div>

      </div>
    `;

    // ── Device reset ─────────────────────────────────────────
    document.getElementById('pd-reset-device-btn').addEventListener('click', async () => {
      try {
        await Auth.resetDeviceIdentity();
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
