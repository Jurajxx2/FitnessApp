package com.coachfoska.app.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals

class ExerciseLogTest {

    private fun set(order: Int, reps: Int?, weight: Float?, completed: Boolean = true) =
        SetLog(
            id = "s$order", exerciseLogId = "el", sortOrder = order,
            targetReps = null, actualReps = reps,
            targetWeightKg = null, actualWeightKg = weight,
            rpe = null, targetRestSeconds = null, actualRestSeconds = null,
            completed = completed,
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
}
