// ─────────────────────────────────────────────────────────────
// views/goals-display.js — Savings goals list + inline creator
//
// ── Public API ────────────────────────────────────────────────
//   GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot)
//
// ── Two distinct concepts on each goal card (spec §9a / §9b) ─
//
//   1. SAVINGS PROGRESS (§9a)
//      Based on the virtual savings account only.
//      Capped at the goal target — never shows more than target.
//      Drives the progress bar.
//
//   2. PURCHASE READINESS (§9b)
//      Based on physical wallet first, then savings.
//      Case A: walletAgorot >= target → "יש מספיק בארנק. אפשר לקנות!"
//      Case B: wallet < target but wallet+savings >= target
//              → "בארנק עוד חסר קצת. אבל יש לך מספיק בחיסכון! ..."
//      Case C: wallet+savings < target
//              → "חסרים עוד X ₪ כדי להגיע למטרה."
//
//   These two concepts must never be merged.
//   No money is moved here. Redemption requires parent PIN (Phase 5).
//
// ── Modes ─────────────────────────────────────────────────────
//   List view:    goal tiles + "הוסף מטרה" button
//   Creator:      inline form (name + price + store + icon picker + camera placeholder)
//   Change icon:  full-view icon picker for existing goal → updateGoal (no PIN)
//
// ── Icon storage ──────────────────────────────────────────────
//   Icons are emoji stored in goals.notes JSON: {"emoji":"🎮","store":"..."}
//   Phase 9 will add imageId to this object.
//
// ── Font ──────────────────────────────────────────────────────
//   All inline styles use font-family: inherit so they pick up the
//   global Assistant font set in main.css.
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────

'use strict';

// ── Curated icon groups ───────────────────────────────────────
// 7 categories × 5 icons = 35 curated icons.
const _GD_ICON_GROUPS = [
  { label: 'משחקים', icons: ['🎮', '🕹️', '🎲', '🎯', '🎳'] },
  { label: 'בובות',  icons: ['🧸', '🪆', '🤖', '🪀', '🎪'] },
  { label: 'ספורט',  icons: ['⚽', '🏀', '🚲', '🛴', '🏊'] },
  { label: 'יצירה',  icons: ['🎨', '🖍️', '✏️', '🎭', '🎬'] },
  { label: 'ספרים',  icons: ['📚', '🎵', '🎸', '🎹', '🎓'] },
  { label: 'חיות',   icons: ['🐶', '🐱', '🦄', '🐠', '🦋'] },
  { label: 'כללי',   icons: ['✈️', '🌟', '🎁', '🏆', '👟'] },
];

window.GoalsDisplay = {

  /**
   * Fetch goals and render into el.
   *
   * @param {HTMLElement} el
   * @param {string}      userId
   * @param {number}      savingsAgorot  — virtual savings balance (spec §9a)
   * @param {number}      walletAgorot   — physical wallet total (spec §9b)
   */
  async render(el, userId, savingsAgorot, walletAgorot) {
    el.innerHTML = _gdLoadingHTML('טוען מטרות...');
    const wAgorot = typeof walletAgorot === 'number' ? walletAgorot : 0;

    try {
      const { data: goals } = await API.callGASWithFallback('getGoals', { userId });
      _gdRenderList(el, userId, savingsAgorot, wAgorot, goals);
    } catch (err) {
      el.innerHTML = `<p style="color:var(--color-danger);font-size:0.82rem;margin:4px 0 0;">
        שגיאה בטעינת המטרות: ${_gdEsc(err.message)}</p>`;
    }
  },

};

// ── List view ─────────────────────────────────────────────────

