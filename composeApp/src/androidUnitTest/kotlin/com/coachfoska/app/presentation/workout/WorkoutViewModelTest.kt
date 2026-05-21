package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlinx.datetime.Instant
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk()

    private fun viewModel() = WorkoutViewModel(
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(repo),
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadWorkouts success populates workouts list`() = runTest {
        val workouts = listOf(aWorkout(id = "w1"))
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(workouts)

        val vm = viewModel()

        assertEquals(1, vm.state.value.workouts.size)
        assertEquals("w1", vm.state.value.workouts[0].id)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `logWorkout success sets workoutLoggedSuccess true`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(aWorkoutLog())
        coEvery { repo.getWorkoutHistory(any()) } returns Result.success(emptyList())
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.LogWorkout("w1", "Push Day", 60, null, emptyList()))

        assertTrue(vm.state.value.workoutLoggedSuccess)
    }

    @Test
    fun `InitDraftFromWorkout creates sessionDraft`() = runTest {
        val workout = aWorkout(id = "w1")
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.InitDraftFromWorkout("w1"))
        advanceUntilIdle()

        assertNotNull(vm.state.value.sessionDraft)
        assertEquals("w1", vm.state.value.sessionDraft?.workoutId)
    }

    @Test
    fun `UpdateSetActual updates reps and weight and rpe in draft`() = runTest {
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1", name = "Squat",
                muscleGroup = "Legs", sets = 3, reps = "10", restSeconds = 60,
                tips = null, sortOrder = 0
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.InitDraftFromWorkout("w1"))
        advanceUntilIdle()

        vm.onIntent(WorkoutIntent.UpdateSetActual(exerciseIndex = 0, setIndex = 0, reps = 12, weight = 100f, rpe = 8))

        val set = vm.state.value.sessionDraft?.exercises?.get(0)?.sets?.get(0)
        assertEquals(12, set?.actualReps)
        assertEquals(100f, set?.actualWeightKg)
        assertEquals(8, set?.rpe)
    }
}
