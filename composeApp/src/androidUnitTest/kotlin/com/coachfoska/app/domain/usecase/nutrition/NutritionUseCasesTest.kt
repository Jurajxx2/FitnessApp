package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GetFavoriteRecipeIdsUseCaseTest {
    private val repo = mockk<MealRepository>()
    private val useCase = GetFavoriteRecipeIdsUseCase(repo)

    @Test
    fun `returns set of favorite recipe ids from repo`() = runTest {
        coEvery { repo.getFavoriteRecipeIds("user-1") } returns Result.success(setOf("r-1", "r-2"))

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(setOf("r-1", "r-2"), result.getOrNull())
    }

    @Test
    fun `propagates repo failure`() = runTest {
        coEvery { repo.getFavoriteRecipeIds(any()) } returns Result.failure(RuntimeException("error"))

        val result = useCase("user-1")

        assertTrue(result.isFailure)
    }
}

class ToggleFavoriteRecipeUseCaseTest {
    private val repo = mockk<MealRepository>()
    private val useCase = ToggleFavoriteRecipeUseCase(repo)

    @Test
    fun `calls setRecipeFavorite with isFavorite=true`() = runTest {
        coEvery { repo.setRecipeFavorite("user-1", "r-1", true) } returns Result.success(Unit)

        val result = useCase("user-1", "r-1", true)

        assertTrue(result.isSuccess)
        coVerify { repo.setRecipeFavorite("user-1", "r-1", true) }
    }

    @Test
    fun `calls setRecipeFavorite with isFavorite=false`() = runTest {
        coEvery { repo.setRecipeFavorite("user-1", "r-1", false) } returns Result.success(Unit)

        val result = useCase("user-1", "r-1", false)

        assertTrue(result.isSuccess)
        coVerify { repo.setRecipeFavorite("user-1", "r-1", false) }
    }
}

class NutritionUseCasesTest {

    private val repo: MealRepository = mockk()

    @Test
    fun `GetActiveMealPlanUseCase delegates to repository`() = runTest {
        val plan = aMealPlan()
        coEvery { repo.getActiveMealPlan("user-1") } returns Result.success(plan)

        val result = GetActiveMealPlanUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals("mp-1", result.getOrThrow()?.id)
    }

    @Test
    fun `LogMealUseCase delegates to repository`() = runTest {
        val log = aMealLog()
        coEvery { repo.logMeal(any(), any(), any(), any()) } returns Result.success(log)

        val result = LogMealUseCase(repo)("user-1", "Lunch", emptyList(), null)

        assertTrue(result.isSuccess)
        coVerify { repo.logMeal("user-1", "Lunch", emptyList(), null) }
    }

    @Test
    fun `GetMealHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getMealHistory("user-1") } returns Result.success(listOf(aMealLog()))

        val result = GetMealHistoryUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }
}

private fun aMealPlan() = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = emptyList(),
    validFrom = null, validTo = null
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)
