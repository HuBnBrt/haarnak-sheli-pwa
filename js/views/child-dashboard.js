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
// Phase 2: wallet section is now live (WalletDisplay.renderReadOnly).
// Phase 3+: savings, giving, gray accounts.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ChildDashboard = {

  render(container) {
    const identity = Auth.getIdentity();
    const name     = identity ? identity.displayName : '...';
    const gender   = identity ? identity.gender : 'm';

    // Gender-aware label for savings section
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
        <!--
          WalletDisplay.renderReadOnly() populates #wallet-content
          after the page shell is already visible so the UI feels instant.
        -->
        <div class="card card-accent" style="margin-bottom: 12px;">
          <div class="section-title" style="margin-bottom: 6px;">
            ${I18n.t('account.wallet')}
          </div>
          <div id="wallet-content"></div>
        </div>

        <!-- ── Savings / Goals (Phase 3–4 stubs) ─────────── -->
        <div class="card card-accent" style="margin-bottom: 12px;">
          <div class="section-title">${_cdEscHtml(savingsLabel)}</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>חיסכון ומטרות יוצגו כאן (Phase 3–4)</em>
          </p>
        </div>

        <!-- ── Giving (Phase 6 stub) ─────────────────────── -->
        <div class="card card-accent" style="margin-bottom: 12px;">
          <div class="section-title">${I18n.t('account.giving')}</div>
          <p class="text-muted" style="font-size: 0.9rem;">
            <em>נתינה יוצג כאן (Phase 6)</em>
          </p>
        </div>

        <!-- ── Gray accounts ──────────────────────────────── -->
        <div class="card card-gray" style="margin-bottom: 8px;">
          <div class="section-title">${I18n.t('account.gifts')}</div>
          <p class="text-muted" style="font-size: 0.88rem;">
            ${I18n.t('account.gifts.desc')}
          </p>
        </div>

        <div class="card card-gray" style="margin-bottom: 24px;">
          <div class="section-title">${I18n.t('account.chores')}</div>
          <p class="text-muted" style="font-size: 0.88rem;">
            ${I18n.t('account.chores.desc')}
          </p>
        </div>

      </div>
    `;

    // ── Async: populate wallet denomination stacks ────────────
    //
    // Page shell is already rendered; this fetch runs in the background.
    // WalletDisplay handles its own loading/error state inside #wallet-content.
    if (identity) {
      const walletEl = document.getElementById('wallet-content');
      if (walletEl) WalletDisplay.renderReadOnly(walletEl, identity.userId);
    }

    // ── "בקרת הורים" button ───────────────────────────────────
    //
    // Each tap starts a completely fresh authorization cycle.
    // requireParentPin() calls GAS verifyParentPin — no cached result.
    // parentId/parentName live only inside the ParentControls closure.
    // When the parent taps "סיום", onExit() re-renders this view and
    // any trace of parent auth disappears with the replaced DOM.

    document.getElementById('parent-controls-btn').addEventListener('click', async () => {
      try {
        const { parentId, displayName: parentName } = await Auth.requireParentPin(
          'הורה, הזן קוד לגישה לבקרת הורים'
        );

        // PIN correct — render parent controls inline.
        // No route change. No hash update. No localStorage write.
        Views.ParentControls.render(container, {
          parentId,
          parentName,
          childIdentity: identity,
          onExit: () => Views.ChildDashboard.render(container),
        });

      } catch (err) {
        // 'cancelled' = parent dismissed the modal; no action needed.
        // Any other error is surfaced briefly.
        if (err.message !== 'cancelled') {
          _cdShowError(container, err.message);
        }
      }
    });
  },

};

// ── Helpers ───────────────────────────────────────────────────

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
