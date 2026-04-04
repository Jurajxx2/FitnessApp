package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExerciseCategoriesUseCase(private val exerciseRepository: ExerciseRepository) {
    suspend operator fun invoke(): Result<List<ExerciseCategory>> = exerciseRepository.getCategories()
}