function _gdRenderList(el, userId, savingsAgorot, walletAgorot, goals) {
  const hasGoals = Array.isArray(goals) && goals.length > 0;

  el.innerHTML = `
    <div>
      ${hasGoals
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
             ${goals.map(g => _gdGoalTileHTML(g, savingsAgorot, walletAgorot)).join('')}
           </div>`
        : `<p style="font-size:0.85rem;color:#4B7A58;margin:0 0 12px;text-align:center;padding:8px 0;">
             עוד אין מטרות — הוסיפו את הראשונה!
           </p>`
      }

      <button id="gd-add-btn" type="button" style="
        width:100%;padding:11px 16px;
        background:rgba(255,255,255,0.6);color:#15803D;
        border:2px dashed #86EFAC;border-radius:14px;
        font-size:0.92rem;font-weight:700;font-family:inherit;
        cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;
        transition:background 0.15s;
      "
        onmousedown="this.style.background='rgba(255,255,255,0.9)'"
        onmouseup="this.style.background='rgba(255,255,255,0.6)'"
        onmouseleave="this.style.background='rgba(255,255,255,0.6)'"
      >➕ הוסף מטרה חדשה</button>
    </div>`;

  document.getElementById('gd-add-btn')
    .addEventListener('click', () => _gdRenderCreator(el, userId, savingsAgorot, walletAgorot));

  // Single delegation for all tile action buttons → modals
  el.addEventListener('click', e => {
    const nameBtn  = e.target.closest('.gd-change-name-btn');
    const priceBtn = e.target.closest('.gd-change-price-btn');
    const iconBtn  = e.target.closest('.gd-change-icon-btn');
    const photoBtn = e.target.closest('.gd-change-photo-btn');

    if (nameBtn) {
      _gdOpenNameModal(el, userId, savingsAgorot, walletAgorot,
        nameBtn.dataset.goalId, nameBtn.dataset.goalTitle);
    } else if (priceBtn) {
      _gdOpenPriceModal(el, userId, savingsAgorot, walletAgorot,
        priceBtn.dataset.goalId, parseInt(priceBtn.dataset.goalTarget, 10) || 0);
    } else if (iconBtn) {
      _gdOpenIconModal(el, userId, savingsAgorot, walletAgorot,
        iconBtn.dataset.goalId, iconBtn.dataset.goalEmoji, iconBtn.dataset.goalTitle, goals);
    } else if (photoBtn) {
      _gdOpenPhotoModal();
    }
  });
}

// ── Goal tile (compact, 2-per-row) ───────────────────────────

/**
 * Build one goal tile's HTML string.
 *
 * Top half:  emoji + title + store
 * Middle:    savings progress bar (§9a)
 * Bottom:    savings pct | purchase readiness msg (§9b) | "שנה סמל"
 */
function _gdGoalTileHTML(goal, savingsAgorot, walletAgorot) {
  const target  = goal.targetAgorot;
  // Guard against undefined/NaN savingsAgorot (§9a: savings only)
  const sAgorot = (typeof savingsAgorot === 'number' && !isNaN(savingsAgorot)) ? savingsAgorot : 0;
  const saved   = Math.min(sAgorot, target); // §9a: capped at target
  const pct     = target > 0 ? Math.min(100, Math.floor(saved * 100 / target)) : 0;

  // §9a: savings progress — red→orange→amber→lime→green spectrum
  const barFill = pct >= 100 ? '#16A34A'
    : pct >= 67  ? '#84CC16'
    : pct >= 40  ? '#F59E0B'
    : pct >= 1   ? '#F97316'
    : '#DC2626';

  // §9b: purchase readiness (uses guarded sAgorot)
  const readiness = _gdPurchaseReadiness(target, sAgorot, walletAgorot);

  const gid = _gdEsc(goal.goalId);

  return `
    <div data-goal-id="${gid}" style="
      background:rgba(255,255,255,0.7);border-radius:14px;
      padding:10px 10px 8px;
      border:1.5px solid ${readiness.caseKey === 'A' ? '#86EFAC' : 'rgba(0,0,0,0.07)'};
      box-shadow:0 1px 4px rgba(0,0,0,0.06);
      display:flex;flex-direction:column;gap:6px;
      min-height:0;overflow:hidden;min-width:0;
    ">
      <!-- Emoji + title row -->
      <div style="display:flex;align-items:flex-start;gap:7px;">
        <div style="
          width:36px;height:36px;flex-shrink:0;border-radius:10px;
          background:${readiness.caseKey === 'A' ? '#DCFCE7' : '#F1F5F9'};
          display:flex;align-items:center;justify-content:center;
          font-size:1.4rem;line-height:1;
        ">${goal.emoji}</div>
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div id="gd-tile-title-${gid}" style="
            font-weight:800;font-size:0.85rem;color:#1E293B;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            line-height:1.25;
          ">${_gdEsc(goal.title)}</div>
