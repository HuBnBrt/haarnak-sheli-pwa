// ─────────────────────────────────────────────────────────────
// views/goals-display.js — Savings goals list + inline creator
//
// ── Modes ─────────────────────────────────────────────────────
//   List:     GoalsDisplay.render(el, userId, savingsAgorot)
//             Fetches goals, renders progress cards + "הוסף מטרה".
//
//   Creator:  Inline form: name + price + store (optional) +
//             grouped icon picker + disabled camera placeholder.
//             Calls createGoal (no PIN). Returns to list on success.
//
//   Change icon: Full-view icon picker for an existing goal.
//             Tap to save immediately via updateGoal. Returns to list.
//
// ── Progress model ────────────────────────────────────────────
// Savings balance is a single shared pool. Each goal card shows
// the full balance vs. that goal's target. The child decides which
// goal they are "working toward."
//
// ── Icon storage ──────────────────────────────────────────────
// Icons are emoji stored in the goals `notes` field as JSON:
//   {"emoji":"🎮","store":"טויס אר אס"}
// Phase 9 will add imageId to this object for Drive photos.
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────

'use strict';

// ── Curated icon groups ───────────────────────────────────────
// Fewer, well-chosen icons beat a huge list for children.
// Each group: 5 icons. 7 groups = 35 icons total.
const _GD_ICON_GROUPS = [
  { label: 'משחקים',  icons: ['🎮', '🕹️', '🎲', '🎯', '🎳'] },
  { label: 'בובות',   icons: ['🧸', '🪆', '🤖', '🪀', '🎪'] },
  { label: 'ספורט',   icons: ['⚽', '🏀', '🚲', '🛴', '🏊'] },
  { label: 'יצירה',   icons: ['🎨', '🖍️', '✏️', '🎭', '🎬'] },
  { label: 'ספרים',   icons: ['📚', '🎵', '🎸', '🎹', '🎓'] },
  { label: 'חיות',    icons: ['🐶', '🐱', '🦄', '🐠', '🦋'] },
  { label: 'כללי',    icons: ['✈️', '🌟', '🎁', '🏆', '👟'] },
];

