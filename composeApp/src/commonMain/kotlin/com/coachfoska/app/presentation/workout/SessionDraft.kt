package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutExercise
import com.coachfoska.app.domain.model.ExerciseLogType
import com.coachfoska.app.domain.model.ExerciseLottieAnimation
import com.coachfoska.app.domain.model.resolvedLogType

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
    /**
     * Wall-clock anchor (epoch millis) of a currently-running exercise stopwatch, or null when the
     * stopwatch is paused. Transient session state only — never persisted. [actualDurationSeconds]
     * stays the folded baseline; the live elapsed value is derived via [currentElapsedSeconds].
     */
    val timerStartedAtEpochMillis: Long? = null,
)

enum class SetSaveState { Idle, Saving, Saved, Failed }

/**
 * Live elapsed seconds for a timed set, anchored to the wall clock so it self-corrects after the
 * row is scrolled off-screen, recomposed, or the app is backgrounded. When [startedAtEpochMillis]
 * is null the stopwatch is paused and only the [baselineSeconds] baseline is returned. While
 * running, the real time since the anchor is added on top of the baseline; the delta is clamped at
 * zero so clock skew or a future anchor can never subtract from the baseline.
 */
fun currentElapsedSeconds(baselineSeconds: Int?, startedAtEpochMillis: Long?, nowEpochMillis: Long): Int {
    val baseline = baselineSeconds ?: 0
    if (startedAtEpochMillis == null) return baseline
    val elapsedSinceAnchor = ((nowEpochMillis - startedAtEpochMillis) / 1000).coerceAtLeast(0L).toInt()
    return baseline + elapsedSinceAnchor
}

/**
 * Persist-time duration when a stopwatch is paused/completed: the same wall-clock math as
 * [currentElapsedSeconds], but a same-second fold with no prior baseline yields null instead of a
 * 0-second set. A literal 0 would persist a meaningless timed set (and is an odd thing to show in
 * history); a real recorded baseline — even 0 — is never dropped.
 */
fun foldedDurationSeconds(baselineSeconds: Int?, startedAtEpochMillis: Long?, nowEpochMillis: Long): Int? {
    val elapsed = currentElapsedSeconds(baselineSeconds, startedAtEpochMillis, nowEpochMillis)
    return elapsed.takeUnless { it == 0 && baselineSeconds == null }
}

/** Whether a set has the inputs required to be marked complete for its tracking type. */
fun SetDraft.canComplete(logType: ExerciseLogType): Boolean = when (logType) {
    ExerciseLogType.WEIGHT_REPS -> actualWeightKg != null && actualReps != null
    ExerciseLogType.BODYWEIGHT_REPS -> actualReps != null
    // A running stopwatch still counts: completing it folds the live elapsed time into a duration,
    // so the set is completable even before the first pause has written actualDurationSeconds.
    ExerciseLogType.TIME ->
        actualDurationSeconds != null || actualRestSeconds != null || timerStartedAtEpochMillis != null
}

fun Workout.toDraft(startTime: Long) = SessionDraft(
    workoutId = id,
    workoutName = name,
    startTime = startTime,
    exercises = exercises.sortedBy { it.sortOrder }.map { it.toDraft() }
)

fun WorkoutExercise.toDraft(): ExerciseDraft {
    val resolvedLogType = resolvedLogType()
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