<div id="gd-tile-price-${gid}"
            style="font-size:0.72rem;color:#15803D;font-weight:700;margin-top:1px;">
            ${Currency.formatILS(target)}
          </div>
${goal.store ? `<div style="font-size:0.68rem;color:#94A3B8;margin-top:1px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            📍 ${_gdEsc(goal.store)}</div>` : ''}
        </div>
      </div>

      <!-- §9a Savings progress bar -->
      <div>
        <div style="height:6px;background:#E5E7EB;border-radius:99px;overflow:hidden;">
          <div style="
            height:100%;width:${pct}%;background:${barFill};
            border-radius:99px;transition:width 0.4s ease;
          "></div>
        </div>
        <div style="
          font-size:0.68rem;color:#64748B;margin-top:3px;
          display:flex;justify-content:space-between;
        ">
          <span style="font-weight:700;color:${barFill};">${pct}%</span>
          <span>${pct > 0 ? `${Currency.formatILS(saved)} מתוך ${Currency.formatILS(target)}` : `מטרה: ${Currency.formatILS(target)}`}</span>
        </div>
      </div>

      <!-- §9b Purchase readiness message -->
      <div style="
        font-size:0.7rem;line-height:1.35;
        color:${readiness.color};
        background:${readiness.bg};
        border-radius:8px;padding:4px 6px;
        font-weight:${readiness.caseKey === 'A' ? '700' : '500'};
      ">${readiness.msg}</div>

      <!-- Bottom action row -->
      <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center;align-items:center;">
        <button class="gd-change-name-btn" type="button"
          data-goal-id="${gid}"
          data-goal-title="${_gdEsc(goal.title)}"
          style="background:none;border:none;color:#1E293B;font-size:0.72rem;
            cursor:pointer;padding:2px 4px;font-family:inherit;font-weight:600;">✏️ שם</button>
        <span style="color:#94A3B8;font-size:0.68rem;line-height:1;">|</span>
        <button class="gd-change-price-btn" type="button"
          data-goal-id="${gid}"
          data-goal-target="${target}"
          style="background:none;border:none;color:#1E293B;font-size:0.72rem;
            cursor:pointer;padding:2px 4px;font-family:inherit;font-weight:600;">✏️ עדכון מחיר</button>
        <span style="color:#94A3B8;font-size:0.68rem;line-height:1;">|</span>
        <button class="gd-change-icon-btn" type="button"
          data-goal-id="${gid}"
          data-goal-emoji="${_gdEsc(goal.emoji)}"
          data-goal-title="${_gdEsc(goal.title)}"
          style="background:none;border:none;color:#1E293B;font-size:0.72rem;
            cursor:pointer;padding:2px 4px;font-family:inherit;font-weight:600;">🎭 סמל</button>
        <span style="color:#94A3B8;font-size:0.68rem;line-height:1;">|</span>
        <button class="gd-change-photo-btn" type="button"
          data-goal-id="${gid}"
          style="background:none;border:none;color:#1E293B;font-size:0.72rem;
            cursor:pointer;padding:2px 4px;font-family:inherit;font-weight:600;">📷 תמונה</button>
      </div>
    </div>`;
}

/**
 * Compute purchase readiness for a goal (spec §9b).
 *
 * Redemption from savings to wallet is only done in 10 ₪ increments (1000 agorot).
 * So Case B uses the next 10 ₪ ceiling of the wallet shortfall, not the exact amount.
 *
 * Case A: walletAgorot >= target
 *         → "יש מספיק בארנק. אפשר לקנות!"
 *
 * Case B: walletAgorot < target
 *         AND savingsAgorot >= recommendedRedeemAgorot
 *         where recommendedRedeemAgorot = Math.ceil(walletShortfall / 1000) * 1000
 *         → "...להעביר X ₪ מהחיסכון לארנק." (X = recommendedRedeemAgorot)
 *
 *         Edge case: if savings < recommendedRedeemAgorot even though
 *         wallet+savings >= target, fall through to C — we can't suggest
 *         a redemption increment the savings account can't cover.
 *
 * Case C: everything else → combined shortfall still message
 *
 * @param {number} target         — goal target in agorot
 * @param {number} savingsAgorot  — virtual savings balance
 * @param {number} walletAgorot   — physical wallet total
 * @returns {{ caseKey: 'A'|'B'|'C', msg: string, color: string, bg: string }}
 */
function _gdPurchaseReadiness(target, savingsAgorot, walletAgorot) {
  const wallet  = typeof walletAgorot  === 'number' ? walletAgorot  : 0;
  const savings = typeof savingsAgorot === 'number' ? savingsAgorot : 0;

  if (wallet >= target) {
    // Case A: wallet alone covers it
    return {
      caseKey: 'A',
      msg:   '✓ יש מספיק בארנק. אפשר לקנות!',
      color: '#15803D',
      bg:    '#DCFCE7',
    };
  }

  // How much cash the wallet is short (exact)
  const walletShortfall = target - wallet;

  // Redemptions happen in 10 ₪ (1000 agorot) increments.
  // Round the shortfall UP to the nearest 10 ₪.
  const REDEEM_INCREMENT = 1000; // 10 ₪ in agorot
  const recommendedRedeemAgorot = Math.ceil(walletShortfall / REDEEM_INCREMENT) * REDEEM_INCREMENT;

  if (savings >= recommendedRedeemAgorot) {
    // Case B: savings can cover the rounded-up increment needed
    return {
      caseKey: 'B',
      msg:   `בארנק עוד חסר קצת. אבל יש לך מספיק בחיסכון! אפשר לבקש מאבאמא להעביר ${Currency.formatILS(recommendedRedeemAgorot)} מהחיסכון לארנק.`,
      color: '#92400E',
      bg:    '#FEF3C7',
    };
  }
  // Note: we do NOT fall into B even if wallet+savings >= target, as long as
  // savings < recommendedRedeemAgorot. The 10 ₪ minimum increment cannot be met.

  // Case C: still not enough even combined
  const totalShortfall = target - wallet - savings;
  return {
    caseKey: 'C',
    msg:   `חסרים עוד ${Currency.formatILS(totalShortfall)} כדי להגיע למטרה.`,
    color: '#64748B',
    bg:    '#F1F5F9',
  };
}

// ── Creator (new goal form) ───────────────────────────────────

function _gdRenderCreator(el, userId, savingsAgorot, walletAgorot) {
  let selectedEmoji = '🎯';

  el.innerHTML = `
    <div>
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="gd-creator-back" type="button" style="
          background:none;border:none;font-size:1.4rem;cursor:pointer;
          padding:4px 8px;border-radius:10px;color:var(--color-text-muted);line-height:1;
          font-family:inherit;
        " aria-label="חזרה"><span style="display:inline-block;transform:scaleX(-1)">↩</span></button>
        <div style="font-size:1.0rem;font-weight:800;color:#15803D;">🎯 מטרה חדשה</div>
      </div>

      <!-- Goal name -->
      <div style="margin-bottom:11px;">
        <label style="display:block;font-size:0.82rem;font-weight:700;color:#15803D;margin-bottom:5px;">שם המטרה:</label>
        <input id="gd-title-input" type="text" maxlength="40"
          placeholder="למשל: פלאפי ירוק, אופניים..." dir="rtl"
          style="
            width:100%;box-sizing:border-box;padding:9px 12px;
            border:2px solid #86EFAC;border-radius:12px;
            background:rgba(255,255,255,0.85);color:var(--color-text);
            font-size:0.95rem;font-family:inherit;
          "
        >
      </div>

      <!-- Target price -->
      <div style="margin-bottom:11px;">
        <label style="display:block;font-size:0.82rem;font-weight:700;color:#15803D;margin-bottom:5px;">כמה עולה? (₪)</label>
        <div style="position:relative;">
          <span style="
            position:absolute;right:12px;top:50%;transform:translateY(-50%);
            font-size:1rem;font-weight:700;color:#15803D;pointer-events:none;
          ">₪</span>
          <input id="gd-amount-input" type="number" min="0.01" max="99999" step="0.01"
            placeholder="24.90" inputmode="decimal" dir="ltr"
            style="
              width:100%;box-sizing:border-box;
              padding:9px 12px 9px 40px;
              border:2px solid #86EFAC;border-radius:12px;
              background:rgba(255,255,255,0.85);color:var(--color-text);
              font-size:1.15rem;font-weight:800;text-align:left;font-family:inherit;
            "
          >
        </div>
      </div>

      <!-- Store (optional) -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:0.82rem;font-weight:700;color:#15803D;margin-bottom:5px;">
          איפה ראיתי את זה?
          <span style="font-weight:400;color:#4B7A58;">(לא חובה)</span>
        </label>
        <input id="gd-store-input" type="text" maxlength="40"
          placeholder="למשל: טויס אר אס, קניון..." dir="rtl"
          style="
            width:100%;box-sizing:border-box;padding:9px 12px;
            border:2px solid #86EFAC;border-radius:12px;
            background:rgba(255,255,255,0.85);color:var(--color-text);
            font-size:0.9rem;font-family:inherit;
          "
        >
      </div>

      <!-- Icon section -->
      <div style="border-top:1px solid rgba(0,100,0,0.15);padding-top:12px;margin-bottom:10px;">
        <div style="font-size:0.82rem;font-weight:700;color:#15803D;margin-bottom:8px;
          display:flex;align-items:center;gap:6px;">
          <span id="gd-creator-selected-emoji" style="font-size:1.3rem;">🎯</span>
          <span>הוסף סמל:</span>
        </div>
        <div id="gd-creator-icon-picker"></div>
      </div>

      <!-- Disabled camera (Phase 9) -->
      <div style="border-top:1px solid rgba(0,100,0,0.1);padding-top:10px;margin-bottom:14px;">
        <button disabled type="button" style="
          width:100%;padding:10px;
          background:#F3F4F6;color:#9CA3AF;
          border:1.5px dashed #D1D5DB;border-radius:12px;
          font-size:0.88rem;font-weight:600;font-family:inherit;
          cursor:not-allowed;opacity:0.75;
          display:flex;align-items:center;justify-content:center;gap:8px;
        ">
          📷 הוסף תמונה
          <span style="font-size:0.72rem;background:#E5E7EB;color:#6B7280;
            padding:2px 8px;border-radius:10px;font-weight:700;">בקרוב</span>
        </button>
      </div>

      <!-- Status -->
      <div id="gd-creator-status" style="min-height:1.3em;font-size:0.85rem;text-align:center;margin-bottom:8px;"></div>

      <!-- Save -->
      <button id="gd-creator-save" type="button" style="
        width:100%;padding:14px;
        background:linear-gradient(135deg,#16A34A 0%,#22C55E 100%);
        color:#fff;border:none;border-radius:16px;
        font-size:1rem;font-weight:800;font-family:inherit;cursor:pointer;
        box-shadow:0 4px 12px rgba(22,163,74,0.30);
        transition:transform 0.12s;
      "
        onmousedown="this.style.transform='scale(0.97)'"
        onmouseup="this.style.transform=''"
        onmouseleave="this.style.transform=''"
      >✓ שמור מטרה</button>
    </div>`;

  document.getElementById('gd-creator-back')
    .addEventListener('click', () => GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot));

  _gdRenderIconPicker(
    document.getElementById('gd-creator-icon-picker'),
    selectedEmoji,
    (emoji) => {
      selectedEmoji = emoji;
      const preview = document.getElementById('gd-creator-selected-emoji');
      if (preview) preview.textContent = emoji;
    }
  );

  document.getElementById('gd-creator-save').addEventListener('click', async () => {
    const saveBtn   = document.getElementById('gd-creator-save');
    const statusEl  = document.getElementById('gd-creator-status');
    const title     = (document.getElementById('gd-title-input').value   || '').trim();
    const amountRaw = parseFloat(document.getElementById('gd-amount-input').value || '0');
    const store     = (document.getElementById('gd-store-input').value   || '').trim();

    if (!title) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'נא להזין שם למטרה.';
      document.getElementById('gd-title-input').focus();
      return;
    }
    if (!amountRaw || amountRaw <= 0) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'נא להזין מחיר גדול מאפס.';
      document.getElementById('gd-amount-input').focus();
      return;
    }

    const targetAgorot = Math.round(amountRaw * 100);

    saveBtn.disabled    = true;
    saveBtn.textContent = 'שומר...';
    statusEl.textContent = '';

    try {
      await API.callGASWithFallback('createGoal', {
        userId, title, targetAgorot, emoji: selectedEmoji, store: store || '',
      });
      await GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot);
    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      saveBtn.textContent  = '✓ שמור מטרה';
      saveBtn.disabled     = false;
    }
  });
}

// ── Shared icon picker ────────────────────────────────────────

/**
 * Render a grouped emoji picker into containerEl.
 * Category chips filter the grid.
 * Large touch targets (54px) for child use.
 * Icon picker always uses large icons regardless of tile size.
 *
 * @param {HTMLElement} containerEl
 * @param {string}      currentEmoji
 * @param {Function}    onSelect  — called with (emoji)
 */
function _gdRenderIconPicker(containerEl, currentEmoji, onSelect) {
  let activeCategory = _GD_ICON_GROUPS[0].label;

  function getIcons() {
    const g = _GD_ICON_GROUPS.find(x => x.label === activeCategory);
    return g ? g.icons : [];
  }

  function render() {
    containerEl.innerHTML = `
      <!-- Category chips -->
      <div style="
        display:flex;overflow-x:auto;gap:6px;
        padding-bottom:8px;margin-bottom:6px;
        scrollbar-width:none;-ms-overflow-style:none;
      ">
        ${_GD_ICON_GROUPS.map(g => `
          <button class="gd-cat-chip" data-cat="${_gdEsc(g.label)}" type="button" style="
            padding:5px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;
            border:1.5px solid ${g.label === activeCategory ? '#22C55E' : '#E5E7EB'};
            background:${g.label === activeCategory ? '#DCFCE7' : '#F9FAFB'};
            color:${g.label === activeCategory ? '#15803D' : '#6B7280'};
            font-size:0.76rem;font-weight:${g.label === activeCategory ? '700' : '500'};
            cursor:pointer;font-family:inherit;
          ">${_gdEsc(g.label)}</button>
        `).join('')}
      </div>

      <!-- Icon grid: 5 per row, 54px touch targets -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
        ${getIcons().map(emoji => `
          <button class="gd-icon-opt" data-emoji="${emoji}" type="button" style="
            height:54px;border-radius:12px;cursor:pointer;
            border:2.5px solid ${emoji === currentEmoji ? '#22C55E' : 'transparent'};
            background:${emoji === currentEmoji ? '#DCFCE7' : '#F1F5F9'};
            font-size:1.75rem;font-family:inherit;
            display:flex;align-items:center;justify-content:center;
            transition:border-color 0.1s,background 0.1s;
          ">${emoji}</button>
        `).join('')}
      </div>
    `;

    containerEl.querySelectorAll('.gd-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => { activeCategory = chip.dataset.cat; render(); });
    });

    containerEl.querySelectorAll('.gd-icon-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        currentEmoji = emoji;
        onSelect(emoji);
        render(); // re-render to show selection (no-op if parent replaced el)
      });
    });
  }

  render();
}

// ── Helpers ───────────────────────────────────────────────────

function _gdLoadingHTML(msg) {
  return `
    <div style="text-align:center;padding:22px 0 12px;">
      <div style="
        width:32px;height:32px;border-radius:50%;
        border:3px solid var(--color-border,#E2E8F0);
        border-top-color:var(--color-primary,#0EA5E9);
        margin:0 auto 8px;
        animation:ph-spin 0.8s linear infinite;
      "></div>
      <p style="color:var(--color-text-muted);font-size:0.82rem;margin:0;">טוען<span class="ld-d">.</span><span class="ld-d">.</span><span class="ld-d">.</span></p>
    </div>`;
}

function _gdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Floating modal system ─────────────────────────────────────

/**
 * Create and show a floating modal.
 *
 * @param {Object} opts
 * @param {string}   opts.title
 * @param {string}   opts.bodyHTML    — static HTML rendered inside #gd-modal-body
 * @param {Function} [opts.onMount]   — called(bodyEl) after overlay is in the DOM
 * @param {string}   [opts.confirm]   — confirm button label (default 'שמירה')
 * @param {string}   [opts.cancel]    — cancel button label (default 'ביטול')
 * @param {boolean}  [opts.cancelOnly] — show only the cancel button (for info dialogs)
 * @param {Function} opts.onConfirm   — called(overlay, close) when user clicks confirm
 * @returns {HTMLElement} overlay element
 */
function _gdModal({ title, bodyHTML, onMount, confirm = 'שמירה', cancel = 'ביטול', cancelOnly = false, onConfirm }) {
  // Remove any stale modal
  const prev = document.getElementById('gd-modal-overlay');
  if (prev) prev.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gd-modal-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9000;',
    'background:rgba(15,23,42,0.55);',
    'display:flex;align-items:center;justify-content:center;',
    'padding:20px;box-sizing:border-box;',
    'animation:gd-fade-in 0.15s ease;',
  ].join('');

  overlay.innerHTML = `
    <div style="
      background:#FFFFFF;border-radius:20px;
      padding:22px 20px 18px;
      width:100%;max-width:360px;
      max-height:80vh;overflow-y:auto;
      box-shadow:0 12px 40px rgba(0,0,0,0.22);
      direction:rtl;font-family:inherit;
    ">
      <div style="
        font-size:1.0rem;font-weight:800;color:#1E293B;
        margin-bottom:16px;padding-bottom:10px;
        border-bottom:1.5px solid #F1F5F9;
      ">${_gdEsc(title)}</div>
      <div id="gd-modal-body" style="margin-bottom:16px;">${bodyHTML || ''}</div>
      <div style="display:flex;gap:8px;flex-direction:row-reverse;">
        ${cancelOnly ? '' : `
          <button id="gd-modal-confirm" type="button" style="
            flex:1;padding:12px;
            background:linear-gradient(135deg,#16A34A 0%,#22C55E 100%);
            color:#fff;border:none;border-radius:12px;
            font-size:0.95rem;font-weight:800;font-family:inherit;cursor:pointer;
          ">${_gdEsc(confirm)}</button>
        `}
        <button id="gd-modal-cancel" type="button" style="
          flex:1;padding:12px;
          background:#F8FAFC;color:#475569;
          border:1.5px solid #E2E8F0;border-radius:12px;
          font-size:0.95rem;font-weight:700;font-family:inherit;cursor:pointer;
        ">${_gdEsc(cancelOnly ? 'הבנתי' : cancel)}</button>
      </div>
      <div id="gd-modal-status" style="
        min-height:1.2em;font-size:0.8rem;color:#DC2626;
        text-align:center;margin-top:8px;
      "></div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  // Backdrop click → close
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  // Escape → close
  const onEsc = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', onEsc); close(); } };
  document.addEventListener('keydown', onEsc);

  document.getElementById('gd-modal-cancel').addEventListener('click', close);

  if (!cancelOnly) {
    document.getElementById('gd-modal-confirm').addEventListener('click', () => {
      if (onConfirm) onConfirm(overlay, close);
    });
  }

  if (onMount) {
    onMount(overlay.querySelector('#gd-modal-body'));
  }

  return overlay;
}

// ── Modal openers ─────────────────────────────────────────────

function _gdOpenNameModal(el, userId, savingsAgorot, walletAgorot, goalId, currentTitle) {
  _gdModal({
    title: 'עדכון שם המטרה',
    bodyHTML: `
      <input id="gd-modal-name-inp" type="text" maxlength="40"
        value="${_gdEsc(currentTitle || '')}" dir="rtl"
        style="
          width:100%;box-sizing:border-box;padding:10px 12px;
          border:2px solid #86EFAC;border-radius:12px;
          background:#F0FDF4;color:#1E293B;
          font-size:1rem;font-weight:700;font-family:inherit;
        ">`,
    onMount: bodyEl => {
      const inp = bodyEl.querySelector('#gd-modal-name-inp');
      if (inp) { inp.focus(); inp.select(); }
      // Enter key → confirm
      inp && inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('gd-modal-confirm')?.click();
      });
    },
    onConfirm: async (overlay, close) => {
      const inp     = overlay.querySelector('#gd-modal-name-inp');
      const title   = (inp ? inp.value : '').trim();
      const statusEl = overlay.querySelector('#gd-modal-status');
      const confirmBtn = overlay.querySelector('#gd-modal-confirm');
      if (!title) {
        if (inp) { inp.style.borderColor = '#FCA5A5'; inp.focus(); }
        return;
      }
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'שומר...'; }
      try {
        await API.callGASWithFallback('updateGoal', { userId, goalId, title });
        close();
        await GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot);
      } catch (err) {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'שמירה'; }
        if (statusEl)   statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      }
    },
  });
}

