package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetFavoriteExerciseIdsUseCase
import com.coachfoska.app.domain.usecase.exercise.ToggleFavoriteExerciseUseCase
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

private const val TEST_USER = "user-test"

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: ExerciseRepository = mockk()

    private fun viewModel(
        initialExercises: Result<List<Exercise>> = Result.success(emptyList()),
        categoriesResult: Result<List<ExerciseCategory>> = Result.success(emptyList()),
        favoritesResult: Result<Set<String>> = Result.success(emptySet())
    ): ExerciseViewModel {
        coEvery { repo.getCategories() } returns categoriesResult
        coEvery { repo.getExercises(any(), any(), any(), any(), any(), any(), any()) } returns initialExercises
        coEvery { repo.getFavoriteIds(TEST_USER) } returns favoritesResult
        return ExerciseViewModel(
            getExercisesUseCase = GetExercisesUseCase(repo),
            getExerciseByIdUseCase = GetExerciseByIdUseCase(repo),
            getExerciseCategoriesUseCase = GetExerciseCategoriesUseCase(repo),
            getFavoriteExerciseIdsUseCase = GetFavoriteExerciseIdsUseCase(repo),
            toggleFavoriteExerciseUseCase = ToggleFavoriteExerciseUseCase(repo),
            userId = TEST_USER
        )
    }

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state loads exercises from repo`() = runTest {
        val exercises = listOf(anExercise())
        val vm = viewModel(initialExercises = Result.success(exercises))

        assertEquals(exercises, vm.state.value.exercises)
        assertFalse(vm.state.value.isLoadingExercises)
    }

    @Test
    fun `initial state loads favorites from repo`() = runTest {
        val vm = viewModel(favoritesResult = Result.success(setOf("ex-1", "ex-2")))

        assertEquals(setOf("ex-1", "ex-2"), vm.state.value.favoriteIds)
    }

    @Test
    fun `SearchQueryChanged reloads with new query`() = runTest {
        val filtered = listOf(anExercise())
        val vm = viewModel()
        coEvery { repo.getExercises(0, 25, null, "bench", null, false, null) } returns Result.success(filtered)

        vm.onIntent(ExerciseIntent.SearchQueryChanged("bench"))

        assertEquals(filtered, vm.state.value.exercises)
        assertEquals("bench", vm.state.value.searchQuery)
    }

    @Test
    fun `SelectCategoryFilter toggles category off when same id tapped again`() = runTest {
        val vm = viewModel()

        vm.onIntent(ExerciseIntent.SelectCategoryFilter(1))
        assertEquals(1, vm.state.value.selectedCategoryId)

        vm.onIntent(ExerciseIntent.SelectCategoryFilter(1))
        assertNull(vm.state.value.selectedCategoryId)
    }

    @Test
    fun `SelectDifficultyFilter toggles difficulty off when same value tapped again`() = runTest {
        val vm = viewModel()

        vm.onIntent(ExerciseIntent.SelectDifficultyFilter("Beginner"))
        assertEquals("Beginner", vm.state.value.selectedDifficulty)

        vm.onIntent(ExerciseIntent.SelectDifficultyFilter("Beginner"))
        assertNull(vm.state.value.selectedDifficulty)
    }

    @Test
    fun `SelectSortOrder updates sort order in state`() = runTest {
        val vm = viewModel()

        vm.onIntent(ExerciseIntent.SelectSortOrder(ExerciseSortOrder.NAME_DESC))

        assertEquals(ExerciseSortOrder.NAME_DESC, vm.state.value.sortOrder)
    }

    @Test
    fun `LoadMoreExercises appends results and clears hasMore when page not full`() = runTest {
        val page1 = List(25) { anExercise(id = "ex-$it") }
        val page2 = listOf(anExercise(id = "ex-25"))
        val vm = viewModel(initialExercises = Result.success(page1))
        assertEquals(25, vm.state.value.exercises.size)
        assertTrue(vm.state.value.hasMore)
        coEvery { repo.getExercises(25, 25, null, null, null, false, null) } returns Result.success(page2)

        vm.onIntent(ExerciseIntent.LoadMoreExercises)

        assertEquals(26, vm.state.value.exercises.size)
        assertFalse(vm.state.value.hasMore)
    }

    @Test
    fun `SelectExercise loads and sets selectedExercise`() = runTest {
        val exercise = anExercise()
        coEvery { repo.getExerciseById("ex-1") } returns Result.success(exercise)
        val vm = viewModel()

        vm.onIntent(ExerciseIntent.SelectExercise("ex-1"))

        assertEquals(exercise, vm.state.value.selectedExercise)
        assertFalse(vm.state.value.isLoadingDetail)
    }

    @Test
    fun `ClearSelection nulls selectedExercise`() = runTest {
        val exercise = anExercise()
        coEvery { repo.getExerciseById("ex-1") } returns Result.success(exercise)
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.SelectExercise("ex-1"))
        assertNotNull(vm.state.value.selectedExercise)

        vm.onIntent(ExerciseIntent.ClearSelection)

        assertNull(vm.state.value.selectedExercise)
    }

    @Test
    fun `DismissError clears error state`() = runTest {
        val vm = viewModel(initialExercises = Result.failure(RuntimeException("err")))
        assertNotNull(vm.state.value.error)

        vm.onIntent(ExerciseIntent.DismissError)

        assertNull(vm.state.value.error)
    }

    @Test
    fun `ToggleFavorite adds exercise to favoriteIds optimistically`() = runTest {
        val vm = viewModel(favoritesResult = Result.success(emptySet()))
        coEvery { repo.setFavorite(TEST_USER, "ex-1", true) } returns Result.success(Unit)

        vm.onIntent(ExerciseIntent.ToggleFavorite("ex-1"))

        assertTrue("ex-1" in vm.state.value.favoriteIds)
        coVerify { repo.setFavorite(TEST_USER, "ex-1", true) }
    }

    @Test
    fun `ToggleFavorite removes exercise from favoriteIds optimistically`() = runTest {
        val vm = viewModel(favoritesResult = Result.success(setOf("ex-1")))
        coEvery { repo.setFavorite(TEST_USER, "ex-1", false) } returns Result.success(Unit)

        vm.onIntent(ExerciseIntent.ToggleFavorite("ex-1"))

        assertFalse("ex-1" in vm.state.value.favoriteIds)
        coVerify { repo.setFavorite(TEST_USER, "ex-1", false) }
    }

    @Test
    fun `ToggleFavoritesFilter flips showOnlyFavorites`() = runTest {
        val vm = viewModel()
        assertFalse(vm.state.value.showOnlyFavorites)

        vm.onIntent(ExerciseIntent.ToggleFavoritesFilter)

        assertTrue(vm.state.value.showOnlyFavorites)
    }

    @Test
    fun `ToggleFavoritesFilter with empty favorites shows empty list without network call`() = runTest {
        val vm = viewModel(favoritesResult = Result.success(emptySet()))

        vm.onIntent(ExerciseIntent.ToggleFavoritesFilter)

        assertTrue(vm.state.value.exercises.isEmpty())
        assertFalse(vm.state.value.hasMore)
        // repo.getExercises should only have been called once (initial load), not again
        coVerify(exactly = 1) { repo.getExercises(any(), any(), any(), any(), any(), any(), null) }
    }
}

private fun anExercise(id: String = "ex-1") = Exercise(
    id = id,
    name = "Bench Press",
    description = "Chest compound exercise",
    category = ExerciseCategory(1, "Chest"),
    muscles = listOf("Pectorals"),
    musclesSecondary = emptyList(),
    equipment = listOf("Barbell"),
    imageUrl = null,
    imageUrl2 = null,
    videoUrl = null,
    difficulty = null
)
