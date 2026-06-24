# Onboarding Training-Days Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the onboarding frequency slider with a day-of-week picker, remove the two recommendation progress bars, and add a notifications checkbox that requests OS permission.

**Architecture:** The `FREQUENCY` onboarding step keeps its position but swaps content. `OnboardingData.frequencyPerWeek` becomes a value derived from a new `trainingDays: Set<DayOfWeek>`, so existing consumers (plan-loading summary, DTO) keep working. A new `expect`/`actual` Composable requests the OS notification permission, mirroring the existing `OnboardingBackHandler` pattern. New columns persist the selected days and notification opt-in.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform, kotlinx.datetime (`DayOfWeek`), Koin, Supabase Postgrest, MockK + kotlin.test.

**Spec:** `docs/superpowers/specs/2026-06-24-onboarding-training-days-design.md`

**Build/test commands (project standard — all `./gradlew` pre-approved):**
- Android unit tests: `./gradlew :composeApp:testDebugUnitTest`
- Android compile (commonMain + androidMain): `./gradlew :composeApp:compileDebugKotlinAndroid`

**Sequencing note:** Tasks 1–3 add independent new code/files and keep the build green. Task 4 is the atomic "cutover" that flips the intent/data API and UI; the build is only expected to be green again at the end of Task 4. Execute Task 4's steps in order without committing partway.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/WeekdayPicker.kt` | New stateless 7-day toggle chip row | 1 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | `expect` permission requester + fun-interface | 2 |
| `composeApp/src/androidMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | Android `actual` (`POST_NOTIFICATIONS`) | 2 |
| `composeApp/src/iosMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt` | iOS `actual` (`UNUserNotificationCenter`) | 2 |
| `composeApp/src/androidMain/AndroidManifest.xml` | Declare `POST_NOTIFICATIONS` | 2 |
| `supabase/migrations/20260624120000_onboarding_training_days.sql` | New columns | 3 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/OnboardingData.kt` | Add `trainingDays`/`notificationsEnabled`, derive `frequencyPerWeek` | 4 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingIntent.kt` | Swap `SetFrequency` → `ToggleTrainingDay`/`SetNotificationsEnabled` | 4 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModel.kt` | Handle new intents | 4 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OnboardingResponseDto.kt` | Persist `training_days`/`notifications_enabled` | 4 |
| `composeApp/src/commonMain/composeResources/values/strings.xml` | Repurpose/add/remove strings | 4 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/screens/FrequencyStep.kt` | Rewrite to day picker + checkbox | 4 |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/FrequencySlider.kt` | **Delete** | 4 |
| `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt` | Update tests | 4 |

---

## Task 1: WeekdayPicker component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/WeekdayPicker.kt`

This is a stateless presentational component (no unit test — it has no logic; it is verified by compilation and the manual check in Task 4).

- [ ] **Step 1: Create the component**

```kotlin
package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.datetime.DayOfWeek

/**
 * A row of 7 equal-width toggle chips (Monday..Sunday). [dayLabels] must be ordered
 * Monday-first; the caller resolves the short labels from string resources.
 */
@Composable
fun WeekdayPicker(
    selected: Set<DayOfWeek>,
    dayLabels: List<Pair<DayOfWeek, String>>,
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

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL (the file compiles; nothing references it yet).

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/WeekdayPicker.kt
git commit -m "feat(onboarding): add WeekdayPicker component"
```

---

## Task 2: Notification permission (expect/actual) + manifest

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt`
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt`
- Create: `composeApp/src/iosMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt`
- Modify: `composeApp/src/androidMain/AndroidManifest.xml`

- [ ] **Step 1: Create the commonMain `expect`**

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

- [ ] **Step 2: Create the Android `actual`**

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
    // Single mutable slot shared between the launcher result and the request() call,
    // so the callback survives recomposition.
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

- [ ] **Step 3: Create the iOS `actual`**

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

- [ ] **Step 4: Add the manifest permission**

In `composeApp/src/androidMain/AndroidManifest.xml`, add this line directly after the existing `<uses-permission android:name="android.permission.CAMERA" />` line:

