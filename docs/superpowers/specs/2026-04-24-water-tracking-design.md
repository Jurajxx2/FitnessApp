# Water Tracking & Reminders — Design Spec

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Add daily water intake tracking and configurable local reminders to Coach Foska. Water is stored in Supabase (synced, survives reinstall). Reminders are delivered via local notifications (WorkManager on Android, `UNUserNotificationCenter` on iOS), with the scheduler interface designed for future migration to server-side push once Firebase is wired.

---

## Data Model

### `water_logs` table
```sql
CREATE TABLE water_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_ml   INTEGER NOT NULL,
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own water logs"
    ON water_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_water_logs_user_date ON water_logs(user_id, logged_at DESC);
```

### `hydration_settings` table
```sql
CREATE TABLE hydration_settings (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    interval_minutes  INTEGER NOT NULL DEFAULT 120,
    start_hour        INTEGER NOT NULL DEFAULT 7,   -- 0–23
    end_hour          INTEGER NOT NULL DEFAULT 22,  -- 0–23
    smart_suppress    BOOLEAN NOT NULL DEFAULT TRUE,
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hydration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hydration settings"
    ON hydration_settings FOR ALL USING (auth.uid() = user_id);
```

One row per user; created via upsert on first `HydrationViewModel` init with defaults.

---

## Goal Calculation

Calculated in the domain layer from existing `profiles` fields — no new DB column needed.

```
base_ml = weight_kg × 35
multiplier:
  sedentary          → 1.0
  lightly_active     → 1.1
  moderately_active  → 1.2
  active             → 1.3
  very_active        → 1.4

daily_goal_ml = round(base_ml × multiplier)
```

`CalculateWaterGoalUseCase` takes a `Profile` and returns `Int`. Falls back to `2_000` ml if `weight_kg` or `activity_level` is missing, and surfaces a nudge to complete the profile.

---

## Architecture

Follows the existing Clean Architecture pattern.

### Domain layer (`commonMain`)

| Type | Name | Purpose |
|------|------|---------|
| Model | `WaterLog` | `id`, `amountMl`, `loggedAt` |
| Model | `HydrationSettings` | mirrors the DB table |
| Interface | `HydrationRepository` | `logWater(amountMl)`, `getTodayLogs()`, `getSettings()`, `saveSettings(settings)`, `deleteLog(id)` |
| UseCase | `CalculateWaterGoalUseCase` | `Profile → Int` |
| expect class | `WaterReminderScheduler` | `schedule(settings, goalMl)`, `cancel()` |

### Data layer (`commonMain`)

- `HydrationRemoteDataSource` — Supabase Postgrest calls for both tables
- `HydrationRepositoryImpl` — delegates to data source

### Data layer (platform)

- `AndroidWaterReminderScheduler` (`androidMain`) — WorkManager `PeriodicWorkRequest`
- `IosWaterReminderScheduler` (`iosMain`) — `UNUserNotificationCenter` repeating trigger

### Presentation layer (`commonMain`)

- `HydrationViewModel` — MVI pattern
- `HydrationState`: `todayLogs`, `goalMl`, `consumedMl`, `settings`, `isLoading`, `error`
- `HydrationIntent`: `LogWater(amountMl)`, `UpdateSettings(settings)`, `DeleteLog(id)`

### DI

New `hydrationModule` in Koin providing: data source, repository, use case, and platform scheduler via `expect`/`actual`.

---

## UI

### Entry point 1 — Home screen

A water progress bar appended inside the existing Daily Nutrition card, below the macros row, separated by a subtle divider:

```
💧 WATER                              1 750 / 2 625 ml
[████████████████████░░░░░░░░░░░░]  67%
```

Tapping the bar navigates to `HydrationScreen`. No new Home section.

### Entry point 2 — Nutrition Hub

A third card added to the bottom row alongside History and Recipes:

```
[History]  [Recipes]  [Water 67%]
```

The Water card shows eyebrow "TRACK", title "Water", and a mini circular progress indicator. Tapping navigates to `HydrationScreen`.

### HydrationScreen (new route: `@Serializable object Hydration`)

Sections top to bottom:

1. **Progress ring** — circular arc (160 dp), centre shows `consumed ml / goal ml` and percentage. Subtitle shows ml remaining.
2. **Quick-add buttons** — four chips: 150 ml, 250 ml (default, highlighted), 500 ml, + custom. Custom opens a number input dialog.
3. **Today's log** — list of `WaterLog` entries showing amount and time. Swipe-to-delete supported.
4. **Reminders section** — four rows:
   - Enable reminders (toggle)
   - Remind every (picker: 30 min / 1 h / 2 h / 3 h / 4 h)
   - Active hours (time range picker: start hour → end hour)
   - Smart suppress (toggle with subtitle "Skip if goal reached or recently logged")

---

## Reminder System

### Android (`WorkManager`)

- `PeriodicWorkRequest` with `repeatInterval = settings.intervalMinutes`
- Worker checks at runtime:
  1. Current hour within `[startHour, endHour]` — if not, skip silently
  2. If `smartSuppress`: fetch today's consumed total; if ≥ `goalMl`, skip
  3. If `smartSuppress`: check last log timestamp; if within `intervalMinutes / 2`, skip
  4. Otherwise: post local notification via `NotificationCompat`
- Rescheduled whenever `HydrationSettings` changes (cancel + reschedule)

### iOS (`UNUserNotificationCenter`)

- Repeating `UNTimeIntervalNotificationTrigger` at `intervalMinutes * 60` seconds
- Active-hours enforcement: add `UNCalendarNotificationTrigger` entries for each interval slot within `[startHour, endHour]` instead of a single repeating trigger
- Smart suppression: `UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:)` silently discards the notification when the app is foregrounded and the goal is already met. Background suppression is best-effort on iOS.
- Rescheduled on settings change (remove pending requests + re-add)

### Push migration path

`WaterReminderScheduler.cancel()` is called on both platforms once server-side FCM/APNs push is active. `hydration_settings` is already in Supabase so the server reads preferences without schema changes.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Network failure on log | UI updates state immediately (optimistic); snackbar shown on failure with a Retry action; no persisted retry queue |
| Profile missing weight/activity | Goal defaults to 2 000 ml; nudge shown to complete profile |
| Notification permission denied | Reminders toggle shows disabled state with "Grant permission" link to system settings |
| No `hydration_settings` row | Upserted with defaults on `HydrationViewModel` init; transparent to user |
| `loggedAt` timezone edge (midnight) | All queries use `DATE(logged_at AT TIME ZONE user_tz)` — user timezone read from device |
