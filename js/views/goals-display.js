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

  // "שנה סמל" — event delegation
  el.addEventListener('click', e => {
    const btn = e.target.closest('.gd-change-icon-btn');
    if (!btn) return;
    _gdRenderChangeIconView(
      el, userId, savingsAgorot, walletAgorot,
      btn.dataset.goalId, btn.dataset.goalEmoji, btn.dataset.goalTitle, goals
    );
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
  const saved   = Math.min(savingsAgorot, target); // §9a: capped at target
  const pct     = target > 0 ? Math.min(100, Math.floor(saved * 100 / target)) : 0;

  // §9a: savings progress colours
  const barFill = pct >= 100 ? '#16A34A'
    : pct >= 66  ? '#0EA5E9'
    : pct >= 33  ? '#F59E0B'
    : '#94A3B8';

  // §9b: purchase readiness
  const readiness = _gdPurchaseReadiness(target, savingsAgorot, walletAgorot);

  return `
    <div data-goal-id="${_gdEsc(goal.goalId)}" style="
      background:rgba(255,255,255,0.7);border-radius:14px;
      padding:10px 10px 8px;
      border:1.5px solid ${readiness.caseKey === 'A' ? '#86EFAC' : 'rgba(0,0,0,0.07)'};
      box-shadow:0 1px 4px rgba(0,0,0,0.06);
      display:flex;flex-direction:column;gap:6px;
      min-height:0;
    ">
      <!-- Emoji + title row -->
      <div style="display:flex;align-items:flex-start;gap:7px;">
        <div style="
          width:36px;height:36px;flex-shrink:0;border-radius:10px;
          background:${readiness.caseKey === 'A' ? '#DCFCE7' : '#F1F5F9'};
          display:flex;align-items:center;justify-content:center;
          font-size:1.4rem;line-height:1;
        ">${goal.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="
            font-weight:800;font-size:0.85rem;color:#1E293B;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            line-height:1.25;
          ">${_gdEsc(goal.title)}</div>
          <div style="font-size:0.72rem;color:#15803D;font-weight:700;margin-top:1px;">
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
          <span>${Currency.formatILS(saved)} מתוך ${Currency.formatILS(target)}</span>
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

      <!-- "שנה סמל" link -->
      <div style="text-align:center;">
        <button class="gd-change-icon-btn" type="button"
          data-goal-id="${_gdEsc(goal.goalId)}"
          data-goal-emoji="${_gdEsc(goal.emoji)}"
          data-goal-title="${_gdEsc(goal.title)}"
          style="
            background:none;border:none;
            color:#CBD5E1;font-size:0.68rem;
            cursor:pointer;padding:2px 4px;
            font-family:inherit;text-decoration:underline;
            text-underline-offset:2px;
          "
        >שנה סמל</button>
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
        " aria-label="חזרה">←</button>
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

// ── Change icon view ──────────────────────────────────────────

function _gdRenderChangeIconView(el, userId, savingsAgorot, walletAgorot, goalId, currentEmoji, goalTitle, goals) {
  let saving = false;

  el.innerHTML = `
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <button id="gd-change-back" type="button" style="
          background:none;border:none;font-size:1.4rem;cursor:pointer;
          padding:4px 8px;border-radius:10px;color:var(--color-text-muted);line-height:1;
          font-family:inherit;
        " aria-label="חזרה">←</button>
        <div style="font-size:1.0rem;font-weight:800;color:#15803D;">🔄 שנה סמל</div>
      </div>
      <p style="font-size:0.82rem;color:#4B7A58;margin:0 0 12px;padding-right:46px;">
        ${_gdEsc(goalTitle)} — בחר סמל חדש
      </p>
      <div id="gd-change-icon-picker"></div>
      <div id="gd-change-status" style="min-height:1.3em;font-size:0.85rem;text-align:center;margin-top:8px;color:var(--color-danger);"></div>
    </div>`;

  document.getElementById('gd-change-back')
    .addEventListener('click', () => _gdRenderList(el, userId, savingsAgorot, walletAgorot, goals));

  _gdRenderIconPicker(
    document.getElementById('gd-change-icon-picker'),
    currentEmoji,
    async (emoji) => {
      if (saving) return;
      saving = true;

      const statusEl = document.getElementById('gd-change-status');
      if (statusEl) { statusEl.style.color = 'var(--color-text-muted)'; statusEl.textContent = 'שומר...'; }

      try {
        await API.callGASWithFallback('updateGoal', { userId, goalId, emoji });
        await GoalsDisplay.render(el, userId, savingsAgorot, walletAgorot);
      } catch (err) {
        saving = false;
        if (statusEl) { statusEl.style.color = 'var(--color-danger)'; statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message); }
      }
    }
  );
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
  return `<p style="color:var(--color-text-muted);font-size:0.85rem;margin:4px 0 0;">${_gdEsc(msg || 'טוען...')}</p>`;
}

function _gdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
