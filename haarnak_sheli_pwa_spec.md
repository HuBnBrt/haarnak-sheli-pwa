# My Wallet PWA Product Specification

> Product Hebrew name: ״הארנק שלי״  
> Status: MVP planning document  
> Primary audience: Claude Code / Gemini Canvas / future developers  
> User-facing language: Hebrew  
> Internal documentation language: English  
> Data ownership principle: family data belongs to the family, not to the app.

---

## 1. Product Vision

״הארנק שלי״ is a private family PWA for teaching children practical money management.

The app should teach physical money counting, saving toward personal goals, thoughtful giving, delayed gratification, the connection between chores and reward, and the difference between physical wallet money and virtual balances.

Core principle:

> The app manages. The physical wallet teaches.

The app must not become a casino-like mobile game. It should feel playful, colorful, friendly, and motivating, but not addictive.

---

## 2. Technical Architecture

### Final architecture decision

- Frontend: static PWA hosted on GitHub Pages.
- Backend/API: Google Apps Script Web App.
- Database: Google Sheets stored in the parent’s Google Drive.
- Images: goal images stored in a dedicated Google Drive folder.
- Deployment: private URL shared with family devices.
- Installation: Add to Home Screen.
- No paid backend.
- No paid database.
- No native App Store / Google Play deployment for MVP.

### Data ownership

GitHub must contain only code, static assets, documentation, and setup templates.

GitHub must never contain family balances, children names from the real family, parent PINs, real transaction data, Google Sheet IDs hardcoded in public code, or Google Drive file IDs for real goal images.

The Google Sheet is the single source of truth for all live family data.

### Future open-source readiness

The project should be structured so it can later become a self-hosted template for other families.

Future users should be able to fork/copy the repository, create their own Google Sheet, create their own Google Apps Script deployment, connect their own frontend to their own GAS endpoint, and keep their family data fully separate from the original creator.

---

## 3. Core App Modes

The product is one PWA with two modes:

1. Child Mode
2. Parent Mode

There must not be two separate apps.

### Child Mode

Child Mode is visual, educational, and mostly guided.

Children may see their own dashboard, see what is physically in their wallet, see savings balance, see goals, use the purchase/payment helper, see giving balance, see pending chores, see chore reward notifications, see missed chore messages for a limited period, propose/edit goals only under parent PIN approval, and use guided purchase flows.

Children may not approve their own rewards, add money directly, modify balances directly, approve chores, change system settings, or change their device identity without parent PIN.

### Parent Mode

Parent Mode is management-focused and protected by parent PIN, unless the device was installed as a parent device.

Parents may add or adjust monthly allowance settings, approve installation identity, redeem/fund physical cash, record purchases, update physical wallet content, record gifts, record chore rewards, approve goal changes, approve moving savings to physical wallet, record giving actions, send chore requests, mark chores as completed by parent, view logs/history, and manage settings/users/chores/goals/account labels.

---

## 4. First Installation Flow

On first launch, the PWA fetches the family user list from Google Sheets through GAS.

The app asks:

> ״מי משתמש במכשיר הזה?״

The list is built from the `users` sheet.

Example user roles:

- ילד1
- ילדה1
- אבא1
- אמא1
- אבא2
- אמא2

Each user row should include role key, Hebrew display name, user type, gender, parent PIN if relevant, active flag, and selected theme palette.

After selecting a user, the device is locked to that identity using local storage.

Changing the identity requires parent PIN.

Selecting any identity during first installation requires a valid parent PIN.

The app must include a protected ״איפוס מכשיר״ action. This clears the local identity binding, but does not delete any data from the Google Sheet.

---

## 5. User-Facing Account Model

The app has three main child-facing accounts.

### 5.1 ״יש לי בארנק״

This is the real physical wallet.

It shows exactly what the child currently has in cash. It is not virtual money.

It contains bills and coins by denomination, displayed as grouped visual stacks.

Example labels:

- `2×20 ₪`
- `4×10 ₪`
- `1×5 ₪`
- `3×2 ₪`
- `6×1 ₪`
- `2×50 אג׳`
- `1×10 אג׳`

If a denomination count is zero, it must not be displayed. Do not show `0×5 ₪`.

### 5.2 ״אני חוסך: המטרות שלי״

This is the main virtual savings account.

Monthly allowance deposits go here.

