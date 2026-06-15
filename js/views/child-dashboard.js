// ─────────────────────────────────────────────────────────────
// views/child-dashboard.js — Child mode home screen
// Phase 0: placeholder only. Real implementation in Phase 3+.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ChildDashboard = {
  render(container) {
    const identity = Auth.getIdentity();
    const name = identity ? identity.displayName : '...';

    container.innerHTML = `
      <div class="page">
        <h2 style="margin-bottom:4px;">שלום, ${name}!</h2>
        <p class="text-muted" style="margin-bottom:24px;">הארנק שלי</p>

        <!-- Wallet -->
        <div class="card card-accent">
          <div class="section-title">${I18n.t('account.wallet')}</div>
          <p class="text-muted"><em>תוכן ארנק יוצג כאן (Phase 2)</em></p>
        </div>

        <!-- Savings -->
        <div class="card card-accent">
          <div class="section-title">${I18n.t('account.savings')}</div>
          <p class="text-muted"><em>חיסכון ומטרות יוצגו כאן (Phase 3-4)</em></p>
        </div>

        <!-- Giving -->
        <div class="card card-accent">
          <div class="section-title">${I18n.t('account.giving')}</div>
          <p class="text-muted"><em>נתינה יוצגו כאן (Phase 6)</em></p>
        </div>

        <!-- Gray accounts -->
        <div class="card card-gray">
          <div class="section-title">${I18n.t('account.gifts')}</div>
          <p class="text-muted" style="font-size:0.9rem;">${I18n.t('account.gifts.desc')}</p>
        </div>
        <div class="card card-gray">
          <div class="section-title">${I18n.t('account.chores')}</div>
          <p class="text-muted" style="font-size:0.9rem;">${I18n.t('account.chores.desc')}</p>
        </div>

        <button class="btn btn-ghost btn-full mt-16" id="switch-to-parent">
          מעבר למצב הורה
        </button>
      </div>
    `;

    document.getElementById('switch-to-parent').addEventListener('click', () => {
      App.navigate('parent');
    });
  },
};
