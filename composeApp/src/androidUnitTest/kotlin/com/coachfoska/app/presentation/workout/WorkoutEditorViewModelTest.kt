package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.fixtures.aWorkout
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutEditorViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val workoutRepo: WorkoutRepository = mockk(relaxed = true)
    private val exerciseRepo: ExerciseRepository = mockk(relaxed = true)

    private fun viewModel() = WorkoutEditorViewModel(
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(workoutRepo),
        workoutRepository = workoutRepo,
        exerciseRepository = exerciseRepo,
        userId = "user-1"
    )

    private fun anExercise(id: String = "e1", name: String = "Squat", muscles: List<String> = listOf("Legs")) =
        Exercise(
            id = id, name = name, description = "", category = null,
            muscles = muscles, musclesSecondary = emptyList(),
            equipment = emptyList(), imageUrl = null, imageUrl2 = null,
            videoUrl = null, difficulty = null
        )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `save_requires_name_and_one_exercise`() = runTest {
        val vm = viewModel()
        // state starts with empty name and empty exercises
        vm.onIntent(WorkoutEditorIntent.Save)

        assertTrue(vm.state.value.nameError, "nameError should be true when name is blank")
        assertTrue(vm.state.value.exercisesError, "exercisesError should be true when list is empty")
        coVerify(exactly = 0) { workoutRepo.createUserWorkout(any(), any(), any()) }
        coVerify(exactly = 0) { workoutRepo.updateUserWorkout(any(), any()) }
    }

    @Test
    fun `save_create_calls_createUserWorkout_and_sets_savedWorkoutId`() = runTest {
        val savedWorkout = aWorkout(id = "new-1", name = "My Workout")
        coEvery { workoutRepo.createUserWorkout(any(), any(), any()) } returns Result.success(savedWorkout)

        val vm = viewModel()
        vm.onIntent(WorkoutEditorIntent.UpdateName("My Workout"))
        vm.onIntent(WorkoutEditorIntent.AddExercise(anExercise()))
        vm.onIntent(WorkoutEditorIntent.Save)
        advanceUntilIdle()

        assertEquals("new-1", vm.state.value.savedWorkoutId)
        coVerify(exactly = 1) { workoutRepo.createUserWorkout("user-1", any(), any()) }
    }

    @Test
    fun `adding a timed exercise uses a duration goal instead of reps`() {
        val timedExercise = anExercise(name = "Plank Hold").copy(logType = ExerciseLogType.TIME)
        val vm = viewModel()

        vm.onIntent(WorkoutEditorIntent.AddExercise(timedExercise))

        val added = vm.state.value.exercises.single()
        assertEquals(ExerciseLogType.TIME, added.logType)
        assertEquals(30, added.targetDurationSeconds)
        assertEquals("", added.reps)
    }

    @Test
    fun `load_existing_populates_fields`() = runTest {
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1", name = "Squat",
                muscleGroup = "Legs", sets = 3, reps = "10", restSeconds = 90,
                tips = null, sortOrder = 0
            ),
            WorkoutExercise(
                id = "we2", workoutId = "w1", name = "Bench Press",
                muscleGroup = "Chest", sets = 4, reps = "8", restSeconds = 120,
                tips = null, sortOrder = 1
            )
        )
        val workout = aWorkout(id = "w1", name = "Push Day", exercises = exercises)
        coEvery { workoutRepo.getWorkoutById("w1") } returns Result.success(workout)

        val vm = viewModel()
        vm.onIntent(WorkoutEditorIntent.Load("w1"))
        advanceUntilIdle()

        assertEquals("Push Day", vm.state.value.name)
        assertEquals(2, vm.state.value.exercises.size)
        assertEquals("Squat", vm.state.value.exercises[0].name)
        assertEquals("Bench Press", vm.state.value.exercises[1].name)
    }

    @Test
    fun `move_exercise_reorders`() = runTest {
        val vm = viewModel()
        // Add exercises A, B, C
        listOf("A", "B", "C").forEach { name ->
            vm.onIntent(WorkoutEditorIntent.AddExercise(anExercise(id = name, name = name, muscles = emptyList())))
        }
        assertEquals(listOf("A", "B", "C"), vm.state.value.exercises.map { it.name })

        // MoveExercise(2, -1): move index 2 (C) up by -1 → becomes [A, C, B]
        vm.onIntent(WorkoutEditorIntent.MoveExercise(2, -1))

        val names = vm.state.value.exercises.map { it.name }
        assertEquals(listOf("A", "C", "B"), names)
    }
}
