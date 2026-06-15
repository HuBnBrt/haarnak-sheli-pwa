// ─────────────────────────────────────────────────────────────
// views/child-dashboard.js — Child mode home screen
// Phase 1: identity display + device reset.
// Real account data in Phase 3+.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ChildDashboard = {

  render(container) {
    const identity = Auth.getIdentity();
    const name     = identity ? identity.displayName : '...';
    const gender   = identity ? identity.gender : 'm';
    const greeting = gender === 'f' ? 'שלום' : 'שלום';  // same for MVP, room to expand

    container.innerHTML = `
      <div class="page">

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 2px;">${greeting}, ${_cdEscHtml(name)}!</h2>
            <p class="text-muted" style="margin:0; font-size:0.88rem;">הארנק שלי</p>
          </div>
          <button class="btn btn-ghost" id="parent-mode-btn"
            style="font-size:0.82rem; padding:8px 12px; min-height:auto;">
            🔑 הורה
          </button>
        </div>

        <!-- Wallet -->
        <div class="card card-accent" style="margin-bottom:12px;">
          <div class="section-title">${I18n.t('account.wallet')}</div>
          <p class="text-muted" style="font-size:0.9rem;"><em>תוכן ארנק יוצג כאן (Phase 2)</em></p>
        </div>

        <!-- Savings -->
        <div class="card card-accent" style="margin-bottom:12px;">
          <div class="section-title">${I18n.t('account.savings')}</div>
          <p class="text-muted" style="font-size:0.9rem;"><em>חיסכון ומטרות יוצגו כאן (Phase 3–4)</em></p>
        </div>

        <!-- Giving -->
        <div class="card card-accent" style="margin-bottom:12px;">
          <div class="section-title">${I18n.t('account.giving')}</div>
          <p class="text-muted" style="font-size:0.9rem;"><em>נתינה יוצג כאן (Phase 6)</em></p>
        </div>

        <!-- Gray accounts -->
        <div class="card card-gray" style="margin-bottom:8px;">
          <div class="section-title">${I18n.t('account.gifts')}</div>
          <p class="text-muted" style="font-size:0.88rem;">${I18n.t('account.gifts.desc')}</p>
        </div>
        <div class="card card-gray" style="margin-bottom:24px;">
          <div class="section-title">${I18n.t('account.chores')}</div>
          <p class="text-muted" style="font-size:0.88rem;">${I18n.t('account.chores.desc')}</p>
        </div>

        <!-- Device reset -->
        <div style="text-align:center; padding-top:8px; border-top:1px solid var(--color-border);">
          <button class="btn btn-ghost" id="reset-device-btn"
            style="font-size:0.82rem; color:var(--color-text-muted); padding:8px 16px; min-height:auto;">
            החלף משתמש / איפוס מכשיר
          </button>
        </div>

      </div>
    `;

    // ── Parent mode button ───────────────────────────────────
    document.getElementById('parent-mode-btn').addEventListener('click', () => {
      App.navigate('parent');
    });

    // ── Device reset ─────────────────────────────────────────
    document.getElementById('reset-device-btn').addEventListener('click', async () => {
      try {
        await Auth.resetDeviceIdentity();   // shows PIN modal, calls GAS, clears identity
        App.navigate('setup');
      } catch (err) {
        if (err.message !== 'cancelled') {
          alert('שגיאה באיפוס: ' + err.message);
        }
      }
    });
  },

};

function _cdEscHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
