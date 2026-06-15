// ─────────────────────────────────────────────────────────────
// api.js — GAS Web App client
//
// ── CORS strategy ────────────────────────────────────────────
// GAS Web Apps (deployed as "Anyone") return:
//   Access-Control-Allow-Origin: *
// on their responses — but ONLY for "simple" requests.
//
// A request is "simple" (no preflight OPTIONS) when Content-Type is:
//   text/plain  ← our primary
//   application/x-www-form-urlencoded  ← our fallback
//   multipart/form-data
//
// DO NOT use Content-Type: application/json.
// That triggers a CORS preflight OPTIONS request.
// GAS ignores OPTIONS → browser blocks the response.
//
// ── Primary (text/plain) ─────────────────────────────────────
// POST body is a JSON string; Content-Type is text/plain;charset=utf-8.
// GAS reads: e.postData.contents → JSON.parse()
// No preflight. Works from any origin.
//
// ── Fallback (application/x-www-form-urlencoded) ─────────────
// POST body is: data=<URL-encoded JSON string>
// GAS reads: e.parameter.data → JSON.parse()
// Also a simple request. Used if text/plain fails for any reason.
//
// ── GAS URL storage ──────────────────────────────────────────
// Resolution order (highest priority first):
//   1. localStorage 'haarnak_gas_url'  ← set by parent during setup
//   2. window.GAS_URL from config.js   ← local development only
// config.js is git-ignored, never served on GitHub Pages.
// ─────────────────────────────────────────────────────────────

'use strict';

const GAS_URL_KEY    = 'haarnak_gas_url';
const API_TIMEOUT_MS = 15000;

// ── GAS URL management ───────────────────────────────────────

function getGasUrl() {
  const stored = localStorage.getItem(GAS_URL_KEY);
  if (stored) return stored;
  if (typeof window.GAS_URL === 'string' && window.GAS_URL !== 'YOUR_GAS_WEB_APP_URL_HERE') {
    return window.GAS_URL;
  }
  return null;
}

function setGasUrl(url) {
  localStorage.setItem(GAS_URL_KEY, url.trim());
}

function clearGasUrl() {
  localStorage.removeItem(GAS_URL_KEY);
}

function isConfigured() {
  return !!getGasUrl();
}

// ── Internal fetch helper ────────────────────────────────────

async function _fetchGAS(url, bodyString, contentType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body:    bodyString,
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read response body as text first so we can show it on parse failure
    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // Response is not JSON — usually means the GAS URL is wrong
      // (e.g., points to a login page or HTML error page)
      throw new Error(
        `השרת החזיר תגובה לא תקינה (לא JSON).\n` +
        `תחילת התגובה: ${text.slice(0, 120)}`
      );
    }

    if (!json.ok) {
      throw new Error(json.error || 'שגיאה לא ידועה מהשרת');
    }

    return json.data;

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('הבקשה לשרת לקחה יותר מדי זמן. נסה שוב.');
    }
    throw err;
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Primary call: text/plain body containing JSON.
 * GAS reads e.postData.contents.
 * Simple request — no CORS preflight.
 */
async function callGAS(action, payload = {}) {
  const url = getGasUrl();
  if (!url) {
    throw new Error('כתובת השרת אינה מוגדרת. יש להגדיר אותה במסך ההתחלה.');
  }
  const bodyString = JSON.stringify({ action, payload });
  return _fetchGAS(url, bodyString, 'text/plain;charset=utf-8');
}

/**
 * Fallback call: application/x-www-form-urlencoded body.
 * Payload is sent as: data=<URL-encoded JSON>
 * GAS reads e.parameter.data.
 * Also a simple request — no CORS preflight.
 * Use this if callGAS() fails with a network/CORS error.
 */
async function callGASUrlEncoded(action, payload = {}) {
  const url = getGasUrl();
  if (!url) {
    throw new Error('כתובת השרת אינה מוגדרת. יש להגדיר אותה במסך ההתחלה.');
  }
  const data       = JSON.stringify({ action, payload });
  const bodyString = 'data=' + encodeURIComponent(data);
  return _fetchGAS(url, bodyString, 'application/x-www-form-urlencoded');
}

/**
 * Try primary (text/plain), then fallback (url-encoded) on network failure.
 * Returns { data, method } where method is 'plain' or 'urlencoded'.
 * Used by the setup ping test to auto-detect what works.
 */
async function callGASWithFallback(action, payload = {}) {
  // 1. Try text/plain (preferred, cleaner)
  try {
    const data = await callGAS(action, payload);
    return { data, method: 'plain' };
  } catch (primaryErr) {
    // Only retry on network-type errors, not on GAS-returned errors.
    // GAS errors come through as a parsed response with ok:false, so they
    // are already thrown as Error objects from inside _fetchGAS.
    // A network/CORS failure throws with no response at all.
    const isNetworkError =
      primaryErr.message.includes('Failed to fetch') ||
      primaryErr.message.includes('NetworkError') ||
      primaryErr.message.includes('Load failed') ||   // Safari
      primaryErr.message.includes('CORS');

    if (!isNetworkError) {
      // Not a CORS/network error — re-throw, fallback won't help
      throw primaryErr;
    }

    // 2. Fallback: url-encoded
    try {
      const data = await callGASUrlEncoded(action, payload);
      return { data, method: 'urlencoded' };
    } catch (fallbackErr) {
      // Both failed. Throw a combined diagnostic error.
      throw new Error(
        `שתי שיטות הבקשה נכשלו.\n\n` +
        `text/plain: ${primaryErr.message}\n\n` +
        `url-encoded: ${fallbackErr.message}`
      );
    }
  }
}

/**
 * Quick connectivity check (text/plain).
 */
async function ping() {
  return callGAS('ping');
}

window.API = {
  callGAS,
  callGASUrlEncoded,
  callGASWithFallback,
  ping,
  getGasUrl,
  setGasUrl,
  clearGasUrl,
  isConfigured,
};
