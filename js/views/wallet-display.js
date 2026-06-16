// ─────────────────────────────────────────────────────────────
// views/wallet-display.js — Physical wallet read-only display
//
// Used by child-dashboard.js to render denomination stacks.
// Not a route — renders asynchronously into a provided element.
//
// Usage:
//   await WalletDisplay.renderReadOnly(containerEl, userId);
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────

'use strict';

window.WalletDisplay = {

  /**
   * Fetch wallet data and render denomination stacks into el.
   * Shows an inline loading state, replaces it with content on success.
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
    } catch (err) {
      el.innerHTML = `
        <p style="color: var(--color-danger); font-size: 0.85rem; margin: 6px 0 0;">
          שגיאה: ${_wdEsc(err.message)}
        </p>`;
    }
  },

};

// ── Private: build read-only HTML ─────────────────────────────

function _buildReadOnlyHTML(counts, totalAgorot) {
  const coins = Currency.DENOMINATIONS.filter(d => d.type === 'coin');
  const bills = Currency.DENOMINATIONS.filter(d => d.type === 'bill');

  const coinsHTML = _sectionHTML('מטבעות', coins, counts, '#FEF9C3', '#D97706', '#92400E', '🪙');
  const billsHTML = _sectionHTML('שטרות',  bills, counts, '#ECFDF5', '#34D399', '#065F46', '💵');

  const isEmpty = totalAgorot === 0;

  return `
    <div style="margin-top: 4px;">
      <!-- Total balance -->
      <div style="
        font-size: 2.1rem;
        font-weight: 800;
        color: var(--color-primary, #0EA5E9);
        letter-spacing: -0.5px;
        line-height: 1.1;
        margin-bottom: 2px;
      ">${Currency.formatILS(totalAgorot)}</div>

      ${isEmpty
        ? `<p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 10px 0 0;">
             הארנק הפיזי ריק כרגע.
           </p>`
        : `${coinsHTML}${billsHTML}`
      }
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
    return `
      <div style="
        background: ${bg};
        border: 1.5px solid ${border};
        border-radius: 12px;
        padding: 8px 10px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 60px;
        cursor: default;
      ">
        <div style="font-size: 1.1rem; line-height: 1;">${icon}</div>
        <div style="
          font-weight: 800;
          font-size: 1rem;
          color: ${textColor};
          line-height: 1.1;
        ">${count}×</div>
        <div style="
          font-size: 0.77rem;
          color: ${textColor};
          font-weight: 600;
          white-space: nowrap;
        ">${_wdEsc(d.labelHe)}</div>
        <div style="
          font-size: 0.7rem;
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

// ── Helpers ───────────────────────────────────────────────────

/** Read count from object that may use number or string keys. */
function _getCount(counts, agorot) {
  const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
  return Math.max(0, parseInt(v, 10) || 0);
}

function _wdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
