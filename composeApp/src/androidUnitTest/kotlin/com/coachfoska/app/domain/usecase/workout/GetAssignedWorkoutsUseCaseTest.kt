package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.fixtures.aWorkout
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetAssignedWorkoutsUseCaseTest {

    private val workoutRepository = mockk<WorkoutRepository>()
    private val useCase = GetAssignedWorkoutsUseCase(workoutRepository)

    @Test
    fun `delegates to repo and returns workouts`() = runTest {
        val workouts = listOf(aWorkout("w1"), aWorkout("w2"))
        coEvery { workoutRepository.getAssignedWorkouts(any()) } returns Result.success(workouts)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(workouts, result.getOrNull())
        coVerify { workoutRepository.getAssignedWorkouts("user-1") }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { workoutRepository.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("server error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}
