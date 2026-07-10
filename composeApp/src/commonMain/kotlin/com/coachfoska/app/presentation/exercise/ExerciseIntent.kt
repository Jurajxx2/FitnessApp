package com.coachfoska.app.presentation.exercise

sealed interface ExerciseIntent {
    data class SearchQueryChanged(val query: String) : ExerciseIntent
    data object LoadMoreExercises : ExerciseIntent
    data class SelectCategoryFilter(val categoryId: Int) : ExerciseIntent
    data class SelectDifficultyFilter(val difficulty: String) : ExerciseIntent
    data class SelectSortOrder(val order: ExerciseSortOrder) : ExerciseIntent
    data class SelectExercise(val exerciseId: String) : ExerciseIntent
    data class SelectExerciseByName(val exerciseName: String) : ExerciseIntent
    data object ClearSelection : ExerciseIntent
    data object DismissError : ExerciseIntent
    data class ToggleFavorite(val exerciseId: String) : ExerciseIntent
    data object ToggleFavoritesFilter : ExerciseIntent
}
