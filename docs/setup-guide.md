# הארנק שלי — Setup Guide

This guide walks a family through deploying their own private instance.
All family data stays in your own Google account. Nothing goes to GitHub.

---

## Prerequisites

- A Google account (for Sheets, Drive, and Apps Script)
- A GitHub account (for hosting the PWA on GitHub Pages)
- A phone or tablet for each child and parent

---

## Step 1 — Fork the repository

1. Go to the GitHub repository for הארנק שלי.
2. Click **Fork** → create a fork in your GitHub account.
3. In your fork's Settings → Pages → set Source to **GitHub Actions**.

---

## Step 2 — Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. Name it: **הארנק שלי — משפחה** (or any name you prefer).
3. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  ← SHEET_ID →  /edit
   ```

---

## Step 3 — Create the Google Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Name the project: **הארנק שלי API**.
3. Copy the contents of all files from the `gas/` folder in this repo into the GAS editor:
   - `Code.gs` → replace the default `Code.gs`
   - Create new files for: `Config.gs`, `Auth.gs`, `AuditLog.gs`, `Setup.gs`, `Users.gs`, `Allowance.gs`
   - Replace `appsscript.json` content (click Project Settings → edit manifest).
4. In **Project Settings → Script Properties**, add:
   ```
   SHEET_ID = paste_your_sheet_id_here
   ```

---

## Step 4 — Run setupSheets()

1. In the GAS editor, select the function `setupSheets` from the function dropdown.
2. Click **Run**.
3. Approve the permission dialog (the script needs access to your Sheet).
4. Check the Execution Log — you should see all tabs created successfully.
5. Open your Google Sheet and verify the tabs were created.

**After setup:**
- Go to the `users` tab and replace the placeholder names (`ילד1`, `ילדה1`, `אבא1`, `אמא1`)
  with your family's real first names.
- Do NOT change the `user_id` or `role_key` columns.
- Parent PINs will be set via the app's parent dashboard (Phase 1).

---

## Step 5 — Deploy the GAS Web App

1. In the GAS editor, click **Deploy → New Deployment**.
2. Click the gear icon → **Web App**.
3. Set:
   - **Execute as**: Me (your Google account)
   - **Who has access**: Anyone
4. Click **Deploy**.
5. Copy the **Web App URL** — this is your private API endpoint.

> Keep this URL private. It is your family's private API endpoint.
> Real security comes from parent PIN verification inside the GAS code.

---

## Step 6 — Deploy to GitHub Pages

1. Push your fork to GitHub (make sure `config.js` is NOT committed — it's in `.gitignore`).
2. In your fork: Settings → Pages → Source: **GitHub Actions**.
3. The `.github/workflows/deploy.yml` workflow deploys automatically on every push to `main`.
4. Your PWA is live at: `https://yourusername.github.io/haarnak-sheli/`

> `config.js` is never deployed. The GAS URL is entered by the parent directly
> inside the app during first setup and stored in the device's localStorage.

---

## Step 7 — Connect the PWA to GAS (blocking CORS test)

**This step must succeed before any further development proceeds.**

1. Open your GitHub Pages URL on a real device or browser.
2. The app shows a **"כתובת שרת GAS"** input field.
3. Paste your GAS Web App URL into the field.
4. Tap **בדוק חיבור**.
5. The app sends a `POST` request to GAS with `{ action: "ping" }`.

**Expected result:**
```
✓ החיבור תקין
הארנק שלי GAS is running
2024-xx-xxTxx:xx:xxZ
```

**If this fails:**

Open the browser console (F12 → Console) and note the exact error.

| Error | Cause | Fix |
|---|---|---|
| `CORS error` / `blocked by CORS policy` | GAS not deployed as "Anyone" | Redeploy GAS → New Deployment → Who has access: Anyone |
| `Failed to fetch` | Wrong URL or network issue | Verify URL starts with `https://script.google.com/macros/s/` |
| `HTTP 302` redirect loop | Old deployment URL | Create a New Deployment (not a new version of an old one) |
| GAS returns `{ ok: false }` | Server-side error | Check GAS execution log for the error |

**Do not proceed to Phase 1 until ping succeeds from the deployed GitHub Pages URL.**

---

## Step 8 — Local development (optional)

For local testing without entering the URL each time:

1. Copy `config.example.js` → `config.js`
2. Fill in your GAS URL
3. Serve locally: `npx serve .` or VS Code Live Server
4. The app reads `GAS_URL` from `config.js` as a fallback

`config.js` is git-ignored and never deployed.

---

## Step 9 — First device setup (Phase 1)

Once Phase 1 is implemented:
1. Open the PWA on a family device.
2. Select the user from the list.
3. Enter a parent PIN to confirm identity.
4. The device is locked to that user until reset.

---

## Resetting a device

To reset a device's identity (e.g., reassigning a tablet):
- Open the PWA → tap ״איפוס מכשיר״ → enter parent PIN.
- The device returns to the user-selection screen.
- No data is deleted from the Google Sheet.

---

## Security notes

- The GAS Web App URL is private. If it leaks, redeploy to get a new URL.
- Parent PINs are stored as SHA-256 hashes in the Google Sheet — never in plaintext.
- Child devices never access the Google Sheet directly.
- All sensitive actions require parent PIN verification inside GAS.
- Family data never touches GitHub.