```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 5: Compile Android**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL (expect + Android actual compile; nothing references them yet).

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/ui/onboarding/NotificationPermission.kt \
        composeApp/src/androidMain/AndroidManifest.xml
git commit -m "feat(onboarding): add notification-permission requester (expect/actual)"
```

---

## Task 3: Supabase migration

**Files:**
- Create: `supabase/migrations/20260624120000_onboarding_training_days.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Add per-day training selection and notification opt-in to onboarding responses.
ALTER TABLE onboarding_responses
  ADD COLUMN training_days         TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260624120000_onboarding_training_days.sql
git commit -m "feat(db): add training_days and notifications_enabled to onboarding_responses"
```

> The migration is applied to Supabase via the project's normal migration workflow (e.g. `supabase db push`); this plan does not run it. The new columns have safe defaults so existing rows are unaffected.

---

## Task 4: Cutover — data, intents, viewmodel, DTO, strings, screen, tests

This task flips the API atomically. Do all steps before compiling/committing. TDD: update the unit tests first (red), implement, then green.

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/OnboardingData.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OnboardingResponseDto.kt`
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/screens/FrequencyStep.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/FrequencySlider.kt`

- [ ] **Step 1: Update the unit tests (red)**

In `OnboardingViewModelTest.kt`:

(a) Add imports near the other domain imports:
```kotlin
import kotlinx.datetime.DayOfWeek
```

(b) In the test `selection intents update the matching field`, **remove** this line:
```kotlin
        vm.onIntent(OnboardingIntent.SetFrequency(5))
```
and **remove** its assertion:
```kotlin
        assertEquals(5, d.frequencyPerWeek)
```

(c) Add these three new tests inside the class (e.g. after `selecting all individual areas implies FULL_BODY`):
```kotlin
    @Test
    fun `default training days are Mon Wed Fri and frequency is three`() {
        val d = OnboardingData()
        assertEquals(setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), d.trainingDays)
        assertEquals(3, d.frequencyPerWeek)
    }

    @Test
    fun `toggling a training day adds it then removes it and frequency tracks the count`() {
        val vm = viewModel()
        // Tuesday not in default set -> adding it makes 4 days.
        vm.onIntent(OnboardingIntent.ToggleTrainingDay(DayOfWeek.TUESDAY))
        assertTrue(vm.state.value.data.trainingDays.contains(DayOfWeek.TUESDAY))
        assertEquals(4, vm.state.value.data.frequencyPerWeek)
        // Toggling again removes it -> back to 3.
        vm.onIntent(OnboardingIntent.ToggleTrainingDay(DayOfWeek.TUESDAY))
        assertFalse(vm.state.value.data.trainingDays.contains(DayOfWeek.TUESDAY))
        assertEquals(3, vm.state.value.data.frequencyPerWeek)
    }

    @Test
    fun `setting notifications enabled updates the flag`() {
        val vm = viewModel()
        assertFalse(vm.state.value.data.notificationsEnabled)
        vm.onIntent(OnboardingIntent.SetNotificationsEnabled(true))
        assertTrue(vm.state.value.data.notificationsEnabled)
        vm.onIntent(OnboardingIntent.SetNotificationsEnabled(false))
        assertFalse(vm.state.value.data.notificationsEnabled)
    }
```

- [ ] **Step 2: Update `OnboardingData.kt`**

Add the import at the top (after `package`):
```kotlin
import kotlinx.datetime.DayOfWeek
```

Replace the line:
```kotlin
    val frequencyPerWeek: Int = 3,
```
with:
```kotlin
    val trainingDays: Set<DayOfWeek> = setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY),
    val notificationsEnabled: Boolean = false,
```

Then add the derived property inside the class body, directly above the existing `val bmi: Float` declaration:
```kotlin
    /** Weekly training frequency, derived from the selected days. */
    val frequencyPerWeek: Int get() = trainingDays.size

```

- [ ] **Step 3: Update `OnboardingIntent.kt`**

Add the import (after the existing domain-model imports):
```kotlin
import kotlinx.datetime.DayOfWeek
```

Remove the line:
```kotlin
    data class SetFrequency(val days: Int) : OnboardingIntent
```
and replace it with:
```kotlin
    data class ToggleTrainingDay(val day: DayOfWeek) : OnboardingIntent
    data class SetNotificationsEnabled(val enabled: Boolean) : OnboardingIntent
```

