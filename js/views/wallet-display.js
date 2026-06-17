// ─────────────────────────────────────────────────────────────
// views/wallet-display.js — Physical wallet display + child editor
//
// ── Two modes ────────────────────────────────────────────────
//   Read-only:   WalletDisplay.renderReadOnly(el, userId)
//                Shows denomination stacks and a "ספרתי את הארנק" button.
//
//   Child editor: launched inline when the child taps the button above.
//                Coin/bill visuals + +/− steppers + live total.
//                Calls GAS `countWallet` (no PIN required).
//                On success, returns to read-only with fresh data.
//
// This is not a route — it renders asynchronously into a provided element.
//
// Audit source: 'child' (countWallet) vs 'parent' (updatePhysicalWallet)
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────

'use strict';

window.WalletDisplay = {

  /**
   * Fetch wallet data and render denomination stacks + "ספרתי את הארנק" button.
   *
   * @param {HTMLElement} el     — element to render into (already in DOM)
   * @param {string}      userId — child's user ID
   */
  async renderReadOnly(el, userId) {
    el.innerHTML = _wdSpinnerHTML('טוען ארנק...');

    try {
      const { data } = await API.callGASWithFallback('getWalletDenominations', { userId });
      el.innerHTML = _buildReadOnlyHTML(data.counts, data.totalAgorot);
      _wdSetCardTitle('יש לי בארנק');

      // Wire "ספרתי את הארנק" button
      const btn = el.querySelector('#wd-count-btn');
      if (btn) {
        btn.addEventListener('click', () => _renderCountEditor(el, userId));
      }

      // Wire "קנייה בחנות" button — launches PurchaseHelper (Phase 5)
      const purchaseBtn = el.querySelector('#wd-purchase-btn');
      if (purchaseBtn) {
        purchaseBtn.addEventListener('click', () => {
          const identity = window.Auth ? Auth.getIdentity() : null;
          const gender   = identity ? (identity.gender || 'm') : 'm';
          if (window.PurchaseHelper) {
            PurchaseHelper.start(el, userId, gender, () =>
              WalletDisplay.renderReadOnly(el, userId));
          }
        });
      }
    } catch (err) {
      el.innerHTML = `
        <p style="color: var(--color-danger); font-size: 0.85rem; margin: 6px 0 0;">
          שגיאה: ${_wdEsc(err.message)}
        </p>`;
    }
  },

};

// ── Read-only display ─────────────────────────────────────────

