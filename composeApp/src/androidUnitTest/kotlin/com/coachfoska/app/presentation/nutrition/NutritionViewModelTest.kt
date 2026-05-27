package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.SearchFoodsUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.fixtures.aRecipe
import io.mockk.coEvery
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

    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        getRecipesUseCase = GetRecipesUseCase(repo),
        searchFoodsUseCase = SearchFoodsUseCase(repo),
        getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(repo),
        toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

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
}

private fun aMealPlan(meals: List<Meal> = emptyList()) = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = meals,
    validFrom = null, validTo = null
)

private fun aMeal() = Meal(
    id = "meal-1", mealPlanId = "mp-1", name = "Lunch",
    timeOfDay = "12:00", sortOrder = 0, dayOfWeek = null, foods = emptyList()
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)
