package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.dto.MealLogDto
import com.coachfoska.app.data.remote.dto.MealLogFoodDto
import com.coachfoska.app.data.remote.dto.MealPlanDto
import com.coachfoska.app.domain.model.MealLogFood
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MealRepositoryImplTest {

    private val dataSource: MealRemoteDataSource = mockk()
    private val repository = MealRepositoryImpl(dataSource)

    @Test
    fun `getActiveMealPlan returns null when data source returns null`() = runTest {
        coEvery { dataSource.getActiveMealPlan(any()) } returns null

        val result = repository.getActiveMealPlan("user-1")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `getActiveMealPlan maps DTO to domain`() = runTest {
        val dto = MealPlanDto(id = "mp-1", name = "Week 1 Plan")
        coEvery { dataSource.getActiveMealPlan("user-1") } returns dto

        val result = repository.getActiveMealPlan("user-1")

        assertTrue(result.isSuccess)
        assertEquals("mp-1", result.getOrThrow()?.id)
        assertEquals("Week 1 Plan", result.getOrThrow()?.name)
    }

    @Test
    fun `logMeal with foods calls insertMealLogFoods`() = runTest {
        val logDto = aMealLogDto()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(any()) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood())

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertMealLogFoods(any()) }
    }

    @Test
    fun `logMeal with empty foods skips insertMealLogFoods`() = runTest {
        val logDto = aMealLogDto()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto

        repository.logMeal("user-1", "Lunch", emptyList(), null)

        coVerify(exactly = 0) { dataSource.insertMealLogFoods(any()) }
    }

    @Test
    fun `getDailyNutritionSummary aggregates calories from meal logs`() = runTest {
        val foodDto = aMealLogFoodDto(calories = 500f, proteinG = 40f, carbsG = 50f, fatG = 20f)
        val logDto = aMealLogDto(foods = listOf(foodDto))
        coEvery { dataSource.getMealLogsByDate(any(), any()) } returns listOf(logDto, logDto)

        val result = repository.getDailyNutritionSummary("user-1", LocalDate.parse("2026-04-03"))

        assertTrue(result.isSuccess)
        val summary = result.getOrThrow()
        assertEquals(1000f, summary.calories)
        assertEquals(80f, summary.proteinG)
        assertEquals(100f, summary.carbsG)
        assertEquals(40f, summary.fatG)
    }
}

private fun aMealLogDto(foods: List<MealLogFoodDto> = emptyList()) = MealLogDto(
    id = "log-1", userId = "user-1", mealName = "Lunch",
    loggedAt = "2026-04-03T12:00:00Z", foods = foods
)

private fun aMealLogFoodDto(
    calories: Float = 300f,
    proteinG: Float = 25f,
    carbsG: Float = 30f,
    fatG: Float = 10f
) = MealLogFoodDto(
    id = "food-1", mealLogId = "log-1", name = "Chicken",
    amountGrams = 150f, calories = calories, proteinG = proteinG, carbsG = carbsG, fatG = fatG
)

private fun aMealLogFood() = MealLogFood(
    id = "food-1", mealLogId = "log-1", name = "Chicken",
    amountGrams = 150f, calories = 300f, proteinG = 25f, carbsG = 30f, fatG = 10f
)
