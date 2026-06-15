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
// ── CRITICAL: render–hash decoupling ─────────────────────────
// route() ALWAYS calls VIEWS[view]() directly — it does NOT rely
// on hashchange to trigger rendering. _setHash() updates the URL
// as a cosmetic side-effect only (back-button, debugging).
//
// Old pattern (broken): navigate(view) → sets hash → hashchange
//   → route() → ... → navigate(view) again → hash unchanged →
//   no event → view never rendered → blank screen.
//
// New pattern: route() decides the view, renders it immediately,
// then updates the hash if needed. Hashchange only re-calls
// route() when the user changes the URL manually.
//
// Depends on: currency.js, i18n.js, api.js, auth.js, views/*.js
// ─────────────────────────────────────────────────────────────

'use strict';

const App = (() => {

  const appEl     = document.getElementById('app');
  const loadingEl = document.getElementById('app-loading');

  // ── View registry ─────────────────────────────────────────
  const VIEWS = {
    setup:  () => Views.Setup.render(appEl),
    child:  () => Views.ChildDashboard.render(appEl),
    parent: () => Views.ParentDashboard.render(appEl),
  };

  // ── Router ────────────────────────────────────────────────
  //
  // Always renders a view directly. Never relies on hashchange
  // to trigger rendering — that's what caused the blank screen.
  function route() {
    const hash = window.location.hash.replace('#', '') || '';
    console.log('[app] route detected, hash:', hash || '(empty)');

    // Gate 1: No GAS URL → setup required.
    if (!API.isConfigured()) {
      console.log('[app] no GAS URL — rendering setup');
      _setHash('setup');
      VIEWS['setup']();
      console.log('[app] setup rendered');
      return;
    }

    // Gate 2: No device identity → setup required.
    const identity = Auth.getIdentity();
    if (!identity) {
      console.log('[app] no identity — rendering setup');
      _setHash('setup');
      VIEWS['setup']();
      console.log('[app] setup rendered');
      return;
    }

    // Gate 3: #setup hash with identity still in place.
    // (This can happen right after a reset before navigate fires.)
    if (hash === 'setup') {
      console.log('[app] #setup hash — rendering setup');
      VIEWS['setup']();
      console.log('[app] setup rendered');
      return;
    }

    // Gate 4: Route strictly by identity type.
    //
    // A device is bound to exactly ONE user (child OR parent).
    // Child devices must never reach #parent via the router —
    // parent controls on a child device are handled inline by
    // ParentControls.render() after PIN verification, with no
    // hash change.

    if (identity.userType === 'parent') {
      console.log('[app] rendering parent dashboard');
      _setHash('parent');
      VIEWS['parent']();
      return;
    }

    // Child-bound device: block any attempt to reach #parent
    // via the address bar (no error shown, just redirect).
    if (hash === 'parent') {
      console.log('[app] #parent blocked on child device — redirecting to child');
      _setHash('child');
      VIEWS['child']();
      return;
    }

    console.log('[app] rendering child dashboard');
    _setHash('child');
    VIEWS['child']();
  }

  // Update the URL hash without re-triggering route() when
  // the hash is already at the target value.
  function _setHash(view) {
    if (window.location.hash.replace('#', '') !== view) {
      window.location.hash = view;
    }
  }

  // Public navigate() — called by views after state changes
  // (e.g., after binding identity or resetting device).
  // Forces a route() call even when hash doesn't change.
  function navigate(view) {
    _setHash(view);
    // Always re-route explicitly: _setHash is a no-op when hash
    // equals view, so we can't rely on hashchange to trigger route().
    route();
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    console.log('[app] boot started');

    try {
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

      console.log('[app] has GAS URL:', API.isConfigured());

      hideLoading();

      // hashchange handles manual URL bar changes only.
      // Initial render is driven by the explicit route() call below.
      window.addEventListener('hashchange', route);
      route();

    } catch (err) {
      console.error('[app] fatal boot error:', err);
      _showFatalError(err);
    }
  }

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.classList.add('hidden');
    loadingEl.addEventListener('transitionend', () => loadingEl.remove(), { once: true });
    // Fallback in case transitionend doesn't fire (e.g., transition disabled)
    setTimeout(() => { if (loadingEl.parentNode) loadingEl.remove(); }, 400);
  }

  function _showFatalError(err) {
    // Remove spinner so the error is visible
    if (loadingEl && loadingEl.parentNode) loadingEl.remove();
    const el = appEl || document.body;
    el.innerHTML = `
      <div style="
        padding: 40px 24px;
        text-align: center;
        direction: rtl;
        font-family: system-ui, sans-serif;
      ">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">⚠️</div>
        <h2 style="color: #EF4444; margin: 0 0 8px;">שגיאה בטעינת האפליקציה</h2>
        <p style="color: #6B7280; font-size: 0.9rem; margin: 0 0 24px;">
          ${_appEscHtml(err.message || 'שגיאה לא ידועה')}
        </p>
        <button
          onclick="location.reload()"
          style="
            padding: 12px 28px;
            background: #4A90E2;
            color: #fff;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          "
        >
          טען מחדש
        </button>
      </div>
    `;
  }

  function _appEscHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, navigate, route };

})();

document.addEventListener('DOMContentLoaded', App.init);

window.App = App;
