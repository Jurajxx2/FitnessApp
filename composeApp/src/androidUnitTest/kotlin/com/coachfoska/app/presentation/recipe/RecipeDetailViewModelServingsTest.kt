package com.coachfoska.app.presentation.recipe

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.RecipeIngredient
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.recipe.ScaleRecipeUseCase
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

@OptIn(ExperimentalCoroutinesApi::class)
class RecipeDetailViewModelServingsTest {
    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: MealRepository = mockk()
    private val scale = ScaleRecipeUseCase()

    private val baseRecipe = Recipe(
        id = "r1", name = "Pasta", description = "",
        calories = 600f, protein = 20f, carbs = 80f, fat = 18f,
        servings = 2,
        ingredients = listOf(
            RecipeIngredient(name = "Spaghetti", quantity = 200f, unit = "g",
                calories = 360f, proteinG = 12f, carbsG = 72f, fatG = 2f),
        ),
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { repo.getRecipeById("r1") } returns Result.success(baseRecipe)
        coEvery { repo.getFavoriteRecipeIds(any()) } returns Result.success(emptySet())
    }

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    private fun viewModel() = RecipeDetailViewModel(
        repository = repo,
        scaleRecipe = scale,
        getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(repo),
        toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(repo),
        recipeId = "r1",
        userId = "user-1",
    )

    @Test
    fun `initial load uses base recipe servings`() = runTest {
        val vm = viewModel()
        val state = vm.state.value
        assertEquals(2, state.selectedServings)
        assertEquals(600f, state.recipe?.calories)
    }

    @Test
    fun `adjust servings scales recipe`() = runTest {
        val vm = viewModel()
        vm.onIntent(RecipeDetailIntent.AdjustRecipeServings(4))
        val state = vm.state.value
        assertEquals(4, state.selectedServings)
        assertEquals(1200f, state.recipe?.calories)
        assertEquals(400f, state.recipe?.ingredients?.first()?.quantity)
    }
}
