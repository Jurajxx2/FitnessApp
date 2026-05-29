# Workout Screens Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all workout/exercise screens with competitive UX patterns — PREVIOUS column, inline rest timer, PR detection, exercise tab strip, progress dashboard, and post-workout summary.

**Architecture:** Bottom-up build: domain models → repository queries → use cases → DI → ViewModels → UI screens → navigation wiring. The Active Session gets a dedicated ViewModel (`ActiveSessionViewModel`) to isolate the complex timer/PR logic from the existing `WorkoutViewModel`. New screens (Progress Dashboard, Post-Workout Summary) each get their own ViewModel. Existing patterns (MVI, Koin, Supabase Postgrest, Material 3) are followed throughout.

**Tech Stack:** Kotlin Multiplatform + Compose Multiplatform 1.10.2, Supabase Postgrest, Koin 4.1.1, Material 3, MVI architecture, Kotlinx Datetime/Serialization

---

## Files

### New Files

| File | Responsibility |
|------|---------------|
| `domain/model/PersonalRecord.kt` | PR domain model, PRType enum, ExerciseRecords, RecordEntry, MuscleVolumeEntry, WeeklyCount |
| `domain/model/DayCompletion.kt` | DayCompletion data class, CompletionStatus enum, TimePeriod enum |
| `domain/usecase/workout/CalculateEstimated1RMUseCase.kt` | Pure Epley formula for estimated 1RM |
| `domain/usecase/workout/GetPreviousExerciseLogsUseCase.kt` | Fetch last session's set data per exercise |
| `domain/usecase/workout/CheckPersonalRecordUseCase.kt` | Compare a set against all-time bests |
| `domain/usecase/workout/GetExerciseHistoryUseCase.kt` | All logs for a specific exercise |
| `domain/usecase/workout/GetExerciseRecordsUseCase.kt` | All-time records for an exercise |
| `domain/usecase/workout/GetProgressDashboardUseCase.kt` | Aggregate weekly stats, streak, muscle distribution |
| `domain/usecase/workout/GetWorkoutsPerWeekUseCase.kt` | Workout count per week for bar chart |
| `presentation/workout/ActiveSessionViewModel.kt` | Dedicated VM for active session with timer, PR, PREVIOUS |
| `presentation/workout/ActiveSessionState.kt` | State for active session screen |
| `presentation/workout/ActiveSessionIntent.kt` | Intents for active session screen |
| `presentation/workout/ProgressDashboardViewModel.kt` | VM for progress dashboard |
| `presentation/workout/ProgressDashboardState.kt` | State for progress dashboard |
| `presentation/workout/PostWorkoutSummaryViewModel.kt` | VM for post-workout summary |
| `ui/workout/PostWorkoutSummaryScreen.kt` | Post-workout celebration screen |
| `ui/workout/ProgressDashboardScreen.kt` | Progress dashboard with charts |
| `ui/workout/components/SetRow.kt` | Redesigned set logging row with PREVIOUS column |
| `ui/workout/components/RestTimerBar.kt` | Inline rest timer composable |
| `ui/workout/components/ExerciseTabStrip.kt` | Scrollable exercise chip tabs |
| `ui/workout/components/PRBanner.kt` | PR celebration banner composable |
| `ui/workout/components/WeeklyCalendarStrip.kt` | Mon-Sun weekly completion strip |
| `ui/workout/components/SessionHeaderBar.kt` | Active session top bar with timer + volume |
| `ui/workout/components/MuscleDistributionChart.kt` | Horizontal bar chart for muscle groups |
| `ui/workout/components/WorkoutsPerWeekChart.kt` | Bar chart for weekly workout counts |

### Modified Files

| File | Changes |
|------|---------|
| `domain/repository/WorkoutRepository.kt` | Add 6 new method signatures |
| `data/remote/datasource/WorkoutRemoteDataSource.kt` | Add 5 new Supabase query methods |
| `data/repository/WorkoutRepositoryImpl.kt` | Implement 6 new repository methods |
| `core/di/AppModule.kt` | Register new use cases + ViewModels |
| `navigation/Routes.kt` | Add `ProgressDashboard` and `PostWorkoutSummary` routes |
| `App.kt` | Add composable destinations for new routes, update ActiveSession flow |
| `ui/workout/ActivityHubScreen.kt` | Full redesign: hero card, weekly calendar, recent sessions |
| `ui/workout/ActiveSessionScreen.kt` | Full redesign: tab strip, PREVIOUS column, rest timer |
| `ui/workout/ExerciseDetailScreen.kt` | Add tabbed layout (Guide/History/Charts/Records) |
| `ui/workout/ExerciseLibraryScreen.kt` | Add favorites chip, muscle group tags |
| `ui/workout/WorkoutHistoryScreen.kt` | Add progress link, enhanced cards |
| `ui/workout/WorkoutHistoryDetailScreen.kt` | Add "View Charts" links |
| `presentation/workout/SessionDraft.kt` | Add `exerciseId` field to `ExerciseDraft` |

All paths are relative to `composeApp/src/commonMain/kotlin/com/coachfoska/app/`.

---

## Task 1: Domain Models

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/PersonalRecord.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/DayCompletion.kt`

- [ ] **Step 1: Create PersonalRecord.kt with PR models**

```kotlin
package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

enum class PRType {
    HEAVIEST_WEIGHT,
    MOST_REPS_AT_WEIGHT,
    BEST_ESTIMATED_1RM,
    HIGHEST_SESSION_VOLUME,
}

data class PersonalRecord(
    val type: PRType,
    val exerciseName: String,
    val value: String,
    val previousBest: String?,
    val achievedAt: Instant,
)

data class ExerciseRecords(
    val heaviestWeight: RecordEntry?,
    val mostRepsAtWeight: RecordEntry?,
    val highestEstimated1RM: RecordEntry?,
    val highestVolume: RecordEntry?,
)

data class RecordEntry(
    val value: String,
    val detail: String,
    val date: LocalDate,
)

data class MuscleVolumeEntry(
    val muscleGroup: String,
    val volumeKg: Float,
    val percentage: Float,
)

data class WeeklyCount(
    val weekStart: LocalDate,
    val count: Int,
)

data class SessionPR(
    val exerciseName: String,
    val record: String,
)
```

- [ ] **Step 2: Create DayCompletion.kt**

```kotlin
package com.coachfoska.app.domain.model

enum class CompletionStatus {
    COMPLETED,
    MISSED,
    UPCOMING,
    TODAY,
}

data class DayCompletion(
    val dayOfWeek: DayOfWeek,
    val status: CompletionStatus,
)

