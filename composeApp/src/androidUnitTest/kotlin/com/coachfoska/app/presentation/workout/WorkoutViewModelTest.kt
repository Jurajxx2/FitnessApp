package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.DeleteUserWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.GetAllWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
import io.mockk.coEvery
import io.mockk.coVerify
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
        getAllWorkoutsUseCase = GetAllWorkoutsUseCase(repo),
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(repo),
        deleteUserWorkoutUseCase = DeleteUserWorkoutUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { repo.getAllWorkouts() } returns Result.success(emptyList())
        // LoadHistory is now triggered in init
        coEvery { repo.getWorkoutHistory(any()) } returns Result.success(emptyList())
    }
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

    @Test
    fun `AddExtraSet inherits previous set values but clears state`() = runTest {
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1", name = "Squat",
                muscleGroup = "Legs", sets = 1, reps = "10", restSeconds = 60,
                tips = null, sortOrder = 0
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.InitDraftFromWorkout("w1"))
        advanceUntilIdle()

        // Set values for the first set
        vm.onIntent(WorkoutIntent.UpdateSetActual(0, 0, 12, 100f, 8))
        vm.onIntent(WorkoutIntent.MarkSetComplete(0, 0, true))

        vm.onIntent(WorkoutIntent.AddExtraSet(0))

        val sets = vm.state.value.sessionDraft?.exercises?.get(0)?.sets ?: emptyList()
        assertEquals(2, sets.size)
        assertEquals(2, sets[1].sortOrder)
        assertEquals(12, sets[1].actualReps)
        assertEquals(100f, sets[1].actualWeightKg)
        assertNull(sets[1].rpe)
        assertFalse(sets[1].completed)
    }

    @Test
    fun `RemoveSet deletes set and updates sort orders`() = runTest {
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

        vm.onIntent(WorkoutIntent.RemoveSet(0, 0))

        val sets = vm.state.value.sessionDraft?.exercises?.get(0)?.sets ?: emptyList()
        assertEquals(2, sets.size)
        assertEquals(1, sets[0].sortOrder)
        assertEquals(2, sets[1].sortOrder)
    }

    @Test
    fun `SubmitActiveSession transforms draft and calls logWorkout`() = runTest {
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1", name = "Squat",
                muscleGroup = "Legs", sets = 1, reps = "10", restSeconds = 60,
                tips = null, sortOrder = 0
            )
        )
        val workout = aWorkout(id = "w1", name = "Leg Day", exercises = exercises)
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { repo.getWorkoutHistory(any()) } returns Result.success(emptyList())
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(aWorkoutLog())
        
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.InitDraftFromWorkout("w1"))
        advanceUntilIdle()

        // Complete one set
        vm.onIntent(WorkoutIntent.UpdateSetActual(0, 0, 10, 80f, 7))
        vm.onIntent(WorkoutIntent.MarkSetComplete(0, 0, true))

        vm.onIntent(WorkoutIntent.SubmitActiveSession(45, "Felt good"))

        coVerify {
            repo.logWorkout(
                userId = "user-1",
                workoutId = "w1",
                workoutName = "Leg Day",
                durationMinutes = 45,
                notes = "Felt good",
                exerciseLogs = match { logs ->
                    logs.size == 1 && 
                    logs[0].exerciseName == "Squat" && 
                    logs[0].sets.size == 1 &&
                    logs[0].sets[0].actualReps == 10 &&
                    logs[0].sets[0].actualWeightKg == 80f &&
                    logs[0].sets[0].rpe == 7
                }
            )
        }
    }
}
