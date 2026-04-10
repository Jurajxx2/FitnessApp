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
import kotlin.test.assertNotNull
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

    @Test
    fun `getRecipes maps list of DTOs to domain`() = runTest {
        val dto = aRecipeDto()
        coEvery { dataSource.getRecipes() } returns listOf(dto)

        val result = repository.getRecipes()

        assertTrue(result.isSuccess)
        val recipes = result.getOrThrow()
        assertEquals(1, recipes.size)
        assertEquals("recipe-1", recipes[0].id)
        assertEquals("Overnight Oats", recipes[0].name)
        assertTrue(recipes[0].ingredients.isEmpty())
    }

    @Test
    fun `getRecipeById returns null when not found`() = runTest {
        coEvery { dataSource.getRecipeById("missing") } returns null

        val result = repository.getRecipeById("missing")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `getRecipeById maps detail DTO including ingredients`() = runTest {
        val ingredient = aRecipeIngredientDto()
        val dto = aRecipeDetailDto(ingredients = listOf(ingredient))
        coEvery { dataSource.getRecipeById("recipe-1") } returns dto

        val result = repository.getRecipeById("recipe-1")

        assertTrue(result.isSuccess)
        val recipe = result.getOrThrow()
        assertNotNull(recipe)
        assertEquals("recipe-1", recipe.id)
        assertEquals(1, recipe.ingredients.size)
        assertEquals("Oats", recipe.ingredients[0].name)
        assertEquals(80f, recipe.ingredients[0].quantity)
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

private fun aRecipeDto() = com.coachfoska.app.data.remote.dto.RecipeDto(
    id = "recipe-1",
    name = "Overnight Oats",
    calories = 386f,
    proteinG = 16f,
    carbsG = 65f,
    fatG = 9f
)

private fun aRecipeIngredientDto(sortOrder: Int = 0) = com.coachfoska.app.data.remote.dto.RecipeIngredientDto(
    id = "ing-1",
    recipeId = "recipe-1",
    name = "Oats",
    quantity = 80f,
    unit = "g",
    calories = 300f,
    proteinG = 10f,
    carbsG = 55f,
    fatG = 6f,
    sortOrder = sortOrder
)

private fun aRecipeDetailDto(
    ingredients: List<com.coachfoska.app.data.remote.dto.RecipeIngredientDto> = emptyList()
) = com.coachfoska.app.data.remote.dto.RecipeDetailDto(
    id = "recipe-1",
    name = "Overnight Oats",
    calories = 386f,
    proteinG = 16f,
    carbsG = 65f,
    fatG = 9f,
    ingredients = ingredients
)