window.GoalsDisplay = {

  /**
   * Fetch goals and render list + add button into el.
   * savingsAgorot: child's current savings balance (already fetched by
   * getChildDashboard — passed in to avoid a second round-trip).
   *
   * @param {HTMLElement} el
   * @param {string}      userId
   * @param {number}      savingsAgorot
   */
  async render(el, userId, savingsAgorot) {
    el.innerHTML = _gdLoadingHTML('טוען מטרות...');

    try {
      const { data: goals } = await API.callGASWithFallback('getGoals', { userId });
      _gdRenderList(el, userId, savingsAgorot, goals);
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
  const hasGoals = Array.isArray(goals) && goals.length > 0;

  el.innerHTML = `
    <div>
      ${hasGoals
        ? goals.map(g => _gdGoalCardHTML(g, savingsAgorot)).join('')
        : `<p style="
              font-size: 0.85rem; color: #4B7A58;
              margin: 0 0 14px; text-align: center; padding: 10px 0 4px;
            ">
              עוד אין מטרות חיסכון — הוסיפו את הראשונה!
            </p>`
      }

      <button
        id="gd-add-btn"
        style="
          margin-top: 6px; width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.6);
          color: #15803D;
          border: 2px dashed #86EFAC;
          border-radius: 14px;
          font-size: 0.95rem; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: background 0.15s;
        "
        onmousedown="this.style.background='rgba(255,255,255,0.9)'"
        onmouseup="this.style.background='rgba(255,255,255,0.6)'"
        onmouseleave="this.style.background='rgba(255,255,255,0.6)'"
        type="button"
      >
        ➕ הוסף מטרה חדשה
      </button>
    </div>`;

  // "הוסף מטרה" button
  document.getElementById('gd-add-btn')
    .addEventListener('click', () => _gdRenderCreator(el, userId, savingsAgorot));

  // "שנה סמל" — event delegation (buttons have class gd-change-icon-btn)
  el.addEventListener('click', e => {
    const btn = e.target.closest('.gd-change-icon-btn');
    if (!btn) return;
    const goalId    = btn.dataset.goalId;
    const goalEmoji = btn.dataset.goalEmoji;
    const goalTitle = btn.dataset.goalTitle;
    _gdRenderChangeIconView(el, userId, savingsAgorot, goalId, goalEmoji, goalTitle, goals);
  });
}

/**
 * Build one goal card's HTML string.
 */
function _gdGoalCardHTML(goal, savingsAgorot) {
  const saved     = savingsAgorot;
  const target    = goal.targetAgorot;
  const pct       = Math.min(100, Math.floor(saved * 100 / target));
  const remaining = Math.max(0, target - saved);
  const isReady   = saved >= target;

  const barFill = isReady ? '#16A34A'
    : pct >= 66 ? '#0EA5E9'
    : pct >= 33 ? '#F59E0B'
    : '#94A3B8';

  return `
    <div
      data-goal-id="${_gdEsc(goal.goalId)}"
      style="
        background: rgba(255,255,255,0.65);
        border-radius: 14px; padding: 12px 14px; margin-bottom: 10px;
        border: 1.5px solid ${isReady ? '#86EFAC' : 'rgba(0,0,0,0.07)'};
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      "
    >
      <!-- Top row: emoji + title + ready badge -->
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">

        <!-- Emoji circle -->
        <div style="
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: ${isReady ? '#DCFCE7' : '#F1F5F9'};
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem;
        ">${goal.emoji}</div>

        <!-- Title + store -->
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-weight: 800; font-size: 0.97rem; color: #1E293B;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          ">${_gdEsc(goal.title)}</div>
          ${goal.store ? `
            <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 1px;">
              📍 ${_gdEsc(goal.store)}
            </div>` : ''}
          <div style="font-size: 0.78rem; color: #64748B; margin-top: 2px;">
            ${isReady
              ? `<span style="color:#16A34A; font-weight:700;">✓ אפשר לקנות!</span>`
              : `${Currency.formatILS(saved)} מתוך ${Currency.formatILS(target)}`
            }
          </div>
        </div>

        ${isReady ? `
          <div style="
            background: #DCFCE7; color: #15803D;
            border-radius: 20px; padding: 4px 10px;
            font-size: 0.74rem; font-weight: 800;
            white-space: nowrap; flex-shrink: 0;
          ">🎉 מוכן!</div>
        ` : ''}
      </div>

      <!-- Progress bar -->
      <div style="
        height: 10px; background: #E5E7EB; border-radius: 99px;
        overflow: hidden; margin-bottom: 6px;
      ">
        <div style="
          height: 100%; width: ${pct}%;
          background: ${barFill}; border-radius: 99px;
          transition: width 0.4s ease;
        "></div>
      </div>

      <!-- Bottom row: pct + remaining + change-icon -->
      <div style="
        display: flex; align-items: center;
        justify-content: space-between;
        font-size: 0.75rem; color: #64748B;
      ">
        <span style="font-weight: 700; color: ${barFill};">${pct}%</span>
        <span>
          ${!isReady
            ? `חסרים עוד ${Currency.formatILS(remaining)}`
            : `<span style="color:#16A34A;">הגעת ליעד!</span>`
          }
        </span>
        <button
          class="gd-change-icon-btn"
          data-goal-id="${_gdEsc(goal.goalId)}"
          data-goal-emoji="${_gdEsc(goal.emoji)}"
          data-goal-title="${_gdEsc(goal.title)}"
          style="
            background: none; border: none;
            color: #94A3B8; font-size: 0.74rem;
            cursor: pointer; padding: 2px 4px; border-radius: 6px;
            text-decoration: underline; text-underline-offset: 2px;
          "
          type="button"
        >שנה סמל</button>
      </div>
    </div>`;
}

// ── Creator (new goal form) ───────────────────────────────────

function _gdRenderCreator(el, userId, savingsAgorot) {
  let selectedEmoji = '🎯'; // default

  el.innerHTML = `
    <div>
      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <button id="gd-creator-back" style="
          background: none; border: none; font-size: 1.4rem; cursor: pointer;
          padding: 4px 8px; border-radius: 10px;
          color: var(--color-text-muted); line-height: 1;
        " type="button" aria-label="חזרה">←</button>
        <div style="font-size: 1.05rem; font-weight: 800; color: #15803D;">🎯 מטרה חדשה</div>
      </div>

      <!-- Goal name (required) -->
      <div style="margin-bottom: 12px;">
        <label style="
          display: block; font-size: 0.82rem; font-weight: 700;
          color: #15803D; margin-bottom: 6px;
        ">שם המטרה:</label>
        <input id="gd-title-input" type="text" maxlength="40"
          placeholder='למשל: פלאפי ירוק, אופניים...'
          style="
            width: 100%; box-sizing: border-box;
            padding: 10px 12px; border: 2px solid #86EFAC; border-radius: 12px;
            background: rgba(255,255,255,0.85); color: var(--color-text);
            font-size: 1rem; font-family: inherit;
          "
          dir="rtl"
        >
      </div>

      <!-- Target price (required) -->
      <div style="margin-bottom: 12px;">
        <label style="
          display: block; font-size: 0.82rem; font-weight: 700;
          color: #15803D; margin-bottom: 6px;
        ">כמה עולה? (₪)</label>
        <div style="position: relative;">
          <span style="
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            font-size: 1rem; font-weight: 700; color: #15803D; pointer-events: none;
          ">₪</span>
          <input id="gd-amount-input" type="number" min="0.01" max="99999" step="0.01"
            placeholder="24.90" inputmode="decimal"
            style="
              width: 100%; box-sizing: border-box;
              padding: 10px 12px 10px 40px;
              border: 2px solid #86EFAC; border-radius: 12px;
              background: rgba(255,255,255,0.85); color: var(--color-text);
              font-size: 1.2rem; font-weight: 800; text-align: left;
            "
            dir="ltr"
          >
        </div>
      </div>

      <!-- Store / where I saw it (optional) -->
      <div style="margin-bottom: 16px;">
        <label style="
          display: block; font-size: 0.82rem; font-weight: 700;
          color: #15803D; margin-bottom: 6px;
        ">איפה ראיתי את זה? <span style="font-weight:400; color:#4B7A58;">(לא חובה)</span></label>
        <input id="gd-store-input" type="text" maxlength="40"
          placeholder='למשל: טויס אר אס, קניון...'
          style="
            width: 100%; box-sizing: border-box;
            padding: 10px 12px; border: 2px solid #86EFAC; border-radius: 12px;
            background: rgba(255,255,255,0.85); color: var(--color-text);
            font-size: 0.95rem; font-family: inherit;
          "
          dir="rtl"
        >
      </div>

      <!-- Icon picker -->
      <div style="
        border-top: 1px solid rgba(0,100,0,0.15);
        padding-top: 14px; margin-bottom: 12px;
      ">
        <div style="
          font-size: 0.82rem; font-weight: 700; color: #15803D; margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px;
        ">
          <span id="gd-creator-selected-emoji" style="font-size: 1.4rem;">🎯</span>
          <span>הוסף סמל:</span>
        </div>
        <div id="gd-creator-icon-picker"></div>
      </div>

      <!-- Disabled camera button (Phase 9 placeholder) -->
      <div style="
        border-top: 1px solid rgba(0,100,0,0.1);
        padding-top: 12px; margin-bottom: 16px;
      ">
        <button disabled style="
          width: 100%; padding: 11px;
          background: #F3F4F6; color: #9CA3AF;
          border: 1.5px dashed #D1D5DB; border-radius: 12px;
          font-size: 0.9rem; font-weight: 600;
          cursor: not-allowed; opacity: 0.75;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        " type="button">
          📷 הוסף תמונה
          <span style="font-size: 0.75rem; background: #E5E7EB; color: #6B7280;
            padding: 2px 8px; border-radius: 10px; font-weight: 700;">בקרוב</span>
        </button>
      </div>

      <!-- Status line -->
      <div id="gd-creator-status" style="
        min-height: 1.4em; font-size: 0.85rem;
        text-align: center; margin-bottom: 8px;
      "></div>

      <!-- Save -->
      <button id="gd-creator-save" style="
        width: 100%; padding: 15px;
        background: linear-gradient(135deg, #16A34A 0%, #22C55E 100%);
        color: #fff; border: none; border-radius: 16px;
        font-size: 1.05rem; font-weight: 800; cursor: pointer;
        box-shadow: 0 4px 12px rgba(22,163,74,0.30);
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: transform 0.12s;
      "
        onmousedown="this.style.transform='scale(0.97)'"
        onmouseup="this.style.transform=''"
        onmouseleave="this.style.transform=''"
        type="button"
      >✓ שמור מטרה</button>
    </div>`;

  // Back
  document.getElementById('gd-creator-back')
    .addEventListener('click', () => GoalsDisplay.render(el, userId, savingsAgorot));

  // Icon picker (updates selectedEmoji + preview span)
  _gdRenderIconPicker(
    document.getElementById('gd-creator-icon-picker'),
    selectedEmoji,
    (emoji) => {
      selectedEmoji = emoji;
      const preview = document.getElementById('gd-creator-selected-emoji');
      if (preview) preview.textContent = emoji;
      // picker re-renders internally to show selection — no navigation needed
    }
  );

  // Save
  document.getElementById('gd-creator-save').addEventListener('click', async () => {
    const saveBtn  = document.getElementById('gd-creator-save');
    const statusEl = document.getElementById('gd-creator-status');
    const title    = (document.getElementById('gd-title-input').value   || '').trim();
    const amountRaw = parseFloat(document.getElementById('gd-amount-input').value || '0');
    const store    = (document.getElementById('gd-store-input').value   || '').trim();

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
        userId,
        title,
        targetAgorot,
        emoji: selectedEmoji,
        store: store || '',
      });
      await GoalsDisplay.render(el, userId, savingsAgorot);
    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
      saveBtn.textContent  = '✓ שמור מטרה';
      saveBtn.disabled     = false;
    }
  });
}