enum class TimePeriod {
    ONE_MONTH,
    THREE_MONTHS,
    SIX_MONTHS,
    ONE_YEAR,
    ALL,
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/PersonalRecord.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/DayCompletion.kt
git commit -m "feat(domain): add PR, DayCompletion, and analytics domain models"
```

---

## Task 2: WorkoutRepository Interface Additions

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/WorkoutRepository.kt`

- [ ] **Step 1: Add new method signatures to WorkoutRepository**

Add these imports at the top of the file:

```kotlin
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WeeklyCount
import kotlinx.datetime.LocalDate
```

Add these methods after the existing `getWorkoutHistory` method:

```kotlin
    /** Returns the most recent ExerciseLog for each exercise name from previous sessions. */
    suspend fun getLastLogsForExercises(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>>

    /** Returns all logged sessions containing this exercise, ordered by date descending. */
    suspend fun getExerciseHistory(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>>

    /** Returns all-time personal records for a specific exercise. */
    suspend fun getExerciseRecords(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords>

    /** Returns recent PRs across all exercises. */
    suspend fun getRecentPersonalRecords(
        userId: String,
        limit: Int = 5
    ): Result<List<PersonalRecord>>

    /** Returns workout count grouped by ISO week since a given date. */
    suspend fun getWorkoutCountByWeek(
        userId: String,
        since: LocalDate
    ): Result<List<WeeklyCount>>

    /** Returns the number of consecutive weeks (ending with current) with at least 1 workout. */
    suspend fun getCurrentStreak(userId: String): Result<Int>
```

- [ ] **Step 2: Verify compilation (expect failure in WorkoutRepositoryImpl — that's expected)**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid 2>&1 | tail -5
```

Expected: compilation errors in `WorkoutRepositoryImpl` because new methods are not implemented yet. This is correct — Task 4 will implement them.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/WorkoutRepository.kt
git commit -m "feat(domain): add workout repository interface methods for PREVIOUS, PRs, analytics"
```

---

## Task 3: WorkoutRemoteDataSource — New Supabase Queries

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/WorkoutRemoteDataSource.kt`

- [ ] **Step 1: Add method to get the most recent exercise logs by exercise names**

Add this method to `WorkoutRemoteDataSource`:

```kotlin
    /**
     * For each exercise name, fetches the most recent exercise_log row (with its set_logs)
     * from the user's workout history. Used for the PREVIOUS column.
     */
    suspend fun getLastExerciseLogs(
        userId: String,
        exerciseNames: List<String>
    ): Map<String, List<SetLogDto>> {
        if (exerciseNames.isEmpty()) return emptyMap()

        // Get all workout log IDs for this user, ordered by most recent first
        val workoutLogs = supabase.postgrest["workout_logs"]
            .select(columns = Columns.raw("id, logged_at")) {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }.decodeList<WorkoutLogDto>()

        if (workoutLogs.isEmpty()) return emptyMap()

        // Get exercise logs for these workouts, filtered by exercise names
        val exerciseLogs = supabase.postgrest["exercise_logs"]
            .select {
                filter {
                    filter("workout_log_id", FilterOperator.IN, workoutLogs.map { it.id })
                    filter("exercise_name", FilterOperator.IN, exerciseNames)
                }
            }.decodeList<ExerciseLogDto>()

        if (exerciseLogs.isEmpty()) return emptyMap()

        // Create a map of workout_log_id -> logged_at for ordering
        val workoutLogOrder = workoutLogs.mapIndexed { index, wl -> wl.id to index }.toMap()

        // For each exercise name, find the most recent log
        val mostRecentByExercise = exerciseLogs
            .groupBy { it.exerciseName }
            .mapValues { (_, logs) ->
                logs.minByOrNull { workoutLogOrder[it.workoutLogId] ?: Int.MAX_VALUE }
            }
            .filterValues { it != null }
            .mapValues { it.value!! }

        // Get set logs for the most recent exercise logs
        val exerciseLogIds = mostRecentByExercise.values.map { it.id }
        val setLogs = getSetLogsForExerciseLogs(exerciseLogIds)
        val setsByExerciseLogId = setLogs.groupBy { it.exerciseLogId }

        return mostRecentByExercise.mapValues { (_, exerciseLog) ->
            setsByExerciseLogId[exerciseLog.id]
                ?.sortedBy { it.sortOrder }
                .orEmpty()
        }
    }
```

- [ ] **Step 2: Add method to get all exercise logs for a specific exercise**

```kotlin
    /**
     * Returns all exercise_log entries (with set_logs) for a given exercise name,
     * across all the user's workout sessions, ordered by date descending.
     */
    suspend fun getExerciseLogHistory(
        userId: String,
        exerciseName: String
    ): List<Pair<ExerciseLogDto, String>> {
        // Get workout logs
        val workoutLogs = supabase.postgrest["workout_logs"]
            .select(columns = Columns.raw("id, logged_at")) {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }.decodeList<WorkoutLogDto>()

        if (workoutLogs.isEmpty()) return emptyList()

        // Get exercise logs matching this exercise name
        val exerciseLogs = supabase.postgrest["exercise_logs"]
            .select {
                filter {
                    filter("workout_log_id", FilterOperator.IN, workoutLogs.map { it.id })
                    eq("exercise_name", exerciseName)
                }
            }.decodeList<ExerciseLogDto>()

        if (exerciseLogs.isEmpty()) return emptyList()

        // Get set logs
        val setLogs = getSetLogsForExerciseLogs(exerciseLogs.map { it.id })
        val setsByExerciseLogId = setLogs.groupBy { it.exerciseLogId }

        // Map workout log id -> logged_at
        val logDates = workoutLogs.associate { it.id to it.loggedAt }

        // Return exercise logs with their sets attached, ordered by workout date
        return exerciseLogs
            .map { el -> el.copy(setLogs = setsByExerciseLogId[el.id].orEmpty().sortedBy { it.sortOrder }) to (logDates[el.workoutLogId] ?: "") }
            .sortedByDescending { it.second }
    }
```

- [ ] **Step 3: Add method to count workouts per week**

```kotlin
    /**
     * Returns workout log rows since a given date. The caller groups them by ISO week.
     */
    suspend fun getWorkoutLogsSince(
        userId: String,
        sinceIso: String
    ): List<WorkoutLogDto> =
        supabase.postgrest["workout_logs"]
            .select(columns = Columns.raw("id, logged_at")) {
                filter {
                    eq("user_id", userId)
                    gte("logged_at", sinceIso)
                }
                order("logged_at", Order.ASCENDING)
            }.decodeList<WorkoutLogDto>()
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid 2>&1 | tail -5
```

Expected: still fails on `WorkoutRepositoryImpl` (missing interface methods). DataSource changes should compile fine.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/WorkoutRemoteDataSource.kt
git commit -m "feat(data): add Supabase queries for PREVIOUS column, exercise history, weekly counts"
```

---

## Task 4: WorkoutRepositoryImpl — Implement New Methods

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImpl.kt`

- [ ] **Step 1: Add imports**

Add these imports at the top of `WorkoutRepositoryImpl.kt`:

```kotlin
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.PRType
import com.coachfoska.app.domain.model.RecordEntry
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.model.formatWeightKg
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
```

- [ ] **Step 2: Implement getLastLogsForExercises**

Add after the existing `getWorkoutHistory` method:

```kotlin
    override suspend fun getLastLogsForExercises(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>> = runCatching {
        workoutDataSource.getLastExerciseLogs(userId, exerciseNames)
            .mapValues { (_, setLogDtos) -> setLogDtos.map { it.toDomain() } }
    }
```

- [ ] **Step 3: Implement getExerciseHistory**

```kotlin
    override suspend fun getExerciseHistory(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>> = runCatching {
        workoutDataSource.getExerciseLogHistory(userId, exerciseName)
            .map { (dto, _) -> dto.toDomain() }
    }
```

- [ ] **Step 4: Implement getExerciseRecords**

```kotlin
    override suspend fun getExerciseRecords(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords> = runCatching {
        val history = workoutDataSource.getExerciseLogHistory(userId, exerciseName)
        if (history.isEmpty()) return@runCatching ExerciseRecords(null, null, null, null)

        val tz = TimeZone.currentSystemDefault()
        var heaviestWeight: RecordEntry? = null
        var mostRepsAtWeight: RecordEntry? = null
        var highest1RM: RecordEntry? = null
        var highestVolume: RecordEntry? = null

        for ((exerciseLogDto, loggedAtStr) in history) {
            val date = try {
                Instant.parse(loggedAtStr).toLocalDateTime(tz).date
            } catch (_: Exception) { continue }

            val sets = exerciseLogDto.setLogs.filter { it.completed }
            if (sets.isEmpty()) continue

            // Session volume
            val sessionVolume = sets.sumOf { s ->
                ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
            }.toFloat()
            if (highestVolume == null || sessionVolume > (highestVolume.value.removeSuffix(" kg").replace(",", "").toFloatOrNull() ?: 0f)) {
                highestVolume = RecordEntry(
                    value = "${formatWeightKg(sessionVolume)} kg",
                    detail = "${sets.size} sets",
                    date = date
                )
            }

            for (s in sets) {
                val w = s.actualWeightKg ?: continue
                val r = s.actualReps ?: continue

                // Heaviest weight
                val currentHeaviest = heaviestWeight?.value?.removeSuffix(" kg")?.toFloatOrNull() ?: 0f
                if (w > currentHeaviest) {
                    heaviestWeight = RecordEntry(
                        value = "${formatWeightKg(w)} kg",
                        detail = "${formatWeightKg(w)}kg x $r reps",
                        date = date
                    )
                }

                // Most reps at weight (highest reps for any given weight)
                val currentMostReps = mostRepsAtWeight?.detail?.let {
                    val parts = it.split(" x ")
                    if (parts.size == 2) parts[1].removeSuffix(" reps").toIntOrNull() else null
                } ?: 0
                if (r > currentMostReps) {
                    mostRepsAtWeight = RecordEntry(
                        value = "$r reps",
                        detail = "${formatWeightKg(w)}kg x $r reps",
                        date = date
                    )
                }

                // Estimated 1RM (Epley: weight * (1 + reps / 30))
                if (r in 1..30) {
                    val estimated1RM = w * (1f + r / 30f)
                    val current1RM = highest1RM?.value?.removeSuffix(" kg")?.toFloatOrNull() ?: 0f
                    if (estimated1RM > current1RM) {
                        highest1RM = RecordEntry(
                            value = "${formatWeightKg(estimated1RM)} kg",
                            detail = "from ${formatWeightKg(w)}kg x $r",
                            date = date
                        )
                    }
                }
            }
        }

        ExerciseRecords(heaviestWeight, mostRepsAtWeight, highest1RM, highestVolume)
    }
```

- [ ] **Step 5: Implement getRecentPersonalRecords**

```kotlin
    override suspend fun getRecentPersonalRecords(
        userId: String,
        limit: Int
    ): Result<List<PersonalRecord>> = runCatching {
        // Get full history to compute PRs across all exercises
        val workoutLogs = workoutDataSource.getWorkoutLogs(userId)
        if (workoutLogs.isEmpty()) return@runCatching emptyList()

        val exerciseLogs = workoutDataSource.getExerciseLogsForWorkouts(workoutLogs.map { it.id })
        val setLogs = workoutDataSource.getSetLogsForExerciseLogs(exerciseLogs.map { it.id })
        val setsByExerciseId = setLogs.groupBy { it.exerciseLogId }

        // Track best weight per exercise to find when PRs were set
        val bestWeightByExercise = mutableMapOf<String, Float>()
        val prs = mutableListOf<PersonalRecord>()

        // Process chronologically (oldest first)
        val logDateMap = workoutLogs.associate { it.id to it.loggedAt }
        val sortedExerciseLogs = exerciseLogs.sortedBy { logDateMap[it.workoutLogId] }

        for (el in sortedExerciseLogs) {
            val sets = setsByExerciseId[el.id].orEmpty().filter { it.completed }
            val loggedAt = logDateMap[el.workoutLogId] ?: continue

            for (s in sets) {
                val w = s.actualWeightKg ?: continue
                val prevBest = bestWeightByExercise[el.exerciseName]
                if (prevBest == null || w > prevBest) {
                    bestWeightByExercise[el.exerciseName] = w
                    if (prevBest != null) { // Skip first ever log (not a "PR")
                        prs.add(PersonalRecord(
                            type = PRType.HEAVIEST_WEIGHT,
                            exerciseName = el.exerciseName,
                            value = "${formatWeightKg(w)}kg x ${s.actualReps ?: "?"}",
                            previousBest = "${formatWeightKg(prevBest)}kg",
                            achievedAt = Instant.parse(loggedAt),
                        ))
                    }
                }
            }
        }

        prs.sortedByDescending { it.achievedAt }.take(limit)
    }
```

- [ ] **Step 6: Implement getWorkoutCountByWeek and getCurrentStreak**

```kotlin
    override suspend fun getWorkoutCountByWeek(
        userId: String,
        since: LocalDate
    ): Result<List<WeeklyCount>> = runCatching {
        val logs = workoutDataSource.getWorkoutLogsSince(userId, "${since}T00:00:00Z")
        val tz = TimeZone.currentSystemDefault()

        logs.groupBy { dto ->
            val localDate = Instant.parse(dto.loggedAt).toLocalDateTime(tz).date
            // ISO week start (Monday)
            val daysSinceMonday = (localDate.dayOfWeek.ordinal) // Monday=0
            LocalDate.fromEpochDays(localDate.toEpochDays() - daysSinceMonday)
        }.map { (weekStart, logsInWeek) ->
            WeeklyCount(weekStart = weekStart, count = logsInWeek.size)
        }.sortedBy { it.weekStart }
    }

    override suspend fun getCurrentStreak(userId: String): Result<Int> = runCatching {
        val tz = TimeZone.currentSystemDefault()
        val today = Clock.System.now().toLocalDateTime(tz).date
        val todayDaysSinceMonday = today.dayOfWeek.ordinal
        val thisWeekStart = LocalDate.fromEpochDays(today.toEpochDays() - todayDaysSinceMonday)

        // Fetch last 52 weeks of data
        val since = LocalDate.fromEpochDays(thisWeekStart.toEpochDays() - 364)
        val weeklyCountsResult = getWorkoutCountByWeek(userId, since)
        val weeklyCounts = weeklyCountsResult.getOrElse { return@runCatching 0 }

        val weekSet = weeklyCounts.filter { it.count > 0 }.map { it.weekStart }.toSet()

        var streak = 0
        var checkWeek = thisWeekStart
        while (checkWeek in weekSet) {
            streak++
            checkWeek = LocalDate.fromEpochDays(checkWeek.toEpochDays() - 7)
        }
        streak
    }
```

- [ ] **Step 7: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

Expected: SUCCESS — all interface methods are now implemented.

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImpl.kt
git commit -m "feat(data): implement workout repository methods for PREVIOUS, PRs, exercise history, analytics"
```

---

## Task 5: Use Cases

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/CalculateEstimated1RMUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/GetPreviousExerciseLogsUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/CheckPersonalRecordUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/GetExerciseHistoryUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/GetExerciseRecordsUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/GetProgressDashboardUseCase.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/GetWorkoutsPerWeekUseCase.kt`

- [ ] **Step 1: Create CalculateEstimated1RMUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

/**
 * Calculates estimated 1-rep max using the Epley formula:
 * 1RM = weight * (1 + reps / 30)
 *
 * Valid for reps in range 1..30. Returns null for invalid inputs.
 */
class CalculateEstimated1RMUseCase {
    operator fun invoke(weightKg: Float, reps: Int): Float? {
        if (weightKg <= 0f || reps !in 1..30) return null
        if (reps == 1) return weightKg
        return weightKg * (1f + reps / 30f)
    }
}
```

- [ ] **Step 2: Create GetPreviousExerciseLogsUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetPreviousExerciseLogsUseCase(
    private val workoutRepository: WorkoutRepository
) {
    /**
     * Returns a map of exercise name -> list of SetLog from the most recent session
     * containing that exercise. Used to populate the PREVIOUS column in active session.
     */
    suspend operator fun invoke(
        userId: String,
        exerciseNames: List<String>
    ): Result<Map<String, List<SetLog>>> =
        workoutRepository.getLastLogsForExercises(userId, exerciseNames)
}
```

- [ ] **Step 3: Create CheckPersonalRecordUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.repository.WorkoutRepository

class CheckPersonalRecordUseCase(
    private val workoutRepository: WorkoutRepository,
    private val calculate1RM: CalculateEstimated1RMUseCase
) {
    /**
     * Checks if a completed set beats any existing record for this exercise.
     * Returns a SessionPR if a record is broken, null otherwise.
     */
    suspend operator fun invoke(
        userId: String,
        exerciseName: String,
        weightKg: Float,
        reps: Int
    ): SessionPR? {
        val records = workoutRepository.getExerciseRecords(userId, exerciseName)
            .getOrNull() ?: return null

        // Check heaviest weight
        val currentHeaviest = records.heaviestWeight?.value
            ?.removeSuffix(" kg")?.toFloatOrNull() ?: 0f
        if (weightKg > currentHeaviest) {
            return SessionPR(
                exerciseName = exerciseName,
                record = "${formatWeightKg(weightKg)}kg x $reps"
            )
        }

        // Check estimated 1RM
        val new1RM = calculate1RM(weightKg, reps)
        val current1RM = records.highestEstimated1RM?.value
            ?.removeSuffix(" kg")?.toFloatOrNull() ?: 0f
        if (new1RM != null && new1RM > current1RM) {
            return SessionPR(
                exerciseName = exerciseName,
                record = "${formatWeightKg(weightKg)}kg x $reps (1RM: ${formatWeightKg(new1RM)}kg)"
            )
        }

        return null
    }
}
```

- [ ] **Step 4: Create GetExerciseHistoryUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetExerciseHistoryUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String
    ): Result<List<ExerciseLog>> =
        workoutRepository.getExerciseHistory(userId, exerciseName)
}
```

- [ ] **Step 5: Create GetExerciseRecordsUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.repository.WorkoutRepository

class GetExerciseRecordsUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String
    ): Result<ExerciseRecords> =
        workoutRepository.getExerciseRecords(userId, exerciseName)
}
```

- [ ] **Step 6: Create GetProgressDashboardUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayCompletion
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.MuscleVolumeEntry
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

class GetProgressDashboardUseCase(
    private val workoutRepository: WorkoutRepository
) {
    data class DashboardData(
        val weeklyCompletions: List<DayCompletion>,
        val totalVolumeThisWeek: Float,
        val currentStreak: Int,
        val muscleDistribution: List<MuscleVolumeEntry>,
        val recentPRs: List<PersonalRecord>,
    )

    suspend operator fun invoke(userId: String): Result<DashboardData> = runCatching {
        val history = workoutRepository.getWorkoutHistory(userId).getOrThrow()
        val streak = workoutRepository.getCurrentStreak(userId).getOrDefault(0)
        val recentPRs = workoutRepository.getRecentPersonalRecords(userId, 5).getOrDefault(emptyList())

        val tz = TimeZone.currentSystemDefault()
        val now = Clock.System.now()
        val today = now.toLocalDateTime(tz).date
        val todayDow = today.dayOfWeek.ordinal // Monday=0

        // Weekly completions for current week
        val thisWeekStart = kotlinx.datetime.LocalDate.fromEpochDays(today.toEpochDays() - todayDow)
        val thisWeekLogs = history.filter { log ->
            val logDate = log.loggedAt.toLocalDateTime(tz).date
            logDate.toEpochDays() >= thisWeekStart.toEpochDays() &&
                logDate.toEpochDays() <= today.toEpochDays()
        }
        val completedDays = thisWeekLogs.map { it.loggedAt.toLocalDateTime(tz).date.dayOfWeek.ordinal }.toSet()

        val weeklyCompletions = DayOfWeek.entries.map { day ->
            val status = when {
                day.index in completedDays -> CompletionStatus.COMPLETED
                day.index == todayDow -> CompletionStatus.TODAY
                day.index < todayDow -> CompletionStatus.MISSED
                else -> CompletionStatus.UPCOMING
            }
            DayCompletion(dayOfWeek = day, status = status)
        }

        // Total volume this week
        val totalVolume = thisWeekLogs.sumOf { log ->
            log.exerciseLogs.sumOf { ex ->
                ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }
            }
        }.toFloat()

        // Muscle distribution from this week's logs
        // Build muscle group lookup from assigned workouts
        val workouts = workoutRepository.getAssignedWorkouts(userId).getOrDefault(emptyList())
        val muscleGroupByExerciseName = workouts.flatMap { it.exercises }
            .associate { it.name to (it.muscleGroup ?: "Other") }

        val volumeByMuscle = mutableMapOf<String, Float>()
        for (log in thisWeekLogs) {
            for (ex in log.exerciseLogs) {
                val muscle = muscleGroupByExerciseName[ex.exerciseName] ?: "Other"
                val vol = ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }.toFloat()
                volumeByMuscle[muscle] = (volumeByMuscle[muscle] ?: 0f) + vol
            }
        }
        val totalMuscleVolume = volumeByMuscle.values.sum().coerceAtLeast(1f)
        val muscleDistribution = volumeByMuscle.map { (group, vol) ->
            MuscleVolumeEntry(group, vol, vol / totalMuscleVolume * 100f)
        }.sortedByDescending { it.percentage }

        DashboardData(
            weeklyCompletions = weeklyCompletions,
            totalVolumeThisWeek = totalVolume,
            currentStreak = streak,
            muscleDistribution = muscleDistribution,
            recentPRs = recentPRs,
        )
    }
}
```

- [ ] **Step 7: Create GetWorkoutsPerWeekUseCase**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.repository.WorkoutRepository
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

class GetWorkoutsPerWeekUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        period: TimePeriod
    ): Result<List<WeeklyCount>> {
        val tz = TimeZone.currentSystemDefault()
        val today = Clock.System.now().toLocalDateTime(tz).date
        val daysBack = when (period) {
            TimePeriod.ONE_MONTH -> 30
            TimePeriod.THREE_MONTHS -> 90
            TimePeriod.SIX_MONTHS -> 180
            TimePeriod.ONE_YEAR -> 365
            TimePeriod.ALL -> 365 * 3
        }
        val since = LocalDate.fromEpochDays(today.toEpochDays() - daysBack)
        return workoutRepository.getWorkoutCountByWeek(userId, since)
    }
}
```

- [ ] **Step 8: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 9: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/workout/
git commit -m "feat(domain): add use cases for 1RM calc, PREVIOUS data, PR check, exercise history, dashboard"
```

---

## Task 6: Navigation Routes

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`

- [ ] **Step 1: Add new routes**

Add these after the existing `ExerciseLibrary` route:

```kotlin
@Serializable object ProgressDashboard
@Serializable data class PostWorkoutSummary(val logId: String)
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt
git commit -m "feat(nav): add ProgressDashboard and PostWorkoutSummary routes"
```

---

## Task 7: Active Session — State, Intent, ViewModel

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionState.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionIntent.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/SessionDraft.kt`

- [ ] **Step 1: Add exerciseId to ExerciseDraft in SessionDraft.kt**

In `SessionDraft.kt`, add `exerciseId` to `ExerciseDraft`:

```kotlin
data class ExerciseDraft(
    val exerciseName: String,
    val sets: List<SetDraft>,
    val videoUrl: String? = null,
    val muscleGroup: String? = null,
    val tips: String? = null,
    val exerciseId: String? = null,
    val initialSetsGoal: Int = 3,
    val initialRepsGoal: String = "10"
)
```

Update the `WorkoutExercise.toDraft()` function to include `exerciseId`:

```kotlin
fun WorkoutExercise.toDraft(): ExerciseDraft {
    val repsGoal = reps.substringBefore('-').filter { it.isDigit() }.toIntOrNull()
    return ExerciseDraft(
        exerciseName = name,
        initialSetsGoal = sets,
        initialRepsGoal = reps,
        videoUrl = videoUrl,
        muscleGroup = muscleGroup,
        tips = tips,
        exerciseId = exerciseId,
        sets = (1..sets).map { order ->
            SetDraft(
                sortOrder = order,
                targetReps = repsGoal,
                actualReps = null,
                targetWeightKg = null,
                actualWeightKg = null,
                rpe = null,
                targetRestSeconds = restSeconds,
                actualRestSeconds = null
            )
        }
    )
}
```

- [ ] **Step 2: Create ActiveSessionState.kt**

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.SetLog

data class ActiveSessionState(
    val sessionDraft: SessionDraft? = null,
    val currentExerciseIndex: Int = 0,
    val previousData: Map<String, List<SetLog>> = emptyMap(),
    val restTimer: RestTimerState = RestTimerState(),
    val sessionPRs: List<SessionPR> = emptyList(),
    val activePRBanner: SessionPR? = null,
    val sessionStartTime: Long = 0L,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val submittedLogId: String? = null,
    val error: String? = null,
)

data class RestTimerState(
    val isActive: Boolean = false,
    val remainingSeconds: Int = 0,
    val totalSeconds: Int = 0,
)
```

- [ ] **Step 3: Create ActiveSessionIntent.kt**

```kotlin
package com.coachfoska.app.presentation.workout

sealed interface ActiveSessionIntent {
    data class InitSession(val workoutId: String) : ActiveSessionIntent
    data class SwitchExercise(val index: Int) : ActiveSessionIntent
    data class UpdateSetActual(
        val exerciseIndex: Int,
        val setIndex: Int,
        val reps: Int?,
        val weight: Float?,
    ) : ActiveSessionIntent
    data class MarkSetComplete(
        val exerciseIndex: Int,
        val setIndex: Int,
        val completed: Boolean,
    ) : ActiveSessionIntent
    data class AddExtraSet(val exerciseIndex: Int) : ActiveSessionIntent
    data class RemoveSet(val exerciseIndex: Int, val setIndex: Int) : ActiveSessionIntent
    data class AddExerciseNote(val exerciseIndex: Int, val note: String) : ActiveSessionIntent
    data class StartRestTimer(val seconds: Int) : ActiveSessionIntent
    data object SkipRestTimer : ActiveSessionIntent
    data class AdjustRestTimer(val deltaSeconds: Int) : ActiveSessionIntent
    data object DismissPRBanner : ActiveSessionIntent
    data class SubmitSession(val notes: String?) : ActiveSessionIntent
    data object DismissError : ActiveSessionIntent
}
```

- [ ] **Step 4: Create ActiveSessionViewModel.kt**

```kotlin
package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.core.util.currentInstant
import io.github.aakira.napier.Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ActiveSessionVM"

class ActiveSessionViewModel(
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getPreviousLogsUseCase: GetPreviousExerciseLogsUseCase,
    private val checkPRUseCase: CheckPersonalRecordUseCase,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ActiveSessionState())
    val state: StateFlow<ActiveSessionState> = _state.asStateFlow()

    private var timerJob: Job? = null

    fun onIntent(intent: ActiveSessionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            is ActiveSessionIntent.InitSession -> initSession(intent.workoutId)
            is ActiveSessionIntent.SwitchExercise -> switchExercise(intent.index)
            is ActiveSessionIntent.UpdateSetActual -> updateSet(intent)
            is ActiveSessionIntent.MarkSetComplete -> markSetComplete(intent)
            is ActiveSessionIntent.AddExtraSet -> addExtraSet(intent.exerciseIndex)
            is ActiveSessionIntent.RemoveSet -> removeSet(intent.exerciseIndex, intent.setIndex)
            is ActiveSessionIntent.AddExerciseNote -> addNote(intent.exerciseIndex, intent.note)
            is ActiveSessionIntent.StartRestTimer -> startTimer(intent.seconds)
            ActiveSessionIntent.SkipRestTimer -> skipTimer()
            is ActiveSessionIntent.AdjustRestTimer -> adjustTimer(intent.deltaSeconds)
            ActiveSessionIntent.DismissPRBanner -> _state.update { it.copy(activePRBanner = null) }
            is ActiveSessionIntent.SubmitSession -> submitSession(intent.notes)
            ActiveSessionIntent.DismissError -> _state.update { it.copy(error = null) }
        }
    }

    private fun initSession(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId).onSuccess { workout ->
                val draft = workout.toDraft(currentInstant().toEpochMilliseconds())
                _state.update {
                    it.copy(
                        sessionDraft = draft,
                        sessionStartTime = draft.startTime,
                        isLoading = false,
                    )
                }
                // Load PREVIOUS data in the background
                loadPreviousData(draft.exercises.map { it.exerciseName })
            }.onFailure { e ->
                _state.update { it.copy(error = e.message, isLoading = false) }
            }
        }
    }

    private fun loadPreviousData(exerciseNames: List<String>) {
        viewModelScope.launch {
            getPreviousLogsUseCase(userId, exerciseNames).onSuccess { data ->
                _state.update { it.copy(previousData = data) }
            }.onFailure { e ->
                Napier.e("Failed to load PREVIOUS data", e, tag = TAG)
            }
        }
    }

    private fun switchExercise(index: Int) {
        val draft = _state.value.sessionDraft ?: return
        if (index in draft.exercises.indices) {
            _state.update { it.copy(currentExerciseIndex = index) }
        }
    }

    private fun updateSet(intent: ActiveSessionIntent.UpdateSetActual) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(
                actualReps = intent.reps,
                actualWeightKg = intent.weight,
            )
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun markSetComplete(intent: ActiveSessionIntent.MarkSetComplete) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[intent.exerciseIndex]
            val updatedSets = ex.sets.toMutableList()
            updatedSets[intent.setIndex] = updatedSets[intent.setIndex].copy(completed = intent.completed)
            updatedEx[intent.exerciseIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }

        if (intent.completed) {
            val draft = _state.value.sessionDraft ?: return
            val set = draft.exercises[intent.exerciseIndex].sets[intent.setIndex]
            val weight = set.actualWeightKg
            val reps = set.actualReps
            val restSeconds = set.targetRestSeconds

            // Start rest timer if there are remaining sets
            if (restSeconds != null && restSeconds > 0) {
                val exerciseSets = draft.exercises[intent.exerciseIndex].sets
                val hasUncompletedSets = exerciseSets.any { !it.completed && it.sortOrder > set.sortOrder }
                if (hasUncompletedSets) {
                    startTimer(restSeconds)
                }
            }

            // Auto-fill next set weight
            if (weight != null) {
                val nextSetIndex = intent.setIndex + 1
                val exerciseSets = draft.exercises[intent.exerciseIndex].sets
                if (nextSetIndex < exerciseSets.size && !exerciseSets[nextSetIndex].completed) {
                    val nextSet = exerciseSets[nextSetIndex]
                    if (nextSet.actualWeightKg == null) {
                        _state.update { s ->
                            val d = s.sessionDraft ?: return@update s
                            val exList = d.exercises.toMutableList()
                            val currentEx = exList[intent.exerciseIndex]
                            val setsList = currentEx.sets.toMutableList()
                            setsList[nextSetIndex] = setsList[nextSetIndex].copy(actualWeightKg = weight)
                            exList[intent.exerciseIndex] = currentEx.copy(sets = setsList)
                            s.copy(sessionDraft = d.copy(exercises = exList))
                        }
                    }
                }
            }

            // Check for PR
            if (weight != null && reps != null && weight > 0f && reps > 0) {
                checkForPR(draft.exercises[intent.exerciseIndex].exerciseName, weight, reps)
            }

            // Auto-advance to next exercise if all sets complete
            checkAutoAdvance(intent.exerciseIndex)
        }
    }

    private fun checkForPR(exerciseName: String, weight: Float, reps: Int) {
        viewModelScope.launch {
            val pr = checkPRUseCase(userId, exerciseName, weight, reps)
            if (pr != null) {
                _state.update { s ->
                    s.copy(
                        sessionPRs = s.sessionPRs + pr,
                        activePRBanner = pr,
                    )
                }
                // Auto-dismiss after 3 seconds
                delay(3000)
                _state.update { it.copy(activePRBanner = null) }
            }
        }
    }

    private fun checkAutoAdvance(exerciseIndex: Int) {
        val draft = _state.value.sessionDraft ?: return
        val exercise = draft.exercises[exerciseIndex]
        if (exercise.sets.all { it.completed }) {
            val nextIncomplete = draft.exercises.indexOfFirst { ex ->
                ex.sets.any { !it.completed }
            }
            if (nextIncomplete >= 0 && nextIncomplete != exerciseIndex) {
                viewModelScope.launch {
                    delay(1000) // 1s delay before auto-advance
                    _state.update { it.copy(currentExerciseIndex = nextIncomplete) }
                }
            }
        }
    }

    private fun addExtraSet(exIndex: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[exIndex]
            val lastSet = ex.sets.lastOrNull()
            val newSet = SetDraft(
                sortOrder = (lastSet?.sortOrder ?: 0) + 1,
                targetReps = lastSet?.targetReps,
                actualReps = null,
                targetWeightKg = lastSet?.targetWeightKg,
                actualWeightKg = lastSet?.actualWeightKg,
                rpe = null,
                targetRestSeconds = lastSet?.targetRestSeconds,
                actualRestSeconds = null,
            )
            updatedEx[exIndex] = ex.copy(sets = ex.sets + newSet)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun removeSet(exIndex: Int, setIndex: Int) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            val ex = updatedEx[exIndex]
            if (ex.sets.size <= 1) return@update s
            val updatedSets = ex.sets.toMutableList().apply { removeAt(setIndex) }
                .mapIndexed { i, set -> set.copy(sortOrder = i + 1) }
            updatedEx[exIndex] = ex.copy(sets = updatedSets)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    private fun addNote(exIndex: Int, note: String) {
        _state.update { s ->
            val draft = s.sessionDraft ?: return@update s
            val updatedEx = draft.exercises.toMutableList()
            updatedEx[exIndex] = updatedEx[exIndex].copy(tips = note)
            s.copy(sessionDraft = draft.copy(exercises = updatedEx))
        }
    }

    // ── Rest Timer ──────────────────────────────────────────────────────

    private fun startTimer(seconds: Int) {
        timerJob?.cancel()
        _state.update {
            it.copy(restTimer = RestTimerState(isActive = true, remainingSeconds = seconds, totalSeconds = seconds))
        }
        timerJob = viewModelScope.launch {
            while (_state.value.restTimer.remainingSeconds > 0) {
                delay(1000)
                _state.update { s ->
                    val remaining = (s.restTimer.remainingSeconds - 1).coerceAtLeast(0)
                    s.copy(restTimer = s.restTimer.copy(remainingSeconds = remaining))
                }
            }
            // Timer complete
            _state.update { it.copy(restTimer = RestTimerState()) }
        }
    }

    private fun skipTimer() {
        timerJob?.cancel()
        _state.update { it.copy(restTimer = RestTimerState()) }
    }

    private fun adjustTimer(delta: Int) {
        _state.update { s ->
            val newRemaining = (s.restTimer.remainingSeconds + delta).coerceAtLeast(0)
            val newTotal = (s.restTimer.totalSeconds + delta).coerceAtLeast(0)
            s.copy(restTimer = s.restTimer.copy(remainingSeconds = newRemaining, totalSeconds = newTotal))
        }
    }

    // ── Submit ───────────────────────────────────────────────────────────

    private fun submitSession(notes: String?) {
        val draft = _state.value.sessionDraft ?: return

        val exerciseLogs = draft.exercises
            .filter { ex -> ex.sets.any { it.completed } }
            .map { ex ->
                ExerciseLog(
                    id = "", workoutLogId = "",
                    exerciseName = ex.exerciseName, notes = null,
                    videoUrl = ex.videoUrl,
                    sets = ex.sets.filter { it.completed }.map { s ->
                        SetLog(
                            id = "", exerciseLogId = "", sortOrder = s.sortOrder,
                            targetReps = s.targetReps, actualReps = s.actualReps,
                            targetWeightKg = s.targetWeightKg, actualWeightKg = s.actualWeightKg,
                            rpe = s.rpe, targetRestSeconds = s.targetRestSeconds,
                            actualRestSeconds = s.actualRestSeconds, completed = true,
                        )
                    }
                )
            }

        if (exerciseLogs.isEmpty()) {
            _state.update { it.copy(error = "No completed sets to save.") }
            return
        }

        val durationMinutes = ((currentInstant().toEpochMilliseconds() - draft.startTime) / 60_000)
            .toInt().coerceAtLeast(1)

        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true) }
            logWorkoutUseCase(
                userId, draft.workoutId, draft.workoutName,
                durationMinutes, notes, exerciseLogs,
            ).onSuccess { log ->
                _state.update { it.copy(isSubmitting = false, submittedLogId = log.id) }
            }.onFailure { e ->
                _state.update { it.copy(isSubmitting = false, error = e.message) }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
```

- [ ] **Step 5: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionState.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionIntent.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModel.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/SessionDraft.kt
git commit -m "feat(presentation): add ActiveSessionViewModel with rest timer, PR detection, PREVIOUS data"
```

---

## Task 8: Progress Dashboard & Post-Workout Summary ViewModels

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardState.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardViewModel.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/PostWorkoutSummaryViewModel.kt`

- [ ] **Step 1: Create ProgressDashboardState.kt**

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.DayCompletion
import com.coachfoska.app.domain.model.MuscleVolumeEntry
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount

data class ProgressDashboardState(
    val weeklyCompletions: List<DayCompletion> = emptyList(),
    val totalVolumeThisWeek: Float = 0f,
    val currentStreak: Int = 0,
    val muscleDistribution: List<MuscleVolumeEntry> = emptyList(),
    val recentPRs: List<PersonalRecord> = emptyList(),
    val workoutsPerWeek: List<WeeklyCount> = emptyList(),
    val selectedTimePeriod: TimePeriod = TimePeriod.THREE_MONTHS,
    val isLoading: Boolean = false,
    val error: String? = null,
)
```

- [ ] **Step 2: Create ProgressDashboardViewModel.kt**

```kotlin
package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.usecase.workout.GetProgressDashboardUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutsPerWeekUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ProgressDashboardVM"

class ProgressDashboardViewModel(
    private val getProgressDashboardUseCase: GetProgressDashboardUseCase,
    private val getWorkoutsPerWeekUseCase: GetWorkoutsPerWeekUseCase,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ProgressDashboardState())
    val state: StateFlow<ProgressDashboardState> = _state.asStateFlow()

