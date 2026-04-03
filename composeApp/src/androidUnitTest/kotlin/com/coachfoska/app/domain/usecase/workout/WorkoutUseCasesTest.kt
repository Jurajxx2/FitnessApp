package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutUseCasesTest {

    private val repo: WorkoutRepository = mockk()

    @Test
    fun `GetAssignedWorkoutsUseCase delegates to repository`() = runTest {
        coEvery { repo.getAssignedWorkouts("user-1") } returns Result.success(listOf(aWorkout()))
        val useCase = GetAssignedWorkoutsUseCase(repo)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        coVerify { repo.getAssignedWorkouts("user-1") }
    }

    @Test
    fun `GetWorkoutByIdUseCase delegates to repository`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkout())
        val useCase = GetWorkoutByIdUseCase(repo)

        val result = useCase("w1")

        assertTrue(result.isSuccess)
        assertEquals("w1", result.getOrThrow().id)
    }

    @Test
    fun `LogWorkoutUseCase delegates to repository`() = runTest {
        val log = aWorkoutLog()
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(log)
        val useCase = LogWorkoutUseCase(repo)

        val result = useCase("user-1", "w1", "Push Day", 60, null, emptyList())

        assertTrue(result.isSuccess)
        coVerify { repo.logWorkout("user-1", "w1", "Push Day", 60, null, emptyList()) }
    }

    @Test
    fun `GetWorkoutHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(listOf(aWorkoutLog()))
        val useCase = GetWorkoutHistoryUseCase(repo)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }
}

private fun aWorkout() = Workout(
    id = "w1", name = "Push Day", dayOfWeek = null, durationMinutes = 60, exercises = emptyList()
)

private fun aWorkoutLog() = WorkoutLog(
    id = "log-1", userId = "user-1", workoutId = "w1", workoutName = "Push Day",
    durationMinutes = 60, notes = null, exerciseLogs = emptyList(),
    loggedAt = Instant.parse("2026-04-03T10:00:00Z")
)
