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
    private val getWorkoutByIdUseCase = GetWorkoutByIdUseCase(workoutRepository)
    private val getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(workoutRepository)

    // --- GetWorkoutByIdUseCase ---

    @Test
    fun `getWorkoutById returns workout from repository`() = runTest {
        val workout = aWorkout()
        coEvery { workoutRepository.getWorkoutById("workout-1") } returns Result.success(workout)

        val result = getWorkoutByIdUseCase("workout-1")

        assertTrue(result.isSuccess)
        assertEquals(workout, result.getOrThrow())
        coVerify(exactly = 1) { workoutRepository.getWorkoutById("workout-1") }
    }

    @Test
    fun `getWorkoutById propagates repository failure`() = runTest {
        coEvery { workoutRepository.getWorkoutById(any()) } returns Result.failure(RuntimeException("Not found"))

        val result = getWorkoutByIdUseCase("workout-1")

        assertTrue(result.isFailure)
        assertEquals("Not found", result.exceptionOrNull()?.message)
    }

    // --- GetWorkoutHistoryUseCase ---

    @Test
    fun `getWorkoutHistory returns list from repository`() = runTest {
        val logs = listOf(aWorkoutLog())
        coEvery { workoutRepository.getWorkoutHistory("user-1") } returns Result.success(logs)

        val result = getWorkoutHistoryUseCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(logs, result.getOrThrow())
    }

    @Test
    fun `getWorkoutHistory returns empty list when no history`() = runTest {
        coEvery { workoutRepository.getWorkoutHistory("user-1") } returns Result.success(emptyList())

        val result = getWorkoutHistoryUseCase("user-1")

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().isEmpty())
    }
}
