package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.ExerciseLottieAnimation
import com.coachfoska.app.domain.model.inferExerciseLogType

data class SessionDraft(
    val workoutId: String?,
    val workoutName: String,
    val startTime: Long,
    val workoutLogId: String? = null,
    val notes: String? = null,
    val exercises: List<ExerciseDraft>
)

data class ExerciseDraft(
    val exerciseName: String,
    val sets: List<SetDraft>,
    val imageUrl: String? = null,
    val imageUrl2: String? = null,
    val animationUrl: String? = null,
    val lottieAnimations: List<ExerciseLottieAnimation> = emptyList(),
    val videoUrl: String? = null,
    val muscleGroup: String? = null,
    val tips: String? = null,
    val exerciseId: String? = null,
    val exerciseLogId: String? = null,
    val logType: ExerciseLogType = ExerciseLogType.WEIGHT_REPS,
    val targetDurationSeconds: Int? = null,
    val initialSetsGoal: Int = 3,
    val initialRepsGoal: String = "10",
    val substitutedFromExerciseId: String? = null,
    val substitutedFromName: String? = null,
)

enum class SetType { NORMAL, WARMUP, DROP_SET, FAILURE }

data class SetDraft(
    val sortOrder: Int,
    val targetReps: Int?,
    val actualReps: Int?,
    val targetWeightKg: Float?,
    val actualWeightKg: Float?,
    val rpe: Int? = null,
    val targetRestSeconds: Int?,
    val actualRestSeconds: Int?,
    val completed: Boolean = false,
    val setType: SetType = SetType.NORMAL,
    val setLogId: String? = null,
    val saveState: SetSaveState = SetSaveState.Idle,
    /** Duration of a timed exercise; independent of the between-set rest countdown. */
    val actualDurationSeconds: Int? = null,
)

enum class SetSaveState { Idle, Saving, Saved, Failed }

fun Workout.toDraft(startTime: Long) = SessionDraft(
    workoutId = id,
    workoutName = name,
    startTime = startTime,
    exercises = exercises.sortedBy { it.sortOrder }.map { it.toDraft() }
)

fun WorkoutExercise.toDraft(): ExerciseDraft {
    val resolvedLogType = logType ?: inferExerciseLogType(
        name = name,
        categoryName = muscleGroup,
        reps = reps,
    )
    val repsGoal = reps.substringBefore('-').filter { it.isDigit() }.toIntOrNull()
    return ExerciseDraft(
        exerciseName = name,
        initialSetsGoal = sets,
        initialRepsGoal = if (resolvedLogType == ExerciseLogType.TIME) "time" else reps,
        videoUrl = videoUrl,
        muscleGroup = muscleGroup,
        tips = tips,
        exerciseId = exerciseId,
        logType = resolvedLogType,
        targetDurationSeconds = targetDurationSeconds,
        substitutedFromExerciseId = substitutedFromExerciseId,
        substitutedFromName = substitutedFromName,
        sets = (1..sets).map { order ->
            SetDraft(
                sortOrder = order,
                targetReps = repsGoal.takeIf { resolvedLogType != ExerciseLogType.TIME },
                // Prefill reps with the plan target so the user rarely types — they just
                // confirm or tweak. Weight is prefilled later from the previous session
                // (see ActiveSessionViewModel.loadPreviousData).
                actualReps = repsGoal.takeIf { resolvedLogType != ExerciseLogType.TIME },
                targetWeightKg = null,
                actualWeightKg = null,
                rpe = null,
                targetRestSeconds = restSeconds,
                actualRestSeconds = null,
                setType = SetType.NORMAL,
            )
        }
    )
}
