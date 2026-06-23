# Activity Hub with Integrated Day Summary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Activity Hub screen (Activity tab) to match the Stitch "Activity Hub with Integrated Day Summary" mock — a brutalist monochrome layout — using only data already in `WorkoutState`.

**Architecture:** Three pure functions derive the weekly-status model, today's volume, and a category badge from existing domain data (no backend changes). A new Activity-Hub-only status type (`WeekDayActivity`) keeps the shared `CompletionStatus`/`WeeklyCalendarStrip`/Progress-Dashboard code untouched. Three new stateless Compose components render the grid, the workout cards, and the quick-link rows. The screen is rewritten to assemble them; `App.kt` wires two new navigation callbacks. Square corners are applied locally (screen-scoped `RoundedCornerShape(0.dp)`); the global theme is intentionally NOT changed.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform (Material 3), Koin, kotlinx-datetime, kotlin.test + MockK (androidUnitTest).

**Spec:** `docs/superpowers/specs/2026-06-23-activity-hub-day-summary-design.md`

**Branch:** `feature/activity-hub-day-summary` (already created).

---

## File structure

**New**
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/WeekDayActivity.kt` — `DayActivityStatus` enum + `WeekDayActivity` data class.
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogic.kt` — `buildWeeklyActivity`, `deriveTodayVolumeKg`, `formatVolumeKg`, `deriveCategoryLabel`.
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyActivityGrid.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/AssignedWorkoutCard.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/QuickLinkRow.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogicTest.kt`

**Modified**
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt` — full body rewrite, new params, previews.
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` — `composable<WorkoutList>` wiring.

**Do NOT touch:** `domain/model/DayCompletion.kt`, `ui/workout/components/WeeklyCalendarStrip.kt`, `domain/usecase/workout/GetProgressDashboardUseCase.kt`, `ui/workout/ProgressDashboardScreen.kt`, `theme/*`.

## Task dependency graph (for subagent dispatch)
- Task 1 → Task 2 (logic uses the model) and → Task 3 (grid uses the model).
- Tasks 3, 4, 5 are independent of each other and of Task 2 (may run in parallel after Task 1).
- Task 6 depends on Tasks 1–5. Task 7 depends on Task 6. Task 8 is final verification.

## Reference facts (verified against the codebase)
- Domain `DayOfWeek(val index: Int, val displayName: String)`, `MONDAY(0)…SUNDAY(6)`, plus `DayOfWeek.entries` and `fromIndex`.
- kotlinx `LocalDate.dayOfWeek.ordinal` is `0`=Monday…`6`=Sunday — matches `DayOfWeek.index`.
- `todayDate(): LocalDate` and `currentInstant(): Instant` live in `com.coachfoska.app.core.util` (`DateTimeUtils.kt`).
- `WorkoutState(workouts, workoutHistory, isLoading, error, …)` — both lists already populated by `WorkoutViewModel`.
- `Workout(id, name, dayOfWeek: DayOfWeek?, durationMinutes: Int, exercises: List<WorkoutExercise>, …)`.
- `WorkoutExercise(id, workoutId, name, muscleGroup: String?, sets: Int, reps: String, restSeconds: Int, tips: String?, …)`.
- `WorkoutLog(id, userId, workoutId: String?, workoutName, durationMinutes, exerciseLogs, loggedAt: Instant)`.
- `ExerciseLog(… sets: List<SetLog>)`; `SetLog(… actualReps: Int?, actualWeightKg: Float?, completed: Boolean)`.
- Test fixtures (`androidUnitTest/.../fixtures/Fixtures.kt`): `aWorkout(id, name, exercises)` (dayOfWeek defaults MONDAY, duration 60), `aWorkoutLog(id, userId, workoutName, exerciseLogs)` (workoutId "w-1", loggedAt 2026-04-03T10:00:00Z), `aSetLog(... actualWeightKg=80f, actualReps=10, completed=true)`, `anExerciseLog(id, workoutLogId, sets)`. Vary other fields with `.copy(...)`.
- Material icons extended IS available (`org.jetbrains.compose.material:material-icons-extended`).
- Compose preview import used project-wide: `androidx.compose.ui.tooling.preview.Preview`; previews call the content composable directly (no theme wrapper).
- Unit test task: `./gradlew :composeApp:testDebugUnitTest`. Compile gate: `./gradlew :composeApp:compileDebugKotlinAndroid`.

---

### Task 1: `WeekDayActivity` domain model

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/WeekDayActivity.kt`

- [ ] **Step 1: Create the model file**

```kotlin
package com.coachfoska.app.domain.model

/** Per-day status for the Activity Hub weekly grid. Distinct from [CompletionStatus],
 *  which is shared with the Progress Dashboard and intentionally not extended. */
