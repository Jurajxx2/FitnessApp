package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

interface ExerciseRepository {
    suspend fun searchExercises(query: String): Result<List<Exercise>>
    suspend fun getExerciseById(id: String): Result<Exercise>
    suspend fun getCategories(): Result<List<ExerciseCategory>>
    suspend fun getExercisesByCategory(categoryId: Int): Result<List<Exercise>>
}