    init {
        loadDashboard()
        loadWorkoutsPerWeek()
    }

    fun onTimePeriodSelected(period: TimePeriod) {
        _state.update { it.copy(selectedTimePeriod = period) }
        loadWorkoutsPerWeek()
    }

    private fun loadDashboard() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getProgressDashboardUseCase(userId).onSuccess { data ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        weeklyCompletions = data.weeklyCompletions,
                        totalVolumeThisWeek = data.totalVolumeThisWeek,
                        currentStreak = data.currentStreak,
                        muscleDistribution = data.muscleDistribution,
                        recentPRs = data.recentPRs,
                    )
                }
            }.onFailure { e ->
                Napier.e("loadDashboard failed", e, tag = TAG)
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private fun loadWorkoutsPerWeek() {
        viewModelScope.launch {
            getWorkoutsPerWeekUseCase(userId, _state.value.selectedTimePeriod)
                .onSuccess { counts ->
                    _state.update { it.copy(workoutsPerWeek = counts) }
                }
                .onFailure { e ->
                    Napier.e("loadWorkoutsPerWeek failed", e, tag = TAG)
                }
        }
    }
}
```

- [ ] **Step 3: Create PostWorkoutSummaryViewModel.kt**

```kotlin
package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private const val TAG = "PostWorkoutSummaryVM"

