package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

enum class ExerciseSortOrder { NAME_ASC, NAME_DESC }

data class ExerciseState(
    val exercises: List<Exercise> = emptyList(),
    val isLoadingExercises: Boolean = false,
    val isLoadingMore: Boolean = false,
    val hasMore: Boolean = true,
    val searchQuery: String = "",
    val selectedCategoryId: Int? = null,
    val selectedDifficulty: String? = null,
    val sortOrder: ExerciseSortOrder = ExerciseSortOrder.NAME_ASC,
    val categories: List<ExerciseCategory> = emptyList(),
    val isCategoriesLoading: Boolean = false,
    val selectedExercise: Exercise? = null,
    val isLoadingDetail: Boolean = false,
    val error: String? = null,
    val favoriteIds: Set<String> = emptySet(),
    val isFavoritesLoading: Boolean = false,
    val showOnlyFavorites: Boolean = false
)
