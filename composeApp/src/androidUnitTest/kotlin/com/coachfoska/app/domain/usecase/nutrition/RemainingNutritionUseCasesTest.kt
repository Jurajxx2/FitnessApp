package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.fixtures.aRecipe
import com.coachfoska.app.fixtures.aNutritionSummary
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RemainingNutritionUseCasesTest {

    private val mealRepository: MealRepository = mockk()

    // --- GetDailyNutritionSummaryUseCase ---

    @Test
    fun `getDailyNutritionSummary delegates to repository with userId and date`() = runTest {
        val date = LocalDate.parse("2026-04-24")
        val summary = aNutritionSummary()
        coEvery { mealRepository.getDailyNutritionSummary("user-1", date) } returns Result.success(summary)

        val result = GetDailyNutritionSummaryUseCase(mealRepository)("user-1", date)

        assertTrue(result.isSuccess)
        assertEquals(summary, result.getOrThrow())
        coVerify(exactly = 1) { mealRepository.getDailyNutritionSummary("user-1", date) }
    }

    @Test
    fun `getDailyNutritionSummary propagates repository failure`() = runTest {
        val date = LocalDate.parse("2026-04-24")
        coEvery { mealRepository.getDailyNutritionSummary(any(), any()) } returns Result.failure(RuntimeException("DB error"))

        val result = GetDailyNutritionSummaryUseCase(mealRepository)("user-1", date)

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    // --- GetRecipesUseCase ---

    @Test
    fun `getRecipes returns list from repository`() = runTest {
        val recipes = listOf(aRecipe())
        coEvery { mealRepository.getRecipes() } returns Result.success(recipes)

        val result = GetRecipesUseCase(mealRepository)()

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals("r-1", result.getOrThrow()[0].id)
    }

    @Test
    fun `getRecipes returns empty list when repository returns empty`() = runTest {
        coEvery { mealRepository.getRecipes() } returns Result.success(emptyList())

        val result = GetRecipesUseCase(mealRepository)()

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().isEmpty())
    }

    @Test
    fun `getRecipes propagates repository failure`() = runTest {
        coEvery { mealRepository.getRecipes() } returns Result.failure(RuntimeException("Network error"))

        val result = GetRecipesUseCase(mealRepository)()

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
