# Onboarding "Training Days" Revamp — Design

**Date:** 2026-06-24
**Status:** Approved, ready for implementation plan
**Scope:** Replace the onboarding frequency-slider screen with a day-of-week picker, remove the two recommendation progress bars, and add a notifications opt-in checkbox that requests OS permission.

---

## 1. Goal

The `FREQUENCY` onboarding step currently asks "Kolikrát týdně chceš cvičit?" with a 1–7 slider plus two animated "recommendation" progress bars (habit / progress). Replace it with:

1. A **day-of-week picker** — the user selects *which* days they want to train (Po–Ne).
2. **Remove** the two recommendation progress bars.
3. Add a **notifications checkbox** ("Připomínat mi tréninkové dny") that, when checked, requests the OS notification permission.

The step keeps its position and enum slot in the flow. The derived weekly frequency (= number of selected days) continues to feed the existing plan-loading summary and backend column.

## 2. Affected files

| File | Change |
|------|--------|
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/OnboardingData.kt` | Add `trainingDays`, `notificationsEnabled`; make `frequencyPerWeek` derived |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingIntent.kt` | Remove `SetFrequency`; add `ToggleTrainingDay`, `SetNotificationsEnabled` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModel.kt` | Handle new intents; drop `SetFrequency` branch |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/screens/FrequencyStep.kt` | Rewrite to day picker + checkbox |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/FrequencySlider.kt` | **Delete** |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/WeekdayPicker.kt` | **New** |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | **New** (`expect`) |
| `composeApp/src/androidMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | **New** (`actual`) |
| `composeApp/src/iosMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | **New** (`actual`) |
| `composeApp/src/androidMain/AndroidManifest.xml` | Add `POST_NOTIFICATIONS` permission |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OnboardingResponseDto.kt` | Add `training_days`, `notifications_enabled` |
| `composeApp/src/commonMain/composeResources/values/strings.xml` | Repurpose/add/remove strings (see §8) |
| `supabase/migrations/<timestamp>_onboarding_training_days.sql` | **New** migration |
| `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt` | Update frequency tests → day/notification tests |

`PlanLoadingStep.kt` needs **no change** — it reads `state.data.frequencyPerWeek`, which stays valid as a derived value.

## 3. Domain model — `OnboardingData.kt`

Use `kotlinx.datetime.DayOfWeek` (already a project dependency).

```kotlin
import kotlinx.datetime.DayOfWeek

data class OnboardingData(
    // ... existing fields, but REMOVE the stored `frequencyPerWeek` ...
    val focusAreas: Set<MuscleGroup> = emptySet(),
    val trainingDays: Set<DayOfWeek> = setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY),
    val notificationsEnabled: Boolean = false,
    val equipment: Equipment? = null,
    // ... rest unchanged ...
) {
    /** Weekly training frequency, derived from the selected days. */
    val frequencyPerWeek: Int get() = trainingDays.size

    // bmi / bmiCategory unchanged
}
```

Rationale for deriving `frequencyPerWeek`: it removes a redundant source of truth, and every existing consumer (`PlanLoadingStep`, `OnboardingResponseDto.fromDomain`) keeps compiling unchanged.

## 4. Intents — `OnboardingIntent.kt`

```kotlin
import kotlinx.datetime.DayOfWeek

// REMOVE: data class SetFrequency(val days: Int) : OnboardingIntent
data class ToggleTrainingDay(val day: DayOfWeek) : OnboardingIntent
data class SetNotificationsEnabled(val enabled: Boolean) : OnboardingIntent
```

## 5. ViewModel — `OnboardingViewModel.kt`

Replace the `SetFrequency` branch in `onIntent`:

```kotlin
is OnboardingIntent.ToggleTrainingDay -> updateData {
    val updated = trainingDays.toMutableSet()
    if (!updated.add(intent.day)) updated.remove(intent.day)
    copy(trainingDays = updated)
}
is OnboardingIntent.SetNotificationsEnabled -> updateData { copy(notificationsEnabled = intent.enabled) }
```

## 6. UI

### 6.1 `WeekdayPicker.kt` (new component)

A row of 7 equal-width toggle chips, Monday-first, plus the live count caption. Chip styling mirrors `SelectableChip` (filled `primary` when selected, outlined `surface` otherwise, `RectangleShape`).

```kotlin
package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.datetime.DayOfWeek

