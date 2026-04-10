package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.fixtures.aRecipe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GetRecipeByIdUseCaseTest {

    private val mealRepository: MealRepository = mockk()
    private val useCase = GetRecipeByIdUseCase(mealRepository)

    @Test
    fun `returns recipe when found`() = runTest {
        val recipe = aRecipe()
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(recipe)

        val result = useCase("r-1")

        assertTrue(result.isSuccess)
        assertEquals(recipe, result.getOrThrow())
        coVerify { mealRepository.getRecipeById("r-1") }
    }

    @Test
    fun `returns null when not found`() = runTest {
        coEvery { mealRepository.getRecipeById("missing") } returns Result.success(null)

        val result = useCase("missing")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `propagates failure`() = runTest {
        coEvery { mealRepository.getRecipeById(any()) } returns Result.failure(RuntimeException("Network error"))

        val result = useCase("r-1")

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
