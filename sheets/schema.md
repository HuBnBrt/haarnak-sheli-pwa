# הארנק שלי — Google Sheets Schema

> All money values are stored as **integer agorot**. 1 ₪ = 100 agorot. No decimal values.

---

## settings

| Column | Type | Example |
|---|---|---|
| key | string | `monthly_allowance_total_agorot` |
| value | string/number | `2000` |
| description | string | `Monthly allowance per child in agorot` |

**Default keys:**

| Key | Default | Meaning |
|---|---|---|
| monthly_allowance_total_agorot | 2000 | 20 ₪ total per child per month |
| savings_split_agorot | 1500 | 15 ₪ → savings monthly |
| giving_split_agorot | 500 | 5 ₪ → giving monthly |
| bonus_rate_pct | 50 | Quarterly bonus = 50% of savings balance |
| bonus_months | 1,4,7,10 | January, April, July, October |
| bonus_day | 1 | Day of month for bonus |
| late_chore_reward_pct | 50 | 50% reward if chore is late |
| missed_visibility_days | 7 | Missed chore messages stay 7 days |
| gray_money_reminder_days | 14 | Remind after 14 days of unallocated gray money |
| gray_bonus_warning_days | 5 | Warn 5 days before bonus if gray money exists |
| redemption_increment_agorot | 1000 | Savings→wallet in 10 ₪ (1000 agorot) steps |
| app_name | הארנק שלי | Display name |

---

## users

| Column | Type | Notes |
|---|---|---|
| user_id | string | e.g., `u_child1` |
| display_name | string | Hebrew display name — edit privately in Sheet |
| role_key | string | `child1`, `child2`, `parent1`, `parent2` |
| user_type | string | `child` or `parent` |
| gender | string | `m` or `f` — used for gender-aware Hebrew copy |
| pin_hash | string | SHA-256 hash of parent PIN. Empty for children. |
| active | boolean | `TRUE` or `FALSE` |
| theme_palette | string | `ים וגיבור`, `חלל סגול`, `אש ושמש`, `יער ונענע` |
| created_at | ISO timestamp | |

---

## accounts

One row per (child × account_type). Physical wallet is not here — derived from `wallet_denominations`.

| Column | Type | Notes |
|---|---|---|
| account_id | string | e.g., `u_child1_savings` |
| user_id | string | Child's user_id |
| account_type | string | `savings`, `giving`, `gifts`, `chores` |
| balance_agorot | integer | Current balance in agorot |
| last_updated | ISO timestamp | |

---

## wallet_denominations

One row per (child × denomination). Denomination stored as agorot.

| Column | Type | Notes |
|---|---|---|
| user_id | string | Child's user_id |
| denomination_agorot | integer | e.g., `1000` = 10 ₪ coin |
| count | integer | How many of this denomination the child has |
| last_updated | ISO timestamp | |

**Denomination reference:**

| denomination_agorot | Display |
|---|---|
| 20000 | 200 ₪ |
| 10000 | 100 ₪ |
| 5000 | 50 ₪ |
| 2000 | 20 ₪ |
| 1000 | 10 ₪ |
| 500 | 5 ₪ |
| 200 | 2 ₪ |
| 100 | 1 ₪ |
| 50 | 50 אג׳ |
| 10 | 10 אג׳ |

---

## transactions

| Column | Type | Notes |
|---|---|---|
| tx_id | string | Unique ID |
| timestamp | ISO timestamp | |
| user_id | string | Child the transaction belongs to |
| from_account | string | `savings`, `giving`, `gifts`, `chores`, `wallet`, `external` |
| to_account | string | Same options |
| amount_agorot | integer | Amount in agorot |
| type | string | `allowance`, `bonus`, `gift`, `chore_reward`, `giving`, `giving_advance`, `purchase`, `redemption_to_wallet`, `settlement`, `parent_payment`, `distribution`, `correction` |
| description | string | Hebrew description |
| initiated_by | string | user_id of who initiated |
| parent_id | string | user_id of approving parent (if applicable) |
| device_id | string | Device identifier |
| notes | string | Optional notes |

---

## goals

