package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.fixtures.aWorkoutLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

class LogWorkoutUseCaseTest {

    private val workoutRepository = mockk<WorkoutRepository>()
    private val useCase = LogWorkoutUseCase(workoutRepository)

    @Test
    fun `delegates to repo and returns workout log on success`() = runTest {
        val log = aWorkoutLog()
        coEvery { workoutRepository.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(log)

        val result = useCase("user-1", "workout-1", "Push Day", 60, null, emptyList())

        assertTrue(result.isSuccess)
        coVerify { workoutRepository.logWorkout("user-1", "workout-1", "Push Day", 60, null, emptyList()) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { workoutRepository.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("db error"))

        val result = useCase("user-1", "workout-1", "Push Day", 60, null, emptyList())

        assertTrue(result.isFailure)
    }
}