// ── Change icon view (existing goal) ─────────────────────────

/**
 * Full-view icon picker for changing an existing goal's icon.
 * Tapping an icon saves immediately via updateGoal and returns to the list.
 */
function _gdRenderChangeIconView(el, userId, savingsAgorot, goalId, currentEmoji, goalTitle, goals) {
  let saving = false;

  el.innerHTML = `
    <div>
      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <button id="gd-change-back" style="
          background: none; border: none; font-size: 1.4rem; cursor: pointer;
          padding: 4px 8px; border-radius: 10px;
          color: var(--color-text-muted); line-height: 1;
        " type="button" aria-label="חזרה">←</button>
        <div style="font-size: 1.0rem; font-weight: 800; color: #15803D;">
          🔄 שנה סמל
        </div>
      </div>
      <p style="font-size: 0.82rem; color: #4B7A58; margin: 0 0 14px; padding-right: 46px;">
        ${_gdEsc(goalTitle)} — בחר סמל חדש
      </p>
      <div id="gd-change-icon-picker"></div>
      <div id="gd-change-status" style="
        min-height: 1.4em; font-size: 0.85rem;
        text-align: center; margin-top: 10px;
        color: var(--color-danger);
      "></div>
    </div>`;

  document.getElementById('gd-change-back')
    .addEventListener('click', () => _gdRenderList(el, userId, savingsAgorot, goals));

  _gdRenderIconPicker(
    document.getElementById('gd-change-icon-picker'),
    currentEmoji,
    async (emoji) => {
      if (saving) return; // prevent double-tap
      saving = true;

      const statusEl = document.getElementById('gd-change-status');
      if (statusEl) {
        statusEl.style.color = 'var(--color-text-muted)';
        statusEl.textContent = 'שומר...';
      }

      try {
        await API.callGASWithFallback('updateGoal', { userId, goalId, emoji });
        // Return to list with fresh data
        await GoalsDisplay.render(el, userId, savingsAgorot);
      } catch (err) {
        saving = false;
        if (statusEl) {
          statusEl.style.color = 'var(--color-danger)';
          statusEl.textContent = 'שגיאה: ' + _gdEsc(err.message);
        }
      }
    }
  );
}

