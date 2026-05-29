package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise

data class SessionDraft(
    val workoutId: String?,
    val workoutName: String,
    val startTime: Long,
    val notes: String? = null,
    val exercises: List<ExerciseDraft>
)

data class ExerciseDraft(
    val exerciseName: String,
    val sets: List<SetDraft>,
    val videoUrl: String? = null,
    val muscleGroup: String? = null,
    val tips: String? = null,
    val exerciseId: String? = null,
    val initialSetsGoal: Int = 3,
    val initialRepsGoal: String = "10"
)

data class SetDraft(
    val sortOrder: Int,
    val targetReps: Int?,
    val actualReps: Int?,
    val targetWeightKg: Float?,
    val actualWeightKg: Float?,
    val rpe: Int? = null,
    val targetRestSeconds: Int?,
    val actualRestSeconds: Int?,
    val completed: Boolean = false
)

fun Workout.toDraft(startTime: Long) = SessionDraft(
    workoutId = id,
    workoutName = name,
    startTime = startTime,
    exercises = exercises.sortedBy { it.sortOrder }.map { it.toDraft() }
)

fun WorkoutExercise.toDraft(): ExerciseDraft {
    val repsGoal = reps.substringBefore('-').filter { it.isDigit() }.toIntOrNull()
    return ExerciseDraft(
        exerciseName = name,
        initialSetsGoal = sets,
        initialRepsGoal = reps,
        videoUrl = videoUrl,
        muscleGroup = muscleGroup,
        tips = tips,
        exerciseId = exerciseId,
        sets = (1..sets).map { order ->
            SetDraft(
                sortOrder = order,
                targetReps = repsGoal,
                actualReps = null,
                targetWeightKg = null,
                actualWeightKg = null,
                rpe = null,
                targetRestSeconds = restSeconds,
                actualRestSeconds = null
            )
        }
    )
}