function _gdOpenPriceModal(el, userId, savingsAgorot, walletAgorot, goalId, currentAgorot) {
  const currentVal = currentAgorot > 0 ? (currentAgorot / 100).toFixed(2) : '';
  _gdModal({
    title: 'עדכון מחיר המטרה',
    bodyHTML: `
      <div style="position:relative;">
        <span style="
          position:absolute;right:12px;top:50%;transform:translateY(-50%);
          font-size:1rem;font-weight:700;color:#15803D;pointer-events:none;
        ">₪</span>
        <input id="gd-modal-price-inp"
          type="number" inputmode="decimal" min="0.01" max="99999" step="0.01"
          value="${_gdEsc(currentVal)}" dir="ltr"
          style="
            width:100%;box-sizing:border-box;
            padding:10px 36px 10px 12px;
            border:2px solid #86EFAC;border-radius:12px;
            background:#F0FDF4;color:#1E293B;
            font-size:1.1rem;font-weight:800;font-family:inherit;
            text-align:left;
          ">
      </div>`,
    onMount: bodyEl => {
      const inp = bodyEl.querySelector('#gd-modal-price-inp');
      if (inp) { inp.focus(); inp.select(); }
      inp && inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('gd-modal-confirm')?.click();
      });
    },
    onConfirm: async (overlay, close) => {
      const inp      = overlay.querySelector('#gd-modal-price-inp');
      const agorot   = Currency.parseILSInput((inp ? inp.value : '').trim());
      const statusEl = overlay.querySelector('#gd-modal-status');
      const confirmBtn = overlay.querySelector('#gd-modal-confirm');
      if (!agorot || agorot <= 0) {
        if (inp) { inp.style.borderColor = '#FCA5A5'; inp.focus(); }
        return;
      }
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'שומר...'; }
      try {
        await API.callGASWithFallback('updateGoal', { userId, goalId, targetAgorot: agorot });
        close();
        await GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot);
      } catch (err) {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'שמירה'; }
        if (statusEl)   statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      }
    },
  });
}

