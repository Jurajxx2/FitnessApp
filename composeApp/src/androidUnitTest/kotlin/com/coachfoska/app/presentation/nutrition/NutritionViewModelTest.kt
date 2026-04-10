package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
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
}

private fun aMealPlan(meals: List<Meal> = emptyList()) = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = meals,
    validFrom = null, validTo = null
)

private fun aMeal() = Meal(
    id = "meal-1", mealPlanId = "mp-1", name = "Lunch",
    timeOfDay = "12:00", sortOrder = 0, foods = emptyList()
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)