- [ ] **Step 4: Update `OnboardingViewModel.kt`**

Replace the line:
```kotlin
            is OnboardingIntent.SetFrequency -> updateData { copy(frequencyPerWeek = intent.days) }
```
with:
```kotlin
            is OnboardingIntent.ToggleTrainingDay -> updateData {
                val updated = trainingDays.toMutableSet()
                if (!updated.add(intent.day)) updated.remove(intent.day)
                copy(trainingDays = updated)
            }
            is OnboardingIntent.SetNotificationsEnabled -> updateData { copy(notificationsEnabled = intent.enabled) }
```

- [ ] **Step 5: Update `OnboardingResponseDto.kt`**

Add the two fields. After the line:
```kotlin
    @SerialName("focus_areas") val focusAreas: List<String> = emptyList(),
```
add:
```kotlin
    @SerialName("training_days") val trainingDays: List<String> = emptyList(),
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = false,
```

In `fromDomain`, after the line:
```kotlin
                focusAreas = data.focusAreas.map { it.name.lowercase() },
```
add:
```kotlin
                trainingDays = data.trainingDays.map { it.name.lowercase() },
                notificationsEnabled = data.notificationsEnabled,
```
Leave `frequencyPerWeek = data.frequencyPerWeek,` unchanged (it now reads the derived value).

- [ ] **Step 6: Update `strings.xml`**

In `composeApp/src/commonMain/composeResources/values/strings.xml`:

(a) Replace the two existing lines:
```xml
    <string name="ob_frequency_title">Kolikrát týdně chceš cvičit?</string>
    <string name="ob_frequency_subtitle">Doporučíme ideální rozložení tréninků.</string>
```
with:
```xml
    <string name="ob_frequency_title">Které dny chceš trénovat?</string>
    <string name="ob_frequency_subtitle">Vyber dny, kdy se ti hodí cvičit.</string>
```

(b) **Delete** these now-unused lines:
```xml
    <string name="ob_frequency_1">Dobrý začátek</string>
    <string name="ob_frequency_2">Slibné</string>
    <string name="ob_frequency_recommended">Doporučeno</string>
    <string name="ob_frequency_5">Odhodlaný</string>
    <string name="ob_frequency_6">Impozantní</string>
    <string name="ob_frequency_7">Nezastavitelný</string>
    <string name="ob_frequency_days">dní v týdnu</string>
    <string name="ob_frequency_habit">Tvorba návyku</string>
    <string name="ob_frequency_progress">Progres</string>
```

(c) Add these lines where the deleted block was (Czech weekday abbreviations, count variants, and the notify label):
```xml
    <string name="ob_day_mon">Po</string>
    <string name="ob_day_tue">Út</string>
    <string name="ob_day_wed">St</string>
    <string name="ob_day_thu">Čt</string>
    <string name="ob_day_fri">Pá</string>
    <string name="ob_day_sat">So</string>
    <string name="ob_day_sun">Ne</string>
    <string name="ob_days_count_one">%d den v týdnu</string>
    <string name="ob_days_count_few">%d dny v týdnu</string>
    <string name="ob_days_count_many">%d dní v týdnu</string>
    <string name="ob_days_notify">Připomínat mi tréninkové dny</string>
```

- [ ] **Step 7: Rewrite `FrequencyStep.kt`**

Replace the entire file contents with:

