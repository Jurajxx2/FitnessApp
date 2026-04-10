package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.repository.MealRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GetRecipeByIdUseCaseTest {

    private val repo: MealRepository = mockk()
    private val useCase = GetRecipeByIdUseCase(repo)

    @Test
    fun `returns recipe when found`() = runTest {
        val recipe = aRecipe()
        coEvery { repo.getRecipeById("r-1") } returns Result.success(recipe)

        val result = useCase("r-1")

        assertTrue(result.isSuccess)
        assertEquals(recipe, result.getOrThrow())
    }

    @Test
    fun `returns null when not found`() = runTest {
        coEvery { repo.getRecipeById("missing") } returns Result.success(null)

        val result = useCase("missing")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `propagates failure`() = runTest {
        coEvery { repo.getRecipeById(any()) } returns Result.failure(RuntimeException("Network error"))

        val result = useCase("r-1")

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}

private fun aRecipe() = Recipe(
    id = "r-1", name = "Overnight Oats", description = "Easy breakfast",
    calories = 386f, protein = 16f, carbs = 65f, fat = 9f
)
