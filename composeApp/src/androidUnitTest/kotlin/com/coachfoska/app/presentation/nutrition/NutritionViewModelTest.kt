package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.OpenFoodFactsNutriments
import com.coachfoska.app.data.remote.dto.OpenFoodFactsProduct
import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealFood
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.RecipeIngredient
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.nutrition.AnalyzeMealPhotoUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.SearchFoodsUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.fixtures.aRecipe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class NutritionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: MealRepository = mockk()
    private val userRepo: UserRepository = mockk()
    private val offDataSource: OpenFoodFactsDataSource = mockk()

    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        analyzeMealPhotoUseCase = AnalyzeMealPhotoUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        getRecipesUseCase = GetRecipesUseCase(repo),
        searchFoodsUseCase = SearchFoodsUseCase(repo),
        getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(repo),
        toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(repo),
        getRecipeByIdUseCase = GetRecipeByIdUseCase(repo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(repo),
        calculateMacroTargetsUseCase = CalculateMacroTargetsUseCase(),
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        lookupFoodByBarcodeUseCase = LookupFoodByBarcodeUseCase(offDataSource),
        userId = "user-1"
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        // Default stub — individual tests can override with coEvery
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.getDailyNutritionSummary(any(), any()) } returns
            Result.success(DailyNutritionSummary(1200f, 80f, 100f, 40f))
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
    }
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `AnalyzePhoto success populates capturePrefill and clears analyzing`() = runTest {
        coEvery { repo.analyzeMealPhoto(any()) } returns Result.success(
            com.coachfoska.app.domain.model.MealPhotoAnalysis(
                mealName = "Salad",
                foods = listOf(
                    com.coachfoska.app.domain.model.MealPhotoAnalysisFood(
                        "Lettuce", 100f, "g", 15f, 1f, 3f, 0f
                    )
                )
            )
        )

        val vm = viewModel()
        vm.onIntent(NutritionIntent.AnalyzePhoto(byteArrayOf(1, 2, 3)))

        assertFalse(vm.state.value.isAnalyzing)
        val prefill = vm.state.value.capturePrefill
        assertNotNull(prefill)
        assertEquals("Salad", prefill.mealName)
        assertEquals("Lettuce", prefill.foods[0].name)
    }

    @Test
    fun `AnalyzePhoto failure sets error and clears analyzing`() = runTest {
        coEvery { repo.analyzeMealPhoto(any()) } returns Result.failure(RuntimeException("boom"))

        val vm = viewModel()
        vm.onIntent(NutritionIntent.AnalyzePhoto(byteArrayOf(9)))

        assertFalse(vm.state.value.isAnalyzing)
        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.capturePrefill)
    }

    @Test
    fun `loadMealPlan success populates mealPlan`() = runTest {
        val plan = aMealPlan()
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(plan)

        val vm = viewModel()

        assertEquals(plan, vm.state.value.mealPlan)
        assertNull(vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadMealPlan success with null plan leaves mealPlan null`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)

        val vm = viewModel()

        assertNull(vm.state.value.mealPlan)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadMealPlan failure shows error state not mock data`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.mealPlan)
    }

    @Test
    fun `selectMeal by id sets selectedMeal`() = runTest {
        val meal = aMeal()
        val plan = aMealPlan(meals = listOf(meal))
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(plan)
        val vm = viewModel()

        vm.onIntent(NutritionIntent.SelectMeal("meal-1"))

        assertEquals(meal, vm.state.value.selectedMeal)
    }

    @Test
    fun `logMeal success sets mealLoggedSuccess true`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.logMeal(any(), any(), any(), any()) } returns Result.success(aMealLog())
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LogMeal("Lunch", emptyList(), null))

        assertTrue(vm.state.value.mealLoggedSuccess)
        assertFalse(vm.state.value.isLogging)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `logMeal failure sets error`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.logMeal(any(), any(), any(), any()) } returns Result.failure(RuntimeException("Log failed"))
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LogMeal("Lunch", emptyList(), null))

        assertEquals("Log failed", vm.state.value.error)
        assertFalse(vm.state.value.isLogging)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()

        vm.onIntent(NutritionIntent.DismissError)

        assertNull(vm.state.value.error)
    }

    @Test
    fun `SelectDay updates selectedDayOfWeek in state`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)

        val vm = viewModel()
        vm.onIntent(NutritionIntent.SelectDay(3))

        assertEquals(3, vm.state.value.selectedDayOfWeek)
    }

    @Test
    fun `SelectDay to same day is idempotent`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)

        val vm = viewModel()
        vm.onIntent(NutritionIntent.SelectDay(2))
        vm.onIntent(NutritionIntent.SelectDay(2))

        assertEquals(2, vm.state.value.selectedDayOfWeek)
    }

    @Test
    fun `LoadRecipes loads favorite ids alongside recipes`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.getRecipes() } returns Result.success(listOf(aRecipe()))
        coEvery { repo.getFavoriteRecipeIds("user-1") } returns Result.success(setOf("r-1"))

        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadRecipes)

        assertEquals(setOf("r-1"), vm.state.value.favoriteRecipeIds)
        assertEquals(1, vm.state.value.recipes.size)
    }

    @Test
    fun `ToggleFavoriteRecipe adds recipe to favorites optimistically`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.getFavoriteRecipeIds("user-1") } returns Result.success(emptySet())
        coEvery { repo.setRecipeFavorite("user-1", "r-1", true) } returns Result.success(Unit)

        val vm = viewModel()
        vm.onIntent(NutritionIntent.ToggleFavoriteRecipe("r-1"))

        assertTrue("r-1" in vm.state.value.favoriteRecipeIds)
    }

    @Test
    fun `ToggleFavoritesFilter shows only favorite recipes`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.getRecipes() } returns Result.success(listOf(aRecipe("r-1"), aRecipe("r-2")))
        coEvery { repo.getFavoriteRecipeIds("user-1") } returns Result.success(setOf("r-1"))

        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadRecipes)
        vm.onIntent(NutritionIntent.ToggleFavoritesFilter)

        assertTrue(vm.state.value.showOnlyFavorites)
        assertEquals(listOf("r-1"), vm.state.value.recipes.map { it.id })
    }

    @Test
    fun `prefill from recipe maps ingredients`() = runTest {
        coEvery { repo.getRecipeById("r1") } returns Result.success(
            aRecipe(
                id = "r1",
                name = "Avocado Toast",
                ingredients = listOf(
                    RecipeIngredient(name = "Avocado", quantity = 1f, unit = "x", calories = 160f, proteinG = 2f, carbsG = 8.5f, fatG = 14.7f),
                    RecipeIngredient(name = "Bread", quantity = 2f, unit = "slice", calories = 180f, proteinG = 6f, carbsG = 34f, fatG = 2f),
                )
            )
        )
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = "r1", mealId = null))
        val prefill = vm.state.value.capturePrefill
        assertNotNull(prefill)
        assertEquals("Avocado Toast", prefill.mealName)
        assertEquals(2, prefill.foods.size)
        assertEquals("Avocado", prefill.foods[0].name)
        assertEquals(160f, prefill.foods[0].calories)
    }

    @Test
    fun `prefill from meal maps meal foods`() = runTest {
        coEvery { repo.getActiveMealPlan("user-1") } returns Result.success(
            aMealPlan(
                meals = listOf(
                    aMeal(
                        id = "m1",
                        name = "Lunch",
                        foods = listOf(
                            MealFood(id = "mf-1", mealId = "m1", name = "Chicken", amountGrams = 150f, calories = 248f, proteinG = 46f, carbsG = 0f, fatG = 5f)
                        )
                    )
                )
            )
        )
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = null, mealId = "m1"))
        val prefill = vm.state.value.capturePrefill
        assertNotNull(prefill)
        assertEquals("Lunch", prefill.mealName)
        assertEquals("Chicken", prefill.foods[0].name)
        assertEquals(150f, prefill.foods[0].amount)
    }

    @Test
    fun `prefill failure leaves state blank and does not error`() = runTest {
        coEvery { repo.getRecipeById("missing") } returns Result.failure(RuntimeException("offline"))
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = "missing", mealId = null))
        assertNull(vm.state.value.capturePrefill)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `CapturePrefillConsumed nulls capturePrefill after successful LoadCapturePrefill`() = runTest {
        coEvery { repo.getRecipeById("r1") } returns Result.success(
            aRecipe(id = "r1", name = "Oats", ingredients = emptyList())
        )
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = "r1", mealId = null))
        assertNotNull(vm.state.value.capturePrefill)

        vm.onIntent(NutritionIntent.CapturePrefillConsumed)

        assertNull(vm.state.value.capturePrefill)
    }

    @Test
    fun `init loads daily summary and computes macro targets from profile`() = runTest {
        val vm = viewModel()

        val s = vm.state.value
        assertNotNull(s.nutritionSummary)
        assertEquals(1200f, s.nutritionSummary!!.calories)
        assertNotNull(s.macroTargets)   // aUser() has complete stats
        assertFalse(s.isSummaryLoading)
    }

    @Test
    fun `incomplete profile leaves macro targets null but keeps summary`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser(weightKg = null))

        val vm = viewModel()

        assertNotNull(vm.state.value.nutritionSummary)
        assertNull(vm.state.value.macroTargets)
    }

    @Test
    fun `LoadDailySummary reloads the summary`() = runTest {
        val vm = viewModel()               // init -> 1 call
        vm.onIntent(NutritionIntent.LoadDailySummary)   // -> 2nd call

        coVerify(exactly = 2) { repo.getDailyNutritionSummary(any(), any()) }
    }

    @Test
    fun `daily summary load failure is non-fatal`() = runTest {
        coEvery { repo.getDailyNutritionSummary(any(), any()) } returns
            Result.failure(RuntimeException("offline"))

        val vm = viewModel()

        assertNull(vm.state.value.nutritionSummary)
        assertFalse(vm.state.value.isSummaryLoading)
    }

    @Test
    fun `LookupBarcode success sets barcodeFood and clears loading`() = runTest {
        coEvery { offDataSource.lookup("123") } returns OpenFoodFactsResponse(
            status = 1,
            code = "123",
            product = OpenFoodFactsProduct(
                productName = "Yogurt",
                brands = "Farm",
                servingSize = "150 g",
                nutriments = OpenFoodFactsNutriments(
                    energyKcal100g = 60f,
                    proteins100g = 5f,
                    carbohydrates100g = 7f,
                    fat100g = 2f,
                )
            )
        )
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("123"))

        assertEquals("Yogurt", vm.state.value.barcodeFood?.name)
        assertFalse(vm.state.value.isLookingUpBarcode)
        assertFalse(vm.state.value.barcodeNotFound)
    }

    @Test
    fun `LookupBarcode not found sets barcodeNotFound`() = runTest {
        coEvery { offDataSource.lookup("000") } returns OpenFoodFactsResponse(status = 0, code = "000", product = null)
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("000"))

        assertNull(vm.state.value.barcodeFood)
        assertTrue(vm.state.value.barcodeNotFound)
        assertFalse(vm.state.value.isLookingUpBarcode)
    }

    @Test
    fun `LookupBarcode network failure sets error`() = runTest {
        coEvery { offDataSource.lookup(any()) } throws RuntimeException("offline")
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("123"))

        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.isLookingUpBarcode)
    }

    @Test
    fun `BarcodeConsumed clears barcodeFood and barcodeNotFound`() = runTest {
        coEvery { offDataSource.lookup("000") } returns OpenFoodFactsResponse(status = 0, product = null)
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LookupBarcode("000"))
        assertTrue(vm.state.value.barcodeNotFound)

        vm.onIntent(NutritionIntent.BarcodeConsumed)

        assertNull(vm.state.value.barcodeFood)
        assertFalse(vm.state.value.barcodeNotFound)
    }
}

private fun aMealPlan(meals: List<Meal> = emptyList()) = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = meals,
    validFrom = null, validTo = null
)

private fun aMeal(
    id: String = "meal-1",
    name: String = "Lunch",
    foods: List<MealFood> = emptyList()
) = Meal(
    id = id, mealPlanId = "mp-1", name = name,
    timeOfDay = "12:00", sortOrder = 0, dayOfWeek = null, foods = foods
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)

private fun aUser(
    weightKg: Float? = 80f,
    heightCm: Float? = 180f,
    age: Int? = 30,
    activityLevel: ActivityLevel? = ActivityLevel.MODERATELY_ACTIVE,
    goal: FitnessGoal? = FitnessGoal.STAY_FIT,
) = User(
    id = "user-1", email = "u@e.com", fullName = "U",
    age = age, heightCm = heightCm, weightKg = weightKg,
    goal = goal, activityLevel = activityLevel, onboardingComplete = true,
)
