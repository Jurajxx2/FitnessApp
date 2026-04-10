package com.coachfoska.app.presentation.recipe

import com.coachfoska.app.domain.model.RecipeIngredient
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase
import com.coachfoska.app.fixtures.aRecipe
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
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class RecipeDetailViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val mealRepository: MealRepository = mockk()

    private fun viewModel(recipeId: String = "r-1") = RecipeDetailViewModel(
        getRecipeByIdUseCase = GetRecipeByIdUseCase(mealRepository),
        recipeId = recipeId
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loading success sets recipe and clears loading`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNotNull(vm.state.value.recipe)
        assertEquals("Overnight Oats", vm.state.value.recipe?.name)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loading failure sets error and clears loading`() = runTest {
        coEvery { mealRepository.getRecipeById(any()) } returns Result.failure(RuntimeException("Not found"))

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.recipe)
        assertEquals("Not found", vm.state.value.error)
    }

    @Test
    fun `recipe not found in db sets error`() = runTest {
        coEvery { mealRepository.getRecipeById(any()) } returns Result.success(null)

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.recipe)
        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `recipe includes ingredients`() = runTest {
        val recipe = aRecipe(ingredients = listOf(aIngredient()))
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(recipe)

        val vm = viewModel()

        assertEquals(1, vm.state.value.recipe?.ingredients?.size)
        assertEquals("Oats", vm.state.value.recipe?.ingredients?.first()?.name)
    }
}

private fun aIngredient() = RecipeIngredient(
    name = "Oats", quantity = 80f, unit = "g",
    calories = 300f, proteinG = 10f, carbsG = 55f, fatG = 6f
)