// ── Shared icon picker component ──────────────────────────────

/**
 * Render an icon picker into containerEl.
 * Category chips filter the grid. The selected icon is highlighted.
 * Tapping an icon calls onSelect(emoji) and re-renders to show the selection.
 *
 * @param {HTMLElement} containerEl
 * @param {string}      currentEmoji  — initially selected emoji
 * @param {Function}    onSelect      — called with (emoji) on icon tap
 */
function _gdRenderIconPicker(containerEl, currentEmoji, onSelect) {
  let activeCategory = _GD_ICON_GROUPS[0].label; // start on first category

  function getVisibleIcons() {
    const group = _GD_ICON_GROUPS.find(g => g.label === activeCategory);
    return group ? group.icons : _GD_ICON_GROUPS.flatMap(g => g.icons);
  }

  function render() {
    const icons = getVisibleIcons();

    containerEl.innerHTML = `
      <!-- Category chips (scrollable) -->
      <div style="
        display: flex; overflow-x: auto; gap: 6px;
        padding-bottom: 10px; margin-bottom: 8px;
        scrollbar-width: none; -ms-overflow-style: none;
      ">
        ${_GD_ICON_GROUPS.map(g => `
          <button class="gd-cat-chip" data-cat="${_gdEsc(g.label)}" style="
            padding: 5px 13px; border-radius: 20px; white-space: nowrap; flex-shrink: 0;
            border: 1.5px solid ${g.label === activeCategory ? '#22C55E' : '#E5E7EB'};
            background: ${g.label === activeCategory ? '#DCFCE7' : '#F9FAFB'};
            color: ${g.label === activeCategory ? '#15803D' : '#6B7280'};
            font-size: 0.78rem; font-weight: ${g.label === activeCategory ? '700' : '500'};
            cursor: pointer;
          " type="button">${_gdEsc(g.label)}</button>
        `).join('')}
      </div>

      <!-- Icon grid: 5 per row, large touch targets -->
      <div style="
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
      ">
        ${icons.map(emoji => `
          <button class="gd-icon-opt" data-emoji="${emoji}" style="
            height: 54px; border-radius: 12px; cursor: pointer;
            border: 2.5px solid ${emoji === currentEmoji ? '#22C55E' : 'transparent'};
            background: ${emoji === currentEmoji ? '#DCFCE7' : '#F1F5F9'};
            font-size: 1.75rem;
            display: flex; align-items: center; justify-content: center;
            transition: border-color 0.1s, background 0.1s;
          " type="button">${emoji}</button>
        `).join('')}
      </div>
    `;

    // Wire category chips
    containerEl.querySelectorAll('.gd-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.cat;
        render();
      });
    });

    // Wire icon buttons
    containerEl.querySelectorAll('.gd-icon-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        currentEmoji = emoji;        // update local selection state
        onSelect(emoji);             // notify parent (may navigate away)
        render();                    // re-render picker to highlight selection
                                     // (no-op if parent replaced el.innerHTML)
      });
    });
  }

  render();
}

// ── Helpers ───────────────────────────────────────────────────

function _gdLoadingHTML(msg) {
  return `<p style="color: var(--color-text-muted); font-size: 0.85rem; margin: 4px 0 0;">
    ${_gdEsc(msg || 'טוען...')}
  </p>`;
}

function _gdEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
