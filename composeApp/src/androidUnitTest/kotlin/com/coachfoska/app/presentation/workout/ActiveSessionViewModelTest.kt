package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.SavedSetRef
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.CalculateEstimated1RMUseCase
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.fixtures.aWorkout
import io.mockk.coEvery
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class ActiveSessionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk(relaxed = true)

    private fun viewModel() = ActiveSessionViewModel(
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getPreviousLogsUseCase = GetPreviousExerciseLogsUseCase(repo),
        checkPRUseCase = CheckPersonalRecordUseCase(repo, CalculateEstimated1RMUseCase()),
        workoutRepository = repo,
        userId = "user-1",
    )

    private fun anExercise(id: String = "e1", name: String = "Squat") = Exercise(
        id = id, name = name, description = "", category = null,
        muscles = listOf("Chest"), musclesSecondary = emptyList(),
        equipment = emptyList(), imageUrl = null, imageUrl2 = null,
        videoUrl = "https://example.com/video.mp4", difficulty = null,
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { repo.getLastLogsForExercises(any(), any()) } returns Result.success(emptyMap())
        coEvery { repo.getExerciseRecords(any(), any()) } returns Result.failure(Exception("not checked"))
        coEvery { repo.startWorkoutSession(any(), any(), any()) } returns Result.success("live-log-1")
    }

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `substitute_swaps_draft_exercise_and_records_origin`() = runTest {
        // Arrange: workout with Bench Press (id = b1)
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Bench Press", muscleGroup = "Chest",
                sets = 3, reps = "10", restSeconds = 90,
                tips = null, sortOrder = 0,
                exerciseId = "b1",
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        val originalSets = vm.state.value.sessionDraft?.exercises?.get(0)?.sets
        assertNotNull(originalSets)

        // Act: substitute with Dumbbell Press (id = d1)
        val replacement = anExercise(id = "d1", name = "Dumbbell Press")
        vm.onIntent(ActiveSessionIntent.SubstituteExercise(0, replacement))
        advanceUntilIdle()

        // Assert
        val draft = vm.state.value.sessionDraft
        assertNotNull(draft)
        val substituted = draft.exercises[0]
        assertEquals("Dumbbell Press", substituted.exerciseName)
        assertEquals("b1", substituted.substitutedFromExerciseId)
        assertEquals("Bench Press", substituted.substitutedFromName)
        // Sets must be preserved
        assertEquals(originalSets.size, substituted.sets.size)
        for (i in originalSets.indices) {
            assertEquals(originalSets[i].sortOrder, substituted.sets[i].sortOrder)
            assertEquals(originalSets[i].targetReps, substituted.sets[i].targetReps)
        }
    }

    @Test
    fun `substitute_first_origin_wins_on_double_substitution`() = runTest {
        // Arrange: workout with Bench Press (id = b1)
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Bench Press", muscleGroup = "Chest",
                sets = 3, reps = "8", restSeconds = 90,
                tips = null, sortOrder = 0,
                exerciseId = "b1",
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        // First substitution: Bench Press → Dumbbell Press
        vm.onIntent(ActiveSessionIntent.SubstituteExercise(0, anExercise(id = "d1", name = "Dumbbell Press")))
        advanceUntilIdle()

        // Second substitution: Dumbbell Press → Cable Fly — origin must remain Bench Press (b1)
        vm.onIntent(ActiveSessionIntent.SubstituteExercise(0, anExercise(id = "c1", name = "Cable Fly")))
        advanceUntilIdle()

        val substituted = vm.state.value.sessionDraft?.exercises?.get(0)
        assertNotNull(substituted)
        assertEquals("Cable Fly", substituted.exerciseName)
        assertEquals("b1", substituted.substitutedFromExerciseId, "First origin must be preserved")
        assertEquals("Bench Press", substituted.substitutedFromName, "First origin name must be preserved")
    }

    @Test
    fun `substitute_dismiss_clears_lastSubstitution`() = runTest {
        val exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Squat", muscleGroup = "Legs",
                sets = 3, reps = "5", restSeconds = 120,
                tips = null, sortOrder = 0,
                exerciseId = "s1",
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.SubstituteExercise(0, anExercise(id = "r1", name = "Romanian DL")))
        advanceUntilIdle()
        assertNotNull(vm.state.value.lastSubstitution)

        vm.onIntent(ActiveSessionIntent.DismissSubstitution)
        assertNull(vm.state.value.lastSubstitution)
    }

    @Test
    fun `marking_set_complete_autosaves_it`() = runTest {
        val workout = aWorkoutWithSingleExercise()
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.UpdateSetActual(0, 0, reps = 8, weight = 80f))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals("set-log-1", set?.setLogId)
        assertEquals(SetSaveState.Saved, set?.saveState)
    }

    @Test
    fun `autosave_failure_marks_failed_and_retry_saves`() = runTest {
        val workout = aWorkoutWithSingleExercise()
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returnsMany listOf(
            Result.failure(Exception("Network")),
            Result.success(SavedSetRef("exercise-log-1", "set-log-1")),
        )

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.UpdateSetActual(0, 0, reps = 8, weight = 80f))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()
        assertEquals(SetSaveState.Failed, vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()?.saveState)

        vm.onIntent(ActiveSessionIntent.RetrySetSave(0, 0))
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals(8, set?.actualReps)
        assertEquals(80f, set?.actualWeightKg)
        assertEquals(SetSaveState.Saved, set?.saveState)
    }

    @Test
    fun `unmarking_completed_set_updates_row`() = runTest {
        val workout = aWorkoutWithSingleExercise()
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))
        coEvery { repo.updateSetLog("set-log-1", any()) } returns Result.success(Unit)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = false))
        advanceUntilIdle()

        assertEquals(false, vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()?.completed)
        assertEquals(SetSaveState.Saved, vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()?.saveState)
    }

    @Test
    fun `finish_updates_status_completed`() = runTest {
        val workout = aWorkoutWithSingleExercise()
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))
        coEvery { repo.finishWorkoutSession("live-log-1", any(), "Done") } returns Result.success(Unit)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.SubmitSession("Done"))
        advanceUntilIdle()

        assertEquals("live-log-1", vm.state.value.submittedLogId)
    }

    @Test
    fun `init_with_resumeLogId_rebuilds_completed_sets`() = runTest {
        val log = WorkoutLog(
            id = "resume-log-1",
            userId = "user-1",
            workoutId = "w1",
            workoutName = "Push Day",
            durationMinutes = 0,
            notes = null,
            exerciseLogs = listOf(
                com.coachfoska.app.domain.model.ExerciseLog(
                    id = "exercise-log-1",
                    workoutLogId = "resume-log-1",
                    exerciseName = "Bench Press",
                    notes = null,
                    exerciseId = "b1",
                    sets = listOf(
                        SetLog(
                            id = "set-log-1",
                            exerciseLogId = "exercise-log-1",
                            sortOrder = 1,
                            targetReps = 8,
                            actualReps = 8,
                            targetWeightKg = null,
                            actualWeightKg = 80f,
                            rpe = null,
                            targetRestSeconds = 90,
                            actualRestSeconds = null,
                            completed = true,
                        )
                    ),
                )
            ),
            loggedAt = kotlinx.datetime.Instant.parse("2026-07-03T10:00:00Z"),
            status = "in_progress",
        )
        coEvery { repo.getInProgressSession("user-1") } returns Result.success(log)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1", resumeLogId = "resume-log-1"))
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals("resume-log-1", vm.state.value.sessionDraft?.workoutLogId)
        assertEquals("set-log-1", set?.setLogId)
        assertEquals(true, set?.completed)
        assertEquals(SetSaveState.Saved, set?.saveState)
    }

    private fun aWorkoutWithSingleExercise() = aWorkout(
        id = "w1",
        exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Bench Press", muscleGroup = "Chest",
                sets = 3, reps = "8", restSeconds = 90,
                tips = null, sortOrder = 0,
                exerciseId = "b1",
            )
        ),
    )
}
