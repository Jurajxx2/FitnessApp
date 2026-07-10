package com.coachfoska.app.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals

class ExerciseLogTypeTest {
    @Test
    fun `pushups are logged as bodyweight reps`() {
        assertEquals(
            ExerciseLogType.BODYWEIGHT_REPS,
            inferExerciseLogType(name = "Push-ups", equipment = listOf("None")),
        )
    }

    @Test
    fun `running is logged as time`() {
        assertEquals(
            ExerciseLogType.TIME,
            inferExerciseLogType(name = "Easy Running", categoryName = "Cardio"),
        )
    }

    @Test
    fun `dumbbell exercises are logged as weight and reps`() {
        assertEquals(
            ExerciseLogType.WEIGHT_REPS,
            inferExerciseLogType(name = "Dumbbell Bench Press", equipment = listOf("Dumbbell")),
        )
    }

    @Test
    fun `ab roller exercises are logged as bodyweight reps`() {
        assertEquals(
            ExerciseLogType.BODYWEIGHT_REPS,
            inferExerciseLogType(
                name = "Ab Roller",
                categoryName = "Abdominals",
                equipment = listOf("Ab Roller"),
                reps = "10",
            ),
        )
    }
}
