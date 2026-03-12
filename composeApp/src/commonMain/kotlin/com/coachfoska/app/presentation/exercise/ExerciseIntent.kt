package com.coachfoska.app.presentation.exercise

sealed interface ExerciseIntent {
    data class SearchQueryChanged(val query: String) : ExerciseIntent
    data object Search : ExerciseIntent
    data class SelectExercise(val exerciseId: Int) : ExerciseIntent
    data object ClearSelection : ExerciseIntent
    data object DismissError : ExerciseIntent
}
