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
    el.innerHTML = `
      <p style="color: var(--color-text-muted); font-size: 0.88rem; margin: 6px 0 0;">
        ${_wdEsc(window.I18n ? I18n.t('common.loading') : 'טוען...')}
      </p>`;

    try {
      const { data } = await API.callGASWithFallback('getWalletDenominations', { userId });
      el.innerHTML = _buildReadOnlyHTML(data.counts, data.totalAgorot);

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
  // Child wallet denominations displayed in a 4-column CSS grid, ascending (small→large).
  // Row 1: 10ag, 50ag, 1₪, 2₪  (all coins)
  // Row 2: 5₪, 10₪ (1 col each) + 20₪ bill (span 2)
  // Large bills (50₪, 100₪, 200₪): flex row below if present
  const CHILD_COINS_R1 = [10, 50, 100, 200];
  const CHILD_COINS_R2 = [500, 1000];
  const BILL_MAIN      = 2000;
  const LARGE_BILLS    = [5000, 10000, 20000];

  const isEmpty = totalAgorot === 0;

  function getD(agorot) {
    return Currency.DENOMINATIONS.find(d => d.agorot === agorot);
  }

  function denomCellHTML(agorot, isCoin, span) {
    const d = getD(agorot);
    if (!d) return '';
    const count    = _getCount(counts, agorot);
    const subTotal = count * agorot;
    const imgHTML  = _wdDenomImg(agorot, isCoin);
    const hasVal   = count > 0;

    const bg      = hasVal ? (isCoin ? '#FEF9C3' : '#ECFDF5') : 'var(--color-bg-subtle,#F8FAFC)';
    const border  = hasVal ? (isCoin ? '#D97706' : '#34D399') : 'var(--color-border)';
    const textCol = hasVal ? (isCoin ? '#92400E' : '#065F46') : 'var(--color-text-muted)';

    return `
      <div style="
        ${span > 1 ? `grid-column: span ${span};` : ''}
        padding: 8px 4px 6px;
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        border-radius: 10px;
        background: ${bg}; border: 1.5px solid ${border};
        opacity: ${hasVal ? '1' : '0.38'};
        min-width: 0;
      ">
        <div style="height: ${isCoin ? 46 : 32}px; display: flex; align-items: center; justify-content: center; width: 100%;">
          ${imgHTML || `<span style="font-size:0.75rem;font-weight:700;color:${textCol};">${_wdEsc(d.labelHe)}</span>`}
        </div>
        <div style="font-weight:900;font-size:1.5rem;color:${textCol};line-height:1;">${count}</div>
        <div style="font-size:0.64rem;font-weight:700;color:${textCol};white-space:nowrap;text-align:center;">${_wdEsc(d.labelHe)}</div>
        ${hasVal ? `<div style="font-size:0.58rem;color:${textCol};opacity:0.72;white-space:nowrap;text-align:center;">= ${Currency.formatILS(subTotal)}</div>` : ''}
      </div>`;
  }

  const presentLargeBills = LARGE_BILLS.filter(a => _getCount(counts, a) > 0);
  const largeBillsHTML = presentLargeBills.length > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;direction:rtl;">
      ${presentLargeBills.map(a => {
        const d = getD(a);
        const n = _getCount(counts, a);
        return `
          <div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;
            padding:8px 12px;border-radius:10px;background:#ECFDF5;border:1.5px solid #34D399;">
            <div style="height:28px;display:flex;align-items:center;">${_wdDenomImg(a, false)}</div>
            <div style="font-weight:900;font-size:1.3rem;color:#065F46;">${n}</div>
            <div style="font-size:0.68rem;font-weight:700;color:#065F46;">${_wdEsc(d.labelHe)}</div>
            <div style="font-size:0.62rem;color:#065F46;opacity:0.7;">= ${Currency.formatILS(n * a)}</div>
          </div>`;
      }).join('')}
    </div>` : '';

  const denomGridHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px;">
      ${CHILD_COINS_R1.map(a => denomCellHTML(a, true, 1)).join('')}
      ${CHILD_COINS_R2.map(a => denomCellHTML(a, true, 1)).join('')}
      ${denomCellHTML(BILL_MAIN, false, 2)}
    </div>
    ${largeBillsHTML}`;

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
          🛒 קנייה
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
  // Show loading shell while we fetch current counts (if not passed in)
  el.innerHTML = `
    <div style="margin-top: 4px;">
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      ">
        <button
          id="wd-editor-back"
          style="
            background: none;
            border: none;
            font-size: 1.4rem;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 10px;
            color: var(--color-text-muted);
            line-height: 1;
          "
          type="button"
          aria-label="חזרה"
        >←</button>
        <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-text);">
          🪙 עדכון תכולת הארנק שלי
        </div>
      </div>
      <p style="color: var(--color-text-muted); font-size: 0.88rem; text-align: center; padding: 20px 0;">
        טוען...
      </p>
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
  const coins = Currency.DENOMINATIONS.filter(d => d.type === 'coin');
  const bills = Currency.DENOMINATIONS.filter(d => d.type === 'bill');

  // Coins: small→large (ascending), so the child sees 10אג׳ first, then 50, 1₪, etc.
  // Bills: small→large (ascending), 20₪ first, then 50₪, 100₪, 200₪.
  const coinsAsc = coins.slice().reverse();
  const billsAsc = bills.slice().reverse();

  function _denomRow(d, isCoin) {
    const count  = _getCount(counts, d.agorot);
    const bg     = isCoin ? '#FEF9C3' : '#ECFDF5';
    const border = isCoin ? '#D97706' : '#34D399';
    const color  = isCoin ? '#92400E' : '#065F46';
    const icon   = isCoin ? '🪙' : '💵';

    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid var(--color-border);
        gap: 12px;
      ">
        <!-- Denomination visual + label -->
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 90px;
        ">
          <div style="
            width: 52px;
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">${_wdDenomImg(d.agorot, isCoin) || `<span style="font-size:1.4rem;">${icon}</span>`}</div>
          <div>
            <div style="
              font-weight: 800;
              font-size: 1rem;
              color: ${color};
            ">${_wdEsc(d.labelHe)}</div>
            <div id="wd-sub-${d.agorot}" style="
              font-size: 0.72rem;
              color: var(--color-text-muted);
            ">${count > 0 ? '= ' + Currency.formatILS(count * d.agorot) : ''}</div>
          </div>
        </div>

        <!-- Stepper -->
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        ">
          <button
            class="wd-minus"
            data-denom="${d.agorot}"
            style="
              width: 44px; height: 44px;
              border-radius: 12px;
              border: 2px solid var(--color-border);
              background: var(--color-bg);
              font-size: 1.4rem;
              font-weight: 700;
              cursor: pointer;
              color: var(--color-text-muted);
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
              transition: background 0.1s;
            "
            onmousedown="this.style.background='#F3F4F6'"
            onmouseup="this.style.background=''"
            onmouseleave="this.style.background=''"
            type="button"
            aria-label="הפחת ${_wdEsc(d.labelHe)}"
          >−</button>

          <input
            type="number"
            min="0"
            max="999"
            data-denom="${d.agorot}"
            value="${count}"
            inputmode="numeric"
            style="
              width: 58px;
              text-align: center;
              padding: 8px 4px;
              border: 2px solid var(--color-border);
              border-radius: 12px;
              background: var(--color-bg);
              color: var(--color-text);
              font-size: 1.25rem;
              font-weight: 800;
            "
          >

          <button
            class="wd-plus"
            data-denom="${d.agorot}"
            style="
              width: 44px; height: 44px;
              border-radius: 12px;
              border: 2px solid #0EA5E9;
              background: #EFF6FF;
              font-size: 1.4rem;
              font-weight: 700;
              cursor: pointer;
              color: #0EA5E9;
              display: flex; align-items: center; justify-content: center;
              flex-shrink: 0;
              transition: background 0.1s;
            "
            onmousedown="this.style.background='#DBEAFE'"
            onmouseup="this.style.background='#EFF6FF'"
            onmouseleave="this.style.background='#EFF6FF'"
            type="button"
            aria-label="הוסף ${_wdEsc(d.labelHe)}"
          >+</button>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div style="margin-top: 4px;">

      <!-- Header row -->
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      ">
        <button
          id="wd-editor-back"
          style="
            background: none;
            border: none;
            font-size: 1.4rem;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 10px;
            color: var(--color-text-muted);
            line-height: 1;
          "
          type="button"
          aria-label="חזרה"
        >←</button>
        <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-text);">
          🪙 עדכון תכולת הארנק שלי
        </div>
      </div>

      <!-- Instruction -->
      <p style="
        font-size: 0.88rem;
        color: var(--color-text-muted);
        margin: 0 0 14px;
        line-height: 1.5;
      ">
        ספרו כמה יש מכל סוג וכתבו כאן את המספר:
      </p>

      <!-- Coins section -->
      <div style="
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #92400E;
        margin-bottom: 2px;
      ">🪙 מטבעות</div>
      ${coinsAsc.map(d => _denomRow(d, true)).join('')}

      <!-- Bills section -->
      <div style="
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #065F46;
        margin: 16px 0 2px;
      ">💵 שטרות</div>
      ${billsAsc.map(d => _denomRow(d, false)).join('')}

      <!-- Live total -->
      <div style="
        margin-top: 20px;
        padding: 14px;
        background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
        border-radius: 16px;
        text-align: center;
      ">
        <div style="
          font-size: 0.8rem;
          color: #1E40AF;
          font-weight: 600;
          margin-bottom: 4px;
        ">סה"כ בארנק שלי</div>
        <div
          id="wd-editor-total"
          style="
            font-size: 2.2rem;
            font-weight: 900;
            color: #0EA5E9;
            line-height: 1.1;
            letter-spacing: -0.5px;
          "
        >${Currency.formatILS(_calcEditorTotal(el, counts))}</div>
      </div>

      <!-- Status -->
      <div
        id="wd-editor-status"
        style="
          min-height: 1.4em;
          font-size: 0.85rem;
          text-align: center;
          margin-top: 10px;
        "
      ></div>

      <!-- Save button -->
      <button
        id="wd-editor-save"
        style="
          margin-top: 12px;
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
          color: #fff;
          border: none;
          border-radius: 16px;
          font-size: 1.1rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(22,163,74,0.30);
          transition: transform 0.12s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        "
        onmousedown="this.style.transform='scale(0.97)'"
        onmouseup="this.style.transform=''"
        onmouseleave="this.style.transform=''"
        type="button"
      >
        ✓ שמרתי — זה הארנק שלי!
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
      saveBtn.textContent  = '✓ שמרתי — זה הארנק שלי!';
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

/** Maps a denomination's agorot value to a relative image path for GitHub Pages. */
function _wdDenomImg(agorot, isCoin) {
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
  const h = isCoin ? 38 : 26;
  return `<img src="${src}" style="height:${h}px;width:auto;max-width:48px;display:block;object-fit:contain;" alt="" draggable="false" loading="lazy">`;
}

function _wdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
