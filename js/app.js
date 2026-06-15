// ─────────────────────────────────────────────────────────────
// app.js — Router and application initializer
//
// Hash-based routing:
//   #setup   → GAS URL configuration (if not set) OR user selection
//   #child   → Child dashboard
//   #parent  → Parent dashboard
//   (none)   → Auto-route based on device state
//
// Routing priority:
//   1. GAS URL not configured → #setup (URL entry screen)
//   2. GAS URL set, no identity → #setup (user selection, Phase 1)
//   3. Identity = parent → #parent
//   4. Identity = child  → #child
//
// Depends on: currency.js, i18n.js, api.js, auth.js, views/*.js
// ─────────────────────────────────────────────────────────────

'use strict';

const App = (() => {

  const appEl     = document.getElementById('app');
  const loadingEl = document.getElementById('app-loading');

  // ── View registry ────────────────────────────────────────
  const VIEWS = {
    setup:  () => Views.Setup.render(appEl),
    child:  () => Views.ChildDashboard.render(appEl),
    parent: () => Views.ParentDashboard.render(appEl),
  };

  // ── Router ───────────────────────────────────────────────
  function route() {
    const hash = window.location.hash.replace('#', '') || '';

    // Explicit hash always honoured (allows direct navigation in dev)
    if (VIEWS[hash]) {
      VIEWS[hash]();
      return;
    }

    // Step 1: GAS URL must be configured before anything else
    if (!API.isConfigured()) {
      navigate('setup');
      return;
    }

    // Step 2: Device identity
    const identity = Auth.getIdentity();
    if (!identity) {
      navigate('setup');
    } else if (identity.userType === 'parent') {
      navigate('parent');
    } else {
      navigate('child');
    }
  }

  function navigate(view) {
    window.location.hash = view;
  }

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('[SW] Registration failed:', err);
      });
    }

    // Apply stored theme before first render (avoids flash of wrong theme)
    const identity = Auth.getIdentity();
    if (identity && identity.theme) {
      Auth.applyTheme(identity.theme);
    }

    hideLoading();

    // Start routing
    window.addEventListener('hashchange', route);
    route();
  }

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.classList.add('hidden');
    loadingEl.addEventListener('transitionend', () => loadingEl.remove(), { once: true });
    // Fallback in case transitionend doesn't fire (e.g., transition disabled)
    setTimeout(() => loadingEl.remove(), 400);
  }

  return { init, navigate, route };

})();

document.addEventListener('DOMContentLoaded', App.init);

window.App = App;
