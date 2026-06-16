// ─────────────────────────────────────────────────────────────
// views/child-dashboard.js — Child mode home screen
//
// ── Authorization model ───────────────────────────────────────
// This device is bound to ONE child. The default state is this
// view, locked to that child.
//
// There is NO free parent/child toggle. The only path to parent
// actions is through the "בקרת הורים" button, which requires a
// fresh parent PIN every single time.
//
// After the parent exits, Views.ParentControls calls onExit()
// which re-renders THIS view — parent auth is gone implicitly
// because it only ever lived in the ParentControls closure.
//
// ── Data loading ─────────────────────────────────────────────
// Phase 2: wallet  → WalletDisplay.renderReadOnly() (#wallet-content)
// Phase 3: accounts → getChildDashboard() → four account cards
//   #savings-content, #giving-content, #gifts-content, #chores-content
//
// Both fetches run in parallel after the page shell is rendered.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ChildDashboard = {

  render(container) {
    const identity = Auth.getIdentity();
    const name     = identity ? identity.displayName : '...';
    const gender   = identity ? identity.gender : 'm';

    // Gender-aware labels
    const savingsLabel = gender === 'f'
      ? I18n.t('account.savings.f')
      : I18n.t('account.savings');

    container.innerHTML = `
      <div class="page">

        <!-- ── Header ──────────────────────────────────────── -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        ">
          <div>
            <h2 style="margin: 0 0 2px;">שלום, ${_cdEscHtml(name)}!</h2>
            <p class="text-muted" style="margin: 0; font-size: 0.88rem;">הארנק שלי</p>
          </div>

          <!--
            "בקרת הורים" — the ONLY entry point to parent actions.
            Requires fresh PIN every time. No persistent parent session.
          -->
          <button
            class="btn btn-ghost"
            id="parent-controls-btn"
            style="font-size: 0.82rem; padding: 8px 12px; min-height: auto;"
            aria-label="כניסה לבקרת הורים — נדרש קוד"
          >
            🔑 בקרת הורים
          </button>
        </div>

        <!-- ── Physical wallet (Phase 2) ─────────────────── -->
        <div class="card card-accent" style="margin-bottom: 12px;">
          <div class="section-title" style="margin-bottom: 6px;">
            ${I18n.t('account.wallet')}
          </div>
          <div id="wallet-content"></div>
        </div>

        <!-- ── Savings / Goals (Phase 3 balance, Phase 4 goals) ─ -->
        <div class="card" style="
          margin-bottom: 12px;
          border: 2px solid #22C55E;
          background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%);
        ">
          <div class="section-title" style="
            color: #15803D;
            margin-bottom: 8px;
          ">${_cdEscHtml(savingsLabel)}</div>
          <div id="savings-content">
            ${_cdLoadingHTML()}
          </div>
        </div>

        <!-- ── Giving (Phase 3 balance, Phase 6 actions) ──── -->
        <div class="card" style="
          margin-bottom: 12px;
          border: 2px solid #A78BFA;
          background: linear-gradient(135deg, #FAF5FF 0%, #EDE9FE 100%);
        ">
          <div class="section-title" style="
            color: #6D28D9;
            margin-bottom: 8px;
          ">${I18n.t('account.giving')}</div>
          <div id="giving-content">
            ${_cdLoadingHTML()}
          </div>
        </div>

        <!-- ── Gray accounts ──────────────────────────────── -->
        <div class="card card-gray" style="margin-bottom: 8px;">
          <div class="section-title">${I18n.t('account.gifts')}</div>
          <div id="gifts-content">
            ${_cdLoadingHTML()}
          </div>
        </div>

        <div class="card card-gray" style="margin-bottom: 24px;">
          <div class="section-title">${I18n.t('account.chores')}</div>
          <div id="chores-content">
            ${_cdLoadingHTML()}
          </div>
        </div>

      </div>
    `;

    // ── Async fetches run in parallel ─────────────────────────
    if (identity) {
      // Wallet: handled by WalletDisplay (Phase 2)
      const walletEl = document.getElementById('wallet-content');
      if (walletEl) WalletDisplay.renderReadOnly(walletEl, identity.userId);

      // Accounts: savings, giving, gifts, chores (Phase 3)
      _cdLoadAccountBalances(identity.userId, gender);
    }

    // ── "בקרת הורים" button ───────────────────────────────────
    document.getElementById('parent-controls-btn').addEventListener('click', async () => {
      try {
        const { parentId, displayName: parentName } = await Auth.requireParentPin(
          'הורה, הזן קוד לגישה לבקרת הורים'
        );

        Views.ParentControls.render(container, {
          parentId,
          parentName,
          childIdentity: identity,
          onExit: () => Views.ChildDashboard.render(container),
        });

      } catch (err) {
        if (err.message !== 'cancelled') {
          _cdShowError(container, err.message);
        }
      }
    });
  },

};

// ── Account balance loading ───────────────────────────────────

/**
 * Fetch all account balances in a single GAS call and populate
 * the four account content elements.
 */
