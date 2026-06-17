// ─────────────────────────────────────────────────────────────
// views/purchase-helper.js — Purchase wizard (Phase 5 / 5.2)
//
// Two purchase paths launched from a single entry screen (Step 0):
//
//   Path A — Goal purchase (physical wallet):
//     Step 0 (select goals)
//       → _phGoalPriceReview (per-goal price editing, no API calls)
//         → Step 2 (wallet denomination selection)
//           → Step 3 (change entry, if overpaid)
//             → Step 4 (confirm)
//               → recordPurchase  (updates wallet_denominations)
//               → completeGoal × N  (marks goals done; skipSavingsDeduction:true)
//               → success / recoverable-warning if completeGoal partially fails
//
//   Path B — Regular store purchase (physical wallet):
//     Step 0 (enter description + price)
//       → Step 2 → Step 3 → Step 4
//         → recordPurchase only
//
// Public API:
//   PurchaseHelper.start(el, userId, gender, onExit)
//     el      — HTMLElement to render into
//     userId  — child user ID
//     gender  — 'm' | 'f'  (gender-inflected Hebrew text)
//     onExit  — called when wizard completes or is cancelled
//
// goalContext shape (threaded through Steps 2-3-4, null for regular purchases):
//   {
//     goalIds:    string[],          // ordered list of goalIds in cart
//     goalTitles: string[],          // e.g. ["🎮 Nintendo Switch"]
//     prices:     { goalId: number } // actual price per goal in agorot (editable)
//   }
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────
'use strict';

window.PurchaseHelper = {
  start(el, userId, gender, onExit) {
    _phStep0(el, userId, gender, onExit);
  },
};

// ══════════════════════════════════════════════════════════════
// STEP 0 — "What are you buying?" entry screen
// Loads purchasable goals, shows two sections.
// ══════════════════════════════════════════════════════════════

async function _phStep0(el, userId, gender, onExit) {
  _phShowLoading(el, '🛒 מה קונים עכשיו?', onExit);

  let phData;
  try {
    const { data } = await API.callGASWithFallback('getPurchasableGoals', { userId });
    phData = data;
  } catch (err) {
    _phShowError(el, err.message, onExit);
    return;
  }

  _phStep0Render(el, userId, gender, onExit, phData);
}

