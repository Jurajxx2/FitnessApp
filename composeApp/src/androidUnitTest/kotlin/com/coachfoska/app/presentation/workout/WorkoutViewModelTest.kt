package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.model.WorkoutSource
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.DeleteUserWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.ForkWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.GetAllWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.domain.usecase.workout.SaveUserWorkoutUseCase
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
        saveUserWorkoutUseCase = SaveUserWorkoutUseCase(repo),
        forkWorkoutUseCase = ForkWorkoutUseCase(repo),
        workoutRepository = repo,
        userId = "user-1"
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { repo.getAllWorkouts() } returns Result.success(emptyList())
        // LoadHistory is now triggered in init
        coEvery { repo.getWorkoutHistory(any()) } returns Result.success(emptyList())
        coEvery { repo.getInProgressSession(any()) } returns Result.success(null)
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
    fun `deleteWorkout success reloads plans`() = runTest {
        val plan = aWorkout(id = "del-1")
        coEvery { repo.getAssignedWorkouts("user-1") } returnsMany listOf(
            Result.success(listOf(plan)),   // initial load in init
            Result.success(emptyList())      // reload after successful delete
        )
        coEvery { repo.deleteUserWorkout("del-1") } returns Result.success(Unit)

        val vm = viewModel()
        assertEquals(1, vm.state.value.workouts.size)

        vm.onIntent(WorkoutIntent.DeleteWorkout("del-1"))
        advanceUntilIdle()

        assertEquals(0, vm.state.value.workouts.size)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `deleteWorkout failure sets error and leaves list unchanged`() = runTest {
        val plan = aWorkout(id = "del-1")
        coEvery { repo.getAssignedWorkouts("user-1") } returns Result.success(listOf(plan))
        coEvery { repo.deleteUserWorkout("del-1") } returns Result.failure(Exception("Server error"))

        val vm = viewModel()
        assertEquals(1, vm.state.value.workouts.size)

        vm.onIntent(WorkoutIntent.DeleteWorkout("del-1"))
        advanceUntilIdle()

        assertNotNull(vm.state.value.error)
        assertEquals(1, vm.state.value.workouts.size)
    }

    @Test
    fun `substitutePlanExercise updates user workout in place and records origin`() = runTest {
        val exercise = WorkoutExercise(
            id = "we1", workoutId = "user-workout", name = "Bench Press",
            muscleGroup = "Chest", sets = 3, reps = "8", restSeconds = 90,
            tips = null, sortOrder = 0, exerciseId = "bench-id"
        )
        val workout = aWorkout(
            id = "user-workout",
            exercises = listOf(exercise),
        ).copy(
            source = WorkoutSource.USER,
            ownerUserId = "user-1",
        )
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("user-workout") } returns Result.success(workout)
        coEvery { repo.updateUserWorkout(eq("user-workout"), any()) } returns Result.success(
            workout.copy(
                exercises = listOf(
                    exercise.copy(
                        name = "Dumbbell Press",
                        exerciseId = "dumbbell-id",
                        substitutedFromExerciseId = "bench-id",
                        substitutedFromName = "Bench Press",
                    )
                )
            )
        )

        val vm = viewModel()
        vm.onIntent(WorkoutIntent.SelectWorkout("user-workout"))
        advanceUntilIdle()

        vm.onIntent(WorkoutIntent.SubstitutePlanExercise(0, anExercise(id = "dumbbell-id", name = "Dumbbell Press")))
        advanceUntilIdle()

        coVerify {
            repo.updateUserWorkout(
                "user-workout",
                match { draft ->
                    draft.exercises.single().name == "Dumbbell Press" &&
                        draft.exercises.single().substitutedFromExerciseId == "bench-id" &&
                        draft.exercises.single().substitutedFromName == "Bench Press"
                }
            )
        }
        assertEquals("Dumbbell Press", vm.state.value.selectedWorkout?.exercises?.single()?.name)
        assertEquals(Pair("Bench Press", "Dumbbell Press"), vm.state.value.lastPlanSubstitution)
    }

    @Test
    fun `substitutePlanExercise forks coach workout`() = runTest {
        val exercise = WorkoutExercise(
            id = "we1", workoutId = "coach-workout", name = "Squat",
            muscleGroup = "Legs", sets = 3, reps = "5", restSeconds = 120,
            tips = null, sortOrder = 0, exerciseId = "squat-id"
        )
        val workout = aWorkout(
            id = "coach-workout",
            exercises = listOf(exercise),
        ).copy(
            source = WorkoutSource.COACH,
            ownerUserId = null,
        )
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutById("coach-workout") } returns Result.success(workout)
        coEvery { repo.createUserWorkout(eq("user-1"), any(), eq("coach-workout")) } returns Result.success(
            workout.copy(
                id = "forked-workout",
                source = WorkoutSource.USER,
                ownerUserId = "user-1",
                forkedFromWorkoutId = "coach-workout",
                exercises = listOf(
                    exercise.copy(
                        name = "Leg Press",
                        exerciseId = "leg-press-id",
                        substitutedFromExerciseId = "squat-id",
                        substitutedFromName = "Squat",
                    )
                ),
            )
        )

        val vm = viewModel()
        vm.onIntent(WorkoutIntent.SelectWorkout("coach-workout"))
        advanceUntilIdle()

        vm.onIntent(WorkoutIntent.SubstitutePlanExercise(0, anExercise(id = "leg-press-id", name = "Leg Press")))
        advanceUntilIdle()

        coVerify {
            repo.createUserWorkout(
                userId = "user-1",
                draft = match { draft ->
                    draft.exercises.single().name == "Leg Press" &&
                        draft.exercises.single().substitutedFromExerciseId == "squat-id" &&
                        draft.exercises.single().substitutedFromName == "Squat"
                },
                forkedFromWorkoutId = "coach-workout",
            )
        }
        assertEquals("forked-workout", vm.state.value.selectedWorkout?.id)
        assertEquals("coach-workout", vm.state.value.selectedWorkout?.forkedFromWorkoutId)
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

    private fun anExercise(id: String, name: String) = com.coachfoska.app.domain.model.Exercise(
        id = id,
        name = name,
        description = "",
        category = null,
        muscles = emptyList(),
        musclesSecondary = emptyList(),
        equipment = emptyList(),
        imageUrl = null,
        imageUrl2 = null,
        videoUrl = null,
        difficulty = null,
    )
}
