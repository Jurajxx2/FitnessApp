package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.model.WgerExercise

data class ExerciseState(
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val searchResults: List<WgerExercise> = emptyList(),
    val selectedExercise: WgerExercise? = null,
    val isLoadingDetail: Boolean = false,
    val categories: List<ExerciseCategory> = emptyList(),
    val isCategoriesLoading: Boolean = false,
    val categoryExercises: List<WgerExercise> = emptyList(),
    val isCategoryExercisesLoading: Boolean = false,
    val error: String? = null
)
