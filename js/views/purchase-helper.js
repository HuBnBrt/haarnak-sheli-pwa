// ─────────────────────────────────────────────────────────────
// views/purchase-helper.js — Purchase wizard (Phase 5)
//
// Child-facing 4-step inline purchase flow:
//   Step 1: Enter item price + optional description
//   Step 2: Select payment denominations (suggestions + manual stepper)
//   Step 3: Enter received change (only if overpaid; skipped for exact payment)
//   Step 4: Confirm summary → save via recordPurchase API → return to wallet
//
// Public API:
//   PurchaseHelper.start(el, userId, gender, onExit)
//     el      — HTMLElement to render into (wallet card content area)
//     userId  — child user ID
//     gender  — 'm' | 'f' (for gender-inflected Hebrew button text)
//     onExit  — called when wizard completes or is cancelled
//
// Depends on: api.js, currency.js
// ─────────────────────────────────────────────────────────────
'use strict';

window.PurchaseHelper = {
  start(el, userId, gender, onExit) {
    _phStep1(el, userId, gender, onExit);
  },
};

// ── Step 1: Price entry ───────────────────────────────────────

function _phStep1(el, userId, gender, onExit) {
  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="ביטול">←</button>
        <span style="${_phHeaderTitleStyle()}">🛒 עוזר קנייה</span>
      </div>

      <label style="${_phLabelStyle()}">כמה עולה הפריט?</label>
      <div style="position:relative; margin-bottom:16px;">
        <input
          id="ph-price"
          type="number"
          inputmode="decimal"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          style="
            width:100%; padding:16px 44px 16px 16px;
            font-size:1.8rem; font-weight:800; font-family:inherit;
            border:2.5px solid var(--color-border); border-radius:16px;
            background:var(--color-bg); color:var(--color-text);
            text-align:left; direction:ltr;
          "
        >
        <span style="
          position:absolute; left:14px; top:50%; transform:translateY(-50%);
          font-size:1.3rem; font-weight:700; color:var(--color-text-muted);
          pointer-events:none; user-select:none;
        ">₪</span>
      </div>

      <label style="${_phLabelStyle(true)}">על מה? (לא חובה)</label>
      <input
        id="ph-desc"
        type="text"
        placeholder="למשל: ספר, מדבקות, גלידה..."
        maxlength="60"
        style="
          width:100%; padding:12px 14px; font-family:inherit;
          font-size:0.95rem; border:2px solid var(--color-border);
          border-radius:12px; background:var(--color-bg);
          color:var(--color-text); margin-bottom:20px;
        "
      >

      <div id="ph-err" style="color:#DC2626; font-size:0.85rem; min-height:1.2em; margin-bottom:8px;"></div>

      <button id="ph-next" type="button" style="${_phPrimaryBtnStyle()}">
        המשך ←
      </button>
    </div>`;

  // Focus the price input on next tick (after element is in DOM)
  setTimeout(() => {
    const inp = document.getElementById('ph-price');
    if (inp) inp.focus();
  }, 50);

  document.getElementById('ph-back').addEventListener('click', onExit);

  document.getElementById('ph-next').addEventListener('click', async () => {
    const raw    = (document.getElementById('ph-price').value || '').trim();
    const agorot = Currency.parseILSInput(raw);
    const errEl  = document.getElementById('ph-err');
    if (!agorot || agorot <= 0) {
      errEl.textContent = 'יש להזין מחיר חוקי (גדול מ-0).';
      document.getElementById('ph-price').focus();
      return;
    }
    errEl.textContent = '';
    const desc = (document.getElementById('ph-desc').value || '').trim();
    await _phStep2(el, userId, gender, onExit, agorot, desc);
  });
}

// ── Step 2: Payment selection ─────────────────────────────────

async function _phStep2(el, userId, gender, onExit, priceAgorot, description) {
  _phShowLoading(el, '🛒 בחר תשלום', () => _phStep1(el, userId, gender, onExit));

  let walletData;
  try {
    const { data } = await API.callGASWithFallback(
      'getPurchaseSuggestions', { userId, priceAgorot });
    walletData = data;
  } catch (err) {
    _phShowError(el, err.message, () => _phStep1(el, userId, gender, onExit));
    return;
  }

  _phStep2Render(el, userId, gender, onExit, priceAgorot, description, walletData);
}

function _phStep2Render(el, userId, gender, onExit, priceAgorot, description, walletData) {
  const { walletCounts, walletTotalAgorot, savingsAgorot, suggestions, canAfford } = walletData;

  // Only show denominations the child actually has
  const activeDenoms = Currency.DENOMINATIONS.filter(
    d => _phGetCount(walletCounts, d.agorot) > 0);

  // Payment selection state — starts at all 0
  const sel = {};
  Currency.DENOMINATIONS.forEach(d => { sel[d.agorot] = 0; });

  // ── Build HTML ──────────────────────────────────────────────

  const sugsHTML = suggestions.map((s, i) => {
    const denomDesc = Currency.DENOMINATIONS
      .filter(d => (_phResolveDenomCount(s.denomCounts, d.agorot)) > 0)
      .map(d => `${_phResolveDenomCount(s.denomCounts, d.agorot)}×${d.labelHe}`)
      .join(' + ');
    const changeText = s.changeAgorot > 0
      ? ` · עודף: ${Currency.formatILS(s.changeAgorot)}` : '';
    return `
      <div class="ph-sug" data-sug="${i}" style="
        border:2px solid var(--color-border); border-radius:14px;
        padding:11px 14px; margin-bottom:9px; cursor:pointer;
        background:var(--color-bg); transition:border-color 0.12s, background 0.12s;
      ">
        <div style="font-size:0.78rem; color:var(--color-text-muted); margin-bottom:3px; font-weight:600;">
          💡 ${_phEsc(s.label)}
        </div>
        <div style="font-weight:800; font-size:0.98rem; color:var(--color-text); direction:ltr; text-align:left;">
          ${_phEsc(denomDesc)}
        </div>
        <div style="font-size:0.82rem; margin-top:3px; font-weight:600;
          color:${s.exact ? '#16A34A' : '#2563EB'};">
          ${s.exact ? '✓ תשלום מדויק' : 'עם עודף'}${_phEsc(changeText)}
        </div>
      </div>`;
  }).join('');

  const denomRowsHTML = activeDenoms.map(d => {
    const max    = _phGetCount(walletCounts, d.agorot);
    const isCoin = d.type === 'coin';
    const color  = isCoin ? '#92400E' : '#065F46';
    return `
      <div style="
        display:flex; align-items:center; gap:8px;
        padding:9px 0; border-bottom:1px solid var(--color-border);
      ">
        <div style="flex:1; font-weight:700; font-size:0.95rem; color:${color};">
          ${_phEsc(d.labelHe)}
        </div>
        <div style="font-size:0.72rem; color:var(--color-text-muted);">יש: ${max}</div>
        <div style="display:flex; align-items:center; gap:5px;">
          <button class="ph-minus" data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(false)}" aria-label="פחות">−</button>
          <div id="ph-sel-${d.agorot}" style="${_phStepperCountStyle()}">0</div>
          <button class="ph-plus"  data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(true)}"  aria-label="יותר">+</button>
        </div>
        <div id="ph-sub-${d.agorot}" style="
          font-size:0.72rem; color:var(--color-text-muted);
          min-width:52px; text-align:left; direction:ltr;
        "></div>
      </div>`;
  }).join('');

  const insuffHTML = !canAfford ? `
    <div style="
      background:#FEF3C7; border:1.5px solid #FCD34D; border-radius:12px;
      padding:12px; margin-bottom:12px; font-size:0.88rem; color:#92400E; line-height:1.55;
    ">
      ⚠ הארנק הפיזי (${Currency.formatILS(walletTotalAgorot)}) לא מספיק לשלם ${Currency.formatILS(priceAgorot)}.
      ${savingsAgorot > 0
        ? `<br>יש לך <strong>${Currency.formatILS(savingsAgorot)}</strong> בחיסכון — אפשר לבקש מאמא ואבא לעזור.`
        : ''}
    </div>` : '';

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">🛒 בחר תשלום</span>
      </div>

      <!-- Price vs wallet balance -->
      <div style="
        display:flex; justify-content:space-between; align-items:center;
        padding:12px 14px; background:var(--color-bg-subtle,#F8FAFC);
        border-radius:12px; margin-bottom:12px;
      ">
        <div>
          <div style="font-size:0.72rem; color:var(--color-text-muted); font-weight:600; margin-bottom:2px;">מחיר</div>
          <div style="font-size:1.5rem; font-weight:900; color:var(--color-text);">${Currency.formatILS(priceAgorot)}</div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:0.72rem; color:var(--color-text-muted); font-weight:600; margin-bottom:2px;">בארנק שלך</div>
          <div style="font-size:1.1rem; font-weight:800; color:${canAfford ? '#0EA5E9' : '#DC2626'};">
            ${Currency.formatILS(walletTotalAgorot)}
          </div>
        </div>
      </div>

      ${insuffHTML}

      ${suggestions.length > 0 ? `
        <div style="${_phSectionLabelStyle()}">💡 הצעות תשלום</div>
        ${sugsHTML}
        <div style="
          text-align:center; font-size:0.75rem; color:var(--color-text-muted);
          font-weight:600; margin:12px 0 8px; letter-spacing:0.04em;
        ">— או בחר ידנית —</div>
      ` : (activeDenoms.length > 0
          ? `<div style="${_phSectionLabelStyle()}">🪙 בחר מטבעות / שטרות לתשלום</div>`
          : '')}

      ${activeDenoms.length > 0 ? `<div style="margin-bottom:4px;">${denomRowsHTML}</div>` : ''}
      ${activeDenoms.length === 0 && canAfford
        ? '<p style="font-size:0.85rem; color:var(--color-text-muted); margin-top:8px;">הארנק ריק.</p>'
        : ''}

      <!-- Live status bar -->
      <div style="
        margin-top:14px; padding:12px 14px;
        background:var(--color-bg-subtle,#F8FAFC); border-radius:12px; text-align:center;
      ">
        <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:3px;">בחרת לשלם</div>
        <div id="ph-ptotal" style="font-size:1.5rem; font-weight:900; color:var(--color-text);">
          ${Currency.formatILS(0)}
        </div>
        <div id="ph-pstatus" style="font-size:0.88rem; min-height:1.3em; margin-top:3px;"></div>
      </div>

      <button id="ph-next" type="button" disabled
        style="${_phPrimaryBtnStyle()} margin-top:12px; opacity:0.45;">
        שילמתי לחנות ←
      </button>
    </div>`;

  // ── Wire events ─────────────────────────────────────────────

  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep1(el, userId, gender, onExit));

  // Suggestion cards
  el.querySelectorAll('.ph-sug').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.sug, 10);
      const sug = suggestions[idx];

      // Clear selection
      Currency.DENOMINATIONS.forEach(d => { sel[d.agorot] = 0; });
      // Apply suggestion
      Object.entries(sug.denomCounts).forEach(([dk, c]) => {
        sel[parseInt(dk, 10)] = c;
      });
      // Sync UI
      _phSyncPayStepperUI(el, sel);
      _phUpdatePayStatus(el, sel, priceAgorot);
      // Highlight selected card
      el.querySelectorAll('.ph-sug').forEach((c, ci) => {
        c.style.borderColor = ci === idx ? '#0EA5E9' : '';
        c.style.background  = ci === idx ? '#EFF6FF' : '';
      });
    });
  });

  // Manual +/- steppers
  el.querySelectorAll('.ph-plus, .ph-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const denom = parseInt(btn.dataset.denom, 10);
      const max   = _phGetCount(walletCounts, denom);
      const delta = btn.classList.contains('ph-plus') ? 1 : -1;
      sel[denom]  = Math.max(0, Math.min(max, (sel[denom] || 0) + delta));

      const countEl = document.getElementById(`ph-sel-${denom}`);
      if (countEl) countEl.textContent = sel[denom];
      const subEl = document.getElementById(`ph-sub-${denom}`);
      if (subEl) subEl.textContent = sel[denom] > 0 ? Currency.formatILS(sel[denom] * denom) : '';

      // Deselect suggestion highlights on manual change
      el.querySelectorAll('.ph-sug').forEach(c => {
        c.style.borderColor = '';
        c.style.background  = '';
      });
      _phUpdatePayStatus(el, sel, priceAgorot);
    });
  });

  // Proceed button
  document.getElementById('ph-next').addEventListener('click', () => {
    const paidCounts  = _phCleanCounts(sel);
    const paidTotal   = _phCountsSum(paidCounts);
    const changeAgorot = paidTotal - priceAgorot;

    if (changeAgorot === 0) {
      // Exact payment — skip change step
      _phStep4(el, userId, gender, onExit, priceAgorot, description,
        paidCounts, {}, 0, walletData);
    } else {
      // Overpaid — enter change
      _phStep3(el, userId, gender, onExit, priceAgorot, description,
        paidCounts, paidTotal, changeAgorot, walletData);
    }
  });
}

