package com.coachfoska.app.presentation.workout

sealed interface ActiveSessionIntent {
    data class InitSession(val workoutId: String) : ActiveSessionIntent
    data class SwitchExercise(val index: Int) : ActiveSessionIntent
    data class UpdateSetActual(
        val exerciseIndex: Int,
        val setIndex: Int,
        val reps: Int?,
        val weight: Float?,
    ) : ActiveSessionIntent
    data class MarkSetComplete(
        val exerciseIndex: Int,
        val setIndex: Int,
        val completed: Boolean,
    ) : ActiveSessionIntent
    data class AddExtraSet(val exerciseIndex: Int) : ActiveSessionIntent
    data class RemoveSet(val exerciseIndex: Int, val setIndex: Int) : ActiveSessionIntent
    data class AddExerciseNote(val exerciseIndex: Int, val note: String) : ActiveSessionIntent
    data class StartRestTimer(val seconds: Int) : ActiveSessionIntent
    data object SkipRestTimer : ActiveSessionIntent
    data class AdjustRestTimer(val deltaSeconds: Int) : ActiveSessionIntent
    data object DismissPRBanner : ActiveSessionIntent
    data class SubmitSession(val notes: String?) : ActiveSessionIntent
    data object DismissError : ActiveSessionIntent
}
