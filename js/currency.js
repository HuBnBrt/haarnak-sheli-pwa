// ─────────────────────────────────────────────────────────────
// currency.js — Money formatting and denomination utilities
//
// RULE: All money is stored and calculated as integer agorot.
//       Never use floats for money.
//       Display conversion happens only in this module.
//
// 1 ₪ = 100 agorot
// Examples:
//   5 ₪  = 500 agorot
//   17.60 ₪ = 1760 agorot
//   50 agorot = 50
// ─────────────────────────────────────────────────────────────

'use strict';

// Ordered from largest to smallest denomination (in agorot).
// This order is used for purchase suggestions and wallet display.
const DENOMINATIONS = Object.freeze([
  { agorot: 20000, labelHe: '200 ₪',  type: 'bill' },
  { agorot: 10000, labelHe: '100 ₪',  type: 'bill' },
  { agorot:  5000, labelHe: '50 ₪',   type: 'bill' },
  { agorot:  2000, labelHe: '20 ₪',   type: 'bill' },
  { agorot:  1000, labelHe: '10 ₪',   type: 'coin' },
  { agorot:   500, labelHe: '5 ₪',    type: 'coin' },
  { agorot:   200, labelHe: '2 ₪',    type: 'coin' },
  { agorot:   100, labelHe: '1 ₪',    type: 'coin' },
  { agorot:    50, labelHe: "50 אג׳", type: 'coin' },
  { agorot:    10, labelHe: "10 אג׳", type: 'coin' },
]);

/**
 * Format agorot as a short shekel string.
 * 500  → "5 ₪"
 * 1760 → "17.60 ₪"
 * 50   → "50 אג׳"
 * 0    → "0 ₪"
 */
function formatILS(agorot) {
  if (typeof agorot !== 'number' || isNaN(agorot)) return '—';
  if (agorot < 100 && agorot > 0) return `${agorot} אג׳`;
  if (agorot % 100 === 0) return `${agorot / 100} ₪`;
  const shekels = Math.floor(agorot / 100);
  const ag = String(agorot % 100).padStart(2, '0');
  return `${shekels}.${ag} ₪`;
}

/**
 * Format agorot as a verbose Hebrew string (for child-facing explanations).
 * 500  → "5 ₪"
 * 1760 → "17 שקלים ו־60 אגורות"
 * 50   → "50 אגורות"
 * 100  → "שקל אחד"
 * 0    → "0 ₪"
 */
function formatILSVerbose(agorot) {
  if (typeof agorot !== 'number' || isNaN(agorot)) return '—';
  const shekels = Math.floor(agorot / 100);
  const ag = agorot % 100;

  if (shekels === 0 && ag === 0) return '0 ₪';
  if (shekels === 0) return `${ag} אגורות`;
  if (ag === 0) {
    if (shekels === 1) return 'שקל אחד';
    return `${shekels} ₪`;
  }
  return `${shekels} שקלים ו־${ag} אגורות`;
}

/**
 * Convert a denomination map to a total in agorot.
 * denomMap: { [denomination_agorot: string]: count }
 * Example: { "1000": 3, "500": 2 } → 4000
 */
function denominationsToTotal(denomMap) {
  return Object.entries(denomMap).reduce((sum, [den, count]) => {
    return sum + (parseInt(den, 10) * parseInt(count, 10));
  }, 0);
}

/**
 * Parse a shekel string entered by the user into agorot.
 * Accepts: "17.60", "17,60", "17", "0.50"
 * Returns integer agorot, or null if invalid.
 */
function parseILSInput(str) {
  if (!str) return null;
  const cleaned = String(str).replace(',', '.').trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) return null;
  // Round to avoid floating point drift, then convert to agorot
  return Math.round(parsed * 100);
}

// Export for use across the app
window.Currency = {
  DENOMINATIONS,
  formatILS,
  formatILSVerbose,
  denominationsToTotal,
  parseILSInput,
};