// ── Step 3: Change entry ──────────────────────────────────────

function _phStep3(el, userId, gender, onExit, priceAgorot, description,
                  paidCounts, paidTotal, expectedChange, walletData) {
  const chg = {};
  Currency.DENOMINATIONS.forEach(d => { chg[d.agorot] = 0; });

  // All denominations available as change (shop can give anything)
  const denomRowsHTML = Currency.DENOMINATIONS.map(d => {
    const isCoin = d.type === 'coin';
    const color  = isCoin ? '#92400E' : '#065F46';
    return `
      <div style="
        display:flex; align-items:center; gap:8px;
        padding:9px 0; border-bottom:1px solid var(--color-border);
      ">
        <div style="flex:1; font-weight:700; font-size:0.95rem; color:${color};">
          ${_phEsc(d.labelHe)}
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
          <button class="phc-minus" data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(false)}" aria-label="פחות">−</button>
          <div id="phc-sel-${d.agorot}" style="${_phStepperCountStyle()}">0</div>
          <button class="phc-plus"  data-denom="${d.agorot}" type="button"
            style="${_phStepperBtnStyle(true)}"  aria-label="יותר">+</button>
        </div>
        <div id="phc-sub-${d.agorot}" style="
          font-size:0.72rem; color:var(--color-text-muted);
          min-width:52px; text-align:left; direction:ltr;
        "></div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">🪙 קיבלת עודף</span>
      </div>

      <!-- Change summary -->
      <div style="
        background:#ECFDF5; border:1.5px solid #34D399;
        border-radius:14px; padding:14px; margin-bottom:16px; text-align:center;
      ">
        <div style="font-size:0.78rem; color:#065F46; font-weight:600; margin-bottom:2px;">שילמת</div>
        <div style="font-size:1.15rem; font-weight:800; color:var(--color-text);">${Currency.formatILS(paidTotal)}</div>
        <div style="margin:6px 0; color:#34D399; font-size:1.1rem; line-height:1;">↓</div>
        <div style="font-size:0.78rem; color:#065F46; font-weight:600; margin-bottom:2px;">עודף מגיע לך</div>
        <div style="font-size:1.6rem; font-weight:900; color:#16A34A;">${Currency.formatILS(expectedChange)}</div>
      </div>

      <div style="${_phSectionLabelStyle()}">הכנס את העודף שקיבלת מהחנות:</div>
      <div style="margin-bottom:4px;">${denomRowsHTML}</div>

      <!-- Live change status -->
      <div style="
        margin-top:14px; padding:12px 14px;
        background:var(--color-bg-subtle,#F8FAFC); border-radius:12px; text-align:center;
      ">
        <div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:3px;">הכנסת</div>
        <div id="phc-total" style="font-size:1.5rem; font-weight:900; color:var(--color-text);">
          ${Currency.formatILS(0)}
        </div>
        <div id="phc-status" style="font-size:0.88rem; min-height:1.3em; margin-top:3px;"></div>
      </div>

      <button id="ph-next" type="button" disabled
        style="${_phPrimaryBtnStyle()} margin-top:12px; opacity:0.45;">
        קיבלתי את העודף ←
      </button>
    </div>`;

  // Back: return to step 2 (we have walletData cached)
  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep2Render(el, userId, gender, onExit, priceAgorot, description, walletData));

  // Change steppers
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

  // Proceed
  document.getElementById('ph-next').addEventListener('click', () => {
    const changeCounts = _phCleanCounts(chg);
    _phStep4(el, userId, gender, onExit, priceAgorot, description,
      paidCounts, changeCounts, expectedChange, walletData);
  });
}

// ── Step 4: Confirm + save ────────────────────────────────────

function _phStep4(el, userId, gender, onExit, priceAgorot, description,
                  paidCounts, changeCounts, changeAgorot, walletData) {
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

  el.innerHTML = `
    <div style="margin-top:4px;">
      <div style="${_phHeaderStyle()}">
        <button id="ph-back" type="button" style="${_phBackBtnStyle()}" aria-label="חזרה">←</button>
        <span style="${_phHeaderTitleStyle()}">✓ אישור קנייה</span>
      </div>

      <!-- Summary card -->
      <div style="
        border:2px solid var(--color-border); border-radius:16px;
        padding:16px; margin-bottom:16px;
      ">
        ${description
          ? `<div style="font-weight:800; font-size:1rem; color:var(--color-text); margin-bottom:12px;">
               🛒 ${_phEsc(description)}
             </div>`
          : ''}

        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:var(--color-text-muted); font-size:0.88rem;">שילמת לחנות</span>
          <span style="font-weight:700;">${Currency.formatILS(paidTotal)}</span>
        </div>
        <div style="
          font-size:0.75rem; color:var(--color-text-muted); margin-bottom:10px;
          direction:ltr; text-align:left; line-height:1.5;
        ">${_phEsc(paidDesc)}</div>

        ${changeAgorot > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--color-text-muted); font-size:0.88rem;">עודף קיבלת</span>
            <span style="font-weight:700; color:#16A34A;">${Currency.formatILS(changeAgorot)}</span>
          </div>
          ${changeDesc ? `<div style="
            font-size:0.75rem; color:var(--color-text-muted); margin-bottom:10px;
            direction:ltr; text-align:left; line-height:1.5;
          ">${_phEsc(changeDesc)}</div>` : ''}
        ` : ''}

        <div style="height:1px; background:var(--color-border); margin:8px 0;"></div>
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-weight:700; font-size:0.95rem;">שולם בפועל</span>
          <span style="font-weight:900; font-size:1.2rem; color:var(--color-primary,#0EA5E9);">
            ${Currency.formatILS(priceAgorot)}
          </span>
        </div>
      </div>

      <div id="ph-save-err" style="
        color:#DC2626; font-size:0.85rem; min-height:1.2em;
        text-align:center; margin-bottom:8px;
      "></div>

      <button id="ph-confirm" type="button" style="${_phPrimaryBtnStyle()}">
        ${_phEsc(enterLabel)}
      </button>

      <button id="ph-cancel" type="button" style="
        width:100%; padding:12px; margin-top:8px; font-family:inherit;
        background:none; border:1.5px solid var(--color-border);
        border-radius:14px; font-size:0.9rem; font-weight:600;
        color:var(--color-text-muted); cursor:pointer;
      ">ביטול</button>
    </div>`;

  // Back goes to step 1 (avoids complex state reconstruction)
  document.getElementById('ph-back').addEventListener('click', () =>
    _phStep1(el, userId, gender, onExit));
  document.getElementById('ph-cancel').addEventListener('click', onExit);

  document.getElementById('ph-confirm').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('ph-confirm');
    const errEl      = document.getElementById('ph-save-err');
    if (!confirmBtn) return;

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'שומר...';
    if (errEl) errEl.textContent = '';

    try {
      await API.callGASWithFallback('recordPurchase', {
        userId,
        priceAgorot,
        paidCounts,
        changeCounts,
        description,
      });

      // Success — brief celebration, then exit
      el.innerHTML = `
        <div style="
          text-align:center; padding:32px 16px;
          display:flex; flex-direction:column; align-items:center; gap:14px;
        ">
          <div style="font-size:3rem;">🎉</div>
          <div style="font-size:1.3rem; font-weight:900; color:#16A34A;">קנייה נרשמה!</div>
          <div style="font-size:0.9rem; color:var(--color-text-muted); line-height:1.5;">
            שילמת ${Currency.formatILS(priceAgorot)}<br>הארנק שלך עודכן.
          </div>
        </div>`;
      setTimeout(() => onExit(), 1800);
    } catch (err) {
      if (errEl) errEl.textContent = 'שגיאה: ' + err.message;
      if (confirmBtn) {
        confirmBtn.textContent = _phEsc(enterLabel);
        confirmBtn.disabled    = false;
      }
    }
  });
}

