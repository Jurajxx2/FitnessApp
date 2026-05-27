package com.coachfoska.app.presentation.recipe

import com.coachfoska.app.domain.model.RecipeIngredient
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.recipe.ScaleRecipeUseCase
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
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val TEST_USER = "user-1"

@OptIn(ExperimentalCoroutinesApi::class)
class RecipeDetailViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val mealRepository: MealRepository = mockk()
    private val scaleRecipe = ScaleRecipeUseCase()

    private fun viewModel(
        recipeId: String = "r-1",
        favoritesResult: Result<Set<String>> = Result.success(emptySet()),
    ) = RecipeDetailViewModel(
        repository = mealRepository,
        scaleRecipe = scaleRecipe,
        getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(mealRepository),
        toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(mealRepository),
        recipeId = recipeId,
        userId = TEST_USER,
    ).also {
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns favoritesResult
    }

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loading success sets recipe and clears loading`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNotNull(vm.state.value.recipe)
        assertEquals("Overnight Oats", vm.state.value.recipe?.name)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loading failure sets error and clears loading`() = runTest {
        coEvery { mealRepository.getRecipeById(any()) } returns Result.failure(RuntimeException("Not found"))
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.recipe)
        assertEquals("Not found", vm.state.value.error)
    }

    @Test
    fun `recipe not found in db sets error`() = runTest {
        coEvery { mealRepository.getRecipeById(any()) } returns Result.success(null)
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.recipe)
        assertEquals("Recipe not found", vm.state.value.error)
    }

    @Test
    fun `recipe includes ingredients`() = runTest {
        val recipe = aRecipe(ingredients = listOf(aIngredient()))
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(recipe)
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())

        val vm = viewModel()

        assertEquals(1, vm.state.value.recipe?.ingredients?.size)
        assertEquals("Oats", vm.state.value.recipe?.ingredients?.first()?.name)
    }

    @Test
    fun `initial state loads favorites from repo`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(setOf("r-1", "r-2"))

        val vm = RecipeDetailViewModel(
            repository = mealRepository,
            scaleRecipe = scaleRecipe,
            getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(mealRepository),
            toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(mealRepository),
            recipeId = "r-1",
            userId = TEST_USER,
        )

        assertTrue(vm.state.value.isFavorite)
    }

    @Test
    fun `ToggleFavorite adds recipe to favorites optimistically`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())
        coEvery { mealRepository.setRecipeFavorite(TEST_USER, "r-1", true) } returns Result.success(Unit)

        val vm = RecipeDetailViewModel(
            repository = mealRepository,
            scaleRecipe = scaleRecipe,
            getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(mealRepository),
            toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(mealRepository),
            recipeId = "r-1",
            userId = TEST_USER,
        )
        assertFalse(vm.state.value.isFavorite)

        vm.onIntent(RecipeDetailIntent.ToggleFavorite)

        assertTrue(vm.state.value.isFavorite)
        coVerify { mealRepository.setRecipeFavorite(TEST_USER, "r-1", true) }
    }

    @Test
    fun `ToggleFavorite removes recipe from favorites optimistically`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(setOf("r-1"))
        coEvery { mealRepository.setRecipeFavorite(TEST_USER, "r-1", false) } returns Result.success(Unit)

        val vm = RecipeDetailViewModel(
            repository = mealRepository,
            scaleRecipe = scaleRecipe,
            getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(mealRepository),
            toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(mealRepository),
            recipeId = "r-1",
            userId = TEST_USER,
        )
        assertTrue(vm.state.value.isFavorite)

        vm.onIntent(RecipeDetailIntent.ToggleFavorite)

        assertFalse(vm.state.value.isFavorite)
        coVerify { mealRepository.setRecipeFavorite(TEST_USER, "r-1", false) }
    }

    @Test
    fun `ToggleFavorite reverts optimistic update on failure`() = runTest {
        coEvery { mealRepository.getRecipeById("r-1") } returns Result.success(aRecipe())
        coEvery { mealRepository.getFavoriteRecipeIds(TEST_USER) } returns Result.success(emptySet())
        coEvery { mealRepository.setRecipeFavorite(any(), any(), any()) } returns Result.failure(RuntimeException("network error"))

        val vm = RecipeDetailViewModel(
            repository = mealRepository,
            scaleRecipe = scaleRecipe,
            getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(mealRepository),
            toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(mealRepository),
            recipeId = "r-1",
            userId = TEST_USER,
        )

        vm.onIntent(RecipeDetailIntent.ToggleFavorite)

        assertFalse(vm.state.value.isFavorite)
    }
}

private fun aIngredient() = RecipeIngredient(
    name = "Oats", quantity = 80f, unit = "g",
    calories = 300f, proteinG = 10f, carbsG = 55f, fatG = 6f
)
