// ─────────────────────────────────────────────────────────────
// views/goals-display.js — Savings goals list + inline creator
//
// ── Two modes ─────────────────────────────────────────────────
//   List:   GoalsDisplay.render(el, userId, savingsAgorot)
//           Fetches goals via getGoals, renders progress cards.
//           "הוסף מטרה" button opens the inline creator.
//
//   Creator: inline form within el:
//           emoji picker → title → target amount → save
//           Calls createGoal (no PIN required).
//           On success: back to list with fresh data.
//
// ── Progress model ────────────────────────────────────────────
// The savings balance is a single pool shared across all goals.
// Each goal card shows: saved (=full savings balance) vs target.
// The most achievable goal is visually highlighted.
// This matches the product model: one savings account, multiple
// aspirational targets.
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────

'use strict';

// Emoji options for the goal creator. 4 rows × 6 = 24 options.
const _GD_EMOJI = [
  '🎮', '🚲', '🎸', '🏀', '⚽', '🎨',
  '✈️', '🎡', '🏖️', '🎬', '🎠', '🎯',
  '🦄', '🐶', '🐱', '🐠', '🦋', '🌟',
  '🎁', '💎', '👟', '🕹️', '📚', '🏆',
];

window.GoalsDisplay = {

  /**
   * Fetch goals and render list + add button into el.
   * savingsAgorot is the child's current savings balance, already fetched
   * by getChildDashboard — passed in to avoid a second network call.
   *
   * @param {HTMLElement} el
   * @param {string}      userId
   * @param {number}      savingsAgorot
   */
  async render(el, userId, savingsAgorot) {
    el.innerHTML = _gdLoadingHTML('טוען מטרות...');

    try {
      const { data } = await API.callGASWithFallback('getGoals', { userId });
      _gdRenderList(el, userId, savingsAgorot, data);
    } catch (err) {
      el.innerHTML = `
        <p style="color: var(--color-danger); font-size: 0.82rem; margin: 4px 0 0;">
          שגיאה בטעינת המטרות: ${_gdEsc(err.message)}
        </p>`;
    }
  },

};

// ── List view ─────────────────────────────────────────────────

function _gdRenderList(el, userId, savingsAgorot, goals) {
  const hasGoals = goals && goals.length > 0;

  el.innerHTML = `
    <div>
      ${hasGoals
        ? goals.map(g => _gdGoalCardHTML(g, savingsAgorot)).join('')
        : `<p style="
              font-size: 0.85rem;
              color: #4B7A58;
              margin: 0 0 12px;
              text-align: center;
              padding: 12px 0 4px;
            ">
              עוד אין מטרות חיסכון — הוסיפו את הראשונה!
            </p>`
      }

      <!-- Add goal button -->
      <button
        id="gd-add-btn"
        style="
          margin-top: 8px;
          width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.6);
          color: #15803D;
          border: 2px dashed #86EFAC;
          border-radius: 14px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        "
        onmousedown="this.style.background='rgba(255,255,255,0.9)'"
        onmouseup="this.style.background='rgba(255,255,255,0.6)'"
        onmouseleave="this.style.background='rgba(255,255,255,0.6)'"
        type="button"
      >
        ➕ הוסף מטרה חדשה
      </button>
    </div>`;

  document.getElementById('gd-add-btn')
    .addEventListener('click', () => _gdRenderCreator(el, userId, savingsAgorot));
}

/**
 * Build one goal card's HTML.
 * savingsAgorot is the full savings balance (shared pool).
 */
