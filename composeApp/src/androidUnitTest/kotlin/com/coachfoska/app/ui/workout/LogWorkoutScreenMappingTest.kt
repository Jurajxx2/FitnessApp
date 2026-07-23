package com.coachfoska.app.ui.workout

import com.coachfoska.app.domain.model.ExerciseLogType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Covers the manual "Log Workout" screen's local draft -> domain mapping ([toExerciseLogs]) and
 * the name-driven log-type inference ([LocalDraftExercise.withNameUpdate]). Both are internal
 * seams on [LogWorkoutScreen] exposed purely for testing this ad-hoc, catalog-free entry path.
 */
class LogWorkoutScreenMappingTest {

    @Test
    fun `TIME exercise with a completed timed set maps duration and nulls reps and weight`() {
        val exercises = listOf(
            LocalDraftExercise(
                name = "Plank",
                logType = ExerciseLogType.TIME,
                sets = listOf(
                    LocalDraftSet(sortOrder = 1, actualDurationSeconds = 45, completed = true),
                ),
            ),
        )

        val logs = exercises.toExerciseLogs()

        assertEquals(1, logs.size)
        val set = logs.single().sets.single()
        assertEquals(45, set.actualDurationSeconds)
        assertNull(set.actualReps)
        assertNull(set.actualWeightKg)
    }

    @Test
    fun `WEIGHT_REPS exercise still maps reps and weight with a null duration`() {
        val exercises = listOf(
            LocalDraftExercise(
                name = "Bench Press",
                logType = ExerciseLogType.WEIGHT_REPS,
                sets = listOf(
                    LocalDraftSet(sortOrder = 1, actualReps = 10, actualWeightKg = 60f, completed = true),
                ),
            ),
        )

        val logs = exercises.toExerciseLogs()

        val set = logs.single().sets.single()
        assertEquals(10, set.actualReps)
        assertEquals(60f, set.actualWeightKg)
        assertNull(set.actualDurationSeconds)
    }

    @Test
    fun `a completed timed set with a duration is not dropped by the completed filter`() {
        val exercises = listOf(
            LocalDraftExercise(
                name = "Plank",
                logType = ExerciseLogType.TIME,
                sets = listOf(
                    LocalDraftSet(sortOrder = 1, actualDurationSeconds = 30, completed = false),
                    LocalDraftSet(sortOrder = 2, actualDurationSeconds = 45, completed = true),
                ),
            ),
        )

        val logs = exercises.toExerciseLogs()

        assertEquals(1, logs.size)
        val set = logs.single().sets.single()
        assertEquals(2, set.sortOrder)
        assertEquals(45, set.actualDurationSeconds)
    }

    @Test
    fun `exercise dropped when it has no completed sets`() {
        val exercises = listOf(
            LocalDraftExercise(
                name = "Plank",
                logType = ExerciseLogType.TIME,
                sets = listOf(LocalDraftSet(sortOrder = 1, actualDurationSeconds = 30, completed = false)),
            ),
        )

        assertTrue(exercises.toExerciseLogs().isEmpty())
    }

    @Test
    fun `withNameUpdate infers TIME from a timed-sounding name`() {
        val updated = LocalDraftExercise().withNameUpdate("Plank")

        assertEquals(ExerciseLogType.TIME, updated.logType)
        assertEquals("Plank", updated.name)
    }

    @Test
    fun `withNameUpdate infers WEIGHT_REPS from a weighted-sounding name`() {
        val updated = LocalDraftExercise().withNameUpdate("Barbell Bench Press")

        assertEquals(ExerciseLogType.WEIGHT_REPS, updated.logType)
    }

    @Test
    fun `withNameUpdate does not override an explicit user choice on later name edits`() {
        val explicit = LocalDraftExercise(
            name = "Bench Press",
            logType = ExerciseLogType.WEIGHT_REPS,
            logTypeExplicit = true,
        )

        // Renaming to something that would otherwise infer TIME must not flip the user's choice.
        val renamed = explicit.withNameUpdate("Plank")

        assertEquals(ExerciseLogType.WEIGHT_REPS, renamed.logType)
        assertEquals("Plank", renamed.name)
        assertTrue(renamed.logTypeExplicit)
    }
}