function _buildReadOnlyHTML(counts, totalAgorot) {
  // 2-column grid layout; each card is a RTL row: image (right) + info (left).
  // Child denominations (7): 10ag, 50ag, 1₪, 2₪, 5₪, 10₪, 20₪ — all shown, dimmed at zero.
  // Large bills (50₪, 100₪, 200₪): full-width cards, only shown if present.
  const CHILD_DENOMS = [10, 50, 100, 200, 500, 1000, 2000]; // ascending
  const LARGE_BILLS  = [5000, 10000, 20000];

  const isEmpty = totalAgorot === 0;

  function getD(agorot) {
    return Currency.DENOMINATIONS.find(d => d.agorot === agorot);
  }

  // Each card: RTL row — image sits RIGHT (first in HTML), info sits LEFT (second in HTML).
  function denomCardHTML(agorot, isCoin, fullWidth) {
    const d = getD(agorot);
    if (!d) return '';
    const count    = _getCount(counts, agorot);
    const subTotal = count * agorot;
    const hasVal   = count > 0;

    const bg      = hasVal ? (isCoin ? '#FEF9C3' : '#ECFDF5') : 'var(--color-bg-subtle,#F8FAFC)';
    const border  = hasVal ? (isCoin ? '#D97706' : '#34D399') : 'var(--color-border)';
    const textCol = hasVal ? (isCoin ? '#92400E' : '#065F46') : 'var(--color-text-muted)';
    // Larger images: coins 62px, bills 68px (comparable visual height)
    const imgH    = isCoin ? 62 : 68;
    const imgHTML = _wdDenomImg(agorot, isCoin, imgH);

    return `
      <div style="
        ${fullWidth ? 'grid-column:span 2;' : ''}
        display:flex;flex-direction:row;align-items:center;gap:10px;
        padding:10px 12px;border-radius:14px;
        background:${bg};border:1.5px solid ${border};
        opacity:${hasVal ? '1' : '0.38'};min-width:0;
      ">
        <!-- Image: first in HTML = rightmost in RTL row -->
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;${isCoin ? `width:${imgH}px;` : 'min-width:0;max-width:140px;'}">
          ${imgHTML || `<span style="font-size:0.9rem;font-weight:800;color:${textCol};">${_wdEsc(d.labelHe)}</span>`}
        </div>
        <!-- Info: second in HTML = leftmost in RTL row -->
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;">
          <div style="font-size:1.0rem;font-weight:900;color:${textCol};white-space:nowrap;line-height:1.2;">${_wdEsc(d.labelHe)}</div>
          <div style="font-weight:800;font-size:1.25rem;color:${textCol};line-height:1.15;">${count}</div>
          ${hasVal ? `<div style="font-size:0.85rem;font-weight:700;color:${textCol};white-space:nowrap;">= ${Currency.formatILS(subTotal)}</div>` : ''}
        </div>
      </div>`;
  }

  const presentLargeBills = LARGE_BILLS.filter(a => _getCount(counts, a) > 0);

  const denomGridHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px;">
      ${CHILD_DENOMS.map((a, i) => {
        const isCoin = a <= 1000; // 10ag through 10₪ are coins; 20₪ is a bill
        // 20₪ (last) spans full width when there's an odd count
        const isLast = i === CHILD_DENOMS.length - 1;
        const span   = isLast && (CHILD_DENOMS.length % 2 === 1);
        return denomCardHTML(a, isCoin, span);
      }).join('')}
      ${presentLargeBills.map(a => denomCardHTML(a, false, true)).join('')}
    </div>`;

  return `
    <div style="margin-top: 4px;">
      <!-- Total balance -->
      <div style="
        font-size: 2.1rem; font-weight: 800;
        color: var(--color-primary, #0EA5E9);
        letter-spacing: -0.5px; line-height: 1.1; margin-bottom: 2px;
      ">${Currency.formatILS(totalAgorot)}</div>

      ${isEmpty
        ? `<p style="color:var(--color-text-muted);font-size:0.9rem;margin:10px 0 4px;">
             הארנק הפיזי ריק כרגע.
           </p>`
        : denomGridHTML}

      <!-- Action buttons: side by side -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
        <button id="wd-count-btn"
          style="
            padding: 13px 10px;
            background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%);
            color: #fff; border: none; border-radius: 14px;
            font-size: 0.88rem; font-weight: 800;
            cursor: pointer; box-shadow: 0 3px 10px rgba(14,165,233,0.28);
            transition: transform 0.12s; font-family: inherit;
            display: flex; align-items: center; justify-content: center; gap: 5px;
          "
          onmousedown="this.style.transform='scale(0.97)'"
          onmouseup="this.style.transform=''"
          onmouseleave="this.style.transform=''"
          type="button">
          🪙 עדכון ארנק
        </button>
        <button id="wd-purchase-btn"
          style="
            padding: 13px 10px;
            background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
            color: #fff; border: none; border-radius: 14px;
            font-size: 0.88rem; font-weight: 800;
            cursor: pointer; box-shadow: 0 3px 10px rgba(22,163,74,0.26);
            transition: transform 0.12s; font-family: inherit;
            display: flex; align-items: center; justify-content: center; gap: 5px;
          "
          onmousedown="this.style.transform='scale(0.97)'"
          onmouseup="this.style.transform=''"
          onmouseleave="this.style.transform=''"
          type="button">
          <span style="background:rgba(255,255,255,0.3);border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:0.9rem;">🛒</span> קנייה
        </button>
      </div>
    </div>`;
}

/**
 * Render one denomination section (coins or bills).
 * Only renders denominations with count > 0.
 */
function _sectionHTML(label, denoms, counts, bg, border, textColor, icon) {
  const active = denoms.filter(d => _getCount(counts, d.agorot) > 0);
  if (active.length === 0) return '';

  const pills = active.map(d => {
    const count    = _getCount(counts, d.agorot);
    const subtotal = count * d.agorot;
    const isCoin   = d.type === 'coin';
    const imgHTML  = _wdDenomImg(d.agorot, isCoin);
    return `
      <div style="
        background: ${bg};
        border: 1.5px solid ${border};
        border-radius: 12px;
        padding: 10px 10px 8px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 64px;
        cursor: default;
      ">
        <div style="height: 40px; display: flex; align-items: center; justify-content: center;">
          ${imgHTML || `<span style="font-size: 1.3rem;">${icon}</span>`}
        </div>
        <div style="
          font-weight: 900;
          font-size: 1.15rem;
          color: ${textColor};
          line-height: 1;
        ">${count}</div>
        <div style="
          font-size: 0.8rem;
          color: ${textColor};
          font-weight: 700;
          white-space: nowrap;
        ">${_wdEsc(d.labelHe)}</div>
        <div style="
          font-size: 0.72rem;
          color: ${textColor};
          opacity: 0.65;
          white-space: nowrap;
        ">= ${Currency.formatILS(subtotal)}</div>
      </div>`;
  }).join('');

  return `
    <div style="margin-top: 14px;">
      <div style="
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
        margin-bottom: 8px;
      ">${label}</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; direction: rtl;">
        ${pills}
      </div>
    </div>`;
}

// ── Child count editor ────────────────────────────────────────

/**
 * Replace the read-only display with a child-friendly denomination editor.
 * No PIN required. Calls countWallet on save, then returns to read-only.
 */
function _renderCountEditor(el, userId) {
  // Build initial counts from whatever is currently displayed.
  // We'll refetch to get authoritative values.
  _renderEditorShell(el, userId, null);
}

async function _renderEditorShell(el, userId, existingCounts) {
  _wdSetCardTitle('🪙 עדכון הארנק');
  // Show loading shell while we fetch current counts (if not passed in)
  el.innerHTML = `
    <div style="margin-top: 4px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="wd-editor-back" type="button" aria-label="חזרה"
          style="background:#F1F5F9;border:1.5px solid #E2E8F0;font-size:1.3rem;font-weight:900;cursor:pointer;
            padding:4px 10px;border-radius:10px;color:var(--color-text-muted);line-height:1;"><span style="display:inline-block;transform:scaleX(-1)">↩</span></button>
        <div style="font-size:1.1rem;font-weight:800;color:var(--color-text);">🪙 עדכון תכולת הארנק שלי</div>
      </div>
      ${_wdSpinnerHTML('טוען...')}
    </div>`;

  document.getElementById('wd-editor-back')
    .addEventListener('click', () => WalletDisplay.renderReadOnly(el, userId));

  let counts = existingCounts;
  if (!counts) {
    try {
      const { data } = await API.callGASWithFallback('getWalletDenominations', { userId });
      counts = data.counts;
    } catch (err) {
      el.innerHTML = `
        <p style="color: var(--color-danger); font-size: 0.85rem; margin: 6px 0 0;">
          שגיאה בטעינת הארנק: ${_wdEsc(err.message)}
        </p>`;
      return;
    }
  }

  _renderEditorForm(el, userId, counts);
}

function _renderEditorForm(el, userId, counts) {
  // 2-column visual grid. Each card: large image (top), label, then compact stepper.
  // Child denominations + bills all in one unified grid (ascending).
  const ALL_DENOMS_ASC = Currency.DENOMINATIONS.slice().reverse(); // 10ag → 200₪

  function _denomCard(d) {
    const isCoin = d.type === 'coin';
    const count  = _getCount(counts, d.agorot);
    const bg     = isCoin ? '#FEF9C3' : '#ECFDF5';
    const border = isCoin ? '#D97706' : '#34D399';
    const color  = isCoin ? '#92400E' : '#065F46';
    const icon   = isCoin ? '🪙' : '💵';
    // Larger images in editor: coins 56px, bills 54px (comparable height)
    const imgH   = isCoin ? 56 : 54;
    const imgHTML = _wdDenomImg(d.agorot, isCoin, imgH);

    return `
      <div style="
        background:${bg};border:1.5px solid ${border};border-radius:14px;
        padding:10px 6px 8px;display:flex;flex-direction:column;
        align-items:center;gap:4px;
      ">
        <!-- Large image -->
        <div style="height:${imgH}px;display:flex;align-items:center;justify-content:center;">
          ${imgHTML || `<span style="font-size:1.4rem;">${icon}</span>`}
        </div>
        <!-- Label -->
        <div style="font-size:0.82rem;font-weight:800;color:${color};white-space:nowrap;">
          ${_wdEsc(d.labelHe)}
        </div>
        <!-- Stepper: compact − / count / + -->
        <div style="display:flex;align-items:center;gap:3px;width:100%;justify-content:center;">
          <button class="wd-minus" data-denom="${d.agorot}" type="button"
            aria-label="פחות"
            style="width:32px;height:32px;border-radius:8px;border:1.5px solid var(--color-border);
              background:var(--color-bg);font-size:1.2rem;font-weight:700;cursor:pointer;
              color:var(--color-text-muted);display:flex;align-items:center;justify-content:center;
              flex-shrink:0;">−</button>
          <input type="number" min="0" max="999" data-denom="${d.agorot}" value="${count}"
            inputmode="numeric"
            style="width:44px;text-align:center;padding:4px 2px;
              border:1.5px solid var(--color-border);border-radius:8px;
              background:var(--color-bg);color:var(--color-text);
              font-size:1.05rem;font-weight:800;font-family:inherit;">
          <button class="wd-plus" data-denom="${d.agorot}" type="button"
            aria-label="יותר"
            style="width:32px;height:32px;border-radius:8px;border:1.5px solid #0EA5E9;
              background:#EFF6FF;font-size:1.2rem;font-weight:700;cursor:pointer;
              color:#0EA5E9;display:flex;align-items:center;justify-content:center;
              flex-shrink:0;">+</button>
        </div>
        <!-- Subtotal -->
        <div id="wd-sub-${d.agorot}" style="font-size:0.72rem;font-weight:600;color:${color};min-height:0.9em;">
          ${count > 0 ? '= ' + Currency.formatILS(count * d.agorot) : ''}
        </div>
      </div>`;
  }

  _wdSetCardTitle('🪙 עדכון הארנק');
  el.innerHTML = `
    <div style="margin-top:4px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <button id="wd-editor-back" type="button" aria-label="חזרה"
          style="background:#F1F5F9;border:1.5px solid #E2E8F0;font-size:1.3rem;font-weight:900;cursor:pointer;
            padding:4px 10px;border-radius:10px;color:var(--color-text-muted);line-height:1;"><span style="display:inline-block;transform:scaleX(-1)">↩</span></button>
        <div style="font-size:1.1rem;font-weight:800;color:var(--color-text);">🪙 עדכון תכולת הארנק שלי</div>
      </div>

      <p style="font-size:0.85rem;color:var(--color-text-muted);margin:0 0 12px;line-height:1.5;">
        ספרו כמה יש מכל סוג וכתבו כאן את המספר:
      </p>

      <!-- 2-column denomination grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
        ${ALL_DENOMS_ASC.map(d => _denomCard(d)).join('')}
      </div>

      <!-- Live total -->
      <div style="padding:14px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
        border-radius:16px;text-align:center;">
        <div style="font-size:0.8rem;color:#1E40AF;font-weight:600;margin-bottom:4px;">סה"כ בארנק שלי</div>
        <div id="wd-editor-total" style="font-size:2.2rem;font-weight:900;color:#0EA5E9;
          line-height:1.1;letter-spacing:-0.5px;">
          ${Currency.formatILS(_calcEditorTotal(el, counts))}
        </div>
      </div>

      <div id="wd-editor-status" style="min-height:1.4em;font-size:0.85rem;
        text-align:center;margin-top:10px;"></div>

      <button id="wd-editor-save" type="button"
        style="margin-top:12px;width:100%;padding:16px;
          background:linear-gradient(135deg,#16A34A 0%,#22C55E 100%);
          color:#fff;border:none;border-radius:16px;
          font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit;
          box-shadow:0 4px 12px rgba(22,163,74,0.30);transition:transform 0.12s;"
        onmousedown="this.style.transform='scale(0.97)'"
        onmouseup="this.style.transform=''"
        onmouseleave="this.style.transform=''">
        לעדכן תכולת הארנק שלי
      </button>
    </div>`;

  // ── Wire up back button ──────────────────────────────────────
  document.getElementById('wd-editor-back')
    .addEventListener('click', () => WalletDisplay.renderReadOnly(el, userId));

  // ── Wire up +/− steppers ─────────────────────────────────────
  el.querySelectorAll('.wd-plus, .wd-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom  = btn.dataset.denom;
      const input  = el.querySelector(`input[data-denom="${denom}"]`);
      if (!input) return;
      const delta  = btn.classList.contains('wd-plus') ? 1 : -1;
      const newVal = Math.max(0, (parseInt(input.value, 10) || 0) + delta);
      input.value  = newVal;
      _updateEditorUI(el);
    });
  });

  // ── Wire up direct input ─────────────────────────────────────
  el.querySelectorAll('input[data-denom]').forEach(input => {
    input.addEventListener('input', () => _updateEditorUI(el));
  });

  // ── Save ─────────────────────────────────────────────────────
  document.getElementById('wd-editor-save').addEventListener('click', async () => {
    const saveBtn  = document.getElementById('wd-editor-save');
    const statusEl = document.getElementById('wd-editor-status');
    if (!saveBtn || !statusEl) return;

    // Collect counts
    const newCounts = {};
    el.querySelectorAll('input[data-denom]').forEach(input => {
      newCounts[parseInt(input.dataset.denom, 10)] =
        Math.max(0, parseInt(input.value, 10) || 0);
    });

    saveBtn.disabled    = true;
    saveBtn.textContent = 'שומר...';
    statusEl.style.color = 'var(--color-text-muted)';
    statusEl.textContent = '';

    try {
      await API.callGASWithFallback('countWallet', { userId, counts: newCounts });
      // Return to read-only with fresh data
      await WalletDisplay.renderReadOnly(el, userId);
    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'שגיאה: ' + _wdEsc(err.message);
      saveBtn.textContent  = 'לעדכן תכולת הארנק שלי';
      saveBtn.disabled     = false;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Recalculate live total and update the total display + subtotals.
 */
function _updateEditorUI(el) {
  let total = 0;
  el.querySelectorAll('input[data-denom]').forEach(input => {
    const denom = parseInt(input.dataset.denom, 10);
    const count = Math.max(0, parseInt(input.value, 10) || 0);
    total += denom * count;

    // Update subtotal label for this denomination
    const subEl = document.getElementById('wd-sub-' + denom);
    if (subEl) {
      subEl.textContent = count > 0 ? '= ' + Currency.formatILS(count * denom) : '';
    }
  });

  const totalEl = document.getElementById('wd-editor-total');
  if (totalEl) totalEl.textContent = Currency.formatILS(total);
}

/**
 * Calculate initial total from saved counts (before any edits).
 * Called once when rendering the form.
 */
function _calcEditorTotal(el, counts) {
  let total = 0;
  Currency.DENOMINATIONS.forEach(d => {
    total += d.agorot * _getCount(counts, d.agorot);
  });
  return total;
}

/** Read count from object that may use number or string keys. */
function _getCount(counts, agorot) {
  const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
  return Math.max(0, parseInt(v, 10) || 0);
}

/**
 * Renders a denomination image.
 * @param {number}  agorot
 * @param {boolean} isCoin  — used as fallback height if h not provided
 * @param {number}  [h]     — explicit height in px (overrides default)
 */
function _wdDenomImg(agorot, isCoin, h) {
  const MAP = {
    10:    './gfx/Agorot-10.png',
    50:    './gfx/Agorot-50.png',
    100:   './gfx/Sheqel-001.png',
    200:   './gfx/Sheqel-002.png',
    500:   './gfx/Sheqel-005.png',
    1000:  './gfx/Sheqel-010.png',
    2000:  './gfx/Sheqel-020.png',
    5000:  './gfx/Sheqel-050.png',
    10000: './gfx/Sheqel-100.png',
    20000: './gfx/Sheqel-200.png',
  };
  const src = MAP[agorot];
  if (!src) return '';
  const height = h || (isCoin ? 38 : 26);
  // Coins are circular: limit max-width to diameter. Bills are landscape: allow natural width.
  const maxW = isCoin ? `${height + 4}px` : '160px';
  return `<img src="${src}" style="height:${height}px;width:auto;max-width:${maxW};display:block;object-fit:contain;" alt="" draggable="false" loading="lazy">`;
}

/** Animated loading spinner for use in wallet views. */
function _wdSpinnerHTML(msg) {
  return `
    <div style="text-align:center;padding:28px 0 16px;">
      <div style="
        width:36px;height:36px;border-radius:50%;
        border:3.5px solid var(--color-border,#E2E8F0);
        border-top-color:var(--color-primary,#0EA5E9);
        margin:0 auto 10px;
        animation:ph-spin 0.8s linear infinite;
      "></div>
      <p style="color:var(--color-text-muted);font-size:0.88rem;margin:0;">${_wdEsc(msg || 'טוען...')}</p>
    </div>`;
}

/** Update the outer wallet card section title (shared with purchase-helper). */
function _wdSetCardTitle(title) {
  const el = document.getElementById('wallet-section-title');
  if (!el) return;
  // Reset any inline style changes made by purchase-helper (flex, gap, etc.)
  el.style.cssText = 'margin-bottom: 6px;';
  el.textContent   = title;
}

function _wdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
