package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class NutritionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: MealRepository = mockk()

    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadMealPlan failure shows error state not mock data`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.mealPlan)
    }
}