Gift money and chore earnings may be manually moved here by parent and child decision.

This account is used for saving toward goals, displaying goal cards, earning quarterly parent bonus, and deciding whether to redeem physical cash for a purchase.

### 5.3 ״נתינה - צדק חברתי״

This is a virtual giving account.

A fixed amount from the monthly allowance goes here automatically.

This account is used for donations, giving to a person, school collection, helping a sibling or friend, or giving money in a real-life moment.

Suggested explanatory copy:

> ״כסף שבוחרים לתת, לעזור או לשמח איתו מישהו.״

---

## 6. Temporary Gray Accounts

There are two temporary holding areas, shown in gray because the money is not yet allocated.

### 6.1 ״מתנות״

Child-facing explanation:

> ״כסף שקיבלת במתנה - לחלוקה״

Gift money is recorded here first.

The child and parent later decide how to distribute it.

### 6.2 ״מטלות״

Child-facing explanation:

> ״כסף שקיבלת על ביצוע מטלה - לחלוקה״

Chore rewards are recorded here first.

The child and parent later decide how to distribute them.

Money in gray accounts is not available for redemption until distributed.

The app should remind parent and child when there is unallocated gray money.

Recommended reminder timing:

- 14 days after money was added and not distributed;
- 5 days before the quarterly savings bonus calculation.

The reminder should suggest a distribution but must not execute automatically.

Example:

> ״יש כסף שמחכה לחלוקה. רוצה לחלק אותו עכשיו?״

---

## 7. Monthly Allowance

MVP monthly allowance:

- total: 20 ₪ per child;
- recurring date: first day of every month;
- handled automatically by GAS;
- settings editable in Google Sheets.

Current default split:

- 15 ₪ → ״אני חוסך: המטרות שלי״
- 5 ₪ → ״נתינה - צדק חברתי״
- 0 ₪ → physical wallet

There is no automatic monthly cash given to the physical wallet.

If the child wants cash, the parent performs a guided transfer/redemption.

---

## 8. Quarterly Savings Bonus

The separate long-term account was removed from MVP.

Instead, the regular savings account receives a quarterly parent bonus.

### Purpose

To make saving emotionally visible to children.

Instead of teaching abstract adult finance, the app shows:

> ״אם שמרת כסף בחיסכון, אמא ואבא מפרגנים ומוסיפים לך.״

### Default bonus

Default bonus rate: 50% of current savings balance.

This value must be configurable in Google Sheets.

### Bonus timing

The bonus is calculated once per quarter.

The app should display in the savings card:

> ״בעוד X ימים אמא ואבא ישלימו לכאן Y ₪״

Where `Y` is calculated in the background according to the configured bonus percentage.

Example:

- Savings balance: 100 ₪
- Bonus rate: 50%
- Upcoming bonus: 50 ₪

Child-facing display:

> ״בעוד 12 ימים אמא ואבא ישלימו לכאן 50 ₪״

The bonus should be accompanied by a parent-child conversation.

Example parent wording:

> ״תראה, הצלחת לשמור כאן 100 ₪. בגלל ששמרת, אנחנו מוסיפים לך עכשיו 50 ₪. עכשיו יש לך 150 ₪ לחיסכון למטרות שלך.״

If a child wants to redeem savings a few days before the quarterly date, parents may remind them:

> ״עוד יומיים יש בונוס חיסכון. אולי כדאי לחכות רגע?״

The app may show the upcoming bonus, but it should not block parent-approved withdrawals.

---

## 9. Savings Goals

Savings goals live inside ״אני חוסך: המטרות שלי״.

Savings is one shared pool, not separate money piles per goal.

### Goal fields

Each goal should include goal ID, child ID, title, target price, optional image file ID, status, created date, completed date if applicable, and sort metadata.

### Goal image

Children may photograph or upload an image for a goal.

MVP desired behavior:

- store compressed image in Google Drive;
- use a dedicated child folder;
- save Drive file ID in the goals sheet;
- display the image only on the child device/app view;
- do not show images in parent dashboard unless explicitly needed later.

Recommended folder structure:

```text
הארנק שלי/
  goal-images/
    adir/
    renana/
    archive/
```

When a goal is deleted/cancelled:

- remove it from the child view;
- move its image to Drive archive folder;
- parent may manually delete archived images later.

### Goal status

Internal statuses may be system-safe.

