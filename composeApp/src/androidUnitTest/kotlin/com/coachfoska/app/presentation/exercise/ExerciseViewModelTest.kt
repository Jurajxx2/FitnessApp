package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExerciseCategoriesUseCase
import com.coachfoska.app.domain.usecase.exercise.GetExercisesByCategoryUseCase
import com.coachfoska.app.domain.usecase.exercise.SearchExercisesUseCase
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

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: ExerciseRepository = mockk()

    private fun viewModel() = ExerciseViewModel(
        searchExercisesUseCase = SearchExercisesUseCase(repo),
        getExerciseByIdUseCase = GetExerciseByIdUseCase(repo),
        getExerciseCategoriesUseCase = GetExerciseCategoriesUseCase(repo),
        getExercisesByCategoryUseCase = GetExercisesByCategoryUseCase(repo)
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state is empty`() {
        val vm = viewModel()
        assertEquals("", vm.state.value.searchQuery)
        assertTrue(vm.state.value.searchResults.isEmpty())
        assertNull(vm.state.value.selectedExercise)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `Search success populates searchResults`() = runTest {
        val exercises = listOf(anExercise())
        coEvery { repo.searchExercises("bench") } returns Result.success(exercises)
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.SearchQueryChanged("bench"))

        vm.onIntent(ExerciseIntent.Search)

        assertEquals(1, vm.state.value.searchResults.size)
        assertEquals("ex-1", vm.state.value.searchResults[0].id)
        assertFalse(vm.state.value.isSearching)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `Search failure sets error`() = runTest {
        coEvery { repo.searchExercises(any()) } returns Result.failure(RuntimeException("Search failed"))
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.SearchQueryChanged("bench"))

        vm.onIntent(ExerciseIntent.Search)

        assertEquals("Search failed", vm.state.value.error)
        assertFalse(vm.state.value.isSearching)
        assertTrue(vm.state.value.searchResults.isEmpty())
    }

    @Test
    fun `LoadCategories success populates categories list`() = runTest {
        val cats = listOf(ExerciseCategory(1, "Chest"), ExerciseCategory(2, "Back"))
        coEvery { repo.getCategories() } returns Result.success(cats)
        val vm = viewModel()

        vm.onIntent(ExerciseIntent.LoadCategories)

        assertEquals(2, vm.state.value.categories.size)
        assertFalse(vm.state.value.isCategoriesLoading)
    }

    @Test
    fun `LoadCategories skips network call when categories already loaded`() = runTest {
        val cats = listOf(ExerciseCategory(1, "Chest"))
        coEvery { repo.getCategories() } returns Result.success(cats)
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.LoadCategories)

        vm.onIntent(ExerciseIntent.LoadCategories) // second call

        coVerify(exactly = 1) { repo.getCategories() }
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
    fun `ClearSelection sets selectedExercise to null`() = runTest {
        val exercise = anExercise()
        coEvery { repo.getExerciseById("ex-1") } returns Result.success(exercise)
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.SelectExercise("ex-1"))
        assertNotNull(vm.state.value.selectedExercise)

        vm.onIntent(ExerciseIntent.ClearSelection)

        assertNull(vm.state.value.selectedExercise)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { repo.searchExercises(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()
        vm.onIntent(ExerciseIntent.SearchQueryChanged("bench"))  // REQUIRED: query must be non-blank
        vm.onIntent(ExerciseIntent.Search)
        assertNotNull(vm.state.value.error)

        vm.onIntent(ExerciseIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}

private fun anExercise() = Exercise(
    id = "ex-1",
    name = "Bench Press",
    description = "Chest compound exercise",
    category = ExerciseCategory(1, "Chest"),
    muscles = listOf("Pectorals"),
    musclesSecondary = emptyList(),
    equipment = listOf("Barbell"),
    imageUrl = null,
    videoUrl = null,
    difficulty = null
)
