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

        <!-- ── Wallet editor (Phase 2) ─────────────────────── -->
        <!--
          _pcLoadWalletEditor() populates #pc-wallet-editor async
          after the page shell is already visible.
        -->
        <div class="card" style="margin-bottom: 12px;">
          <div class="section-title" style="margin-bottom: 10px;">
            עדכון ארנק פיזי של ${_pcEscHtml(childName)}
          </div>
          <div id="pc-wallet-editor">
            <p class="text-muted" style="font-size: 0.88rem;">טוען...</p>
          </div>
        </div>

        <!-- ── Phase stubs ────────────────────────────────── -->
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

    // ── Wallet editor: load current denominations ─────────────
    _pcLoadWalletEditor(childIdentity.userId, parentId);
  },

};

// ── Wallet editor ─────────────────────────────────────────────

/**
 * Fetch current wallet and render an editable denomination form
 * into #pc-wallet-editor.
 */
async function _pcLoadWalletEditor(userId, parentId) {
  const el = document.getElementById('pc-wallet-editor');
  if (!el) return;

  try {
    const { data } = await API.callGASWithFallback('getWalletDenominations', { userId });
    _pcRenderWalletForm(el, userId, parentId, data.counts);
  } catch (err) {
    el.innerHTML = `
      <p style="color: var(--color-danger); font-size: 0.85rem;">
        שגיאה בטעינת הארנק: ${_pcEscHtml(err.message)}
      </p>`;
  }
}

/**
 * Render the denomination input form and wire up live total + save.
 */
function _pcRenderWalletForm(el, userId, parentId, counts) {
  const coins = Currency.DENOMINATIONS.filter(d => d.type === 'coin');
  const bills = Currency.DENOMINATIONS.filter(d => d.type === 'bill');

  function _getCount(agorot) {
    const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
    return Math.max(0, parseInt(v, 10) || 0);
  }

  function _denomInputRow(d) {
    const count = _getCount(d.agorot);
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
        <label style="
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-text);
          min-width: 70px;
        ">${_pcEscHtml(d.labelHe)}</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button
            class="pc-denom-minus"
            data-denom="${d.agorot}"
            style="
              width: 32px; height: 32px; border-radius: 8px;
              border: 1.5px solid var(--color-border);
              background: var(--color-bg);
              font-size: 1.1rem; font-weight: 700;
              cursor: pointer; color: var(--color-text-muted);
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
            "
            type="button"
          >−</button>
          <input
            type="number"
            min="0"
            max="999"
            data-denom="${d.agorot}"
            value="${count}"
            style="
              width: 56px; text-align: center;
              padding: 6px 4px;
              border: 1.5px solid var(--color-border);
              border-radius: 8px;
              background: var(--color-bg);
              color: var(--color-text);
              font-size: 1rem;
              font-weight: 700;
            "
          >
          <button
            class="pc-denom-plus"
            data-denom="${d.agorot}"
            style="
              width: 32px; height: 32px; border-radius: 8px;
              border: 1.5px solid var(--color-border);
              background: var(--color-bg);
              font-size: 1.1rem; font-weight: 700;
              cursor: pointer; color: var(--color-primary, #0EA5E9);
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
            "
            type="button"
          >+</button>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div>
      <!-- Coins -->
      <div style="font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 4px;">🪙 מטבעות</div>
      <div style="border-bottom: 1px solid var(--color-border); margin-bottom: 12px;">
        ${coins.slice().reverse().map(_denomInputRow).join('')}
      </div>

      <!-- Bills -->
      <div style="font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 4px;">💵 שטרות</div>
      <div style="border-bottom: 1px solid var(--color-border); margin-bottom: 12px;">
        ${bills.slice().reverse().map(_denomInputRow).join('')}
      </div>

      <!-- Live total -->
      <div id="pc-wallet-total" style="
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-primary, #0EA5E9);
        margin-bottom: 14px;
        text-align: center;
      ">סה"כ: ${Currency.formatILS(_pcCalcTotal(el, counts))}</div>

      <!-- Status / error area -->
      <div id="pc-wallet-status" style="min-height: 1.4em; font-size: 0.85rem; margin-bottom: 10px; text-align: center;"></div>

      <!-- Save -->
      <button
        id="pc-wallet-save-btn"
        class="btn btn-primary btn-full"
        type="button"
      >שמור ארנק</button>
    </div>
  `;

  // ── Wire up +/− steppers ─────────────────────────────────
  el.querySelectorAll('.pc-denom-plus, .pc-denom-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom = btn.dataset.denom;
      const input = el.querySelector(`input[data-denom="${denom}"]`);
      if (!input) return;
      const delta = btn.classList.contains('pc-denom-plus') ? 1 : -1;
      const newVal = Math.max(0, (parseInt(input.value, 10) || 0) + delta);
      input.value = newVal;
      _pcUpdateWalletTotal(el);
    });
  });

  // ── Wire up direct input changes ─────────────────────────
  el.querySelectorAll('input[data-denom]').forEach(input => {
    input.addEventListener('input', () => _pcUpdateWalletTotal(el));
  });

  // ── Save ─────────────────────────────────────────────────
  document.getElementById('pc-wallet-save-btn').addEventListener('click', async () => {
    const saveBtn  = document.getElementById('pc-wallet-save-btn');
    const statusEl = document.getElementById('pc-wallet-status');
    if (!saveBtn || !statusEl) return;

    // Collect current values
    const newCounts = {};
    el.querySelectorAll('input[data-denom]').forEach(input => {
      newCounts[parseInt(input.dataset.denom, 10)] = Math.max(0, parseInt(input.value, 10) || 0);
    });

    saveBtn.disabled    = true;
    saveBtn.textContent = 'שומר...';
    statusEl.style.color = 'var(--color-text-muted)';
    statusEl.textContent = '';

    try {
      const { data } = await API.callGASWithFallback('updatePhysicalWallet', {
        userId,
        parentId,
        counts: newCounts,
      });

      statusEl.style.color = '#16A34A';
      statusEl.textContent = `✓ נשמר! סה"כ: ${Currency.formatILS(data.totalAgorot)}`;
      saveBtn.textContent  = 'שמור ארנק';
      saveBtn.disabled     = false;

    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'שגיאה: ' + err.message;
      saveBtn.textContent  = 'שמור ארנק';
      saveBtn.disabled     = false;
    }
  });
}

/** Recalculate total from current input values and update the total display. */
function _pcUpdateWalletTotal(el) {
  let total = 0;
  el.querySelectorAll('input[data-denom]').forEach(input => {
    const denom = parseInt(input.dataset.denom, 10);
    const count = Math.max(0, parseInt(input.value, 10) || 0);
    total += denom * count;
  });
  const totalEl = document.getElementById('pc-wallet-total');
  if (totalEl) totalEl.textContent = `סה"כ: ${Currency.formatILS(total)}`;
}

/** Calculate initial total from saved counts (before any edits). */
function _pcCalcTotal(el, counts) {
  let total = 0;
  Currency.DENOMINATIONS.forEach(d => {
    const v = counts[d.agorot] != null ? counts[d.agorot] : (counts[String(d.agorot)] ?? 0);
    total += d.agorot * Math.max(0, parseInt(v, 10) || 0);
  });
  return total;
}

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