Child-facing statuses must be friendly.

Internal:

- active
- ready
- completed
- cancelled

Child-facing:

- active / low progress: ״אתה בתחילת הדרך״ / ״את בתחילת הדרך״
- medium progress: ״אתה כבר מתקרב״ / ״את כבר מתקרבת״
- high progress: ״כמעט הגעת״
- ready: ״אפשר לקנות!״
- completed: ״קניתי!״
- cancelled: not shown

Cancelled goals should not remain visible to the child.

Completed goals move to a lower/archive section.

Suggested archive label:

> ״דברים שכבר קניתי״

### Goal card progress display

Each goal card must cap the displayed saved amount at the goal target.

If savings balance is 40 ₪ and goal target is 25 ₪, display:

> ״25 מתוך 25 ₪״

Do not display:

> ״40 מתוך 25 ₪״

If savings balance is 15 ₪ and goal target is 25 ₪, display:

> ״15 מתוך 25 ₪״  
> ״חסרים לך עוד 10 ₪״

### Savings card summary

The savings card should display:

- current total savings balance;
- how many goals can currently be fulfilled;
- days until next quarterly bonus;
- expected bonus amount;
- goal cards.

Suggested copy:

> ״יש לך כבר X מטרות שאפשר לממש!״

This wording is preferred because it does not imply the child can necessarily buy all of them together.

### Goal card layout

Goals should appear as playful cards/tiles, not table rows.

They should include title, optional image, target price, displayed progress, missing amount or ready message, color-coded status, and action buttons if relevant.

### Goal sorting

Default sorting:

1. Goals that can be fulfilled now.
2. Goals closest to fulfillment.
3. Goals farther away.
4. Completed goals lower/in separate section.

MVP should include a simple sort selector:

- לפי מימוש
- לפי קרבה ליעד
- לפי סכום
- לפי סדר הוספה

---

## 10. Redeeming Savings to Physical Wallet

Savings can be moved toward a real purchase.

This is done with parent approval and PIN.

The child may decide with a parent to redeem money from savings.

Redemption to physical wallet should be in 10 ₪ increments.

Example:

- savings decreases by 10 ₪;
- parent physically gives 10 ₪ cash;
- physical wallet increases by one 10 ₪ bill/coin;
- transaction is logged.

This is not called ״בנק אמאבא״ in the UI.

The model is virtual savings and real wallet cash.

No warning is needed if the child is redeeming savings for a real purchase with parent approval.

---

## 11. Giving

The giving account is virtual.

Monthly allowance deposits 5 ₪ into giving by default.

Giving actions can be physical or parent-fronted.

Example: child sees someone at a junction and wants to give 5 ₪, but the wallet is not available.

Flow:

1. Child chooses giving amount.
2. Parent physically gives the money.
3. App records that parent paid temporarily for a giving action.
4. Child later returns physical cash to parent.
5. The giving account decreases accordingly.
6. The settlement is logged.

Avoid using the Hebrew word ״חוב״ in child-facing UI.

Use:

> ״צריך להחזיר לאמאבא״

---

## 12. Temporary Parent Payment

The app supports parent temporary payment.

Use cases:

- child forgot wallet;
- child forgot phone;
- child has no physical cash;
- parent paid by credit card;
- giving moment requires parent cash.

Child-facing label:

> ״צריך להחזיר לאמאבא״

Important:

- This is not a virtual automatic deduction from another account unless explicitly recorded.
- The educational goal is physical settlement.
- Children should return physical cash when possible.
- Partial repayment is allowed.
- All settlements are logged.

---

## 13. Purchase Helper

The purchase helper is central to the app.

It is used in real shops.

### Flow

1. Child enters price.
2. App shows available physical wallet stacks.
3. App suggests payment combinations.
4. Preferred suggestions should try to reduce small coins when sensible.
5. Child taps stacks to choose what they will pay with.
6. App updates selected payment, missing amount, overpayment, and expected change.
7. Child pays the shop.
8. Child enters received change by tapping coin/bill stacks.
9. App validates expected change.
10. Child confirms:
   - male: ״הכנס לארנק האמיתי״
   - female: ״הכניסי לארנק האמיתי״
11. Wallet denomination counts are updated.

### Payment suggestion principle

The app should not only choose the fewest coins.

It should prefer helping the child get rid of excessive small coins when reasonable.

