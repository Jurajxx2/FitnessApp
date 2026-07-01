package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealPhotoAnalysis
import com.coachfoska.app.domain.model.MealPhotoAnalysisFood
import com.coachfoska.app.domain.repository.MealRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AnalyzeMealPhotoUseCaseTest {

    private val repo: MealRepository = mockk()
    private val useCase = AnalyzeMealPhotoUseCase(repo)

    @Test
    fun `returns analysis on success`() = runTest {
        val analysis = MealPhotoAnalysis(
            mealName = "Grilled chicken salad",
            foods = listOf(
                MealPhotoAnalysisFood("Chicken breast", 150f, "g", 248f, 46f, 0f, 5f)
            )
        )
        coEvery { repo.analyzeMealPhoto(any()) } returns Result.success(analysis)

        val result = useCase(byteArrayOf(1, 2, 3))

        assertTrue(result.isSuccess)
        assertEquals("Grilled chicken salad", result.getOrThrow().mealName)
        assertEquals(1, result.getOrThrow().foods.size)
    }

    @Test
    fun `propagates failure`() = runTest {
        coEvery { repo.analyzeMealPhoto(any()) } returns Result.failure(RuntimeException("boom"))

        val result = useCase(byteArrayOf(9))

        assertTrue(result.isFailure)
    }
}
