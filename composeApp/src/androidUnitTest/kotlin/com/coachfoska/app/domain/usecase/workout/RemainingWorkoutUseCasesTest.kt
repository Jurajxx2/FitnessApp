package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RemainingWorkoutUseCasesTest {

    private val workoutRepository: WorkoutRepository = mockk()

    // --- GetWorkoutByIdUseCase ---

    @Test
    fun `getWorkoutById returns workout from repository`() = runTest {
        val workout = aWorkout()
        coEvery { workoutRepository.getWorkoutById("workout-1") } returns Result.success(workout)

        val result = GetWorkoutByIdUseCase(workoutRepository)("workout-1")

        assertTrue(result.isSuccess)
        assertEquals(workout, result.getOrThrow())
        coVerify(exactly = 1) { workoutRepository.getWorkoutById("workout-1") }
    }

    @Test
    fun `getWorkoutById propagates repository failure`() = runTest {
        coEvery { workoutRepository.getWorkoutById(any()) } returns Result.failure(RuntimeException("Not found"))

        val result = GetWorkoutByIdUseCase(workoutRepository)("workout-1")

        assertTrue(result.isFailure)
        assertEquals("Not found", result.exceptionOrNull()?.message)
    }

    // --- GetWorkoutHistoryUseCase ---

    @Test
    fun `getWorkoutHistory returns list from repository`() = runTest {
        val logs = listOf(aWorkoutLog())
        coEvery { workoutRepository.getWorkoutHistory("user-1") } returns Result.success(logs)

        val result = GetWorkoutHistoryUseCase(workoutRepository)("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals("log-1", result.getOrThrow()[0].id)
    }

    @Test
    fun `getWorkoutHistory returns empty list when no history`() = runTest {
        coEvery { workoutRepository.getWorkoutHistory("user-1") } returns Result.success(emptyList())

        val result = GetWorkoutHistoryUseCase(workoutRepository)("user-1")

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().isEmpty())
    }
}
