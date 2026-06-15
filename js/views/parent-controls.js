// ─────────────────────────────────────────────────────────────
// views/parent-controls.js — Temporary parent controls panel
//
// This is NOT a route. It renders inline inside the child device
// container after a successful parent PIN verification.
//
// ── Authorization model ───────────────────────────────────────
// - Entry requires parent PIN (verified by caller via requireParentPin).
// - Exit ("סיום בקרת הורים") requires NO PIN — the parent just leaves.
// - After exit the child view is re-rendered (parent auth is gone).
// - Entering parent controls again requires a fresh PIN.
// - Device reset within parent controls DOES require PIN again
//   because it is a separate destructive action.
//
// ── What is NOT stored ────────────────────────────────────────
// - parentId and parentName exist only in this function's closure.
// - They are never written to localStorage.
// - They vanish the moment onExit() is called and this view
//   is replaced by the child dashboard.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ParentControls = {

  /**
   * Render the parent controls panel inside container.
   *
   * @param {HTMLElement} container  — the #app element
   * @param {Object}      ctx
   * @param {string}      ctx.parentId       — verified parent user ID (in-memory only)
   * @param {string}      ctx.parentName     — verified parent display name
   * @param {Object}      ctx.childIdentity  — Auth.getIdentity() from the child device
   * @param {Function}    ctx.onExit         — called when parent taps "סיום"; re-renders child view
   */
  render(container, { parentId, parentName, childIdentity, onExit }) {
    const childName = childIdentity ? childIdentity.displayName : '...';

    container.innerHTML = `
      <div class="page">

        <!-- ── Parent-mode banner ─────────────────────────── -->
        <!--
          Card-style: fits inside page padding, rounded corners,
          amber tint — clearly "different mode" but not alarming.
          parentId and parentName exist only in this closure.
        -->
        <div style="
          background: #FFFBEB;
          border: 1.5px solid #FCD34D;
          border-radius: var(--radius-lg, 16px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          padding: 12px 14px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        ">
          <div style="min-width: 0;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #92400E; line-height: 1.3;">
              🔑 בקרת הורים פעילה
            </div>
            <div style="font-size: 0.78rem; color: #B45309; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${_pcEscHtml(parentName)} &nbsp;·&nbsp; ${_pcEscHtml(childName)}
            </div>
          </div>
          <button
            id="exit-parent-controls-btn"
            style="
              background: #FEF3C7;
              border: 1px solid #FCD34D;
              border-radius: var(--radius-md, 10px);
              color: #92400E;
              font-size: 0.82rem;
              font-weight: 600;
              padding: 7px 14px;
              cursor: pointer;
              white-space: nowrap;
              flex-shrink: 0;
              transition: background 0.15s;
            "
            onmouseover="this.style.background='#FDE68A'"
            onmouseout="this.style.background='#FEF3C7'"
          >
            ✕ סיום
          </button>
        </div>

        <!-- ── Controls (Phase stubs) ─────────────────────── -->

        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title">ניהול ארנק</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>עדכון מטבעות ושטרות — Phase 2</em>
          </p>
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title">אישור מטלות ותגמולים</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>אישור השלמת מטלה, חלוקת כסף אפור — Phase 7</em>
          </p>
        </div>

        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title">מתנות ותשלום הורה</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>הפקדת מתנה, תשלום זמני — Phase 6</em>
          </p>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <div class="section-title">מטרות חיסכון</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>הוספה / עדכון / השלמת מטרה — Phase 4</em>
          </p>
        </div>

        <!-- ── Device reset ───────────────────────────────── -->
        <div style="
          text-align: center;
          padding-top: 8px;
          border-top: 1px solid var(--color-border);
        ">
          <button
            class="btn btn-ghost"
            id="pc-reset-device-btn"
            style="font-size: 0.82rem; color: var(--color-text-muted); padding: 8px 16px; min-height: auto;"
          >
            החלף משתמש / איפוס מכשיר
          </button>
        </div>

      </div>
    `;

    // ── Exit: return to child interface, no PIN required ─────
    document.getElementById('exit-parent-controls-btn').addEventListener('click', () => {
      // parentId and parentName are gone the moment onExit replaces this view.
      onExit();
    });

    // ── Device reset: always requires a fresh parent PIN ─────
    document.getElementById('pc-reset-device-btn').addEventListener('click', async () => {
      try {
        // Auth.resetDeviceIdentity() shows the PIN modal internally.
        await Auth.resetDeviceIdentity();
        App.navigate('setup');
      } catch (err) {
        if (err.message !== 'cancelled') {
          _pcShowError(container, 'שגיאה באיפוס: ' + err.message);
        }
      }
    });
  },

};

// ── Helpers ───────────────────────────────────────────────────

function _pcShowError(container, message) {
  // Append a temporary error banner below the banner (best effort)
  const existing = container.querySelector('.pc-error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner pc-error-banner';
  banner.style.cssText = 'margin: 0 0 12px;';
  banner.textContent = message;
  const page = container.querySelector('.page');
  if (page) page.appendChild(banner);
}

function _pcEscHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