data class PostWorkoutSummaryState(
    val workoutName: String = "",
    val dateDisplay: String = "",
    val durationMinutes: Int = 0,
    val totalVolumeKg: Float = 0f,
    val setsCompleted: Int = 0,
    val setsTotal: Int = 0,
    val exerciseCount: Int = 0,
    val personalRecords: List<SessionPR> = emptyList(),
    val isLoading: Boolean = false,
)

class PostWorkoutSummaryViewModel(
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val userId: String,
    private val logId: String,
    /** PRs detected during the session, passed from ActiveSessionViewModel via SavedStateHandle or nav arg */
    sessionPRs: List<SessionPR> = emptyList(),
) : ViewModel() {

    private val _state = MutableStateFlow(PostWorkoutSummaryState(personalRecords = sessionPRs))
    val state: StateFlow<PostWorkoutSummaryState> = _state.asStateFlow()

    init {
        loadSummary()
    }

    private fun loadSummary() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutHistoryUseCase(userId).onSuccess { history ->
                val log = history.find { it.id == logId }
                if (log != null) {
                    val tz = TimeZone.currentSystemDefault()
                    val localDate = log.loggedAt.toLocalDateTime(tz).date

                    val totalVolume = log.exerciseLogs.sumOf { ex ->
                        ex.sets.filter { it.completed }.sumOf { s ->
                            ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                        }
                    }.toFloat()

                    val setsCompleted = log.exerciseLogs.sumOf { it.setsCompletedCount }
                    val setsTotal = log.exerciseLogs.sumOf { it.sets.size }

                    _state.update {
                        it.copy(
                            isLoading = false,
                            workoutName = log.workoutName,
                            dateDisplay = "${localDate.month.name.lowercase().replaceFirstChar { c -> c.uppercase() }} ${localDate.dayOfMonth}, ${localDate.year}",
                            durationMinutes = log.durationMinutes,
                            totalVolumeKg = totalVolume,
                            setsCompleted = setsCompleted,
                            setsTotal = setsTotal,
                            exerciseCount = log.exerciseLogs.size,
                        )
                    }
                } else {
                    _state.update { it.copy(isLoading = false) }
                }
            }.onFailure { e ->
                Napier.e("loadSummary failed", e, tag = TAG)
                _state.update { it.copy(isLoading = false) }
            }
        }
    }
}
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardState.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardViewModel.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/PostWorkoutSummaryViewModel.kt
git commit -m "feat(presentation): add ProgressDashboard and PostWorkoutSummary ViewModels"
```

---

## Task 9: DI Registration

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`

