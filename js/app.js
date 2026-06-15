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

    // Step 1: GAS URL must be configured before anything else
    if (!API.isConfigured()) {
      navigate('setup');
      return;
    }

    // Step 2: Device identity must be set
    const identity = Auth.getIdentity();
    if (!identity) {
      navigate('setup');
      return;
    }

    // Step 3: Route strictly by device identity type.
    //
    // A device is bound to exactly ONE user (child OR parent).
    // Child devices must never reach #parent via the router —
    // parent controls on a child device are handled inline by
    // ParentControls.render() after PIN verification, with no
    // hash change.
    //
    // The only way to change device identity is through setup
    // (requires parent PIN → resetDeviceIdentity → re-bind).

    if (identity.userType === 'parent') {
      // Parent-bound device: always show parent dashboard.
      // Allow explicit #parent hash (e.g., after navigating back).
      if (hash !== 'parent') navigate('parent');
      else VIEWS['parent']();
    } else {
      // Child-bound device: always show child dashboard.
      // Block any attempt to reach #parent via the hash bar.
      if (hash === 'parent') {
        // Silently redirect — no error shown, no parent controls opened.
        navigate('child');
      } else if (hash === 'child' || hash === '') {
        VIEWS['child']();
      } else if (VIEWS[hash]) {
        // #setup is always allowed (e.g., after identity reset)
        VIEWS[hash]();
      } else {
        navigate('child');
      }
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