@Composable
fun WeekdayPicker(
    selected: Set<DayOfWeek>,
    dayLabels: List<Pair<DayOfWeek, String>>, // ordered Monday..Sunday, label resolved by caller
    onToggle: (DayOfWeek) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        dayLabels.forEach { (day, label) ->
            val isSel = day in selected
            val bg = if (isSel) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
            val fg = if (isSel) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onBackground
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = fg,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .weight(1f)
                    .background(bg, RectangleShape)
                    .border(1.dp, MaterialTheme.colorScheme.outline, RectangleShape)
                    .clickable { onToggle(day) }
                    .padding(vertical = 14.dp)
            )
        }
    }
}
```

### 6.2 `FrequencyStep.kt` (rewrite)

Layout (top→bottom): title, subtitle, weekday picker, count caption, notifications checkbox row, spacer, Continue.

Behavior:
- `dayLabels` built in order Monday→Sunday from string resources (§8).
- Count caption uses `pluralStringResource(Res.plurals.ob_days_count, freq, freq)` where `freq = state.data.frequencyPerWeek`.
- **Continue disabled** when `state.data.trainingDays.isEmpty()` (pass `enabled = ...` to `CoachButton`; if `CoachButton` lacks an `enabled` param, add one defaulting to `true`).
- Notifications checkbox:
  - Obtain `val permissionRequester = rememberNotificationPermissionRequester()` (§7).
  - `Checkbox(checked = state.data.notificationsEnabled, onCheckedChange = { wantOn -> ... })`.
  - When `wantOn == true`: `permissionRequester.request { granted -> onIntent(OnboardingIntent.SetNotificationsEnabled(granted)) }`.
  - When `wantOn == false`: `onIntent(OnboardingIntent.SetNotificationsEnabled(false))` (no OS call).
  - Wrap the `Checkbox` + label `Text` in a `Row(verticalAlignment = Alignment.CenterVertically)`; make the whole row clickable to toggle for a larger touch target.

### 6.3 Permission UX note

The requester returns the granted result asynchronously. The checkbox reflects `notificationsEnabled`, which is only set `true` after the OS grants permission — so a denied prompt leaves the box unchecked, which is the correct, honest state.

## 7. OS notification permission (`expect`/`actual`)

Mirror the `OnboardingBackHandler` expect/actual Composable pattern.

### 7.1 commonMain — `ui/onboarding/NotificationPermission.kt`

```kotlin
package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.Composable

/** Requests the OS notification permission. [onResult] receives whether it is (now) granted. */
fun interface NotificationPermissionRequester {
    fun request(onResult: (Boolean) -> Unit)
}

@Composable
expect fun rememberNotificationPermissionRequester(): NotificationPermissionRequester
```

### 7.2 androidMain — `ui/onboarding/NotificationPermission.kt`

The `pending` callback must survive recomposition between `request()` and the launcher result, so it lives in a `remember`-backed holder shared by both the launcher callback and the requester lambda:

```kotlin
package com.coachfoska.app.ui.onboarding

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