function _phStep0Render(el, userId, gender, onExit, phData) {
  const { savingsAgorot, walletTotalAgorot, purchasableGoals, goals } = phData;

  // prices[goalId] = current price agorot (editable, defaults to targetAgorot)
  const prices = {};
  purchasableGoals.forEach(g => { prices[g.goalId] = g.targetAgorot; });

  // cart[goalId] = price agorot for goals selected for purchase
  const cart = {};

  // ── Section 1: purchasable goal cards ──────────────────────
  let goalSectionHTML = '';
  if (purchasableGoals.length > 0) {
    goalSectionHTML = `
      <div style="${_phSectionLabelStyle()}">🏆 מטרות שמוכנות למימוש</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        ${purchasableGoals.map(g => _phGoalCardHTML(g)).join('')}
      </div>
      <div id="gp-selected-panel" style="display:none;"></div>`;
  } else if (goals.length > 0) {
    goalSectionHTML = `
      <div style="
        font-size:0.82rem;color:var(--color-text-muted);
        text-align:center;padding:8px 4px 14px;
        background:var(--color-bg-subtle,#F8FAFC);
        border-radius:12px;margin-bottom:12px;line-height:1.5;
      ">
        🏆 יש לך ${goals.length === 1 ? 'מטרה' : `${goals.length} מטרות`} —
        אבל אין מספיק כסף בארנק כדי למממש אף אחת מהן עכשיו.
      </div>`;
  }

  const dividerHTML = (purchasableGoals.length > 0 || goals.length > 0) ? `
    <div style="
      display:flex;align-items:center;gap:8px;margin-bottom:14px;
      color:var(--color-text-muted);font-size:0.78rem;font-weight:600;
    ">
      <div style="flex:1;height:1px;background:var(--color-border);"></div>
      <span>— או —</span>
      <div style="flex:1;height:1px;background:var(--color-border);"></div>
    </div>` : '';

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="ביטול">←</button>
        <span style="${_phHeaderTitleStyle()}">🛒 מה קונים עכשיו?</span>
      </div>

      <!-- Wallet balance pill -->
      <div style="
        display:inline-flex;align-items:center;gap:6px;
        background:#EFF6FF;border:1.5px solid #93C5FD;
        border-radius:20px;padding:4px 12px;margin-bottom:14px;
        font-size:0.82rem;font-weight:700;color:#1E40AF;
      ">💳 ארנק: ${Currency.formatILS(walletTotalAgorot)}</div>

      ${goalSectionHTML}
      ${purchasableGoals.length > 0 ? dividerHTML : ''}

      <!-- Section 2: custom / additional purchase -->
      <div id="gp-custom-label" style="${_phSectionLabelStyle()}">🛒 קונה משהו אחר?</div>

      <label style="${_phLabelStyle(true)}">על מה? (לא חובה)</label>
      <input id="gp-desc" type="text"
        placeholder="למשל: גלידה, מדבקות, ספר..."
        maxlength="60"
        style="
          width:100%;box-sizing:border-box;padding:11px 14px;
          font-family:inherit;font-size:0.95rem;
          border:2px solid var(--color-border);border-radius:12px;
          background:var(--color-bg);color:var(--color-text);
          margin-bottom:10px;
        ">

      <label style="${_phLabelStyle(true)}">כמה עולה?</label>
      <div style="position:relative;margin-bottom:10px;">
        <input id="gp-price" type="number" inputmode="decimal"
          min="0.01" step="0.01" placeholder="0.00"
          style="
            width:100%;box-sizing:border-box;
            padding:14px 16px 14px 44px;
            font-size:1.5rem;font-weight:800;font-family:inherit;
            border:2.5px solid var(--color-border);border-radius:14px;
            background:var(--color-bg);color:var(--color-text);
            text-align:left;direction:ltr;
          ">
        <span style="
          position:absolute;left:14px;top:50%;transform:translateY(-50%);
          font-size:1.2rem;font-weight:700;color:var(--color-text-muted);
          pointer-events:none;
        ">₪</span>
      </div>

      <!-- Live total strip (hidden until total > 0) -->
      <div id="gp-total-strip" style="
        display:none;margin-bottom:10px;padding:10px 14px;
        border-radius:12px;background:#F0FDF4;border:1.5px solid #86EFAC;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.82rem;font-weight:700;color:#15803D;">סה"כ לתשלום</span>
          <span id="gp-total-amount" style="font-weight:900;font-size:1.1rem;color:#15803D;"></span>
        </div>
      </div>

      <div id="gp-err" style="color:#DC2626;font-size:0.85rem;min-height:1.2em;margin-bottom:8px;"></div>

      <button id="gp-continue" type="button" disabled
        style="${_phPrimaryBtnStyle()} opacity:0.4;">
        המשך לתשלום ←
      </button>
    </div>`;

  // ── Wire events ─────────────────────────────────────────────

  document.getElementById('ph-back').addEventListener('click', onExit);

  // Goal card clicks — toggle cart
  el.querySelectorAll('.gp-goal-card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.disabled === 'true') return;
      const goalId = card.dataset.goalId;
      const goal   = purchasableGoals.find(g => g.goalId === goalId);
      if (!goal) return;

      if (goalId in cart) {
        delete cart[goalId];
      } else {
        const otherTotal   = Object.values(cart).reduce((s, p) => s + p, 0);
        const customAgorot = _phGetCustomAgorot();
        if (otherTotal + prices[goalId] + customAgorot > walletTotalAgorot) return;
        cart[goalId] = prices[goalId];
      }

      _phRebuildSelectedPanel(el, cart, prices, purchasableGoals, walletTotalAgorot);
    });
  });

  // Custom price input → update total + card states
  document.getElementById('gp-price').addEventListener('input', () => {
    const cust = _phGetCustomAgorot();
    _phUpdateTotalAndButton(el, cart, prices, cust, walletTotalAgorot);
    _phUpdateGoalCardStates(el, cart, prices, purchasableGoals, cust, walletTotalAgorot);
  });

  // Continue button
  document.getElementById('gp-continue').addEventListener('click', () => {
    const customAgorot = _phGetCustomAgorot();
    const goalTotal    = Object.keys(cart).reduce((s, gid) => s + (prices[gid] || 0), 0);
    const totalAgorot  = goalTotal + customAgorot;
    const errEl        = document.getElementById('gp-err');

    if (!totalAgorot || totalAgorot <= 0) {
      if (errEl) errEl.textContent = 'יש לבחור מטרה או להזין מחיר.';
      return;
    }
    if (totalAgorot > walletTotalAgorot) {
      if (errEl) errEl.textContent = 'אין מספיק בארנק.';
      return;
    }
    if (errEl) errEl.textContent = '';

    const hasGoals   = Object.keys(cart).length > 0;
    const hasCustom  = customAgorot > 0;
    const customDesc = (document.getElementById('gp-desc').value || '').trim();

    let description, goalContext;
    if (hasGoals) {
      const selectedGoals = purchasableGoals.filter(g => g.goalId in cart);
      const goalTitles    = selectedGoals.map(g => `${g.emoji} ${g.title}`);
      description = goalTitles.join(' + ');
      if (hasCustom) description += (customDesc ? ` + ${customDesc}` : ' + פריט נוסף');

      goalContext = {
        goalIds:    selectedGoals.map(g => g.goalId),
        goalTitles: goalTitles,
        prices:     selectedGoals.reduce(function(acc, g) {
          acc[g.goalId] = prices[g.goalId] || g.targetAgorot; return acc;
        }, {}),
      };
    } else {
      description = customDesc || 'קנייה';
      goalContext = null;
    }

    const onBack = () => _phStep0(el, userId, gender, onExit);
    _phStep2(el, userId, gender, onExit, totalAgorot, description, onBack, goalContext);
  });

  // Initial state
  _phRebuildSelectedPanel(el, cart, prices, purchasableGoals, walletTotalAgorot);
}

/** HTML for one purchasable goal card (no "מוכן לקנייה" badge). */
function _phGoalCardHTML(goal) {
  return `
    <div class="gp-goal-card" data-goal-id="${_phEsc(goal.goalId)}" style="
      border:2px dashed #86EFAC;border-radius:14px;
      padding:10px 8px;cursor:pointer;
      background:var(--color-bg);
      position:relative;user-select:none;
      display:flex;flex-direction:column;align-items:center;gap:4px;
    ">
      <div class="gp-chk" style="
        display:none;position:absolute;top:5px;left:5px;
        width:20px;height:20px;border-radius:50%;
        background:#16A34A;color:#fff;
        font-size:0.68rem;font-weight:900;
        align-items:center;justify-content:center;
      ">✓</div>
      <div style="font-size:1.6rem;line-height:1;">${goal.emoji}</div>
      <div style="
        font-weight:800;font-size:0.8rem;color:var(--color-text);
        text-align:center;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;
      ">${_phEsc(goal.title)}</div>
      <div style="font-weight:900;font-size:0.88rem;color:#16A34A;text-align:center;">
        ${Currency.formatILS(goal.targetAgorot)}
      </div>
    </div>`;
}

/** Read agorot from the custom price input (#gp-price). */
function _phGetCustomAgorot() {
  const el  = document.getElementById('gp-price');
  const raw = (el ? el.value : '').trim();
  return Currency.parseILSInput(raw) || 0;
}

/**
 * Rebuild the selected-goals panel below the grid, then rewire its events.
 * Called when the cart selection changes (goal card click).
 */
function _phRebuildSelectedPanel(el, cart, prices, purchasableGoals, walletTotalAgorot) {
  const customAgorot = _phGetCustomAgorot();
  const panelEl   = document.getElementById('gp-selected-panel');
  const cartKeys  = Object.keys(cart);

  if (panelEl) {
    if (cartKeys.length === 0) {
      panelEl.style.display = 'none';
      panelEl.innerHTML     = '';
    } else {
      panelEl.style.display = '';
      panelEl.innerHTML     = _phSelectedPanelHTML(cart, prices, purchasableGoals);

      // Wire "המחיר השתנה?" toggle buttons
      panelEl.querySelectorAll('.gpr-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const gid      = btn.dataset.goalId;
          const editorEl = document.getElementById(`gpr-editor-${gid}`);
          if (!editorEl) return;
          const isOpen   = editorEl.style.display !== 'none';
          editorEl.style.display = isOpen ? 'none' : '';
          if (!isOpen) {
            const inp = editorEl.querySelector('input');
            if (inp) { inp.focus(); inp.select(); }
          }
        });
      });

      // Wire price inputs — update price without rebuilding panel (keeps focus)
      panelEl.querySelectorAll('.gpr-price-input').forEach(input => {
        input.addEventListener('input', () => {
          const gid    = input.dataset.goalId;
          const agorot = Currency.parseILSInput((input.value || '').trim());
          const orig   = purchasableGoals.find(g => g.goalId === gid);
          prices[gid]  = (agorot && agorot > 0) ? agorot : (orig ? orig.targetAgorot : 0);
          if (gid in cart) cart[gid] = prices[gid];

          // Update price display span without full rebuild
          const dispEl = document.getElementById(`gpr-display-${gid}`);
          if (dispEl) dispEl.textContent = Currency.formatILS(prices[gid]);

          _phUpdateTotalAndButton(el, cart, prices, _phGetCustomAgorot(), walletTotalAgorot);
          _phUpdateGoalCardStates(el, cart, prices, purchasableGoals, _phGetCustomAgorot(), walletTotalAgorot);
        });
      });
    }
  }

  // Update dynamic custom section label
  const customLabel = document.getElementById('gp-custom-label');
  if (customLabel) {
    customLabel.textContent = cartKeys.length > 0
      ? 'רוצה להוסיף עוד משהו?'
      : '🛒 קונה משהו אחר?';
  }

  _phUpdateTotalAndButton(el, cart, prices, customAgorot, walletTotalAgorot);
  _phUpdateGoalCardStates(el, cart, prices, purchasableGoals, customAgorot, walletTotalAgorot);
}

/** Build the inner HTML for the selected-goals price panel. */
function _phSelectedPanelHTML(cart, prices, purchasableGoals) {
  const rows = purchasableGoals
    .filter(g => g.goalId in cart)
    .map(g => {
      const gid          = _phEsc(g.goalId);
      const currentPrice = prices[g.goalId] || g.targetAgorot;
      return `
        <div style="padding:6px 0;border-bottom:1px solid var(--color-border);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;">
              <span style="font-size:1.2rem;flex-shrink:0;">${g.emoji}</span>
              <span style="font-weight:700;font-size:0.88rem;color:var(--color-text);
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_phEsc(g.title)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <span id="gpr-display-${gid}" style="font-weight:800;font-size:0.95rem;color:#16A34A;">
                ${Currency.formatILS(currentPrice)}
              </span>
              <button class="gpr-toggle" data-goal-id="${gid}" type="button" style="
                background:none;border:1.5px solid var(--color-border);border-radius:7px;
                padding:3px 8px;font-size:0.68rem;font-weight:600;font-family:inherit;
                color:var(--color-text-muted);cursor:pointer;white-space:nowrap;
              ">✏️ המחיר השתנה?</button>
            </div>
          </div>
          <div id="gpr-editor-${gid}" style="display:none;margin-top:6px;padding:0 2px;">
            <div style="position:relative;">
              <input class="gpr-price-input" data-goal-id="${gid}"
                type="number" inputmode="decimal" min="0.01" step="0.01"
                value="${(currentPrice / 100).toFixed(2)}"
                style="
                  width:100%;box-sizing:border-box;
                  padding:9px 14px 9px 38px;
                  font-size:1.05rem;font-weight:800;font-family:inherit;
                  border:2px solid var(--color-border);border-radius:10px;
                  background:var(--color-bg);color:var(--color-text);
                  text-align:left;direction:ltr;
                ">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
                font-size:0.95rem;font-weight:700;color:var(--color-text-muted);pointer-events:none;">₪</span>
            </div>
          </div>
        </div>`;
    }).join('');

  return `
    <div style="
      background:var(--color-bg-subtle,#F8FAFC);border:1.5px solid var(--color-border);
      border-radius:12px;padding:10px 12px;margin-bottom:10px;
    ">
      <div style="font-size:0.7rem;font-weight:700;color:var(--color-text-muted);
        margin-bottom:4px;letter-spacing:0.04em;">בחרת למימוש</div>
      ${rows}
    </div>`;
}

/** Update total strip + continue button text/state. No panel rebuild. */
function _phUpdateTotalAndButton(el, cart, prices, customAgorot, walletTotalAgorot) {
  const goalTotal   = Object.keys(cart).reduce((s, gid) => s + (prices[gid] || 0), 0);
  const totalAgorot = goalTotal + customAgorot;
  const canProceed  = totalAgorot > 0 && totalAgorot <= walletTotalAgorot;

  const totalStrip    = document.getElementById('gp-total-strip');
  const totalAmountEl = document.getElementById('gp-total-amount');
  const errEl         = document.getElementById('gp-err');
  const contBtn       = document.getElementById('gp-continue');

  if (totalAgorot > 0) {
    if (totalStrip) totalStrip.style.display = '';
    if (totalAmountEl) totalAmountEl.textContent = Currency.formatILS(totalAgorot);
    if (totalAgorot > walletTotalAgorot) {
      if (totalStrip)    { totalStrip.style.background = '#FEF2F2'; totalStrip.style.borderColor = '#FCA5A5'; }
      if (totalAmountEl) totalAmountEl.style.color = '#DC2626';
      if (errEl)         errEl.textContent = 'אין מספיק בארנק. אולי צריך לבקש מאבאמא לפדות מהחיסכון.';
    } else {
      if (totalStrip)    { totalStrip.style.background = '#F0FDF4'; totalStrip.style.borderColor = '#86EFAC'; }
      if (totalAmountEl) totalAmountEl.style.color = '#15803D';
      if (errEl)         errEl.textContent = '';
    }
  } else {
    if (totalStrip) totalStrip.style.display = 'none';
    if (errEl)      errEl.textContent = '';
  }

  if (contBtn) {
    contBtn.disabled      = !canProceed;
    contBtn.style.opacity = canProceed ? '1' : '0.4';
    contBtn.textContent   = totalAgorot > 0
      ? `המשך לתשלום ${Currency.formatILS(totalAgorot)} ←`
      : 'המשך לתשלום ←';
  }
}

/** Update goal card visual states: selection highlight, checkmark, disabled. */
function _phUpdateGoalCardStates(el, cart, prices, purchasableGoals, customAgorot, walletTotalAgorot) {
  purchasableGoals.forEach(g => {
    const card = el.querySelector(`.gp-goal-card[data-goal-id="${g.goalId}"]`);
    if (!card) return;
    const isSelected = g.goalId in cart;
    const otherTotal = Object.entries(cart)
      .filter(function(e) { return e[0] !== g.goalId; })
      .reduce(function(s, e) { return s + e[1]; }, 0);
    const canAfford  = isSelected || (otherTotal + prices[g.goalId] + customAgorot <= walletTotalAgorot);

    card.style.borderColor = isSelected ? '#16A34A' : canAfford ? '#86EFAC' : '#E5E7EB';
    card.style.borderStyle = isSelected ? 'solid' : 'dashed';
    card.style.background  = isSelected ? '#DCFCE7' : 'var(--color-bg)';
    card.style.opacity     = canAfford ? '1' : '0.45';
    card.style.cursor      = canAfford ? 'pointer' : 'not-allowed';
    card.dataset.disabled  = canAfford ? '' : 'true';
    const chk = card.querySelector('.gp-chk');
    if (chk) chk.style.display = isSelected ? 'flex' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// GOAL PRICE REVIEW — per-goal price editing BEFORE payment wizard
// No API calls here. Passes goalContext into Step 2.
// ══════════════════════════════════════════════════════════════

function _phGoalPriceReview(el, userId, gender, onExit, cartArr, walletTotalAgorot) {
  // prices: goalId → actual price agorot (editable; starts at targetAgorot)
  const prices = {};
  cartArr.forEach(({ goal }) => { prices[goal.goalId] = goal.targetAgorot; });

  const itemRowsHTML = cartArr.map(({ goal }) => `
    <div style="
      border:1.5px solid var(--color-border);border-radius:12px;
      padding:12px;margin-bottom:8px;
    ">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-size:1.4rem;line-height:1;">${goal.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;font-size:0.95rem;color:var(--color-text);">
            ${_phEsc(goal.title)}
          </div>
          ${goal.store
            ? `<div style="font-size:0.72rem;color:var(--color-text-muted);">📍 ${_phEsc(goal.store)}</div>`
            : ''}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <span style="font-size:0.75rem;color:var(--color-text-muted);font-weight:600;">מחיר:</span>
          <span id="gpr-display-${_phEsc(goal.goalId)}"
            style="font-weight:900;font-size:1.05rem;color:var(--color-text);margin-right:6px;">
            ${Currency.formatILS(goal.targetAgorot)}
          </span>
        </div>
        <button class="gpr-toggle" data-goal-id="${_phEsc(goal.goalId)}" type="button"
          style="
            background:none;border:1.5px solid var(--color-border);border-radius:8px;
            padding:4px 10px;font-size:0.75rem;font-weight:600;font-family:inherit;
            color:var(--color-text-muted);cursor:pointer;white-space:nowrap;flex-shrink:0;
          ">✏️ המחיר השתנה?</button>
      </div>

      <div id="gpr-editor-${_phEsc(goal.goalId)}" style="display:none;margin-top:8px;">
        <div style="position:relative;">
          <input id="gpr-input-${_phEsc(goal.goalId)}"
            type="number" inputmode="decimal" min="0.01" step="0.01"
            value="${(goal.targetAgorot / 100).toFixed(2)}"
            style="
              width:100%;box-sizing:border-box;
              padding:10px 44px 10px 16px;
              font-size:1.15rem;font-weight:800;font-family:inherit;
              border:2px solid var(--color-border);border-radius:10px;
              background:var(--color-bg);color:var(--color-text);
              text-align:left;direction:ltr;
            ">
          <span style="
            position:absolute;left:14px;top:50%;transform:translateY(-50%);
            font-size:1rem;font-weight:700;color:var(--color-text-muted);pointer-events:none;
          ">₪</span>
        </div>
      </div>
    </div>`).join('');

  const initTotal = cartArr.reduce((s, c) => s + c.actualPrice, 0);

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">🏆 מחיר לקנייה</span>
      </div>

      <!-- Wallet balance reference -->
      <div style="
        display:flex;justify-content:space-between;align-items:center;
        padding:10px 14px;background:#EFF6FF;border:1.5px solid #93C5FD;
        border-radius:12px;margin-bottom:14px;
      ">
        <span style="font-size:0.82rem;color:#1E40AF;font-weight:600;">
          💳 ארנק פיזי
        </span>
        <span style="font-weight:900;font-size:1.05rem;color:#1E40AF;">
          ${Currency.formatILS(walletTotalAgorot)}
        </span>
      </div>

      ${itemRowsHTML}

      <!-- Running total -->
      <div style="
        padding:12px 14px;background:var(--color-bg-subtle,#F8FAFC);
        border-radius:12px;margin-bottom:12px;
        display:flex;justify-content:space-between;align-items:center;
      ">
        <span style="font-size:0.9rem;font-weight:700;color:var(--color-text);">
          סה"כ לתשלום
        </span>
        <span id="gpr-total"
          style="font-weight:900;font-size:1.15rem;color:var(--color-text);">
          ${Currency.formatILS(initTotal)}
        </span>
      </div>

      <div id="gpr-err" style="
        color:#DC2626;font-size:0.85rem;min-height:1.2em;
        text-align:center;margin-bottom:8px;
      "></div>

      <button id="gpr-continue" type="button" style="${_phPrimaryBtnStyle()}">
        המשך לתשלום מהארנק ←
      </button>
    </div>`;

  // Back → Step 0
  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep0(el, userId, gender, onExit));

  // "Price changed?" toggles
  el.querySelectorAll('.gpr-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid      = btn.dataset.goalId;
      const editorEl = document.getElementById(`gpr-editor-${gid}`);
      const inputEl  = document.getElementById(`gpr-input-${gid}`);
      if (!editorEl) return;
      const isOpen = editorEl.style.display !== 'none';
      editorEl.style.display = isOpen ? 'none' : '';
      if (!isOpen && inputEl) { inputEl.focus(); inputEl.select(); }
    });
  });

  // Price inputs: update prices + total
  cartArr.forEach(({ goal }) => {
    const inputEl   = document.getElementById(`gpr-input-${goal.goalId}`);
    const displayEl = document.getElementById(`gpr-display-${goal.goalId}`);
    if (!inputEl) return;

    inputEl.addEventListener('input', () => {
      const agorot = Currency.parseILSInput((inputEl.value || '').trim());
      if (agorot && agorot > 0) {
        prices[goal.goalId] = agorot;
        if (displayEl) displayEl.textContent = Currency.formatILS(agorot);
      } else {
        prices[goal.goalId] = goal.targetAgorot;
      }
      _phGprUpdateTotal(prices);
    });
  });

  // Continue → wallet payment wizard
  document.getElementById('gpr-continue').addEventListener('click', () => {
    // Sync any open editors into prices
    cartArr.forEach(({ goal }) => {
      const editorEl = document.getElementById(`gpr-editor-${goal.goalId}`);
      const inputEl  = document.getElementById(`gpr-input-${goal.goalId}`);
      if (editorEl && editorEl.style.display !== 'none' && inputEl) {
        const agorot = Currency.parseILSInput((inputEl.value || '').trim());
        if (agorot && agorot > 0) prices[goal.goalId] = agorot;
      }
    });

    const totalAgorot = Object.values(prices).reduce((s, p) => s + p, 0);
    if (!totalAgorot || totalAgorot <= 0) {
      const errEl = document.getElementById('gpr-err');
      if (errEl) errEl.textContent = 'יש להזין מחיר חוקי.';
      return;
    }

    const description = cartArr.map(c => `${c.goal.emoji} ${c.goal.title}`).join(' + ');
    const goalContext = {
      goalIds:    cartArr.map(c => c.goal.goalId),
      goalTitles: cartArr.map(c => `${c.goal.emoji} ${c.goal.title}`),
      prices:     Object.assign({}, prices), // snapshot
    };
    const onBack = () => _phGoalPriceReview(el, userId, gender, onExit, cartArr, walletTotalAgorot);
    _phStep2(el, userId, gender, onExit, totalAgorot, description, onBack, goalContext);
  });
}

