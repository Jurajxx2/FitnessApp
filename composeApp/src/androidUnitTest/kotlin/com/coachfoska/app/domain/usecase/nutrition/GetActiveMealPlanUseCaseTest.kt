package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.fixtures.aMealPlan
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GetActiveMealPlanUseCaseTest {

    private val mealRepository = mockk<MealRepository>()
    private val useCase = GetActiveMealPlanUseCase(mealRepository)

    @Test
    fun `delegates to repo and returns meal plan`() = runTest {
        val plan = aMealPlan()
        coEvery { mealRepository.getActiveMealPlan(any()) } returns Result.success(plan)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(plan, result.getOrNull())
        coVerify { mealRepository.getActiveMealPlan("user-1") }
    }

    @Test
    fun `returns null when no plan assigned`() = runTest {
        coEvery { mealRepository.getActiveMealPlan(any()) } returns Result.success(null)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertNull(result.getOrNull())
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { mealRepository.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}
