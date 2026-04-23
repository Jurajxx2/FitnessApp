package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.repository.UserRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CompleteOnboardingUseCaseTest {

    private val userRepository: UserRepository = mockk()

    @Test
    fun `invoke passes all parameters to repository`() = runTest {
        coEvery {
            userRepository.completeOnboarding(any(), any(), any(), any(), any(), any())
        } returns Result.success(Unit)

        val result = CompleteOnboardingUseCase(userRepository)(
            userId = "user-1",
            goal = UserGoal.MUSCLE_GAIN,
            heightCm = 175f,
            weightKg = 80f,
            age = 30,
            activityLevel = ActivityLevel.MODERATELY_ACTIVE
        )

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) {
            userRepository.completeOnboarding(
                "user-1", UserGoal.MUSCLE_GAIN, 175f, 80f, 30, ActivityLevel.MODERATELY_ACTIVE
            )
        }
    }

    @Test
    fun `invoke propagates repository failure`() = runTest {
        coEvery {
            userRepository.completeOnboarding(any(), any(), any(), any(), any(), any())
        } returns Result.failure(RuntimeException("Save failed"))

        val result = CompleteOnboardingUseCase(userRepository)(
            userId = "user-1",
            goal = UserGoal.WEIGHT_LOSS,
            heightCm = 160f,
            weightKg = 65f,
            age = 25,
            activityLevel = ActivityLevel.LIGHTLY_ACTIVE
        )

        assertTrue(result.isFailure)
        assertEquals("Save failed", result.exceptionOrNull()?.message)
    }
}
