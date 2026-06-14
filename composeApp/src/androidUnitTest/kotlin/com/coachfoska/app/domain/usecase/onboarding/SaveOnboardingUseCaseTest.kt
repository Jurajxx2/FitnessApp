package com.coachfoska.app.domain.usecase.onboarding

import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.OnboardingData
import com.coachfoska.app.domain.repository.OnboardingRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

class SaveOnboardingUseCaseTest {

    private val repository: OnboardingRepository = mockk()
    private val useCase = SaveOnboardingUseCase(repository)

    @Test
    fun `invoke delegates to repository with userId and data`() = runTest {
        val data = OnboardingData(goal = FitnessGoal.BUILD_MUSCLE, name = "Ada")
        coEvery { repository.saveResponses("u1", data) } returns Result.success(Unit)

        val result = useCase("u1", data)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { repository.saveResponses("u1", data) }
    }

    @Test
    fun `invoke propagates repository failure`() = runTest {
        val data = OnboardingData()
        coEvery { repository.saveResponses(any(), any()) } returns Result.failure(RuntimeException("boom"))

        val result = useCase("u1", data)

        assertTrue(result.isFailure)
    }
}
