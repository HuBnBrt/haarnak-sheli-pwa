// ─────────────────────────────────────────────────────────────
// Config.gs — Spreadsheet access helpers
//
// SHEET_ID is stored in GAS Script Properties (not in code).
//
// One-time setup:
//   1. Create a Google Sheet and copy its ID from the URL.
//      (The ID is the long string between /d/ and /edit)
//   2. In the GAS editor: Project Settings → Script Properties
//      → Add property: SHEET_ID = your_sheet_id_here
//   3. Run setupSheets() once to create all tabs and seed data.
// ─────────────────────────────────────────────────────────────

/**
 * Open the family Google Sheet.
 * Reads SHEET_ID from Script Properties.
 * @throws if SHEET_ID is not configured.
 */
function getSpreadsheet() {
  const props   = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) {
    throw new Error(
      'SHEET_ID is not set. ' +
      'Go to Project Settings → Script Properties and add SHEET_ID = <your_sheet_id>.'
    );
  }
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Get a named tab from the family Sheet.
 * @param {string} tabName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(tabName) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Sheet tab not found: ' + tabName);
  return sheet;
}

/**
 * Read all rows from a tab as an array of objects keyed by header.
 * Skips the header row. Skips blank rows.
 * @param {string} tabName
 * @returns {Object[]}
 */
function readTab(tabName) {
  const sheet  = getSheet(tabName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/**
 * Append a single row to a tab.
 * @param {string} tabName
 * @param {Object} rowObj - Keys must match the tab headers.
 */
function appendRow(tabName, rowObj) {
  const sheet   = getSheet(tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row     = headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
  sheet.appendRow(row);
}

/**
 * Get a setting value from the `settings` tab.
 * @param {string} key
 * @returns {string} - Raw value string; parse as needed by caller.
 */
function getSetting(key) {
  const rows = readTab('settings');
  const row  = rows.find(r => r['key'] === key);
  if (!row) throw new Error('Setting not found: ' + key);
  return String(row['value']);
}

/**
 * Generate a simple unique ID: prefix + timestamp + random suffix.
 * @param {string} prefix - e.g., 'tx', 'goal', 'notif'
 * @returns {string}
 */
function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
