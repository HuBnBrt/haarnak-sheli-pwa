// ─────────────────────────────────────────────────────────────
// views/parent-dashboard.js — Parent mode home screen
// Phase 0: placeholder only. Real implementation in Phase 8.
// ─────────────────────────────────────────────────────────────

'use strict';

window.Views = window.Views || {};

Views.ParentDashboard = {
  render(container) {
    container.innerHTML = `
      <div class="page">
        <h2 style="margin-bottom:4px;">מצב הורה</h2>
        <p class="text-muted" style="margin-bottom:24px;">ניהול הארנק המשפחתי</p>

        <div class="card text-center">
          <span class="empty-state-icon">🔑</span>
          <p class="text-muted">
            לוח הורה יוצג כאן לאחר אימות קוד.<br>
            <em>(Phase 1+)</em>
          </p>
        </div>

        <button class="btn btn-ghost btn-full mt-16" id="back-to-child">
          חזרה למסך ילד
        </button>
      </div>
    `;

    document.getElementById('back-to-child').addEventListener('click', () => {
      App.navigate('child');
    });
  },
};
