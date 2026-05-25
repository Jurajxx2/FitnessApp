package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory

interface ExerciseRepository {
    suspend fun getExercises(
        offset: Int,
        limit: Int,
        categoryId: Int? = null,
        query: String? = null,
        difficulty: String? = null,
        sortDescending: Boolean = false,
        ids: List<String>? = null
    ): Result<List<Exercise>>
    suspend fun getExerciseById(id: String): Result<Exercise>
    suspend fun getCategories(): Result<List<ExerciseCategory>>
    suspend fun getExercisesByCategory(categoryId: Int): Result<List<Exercise>>
    suspend fun searchExercises(query: String): Result<List<Exercise>>
    suspend fun getFavoriteIds(userId: String): Result<Set<String>>
    suspend fun setFavorite(userId: String, exerciseId: String, isFavorite: Boolean): Result<Unit>
}