// ── Shared UI update helpers ──────────────────────────────────

function _phUpdatePayStatus(el, sel, priceAgorot) {
  const total    = _phSelTotal(sel);
  const diff     = total - priceAgorot;
  const totalEl  = document.getElementById('ph-ptotal');
  const statusEl = document.getElementById('ph-pstatus');
  const nextBtn  = document.getElementById('ph-next');

  if (totalEl) totalEl.textContent = Currency.formatILS(total);
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
    statusEl.innerHTML    = `<span style="color:#16A34A; font-weight:800;">✓ תשלום מדויק!</span>`;
    nextBtn.disabled      = false;
    nextBtn.style.opacity = '1';
  } else {
    statusEl.innerHTML    = `<span style="color:#2563EB; font-weight:700;">תקבל עודף ${Currency.formatILS(diff)}</span>`;
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
    statusEl.innerHTML    = `<span style="color:#16A34A; font-weight:800;">✓ בדיוק!</span>`;
    nextBtn.disabled      = false;
    nextBtn.style.opacity = '1';
  } else {
    statusEl.innerHTML    = `<span style="color:#DC2626;">הכנסת ${Currency.formatILS(diff)} יותר מדי</span>`;
    nextBtn.disabled      = true;
    nextBtn.style.opacity = '0.45';
  }
}

