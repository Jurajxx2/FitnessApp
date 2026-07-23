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

    private fun workoutExercise(name: String, logType: ExerciseLogType?, muscleGroup: String? = null, reps: String = "10") =
        WorkoutExercise(
            id = "we1", workoutId = "w1", name = name, muscleGroup = muscleGroup,
            sets = 3, reps = reps, restSeconds = 60, tips = null,
            logType = logType,
        )

    @Test
    fun `resolvedLogType returns explicit type when set, ignoring inference`() {
        // Name screams TIME, but the stored logType is authoritative.
        val exercise = workoutExercise(name = "Plank", logType = ExerciseLogType.WEIGHT_REPS)
        assertEquals(ExerciseLogType.WEIGHT_REPS, exercise.resolvedLogType())
    }

    @Test
    fun `resolvedLogType infers from name and reps when logType is null`() {
        val exercise = workoutExercise(name = "Plank", logType = null, muscleGroup = "Core")
        assertEquals(ExerciseLogType.TIME, exercise.resolvedLogType())
    }

    @Test
    fun `resolvedLogType falls back to weight_reps default when nothing matches`() {
        val exercise = workoutExercise(name = "Some Custom Move", logType = null)
        assertEquals(ExerciseLogType.WEIGHT_REPS, exercise.resolvedLogType())
    }
}