function _gdOpenIconModal(el, userId, savingsAgorot, walletAgorot, goalId, currentEmoji, goalTitle, goals) {
  let selectedEmoji = currentEmoji || '🎯';

  _gdModal({
    title: 'בחירת סמל למטרה',
    bodyHTML: `<div id="gd-modal-icon-picker"></div>`,
    onMount: bodyEl => {
      _gdRenderIconPicker(
        bodyEl.querySelector('#gd-modal-icon-picker'),
        selectedEmoji,
        emoji => { selectedEmoji = emoji; }
      );
    },
    onConfirm: async (overlay, close) => {
      const statusEl   = overlay.querySelector('#gd-modal-status');
      const confirmBtn = overlay.querySelector('#gd-modal-confirm');
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'שומר...'; }
      try {
        await API.callGASWithFallback('updateGoal', { userId, goalId, emoji: selectedEmoji });
        close();
        await GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot);
      } catch (err) {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'שמירה'; }
        if (statusEl)   statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      }
    },
  });
}

function _gdOpenPhotoModal() {
  _gdModal({
    title: 'תמונה למטרה',
    bodyHTML: `<p style="
      font-size:0.9rem;color:#475569;line-height:1.6;margin:0;text-align:center;
    ">אפשרות הוספת תמונה עדיין בפיתוח</p>`,
    cancelOnly: true,
    onConfirm: null,
  });
}
