package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.fixtures.aMealLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

class LogMealUseCaseTest {

    private val mealRepository = mockk<MealRepository>()
    private val useCase = LogMealUseCase(mealRepository)

    @Test
    fun `delegates to repo and returns meal log on success`() = runTest {
        val log = aMealLog()
        coEvery { mealRepository.logMeal(any(), any(), any(), any()) } returns Result.success(log)

        val result = useCase("user-1", "Breakfast", emptyList(), null)

        assertTrue(result.isSuccess)
        coVerify { mealRepository.logMeal("user-1", "Breakfast", emptyList(), null) }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { mealRepository.logMeal(any(), any(), any(), any()) } returns Result.failure(RuntimeException("db error"))

        val result = useCase("user-1", "Breakfast", emptyList(), null)

        assertTrue(result.isFailure)
    }
}