| Column | Type | Notes |
|---|---|---|
| goal_id | string | |
| user_id | string | Child's user_id |
| title | string | Hebrew goal title |
| target_amount_agorot | integer | Goal price in agorot |
| image_drive_id | string | Google Drive file ID (Phase 9) |
| status | string | `active`, `ready`, `completed`, `cancelled` |
| sort_order | integer | Manual sort position |
| created_at | ISO timestamp | |
| completed_at | ISO timestamp | |
| cancelled_at | ISO timestamp | |
| notes | string | |

---

## goal_images

Phase 9 — schema ready, no data until image upload is implemented.

| Column | Type | Notes |
|---|---|---|
| image_id | string | |
| goal_id | string | |
| user_id | string | |
| drive_file_id | string | Google Drive file ID |
| drive_folder_id | string | Drive folder containing the image |
| status | string | `active`, `archived` |
| uploaded_at | ISO timestamp | |
| archived_at | ISO timestamp | |

---

## chores

| Column | Type | Notes |
|---|---|---|
| chore_id | string | |
| title | string | Hebrew chore name |
| suggested_reward_agorot | integer | Suggested reward in agorot |
| time_limit_value | integer | e.g., `24` |
| time_limit_unit | string | `hours`, `days` |
| late_reward_pct | integer | % of reward if completed late |
| category | string | `light`, `medium`, `heavy` |
| active | boolean | Whether available to assign |
| created_at | ISO timestamp | |

---

## chore_requests

| Column | Type | Notes |
|---|---|---|
| request_id | string | |
| chore_id | string | |
| user_id | string | Child assigned |
| chore_title | string | Snapshot of title at request time |
| reward_amount_agorot | integer | Agreed reward in agorot |
| requested_by | string | Parent's user_id |
| requested_at | ISO timestamp | |
| deadline_at | ISO timestamp | |
| acknowledged_at | ISO timestamp | When child tapped "קראתי ואבצע עוד מעט" |
| completed_at | ISO timestamp | |
| completed_by | string | user_id of who marked it done |
| status | string | `pending`, `acknowledged`, `completed_on_time`, `completed_late`, `missed`, `parent_completed` |
| notes | string | |

---

## notifications

| Column | Type | Notes |
|---|---|---|
| notif_id | string | |
| user_id | string | Recipient |
| type | string | `allowance`, `bonus_soon`, `bonus_applied`, `goal_ready`, `goal_completed`, `chore_requested`, `chore_reward`, `chore_missed`, `parent_completed_chore`, `gray_reminder`, `settlement_due` |
| title | string | Short Hebrew title |
| body | string | Full Hebrew message |
| status | string | `unread`, `read`, `active`, `expired`, `archived` |
| created_at | ISO timestamp | |
| read_at | ISO timestamp | |
| expires_at | ISO timestamp | After this, status → `archived` |
| related_id | string | e.g., chore request ID or goal ID |
| related_type | string | e.g., `chore_request`, `goal` |

---

## settlements

| Column | Type | Notes |
|---|---|---|
| settlement_id | string | |
| user_id | string | Child's user_id |
| total_amount_agorot | integer | Total owed in agorot |
| type | string | `parent_payment`, `giving_advance` |
| parent_id | string | Parent who paid |
| created_at | ISO timestamp | |
| settled_amount_agorot | integer | Amount settled so far |
| settled_at | ISO timestamp | When fully settled |
| status | string | `pending`, `partial`, `settled` |
| notes | string | |

---

## audit_log

> Never delete rows. Corrections are new rows with `action_type = 'correction'`.

| Column | Type | Notes |
|---|---|---|
| log_id | string | |
| timestamp | ISO timestamp | |
| acting_user_id | string | Parent or system who performed the action |
| child_user_id | string | Child whose account was affected |
| action_type | string | e.g., `allowance`, `bonus`, `purchase`, `gift`, `correction` |
| account_affected | string | `savings`, `giving`, `gifts`, `chores`, `wallet` |
| amount_before_agorot | integer | |
| amount_after_agorot | integer | |
| amount_delta_agorot | integer | after − before |
| notes | string | |
| device_id | string | |
| source | string | `child`, `parent`, `system` |

---

## skills / responsibilities

Future tabs. Currently contain only a placeholder comment row.
Column definitions TBD when feature is designed.