- [ ] **Step 1: Add imports for new use cases and ViewModels**

Add these imports at the top of `AppModule.kt`:

```kotlin
import com.coachfoska.app.domain.usecase.workout.CalculateEstimated1RMUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseRecordsUseCase
import com.coachfoska.app.domain.usecase.workout.GetProgressDashboardUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutsPerWeekUseCase
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.presentation.workout.ProgressDashboardViewModel
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModel
```

- [ ] **Step 2: Register new use cases in useCaseModule**

Add after the existing workout use cases (`factory { GetWorkoutHistoryUseCase(get()) }`):

```kotlin
    // Workout analytics
    factory { CalculateEstimated1RMUseCase() }
    factory { GetPreviousExerciseLogsUseCase(get()) }
    factory { CheckPersonalRecordUseCase(get(), get()) }
    factory { GetExerciseHistoryUseCase(get()) }
    factory { GetExerciseRecordsUseCase(get()) }
    factory { GetProgressDashboardUseCase(get()) }
    factory { GetWorkoutsPerWeekUseCase(get()) }
```

- [ ] **Step 3: Register new ViewModels in viewModelModule**

Add after the existing `WorkoutViewModel` registration:

```kotlin
    viewModel { (userId: String, workoutId: String) ->
        ActiveSessionViewModel(get(), get(), get(), get(), userId)
    }
    viewModel { (userId: String) ->
        ProgressDashboardViewModel(get(), get(), userId)
    }
    viewModel { (userId: String, logId: String) ->
        PostWorkoutSummaryViewModel(get(), userId, logId)
    }
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt
git commit -m "feat(di): register new workout use cases and ViewModels in Koin"
```

---

## Task 10: Active Session — Reusable UI Components

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/SetRow.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/RestTimerBar.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/ExerciseTabStrip.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/PRBanner.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/SessionHeaderBar.kt`

- [ ] **Step 1: Create SetRow.kt — the redesigned set logging row with PREVIOUS column**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.ui.components.CoachTextField

@Composable
fun SetTableHeader(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("SET", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp))
        Text("PREV", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(64.dp))
        Text("KG", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(56.dp), textAlign = TextAlign.Center)
        Text("REPS", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(48.dp), textAlign = TextAlign.Center)
        Spacer(Modifier.weight(1f))
        Text("✓", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp), textAlign = TextAlign.Center)
    }
}

@Composable
fun SetRow(
    setDraft: SetDraft,
    previousSetLog: SetLog?,
    isNextSet: Boolean,
    isWarmup: Boolean,
    onWeightChange: (Float?) -> Unit,
    onRepsChange: (Int?) -> Unit,
    onCompleted: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val completedBg by animateColorAsState(
        targetValue = if (setDraft.completed) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
        else Color.Transparent,
        animationSpec = tween(200),
        label = "setRowBg",
    )
    val borderColor = when {
        isNextSet && !setDraft.completed -> MaterialTheme.colorScheme.primary
        else -> Color.Transparent
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(completedBg)
            .then(
                if (isNextSet && !setDraft.completed)
                    Modifier.border(1.dp, borderColor, RoundedCornerShape(6.dp))
                else Modifier
            )
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // SET column
        val setLabel = if (isWarmup) "W" else "${setDraft.sortOrder}"
        val setColor = if (isWarmup) Color(0xFFFFC107) else MaterialTheme.colorScheme.onSurface
        Text(
            text = setLabel,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = setColor,
            modifier = Modifier.width(32.dp),
        )

        // PREV column
        val prevText = previousSetLog?.let { prev ->
            val w = prev.actualWeightKg?.let { formatWeightKg(it) } ?: "?"
            val r = prev.actualReps?.toString() ?: "?"
            "$w x $r"
        } ?: "-"
        Text(
            text = prevText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(64.dp),
        )

        // KG column
        CoachTextField(
            value = setDraft.actualWeightKg?.let { formatWeightKg(it) } ?: "",
            onValueChange = { onWeightChange(it.toFloatOrNull()) },
            label = "",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.width(56.dp),
            singleLine = true,
        )

        // REPS column
        CoachTextField(
            value = setDraft.actualReps?.toString() ?: "",
            onValueChange = { onRepsChange(it.toIntOrNull()) },
            label = "",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(48.dp),
            singleLine = true,
        )

        Spacer(Modifier.weight(1f))

        // Checkmark
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(
                    if (setDraft.completed) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceVariant
                )
                .clickable { onCompleted() },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (setDraft.completed) "✓" else "",
                color = if (setDraft.completed) MaterialTheme.colorScheme.onPrimary
                else MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
        }
    }
}
```

- [ ] **Step 2: Create RestTimerBar.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.presentation.workout.RestTimerState

@Composable
fun RestTimerBar(
    timerState: RestTimerState,
    onAdjust: (Int) -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!timerState.isActive) return

    val progress = if (timerState.totalSeconds > 0) {
        1f - (timerState.remainingSeconds.toFloat() / timerState.totalSeconds)
    } else 0f

    val minutes = timerState.remainingSeconds / 60
    val seconds = timerState.remainingSeconds % 60
    val timeText = "%d:%02d".format(minutes, seconds)

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = "REST TIME",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                        ),
                        color = MaterialTheme.colorScheme.primary,
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(onClick = { onAdjust(-30) }) { Text("-30s") }
                    TextButton(onClick = { onAdjust(30) }) { Text("+30s") }
                    TextButton(onClick = onSkip) {
                        Text("Skip", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(4.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }
    }
}
```

- [ ] **Step 3: Create ExerciseTabStrip.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.workout.ExerciseDraft

@Composable
fun ExerciseTabStrip(
    exercises: List<ExerciseDraft>,
    currentIndex: Int,
    onExerciseSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberLazyListState()

    LaunchedEffect(currentIndex) {
        listState.animateScrollToItem(currentIndex)
    }

    LazyRow(
        state = listState,
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
    ) {
        itemsIndexed(exercises) { index, exercise ->
            val isSelected = index == currentIndex
            val isCompleted = exercise.sets.all { it.completed }

            FilterChip(
                selected = isSelected,
                onClick = { onExerciseSelected(index) },
                label = { Text(exercise.exerciseName, maxLines = 1) },
                leadingIcon = if (isCompleted) {
                    { Icon(Icons.Default.Check, contentDescription = "Completed", modifier = Modifier) }
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                    selectedLeadingIconColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        }
    }
}
```

- [ ] **Step 4: Create PRBanner.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.SessionPR

@Composable
fun PRBanner(
    pr: SessionPR?,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = pr != null,
        enter = expandVertically() + fadeIn(),
        exit = shrinkVertically() + fadeOut(),
        modifier = modifier,
    ) {
        pr?.let { record ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFF3CD), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("🏆", fontSize = 20.sp)
                Column {
                    Text(
                        text = "Personal Record!",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color(0xFF856404),
                    )
                    Text(
                        text = "${record.exerciseName} — ${record.record}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF856404),
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 5: Create SessionHeaderBar.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.SessionDraft

@Composable
fun SessionHeaderBar(
    draft: SessionDraft?,
    elapsedSeconds: Long,
    onBackClick: () -> Unit,
    onFinishClick: () -> Unit,
    onDiscardClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val minutes = elapsedSeconds / 60
    val seconds = elapsedSeconds % 60
    val timerText = "%d:%02d".format(minutes, seconds)

    // Calculate total volume
    val totalVolume = draft?.exercises?.sumOf { ex ->
        ex.sets.filter { it.completed }.sumOf { s ->
            ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
        }
    }?.toFloat() ?: 0f
    val volumeText = if (totalVolume >= 1000f) {
        "${formatWeightKg(totalVolume / 1000f)}t"
    } else {
        "${formatWeightKg(totalVolume)}kg"
    }

    TopAppBar(
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = draft?.workoutName?.uppercase() ?: "WORKOUT",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                )
                Text(
                    text = timerText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = volumeText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        },
        actions = {
            Box {
                IconButton(onClick = { menuExpanded = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = "More options")
                }
                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Finish workout") },
                        onClick = { menuExpanded = false; onFinishClick() },
                    )
                    DropdownMenuItem(
                        text = { Text("Discard workout", color = MaterialTheme.colorScheme.error) },
                        onClick = { menuExpanded = false; onDiscardClick() },
                    )
                }
            }
        },
        modifier = modifier,
    )
}
```

- [ ] **Step 6: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/
git commit -m "feat(ui): add SetRow, RestTimerBar, ExerciseTabStrip, PRBanner, SessionHeaderBar components"
```

---

