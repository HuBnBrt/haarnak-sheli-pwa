// ─────────────────────────────────────────────────────────────
// i18n.js — Hebrew UI strings
//
// All child-facing and parent-facing text lives here.
// Gender variants: 'm' = male child, 'f' = female child.
//
// Usage:
//   t('chore.request', { gender: 'f', parent: 'אמא', chore: 'לטאטא' })
//   → "אמא מבקשת שתטאטאי"
// ─────────────────────────────────────────────────────────────

'use strict';

// String templates.
// Use {key} placeholders for dynamic values.
// Arrays of [male, female] for gender variants.
const STRINGS = {

  // ── App ────────────────────────────────────────────────────
  'app.name':              'הארנק שלי',
  'app.loading':           'טוען...',
  'app.error.no_config':   'קובץ הגדרות חסר. אנא בצע את שלבי ההתקנה.',
  'app.error.network':     'אין חיבור לשרת. בדוק את החיבור לאינטרנט.',
  'app.error.generic':     'אירעה שגיאה. נסה שוב.',

  // ── Setup / First Install ──────────────────────────────────
  'setup.who_is_using':    'מי משתמש במכשיר הזה?',
  'setup.choose_user':     'בחר משתמש',
  'setup.enter_pin':       'הכנס קוד הורה לאישור',
  'setup.pin_wrong':       'הקוד שגוי. נסה שוב.',
  'setup.pin_label':       'קוד הורה',
  'setup.confirm':         'אישור',
  'setup.reset_device':    'איפוס מכשיר',
  'setup.reset_confirm':   'לאפס את זהות המכשיר? פעולה זו דורשת קוד הורה.',

  // ── Accounts ───────────────────────────────────────────────
  'account.wallet':        'יש לי בארנק',
  'account.savings':       'אני חוסך: המטרות שלי',
  'account.savings.f':     'אני חוסכת: המטרות שלי',
  'account.giving':        'נתינה - צדק חברתי',
  'account.gifts':         'מתנות',
  'account.gifts.desc':    'כסף שקיבלת במתנה - לחלוקה',
  'account.chores':        'מטלות',
  'account.chores.desc':   'כסף שקיבלת על ביצוע מטלה - לחלוקה',
  'account.giving.desc':   'כסף שבוחרים לתת, לעזור או לשמח איתו מישהו.',

  // ── Savings / Goals ────────────────────────────────────────
  'savings.balance':       'יתרת חיסכון',
  'savings.goals_ready':   ['יש לך כבר {n} מטרות שאפשר לממש!', 'יש לך כבר {n} מטרות שאפשר לממש!'],
  'savings.one_ready':     'יש לך מטרה אחת שאפשר לממש!',
  'savings.bonus_preview': 'בעוד {days} ימים אמא ואבא ישלימו לכאן {amount}',
  'savings.bonus_tomorrow':'מחר אמא ואבא ישלימו לכאן {amount}',
  'savings.bonus_today':   'היום אמא ואבא ישלימו לכאן {amount}!',

  // ── Goal status (child-facing) ─────────────────────────────
  'goal.status.active.m.low':    'אתה בתחילת הדרך',
  'goal.status.active.f.low':    'את בתחילת הדרך',
  'goal.status.active.m.mid':    'אתה כבר מתקרב',
  'goal.status.active.f.mid':    'את כבר מתקרבת',
  'goal.status.active.m.high':   'כמעט הגעת!',
  'goal.status.active.f.high':   'כמעט הגעת!',
  'goal.status.ready':           'אפשר לקנות!',
  'goal.status.completed':       'קניתי!',
  'goal.progress':               '{saved} מתוך {target}',
  'goal.missing':                'חסרים לך עוד {amount}',
  'goal.section.completed':      'דברים שכבר קניתי',

  // ── Sort options ────────────────────────────────────────────
  'sort.by_readiness':     'לפי מימוש',
  'sort.by_closeness':     'לפי קרבה ליעד',
  'sort.by_amount':        'לפי סכום',
  'sort.by_order':         'לפי סדר הוספה',

  // ── Purchase helper ────────────────────────────────────────
  'purchase.price_prompt': 'כמה עולה?',
  'purchase.pay_with':     'איך לשלם:',
  'purchase.change':       'עודף:',
  'purchase.missing':      'חסר:',
  'purchase.enter_change': 'הכנס עודף שקיבלת',
  'purchase.confirm.m':    'הכנס לארנק האמיתי',
  'purchase.confirm.f':    'הכניסי לארנק האמיתי',

  // ── Giving ─────────────────────────────────────────────────
  'giving.balance':        'יתרת נתינה',
  'giving.owe_parent':     'צריך להחזיר לאמאבא',
  'giving.owe_parent.f':   'צריכה להחזיר לאמאבא',

  // ── Chores ─────────────────────────────────────────────────
  'chore.request.m':       '{parent} מבקש שתבצע: {chore}',
  'chore.request.f':       '{parent} מבקשת שתבצעי: {chore}',
  'chore.request.parent.m':'אבא מבקש שתבצע',
  'chore.request.parent.f':'אמא מבקשת שתבצעי',
  'chore.acknowledge':     'קראתי ואבצע עוד מעט',
  'chore.time_left':       'יש לך עוד {time} לביצוע',
  'chore.missed':          'פספסת {amount} כי עדיין לא ביצעת את המטלה',
  'chore.parent_did.m':    'אבא כבר טיפל בזה. הפעם לא הרווחת {amount}.',
  'chore.parent_did.f':    'אמא כבר טיפלה בזה. הפעם לא הרווחת {amount}.',

  // ── Notifications ──────────────────────────────────────────
  'notif.allowance':       'קיבלת דמי כיס החודש!',
  'notif.bonus_soon':      'בעוד {days} ימים יגיע בונוס החיסכון',
  'notif.bonus_applied':   'קיבלת בונוס חיסכון של {amount}!',
  'notif.goal_ready':      'המטרה ״{title}״ מוכנה למימוש!',
  'notif.goal_completed':  '!קנית את ״{title}״ כל הכבוד',
  'notif.gray_reminder':   'יש כסף שמחכה לחלוקה. רוצה לחלק אותו עכשיו?',
  'notif.settlement_due':  'יש החזר שממתין לסגירה',

  // ── Parent mode ────────────────────────────────────────────
  'parent.enter_pin':      'קוד הורה',
  'parent.wrong_pin':      'הקוד שגוי',
  'parent.mode_label':     'מצב הורה',
  'parent.purchase_with_child': 'קנייה עם הילד',
  'parent.purchase_quick': 'עדכון מהיר',

  // ── Common ─────────────────────────────────────────────────
  'common.cancel':         'ביטול',
  'common.confirm':        'אישור',
  'common.save':           'שמור',
  'common.back':           'חזרה',
  'common.loading':        'טוען...',
  'common.error':          'שגיאה',
  'common.success':        'בוצע!',
  'common.balance':        'יתרה',
};

/**
 * Get a translated string, optionally interpolating {key} placeholders.
 *
 * @param {string} key - String key from STRINGS
 * @param {Object} [vars] - Interpolation variables: { gender, n, amount, ... }
 * @returns {string}
 */
function t(key, vars = {}) {
  let str = STRINGS[key];
  if (str === undefined) {
    console.warn(`[i18n] Missing string key: "${key}"`);
    return key;
  }
  // Resolve array [male, female]
  if (Array.isArray(str)) {
    str = (vars.gender === 'f') ? str[1] : str[0];
  }
  // Interpolate {placeholders}
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `{${k}}`
  );
}

/**
 * Apply a gender variant to a key suffix.
 * Looks for key, then key.m / key.f.
 */
function tg(baseKey, gender, vars = {}) {
  const gKey = `${baseKey}.${gender === 'f' ? 'f' : 'm'}`;
  if (STRINGS[gKey] !== undefined) return t(gKey, vars);
  return t(baseKey, { ...vars, gender });
}

window.I18n = { t, tg, STRINGS };
