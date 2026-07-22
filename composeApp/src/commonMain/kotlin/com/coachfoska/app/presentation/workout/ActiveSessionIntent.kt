package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Exercise

sealed interface ActiveSessionIntent {
    data class InitSession(val workoutId: String, val resumeLogId: String? = null) : ActiveSessionIntent
    data class SwitchExercise(val index: Int) : ActiveSessionIntent
    data class UpdateSetActual(
        val exerciseIndex: Int,
        val setIndex: Int,
        val reps: Int?,
        val weight: Float?,
    ) : ActiveSessionIntent
    data class UpdateSetDuration(
        val exerciseIndex: Int,
        val setIndex: Int,
        val durationSeconds: Int?,
    ) : ActiveSessionIntent
    data class MarkSetComplete(
        val exerciseIndex: Int,
        val setIndex: Int,
        val completed: Boolean,
    ) : ActiveSessionIntent
    /** Start (or resume) the durable wall-clock stopwatch for a timed set. */
    data class StartSetTimer(
        val exerciseIndex: Int,
        val setIndex: Int,
    ) : ActiveSessionIntent
    /** Pause a timed set's stopwatch, folding the elapsed wall-clock time into its duration. */
    data class PauseSetTimer(
        val exerciseIndex: Int,
        val setIndex: Int,
    ) : ActiveSessionIntent
    data class AddExtraSet(val exerciseIndex: Int) : ActiveSessionIntent
    data class RemoveSet(val exerciseIndex: Int, val setIndex: Int) : ActiveSessionIntent
    data class SkipToNextExercise(val exerciseIndex: Int) : ActiveSessionIntent
    data class AddExerciseNote(val exerciseIndex: Int, val note: String) : ActiveSessionIntent
    data class StartRestTimer(
        val seconds: Int,
        val exerciseIndex: Int? = null,
        val setIndex: Int? = null,
    ) : ActiveSessionIntent
    data object SkipRestTimer : ActiveSessionIntent
    data class AdjustRestTimer(val deltaSeconds: Int) : ActiveSessionIntent
    data object DismissPRBanner : ActiveSessionIntent
    data class SubmitSession(val notes: String?) : ActiveSessionIntent
    data class RetrySetSave(val exerciseIndex: Int, val setIndex: Int) : ActiveSessionIntent
    data object DiscardSession : ActiveSessionIntent
    data object DismissError : ActiveSessionIntent
    data object DismissExistingSessionNotice : ActiveSessionIntent
    data class AddExercise(val exercise: Exercise) : ActiveSessionIntent
    data class MoveExercise(val exerciseIndex: Int, val direction: Int) : ActiveSessionIntent
    data class SubstituteExercise(val exerciseIndex: Int, val replacement: Exercise) : ActiveSessionIntent
    data object DismissSubstitution : ActiveSessionIntent
    data class RenameSession(val name: String) : ActiveSessionIntent
    data class ChangeSetType(val exerciseIndex: Int, val setIndex: Int, val setType: SetType) : ActiveSessionIntent
}
