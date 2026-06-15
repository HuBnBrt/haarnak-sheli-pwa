# הארנק שלי

A private family PWA for teaching children practical money management.

**Hebrew UI · RTL · Google Sheets backend · No paid services · No App Store**

---

## What it does

- Tracks a child's **real physical wallet** by denomination (coins and bills)
- Shows **savings goals** with visual progress cards
- Manages a **giving account** for social responsibility
- Handles **chore rewards** with deadlines, late penalties, and parent approval
- Provides an **in-shop purchase helper** for counting cash in real stores
- Applies a **quarterly savings bonus** to make saving emotionally visible
- Logs everything in an **audit trail** stored in Google Sheets

---

## Architecture

```
PWA (GitHub Pages)  →  Google Apps Script (Web App)  →  Google Sheets
```

- **Frontend**: static HTML/CSS/JS PWA, no framework, no build step
- **Backend**: Google Apps Script Web App (POST action router)
- **Database**: Google Sheets in the parent's Google Drive
- **Images**: Google Drive (goal images, Phase 9)
- **Auth**: parent PIN hashed with SHA-256, verified inside GAS

Family data never touches this repository.

---

## Setup

See [`docs/setup-guide.md`](docs/setup-guide.md) for full instructions.

Short version:
1. Fork this repo → enable GitHub Pages (GitHub Actions source)
2. Create a Google Sheet → set `SHEET_ID` in GAS Script Properties → run `setupSheets()`
3. Deploy GAS as Web App (Execute as: Me, Who: Anyone) → copy the URL
4. Push to GitHub → Pages auto-deploys
5. Open the GitHub Pages URL on a device → paste GAS URL when prompted → tap "בדוק חיבור"
6. Ping must succeed before proceeding — this confirms CORS is working

---

## Repository structure

```
├── index.html          PWA shell entry point
├── manifest.json       PWA manifest (Hebrew, RTL)
├── sw.js               Service worker (shell cache)
├── config.example.js   Template for config.js (git-ignored)
├── css/                Styles (themes, layout, components)
├── js/                 App logic (router, api, auth, views)
├── gas/                Google Apps Script source files
├── sheets/             Schema documentation
├── docs/               Setup and architecture guides
└── .github/workflows/  GitHub Pages deploy workflow
```

---

## Development phases

| Phase | Focus |
|---|---|
| 0 | ✅ Skeleton, shell, GAS router, Sheet setup |
| 1 | Identity: user picker, PIN flow, device binding |
| 2 | Physical wallet by denomination |
| 3 | Accounts, allowance, child dashboard |
| 4 | Savings goals, bonus preview |
| 5 | Purchase helper |
| 6 | Giving, gray accounts, parent payment |
| 7 | Chores, deadlines, missed logic |
| 8 | Notifications, audit log |
| 9 | Goal image upload |
| 10 | Polish, themes, tablet layout |

---

## Data privacy

- GitHub contains **code only** — no family names, balances, or PINs
- All family data lives in **your own Google Sheet**
- Child devices never access the Sheet directly
- The GAS URL is kept private in `config.js` (git-ignored)
- Parent PINs are stored as SHA-256 hashes, never plaintext

---

## License

Private family project. Not for public distribution in current form.