enum class DayActivityStatus {
    COMPLETED,
    TODAY,
    SCHEDULED,
    MISSED,
    REST,
}

data class WeekDayActivity(
    val dayOfWeek: DayOfWeek,
    val status: DayActivityStatus,
)
```

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/WeekDayActivity.kt
git commit -m "feat(activity-hub): add WeekDayActivity status model"
```

---

### Task 2: Activity Hub pure logic (TDD)

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogic.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogicTest.kt`

- [ ] **Step 1: Write the failing tests**

Create `ActivityHubLogicTest.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.fixtures.aSetLog
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
import com.coachfoska.app.fixtures.anExerciseLog
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private fun exercise(muscle: String?) = WorkoutExercise(
    id = "e", workoutId = "w", name = "Ex", muscleGroup = muscle,
    sets = 3, reps = "10", restSeconds = 90, tips = null,
)

class ActivityHubLogicTest {

    // 2026-04-09 is a Thursday (DayOfWeek index 3). Week runs Mon 04-06 .. Sun 04-12.
    private val today = LocalDate(2026, 4, 9)
    private val zone = TimeZone.UTC

    @Test
    fun `buildWeeklyActivity classifies every day`() {
        val workouts = listOf(
            aWorkout(id = "w-mon").copy(dayOfWeek = DayOfWeek.MONDAY),
            aWorkout(id = "w-fri").copy(dayOfWeek = DayOfWeek.FRIDAY),
        )
        // Completed log on Wed 2026-04-08 (this week).
        val history = listOf(
            aWorkoutLog(id = "l1").copy(loggedAt = Instant.parse("2026-04-08T10:00:00Z")),
        )

        val result = buildWeeklyActivity(workouts, history, today, zone)

        assertEquals(7, result.size)
        assertEquals(DayActivityStatus.MISSED, result[0].status)     // Mon: assigned, past
        assertEquals(DayActivityStatus.REST, result[1].status)       // Tue: nothing
        assertEquals(DayActivityStatus.COMPLETED, result[2].status)  // Wed: logged
        assertEquals(DayActivityStatus.TODAY, result[3].status)      // Thu: today
        assertEquals(DayActivityStatus.SCHEDULED, result[4].status)  // Fri: assigned, future
        assertEquals(DayActivityStatus.REST, result[5].status)       // Sat
        assertEquals(DayActivityStatus.REST, result[6].status)       // Sun
    }

    @Test
    fun `buildWeeklyActivity ignores logs from other weeks`() {
        val history = listOf(
            aWorkoutLog(id = "old").copy(loggedAt = Instant.parse("2026-03-30T10:00:00Z")), // Mon, prior week
        )
        val result = buildWeeklyActivity(emptyList(), history, today, zone)
        assertEquals(DayActivityStatus.REST, result[0].status) // Mon not completed this week
    }

    @Test
    fun `deriveTodayVolumeKg returns null when no workout`() {
        assertNull(deriveTodayVolumeKg(null, emptyList()))
    }