function _gdGoalCardHTML(goal, savingsAgorot) {
  const saved      = savingsAgorot;
  const target     = goal.targetAgorot;
  const pct        = Math.min(100, Math.floor(saved * 100 / target));
  const remaining  = Math.max(0, target - saved);
  const isReady    = saved >= target;

  // Progress bar colour
  const barColor = isReady ? '#16A34A' : pct >= 66 ? '#0EA5E9' : pct >= 33 ? '#F59E0B' : '#E5E7EB';
  const barFill  = isReady ? '#16A34A' : pct >= 66 ? '#0EA5E9' : pct >= 33 ? '#F59E0B' : '#94A3B8';

  return `
    <div style="
      background: rgba(255,255,255,0.65);
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 10px;
      border: 1.5px solid ${isReady ? '#86EFAC' : 'rgba(0,0,0,0.07)'};
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    ">
      <!-- Top row: emoji + title + ready badge -->
      <div style="
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      ">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${isReady ? '#DCFCE7' : '#F1F5F9'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        ">${_gdEsc(goal.emoji)}</div>

        <div style="flex: 1; min-width: 0;">
          <div style="
            font-weight: 800;
            font-size: 0.97rem;
            color: #1E293B;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${_gdEsc(goal.title)}</div>
          <div style="font-size: 0.78rem; color: #64748B;">
            ${isReady
              ? `<span style="color:#16A34A; font-weight:700;">✓ אפשר לקנות!</span>`
              : `${Currency.formatILS(saved)} מתוך ${Currency.formatILS(target)}`
            }
          </div>
        </div>

        ${isReady ? `
          <div style="
            background: #DCFCE7;
            color: #15803D;
            border-radius: 20px;
            padding: 4px 10px;
            font-size: 0.75rem;
            font-weight: 800;
            white-space: nowrap;
            flex-shrink: 0;
          ">🎉 מוכן!</div>
        ` : ''}
      </div>

      <!-- Progress bar -->
      <div style="
        height: 10px;
        background: #E5E7EB;
        border-radius: 99px;
        overflow: hidden;
        margin-bottom: 6px;
      ">
        <div style="
          height: 100%;
          width: ${pct}%;
          background: ${barFill};
          border-radius: 99px;
          transition: width 0.4s ease;
        "></div>
      </div>

      <!-- Bottom row: pct + remaining -->
      <div style="
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: #64748B;
      ">
        <span style="font-weight: 700; color: ${barFill};">${pct}%</span>
        ${!isReady
          ? `<span>חסרים עוד ${Currency.formatILS(remaining)}</span>`
          : `<span style="color:#16A34A;">הגעת ליעד!</span>`
        }
      </div>
    </div>`;
}

// ── Creator (inline form) ─────────────────────────────────────