@Composable
actual fun rememberNotificationPermissionRequester(): NotificationPermissionRequester {
    // Single mutable slot shared between the launcher result and the request() call.
    val pending = remember { arrayOfNulls<(Boolean) -> Unit>(1) }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        pending[0]?.invoke(granted)
        pending[0] = null
    }
    return remember(launcher) {
        NotificationPermissionRequester { onResult ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                onResult(true) // No runtime notification permission below API 33.
            } else {
                pending[0] = onResult
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}
```

### 7.3 iosMain — `ui/onboarding/NotificationPermission.kt`

```kotlin
package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import kotlinx.cinterop.ExperimentalForeignApi
import platform.UserNotifications.UNAuthorizationOptionAlert
import platform.UserNotifications.UNAuthorizationOptionBadge
import platform.UserNotifications.UNAuthorizationOptionSound
import platform.UserNotifications.UNUserNotificationCenter
import platform.darwin.dispatch_async
import platform.darwin.dispatch_get_main_queue

@OptIn(ExperimentalForeignApi::class)
@Composable
actual fun rememberNotificationPermissionRequester(): NotificationPermissionRequester = remember {
    NotificationPermissionRequester { onResult ->
        val options = UNAuthorizationOptionAlert or UNAuthorizationOptionBadge or UNAuthorizationOptionSound
        UNUserNotificationCenter.currentNotificationCenter()
            .requestAuthorizationWithOptions(options) { granted, _ ->
                dispatch_async(dispatch_get_main_queue()) { onResult(granted) }
            }
    }
}
```

### 7.4 AndroidManifest.xml

Add alongside the existing `<uses-permission>` entries:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## 8. Strings — `composeResources/values/strings.xml`

**Repurpose:**
- `ob_frequency_title` → `Které dny chceš trénovat?`
- `ob_frequency_subtitle` → `Vyber dny, kdy se ti hodí cvičit.`

**Add (weekday abbreviations, Monday→Sunday):**
```xml
<string name="ob_day_mon">Po</string>
<string name="ob_day_tue">Út</string>
<string name="ob_day_wed">St</string>
<string name="ob_day_thu">Čt</string>
<string name="ob_day_fri">Pá</string>
<string name="ob_day_sat">So</string>
<string name="ob_day_sun">Ne</string>
<string name="ob_days_notify">Připomínat mi tréninkové dny</string>
```

**Add plural** (`<plurals>` — Compose Multiplatform supports `pluralStringResource`; Czech categories one/few/many/other):
```xml
<plurals name="ob_days_count">
    <item quantity="one">%d den v týdnu</item>
    <item quantity="few">%d dny v týdnu</item>
    <item quantity="many">%d dní v týdnu</item>
    <item quantity="other">%d dní v týdnu</item>
</plurals>
```
> If `<plurals>` is not yet used anywhere in the project, verify Compose Resources plural support builds; otherwise fall back to a `when (freq)` expression in `FrequencyStep` selecting between `ob_days_count_one` / `_few` / `_many` string resources. Czech rule: 1 → "den", 2–4 → "dny", 0 and 5+ → "dní".

**Remove (now unused):** `ob_frequency_1`, `ob_frequency_2`, `ob_frequency_recommended`, `ob_frequency_5`, `ob_frequency_6`, `ob_frequency_7`, `ob_frequency_days`, `ob_frequency_habit`, `ob_frequency_progress`.

## 9. Persistence

### 9.1 `OnboardingResponseDto.kt`

Add fields:
```kotlin
@SerialName("training_days") val trainingDays: List<String> = emptyList(),
@SerialName("notifications_enabled") val notificationsEnabled: Boolean = false,
```
In `fromDomain`, after `focusAreas`:
```kotlin
trainingDays = data.trainingDays.map { it.name.lowercase() }, // "monday", "wednesday", ...
notificationsEnabled = data.notificationsEnabled,
```
Keep `frequencyPerWeek = data.frequencyPerWeek` (now derived = `trainingDays.size`).

### 9.2 Migration — `supabase/migrations/<timestamp>_onboarding_training_days.sql`

Use a timestamp later than the existing onboarding migration (`20260614211749`). Example name: `20260624120000_onboarding_training_days.sql`.

```sql
-- Add per-day training selection and notification opt-in to onboarding responses.
ALTER TABLE onboarding_responses
  ADD COLUMN training_days        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT false;
```

No RLS changes needed — the existing `FOR ALL` / admin-read policies already cover new columns.

## 10. Tests

`OnboardingViewModelTest.kt`:
- Remove any test that calls `OnboardingIntent.SetFrequency`.
- Add: `ToggleTrainingDay` adds a day when absent and removes it when present; `frequencyPerWeek` equals `trainingDays.size`.
- Add: `SetNotificationsEnabled(true)` / `(false)` updates `notificationsEnabled`.
- Verify default `trainingDays` = {MONDAY, WEDNESDAY, FRIDAY} and default `frequencyPerWeek` == 3.

If a DTO mapping test exists (search `OnboardingResponseDto` under `androidUnitTest`), extend it to assert `training_days` and `notifications_enabled` serialize correctly; otherwise no new DTO test is required.

## 11. Out of scope (YAGNI)

- Scheduling actual training-day reminders / wiring into `WaterReminderScheduler` or WorkManager — the checkbox only records the preference and requests permission. Scheduling is a separate future feature.
- Changing `PlanLoadingStep` to display individual days.
- Backfilling `training_days` for existing rows (table is effectively empty / new feature).
- A standalone settings toggle mirroring this choice (the profile screen already has its own notifications toggle).

## 12. Verification

- `./gradlew :composeApp:compileDebugKotlinAndroid` (or the project's standard compile task) succeeds.
- `./gradlew :composeApp:testDebugUnitTest` (onboarding tests) pass.
- Manual: onboarding FREQUENCY step shows 7 day chips, count caption updates, two old progress bars gone, checkbox triggers the OS permission dialog on Android 13+.
