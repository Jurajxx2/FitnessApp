package com.coachfoska.app.data

import com.coachfoska.app.data.repository.shadowForks
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutSource
import kotlin.test.Test
import kotlin.test.assertEquals

private fun workout(
    id: String,
    source: WorkoutSource = WorkoutSource.COACH,
    forkedFromWorkoutId: String? = null,
) = Workout(
    id = id, name = "Test", dayOfWeek = null, durationMinutes = 0,
    exercises = emptyList(), source = source, forkedFromWorkoutId = forkedFromWorkoutId,
)

class WorkoutPlanShadowingTest {
    @Test
    fun fork_shadows_its_source_plan() {
        val coach = workout(id = "c1", source = WorkoutSource.COACH)
        val fork = workout(id = "u1", source = WorkoutSource.USER, forkedFromWorkoutId = "c1")
        val other = workout(id = "c2", source = WorkoutSource.COACH)
        assertEquals(listOf(fork, other), shadowForks(listOf(coach, fork, other)))
    }
}