function _gdRenderCreator(el, userId, savingsAgorot) {
  // Default selection: first emoji
  let selectedEmoji = _GD_EMOJI[0];

  el.innerHTML = `
    <div>
      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      ">
        <button
          id="gd-creator-back"
          style="
            background: none; border: none;
            font-size: 1.4rem; cursor: pointer;
            padding: 4px 8px; border-radius: 10px;
            color: var(--color-text-muted); line-height: 1;
          "
          type="button"
          aria-label="חזרה"
        >←</button>
        <div style="font-size: 1.05rem; font-weight: 800; color: #15803D;">
          🎯 מטרה חדשה
        </div>
      </div>

      <!-- Emoji picker -->
      <div style="margin-bottom: 14px;">
        <div style="
          font-size: 0.78rem; font-weight: 700;
          color: #15803D; margin-bottom: 8px;
          letter-spacing: 0.04em;
        ">בחר סמל:</div>
        <div id="gd-emoji-grid" style="
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
        ">
          ${_GD_EMOJI.map((emoji, i) => `
            <button
              class="gd-emoji-btn"
              data-emoji="${_gdEsc(emoji)}"
              style="
                width: 100%; aspect-ratio: 1;
                border-radius: 10px;
                border: 2px solid ${i === 0 ? '#22C55E' : 'transparent'};
                background: ${i === 0 ? '#DCFCE7' : '#F1F5F9'};
                font-size: 1.3rem;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: border-color 0.1s, background 0.1s;
                padding: 0;
              "
              type="button"
              aria-label="${_gdEsc(emoji)}"
            >${emoji}</button>`
          ).join('')}
        </div>
      </div>

      <!-- Goal name -->
      <div style="margin-bottom: 12px;">
        <label style="
          display: block;
          font-size: 0.82rem; font-weight: 700;
          color: #15803D; margin-bottom: 6px;
        ">שם המטרה:</label>
        <input
          id="gd-title-input"
          type="text"
          maxlength="40"
          placeholder="למשל: אופניים, גיטרה, טיול..."
          style="
            width: 100%; box-sizing: border-box;
            padding: 10px 12px;
            border: 2px solid #86EFAC;
            border-radius: 12px;
            background: rgba(255,255,255,0.8);
            color: var(--color-text);
            font-size: 1rem;
            font-family: inherit;
          "
          dir="rtl"
        >
      </div>

      <!-- Target amount -->
      <div style="margin-bottom: 16px;">
        <label style="
          display: block;
          font-size: 0.82rem; font-weight: 700;
          color: #15803D; margin-bottom: 6px;
        ">כמה זה עולה? (₪)</label>
        <div style="position: relative; display: flex; align-items: center;">
          <span style="
            position: absolute;
            right: 12px;
            font-size: 1rem;
            font-weight: 700;
            color: #15803D;
            pointer-events: none;
          ">₪</span>
          <input
            id="gd-amount-input"
            type="number"
            min="1"
            max="99999"
            step="0.01"
            placeholder="0"
            inputmode="decimal"
            style="
              width: 100%; box-sizing: border-box;
              padding: 10px 12px 10px 40px;
              border: 2px solid #86EFAC;
              border-radius: 12px;
              background: rgba(255,255,255,0.8);
              color: var(--color-text);
              font-size: 1.2rem;
              font-weight: 800;
              text-align: left;
            "
            dir="ltr"
          >
        </div>
      </div>

      <!-- Status line -->
      <div id="gd-creator-status" style="
        min-height: 1.4em;
        font-size: 0.85rem;
        text-align: center;
        margin-bottom: 8px;
      "></div>

      <!-- Save button -->
      <button
        id="gd-creator-save"
        style="
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
          color: #fff;
          border: none;
          border-radius: 16px;
          font-size: 1.05rem;
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
        ✓ שמור מטרה
      </button>
    </div>
  `;

  // ── Back button ──────────────────────────────────────────────
  document.getElementById('gd-creator-back')
    .addEventListener('click', () => GoalsDisplay.render(el, userId, savingsAgorot));

  // ── Emoji picker selection ───────────────────────────────────
  el.querySelectorAll('.gd-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deselect all
      el.querySelectorAll('.gd-emoji-btn').forEach(b => {
        b.style.border      = '2px solid transparent';
        b.style.background  = '#F1F5F9';
      });
      // Select this one
      btn.style.border     = '2px solid #22C55E';
      btn.style.background = '#DCFCE7';
      selectedEmoji = btn.dataset.emoji;
    });
  });

  // ── Save ─────────────────────────────────────────────────────
  document.getElementById('gd-creator-save').addEventListener('click', async () => {
    const saveBtn  = document.getElementById('gd-creator-save');
    const statusEl = document.getElementById('gd-creator-status');
    const title    = (document.getElementById('gd-title-input').value || '').trim();
    const amountRaw = parseFloat(document.getElementById('gd-amount-input').value || '0');

    // Client-side validation
    if (!title) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'נא להזין שם למטרה.';
      document.getElementById('gd-title-input').focus();
      return;
    }
    if (!amountRaw || amountRaw <= 0) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'נא להזין סכום גדול מאפס.';
      document.getElementById('gd-amount-input').focus();
      return;
    }

    // Convert ₪ to agorot (round to nearest agora)
    const targetAgorot = Math.round(amountRaw * 100);

    saveBtn.disabled    = true;
    saveBtn.textContent = 'שומר...';
    statusEl.style.color = 'var(--color-text-muted)';
    statusEl.textContent = '';

    try {
      await API.callGASWithFallback('createGoal', {
        userId,
        title,
        targetAgorot,
        emoji: selectedEmoji,
      });

      // Reload the list with fresh data
      await GoalsDisplay.render(el, userId, savingsAgorot);

    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      saveBtn.textContent  = '✓ שמור מטרה';
      saveBtn.disabled     = false;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────

function _gdLoadingHTML(msg) {
  return `<p style="color: var(--color-text-muted); font-size: 0.85rem; margin: 4px 0 0;">${_gdEsc(msg || 'טוען...')}</p>`;
}

function _gdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