## Task 11: Active Session Screen — Full Redesign

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActiveSessionScreen.kt`

- [ ] **Step 1: Replace ActiveSessionScreen with the redesigned version**

Replace the entire contents of `ActiveSessionScreen.kt` with:

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.presentation.workout.ActiveSessionIntent
import com.coachfoska.app.presentation.workout.ActiveSessionState
import com.coachfoska.app.presentation.workout.ActiveSessionViewModel
import com.coachfoska.app.presentation.workout.ExerciseDraft
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.ui.workout.components.*
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActiveSessionRoute(
    workoutId: String,
    userId: String,
    onBackClick: () -> Unit,
    onWorkoutComplete: (logId: String) -> Unit,
    onExerciseDetailClick: (exerciseId: String) -> Unit = {},
    viewModel: ActiveSessionViewModel = koinViewModel { parametersOf(userId, workoutId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(workoutId) {
        viewModel.onIntent(ActiveSessionIntent.InitSession(workoutId))
    }

    LaunchedEffect(state.submittedLogId) {
        state.submittedLogId?.let { logId -> onWorkoutComplete(logId) }
    }

    // Session elapsed timer
    var elapsedSeconds by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.sessionStartTime) {
        if (state.sessionStartTime > 0) {
            while (true) {
                elapsedSeconds = (currentInstant().toEpochMilliseconds() - state.sessionStartTime) / 1000
                delay(1000)
            }
        }
    }

    var showDiscardDialog by remember { mutableStateOf(false) }

    if (showDiscardDialog) {
        AlertDialog(
            onDismissRequest = { showDiscardDialog = false },
            title = { Text("Discard Workout?") },
            text = { Text("Your progress will be lost.") },
            confirmButton = {
                TextButton(onClick = { showDiscardDialog = false; onBackClick() }) {
                    Text("Discard", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardDialog = false }) { Text("Cancel") }
            },
        )
    }

    ActiveSessionScreen(
        state = state,
        elapsedSeconds = elapsedSeconds,
        onIntent = viewModel::onIntent,
        onBackClick = { showDiscardDialog = true },
        onFinishClick = { notes -> viewModel.onIntent(ActiveSessionIntent.SubmitSession(notes)) },
        onExerciseDetailClick = onExerciseDetailClick,
    )
}

@Composable
fun ActiveSessionScreen(
    state: ActiveSessionState,
    elapsedSeconds: Long,
    onIntent: (ActiveSessionIntent) -> Unit,
    onBackClick: () -> Unit,
    onFinishClick: (String?) -> Unit,
    onExerciseDetailClick: (exerciseId: String) -> Unit = {},
) {
    val draft = state.sessionDraft
    var notes by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        SessionHeaderBar(
            draft = draft,
            elapsedSeconds = elapsedSeconds,
            onBackClick = onBackClick,
            onFinishClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
            onDiscardClick = onBackClick,
        )

        if (draft == null || state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        // Exercise tab strip
        ExerciseTabStrip(
            exercises = draft.exercises,
            currentIndex = state.currentExerciseIndex,
            onExerciseSelected = { onIntent(ActiveSessionIntent.SwitchExercise(it)) },
        )

        HorizontalDivider()

        // Current exercise content
        val currentExercise = draft.exercises.getOrNull(state.currentExerciseIndex) ?: return@Column
        val previousSets = state.previousData[currentExercise.exerciseName].orEmpty()

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Exercise info header
            Text(
                text = currentExercise.exerciseName,
                style = MaterialTheme.typography.titleMedium,
            )
            val subtitle = buildString {
                currentExercise.muscleGroup?.let { append("$it · ") }
                append("${currentExercise.initialSetsGoal} × ${currentExercise.initialRepsGoal}")
                currentExercise.sets.firstOrNull()?.targetRestSeconds?.let { append(" · ${it}s rest") }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            currentExercise.tips?.let { tips ->
                Text(
                    text = tips,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // PR Banner
            PRBanner(pr = state.activePRBanner)

            // Rest Timer
            RestTimerBar(
                timerState = state.restTimer,
                onAdjust = { onIntent(ActiveSessionIntent.AdjustRestTimer(it)) },
                onSkip = { onIntent(ActiveSessionIntent.SkipRestTimer) },
            )

            // Set table
            SetTableHeader()
            HorizontalDivider()

            val firstIncompleteIndex = currentExercise.sets.indexOfFirst { !it.completed }
            currentExercise.sets.forEachIndexed { setIndex, setDraft ->
                val previousSet = previousSets.getOrNull(setIndex)
                val isNext = setIndex == firstIncompleteIndex

                SetRow(
                    setDraft = setDraft,
                    previousSetLog = previousSet,
                    isNextSet = isNext,
                    isWarmup = false,
                    onWeightChange = { weight ->
                        onIntent(ActiveSessionIntent.UpdateSetActual(
                            state.currentExerciseIndex, setIndex, setDraft.actualReps, weight,
                        ))
                    },
                    onRepsChange = { reps ->
                        onIntent(ActiveSessionIntent.UpdateSetActual(
                            state.currentExerciseIndex, setIndex, reps, setDraft.actualWeightKg,
                        ))
                    },
                    onCompleted = {
                        onIntent(ActiveSessionIntent.MarkSetComplete(
                            state.currentExerciseIndex, setIndex, !setDraft.completed,
                        ))
                    },
                )
            }

            TextButton(onClick = { onIntent(ActiveSessionIntent.AddExtraSet(state.currentExerciseIndex)) }) {
                Text("+ ADD SET")
            }

            // Exercise note
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
            )

            // Form guide link
            currentExercise.exerciseId?.let { exId ->
                Surface(
                    onClick = { onExerciseDetailClick(exId) },
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "🏋️ Tap to view form guide →",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            // Finish button on last exercise
            if (state.currentExerciseIndex == draft.exercises.lastIndex) {
                Button(
                    onClick = { onFinishClick(notes.takeIf { it.isNotBlank() }) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.isSubmitting,
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    } else {
                        Text("FINISH WORKOUT")
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActiveSessionScreen.kt
git commit -m "feat(ui): redesign ActiveSessionScreen with tab strip, PREVIOUS column, rest timer, PR banner"
```

---

## Task 12: Activity Hub Screen — Today-First Redesign

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyCalendarStrip.kt`

- [ ] **Step 1: Create WeeklyCalendarStrip.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayCompletion

@Composable
fun WeeklyCalendarStrip(
    completions: List<DayCompletion>,
    modifier: Modifier = Modifier,
) {
    val completedCount = completions.count { it.status == CompletionStatus.COMPLETED }
    val totalDays = completions.size

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "This Week",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "$completedCount/$totalDays workouts",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.primary,
            )
        }

        Spacer(Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            completions.forEach { day ->
                val label = day.dayOfWeek.displayName.take(2)
                val bgColor = when (day.status) {
                    CompletionStatus.COMPLETED -> MaterialTheme.colorScheme.primary
                    CompletionStatus.TODAY -> MaterialTheme.colorScheme.primaryContainer
                    CompletionStatus.MISSED -> MaterialTheme.colorScheme.surfaceVariant
                    CompletionStatus.UPCOMING -> Color.Transparent
                }
                val textColor = when (day.status) {
                    CompletionStatus.COMPLETED -> MaterialTheme.colorScheme.onPrimary
                    CompletionStatus.TODAY -> MaterialTheme.colorScheme.onPrimaryContainer
                    else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                }
                val symbol = when (day.status) {
                    CompletionStatus.COMPLETED -> "✓"
                    CompletionStatus.MISSED -> "-"
                    else -> label
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp)
                        .background(bgColor, RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = symbol,
                        style = MaterialTheme.typography.labelSmall,
                        color = textColor,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 2: Replace ActivityHubScreen with the today-first layout**

Replace the entire contents of `ActivityHubScreen.kt` with:

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.domain.model.*
import com.coachfoska.app.presentation.workout.WorkoutIntent
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.workout.components.WeeklyCalendarStrip
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActivityHubRoute(
    userId: String,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onHistoryDetailClick: (logId: String) -> Unit = {},
    onLibraryClick: () -> Unit,
    onLogGeneralActivityClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    ActivityHubScreen(
        state = state,
        onStartWorkout = onStartWorkout,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onHistoryDetailClick = onHistoryDetailClick,
        onLibraryClick = onLibraryClick,
        onLogGeneralActivityClick = onLogGeneralActivityClick,
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onStartWorkout: (workoutId: String) -> Unit,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onHistoryDetailClick: (logId: String) -> Unit = {},
    onLibraryClick: () -> Unit,
    onLogGeneralActivityClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        Text(
            text = "ACTIVITY",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(vertical = 24.dp),
        )

        // Hero workout card — today's workout
        val todayWorkout = findTodayWorkout(state.workouts)

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                if (todayWorkout != null) {
                    Text(
                        text = "🏋️ Today's Workout",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                    Text(
                        text = todayWorkout.name,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Spacer(Modifier.height(4.dp))

                    val details = buildString {
                        append("${todayWorkout.exercises.size} exercises")
                        if (todayWorkout.durationMinutes > 0) append(" · ~${todayWorkout.durationMinutes} min")
                        val muscles = todayWorkout.exercises.mapNotNull { it.muscleGroup }.distinct()
                        if (muscles.isNotEmpty()) append(" · ${muscles.joinToString(", ")}")
                    }
                    Text(
                        text = details,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )

                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = { onStartWorkout(todayWorkout.id) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("▶ START WORKOUT")
                    }
                } else {
                    Text(
                        text = "Rest Day",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        text = "No workout scheduled for today. Browse the library or log an activity.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // Weekly calendar strip
        val weeklyCompletions = buildWeeklyCompletions(state.workoutHistory)
        WeeklyCalendarStrip(completions = weeklyCompletions)

        Spacer(Modifier.height(20.dp))

        // Recent sessions
        Text(
            text = "Recent Sessions",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(8.dp))

        val recentLogs = state.workoutHistory.take(3)
        if (recentLogs.isEmpty()) {
            Text(
                text = "No sessions logged yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            recentLogs.forEach { log ->
                Surface(
                    onClick = { onHistoryDetailClick(log.id) },
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = log.workoutName,
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "${log.durationMinutes} min",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            TextButton(onClick = onHistoryClick) {
                Text("See all history →")
            }
        }

        Spacer(Modifier.height(16.dp))

        // Quick action cards
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedCard(
                onClick = onLibraryClick,
                modifier = Modifier.weight(1f).height(80.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("📚", style = MaterialTheme.typography.titleMedium)
                    Text("Exercise Library", style = MaterialTheme.typography.labelMedium)
                }
            }
            OutlinedCard(
                onClick = onLogGeneralActivityClick,
                modifier = Modifier.weight(1f).height(80.dp),
                shape = RoundedCornerShape(12.dp),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text("➕", style = MaterialTheme.typography.titleMedium)
                    Text("Log Activity", style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        Spacer(Modifier.height(24.dp))
    }
}

/** Finds the workout assigned for today's day of the week. */
private fun findTodayWorkout(workouts: List<Workout>): Workout? {
    val tz = TimeZone.currentSystemDefault()
    val todayIndex = Clock.System.now().toLocalDateTime(tz).date.dayOfWeek.ordinal
    return workouts.firstOrNull { it.dayOfWeek?.index == todayIndex }
}

/** Builds a weekly completion list from workout history for the current week. */
private fun buildWeeklyCompletions(history: List<WorkoutLog>): List<DayCompletion> {
    val tz = TimeZone.currentSystemDefault()
    val today = Clock.System.now().toLocalDateTime(tz).date
    val todayDow = today.dayOfWeek.ordinal
    val completedDays = history
        .map { it.loggedAt.toLocalDateTime(tz).date }
        .filter { it.toEpochDays() >= today.toEpochDays() - todayDow && it.toEpochDays() <= today.toEpochDays() }
        .map { it.dayOfWeek.ordinal }
        .toSet()

    return DayOfWeek.entries.map { day ->
        val status = when {
            day.index in completedDays -> CompletionStatus.COMPLETED
            day.index == todayDow -> CompletionStatus.TODAY
            day.index < todayDow -> CompletionStatus.MISSED
            else -> CompletionStatus.UPCOMING
        }
        DayCompletion(dayOfWeek = day, status = status)
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyCalendarStrip.kt
git commit -m "feat(ui): redesign ActivityHub with today-first hero card, weekly calendar, recent sessions"
```

---

