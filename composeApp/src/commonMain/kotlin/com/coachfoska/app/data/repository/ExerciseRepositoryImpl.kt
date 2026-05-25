package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository

class ExerciseRepositoryImpl(
    private val dataSource: ExerciseSupabaseDataSource
) : ExerciseRepository {

    override suspend fun getExercises(
        offset: Int,
        limit: Int,
        categoryId: Int?,
        query: String?,
        difficulty: String?,
        sortDescending: Boolean,
        ids: List<String>?
    ): Result<List<Exercise>> = runCatching {
        dataSource.getExercises(
            offset = offset,
            limit = limit,
            categoryId = categoryId,
            query = query,
            difficulty = difficulty,
            sortDescending = sortDescending,
            ids = ids
        ).map { it.toDomain() }
    }

    override suspend fun getExerciseById(id: String): Result<Exercise> = runCatching {
        dataSource.getExerciseById(id).toDomain()
    }

    override suspend fun getCategories(): Result<List<ExerciseCategory>> = runCatching {
        dataSource.getCategories().map { it.toDomain() }
    }

    override suspend fun getExercisesByCategory(categoryId: Int): Result<List<Exercise>> = runCatching {
        dataSource.getExercisesByCategory(categoryId).map { it.toDomain() }
    }

    override suspend fun searchExercises(query: String): Result<List<Exercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return runCatching { dataSource.searchExercises(query.trim()).map { it.toDomain() } }
    }

    override suspend fun getFavoriteIds(userId: String): Result<Set<String>> = runCatching {
        dataSource.getFavoriteIds(userId).toSet()
    }

    override suspend fun setFavorite(userId: String, exerciseId: String, isFavorite: Boolean): Result<Unit> = runCatching {
        if (isFavorite) dataSource.addFavorite(userId, exerciseId)
        else dataSource.removeFavorite(userId, exerciseId)
    }
}
