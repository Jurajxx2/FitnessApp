package com.coachfoska.app.presentation.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

data class ExerciseState(
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val searchResults: List<Exercise> = emptyList(),
    val selectedExercise: Exercise? = null,
    val isLoadingDetail: Boolean = false,
    val categories: List<ExerciseCategory> = emptyList(),
    val isCategoriesLoading: Boolean = false,
    val categoryExercises: List<Exercise> = emptyList(),
    val isCategoryExercisesLoading: Boolean = false,
    val error: String? = null
)