async function _cdLoadAccountBalances(userId, gender) {
  try {
    const { data } = await API.callGASWithFallback('getChildDashboard', { userId });

    _cdRenderSavings(
      document.getElementById('savings-content'),
      data.savings.balanceAgorot,
      gender
    );
    _cdRenderGiving(
      document.getElementById('giving-content'),
      data.giving.balanceAgorot
    );
    _cdRenderGrayAccount(
      document.getElementById('gifts-content'),
      data.gifts.balanceAgorot,
      I18n.t('account.gifts.desc')
    );
    _cdRenderGrayAccount(
      document.getElementById('chores-content'),
      data.chores.balanceAgorot,
      I18n.t('account.chores.desc')
    );

  } catch (err) {
    // On error, replace all four loading placeholders with the error message
    ['savings-content', 'giving-content', 'gifts-content', 'chores-content'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `
        <p style="color: var(--color-danger); font-size: 0.82rem; margin: 4px 0 0;">
          שגיאה: ${_cdEscHtml(err.message)}
        </p>`;
    });
  }
}

// ── Section renderers ─────────────────────────────────────────

function _cdRenderSavings(el, balanceAgorot, gender) {
  if (!el) return;

  const isSavingsFemale = gender === 'f';

  el.innerHTML = `
    <!-- Balance -->
    <div style="
      font-size: 2rem;
      font-weight: 900;
      color: #16A34A;
      letter-spacing: -0.5px;
      line-height: 1.1;
      margin-bottom: 8px;
    ">${Currency.formatILS(balanceAgorot)}</div>

    ${balanceAgorot > 0
      ? `<p style="font-size: 0.82rem; color: #166534; margin: 0 0 8px;">
           ${isSavingsFemale ? 'כל הכבוד — את חוסכת בצורה מדהימה!' : 'כל הכבוד — אתה חוסך בצורה מדהימה!'}
         </p>`
      : `<p style="font-size: 0.82rem; color: #4B7A58; margin: 0 0 8px;">
           ${isSavingsFemale ? 'עוד לא התחלת לחסוך החודש.' : 'עוד לא התחלת לחסוך החודש.'}
         </p>`
    }

    <!-- Goals placeholder (Phase 4) -->
    <div style="
      margin-top: 4px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.5);
      border-radius: 12px;
      border: 1px dashed #86EFAC;
    ">
      <p style="
        font-size: 0.82rem;
        color: #4B7A58;
        margin: 0;
        text-align: center;
      ">
        🎯 המטרות שלי יוצגו כאן בקרוב
      </p>
    </div>
  `;
}

function _cdRenderGiving(el, balanceAgorot) {
  if (!el) return;

  el.innerHTML = `
    <!-- Balance -->
    <div style="
      font-size: 2rem;
      font-weight: 900;
      color: #7C3AED;
      letter-spacing: -0.5px;
      line-height: 1.1;
      margin-bottom: 8px;
    ">${Currency.formatILS(balanceAgorot)}</div>

    <p style="
      font-size: 0.82rem;
      color: #5B21B6;
      margin: 0;
    ">${I18n.t('account.giving.desc')}</p>
  `;
}

/**
 * Gray account card body (gifts or chores).
 * If balance is 0 → just show the description in muted style.
 * If balance > 0 → highlight balance prominently (waiting for distribution).
 */
function _cdRenderGrayAccount(el, balanceAgorot, description) {
  if (!el) return;

  if (balanceAgorot === 0) {
    el.innerHTML = `
      <p class="text-muted" style="font-size: 0.88rem; margin: 4px 0 0;">
        ${_cdEscHtml(description)}
      </p>`;
  } else {
    // Has money waiting — make it visible
    el.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      ">
        <p style="font-size: 0.82rem; color: var(--color-text-muted); margin: 0; flex: 1;">
          ${_cdEscHtml(description)}
        </p>
        <div style="
          font-size: 1.4rem;
          font-weight: 800;
          color: #374151;
          white-space: nowrap;
          flex-shrink: 0;
        ">${Currency.formatILS(balanceAgorot)}</div>
      </div>
      <div style="
        margin-top: 8px;
        font-size: 0.78rem;
        color: #6B7280;
        padding: 6px 10px;
        background: rgba(0,0,0,0.04);
        border-radius: 8px;
        text-align: center;
      ">⏳ ממתין לחלוקה עם ההורים</div>
    `;
  }
}

// ── Helpers ───────────────────────────────────────────────────

/** Inline loading placeholder (used for all four account cards). */
function _cdLoadingHTML() {
  return `<p style="color: var(--color-text-muted); font-size: 0.85rem; margin: 4px 0 0;">טוען...</p>`;
}

function _cdShowError(container, message) {
  const existing = container.querySelector('.cd-error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'error-banner cd-error-banner';
  banner.style.cssText = 'margin: 0 0 12px;';
  banner.textContent = message;
  const page = container.querySelector('.page');
  if (page) page.insertBefore(banner, page.firstChild);
}

function _cdEscHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
