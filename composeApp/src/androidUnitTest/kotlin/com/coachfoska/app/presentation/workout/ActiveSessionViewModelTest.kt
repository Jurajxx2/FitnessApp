package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.SavedSetRef
import com.coachfoska.app.domain.model.SetLog
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.ExerciseRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.exercise.GetExerciseByIdUseCase
import com.coachfoska.app.domain.usecase.workout.CalculateEstimated1RMUseCase
import com.coachfoska.app.domain.usecase.workout.CheckPersonalRecordUseCase
import com.coachfoska.app.domain.usecase.workout.GetPreviousExerciseLogsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.fixtures.aWorkout
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
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
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ActiveSessionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk(relaxed = true)
    private val exerciseRepo: ExerciseRepository = mockk(relaxed = true)

    private fun viewModel() = ActiveSessionViewModel(
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getPreviousLogsUseCase = GetPreviousExerciseLogsUseCase(repo),
        checkPRUseCase = CheckPersonalRecordUseCase(repo, CalculateEstimated1RMUseCase()),
        workoutRepository = repo,
        getExerciseByIdUseCase = GetExerciseByIdUseCase(exerciseRepo),
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
        coEvery { repo.getInProgressSession(any()) } returns Result.success(null)
        coEvery { repo.discardWorkoutSession(any(), any()) } returns Result.success(Unit)
        coEvery { repo.deleteSetLog(any()) } returns Result.success(Unit)
        coEvery { repo.updateSetLog(any(), any()) } returns Result.success(Unit)
        coEvery { exerciseRepo.getExerciseById(any()) } returns Result.failure(Exception("not found"))
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

    @Test
    fun `init opens existing session instead of starting another workout`() = runTest {
        val activeLog = WorkoutLog(
            id = "active-log-1",
            userId = "user-1",
            workoutId = "w1",
            workoutName = "Push Day",
            durationMinutes = 0,
            notes = null,
            exerciseLogs = emptyList(),
            loggedAt = kotlinx.datetime.Instant.parse("2026-07-03T10:00:00Z"),
            status = "in_progress",
        )
        coEvery { repo.getInProgressSession("user-1") } returns Result.success(activeLog)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("another-workout"))
        advanceUntilIdle()

        assertEquals("active-log-1", vm.state.value.sessionDraft?.workoutLogId)
        assertEquals(true, vm.state.value.resumedExistingSession)
        coVerify(exactly = 0) { repo.startWorkoutSession(any(), any(), any()) }
    }

    @Test
    fun `database conflict while starting reopens the active workout`() = runTest {
        val activeLog = WorkoutLog(
            id = "active-log-1",
            userId = "user-1",
            workoutId = "w1",
            workoutName = "Push Day",
            durationMinutes = 0,
            notes = null,
            exerciseLogs = emptyList(),
            loggedAt = kotlinx.datetime.Instant.parse("2026-07-03T10:00:00Z"),
            status = "in_progress",
        )
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())
        coEvery { repo.startWorkoutSession("user-1", "w1", any()) } returns
            Result.failure(IllegalStateException("duplicate active workout"))
        coEvery { repo.getInProgressSession("user-1") } returnsMany listOf(
            Result.success(null),
            Result.success(activeLog),
        )

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        assertEquals("active-log-1", vm.state.value.sessionDraft?.workoutLogId)
        assertEquals(true, vm.state.value.resumedExistingSession)
        coVerify(exactly = 1) { repo.startWorkoutSession("user-1", "w1", any()) }
    }

    @Test
    fun `discard_before_live_session_start_finishes_discards_late_created_log`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())
        val startResult = CompletableDeferred<Result<String>>()
        coEvery { repo.startWorkoutSession("user-1", "w1", any()) } coAnswers { startResult.await() }

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.DiscardSession)
        assertEquals(false, vm.state.value.sessionDiscarded)
        assertEquals(true, vm.state.value.isDiscarding)

        startResult.complete(Result.success("late-log-1"))
        advanceUntilIdle()

        coVerify { repo.discardWorkoutSession("user-1", "late-log-1") }
        assertEquals(true, vm.state.value.sessionDiscarded)
        assertEquals(false, vm.state.value.isDiscarding)
    }

    @Test
    fun `discard_stays_on_session_when_remote_update_fails_and_can_retry`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())
        coEvery { repo.discardWorkoutSession("user-1", "live-log-1") } returnsMany listOf(
            Result.failure(Exception("Network")),
            Result.success(Unit),
        )

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.DiscardSession)
        advanceUntilIdle()

        assertEquals(false, vm.state.value.sessionDiscarded)
        assertEquals(false, vm.state.value.isDiscarding)
        assertEquals("Network", vm.state.value.error)

        vm.onIntent(ActiveSessionIntent.DiscardSession)
        advanceUntilIdle()

        coVerify(exactly = 2) { repo.discardWorkoutSession("user-1", "live-log-1") }
        assertEquals(true, vm.state.value.sessionDiscarded)
    }

    @Test
    fun `init_prefills_reps_from_plan_target`() = runTest {
        // aWorkoutWithSingleExercise has reps = "8", sets = 3
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        val sets = vm.state.value.sessionDraft?.exercises?.single()?.sets
        assertNotNull(sets)
        assertEquals(3, sets.size)
        sets.forEach { assertEquals(8, it.actualReps, "reps should be prefilled from plan target") }
    }

    @Test
    fun `init_prefills_weight_from_previous_session`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())
        coEvery { repo.getLastLogsForExercises("user-1", any()) } returns Result.success(
            mapOf(
                "Bench Press" to listOf(
                    aPreviousSet(sortOrder = 1, weight = 60f),
                    aPreviousSet(sortOrder = 2, weight = 62.5f),
                )
            )
        )

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        val sets = vm.state.value.sessionDraft?.exercises?.single()?.sets
        assertNotNull(sets)
        assertEquals(60f, sets[0].actualWeightKg, "set 1 weight prefilled from previous session")
        assertEquals(62.5f, sets[1].actualWeightKg, "set 2 weight prefilled from previous session")
        assertNull(sets[2].actualWeightKg, "set 3 has no previous data, stays empty")
    }

    @Test
    fun `skipping_rest_timer_records_elapsed_rest_on_the_set_that_started_it`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise())
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()
        vm.onIntent(ActiveSessionIntent.UpdateSetActual(0, 0, reps = 8, weight = 80f))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))

        assertEquals(0, vm.state.value.restTimer.exerciseIndex)
        assertEquals(0, vm.state.value.restTimer.setIndex)
        vm.onIntent(ActiveSessionIntent.SkipRestTimer)
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals(0, set?.actualRestSeconds)
        assertEquals(false, vm.state.value.restTimer.isActive)
        coVerify {
            repo.updateSetLog("set-log-1", match { it.actualRestSeconds == 0 })
        }
    }

    @Test
    fun `editing_a_saved_completed_set_updates_persisted_statistics`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkoutWithSingleExercise(restSeconds = 0))
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()
        vm.onIntent(ActiveSessionIntent.UpdateSetActual(0, 0, reps = 8, weight = 80f))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.UpdateSetActual(0, 0, reps = 9, weight = 82.5f))
        advanceUntilIdle()

        coVerify {
            repo.updateSetLog("set-log-1", match {
                it.actualWeightKg == 82.5f && it.actualReps == 9 && it.completed
            })
        }
    }

    @Test
    fun `timed_exercise_keeps_its_duration_when_a_rest_timer_finishes`() = runTest {
        val timedWorkout = aWorkout(
            id = "w1",
            exercises = listOf(
                WorkoutExercise(
                    id = "we1",
                    workoutId = "w1",
                    name = "Plank Hold",
                    muscleGroup = "Core",
                    sets = 2,
                    reps = "30 seconds",
                    restSeconds = 60,
                    tips = null,
                    sortOrder = 0,
                    exerciseId = "plank-1",
                    logType = ExerciseLogType.TIME,
                    targetDurationSeconds = 30,
                ),
            ),
        )
        coEvery { repo.getWorkoutById("w1") } returns Result.success(timedWorkout)
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()
        vm.onIntent(ActiveSessionIntent.UpdateSetDuration(0, 0, 45))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        vm.onIntent(ActiveSessionIntent.SkipRestTimer)
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals(ExerciseLogType.TIME, vm.state.value.sessionDraft?.exercises?.single()?.logType)
        assertEquals(30, vm.state.value.sessionDraft?.exercises?.single()?.targetDurationSeconds)
        assertEquals(45, set?.actualDurationSeconds)
        assertEquals(0, set?.actualRestSeconds)
        coVerify {
            repo.updateSetLog("set-log-1", match {
                it.actualDurationSeconds == 45 && it.actualRestSeconds == 0
            })
        }
    }

    @Test
    fun `explicit_time_logType_survives_successful_media_enrichment`() = runTest {
        // "Wall Sit" infers WEIGHT_REPS from its name alone (no time-signal words), but the
        // coach explicitly authored it as TIME with a 60s target. A successful exercise-library
        // fetch must not let the name-inferred logType from the library row clobber that.
        val exercises = listOf(
            WorkoutExercise(
                id = "we1",
                workoutId = "w1",
                name = "Wall Sit",
                muscleGroup = "Legs",
                sets = 2,
                reps = "60 seconds",
                restSeconds = 30,
                tips = null,
                sortOrder = 0,
                exerciseId = "wall-sit-1",
                logType = ExerciseLogType.TIME,
                targetDurationSeconds = 60,
            )
        )
        val workout = aWorkout(id = "w1", exercises = exercises)
        coEvery { repo.getWorkoutById("w1") } returns Result.success(workout)
        coEvery { exerciseRepo.getExerciseById("wall-sit-1") } returns Result.success(
            Exercise(
                id = "wall-sit-1", name = "Wall Sit", description = "", category = null,
                muscles = emptyList(), musclesSecondary = emptyList(), equipment = emptyList(),
                imageUrl = "https://example.com/wall-sit.png", imageUrl2 = null,
                videoUrl = null, difficulty = null,
            )
        )

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        val exercise = vm.state.value.sessionDraft?.exercises?.single()
        assertNotNull(exercise)
        assertEquals(ExerciseLogType.TIME, exercise.logType, "authored log_type must survive media enrichment")
        assertEquals(60, exercise.targetDurationSeconds)
        // Media enrichment itself must still run.
        assertEquals("https://example.com/wall-sit.png", exercise.imageUrl)
    }

    @Test
    fun `resume_resolves_timed_exercise_from_set_shape_not_name`() = runTest {
        // "Wall Sit" infers WEIGHT_REPS by name. The exercise is not part of a base plan draft
        // (workoutId null), so resolution must fall back to the logged sets' shape, which is
        // timed (no reps/weight, has actualDurationSeconds) — not to name inference.
        val log = WorkoutLog(
            id = "resume-log-1",
            userId = "user-1",
            workoutId = null,
            workoutName = "Ad Hoc",
            durationMinutes = 0,
            notes = null,
            exerciseLogs = listOf(
                com.coachfoska.app.domain.model.ExerciseLog(
                    id = "exercise-log-1",
                    workoutLogId = "resume-log-1",
                    exerciseName = "Wall Sit",
                    notes = null,
                    exerciseId = "wall-sit-1",
                    sets = listOf(
                        SetLog(
                            id = "set-log-1",
                            exerciseLogId = "exercise-log-1",
                            sortOrder = 1,
                            targetReps = null,
                            actualReps = null,
                            targetWeightKg = null,
                            actualWeightKg = null,
                            rpe = null,
                            targetRestSeconds = null,
                            actualRestSeconds = null,
                            completed = true,
                            actualDurationSeconds = 45,
                        )
                    ),
                )
            ),
            loggedAt = kotlinx.datetime.Instant.parse("2026-07-03T10:00:00Z"),
            status = "in_progress",
        )
        coEvery { repo.getInProgressSession("user-1") } returns Result.success(log)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1", resumeLogId = "resume-log-1"))
        advanceUntilIdle()

        val exercise = vm.state.value.sessionDraft?.exercises?.single()
        assertNotNull(exercise)
        assertEquals(ExerciseLogType.TIME, exercise.logType, "must resolve TIME from set shape, not name")
        val set = exercise.sets.first()
        assertEquals(45, set.actualDurationSeconds, "resumed duration must remain visible")
    }

    @Test
    fun `StartSetTimer sets a wall-clock anchor on the target set only`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aTimedWorkout(sets = 2))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 0))

        val sets = vm.state.value.sessionDraft?.exercises?.single()?.sets
        assertNotNull(sets)
        assertNotNull(sets[0].timerStartedAtEpochMillis, "target set must carry a running anchor")
        assertNull(sets[1].timerStartedAtEpochMillis, "other sets must stay paused")
    }

    @Test
    fun `PauseSetTimer folds elapsed into actualDurationSeconds and clears the anchor`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aTimedWorkout(sets = 1))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        // Seed a 30s baseline, then run and pause. The wall clock advances only microseconds inside
        // a test, so the fold must preserve the baseline and add at most one whole second.
        vm.onIntent(ActiveSessionIntent.UpdateSetDuration(0, 0, 30))
        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 0))
        assertNotNull(vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()?.timerStartedAtEpochMillis)

        vm.onIntent(ActiveSessionIntent.PauseSetTimer(0, 0))

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertNull(set?.timerStartedAtEpochMillis, "anchor must be cleared on pause")
        val folded = set?.actualDurationSeconds
        assertNotNull(folded)
        assertTrue(folded in 30..31, "fold must preserve the 30s baseline plus wall-clock delta, was $folded")
    }

    @Test
    fun `resuming a legacy timed set folds from actualRestSeconds baseline when actualDurationSeconds is null`() = runTest {
        // Pre-20260710224911 timed logs stored their duration in actual_rest_seconds (see
        // TimeTrackerCell's baselineSeconds fallback). A legacy in-progress set resumed with only
        // actualRestSeconds set must keep that baseline when its stopwatch is started and paused.
        val log = WorkoutLog(
            id = "resume-log-1",
            userId = "user-1",
            workoutId = null,
            workoutName = "Ad Hoc",
            durationMinutes = 0,
            notes = null,
            exerciseLogs = listOf(
                com.coachfoska.app.domain.model.ExerciseLog(
                    id = "exercise-log-1",
                    workoutLogId = "resume-log-1",
                    exerciseName = "Plank Hold",
                    notes = null,
                    exerciseId = "plank-1",
                    sets = listOf(
                        SetLog(
                            id = "set-log-1",
                            exerciseLogId = "exercise-log-1",
                            sortOrder = 1,
                            targetReps = null,
                            actualReps = null,
                            targetWeightKg = null,
                            actualWeightKg = null,
                            rpe = null,
                            targetRestSeconds = null,
                            actualRestSeconds = 45,
                            completed = false,
                            actualDurationSeconds = null,
                        )
                    ),
                )
            ),
            loggedAt = kotlinx.datetime.Instant.parse("2026-07-03T10:00:00Z"),
            status = "in_progress",
        )
        coEvery { repo.getInProgressSession("user-1") } returns Result.success(log)

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1", resumeLogId = "resume-log-1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 0))
        vm.onIntent(ActiveSessionIntent.PauseSetTimer(0, 0))

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertNull(set?.timerStartedAtEpochMillis, "anchor must be cleared on pause")
        val folded = set?.actualDurationSeconds
        assertNotNull(folded)
        assertTrue(folded in 45..46, "fold must preserve the legacy 45s baseline, was $folded")
    }

    @Test
    fun `starting a second set timer folds the first (single-timer invariant)`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aTimedWorkout(sets = 2))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 0))
        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 1))

        val sets = vm.state.value.sessionDraft?.exercises?.single()?.sets
        assertNotNull(sets)
        assertNull(sets[0].timerStartedAtEpochMillis, "first timer must be folded when the second starts")
        assertNotNull(sets[1].timerStartedAtEpochMillis, "the newly started timer must be running")
        assertNotNull(sets[0].actualDurationSeconds, "the folded first set must have captured its elapsed time")
        assertEquals(
            1,
            sets.count { it.timerStartedAtEpochMillis != null },
            "at most one set-timer may run at a time",
        )
    }

    @Test
    fun `completing a running timed set folds its elapsed and persists the duration`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aTimedWorkout(sets = 1))
        coEvery { repo.saveSetLog(any(), any(), any(), any(), any(), any(), any()) } returns
            Result.success(SavedSetRef("exercise-log-1", "set-log-1"))

        val vm = viewModel()
        vm.onIntent(ActiveSessionIntent.InitSession("w1"))
        advanceUntilIdle()

        vm.onIntent(ActiveSessionIntent.UpdateSetDuration(0, 0, 30))
        vm.onIntent(ActiveSessionIntent.StartSetTimer(0, 0))
        vm.onIntent(ActiveSessionIntent.MarkSetComplete(0, 0, completed = true))
        advanceUntilIdle()

        val set = vm.state.value.sessionDraft?.exercises?.single()?.sets?.first()
        assertEquals(true, set?.completed)
        assertNull(set?.timerStartedAtEpochMillis, "completing must clear the running anchor")
        val folded = set?.actualDurationSeconds
        assertNotNull(folded)
        assertTrue(folded in 30..31, "completion must capture the full elapsed on top of the baseline")
        coVerify {
            repo.saveSetLog(any(), any(), any(), any(), any(), any(), match { it.actualDurationSeconds in 30..31 })
        }
    }

    private fun aTimedWorkout(sets: Int = 2, restSeconds: Int = 60) = aWorkout(
        id = "w1",
        exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Plank Hold", muscleGroup = "Core",
                sets = sets, reps = "30 seconds", restSeconds = restSeconds,
                tips = null, sortOrder = 0,
                exerciseId = "plank-1",
                logType = ExerciseLogType.TIME,
                targetDurationSeconds = 30,
            )
        ),
    )

    private fun aPreviousSet(sortOrder: Int, weight: Float) = SetLog(
        id = "prev-$sortOrder", exerciseLogId = "", sortOrder = sortOrder,
        targetReps = 8, actualReps = 8, targetWeightKg = null, actualWeightKg = weight,
        rpe = null, targetRestSeconds = null, actualRestSeconds = null, completed = true,
    )

    private fun aWorkoutWithSingleExercise(restSeconds: Int = 90) = aWorkout(
        id = "w1",
        exercises = listOf(
            WorkoutExercise(
                id = "we1", workoutId = "w1",
                name = "Bench Press", muscleGroup = "Chest",
                sets = 3, reps = "8", restSeconds = restSeconds,
                tips = null, sortOrder = 0,
                exerciseId = "b1",
            )
        ),
    )
}
