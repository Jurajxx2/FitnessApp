package com.coachfoska.app.domain.usecase.exercise

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class GetExercisesUseCase(private val repository: ExerciseRepository) {
    suspend operator fun invoke(
        offset: Int,
        limit: Int = PAGE_SIZE,
        categoryId: Int? = null,
        query: String? = null,
        difficulty: String? = null,
        sortDescending: Boolean = false,
        ids: List<String>? = null
    ): Result<List<Exercise>> = repository.getExercises(
        offset = offset,
        limit = limit,
        categoryId = categoryId,
        query = query,
        difficulty = difficulty,
        sortDescending = sortDescending,
        ids = ids
    )

    companion object {
        const val PAGE_SIZE = 25
    }
}
