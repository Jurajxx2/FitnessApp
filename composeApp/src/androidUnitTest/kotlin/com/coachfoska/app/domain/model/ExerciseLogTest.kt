package com.coachfoska.app.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ExerciseLogTest {

    private fun set(
        order: Int,
        reps: Int?,
        weight: Float?,
        completed: Boolean = true,
        duration: Int? = null,
        restSeconds: Int? = null,
    ) =
        SetLog(
            id = "s$order", exerciseLogId = "el", sortOrder = order,
            targetReps = null, actualReps = reps,
            targetWeightKg = null, actualWeightKg = weight,
            rpe = null, targetRestSeconds = null, actualRestSeconds = restSeconds,
            completed = completed,
            actualDurationSeconds = duration,
        )

    private fun log(sets: List<SetLog>) = ExerciseLog(
        id = "el", workoutLogId = "wl", exerciseName = "Bench Press",
        notes = null, videoUrl = null, sets = sets,
    )

    @Test fun `summaryLine empty when no completed sets`() {
        assertEquals("", log(emptyList()).summaryLine)
        assertEquals("", log(listOf(set(1, 10, 60f, completed = false))).summaryLine)
    }

    @Test fun `summaryLine all equal reps - count x reps @ weight`() {
        val sets = listOf(set(1, 10, 60f), set(2, 10, 60f), set(3, 10, 60f))
        assertEquals("3 × 10 @ 60 kg", log(sets).summaryLine)
    }

    @Test fun `summaryLine varying reps - joined comma`() {
        val sets = listOf(set(1, 10, 60f), set(2, 10, 60f), set(3, 8, 60f))
        assertEquals("10, 10, 8 @ 60 kg", log(sets).summaryLine)
    }

    @Test fun `summaryLine null reps falls back to N sets`() {
        val sets = listOf(set(1, null, 60f), set(2, null, 60f))
        assertEquals("2 sets @ 60 kg", log(sets).summaryLine)
    }

    @Test fun `summaryLine fractional weight preserves decimal`() {
        val sets = listOf(set(1, 5, 62.5f), set(2, 5, 62.5f))
        assertEquals("2 × 5 @ 62.5 kg", log(sets).summaryLine)
    }

    @Test fun `summaryLine null weight omits weight segment`() {
        val sets = listOf(set(1, 10, null), set(2, 10, null))
        assertEquals("2 × 10", log(sets).summaryLine)
    }

    @Test fun `setsCompletedCount counts only completed`() {
        val sets = listOf(set(1, 10, 60f, completed = true), set(2, 8, 60f, completed = false))
        assertEquals(1, log(sets).setsCompletedCount)
    }

    @Test fun `summaryLine all timed uniform - count x duration`() {
        val sets = listOf(
            set(1, null, null, duration = 45),
            set(2, null, null, duration = 45),
            set(3, null, null, duration = 45),
        )
        assertEquals("3 × 00:45", log(sets).summaryLine)
    }

    @Test fun `summaryLine all timed varied - joined comma`() {
        val sets = listOf(
            set(1, null, null, duration = 30),
            set(2, null, null, duration = 45),
            set(3, null, null, duration = 60),
        )
        assertEquals("00:30, 00:45, 01:00", log(sets).summaryLine)
    }

    @Test fun `summaryLine mixed reps and timed emits both parts`() {
        val sets = listOf(
            set(1, 10, 60f),
            set(2, 10, 60f),
            set(3, null, null, duration = 45),
            set(4, null, null, duration = 45),
        )
        assertEquals("2 × 10 @ 60 kg · 2 × 00:45", log(sets).summaryLine)
    }

    @Test fun `summaryLine duration count excludes completed sets missing duration`() {
        val sets = listOf(
            set(1, null, null, duration = 45),
            set(2, null, null, duration = 45),
            set(3, null, null, duration = null),
        )
        assertEquals("2 × 00:45", log(sets).summaryLine)
    }

    @Test fun `isTimed true for duration-only sets`() {
        val sets = listOf(set(1, null, null, duration = 45), set(2, null, null, duration = 30))
        assertTrue(log(sets).isTimed())
    }

    @Test fun `isTimed false for rep sets`() {
        val sets = listOf(set(1, 10, 60f), set(2, 10, 60f))
        assertFalse(log(sets).isTimed())
    }

    @Test fun `isTimed false for weight-only sets with no reps`() {
        val sets = listOf(set(1, null, 60f), set(2, null, 60f))
        assertFalse(log(sets).isTimed())
    }

    @Test fun `isTimed true for legacy actualRestSeconds-only sets`() {
        val sets = listOf(set(1, null, null, restSeconds = 60), set(2, null, null, restSeconds = 60))
        assertTrue(log(sets).isTimed())
    }

    @Test fun `isTimed false for empty sets`() {
        assertFalse(log(emptyList()).isTimed())
    }

    @Test fun `isTimed prefers actualDurationSeconds over legacy rest fallback when both present`() {
        val sets = listOf(set(1, null, null, duration = 45, restSeconds = 60))
        assertTrue(log(sets).isTimed())
    }
}
