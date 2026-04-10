package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.fixtures.aMealLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetMealHistoryUseCaseTest {

    private val mealRepository = mockk<MealRepository>()
    private val useCase = GetMealHistoryUseCase(mealRepository)

    @Test
    fun `delegates to repo and returns meal logs`() = runTest {
        val logs = listOf(aMealLog("log-1"), aMealLog("log-2"))
        coEvery { mealRepository.getMealHistory(any()) } returns Result.success(logs)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(logs, result.getOrNull())
        coVerify { mealRepository.getMealHistory("user-1") }
    }

    @Test
    fun `repo failure is propagated`() = runTest {
        coEvery { mealRepository.getMealHistory(any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}