Example:

If price is 10 ₪ and child has:

- 1×10 ₪
- 1×5 ₪
- 5×1 ₪

First suggestion may be:

- 5+1+1+1+1+1

Second suggestion:

- 10

### Parent-mode purchase support

Parent Mode must include two purchase flows:

1. ״קנייה עם הילד״  
   Full educational flow, as if operating from the child’s wallet.

2. ״עדכון מהיר״  
   Parent records purchase and change quickly without didactic steps.

This solves cases where the child forgot the phone or the parent uses their own device.

---

## 14. Chores, Rewards, Skills, and Responsibilities

The system supports paid chores, skill building, and household responsibilities.

### Child-facing chore areas

Child Mode may show:

- what I am learning;
- what I can already do;
- what I am responsible for;
- pending parent requests;
- missed opportunities;
- recent reward messages.

### Chore request flow

Parent may send a chore request.

Example child notification:

> ״אבא מבקש שתטאטא״

or

> ״אמא מבקשת שתטאטא״

MVP: this is an in-app notification, not a phone push notification.

The child sees one button:

> ״קראתי ואבצע עוד מעט״

After this, a visible badge or flashing chore indicator remains until the chore is resolved.

### Chore deadlines

Each chore can define:

- time to complete;
- time unit;
- full reward;
- late reward percentage;
- missed visibility days.

Child-facing display:

> ״יש לך עוד X לביצוע״

Example:

> ״יש לך עוד 3 שעות לביצוע״

### Late or missed chores

No money is deducted from the child.

Instead:

- completed on time: 100% reward;
- completed late but before parent did it: 50% less than reward;
- parent completed it instead: 0 reward.

Default late reward:

- 50% of original reward.

Example:

- chore reward: 4 ₪
- late completion: 2 ₪

If time expired:

> ״פספסת X ₪ כי עדיין לא ביצעת את המטלה״

If parent performed it instead:

> ״אבא כבר טיפל בזה. הפעם לא הרווחת X ₪.״

or:

> ״אמא כבר טיפלה בזה. הפעם לא הרווחת X ₪.״

This depends on which parent recorded the action, not on child gender.

### Missed/expired visibility

Missed or parent-completed chore messages remain visible to the child for 7 days.

After 7 days, they move to notification archive.

Parents can review the archive monthly with the child.

### Chore rewards

When parent approves a paid chore, the money goes first into the gray account:

> ״מטלות״

It is not automatically added to savings or giving.

The parent and child later decide how to distribute it.

---

## 15. Default Chore Bank

The chore bank should be seeded in Google Sheets and editable by parents.

### 1 ₪ chores

- סידור נעליים בכניסה
- איסוף כביסה לסל
- ריקון פח קטן
- השקיית עציץ אחד לפי הוראה
- מיון טושים יבשים

### 2 ₪ chores

- ניקוי אבק מדף קטן
- קיפול מגבות קטנות
- מיון גרביים
- פינוי שולחן אחרי ארוחה
- סידור אזור משחקים משפחתי

### 3 ₪ chores

- סידור מדיח חלקי
- ניקוי אבק אזור מלא
- טאטוא אזור קטן
- הכנסת קניות קלות למקום
- קיפול מגבות מלא

### 4-5 ₪ chores

- טאטוא ואיסוף לליעה
- סידור מדיח מלא
- ניקוי שולחן אוכל וכיסאות
- סידור סלון לפני שבת או אורחים
- ניקוי אבק יסודי באזור גדול

### 6-8 ₪ chores

- פרויקט סידור מגירה
- מיון בקבוקים למחזור
- עזרה משמעותית בקניות
- ניקוי מקלחון או אמבטיה קלה, only with safe materials
- סידור אזור גדול בבית

Parents can adjust all chore names, amounts, deadlines, and reward rules in the Google Sheet.

---

## 16. Notifications

MVP includes in-app notifications and badges.

MVP does not require real push notifications to the lock screen.

### Notification types

- allowance deposited;
- savings bonus coming soon;
- savings bonus applied;
- goal ready;
- goal completed;
- chore requested;
- chore reward added;
- chore missed;
- parent completed chore;
- money waiting for distribution;
- parent payment waiting for physical settlement.

### Notification states

- unread;
- read;
- active;
- expired;
- archived.

---

## 17. Visual Direction