/** Sync all stepper count displays and subtotals after applying a suggestion. */
function _phSyncPayStepperUI(el, sel) {
  Currency.DENOMINATIONS.forEach(d => {
    const countEl = document.getElementById(`ph-sel-${d.agorot}`);
    if (countEl) countEl.textContent = sel[d.agorot] || 0;
    const subEl = document.getElementById(`ph-sub-${d.agorot}`);
    if (subEl) {
      const c = sel[d.agorot] || 0;
      subEl.textContent = c > 0 ? Currency.formatILS(c * d.agorot) : '';
    }
  });
}

// ── Pure helpers ──────────────────────────────────────────────

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

/** Read denomination count from an object that may have string or number keys. */
function _phGetCount(counts, agorot) {
  const v = counts[agorot] != null ? counts[agorot] : (counts[String(agorot)] ?? 0);
  return Math.max(0, parseInt(v, 10) || 0);
}

/** Same as _phGetCount but works on suggestion denomCounts too. */
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
      <p style="text-align:center; color:var(--color-text-muted); padding:28px 0; font-size:0.9rem;">
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
        background:#FEF2F2; border:1.5px solid #FCA5A5; border-radius:12px;
        padding:14px; margin-top:8px; color:#DC2626;
        font-size:0.88rem; line-height:1.5;
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