## Task 13: Post-Workout Summary Screen

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/PostWorkoutSummaryScreen.kt`

- [ ] **Step 1: Create PostWorkoutSummaryScreen.kt**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryState
import com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModel
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun PostWorkoutSummaryRoute(
    userId: String,
    logId: String,
    onDone: () -> Unit,
    viewModel: PostWorkoutSummaryViewModel = koinViewModel { parametersOf(userId, logId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    PostWorkoutSummaryScreen(state = state, onDone = onDone)
}

@Composable
fun PostWorkoutSummaryScreen(
    state: PostWorkoutSummaryState,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (state.isLoading) {
            CircularProgressIndicator()
            return@Column
        }

        Text("🎉", fontSize = 48.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Workout Complete!",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
        )

        Spacer(Modifier.height(24.dp))

        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = state.workoutName,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                )
                Text(
                    text = state.dateDisplay,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                SummaryStatRow("⏱", "${state.durationMinutes} min")
                SummaryStatRow("📊", "${formatWeightKg(state.totalVolumeKg)} kg volume")
                SummaryStatRow("✅", "${state.setsCompleted}/${state.setsTotal} sets")
                SummaryStatRow("💪", "${state.exerciseCount} exercises")

                if (state.personalRecords.isNotEmpty()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = "🏆 ${state.personalRecords.size} Personal Records",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary,
                    )
                    state.personalRecords.forEach { pr ->
                        Text(
                            text = "${pr.exerciseName} ${pr.record}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("DONE")
        }
    }
}

@Composable
private fun SummaryStatRow(emoji: String, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(emoji, fontSize = 16.sp)
        Text(text, style = MaterialTheme.typography.bodyLarge)
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/PostWorkoutSummaryScreen.kt
git commit -m "feat(ui): add PostWorkoutSummaryScreen with session stats and PR display"
```

---

## Task 14: Progress Dashboard Screen

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ProgressDashboardScreen.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/MuscleDistributionChart.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WorkoutsPerWeekChart.kt`

- [ ] **Step 1: Create MuscleDistributionChart.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.MuscleVolumeEntry

private val chartColors = listOf(
    androidx.compose.ui.graphics.Color(0xFF4CAF50),
    androidx.compose.ui.graphics.Color(0xFF3498DB),
    androidx.compose.ui.graphics.Color(0xFF9B59B6),
    androidx.compose.ui.graphics.Color(0xFFE74C3C),
    androidx.compose.ui.graphics.Color(0xFFFF9800),
    androidx.compose.ui.graphics.Color(0xFF00BCD4),
)

@Composable
fun MuscleDistributionChart(
    entries: List<MuscleVolumeEntry>,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Volume by Muscle Group",
            style = MaterialTheme.typography.titleSmall,
        )
        entries.forEachIndexed { index, entry ->
            val color = chartColors[index % chartColors.size]
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(entry.muscleGroup, style = MaterialTheme.typography.bodySmall)
                    Text("${entry.percentage.toInt()}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(3.dp)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (entry.percentage / 100f).coerceIn(0f, 1f))
                            .height(6.dp)
                            .background(color, RoundedCornerShape(3.dp)),
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 2: Create WorkoutsPerWeekChart.kt**

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.WeeklyCount

@Composable
fun WorkoutsPerWeekChart(
    data: List<WeeklyCount>,
    modifier: Modifier = Modifier,
) {
    if (data.isEmpty()) return

    val maxCount = data.maxOf { it.count }.coerceAtLeast(1)

    Column(modifier = modifier) {
        Text(
            text = "Workouts Per Week",
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth().height(80.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            data.forEach { week ->
                val fraction = week.count.toFloat() / maxCount
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(fraction.coerceIn(0.05f, 1f))
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)),
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 3: Create ProgressDashboardScreen.kt**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.presentation.workout.ProgressDashboardState
import com.coachfoska.app.presentation.workout.ProgressDashboardViewModel
import com.coachfoska.app.ui.components.CoachTopBar
import com.coachfoska.app.ui.workout.components.MuscleDistributionChart
import com.coachfoska.app.ui.workout.components.WeeklyCalendarStrip
import com.coachfoska.app.ui.workout.components.WorkoutsPerWeekChart
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ProgressDashboardRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: ProgressDashboardViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ProgressDashboardScreen(
        state = state,
        onBackClick = onBackClick,
        onTimePeriodSelected = viewModel::onTimePeriodSelected,
    )
}

@Composable
fun ProgressDashboardScreen(
    state: ProgressDashboardState,
    onBackClick: () -> Unit,
    onTimePeriodSelected: (TimePeriod) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "YOUR PROGRESS", onBackClick = onBackClick)

        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Weekly calendar
            WeeklyCalendarStrip(completions = state.weeklyCompletions)

            // Stat cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = formatWeightKg(state.totalVolumeThisWeek),
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text("kg this week", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "🔥 ${state.currentStreak}",
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        )
                        Text("week streak", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // Muscle distribution
            if (state.muscleDistribution.isNotEmpty()) {
                MuscleDistributionChart(entries = state.muscleDistribution)
            }

            // Recent PRs
            if (state.recentPRs.isNotEmpty()) {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "🏆 Recent PRs",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                        )
                        Spacer(Modifier.height(8.dp))
                        state.recentPRs.forEach { pr ->
                            Text(
                                text = "${pr.exerciseName} ${pr.value}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onTertiaryContainer,
                            )
                        }
                    }
                }
            }

            // Workouts per week chart
            if (state.workoutsPerWeek.isNotEmpty()) {
                Column {
                    // Time period selector
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        TimePeriod.entries.forEach { period ->
                            FilterChip(
                                selected = period == state.selectedTimePeriod,
                                onClick = { onTimePeriodSelected(period) },
                                label = {
                                    Text(when (period) {
                                        TimePeriod.ONE_MONTH -> "1M"
                                        TimePeriod.THREE_MONTHS -> "3M"
                                        TimePeriod.SIX_MONTHS -> "6M"
                                        TimePeriod.ONE_YEAR -> "1Y"
                                        TimePeriod.ALL -> "All"
                                    })
                                },
                            )
                        }
                    }
                    WorkoutsPerWeekChart(data = state.workoutsPerWeek)
                }
            }
        }
    }
}
```

- [ ] **Step 4: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ProgressDashboardScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/MuscleDistributionChart.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WorkoutsPerWeekChart.kt
git commit -m "feat(ui): add ProgressDashboard screen with charts, streak, muscle distribution"
```

---

## Task 15: Exercise Detail — Tabbed Layout

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt`

- [ ] **Step 1: Rewrite ExerciseDetailScreen with four tabs**

Replace the entire contents of `ExerciseDetailScreen.kt`:

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.RecordEntry
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.usecase.workout.GetExerciseHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetExerciseRecordsUseCase
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseState
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ExerciseDetailRoute(
    userId: String,
    exerciseId: String,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(exerciseId) {
        viewModel.onIntent(ExerciseIntent.SelectExercise(exerciseId))
    }

    ExerciseDetailScreen(
        state = state,
        userId = userId,
        onBackClick = onBackClick,
        onToggleFavorite = { viewModel.onIntent(ExerciseIntent.ToggleFavorite(exerciseId)) },
    )
}

@Composable
fun ExerciseDetailScreen(
    state: ExerciseState,
    userId: String,
    onBackClick: () -> Unit,
    onToggleFavorite: () -> Unit = {},
) {
    val isFavorite = state.selectedExercise?.id?.let { it in state.favoriteIds } ?: false
    val exercise = state.selectedExercise

    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(
            title = "EXERCISE",
            onBackClick = onBackClick,
            actions = {
                if (exercise != null) {
                    IconButton(onClick = onToggleFavorite) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = if (isFavorite) "Remove from favorites" else "Add to favorites",
                            tint = if (isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        )
                    }
                }
            },
        )

        if (state.isLoadingDetail) {
            CoachLoadingBox(Modifier.weight(1f))
            return@Column
        }

        if (exercise == null) {
            state.error?.let {
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
            return@Column
        }

        // Exercise name header
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)) {
            exercise.category?.let {
                Text(
                    text = it.name.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp,
                )
            }
            Text(
                text = exercise.name,
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            )
        }

        // Tab row
        var selectedTab by remember { mutableIntStateOf(0) }
        val tabTitles = listOf("Guide", "History", "Charts", "Records")
        TabRow(selectedTabIndex = selectedTab) {
            tabTitles.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = { Text(title) },
                )
            }
        }

        // Tab content
        when (selectedTab) {
            0 -> GuideTab(exercise = exercise)
            1 -> HistoryTab(userId = userId, exerciseName = exercise.name)
            2 -> ChartsTab(userId = userId, exerciseName = exercise.name)
            3 -> RecordsTab(userId = userId, exerciseName = exercise.name)
        }
    }
}

@Composable
private fun GuideTab(exercise: com.coachfoska.app.domain.model.Exercise) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ExerciseAnimatedImage(
            startUrl = exercise.imageUrl,
            endUrl = exercise.imageUrl2,
            modifier = Modifier.fillMaxWidth(),
        )

        if (exercise.muscles.isNotEmpty() || exercise.musclesSecondary.isNotEmpty()) {
            InfoSection(title = "MUSCLES") {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (exercise.muscles.isNotEmpty()) {
                        Text("Primary: ${exercise.muscles.joinToString(", ")}", style = MaterialTheme.typography.bodyLarge)
                    }
                    if (exercise.musclesSecondary.isNotEmpty()) {
                        Text("Secondary: ${exercise.musclesSecondary.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f))
                    }
                }
            }
        }

        if (exercise.equipment.isNotEmpty()) {
            InfoSection(title = "EQUIPMENT") {
                Text(exercise.equipment.joinToString(", "), style = MaterialTheme.typography.bodyLarge)
            }
        }

        if (exercise.description.isNotBlank()) {
            InfoSection(title = "INSTRUCTIONS") {
                Text(exercise.description, style = MaterialTheme.typography.bodyLarge.copy(lineHeight = 24.sp), color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f))
            }
        }
    }
}

