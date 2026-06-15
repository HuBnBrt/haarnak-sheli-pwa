// ─────────────────────────────────────────────────────────────
// config.example.js — LOCAL DEVELOPMENT ONLY
//
// This file is documentation for developers running the app
// locally (e.g., via `npx serve` or VS Code Live Server).
//
// On production devices (GitHub Pages + real phones/tablets):
//   The GAS URL is entered by the parent during first setup
//   and stored in localStorage by api.js.
//   No config.js file is needed or expected on those devices.
//
// For local development:
//   1. Copy this file to config.js
//   2. Fill in your GAS Web App URL below
//   3. config.js is git-ignored — never commit it
//
// How to get your GAS_URL:
//   1. Open your Google Apps Script project
//   2. Deploy → New Deployment → Web App
//   3. Execute as: Me / Who has access: Anyone
//   4. Copy the Web App URL
// ─────────────────────────────────────────────────────────────

const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
