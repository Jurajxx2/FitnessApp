package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.fixtures.aSetLog
import com.coachfoska.app.fixtures.aWorkoutLog
import com.coachfoska.app.fixtures.anExerciseLog
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toLocalDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProgressUseCasesTest {

    private val repo: WorkoutRepository = mockk()

    // --- GetExerciseHistoryUseCase ---

    @Test
    fun `getExerciseHistory delegates to repository`() = runTest {
        val logs = listOf(anExerciseLog())
        coEvery { repo.getExerciseHistory("user-1", "Bench Press") } returns Result.success(logs)

        val result = GetExerciseHistoryUseCase(repo)("user-1", "Bench Press")

        assertTrue(result.isSuccess)
        assertEquals(logs, result.getOrThrow())
    }

    @Test
    fun `getExerciseHistory propagates failure`() = runTest {
        coEvery { repo.getExerciseHistory(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetExerciseHistoryUseCase(repo)("user-1", "Squat")

        assertTrue(result.isFailure)
        assertEquals("db", result.exceptionOrNull()?.message)
    }

    // --- GetExerciseRecordsUseCase ---

    @Test
    fun `getExerciseRecords delegates to repository`() = runTest {
        val records = ExerciseRecords(null, null, null, null)
        coEvery { repo.getExerciseRecords("user-1", "Bench Press") } returns Result.success(records)

        val result = GetExerciseRecordsUseCase(repo)("user-1", "Bench Press")

        assertTrue(result.isSuccess)
        assertEquals(records, result.getOrThrow())
    }

    @Test
    fun `getExerciseRecords propagates failure`() = runTest {
        coEvery { repo.getExerciseRecords(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetExerciseRecordsUseCase(repo)("user-1", "Squat")

        assertTrue(result.isFailure)
    }

    // --- GetWorkoutsPerWeekUseCase ---

    @Test
    fun `getWorkoutsPerWeek returns repository counts`() = runTest {
        val counts = listOf(WeeklyCount(LocalDate.parse("2026-06-01"), 3))
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.success(counts)

        val result = GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.THREE_MONTHS)

        assertTrue(result.isSuccess)
        val expandedCounts = result.getOrThrow()
        assertEquals(3, expandedCounts.single { it.weekStart == LocalDate.parse("2026-06-01") }.count)
        assertTrue(expandedCounts.any { it.count == 0 }, "missing weeks must be represented as zero")
    }

    @Test
    fun `getWorkoutsPerWeek since window widens with longer period`() = runTest {
        val sinceSlot = slot<LocalDate>()
        coEvery { repo.getWorkoutCountByWeek(any(), capture(sinceSlot)) } returns Result.success(emptyList())

        GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.ONE_MONTH)
        val sinceOneMonth = sinceSlot.captured
        GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.SIX_MONTHS)
        val sinceSixMonths = sinceSlot.captured

        // 180 - 30 = 150 days earlier, independent of the wall clock
        assertEquals(150, sinceOneMonth.toEpochDays() - sinceSixMonths.toEpochDays())
    }

    @Test
    fun `getWorkoutsPerWeek propagates failure`() = runTest {
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.ALL)

        assertTrue(result.isFailure)
    }

    // --- GetProgressDashboardUseCase ---

    private fun stubDashboardDeps(
        history: Result<List<WorkoutLog>> = Result.success(emptyList()),
        streak: Result<Int> = Result.success(0),
        prs: Result<List<PersonalRecord>> = Result.success(emptyList()),
        workouts: Result<List<Workout>> = Result.success(emptyList()),
    ) {
        coEvery { repo.getWorkoutHistory("user-1") } returns history
        coEvery { repo.getCurrentStreak("user-1") } returns streak
        coEvery { repo.getRecentPersonalRecords("user-1", 5) } returns prs
        coEvery { repo.getAssignedWorkouts("user-1") } returns workouts
    }

    @Test
    fun `getProgressDashboard with empty history returns 7 day completions and zero volume`() = runTest {
        stubDashboardDeps(streak = Result.success(4))

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertEquals(7, data.weeklyCompletions.size)
        assertEquals(1, data.weeklyCompletions.count { it.status == CompletionStatus.TODAY })
        assertEquals(0f, data.totalVolumeThisWeek)
        assertEquals(4, data.currentStreak)
        assertTrue(data.muscleDistribution.isEmpty())
    }

    @Test
    fun `getProgressDashboard aggregates volume for a workout logged today`() = runTest {
        val todayLog = aWorkoutLog(id = "today").copy(
            loggedAt = currentInstant(),
            exerciseLogs = listOf(
                anExerciseLog(
                    sets = listOf(
                        aSetLog(actualWeightKg = 100f, actualReps = 5, completed = true),
                        aSetLog(actualWeightKg = 100f, actualReps = 5, completed = false), // not counted
                    )
                )
            )
        )
        stubDashboardDeps(history = Result.success(listOf(todayLog)))

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        // only the completed set: 100 * 5 = 500
        assertEquals(500f, data.totalVolumeThisWeek)
    }

    @Test
    fun `getProgressDashboard counts scheduled workouts rather than all seven calendar days`() = runTest {
        val today = currentInstant()
        val scheduledWorkout = Workout(
            id = "w1",
            name = "Today plan",
            dayOfWeek = DayOfWeek.entries[today.toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault()).date.dayOfWeek.ordinal],
            durationMinutes = 45,
            exercises = emptyList(),
        )
        val completedLog = aWorkoutLog(id = "today").copy(
            workoutId = "w1",
            workoutName = "Today plan",
            loggedAt = today,
        )
        stubDashboardDeps(
            history = Result.success(listOf(completedLog)),
            workouts = Result.success(listOf(scheduledWorkout)),
        )

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertEquals(1, data.completedWorkoutsThisWeek)
        assertEquals(1, data.plannedWorkoutsThisWeek)
    }

    @Test
    fun `getProgressDashboard does not mark rest days as missed`() = runTest {
        stubDashboardDeps()

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertTrue(data.weeklyCompletions.none { it.status == CompletionStatus.MISSED })
    }

    @Test
    fun `getProgressDashboard fails when getWorkoutHistory fails`() = runTest {
        stubDashboardDeps(history = Result.failure(RuntimeException("history down")))

        val result = GetProgressDashboardUseCase(repo)("user-1")

        assertTrue(result.isFailure)
        assertEquals("history down", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getProgressDashboard tolerates streak and PR failures via defaults`() = runTest {
        stubDashboardDeps(
            streak = Result.failure(RuntimeException("streak down")),
            prs = Result.failure(RuntimeException("prs down")),
        )

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertEquals(0, data.currentStreak)
        assertTrue(data.recentPRs.isEmpty())
    }
}