```kotlin
package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.onboarding.rememberNotificationPermissionRequester
import com.coachfoska.app.ui.onboarding.components.WeekdayPicker
import kotlinx.datetime.DayOfWeek
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun FrequencyStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val dayLabels = listOf(
        DayOfWeek.MONDAY to stringResource(Res.string.ob_day_mon),
        DayOfWeek.TUESDAY to stringResource(Res.string.ob_day_tue),
        DayOfWeek.WEDNESDAY to stringResource(Res.string.ob_day_wed),
        DayOfWeek.THURSDAY to stringResource(Res.string.ob_day_thu),
        DayOfWeek.FRIDAY to stringResource(Res.string.ob_day_fri),
        DayOfWeek.SATURDAY to stringResource(Res.string.ob_day_sat),
        DayOfWeek.SUNDAY to stringResource(Res.string.ob_day_sun)
    )
    val freq = state.data.frequencyPerWeek
    // Czech plural: 1 -> den, 2..4 -> dny, 0 and 5+ -> dní.
    val countCaption = when (freq) {
        1 -> stringResource(Res.string.ob_days_count_one, freq)
        in 2..4 -> stringResource(Res.string.ob_days_count_few, freq)
        else -> stringResource(Res.string.ob_days_count_many, freq)
    }
    val permissionRequester = rememberNotificationPermissionRequester()

    Column(modifier.fillMaxSize().padding(top = 16.dp, bottom = 24.dp)) {
        Text(
            stringResource(Res.string.ob_frequency_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            stringResource(Res.string.ob_frequency_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
        )
        WeekdayPicker(
            selected = state.data.trainingDays,
            dayLabels = dayLabels,
            onToggle = { onIntent(OnboardingIntent.ToggleTrainingDay(it)) }
        )
        Text(
            countCaption,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        )
        Spacer(Modifier.height(24.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val wantOn = !state.data.notificationsEnabled
                    if (wantOn) {
                        permissionRequester.request { granted ->
                            onIntent(OnboardingIntent.SetNotificationsEnabled(granted))
                        }
                    } else {
                        onIntent(OnboardingIntent.SetNotificationsEnabled(false))
                    }
                }
        ) {
            Checkbox(
                checked = state.data.notificationsEnabled,
                onCheckedChange = { wantOn ->
                    if (wantOn) {
                        permissionRequester.request { granted ->
                            onIntent(OnboardingIntent.SetNotificationsEnabled(granted))
                        }
                    } else {
                        onIntent(OnboardingIntent.SetNotificationsEnabled(false))
                    }
                }
            )
            Text(
                stringResource(Res.string.ob_days_notify),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
        Spacer(Modifier.weight(1f))
        CoachButton(
            text = stringResource(Res.string.ob_continue),
            onClick = { onIntent(OnboardingIntent.NextStep) },
            enabled = state.data.trainingDays.isNotEmpty(),
            shape = RectangleShape,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
```

- [ ] **Step 8: Delete `FrequencySlider.kt`**

```bash
git rm composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/FrequencySlider.kt
```

- [ ] **Step 9: Run unit tests (green)**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"`
Expected: BUILD SUCCESSFUL, all tests pass (including the three new ones).

- [ ] **Step 10: Compile Android (verifies UI + DTO + strings wiring)**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL. (If a generated `Res.string.*` reference fails, confirm Step 6 added/removed exactly the listed keys.)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(onboarding): replace frequency slider with training-day picker + notifications opt-in"
```

---

## Final verification

- [ ] **All onboarding unit tests pass:** `./gradlew :composeApp:testDebugUnitTest`
- [ ] **Android compiles:** `./gradlew :composeApp:compileDebugKotlinAndroid`
- [ ] **Manual smoke test (Android device/emulator, API 33+):** open onboarding → reach the "Které dny chceš trénovat?" step. Confirm: 7 day chips render Po–Ne; tapping toggles selection; the count caption updates with correct Czech plural; the two old progress bars are gone; Continue is disabled when no day is selected; checking the notifications box triggers the OS permission dialog and the box only stays checked if permission is granted.
- [ ] **iOS build (if iOS toolchain available):** `./gradlew :composeApp:compileKotlinIosSimulatorArm64` (or the project's iOS compile task) succeeds.

## Notes / decisions baked in

- `frequencyPerWeek` is derived (`trainingDays.size`), so `PlanLoadingStep` and the DTO need no logic change — only the DTO gains the two new persisted fields.
- The notifications checkbox reflects `notificationsEnabled`, which only becomes `true` after the OS grants permission — a denied prompt correctly leaves the box unchecked.
- Czech pluralization uses three explicit string resources (`ob_days_count_one/few/many`) instead of Compose `<plurals>`, because the project does not currently use `pluralStringResource` and the `when` approach is guaranteed to build.
- `CoachButton` already exposes `enabled: Boolean = true`; no change to that component is needed.
- Scheduling actual reminders is intentionally out of scope (see spec §11).