    @Test
    fun `deriveTodayVolumeKg returns null when no matching log`() {
        val workout = aWorkout(id = "w-x")
        val history = listOf(aWorkoutLog(id = "l1").copy(workoutId = "w-y"))
        assertNull(deriveTodayVolumeKg(workout, history))
    }

    @Test
    fun `deriveTodayVolumeKg sums completed sets of matching log by id`() {
        val workout = aWorkout(id = "w1")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = "w1",
            exerciseLogs = listOf(
                anExerciseLog(sets = listOf(
                    aSetLog(actualWeightKg = 100f, actualReps = 5, completed = true),
                    aSetLog(actualWeightKg = 50f, actualReps = 10, completed = true),
                    aSetLog(actualWeightKg = 999f, actualReps = 999, completed = false),
                )),
            ),
        )
        assertEquals(1000.0, deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `deriveTodayVolumeKg falls back to name match when workoutId is null`() {
        val workout = aWorkout(id = "w1", name = "Push Day")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = null,
            workoutName = "Push Day",
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 20f, actualReps = 10)))),
        )
        assertEquals(200.0, deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `deriveTodayVolumeKg picks most recent matching log`() {
        val workout = aWorkout(id = "w1")
        val older = aWorkoutLog(id = "old").copy(
            workoutId = "w1", loggedAt = Instant.parse("2026-04-01T10:00:00Z"),
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 10f, actualReps = 1)))),
        )
        val newer = aWorkoutLog(id = "new").copy(
            workoutId = "w1", loggedAt = Instant.parse("2026-04-08T10:00:00Z"),
            exerciseLogs = listOf(anExerciseLog(sets = listOf(aSetLog(actualWeightKg = 30f, actualReps = 10)))),
        )
        assertEquals(300.0, deriveTodayVolumeKg(workout, listOf(older, newer)))
    }

    @Test
    fun `deriveTodayVolumeKg returns null when derived volume is zero`() {
        val workout = aWorkout(id = "w1")
        val log = aWorkoutLog(id = "l1").copy(
            workoutId = "w1",
            exerciseLogs = listOf(anExerciseLog(sets = listOf(
                aSetLog(actualWeightKg = null, actualReps = null, completed = true),
            ))),
        )
        assertNull(deriveTodayVolumeKg(workout, listOf(log)))
    }

    @Test
    fun `formatVolumeKg formats thousands and small values`() {
        assertEquals("12.4k kg", formatVolumeKg(12400.0))
        assertEquals("12k kg", formatVolumeKg(12000.0))
        assertEquals("840 kg", formatVolumeKg(840.0))
    }

    @Test
    fun `deriveCategoryLabel returns dominant muscle group uppercased`() {
        val workout = aWorkout(id = "w1", exercises = listOf(
            exercise("Chest"), exercise("Chest"), exercise("Back"),
        ))
        assertEquals("CHEST", deriveCategoryLabel(workout))
    }

    @Test
    fun `deriveCategoryLabel falls back to WORKOUT when no muscle groups`() {
        val workout = aWorkout(id = "w1", exercises = listOf(exercise(null)))
        assertEquals("WORKOUT", deriveCategoryLabel(workout))
        assertEquals("WORKOUT", deriveCategoryLabel(aWorkout(id = "w2")))
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.workout.ActivityHubLogicTest"`
Expected: FAIL — unresolved references (`buildWeeklyActivity`, `deriveTodayVolumeKg`, `formatVolumeKg`, `deriveCategoryLabel`).

- [ ] **Step 3: Write the implementation**

Create `ActivityHubLogic.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.math.roundToInt

/**
 * Builds the 7-day (Mon–Sun) activity model for the Activity Hub weekly grid.
 *
 * Status precedence per weekday:
 *  - COMPLETED: a workout was logged on that weekday during the current week.
 *  - TODAY: the weekday is today (and not already completed).
 *  - MISSED / SCHEDULED: a workout is assigned to that weekday (past -> MISSED, today/future -> SCHEDULED).
 *  - REST: nothing assigned and nothing logged.
 */
fun buildWeeklyActivity(
    workouts: List<Workout>,
    history: List<WorkoutLog>,
    today: LocalDate,
    zone: TimeZone,
): List<WeekDayActivity> {
    val todayDow = today.dayOfWeek.ordinal // 0 = Monday … 6 = Sunday
    val todayEpoch = today.toEpochDays()
    val weekStartEpoch = todayEpoch - todayDow

    val completedDows = history
        .map { it.loggedAt.toLocalDateTime(zone).date }
        .filter { it.toEpochDays() in weekStartEpoch..todayEpoch }
        .map { it.dayOfWeek.ordinal }
        .toSet()

    val assignedDows = workouts.mapNotNull { it.dayOfWeek?.index }.toSet()

    return DayOfWeek.entries.map { day ->
        val status = when {
            day.index in completedDows -> DayActivityStatus.COMPLETED
            day.index == todayDow -> DayActivityStatus.TODAY
            day.index in assignedDows && day.index < todayDow -> DayActivityStatus.MISSED
            day.index in assignedDows -> DayActivityStatus.SCHEDULED
            else -> DayActivityStatus.REST
        }
        WeekDayActivity(dayOfWeek = day, status = status)
    }
}

/**
 * Estimates today's total training volume (kg) from the most recent logged session
 * matching [todayWorkout] (by id, or by name when the log has no workoutId).
 * Returns null when there is no workout, no matching log, or the volume is zero.
 */
fun deriveTodayVolumeKg(todayWorkout: Workout?, history: List<WorkoutLog>): Double? {
    if (todayWorkout == null) return null
    val matching = history
        .filter { it.workoutId == todayWorkout.id || (it.workoutId == null && it.workoutName == todayWorkout.name) }
        .maxByOrNull { it.loggedAt }
        ?: return null
    val volume = matching.exerciseLogs
        .flatMap { it.sets }
        .filter { it.completed }
        .sumOf { (it.actualWeightKg?.toDouble() ?: 0.0) * (it.actualReps ?: 0) }
    return if (volume <= 0.0) null else volume
}

/** Formats a kg volume: "12.4k kg" for >= 1000, "840 kg" otherwise. */
fun formatVolumeKg(kg: Double): String {
    return if (kg >= 1000) {
        val thousands = (kg / 100.0).roundToInt() / 10.0 // one decimal place
        val text = if (thousands % 1.0 == 0.0) thousands.toInt().toString() else thousands.toString()
        "${text}k kg"
    } else {
        "${kg.roundToInt()} kg"
    }
}

/** Derives a short category badge from the workout's dominant muscle group, uppercased. */
fun deriveCategoryLabel(workout: Workout): String {
    val dominant = workout.exercises
        .mapNotNull { it.muscleGroup }
        .filter { it.isNotBlank() }
        .groupingBy { it }
        .eachCount()
        .maxByOrNull { it.value }
        ?.key
    return dominant?.uppercase() ?: "WORKOUT"
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.workout.ActivityHubLogicTest"`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogic.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/ActivityHubLogicTest.kt
git commit -m "feat(activity-hub): add weekly-activity, volume, and category logic (TDD)"
```

---

### Task 3: `WeeklyActivityGrid` component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyActivityGrid.kt`

- [ ] **Step 1: Create the component**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.DayActivityStatus
import com.coachfoska.app.domain.model.WeekDayActivity

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun WeeklyActivityGrid(
    days: List<WeekDayActivity>,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        days.forEach { day ->
            WeekDayCell(day = day, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun WeekDayCell(day: WeekDayActivity, modifier: Modifier = Modifier) {
    val isToday = day.status == DayActivityStatus.TODAY
    val dimmed = day.status == DayActivityStatus.REST || day.status == DayActivityStatus.MISSED
    val border = if (isToday) {
        BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
    } else {
        BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    }
    val bg = when (day.status) {
        DayActivityStatus.TODAY -> MaterialTheme.colorScheme.surfaceContainerHighest
        DayActivityStatus.COMPLETED -> MaterialTheme.colorScheme.surface
        else -> MaterialTheme.colorScheme.background
    }
    val accent = if (isToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier = modifier
            .border(border, SquareShape)
            .background(bg)
            .padding(vertical = 12.dp)
            .alpha(if (dimmed) 0.5f else 1f),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = day.dayOfWeek.displayName.first().toString(),
            style = MaterialTheme.typography.labelSmall,
            color = accent,
        )
        Icon(
            imageVector = iconFor(day.status),
            contentDescription = day.status.name,
            tint = accent,
            modifier = Modifier.size(20.dp),
        )
    }
}

private fun iconFor(status: DayActivityStatus): ImageVector = when (status) {
    DayActivityStatus.COMPLETED -> Icons.Filled.CheckCircle
    DayActivityStatus.TODAY -> Icons.Filled.Bolt
    DayActivityStatus.SCHEDULED -> Icons.Filled.CalendarToday
    DayActivityStatus.MISSED -> Icons.Filled.CalendarToday
    DayActivityStatus.REST -> Icons.Filled.Hotel
}
```

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyActivityGrid.kt
git commit -m "feat(activity-hub): add WeeklyActivityGrid component"
```

---

### Task 4: `AssignedWorkoutCard` component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/AssignedWorkoutCard.kt`

- [ ] **Step 1: Create the component**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.Workout

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun AssignedWorkoutCard(
    workout: Workout,
    categoryLabel: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(260.dp)
            .height(180.dp)
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
            .clickable(onClick = onClick)
            .padding(20.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                text = categoryLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp,
                modifier = Modifier
                    .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
            Icon(
                imageVector = Icons.Filled.FitnessCenter,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.size(20.dp),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = workout.name.uppercase(),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MetaItem(Icons.Filled.Schedule, "${workout.durationMinutes} Min")
                Text(
                    text = "${workout.exercises.size} exercises",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun MetaItem(icon: ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
```

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/AssignedWorkoutCard.kt
git commit -m "feat(activity-hub): add AssignedWorkoutCard component"
```

---

### Task 5: `QuickLinkRow` component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/QuickLinkRow.kt`

- [ ] **Step 1: Create the component**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun QuickLinkRow(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().clickable(onClick = onClick)) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(16.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 1.sp,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}
```

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/QuickLinkRow.kt
git commit -m "feat(activity-hub): add QuickLinkRow component"
```

---

### Task 6: Rewrite `ActivityHubScreen`

**Files:**
- Modify (full replace of file contents): `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt`

Depends on Tasks 1–5.

- [ ] **Step 1: Replace the entire file with the new implementation**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity
import com.coachfoska.app.domain.usecase.workout.deriveCategoryLabel
import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg
import com.coachfoska.app.domain.usecase.workout.formatVolumeKg
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.workout.components.AssignedWorkoutCard
import com.coachfoska.app.ui.workout.components.QuickLinkRow
import com.coachfoska.app.ui.workout.components.WeeklyActivityGrid
import kotlinx.datetime.TimeZone
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        onStartWorkout = onStartWorkout,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick,
        onProgressClick = onProgressClick,
        onWorkoutClick = onWorkoutClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    onProgressClick: () -> Unit,
    onWorkoutClick: (workoutId: String) -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    val today = todayDate()
    val zone = TimeZone.currentSystemDefault()
    val todayWorkout = state.workouts.firstOrNull { it.dayOfWeek?.index == today.dayOfWeek.ordinal }
    val weeklyDays = buildWeeklyActivity(state.workouts, state.workoutHistory, today, zone)
    val volumeKg = deriveTodayVolumeKg(todayWorkout, state.workoutHistory)

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            BrandHeader()

            if (state.isLoading && state.workouts.isEmpty()) {
                CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(200.dp))
            } else {
                StartWorkoutButton(todayWorkout = todayWorkout, onStartWorkout = onStartWorkout, onBrowse = onPlanClick)

                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionLabel("WEEKLY ACTIVITY")
                    WeeklyActivityGrid(days = weeklyDays)
                    DaySummaryBar(todayWorkout = todayWorkout, volumeKg = volumeKg)
                }

                if (state.workouts.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionLabel("ASSIGNED WORKOUTS")
                            Text(
                                text = "SCROLL →",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                letterSpacing = 1.sp,
                            )
                        }
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(end = 16.dp),
                        ) {
                            items(state.workouts, key = { it.id }) { workout ->
                                AssignedWorkoutCard(
                                    workout = workout,
                                    categoryLabel = deriveCategoryLabel(workout),
                                    onClick = { onWorkoutClick(workout.id) },
                                )
                            }
                        }
                    }
                } else {
                    Text(
                        text = "No workouts assigned yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Column {
                    QuickLinkRow(icon = Icons.Filled.MenuBook, label = "EXERCISE LIBRARY", onClick = onLibraryClick)
                    QuickLinkRow(icon = Icons.Filled.History, label = "WORKOUT HISTORY", onClick = onHistoryClick)
                    QuickLinkRow(icon = Icons.Filled.TrendingUp, label = "PROGRESS ANALYTICS", onClick = onProgressClick)
                    QuickLinkRow(icon = Icons.Filled.Add, label = "LOG ACTIVITY", onClick = onLogGeneralActivityClick)
                }

                state.error?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BrandHeader() {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(
            text = "COACH FOSKA",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 2.sp,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onBackground,
        letterSpacing = 1.5.sp,
    )
}

@Composable
private fun StartWorkoutButton(
    todayWorkout: Workout?,
    onStartWorkout: (String) -> Unit,
    onBrowse: () -> Unit,
) {
    Button(
        onClick = { if (todayWorkout != null) onStartWorkout(todayWorkout.id) else onBrowse() },
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = SquareShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            text = if (todayWorkout != null) "START WORKOUT" else "BROWSE WORKOUTS",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun DaySummaryBar(todayWorkout: Workout?, volumeKg: Double?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (todayWorkout != null) "TODAY'S FOCUS" else "REST DAY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp,
            )
            Text(
                text = (todayWorkout?.name ?: "Recovery").uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (todayWorkout != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SummaryMetric("DURATION", "${todayWorkout.durationMinutes}m")
                SummaryMetric("EXERCISES", todayWorkout.exercises.size.toString())
                if (volumeKg != null) {
                    SummaryMetric("VOLUME", formatVolumeKg(volumeKg))
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.End) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
        Text(value, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)
    }
}

private fun previewExercise(name: String, muscle: String) = WorkoutExercise(
    id = name, workoutId = "1", name = name, muscleGroup = muscle,
    sets = 4, reps = "10", restSeconds = 90, tips = null,
)

@Preview
@Composable
private fun ActivityHubScreenPreview() {
    val workouts = listOf(
        Workout(
            id = "1", name = "Upper Body Strength", dayOfWeek = DayOfWeek.MONDAY, durationMinutes = 45,
            exercises = listOf(previewExercise("Bench", "Chest"), previewExercise("Row", "Back")),
        ),
        Workout(
            id = "2", name = "Leg Day", dayOfWeek = DayOfWeek.FRIDAY, durationMinutes = 60,
            exercises = listOf(previewExercise("Squat", "Legs")),
        ),
    )
    ActivityHubScreen(
        state = WorkoutState(workouts = workouts),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {}, onLogGeneralActivityClick = {},
    )
}

@Preview
@Composable
private fun ActivityHubScreenRestDayPreview() {
    ActivityHubScreen(
        state = WorkoutState(workouts = emptyList()),
        onStartWorkout = {}, onPlanClick = {}, onHistoryClick = {},
        onLibraryClick = {}, onProgressClick = {}, onWorkoutClick = {}, onLogGeneralActivityClick = {},
    )
}
```

- [ ] **Step 2: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL. (Expected transient state: `App.kt` still calls the old `ActivityHubRoute` signature and will FAIL to compile until Task 7. If compiling the whole module, do Task 7 before this compile gate; the file itself is correct.)

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt
git commit -m "feat(activity-hub): redesign screen to integrated day-summary layout"
```

---

### Task 7: Wire navigation in `App.kt`

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` (the `ActivityHubRoute(...)` call inside `composable<WorkoutList>`)

- [ ] **Step 1: Replace the `ActivityHubRoute(...)` call**

Find this block:

```kotlin
                    ActivityHubRoute(
                        userId = currentUserId,
                        onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
                        onPlanClick = { navController.navigate(WorkoutPlan) },
                        onHistoryClick = { navController.navigate(WorkoutHistory) },
                        onHistoryDetailClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) },
                        onLibraryClick = { navController.navigate(ExerciseLibrary) },
                        onLogGeneralActivityClick = { navController.navigate(ActivityTypeSelector) }
                    )
```

Replace it with:

```kotlin
                    ActivityHubRoute(
                        userId = currentUserId,
                        onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
                        onPlanClick = { navController.navigate(WorkoutPlan) },
                        onHistoryClick = { navController.navigate(WorkoutHistory) },
                        onLibraryClick = { navController.navigate(ExerciseLibrary) },
                        onProgressClick = { navController.navigate(ProgressDashboard) },
                        onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
                        onLogGeneralActivityClick = { navController.navigate(ActivityTypeSelector) }
                    )
```

(`WorkoutDetail`, `ProgressDashboard`, `WorkoutHistory`, `WorkoutHistoryDetail` routes are all already imported/used in `App.kt`. `onHistoryDetailClick` is removed because the Recent Sessions list was dropped.)

- [ ] **Step 2: Compile the whole module**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(activity-hub): wire workout-detail and progress-analytics navigation"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit-test suite**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: BUILD SUCCESSFUL — all tests pass, including `ActivityHubLogicTest`.

- [ ] **Step 2: Compile-gate the Android target**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Confirm no leftover references to removed APIs**

Run:
```bash
grep -rn "onHistoryDetailClick" composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
grep -rn "WeeklyCalendarStrip" composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt
```
Expected: no matches (the screen no longer references either).

- [ ] **Step 4: Confirm shared code is untouched**

Run:
```bash
git diff --name-only master...feature/activity-hub-day-summary -- \
  composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/DayCompletion.kt \
  composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyCalendarStrip.kt \
  composeApp/src/commonMain/kotlin/com/coachfoska/app/theme
```
Expected: no output (none of these files changed).

- [ ] **Step 5: Final no-op commit guard**

If Steps 1–4 produced no code changes, there is nothing to commit. Otherwise commit any fixes with `fix(activity-hub): ...`.

---

## Self-review checklist (completed during planning)

- **Spec coverage:** Header (Task 6), Start button w/ rest-day fallback (Task 6), Weekly grid + statuses (Tasks 1/2/3/6), Integrated Day Summary w/ duration+exercises+conditional volume (Tasks 2/6), Assigned Workouts slider + category badge (Tasks 2/4/6), 4 quick links incl. Progress Analytics + Log Activity (Tasks 6/7), square local styling (Tasks 3/4/6), derive-cheap data rules (Task 2), no DB/theme/shared-code changes (Task 8 guards). ✓
- **Placeholders:** none — all code is complete. ✓
- **Type consistency:** `buildWeeklyActivity`/`deriveTodayVolumeKg`/`formatVolumeKg`/`deriveCategoryLabel` signatures match between Task 2 definition and Task 6 call sites; `WeekDayActivity`/`DayActivityStatus` consistent across Tasks 1/2/3/6; `ActivityHubRoute` new param set matches the Task 7 call site. ✓