/** Update running total in the price review screen. */
function _phGprUpdateTotal(prices) {
  const totalEl = document.getElementById('gpr-total');
  if (totalEl) {
    totalEl.textContent = Currency.formatILS(
      Object.values(prices).reduce((s, p) => s + p, 0)
    );
  }
}

// ══════════════════════════════════════════════════════════════
// STEP 2 — Payment selection (physical wallet)
// ══════════════════════════════════════════════════════════════

/**
 * @param {Function}    onBack      — ← button target (step0 or price-review)
 * @param {Object|null} goalContext — null for regular purchases
 */
async function _phStep2(el, userId, gender, onExit, priceAgorot, description, onBack, goalContext) {
  const goBack = onBack || (() => _phStep0(el, userId, gender, onExit));
  _phShowLoading(el, '🛒 בחר תשלום', goBack);

  let walletData;
  try {
    const { data } = await API.callGASWithFallback(
      'getPurchaseSuggestions', { userId, priceAgorot });
    walletData = data;
  } catch (err) {
    _phShowError(el, err.message, goBack);
    return;
  }

  _phStep2Render(el, userId, gender, onExit, priceAgorot, description, walletData, goBack, goalContext);
}

function _phStep2Render(el, userId, gender, onExit, priceAgorot, description, walletData, onBack, goalContext) {
  const { walletCounts, walletTotalAgorot, savingsAgorot, suggestions, canAfford } = walletData;
  const goBack = onBack || (() => _phStep0(el, userId, gender, onExit));

  const activeDenoms = Currency.DENOMINATIONS.slice().reverse().filter(
    d => _phGetCount(walletCounts, d.agorot) > 0);

  const sel = {};
  Currency.DENOMINATIONS.forEach(d => { sel[d.agorot] = 0; });

  // ── Goal context banner ────────────────────────────────────
  const goalBannerHTML = goalContext ? `
    <div style="
      background:#ECFDF5;border:1.5px solid #34D399;
      border-radius:12px;padding:10px 14px;margin-bottom:12px;
      font-size:0.82rem;font-weight:700;color:#065F46;
      display:flex;align-items:center;gap:8px;
    ">
      🏆 <span>${_phEsc(goalContext.goalTitles.join(' + '))}</span>
    </div>` : '';

  const sugsHTML = suggestions.map((s, i) => {
    const chipsHTML  = _phDenomChipsRowHTML(s.denomCounts);
    const changeText = s.changeAgorot > 0
      ? ` · עודף: ${Currency.formatILS(s.changeAgorot)}` : '';
    return `
      <div class="ph-sug" data-sug="${i}" style="
        border:2px solid var(--color-border);border-radius:14px;
        padding:11px 14px;margin-bottom:9px;cursor:pointer;
        background:var(--color-bg);
      ">
        <div style="font-size:0.78rem;color:var(--color-text-muted);margin-bottom:4px;font-weight:600;">
          💡 ${_phEsc(s.label)}
        </div>
        ${chipsHTML}
        <div style="font-size:0.8rem;margin-top:6px;font-weight:700;
          color:${s.exact ? '#16A34A' : '#2563EB'};">
          ${s.exact ? '✓ תשלום מדויק' : 'עם עודף'}${_phEsc(changeText)}
        </div>
      </div>`;
  }).join('');

  // Transfer-row card: each denom = [wallet count] [← btn] [image] [→ btn] [selected count]
  // RTL layout: wallet (right) ← image → selected (left)
  // ← = move one coin/bill from wallet into payment
  // → = return one coin/bill from payment back to wallet
  const denomRowsHTML = activeDenoms.map(d => {
    const max    = _phGetCount(walletCounts, d.agorot);
    const isCoin = d.type === 'coin';
    const imgSrc = _phDenomImgSrc(d.agorot);
    const h      = isCoin ? 40 : 28; // coins round; bills landscape
    return `
      <div style="
        display:flex;align-items:center;gap:0;
        padding:10px 6px;
        border:1.5px solid var(--color-border);border-radius:14px;
        margin-bottom:8px;background:var(--color-bg);
      ">
        <!-- RIGHT: how many are still in wallet -->
        <div style="flex:1;text-align:center;min-width:0;padding:0 4px;">
          <div style="font-size:0.7rem;font-weight:700;color:var(--color-text-muted);
            margin-bottom:2px;white-space:nowrap;">יש לי בארנק</div>
          <div id="ph-avl-${d.agorot}"
            style="font-size:1.5rem;font-weight:900;color:var(--color-text);line-height:1;">
            ${max}
          </div>
        </div>

        <!-- → return one from payment back to wallet (RIGHT of image in RTL) -->
        <button class="ph-ret" id="ph-ret-${d.agorot}" data-denom="${d.agorot}"
          type="button" aria-label="החזר לארנק"
          style="${_phTransferBtnStyle(false)}" disabled>→</button>

        <!-- CENTER: coin/bill image + label (visual identity only) -->
        <div style="
          display:flex;flex-direction:column;align-items:center;gap:3px;
          min-width:54px;padding:0 4px;flex-shrink:0;
        ">
          ${imgSrc
            ? `<img src="${imgSrc}"
                style="height:${h}px;width:auto;max-width:50px;display:block;object-fit:contain;"
                alt="" draggable="false" loading="lazy">`
            : `<span style="font-size:0.85rem;font-weight:800;">${_phEsc(d.labelHe)}</span>`
          }
          <span style="font-size:0.7rem;font-weight:700;color:var(--color-text-muted);
            white-space:nowrap;">${_phEsc(d.labelHe)}</span>
        </div>

        <!-- ← take one from wallet, add to payment (LEFT of image in RTL) -->
        <button class="ph-add" id="ph-add-${d.agorot}" data-denom="${d.agorot}"
          type="button" aria-label="העבר לתשלום"
          style="${_phTransferBtnStyle(true)}" ${max === 0 ? 'disabled' : ''}>←</button>

        <!-- LEFT: how many selected for payment -->
        <div style="flex:1;text-align:center;min-width:0;padding:0 4px;">
          <div style="font-size:0.7rem;font-weight:700;color:var(--color-text-muted);
            margin-bottom:2px;white-space:nowrap;">בחרתי לשלם</div>
          <div id="ph-sel-${d.agorot}"
            style="font-size:1.5rem;font-weight:900;color:#16A34A;line-height:1;">
            0
          </div>
        </div>
      </div>`;
  }).join('');

  const insuffHTML = !canAfford ? `
    <div style="
      background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:12px;
      padding:12px;margin-bottom:12px;font-size:0.88rem;color:#92400E;line-height:1.55;
    ">
      ⚠ הארנק הפיזי (${Currency.formatILS(walletTotalAgorot)}) לא מספיק לשלם
      ${Currency.formatILS(priceAgorot)}.
      ${savingsAgorot > 0
        ? `<br>יש לך <strong>${Currency.formatILS(savingsAgorot)}</strong> בחיסכון —
           אפשר לבקש מאמא ואבא לעזור.`
        : ''}
    </div>` : '';

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">🛒 בחר תשלום</span>
      </div>

      ${goalBannerHTML}

      <!-- Price vs wallet -->
      <div style="
        display:flex;justify-content:space-between;align-items:center;
        padding:12px 14px;background:var(--color-bg-subtle,#F8FAFC);
        border-radius:12px;margin-bottom:12px;
      ">
        <div>
          <div style="font-size:0.72rem;color:var(--color-text-muted);font-weight:600;margin-bottom:2px;">
            ${goalContext ? 'סה"כ לתשלום' : 'מחיר'}
          </div>
          <div style="font-size:1.5rem;font-weight:900;color:var(--color-text);">
            ${Currency.formatILS(priceAgorot)}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:0.72rem;color:var(--color-text-muted);font-weight:600;margin-bottom:2px;">
            בארנק שלך
          </div>
          <div style="font-size:1.1rem;font-weight:800;
            color:${canAfford ? '#0EA5E9' : '#DC2626'};">
            ${Currency.formatILS(walletTotalAgorot)}
          </div>
        </div>
      </div>

      ${insuffHTML}

      ${suggestions.length > 0 ? `
        <div style="${_phSectionLabelStyle()}">💡 הצעות תשלום</div>
        ${sugsHTML}
        <div style="
          text-align:center;font-size:0.75rem;color:var(--color-text-muted);
          font-weight:600;margin:12px 0 8px;letter-spacing:0.04em;
        ">— או בחר ידנית —</div>
      ` : (activeDenoms.length > 0
          ? `<div style="${_phSectionLabelStyle()}">🪙 בחר מטבעות / שטרות לתשלום</div>`
          : '')}

      ${activeDenoms.length > 0 ? `<div style="margin-bottom:4px;">${denomRowsHTML}</div>` : ''}
      ${activeDenoms.length === 0 && canAfford
        ? '<p style="font-size:0.85rem;color:var(--color-text-muted);margin-top:8px;">הארנק ריק.</p>'
        : ''}

      <!-- Payment status strip -->
      <div style="
        margin-top:14px;padding:12px 14px;
        background:var(--color-bg-subtle,#F8FAFC);border-radius:12px;
      ">
        <div style="
          display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;
        ">
          <span style="font-size:0.8rem;font-weight:700;color:var(--color-text-muted);">
            בחרתי לשלם
          </span>
          <span id="ph-ptotal"
            style="font-size:1.4rem;font-weight:900;color:var(--color-text);">
            ${Currency.formatILS(0)}
          </span>
        </div>
        <div style="
          display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;
        ">
          <span style="font-size:0.72rem;color:var(--color-text-muted);">
            נשאר בארנק אחרי הבחירה
          </span>
          <span id="ph-wallet-rem"
            style="font-size:0.82rem;font-weight:700;color:var(--color-text-muted);">
            ${Currency.formatILS(walletTotalAgorot)}
          </span>
        </div>
        <div id="ph-pstatus" style="font-size:0.88rem;min-height:1.3em;text-align:center;margin-top:2px;"></div>
      </div>

      <button id="ph-next" type="button" disabled
        style="${_phPrimaryBtnStyle()} margin-top:12px;opacity:0.45;">
        שילמתי לחנות ←
      </button>
    </div>`;

  document.getElementById('ph-back').addEventListener('click', goBack);

  // Suggestion cards — load suggestion into transfer UI
  el.querySelectorAll('.ph-sug').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.sug, 10);
      const sug = suggestions[idx];

      Currency.DENOMINATIONS.forEach(d => { sel[d.agorot] = 0; });
      Object.entries(sug.denomCounts).forEach(([dk, c]) => {
        sel[parseInt(dk, 10)] = c;
      });
      _phSyncTransferUI(el, sel, walletCounts);
      _phUpdatePayStatus(el, sel, priceAgorot, walletTotalAgorot);
      el.querySelectorAll('.ph-sug').forEach((c, ci) => {
        c.style.borderColor = ci === idx ? '#0EA5E9' : '';
        c.style.background  = ci === idx ? '#EFF6FF' : '';
      });
    });
  });

  // Transfer buttons: ← move from wallet to payment, → return from payment to wallet
  el.querySelectorAll('.ph-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom = parseInt(btn.dataset.denom, 10);
      const max   = _phGetCount(walletCounts, denom);
      if ((sel[denom] || 0) >= max) return;
      sel[denom] = (sel[denom] || 0) + 1;
      _phSyncTransferUI(el, sel, walletCounts);
      _phUpdatePayStatus(el, sel, priceAgorot, walletTotalAgorot);
      el.querySelectorAll('.ph-sug').forEach(c => { c.style.borderColor = ''; c.style.background = ''; });
    });
  });

  el.querySelectorAll('.ph-ret').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom = parseInt(btn.dataset.denom, 10);
      if ((sel[denom] || 0) <= 0) return;
      sel[denom] = (sel[denom] || 0) - 1;
      _phSyncTransferUI(el, sel, walletCounts);
      _phUpdatePayStatus(el, sel, priceAgorot, walletTotalAgorot);
      el.querySelectorAll('.ph-sug').forEach(c => { c.style.borderColor = ''; c.style.background = ''; });
    });
  });

  // Proceed
  document.getElementById('ph-next').addEventListener('click', () => {
    const paidCounts   = _phCleanCounts(sel);
    const paidTotal    = _phCountsSum(paidCounts);
    const changeAgorot = paidTotal - priceAgorot;

    if (changeAgorot === 0) {
      _phStep4(el, userId, gender, onExit, priceAgorot, description,
        paidCounts, {}, 0, walletData, goalContext);
    } else {
      _phStep3(el, userId, gender, onExit, priceAgorot, description,
        paidCounts, paidTotal, changeAgorot, walletData, goBack, goalContext);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// STEP 3 — Change entry
// ══════════════════════════════════════════════════════════════

function _phStep3(el, userId, gender, onExit, priceAgorot, description,
                  paidCounts, paidTotal, expectedChange, walletData, onBack, goalContext) {
  const goBack = onBack || (() => _phStep0(el, userId, gender, onExit));
  const chg    = {};
  Currency.DENOMINATIONS.forEach(d => { chg[d.agorot] = 0; });

  const denomRowsHTML = Currency.DENOMINATIONS.slice().reverse().map(d => {
    const isCoin = d.type === 'coin';
    return `
      <div style="
        display:flex;align-items:center;gap:8px;
        padding:8px 0;border-bottom:1px solid var(--color-border);
      ">
        ${_phDenomRowImgHTML(d.agorot, isCoin)}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:0.9rem;
            color:${isCoin ? '#92400E' : '#065F46'};">${_phEsc(d.labelHe)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          <button class="phc-minus" data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(false)}" aria-label="פחות">−</button>
          <div id="phc-sel-${d.agorot}" style="${_phStepperCountStyle()}">0</div>
          <button class="phc-plus"  data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(true)}"  aria-label="יותר">+</button>
        </div>
        <div id="phc-sub-${d.agorot}" style="
          font-size:0.72rem;color:var(--color-text-muted);
          min-width:48px;text-align:left;direction:ltr;
        "></div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">🪙 קיבלת עודף</span>
      </div>

      <div style="
        background:#ECFDF5;border:1.5px solid #34D399;
        border-radius:14px;padding:14px;margin-bottom:16px;text-align:center;
      ">
        <div style="font-size:0.78rem;color:#065F46;font-weight:600;margin-bottom:2px;">שילמת</div>
        <div style="font-size:1.15rem;font-weight:800;color:var(--color-text);">
          ${Currency.formatILS(paidTotal)}
        </div>
        <div style="margin:6px 0;color:#34D399;font-size:1.1rem;line-height:1;">↓</div>
        <div style="font-size:0.78rem;color:#065F46;font-weight:600;margin-bottom:2px;">
          עודף מגיע לך
        </div>
        <div style="font-size:1.6rem;font-weight:900;color:#16A34A;">
          ${Currency.formatILS(expectedChange)}
        </div>
      </div>

      <div style="${_phSectionLabelStyle()}">הכנס את העודף שקיבלת מהחנות:</div>
      <div style="margin-bottom:4px;">${denomRowsHTML}</div>

      <div style="
        margin-top:14px;padding:12px 14px;
        background:var(--color-bg-subtle,#F8FAFC);border-radius:12px;text-align:center;
      ">
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:3px;">הכנסת</div>
        <div id="phc-total" style="font-size:1.5rem;font-weight:900;color:var(--color-text);">
          ${Currency.formatILS(0)}
        </div>
        <div id="phc-status" style="font-size:0.88rem;min-height:1.3em;margin-top:3px;"></div>
      </div>

      <button id="ph-next" type="button" disabled
        style="${_phPrimaryBtnStyle()} margin-top:12px;opacity:0.45;">
        קיבלתי את העודף ←
      </button>
    </div>`;

  // Back → step 2 (no re-fetch; reuses cached walletData)
  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep2Render(el, userId, gender, onExit, priceAgorot, description,
      walletData, goBack, goalContext));

  el.querySelectorAll('.phc-plus, .phc-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom = parseInt(btn.dataset.denom, 10);
      const delta = btn.classList.contains('phc-plus') ? 1 : -1;
      chg[denom]  = Math.max(0, (chg[denom] || 0) + delta);

      const countEl = document.getElementById(`phc-sel-${denom}`);
      if (countEl) countEl.textContent = chg[denom];
      const subEl = document.getElementById(`phc-sub-${denom}`);
      if (subEl) subEl.textContent = chg[denom] > 0 ? Currency.formatILS(chg[denom] * denom) : '';

      _phUpdateChangeStatus(el, chg, expectedChange);
    });
  });

  document.getElementById('ph-next').addEventListener('click', () => {
    const changeCounts = _phCleanCounts(chg);
    _phStep4(el, userId, gender, onExit, priceAgorot, description,
      paidCounts, changeCounts, expectedChange, walletData, goalContext);
  });
}

// ══════════════════════════════════════════════════════════════
// STEP 4 — Confirm + save
//
// Sequence for goal purchases:
//   1. recordPurchase  → updates wallet_denominations + logs transaction
//   2. completeGoal×N  → marks goals done (skipSavingsDeduction:true)
//   If recordPurchase fails → nothing is touched; show error.
//   If completeGoal fails after purchase → purchase stays; show recoverable warning.
// ══════════════════════════════════════════════════════════════

function _phStep4(el, userId, gender, onExit, priceAgorot, description,
                  paidCounts, changeCounts, changeAgorot, walletData, goalContext) {
  const paidTotal  = _phCountsSum(paidCounts);
  const enterLabel = gender === 'f' ? 'הכניסי לארנק האמיתי ✓' : 'הכנס לארנק האמיתי ✓';

  const paidDesc = Currency.DENOMINATIONS
    .filter(d => (paidCounts[d.agorot] || 0) > 0)
    .map(d => `${paidCounts[d.agorot]}×${d.labelHe}`)
    .join(' + ');

  const changeDesc = changeAgorot > 0
    ? Currency.DENOMINATIONS
        .filter(d => (changeCounts[d.agorot] || 0) > 0)
        .map(d => `${changeCounts[d.agorot]}×${d.labelHe}`)
        .join(' + ')
    : null;

  // Goal rows in summary
  const goalSummaryHTML = goalContext ? `
    <div style="
      background:#ECFDF5;border:1.5px solid #34D399;
      border-radius:10px;padding:10px 12px;margin-bottom:12px;
    ">
      <div style="font-size:0.75rem;font-weight:700;color:#065F46;margin-bottom:4px;">
        🏆 מסמן כנקנה:
      </div>
      ${goalContext.goalTitles.map((t, i) => `
        <div style="font-size:0.88rem;font-weight:700;color:var(--color-text);line-height:1.5;">
          ${_phEsc(t)} — ${Currency.formatILS(goalContext.prices[goalContext.goalIds[i]])}
        </div>`).join('')}
    </div>` : '';

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">✓ אישור קנייה</span>
      </div>

      ${goalSummaryHTML}

      <!-- Purchase summary card -->
      <div style="
        border:2px solid var(--color-border);border-radius:16px;
        padding:16px;margin-bottom:16px;
      ">
        ${description
          ? `<div style="font-weight:800;font-size:1rem;color:var(--color-text);margin-bottom:12px;">
               🛒 ${_phEsc(description)}
             </div>`
          : ''}

        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--color-text-muted);font-size:0.88rem;">שילמת לחנות</span>
          <span style="font-weight:700;">${Currency.formatILS(paidTotal)}</span>
        </div>
        <div style="
          font-size:0.75rem;color:var(--color-text-muted);margin-bottom:10px;
          direction:ltr;text-align:left;line-height:1.5;
        ">${_phEsc(paidDesc)}</div>

        ${changeAgorot > 0 ? `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--color-text-muted);font-size:0.88rem;">עודף קיבלת</span>
            <span style="font-weight:700;color:#16A34A;">${Currency.formatILS(changeAgorot)}</span>
          </div>
          ${changeDesc ? `<div style="
            font-size:0.75rem;color:var(--color-text-muted);margin-bottom:10px;
            direction:ltr;text-align:left;line-height:1.5;
          ">${_phEsc(changeDesc)}</div>` : ''}
        ` : ''}

        <div style="height:1px;background:var(--color-border);margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="font-weight:700;font-size:0.95rem;">שולם בפועל</span>
          <span style="font-weight:900;font-size:1.2rem;color:var(--color-primary,#0EA5E9);">
            ${Currency.formatILS(priceAgorot)}
          </span>
        </div>
      </div>

      <div id="ph-save-err" style="
        color:#DC2626;font-size:0.85rem;min-height:1.2em;
        text-align:center;margin-bottom:8px;
      "></div>

      <button id="ph-confirm" type="button" style="${_phPrimaryBtnStyle()}">
        ${_phEsc(enterLabel)}
      </button>

      <button id="ph-cancel" type="button" style="
        width:100%;padding:12px;margin-top:8px;font-family:inherit;
        background:none;border:1.5px solid var(--color-border);
        border-radius:14px;font-size:0.9rem;font-weight:600;
        color:var(--color-text-muted);cursor:pointer;
      ">ביטול</button>
    </div>`;

  // Back → step 0 (simpler than reconstructing step 2 state)
  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep0(el, userId, gender, onExit));
  document.getElementById('ph-cancel').addEventListener('click', onExit);

  document.getElementById('ph-confirm').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('ph-confirm');
    const errEl      = document.getElementById('ph-save-err');
    if (!confirmBtn) return;

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'שומר...';
    if (errEl) errEl.textContent = '';

    try {
      // ── Step 1: record physical wallet payment ───────────────
      await API.callGASWithFallback('recordPurchase', {
        userId, priceAgorot, paidCounts, changeCounts, description,
      });

      // ── Step 2 (goal purchases only): mark goals complete ────
      if (goalContext && goalContext.goalIds.length > 0) {
        const failedGoalTitles = [];

        for (let i = 0; i < goalContext.goalIds.length; i++) {
          const goalId    = goalContext.goalIds[i];
          const goalTitle = goalContext.goalTitles[i] || goalId;
          try {
            await API.callGASWithFallback('completeGoal', {
              userId,
              goalId,
              actualPriceAgorot:   goalContext.prices[goalId],
              skipSavingsDeduction: true,
            });
          } catch (gErr) {
            failedGoalTitles.push(goalTitle);
            console.warn('[purchase-helper] completeGoal failed for', goalId, gErr.message);
          }
        }

        if (failedGoalTitles.length > 0) {
          // Recoverable: purchase is logged, but some goals weren't marked done.
          // Parent can fix manually via parent controls.
          el.innerHTML = `
            <div style="text-align:center;padding:28px 16px;">
              <div style="font-size:2.5rem;margin-bottom:10px;">⚠️</div>
              <div style="font-size:1.1rem;font-weight:900;color:#D97706;margin-bottom:10px;">
                הקנייה נרשמה!
              </div>
              <div style="
                font-size:0.88rem;color:var(--color-text-muted);
                line-height:1.7;margin-bottom:20px;
              ">
                תשלום של ${Currency.formatILS(priceAgorot)} נרשם בהצלחה.<br>
                אבל לא הצלחנו לסמן ${failedGoalTitles.length === 1 ? 'את המטרה' : 'את המטרות'}
                הבאות כהושלמות:<br>
                <strong>${failedGoalTitles.map(t => _phEsc(t)).join('<br>')}</strong><br><br>
                אפשר לבקש מאמא/אבא לסמן ידנית בבקרת ההורים.
              </div>
              <button id="ph-done" type="button" style="${_phPrimaryBtnStyle()}">
                סיום
              </button>
            </div>`;
          document.getElementById('ph-done').addEventListener('click', onExit);
        } else {
          // ── Full success: purchase + all goals ───────────────
          el.innerHTML = `
            <div style="
              text-align:center;padding:32px 16px;
              display:flex;flex-direction:column;align-items:center;gap:14px;
            ">
              <div style="font-size:3rem;">🎉</div>
              <div style="font-size:1.3rem;font-weight:900;color:#16A34A;">קנייה נרשמה!</div>
              <div style="font-size:0.9rem;color:var(--color-text-muted);line-height:1.7;">
                שילמת ${Currency.formatILS(priceAgorot)}<br>
                ${goalContext.goalTitles.map(t => `✓ ${_phEsc(t)}`).join('<br>')}
              </div>
            </div>`;
          setTimeout(() => onExit(), 1800);
        }

      } else {
        // ── Regular purchase success ─────────────────────────
        el.innerHTML = `
          <div style="
            text-align:center;padding:32px 16px;
            display:flex;flex-direction:column;align-items:center;gap:14px;
          ">
            <div style="font-size:3rem;">🎉</div>
            <div style="font-size:1.3rem;font-weight:900;color:#16A34A;">קנייה נרשמה!</div>
            <div style="font-size:0.9rem;color:var(--color-text-muted);line-height:1.5;">
              שילמת ${Currency.formatILS(priceAgorot)}<br>הארנק שלך עודכן.
            </div>
          </div>`;
        setTimeout(() => onExit(), 1800);
      }

    } catch (err) {
      // recordPurchase failed — wallet untouched, no goals completed
      if (errEl) errEl.textContent = 'שגיאה: ' + err.message;
      if (confirmBtn) {
        confirmBtn.textContent = _phEsc(enterLabel);
        confirmBtn.disabled    = false;
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SHARED UI UPDATE HELPERS
// ══════════════════════════════════════════════════════════════

function _phUpdatePayStatus(el, sel, priceAgorot, walletTotalAgorot) {
  const total    = _phSelTotal(sel);
  const diff     = total - priceAgorot;
  const totalEl  = document.getElementById('ph-ptotal');
  const remEl    = document.getElementById('ph-wallet-rem');
  const statusEl = document.getElementById('ph-pstatus');
  const nextBtn  = document.getElementById('ph-next');

  if (totalEl) totalEl.textContent = Currency.formatILS(total);
  if (remEl)   remEl.textContent   = Currency.formatILS((walletTotalAgorot || 0) - total);
  if (!statusEl || !nextBtn) return;

  if (total === 0) {
    statusEl.innerHTML    = '';
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  } else if (diff < 0) {
    statusEl.innerHTML    = `<span style="color:#DC2626;">חסרים עוד ${Currency.formatILS(-diff)}</span>`;
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  } else if (diff === 0) {
    statusEl.innerHTML    = `<span style="color:#16A34A;font-weight:800;">✓ תשלום מדויק!</span>`;
    nextBtn.disabled      = false;
    nextBtn.style.opacity = '1';
  } else {
    statusEl.innerHTML    = `<span style="color:#2563EB;font-weight:700;">תקבל עודף ${Currency.formatILS(diff)}</span>`;
    nextBtn.disabled      = false;
    nextBtn.style.opacity = '1';
  }
}

function _phUpdateChangeStatus(el, chg, expectedChange) {
  const entered  = _phSelTotal(chg);
  const diff     = entered - expectedChange;
  const totalEl  = document.getElementById('phc-total');
  const statusEl = document.getElementById('phc-status');
  const nextBtn  = document.getElementById('ph-next');

  if (totalEl) totalEl.textContent = Currency.formatILS(entered);
  if (!statusEl || !nextBtn) return;

  if (entered === 0) {
    statusEl.innerHTML    = '';
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  } else if (diff < 0) {
    statusEl.innerHTML    = `<span style="color:#D97706;">חסרים עוד ${Currency.formatILS(-diff)}</span>`;
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  } else if (diff === 0) {
    statusEl.innerHTML    = `<span style="color:#16A34A;font-weight:800;">✓ בדיוק!</span>`;
    nextBtn.disabled      = false;
    nextBtn.style.opacity = '1';
  } else {
    statusEl.innerHTML    = `<span style="color:#DC2626;">הכנסת ${Currency.formatILS(diff)} יותר מדי</span>`;
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  }
}

/**
 * Syncs all transfer-row cards after sel[] changes (via button press or suggestion load).
 * Updates available counts, selected counts, and ← / → button disabled states.
 */
function _phSyncTransferUI(el, sel, walletCounts) {
  Currency.DENOMINATIONS.forEach(d => {
    const max      = _phGetCount(walletCounts, d.agorot);
    const selected = sel[d.agorot] || 0;
    const avail    = max - selected;

    const avlEl  = document.getElementById(`ph-avl-${d.agorot}`);
    const selEl  = document.getElementById(`ph-sel-${d.agorot}`);
    const addBtn = document.getElementById(`ph-add-${d.agorot}`);
    const retBtn = document.getElementById(`ph-ret-${d.agorot}`);

    if (avlEl) avlEl.textContent = avail;
    if (selEl) selEl.textContent = selected;

    if (addBtn) {
      const canAdd        = avail > 0;
      addBtn.disabled     = !canAdd;
      addBtn.style.opacity = canAdd ? '1' : '0.3';
    }
    if (retBtn) {
      const canRet        = selected > 0;
      retBtn.disabled     = !canRet;
      retBtn.style.opacity = canRet ? '1' : '0.3';
    }
  });
}

// ══════════════════════════════════════════════════════════════
// PURE HELPERS
// ══════════════════════════════════════════════════════════════

function _phSelTotal(sel) {
  return Currency.DENOMINATIONS.reduce((s, d) => s + d.agorot * (sel[d.agorot] || 0), 0);
}

function _phCountsSum(counts) {
  return Currency.DENOMINATIONS.reduce(
    (s, d) => s + d.agorot * (_phResolveDenomCount(counts, d.agorot)), 0);
}

function _phCleanCounts(sel) {
  const out = {};
  Currency.DENOMINATIONS.forEach(d => {
    const c = sel[d.agorot] || 0;
    if (c > 0) out[d.agorot] = c;
  });
  return out;
}

function _phGetCount(counts, agorot) {
  const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
  return Math.max(0, parseInt(v, 10) || 0);
}

function _phResolveDenomCount(counts, agorot) {
  const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
  return Math.max(0, parseInt(v, 10) || 0);
}

function _phShowLoading(el, title, onBack) {
  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-loading-back" type="button" style="${_phBackBtnStyle()}">←</button>
        <span style="${_phHeaderTitleStyle()}">${_phEsc(title)}</span>
      </div>
      <p style="text-align:center;color:var(--color-text-muted);padding:28px 0;font-size:0.9rem;">
        טוען...
      </p>
    </div>`;
  const back = document.getElementById('ph-loading-back');
  if (back) back.addEventListener('click', onBack);
}

function _phShowError(el, msg, onBack) {
  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-err-back" type="button" style="${_phBackBtnStyle()}">← חזרה</button>
      </div>
      <div style="
        background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:12px;
        padding:14px;margin-top:8px;color:#DC2626;font-size:0.88rem;line-height:1.5;
      ">שגיאה: ${_phEsc(msg)}</div>
    </div>`;
  const back = document.getElementById('ph-err-back');
  if (back) back.addEventListener('click', onBack);
}

function _phEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════════
// DENOMINATION VISUAL HELPERS
//
// Public surface exposed as window.DenomVisual so wallet-display.js
// and parent-controls.js can reuse these without duplicating code.
// ══════════════════════════════════════════════════════════════

/** Maps a denomination's agorot value to its image path. Returns null if no image. */
function _phDenomImgSrc(agorot) {
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
  return MAP[agorot] || null;
}

/**
 * Renders a horizontal row of denomination chips from a counts map.
 *
 * For each denomination with count > 0:
 *   - count === 1            : image only (no badge)
 *   - count === 2 AND coin   : two coin images side-by-side ("I see 2 real coins")
 *   - count >= 2 (bill)      : image + ×N badge (bills are wide; two side-by-side is noisy)
 *   - count >= 3             : image + ×N badge
 *
 * Denomination label appears below each chip in muted small text.
 *
 * @param {{ [agorot]: number }} denomCounts
 * @returns {string} HTML
 */
function _phDenomChipsRowHTML(denomCounts) {
  const chips = [];

  Currency.DENOMINATIONS.forEach(d => {
    const count = _phResolveDenomCount(denomCounts, d.agorot);
    if (count <= 0) return;
    const src    = _phDenomImgSrc(d.agorot);
    if (!src) return;
    const isCoin = d.type === 'coin';
    // Coins are circular — display taller; bills are landscape — display shorter but wider.
    const h = isCoin ? 34 : 24;

    let imgBlock;
    if (count === 1) {
      imgBlock = `<img src="${src}"
        style="height:${h}px;width:auto;display:block;object-fit:contain;"
        alt="" draggable="false" loading="lazy">`;
    } else if (count === 2 && isCoin) {
      const img = `<img src="${src}"
        style="height:${h}px;width:auto;display:block;object-fit:contain;"
        alt="" draggable="false" loading="lazy">`;
      imgBlock = `<div style="display:flex;gap:2px;">${img}${img}</div>`;
    } else {
      imgBlock = `
        <div style="position:relative;display:inline-block;">
          <img src="${src}"
            style="height:${h}px;width:auto;display:block;object-fit:contain;"
            alt="" draggable="false" loading="lazy">
          <span style="
            position:absolute;bottom:-5px;left:-5px;
            min-width:18px;height:18px;
            background:#1D4ED8;color:#fff;
            font-size:0.58rem;font-weight:900;
            border-radius:9px;padding:0 3px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 3px rgba(0,0,0,0.22);
            font-family:inherit;line-height:1;
          ">×${count}</span>
        </div>`;
    }

    chips.push(`
      <div style="
        display:inline-flex;flex-direction:column;align-items:center;gap:3px;
        padding-bottom:4px;
      ">
        ${imgBlock}
        <span style="font-size:0.6rem;font-weight:700;color:var(--color-text-muted);
          white-space:nowrap;">${_phEsc(d.labelHe)}</span>
      </div>`);
  });

  if (!chips.length) return '';

  const sep = `<span style="
    font-size:1rem;font-weight:300;color:var(--color-border);
    align-self:center;margin-bottom:16px;
  ">+</span>`;

  return `<div style="
    display:flex;flex-wrap:wrap;gap:6px 8px;align-items:flex-end;padding:4px 0 0;
  ">${chips.join(sep)}</div>`;
}

/**
 * Renders the image cell for a denomination row in the manual chooser (Step 2 / Step 3).
 * Fixed 52×48 px container; image scales to fit naturally.
 *
 * @param {number}  agorot
 * @param {boolean} isCoin
 * @returns {string} HTML
 */
function _phDenomRowImgHTML(agorot, isCoin) {
  const src = _phDenomImgSrc(agorot);
  const h   = isCoin ? 40 : 28; // coins taller; bills shorter but wider
  return `<div style="
    width:52px;height:48px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  ">
    ${src
      ? `<img src="${src}"
          style="height:${h}px;width:auto;max-width:50px;display:block;object-fit:contain;"
          alt="" draggable="false" loading="lazy">`
      : `<span style="font-size:0.65rem;font-weight:700;
          color:var(--color-text-muted);">${agorot >= 100 ? (agorot / 100) + '₪' : agorot + 'א'}</span>`
    }
  </div>`;
}

// Expose for reuse in wallet-display.js and parent-controls.js
window.DenomVisual = {
  imgSrc:   _phDenomImgSrc,
  chipsRow: _phDenomChipsRowHTML,
  rowImg:   _phDenomRowImgHTML,
};

// ══════════════════════════════════════════════════════════════
// INLINE STYLE HELPERS
// ══════════════════════════════════════════════════════════════

function _phHeaderStyle() {
  return 'display:flex;align-items:center;gap:8px;margin-bottom:18px;';
}
function _phHeaderTitleStyle() {
  return 'font-size:1.1rem;font-weight:800;color:var(--color-text);';
}
function _phBackBtnStyle() {
  return `
    background:none;border:none;font-size:1.3rem;font-weight:700;
    cursor:pointer;padding:4px 10px;border-radius:10px;
    color:var(--color-text-muted);line-height:1;font-family:inherit;
  `;
}
function _phLabelStyle(isSub) {
  return `
    display:block;
    font-size:${isSub ? '0.88rem' : '1rem'};
    font-weight:${isSub ? '600' : '700'};
    color:${isSub ? 'var(--color-text-muted)' : 'var(--color-text)'};
    margin-bottom:6px;
  `;
}
function _phPrimaryBtnStyle() {
  return `
    width:100%;padding:15px 16px;font-family:inherit;
    background:linear-gradient(135deg,#0EA5E9 0%,#38BDF8 100%);
    color:#fff;border:none;border-radius:16px;
    font-size:1.05rem;font-weight:800;cursor:pointer;
    box-shadow:0 4px 12px rgba(14,165,233,0.28);
    transition:transform 0.12s,opacity 0.12s;
  `;
}
function _phStepperBtnStyle(isPlus) {
  return `
    width:40px;height:40px;border-radius:10px;font-family:inherit;
    border:${isPlus ? '2px solid #0EA5E9' : '1.5px solid var(--color-border)'};
    background:${isPlus ? '#EFF6FF' : 'var(--color-bg)'};
    font-size:1.3rem;font-weight:700;cursor:pointer;line-height:1;
    color:${isPlus ? '#0EA5E9' : 'var(--color-text-muted)'};
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  `;
}
function _phStepperCountStyle() {
  return `
    width:40px;text-align:center;font-size:1.2rem;
    font-weight:800;color:var(--color-text);line-height:40px;
  `;
}
function _phSectionLabelStyle() {
  return `
    font-size:0.75rem;font-weight:700;letter-spacing:0.06em;
    color:var(--color-text-muted);margin-bottom:8px;text-transform:uppercase;
  `;
}
/**
 * Style for the ← / → transfer buttons in Step 2 denomination cards.
 * isAdd=true  → GREEN  (← move into payment)
 * isAdd=false → RED    (→ return to wallet)
 */
function _phTransferBtnStyle(isAdd) {
  return `
    width:44px;height:44px;border-radius:12px;flex-shrink:0;
    border:2px solid ${isAdd ? '#BBF7D0' : '#FECACA'};
    background:${isAdd ? '#DCFCE7' : '#FEE2E2'};
    font-size:1.2rem;font-weight:700;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    color:${isAdd ? '#15803D' : '#DC2626'};
    font-family:inherit;transition:opacity 0.1s;
  `;
}