The app should feel inspired by playful mobile game interfaces such as Brawl Stars, but must not copy any franchise assets, characters, logos, icons, fonts, or exact UI components.

Design language:

- colorful;
- child-friendly;
- clear;
- bold;
- soft;
- informational;
- playful;
- structured;
- large touch targets;
- rounded cards;
- mild diagonal shapes;
- strong visual hierarchy.

Avoid:

- fireworks;
- casino-like effects;
- reward addiction patterns;
- clutter;
- tiny controls;
- adult banking coldness.

### Suggested app name display

Main:

> ״הארנק שלי״

### Suggested color palettes

Children may choose a palette on installation.

Four starting palette ideas:

1. ים וגיבור  
   Blue, turquoise, orange.

2. חלל סגול  
   Purple, deep blue, pink.

3. אש ושמש  
   Red, orange, yellow.

4. יער ונענע  
   Green, yellow, turquoise.

Palette choice should be saved per child.

---

## 18. Layout Requirements

The app must support mobile and tablet / large screen layouts.

### Mobile

- vertical stack;
- big cards;
- bottom or simple navigation;
- large buttons;
- one main action per area.

### Tablet

- two-column layout where appropriate;
- broader dashboard;
- wallet and goals visible together;
- parent mode easier to operate;
- still RTL.

Layout detection is based on viewport size, not permissions.

Permissions are based on user identity and PIN.

---

## 19. PWA Requirements

The PWA should include:

- `manifest.json`
- app icons
- service worker
- installable home screen behavior
- RTL support
- Hebrew language metadata
- mobile-first responsive UI
- offline-friendly loading shell if possible

Live financial data should not rely on local-only storage.

Local storage may store selected device identity, theme, temporary UI state, and cached non-authoritative data.

Authoritative data lives in Google Sheets.

---

## 20. Google Sheets Suggested Tabs

Recommended tabs:

- `settings`
- `users`
- `accounts`
- `wallet_denominations`
- `wallet_state`
- `transactions`
- `goals`
- `goal_images`
- `chores`
- `chore_requests`
- `skills`
- `responsibilities`
- `notifications`
- `settlements`
- `audit_log`

### Audit log principle

Do not delete financial history.

Corrections should be recorded as corrective transactions.

The audit log should include timestamp, acting user, child affected, action type, before/after or amount, notes, and source device if available.

---

## 21. Google Apps Script API Actions

Suggested API actions:

- `getInitialUsers`
- `bindDeviceIdentity`
- `resetDeviceIdentity`
- `getChildDashboard`
- `getParentDashboard`
- `recordMonthlyAllowance`
- `runMonthlyAllowanceIfDue`
- `getSavingsBonusPreview`
- `applyQuarterlySavingsBonus`
- `recordGift`
- `recordChoreReward`
- `distributeGrayMoney`
- `createGoal`
- `updateGoal`
- `cancelGoal`
- `completeGoal`
- `uploadGoalImage`
- `archiveGoalImage`
- `redeemSavingsToWallet`
- `recordGiving`
- `recordParentTemporaryPayment`
- `recordSettlement`
- `startPurchaseFlow`
- `recordPurchase`
- `updatePhysicalWallet`
- `sendChoreRequest`
- `acknowledgeChoreRequest`
- `approveChoreCompletion`
- `markParentCompletedChore`
- `getNotifications`
- `markNotificationRead`
- `getHistory`

---

## 22. MVP Scope

MVP includes:

- PWA shell.
- GitHub Pages frontend.
- GAS backend.
- Google Sheets database.
- first-install user selection with parent PIN.
- device identity lock.
- parent mode and child mode.
- parent PIN per parent.
- physical wallet display by denomination stacks.
- savings account.
- giving account.
- gray gift and chore holding accounts.
- monthly automatic allowance.
- quarterly savings bonus preview and application.
- savings goals as visual cards.
- goal image upload to Drive if feasible in MVP.
- purchase helper.
- parent purchase flow and quick update flow.
- giving flow.
- parent temporary payment and physical settlement.
- chore request in-app notifications.
- chore deadlines.
- late/missed chore logic.
- notification archive.
- audit log.

Deferred:

- native app.
- App Store / Google Play.
- real lock-screen push notifications.
- mascot.
- advanced animations.
- public launch.
- JSON export.
- multi-family hosted backend.
- complex investment/interest modeling.