@Composable
private fun HistoryTab(userId: String, exerciseName: String) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseHistoryUseCase(userId, exerciseName).onSuccess { history = it }
        isLoading = false
    }

    if (isLoading) {
        CoachLoadingBox(Modifier.fillMaxSize())
        return
    }

    if (history.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("No history for this exercise yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        history.forEach { exerciseLog ->
            Card(shape = RoundedCornerShape(8.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "${exerciseLog.setsCompletedCount} sets completed",
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    )
                    if (exerciseLog.summaryLine.isNotBlank()) {
                        Text(
                            text = exerciseLog.summaryLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChartsTab(userId: String, exerciseName: String) {
    val getExerciseHistoryUseCase = koinInject<GetExerciseHistoryUseCase>()
    var history by remember { mutableStateOf<List<ExerciseLog>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedMetric by remember { mutableStateOf("Heaviest Weight") }
    var selectedPeriod by remember { mutableStateOf("3M") }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseHistoryUseCase(userId, exerciseName).onSuccess { history = it }
        isLoading = false
    }

    if (isLoading) {
        CoachLoadingBox(Modifier.fillMaxSize())
        return
    }

    if (history.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("No data to chart yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Time filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("1M", "3M", "6M", "1Y", "All").forEach { period ->
                FilterChip(
                    selected = period == selectedPeriod,
                    onClick = { selectedPeriod = period },
                    label = { Text(period) },
                )
            }
        }

        // Data points: extract heaviest weight per session
        val dataPoints = history.mapNotNull { log ->
            val completedSets = log.sets.filter { it.completed }
            if (completedSets.isEmpty()) return@mapNotNull null
            when (selectedMetric) {
                "Heaviest Weight" -> completedSets.maxOfOrNull { it.actualWeightKg ?: 0f }
                "Est. 1RM" -> completedSets.maxOfOrNull { s ->
                    val w = s.actualWeightKg ?: return@maxOfOrNull 0f
                    val r = s.actualReps ?: return@maxOfOrNull 0f
                    if (r in 1..30) w * (1f + r / 30f) else w
                }
                "Best Volume" -> completedSets.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }.toFloat()
                else -> completedSets.maxOfOrNull { (it.actualReps ?: 0).toFloat() }
            } ?: 0f
        }

        // Simple Canvas line chart
        if (dataPoints.isNotEmpty()) {
            val primary = MaterialTheme.colorScheme.primary
            val surfaceVariant = MaterialTheme.colorScheme.surfaceVariant
            val maxVal = dataPoints.max().coerceAtLeast(1f)
            val minVal = dataPoints.min()

            Text(selectedMetric, style = MaterialTheme.typography.titleSmall)
            androidx.compose.foundation.Canvas(
                modifier = Modifier.fillMaxWidth().height(160.dp)
            ) {
                val w = size.width
                val h = size.height
                val padding = 8f
                val chartW = w - padding * 2
                val chartH = h - padding * 2
                val range = (maxVal - minVal).coerceAtLeast(1f)

                // Grid lines
                for (i in 0..3) {
                    val y = padding + chartH * (i / 3f)
                    drawLine(surfaceVariant, start = androidx.compose.ui.geometry.Offset(padding, y), end = androidx.compose.ui.geometry.Offset(w - padding, y), strokeWidth = 1f)
                }

                // Line
                if (dataPoints.size > 1) {
                    val step = chartW / (dataPoints.size - 1)
                    val path = androidx.compose.ui.graphics.Path()
                    dataPoints.forEachIndexed { i, value ->
                        val x = padding + step * i
                        val y = padding + chartH * (1f - (value - minVal) / range)
                        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                    }
                    drawPath(path, color = primary, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.5f))

                    // Dots
                    dataPoints.forEachIndexed { i, value ->
                        val x = padding + step * i
                        val y = padding + chartH * (1f - (value - minVal) / range)
                        drawCircle(primary, radius = 4f, center = androidx.compose.ui.geometry.Offset(x, y))
                    }
                }
            }
        }

        // Metric toggle chips
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Heaviest Weight", "Est. 1RM", "Best Volume", "# of Reps").forEach { metric ->
                FilterChip(
                    selected = metric == selectedMetric,
                    onClick = { selectedMetric = metric },
                    label = { Text(metric, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }
    }
}

@Composable
private fun RecordsTab(userId: String, exerciseName: String) {
    val getExerciseRecordsUseCase = koinInject<GetExerciseRecordsUseCase>()
    var records by remember { mutableStateOf<ExerciseRecords?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(exerciseName) {
        isLoading = true
        getExerciseRecordsUseCase(userId, exerciseName).onSuccess { records = it }
        isLoading = false
    }

    if (isLoading) {
        CoachLoadingBox(Modifier.fillMaxSize())
        return
    }

    val r = records
    if (r == null || listOfNotNull(r.heaviestWeight, r.mostRepsAtWeight, r.highestEstimated1RM, r.highestVolume).isEmpty()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("No records yet. Start logging!", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        r.heaviestWeight?.let { RecordCard("🏆 Heaviest Weight", it) }
        r.mostRepsAtWeight?.let { RecordCard("💪 Most Reps", it) }
        r.highestEstimated1RM?.let { RecordCard("📈 Best Est. 1RM", it) }
        r.highestVolume?.let { RecordCard("📊 Highest Volume", it) }
    }
}

@Composable
private fun RecordCard(title: String, entry: RecordEntry) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(entry.value, style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
            Text(entry.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(entry.date.toString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun InfoSection(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f), letterSpacing = 1.5.sp)
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f), modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.padding(20.dp)) { content() }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt
git commit -m "feat(ui): redesign ExerciseDetail with Guide/History/Charts/Records tabs"
```

---

## Task 16: Workout History Refinements

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutHistoryScreen.kt`

- [ ] **Step 1: Add Progress Dashboard link and enhanced cards**

Replace the `WorkoutHistoryScreen` composable (keep imports and Route):

```kotlin
@Composable
fun WorkoutHistoryScreen(
    state: WorkoutState,
    onBackClick: () -> Unit,
    onLogClick: (String) -> Unit,
    onProgressClick: () -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxSize()) {
        CoachTopBar(title = "WORKOUT HISTORY", onBackClick = onBackClick)
        if (state.isHistoryLoading) {
            CoachLoadingBox(Modifier.weight(1f))
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // Progress dashboard card
                item {
                    Card(
                        onClick = onProgressClick,
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text("📊", fontSize = 24.sp)
                            Column {
                                Text(
                                    "Your Progress",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                )
                                Text(
                                    "View stats, streaks & records",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                                )
                            }
                        }
                    }
                }

                items(state.workoutHistory) { log ->
                    WorkoutHistoryDetailCard(log = log, onClick = { onLogClick(log.id) })
                }
                if (state.workoutHistory.isEmpty()) {
                    item {
                        Text(
                            text = "No workouts logged yet.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        )
                    }
                }
            }
        }
    }
}
```

Add to the `WorkoutHistoryDetailCard` composable — add volume info:

After the existing duration/exercise count row, add:

```kotlin
            // Volume summary
            val totalVolume = log.exerciseLogs.sumOf { ex ->
                ex.sets.filter { it.completed }.sumOf { s ->
                    ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                }
            }.toFloat()
            if (totalVolume > 0f) {
                Text(
                    text = "${com.coachfoska.app.domain.model.formatWeightKg(totalVolume)} kg total volume",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                )
            }
```

Also update the `WorkoutHistoryRoute` to add the `onProgressClick` callback:

```kotlin
@Composable
fun WorkoutHistoryRoute(
    userId: String,
    onBackClick: () -> Unit,
    onLogClick: (String) -> Unit,
    onProgressClick: () -> Unit = {},
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onIntent(WorkoutIntent.LoadHistory)
    }

    WorkoutHistoryScreen(
        state = state,
        onBackClick = onBackClick,
        onLogClick = onLogClick,
        onProgressClick = onProgressClick,
    )
}
```

- [ ] **Step 2: Add imports for new types**

Add these imports:

```kotlin
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutHistoryScreen.kt
git commit -m "feat(ui): add progress dashboard link and volume stats to workout history"
```

---

## Task 17: Navigation Graph — Wire Everything Together

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

- [ ] **Step 1: Add imports for new screens and routes**

Add these imports at the top of `App.kt`:

```kotlin
import com.coachfoska.app.navigation.ProgressDashboard
import com.coachfoska.app.navigation.PostWorkoutSummary
import com.coachfoska.app.ui.workout.PostWorkoutSummaryRoute
import com.coachfoska.app.ui.workout.ProgressDashboardRoute
```

- [ ] **Step 2: Update the WorkoutList (ActivityHub) composable**

Replace the existing `composable<WorkoutList>` block:

```kotlin
                composable<WorkoutList>(
                    enterTransition = { fadeIn(tween(150)) },
                    exitTransition = { fadeOut(tween(150)) },
                    popEnterTransition = { fadeIn(tween(150)) },
                    popExitTransition = { fadeOut(tween(150)) }
                ) {
                    ActivityHubRoute(
                        userId = currentUserId,
                        onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
                        onPlanClick = { navController.navigate(WorkoutPlan) },
                        onHistoryClick = { navController.navigate(WorkoutHistory) },
                        onHistoryDetailClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) },
                        onLibraryClick = { navController.navigate(ExerciseLibrary) },
                        onLogGeneralActivityClick = { navController.navigate(ActivityTypeSelector) },
                    )
                }
```

- [ ] **Step 3: Update the ActiveSession composable to navigate to PostWorkoutSummary**

Replace the existing `composable<ActiveSession>` block:

```kotlin
                composable<ActiveSession> { backStackEntry ->
                    val route = backStackEntry.toRoute<ActiveSession>()
                    ActiveSessionRoute(
                        workoutId = route.workoutId,
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() },
                        onWorkoutComplete = { logId ->
                            navController.navigate(PostWorkoutSummary(logId)) {
                                popUpTo<WorkoutList>()
                            }
                        },
                        onExerciseDetailClick = { exerciseId ->
                            navController.navigate(ExerciseDetail(exerciseId))
                        },
                    )
                }
```

- [ ] **Step 4: Add PostWorkoutSummary composable**

Add after the `ActiveSession` composable:

```kotlin
                composable<PostWorkoutSummary> { backStackEntry ->
                    val route = backStackEntry.toRoute<PostWorkoutSummary>()
                    PostWorkoutSummaryRoute(
                        userId = currentUserId,
                        logId = route.logId,
                        onDone = {
                            navController.navigate(WorkoutList) {
                                popUpTo<WorkoutList> { inclusive = true }
                            }
                        },
                    )
                }
```

- [ ] **Step 5: Add ProgressDashboard composable**

Add after the `WorkoutHistory` composable:

```kotlin
                composable<ProgressDashboard> {
                    ProgressDashboardRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() },
                    )
                }
```

- [ ] **Step 6: Update WorkoutHistory to pass onProgressClick**

Replace the existing `composable<WorkoutHistory>` block:

```kotlin
                composable<WorkoutHistory> {
                    WorkoutHistoryRoute(
                        userId = currentUserId,
                        onBackClick = { navController.popBackStack() },
                        onLogClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) },
                        onProgressClick = { navController.navigate(ProgressDashboard) },
                    )
                }
```

- [ ] **Step 7: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(nav): wire PostWorkoutSummary, ProgressDashboard routes and update ActiveSession flow"
```

---

## Task 18: Exercise Library Refinements

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseLibraryScreen.kt`

- [ ] **Step 1: Add a "Favorites" filter chip to the category filter row**

In `ExerciseLibraryScreen.kt`, find the category filter chips section. Add a "Favorites" chip at the beginning of the chip row. The existing `ToggleFavoritesFilter` intent already exists in `ExerciseIntent`.

Add this chip before the category chips in the `LazyRow` or `FlowRow`:

```kotlin
FilterChip(
    selected = state.showOnlyFavorites,
    onClick = { onIntent(ExerciseIntent.ToggleFavoritesFilter) },
    label = { Text("❤️ Favorites") },
)
```

- [ ] **Step 2: Add muscle group tag chips to exercise cards**

In each exercise list item/card, add the muscle group as a small chip if available. Find the exercise card composable and after the exercise name, add:

```kotlin
// Muscle group chips (if exercise has category)
exercise.category?.let { cat ->
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = MaterialTheme.colorScheme.secondaryContainer,
    ) {
        Text(
            text = cat.name,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseLibraryScreen.kt
git commit -m "feat(ui): add favorites filter chip and muscle group tags to exercise library"
```

---

## Known Follow-Ups (out of scope for this plan)

These are minor spec items intentionally deferred — they require either new infrastructure or cross-cutting changes that don't fit cleanly into this plan:

1. **WorkoutHistoryDetail "View Charts →" links** — Spec Section 7 wants per-exercise chart links in history detail. This requires either storing `exerciseId` on `ExerciseLog` (model + DTO + schema change) or an exercise-name-to-ID lookup. Recommend as a separate task after this plan ships.
2. **Post-workout confetti animation** — Spec Section 5 mentions confetti/celebration animation. Requires a KMP-compatible particle animation library or custom Canvas implementation. The plan shows the 🎉 emoji and stats; animation is cosmetic polish to add later.

---

## Task 19: Final Compilation & Smoke Test

- [ ] **Step 1: Full debug build**

```bash
./gradlew :composeApp:assembleDebug
```

- [ ] **Step 2: Fix any compilation errors**

Address any remaining compilation issues, particularly:
- Missing imports
- Type mismatches between new state/intent classes and screen composables
- Koin parameter mismatches

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve remaining compilation issues from workout screens redesign"
```