// ── Inline style helpers ──────────────────────────────────────

function _phHeaderStyle() {
  return 'display:flex; align-items:center; gap:8px; margin-bottom:18px;';
}
function _phHeaderTitleStyle() {
  return 'font-size:1.1rem; font-weight:800; color:var(--color-text);';
}
function _phBackBtnStyle() {
  return `
    background:none; border:none; font-size:1.3rem; font-weight:700;
    cursor:pointer; padding:4px 10px; border-radius:10px;
    color:var(--color-text-muted); line-height:1; font-family:inherit;
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
    width:100%; padding:15px 16px; font-family:inherit;
    background:linear-gradient(135deg,#0EA5E9 0%,#38BDF8 100%);
    color:#fff; border:none; border-radius:16px;
    font-size:1.05rem; font-weight:800; cursor:pointer;
    box-shadow:0 4px 12px rgba(14,165,233,0.28);
    transition:transform 0.12s, opacity 0.12s;
  `;
}
function _phStepperBtnStyle(isPlus) {
  return `
    width:40px; height:40px; border-radius:10px; font-family:inherit;
    border:${isPlus ? '2px solid #0EA5E9' : '1.5px solid var(--color-border)'};
    background:${isPlus ? '#EFF6FF' : 'var(--color-bg)'};
    font-size:1.3rem; font-weight:700; cursor:pointer; line-height:1;
    color:${isPlus ? '#0EA5E9' : 'var(--color-text-muted)'};
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  `;
}
function _phStepperCountStyle() {
  return `
    width:40px; text-align:center; font-size:1.2rem;
    font-weight:800; color:var(--color-text); line-height:40px;
  `;
}
function _phSectionLabelStyle() {
  return `
    font-size:0.75rem; font-weight:700; letter-spacing:0.06em;
    color:var(--color-text-muted); margin-bottom:8px;
    text-transform:uppercase;
  `;
}
