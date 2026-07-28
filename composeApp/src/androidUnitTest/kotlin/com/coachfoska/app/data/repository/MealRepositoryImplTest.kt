package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.dto.MealLogDto
import com.coachfoska.app.data.remote.dto.MealLogFoodDto
import com.coachfoska.app.data.remote.dto.MealLogFoodInsertDto
import com.coachfoska.app.data.remote.dto.MealPlanDto
import com.coachfoska.app.data.remote.dto.RecipeDetailDto
import com.coachfoska.app.data.remote.dto.RecipeDto
import com.coachfoska.app.data.remote.dto.RecipeIngredientDto
import com.coachfoska.app.data.remote.dto.RecipeStepDto
import com.coachfoska.app.domain.model.MealLogFood
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MealRepositoryImplTest {

    private val dataSource: MealRemoteDataSource = mockk()
    private val photoDataSource: com.coachfoska.app.data.remote.datasource.MealPhotoDataSource = mockk()
    private val repository = MealRepositoryImpl(dataSource, photoDataSource)

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
    fun `logMeal with gram unit populates amountGrams equal to amount`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood(amount = 150f, unit = "g"))

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        val payload = insertedFoods.captured.single()
        assertEquals("g", payload.unit)
        assertEquals(150f, payload.amount)
        assertEquals(150f, payload.amountGrams)
    }

    @Test
    fun `logMeal with non-gram unit leaves amountGrams null`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(
            aMealLogFood(name = "Yogurt", amount = 2f, unit = "serving"),
            aMealLogFood(name = "Milk", amount = 200f, unit = "ml")
        )

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        val payloads = insertedFoods.captured
        val servingPayload = payloads.single { it.name == "Yogurt" }
        assertEquals("serving", servingPayload.unit)
        assertEquals(2f, servingPayload.amount)
        assertNull(servingPayload.amountGrams)

        val mlPayload = payloads.single { it.name == "Milk" }
        assertEquals("ml", mlPayload.unit)
        assertEquals(200f, mlPayload.amount)
        assertNull(mlPayload.amountGrams)
    }

    @Test
    fun `logMeal with uppercase gram unit populates amountGrams equal to amount`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood(amount = 150f, unit = "G"))

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        val payload = insertedFoods.captured.single()
        assertEquals("G", payload.unit)
        assertEquals(150f, payload.amount)
        assertEquals(150f, payload.amountGrams)
    }

    @Test
    fun `logMeal with whitespace-padded gram unit is trimmed and populates amountGrams`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood(amount = 150f, unit = " g "))

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        val payload = insertedFoods.captured.single()
        assertEquals("g", payload.unit)
        assertEquals(150f, payload.amount)
        assertEquals(150f, payload.amountGrams)
    }

    @Test
    fun `logMeal with blank unit is normalized to grams`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood(amount = 120f, unit = ""))

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        val payload = insertedFoods.captured.single()
        assertEquals("g", payload.unit)
        assertEquals(120f, payload.amount)
        assertEquals(120f, payload.amountGrams)
    }

    @Test
    fun `logMeal passes macros through unchanged`() = runTest {
        val logDto = aMealLogDto()
        val insertedFoods = slot<List<MealLogFoodInsertDto>>()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(capture(insertedFoods)) } returns listOf(aMealLogFoodDto())
        val foods = listOf(
            aMealLogFood(
                unit = "serving",
                calories = 250f,
                proteinG = 12f,
                carbsG = 30f,
                fatG = 8f
            )
        )

        repository.logMeal("user-1", "Lunch", foods, null)

        val payload = insertedFoods.captured.single()
        assertEquals(250f, payload.calories)
        assertEquals(12f, payload.proteinG)
        assertEquals(30f, payload.carbsG)
        assertEquals(8f, payload.fatG)
    }

    @Test
    fun `analyzeMealPhoto maps DTO to domain`() = runTest {
        coEvery { photoDataSource.analyzeMealPhoto(any(), any()) } returns
            com.coachfoska.app.data.remote.dto.MealPhotoAnalysisDto(
                mealName = "Rice bowl",
                foods = listOf(
                    com.coachfoska.app.data.remote.dto.MealPhotoAnalysisFoodDto(
                        name = "Rice", amount = 150f, unit = "g",
                        calories = 200f, proteinG = 4f, carbsG = 45f, fatG = 1f
                    )
                )
            )

        val result = repository.analyzeMealPhoto(byteArrayOf(1, 2, 3))

        assertTrue(result.isSuccess)
        assertEquals("Rice bowl", result.getOrThrow().mealName)
        assertEquals("Rice", result.getOrThrow().foods[0].name)
        assertEquals(150f, result.getOrThrow().foods[0].amount)
    }

    @Test
    fun `logMeal uploads image and stores returned url`() = runTest {
        coEvery { photoDataSource.uploadMealPhoto("user-1", any()) } returns "https://cdn/meal.jpg"
        coEvery { dataSource.insertMealLog("user-1", "Lunch", null, "https://cdn/meal.jpg") } returns aMealLogDto()

        val result = repository.logMeal("user-1", "Lunch", emptyList(), null, byteArrayOf(7, 8))

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertMealLog("user-1", "Lunch", null, "https://cdn/meal.jpg") }
    }

    @Test
    fun `logMeal still succeeds when image upload fails`() = runTest {
        coEvery { photoDataSource.uploadMealPhoto(any(), any()) } throws RuntimeException("network down")
        coEvery { dataSource.insertMealLog("user-1", "Lunch", null, null) } returns aMealLogDto()

        val result = repository.logMeal("user-1", "Lunch", emptyList(), null, byteArrayOf(7, 8))

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertMealLog("user-1", "Lunch", null, null) }
    }

    @Test
    fun `logMeal stores the uploaded photo object path (not a public URL) in image_url`() = runTest {
        coEvery { photoDataSource.uploadMealPhoto("user-1", any()) } returns "user-1/meal_1700000000000.jpg"
        coEvery { dataSource.insertMealLog("user-1", "Lunch", null, "user-1/meal_1700000000000.jpg") } returns aMealLogDto()

        val result = repository.logMeal("user-1", "Lunch", emptyList(), null, byteArrayOf(7, 8))

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertMealLog("user-1", "Lunch", null, "user-1/meal_1700000000000.jpg") }
    }

    @Test
    fun `signedMealPhotoUrl returns the data source's signed URL wrapped in Result`() = runTest {
        coEvery { photoDataSource.signedMealPhotoUrl("user-1/meal_1700000000000.jpg") } returns
            "https://signed.example/meal.jpg?token=abc"

        val result = repository.signedMealPhotoUrl("user-1/meal_1700000000000.jpg")

        assertTrue(result.isSuccess)
        assertEquals("https://signed.example/meal.jpg?token=abc", result.getOrThrow())
    }

    @Test
    fun `signedMealPhotoUrl wraps data source failure in Result failure`() = runTest {
        coEvery { photoDataSource.signedMealPhotoUrl(any()) } throws RuntimeException("expired")

        val result = repository.signedMealPhotoUrl("user-1/meal_1700000000000.jpg")

        assertTrue(result.isFailure)
        assertEquals("expired", result.exceptionOrNull()?.message)
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

private fun aMealLogFood(
    name: String = "Chicken",
    amount: Float = 150f,
    unit: String = "g",
    calories: Float = 300f,
    proteinG: Float = 25f,
    carbsG: Float = 30f,
    fatG: Float = 10f
) = MealLogFood(
    id = "food-1", mealLogId = "log-1", name = name,
    amount = amount, unit = unit, calories = calories, proteinG = proteinG, carbsG = carbsG, fatG = fatG
)

private fun aRecipeDto() = RecipeDto(
    id = "recipe-1",
    name = "Overnight Oats",
    calories = 386f,
    proteinG = 16f,
    carbsG = 65f,
    fatG = 9f
)

private fun aRecipeIngredientDto(sortOrder: Int = 0) = RecipeIngredientDto(
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

private fun aRecipeStepDto(
    id: String = "step-1",
    stepNumber: Int = 1,
    instruction: String = "Mix ingredients"
) = RecipeStepDto(
    id = id,
    recipeId = "recipe-1",
    stepNumber = stepNumber,
    instruction = instruction
)

private fun aRecipeDetailDto(
    ingredients: List<RecipeIngredientDto> = emptyList(),
    steps: List<RecipeStepDto> = emptyList()
) = RecipeDetailDto(
    id = "recipe-1",
    name = "Overnight Oats",
    calories = 386f,
    proteinG = 16f,
    carbsG = 65f,
    fatG = 9f,
    ingredients = ingredients,
    steps = steps
)
