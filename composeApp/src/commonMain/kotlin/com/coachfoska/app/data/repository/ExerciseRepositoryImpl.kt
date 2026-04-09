package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseSupabaseDataSource
import com.coachfoska.app.domain.model.Exercise
import com.coachfoska.app.domain.model.ExerciseCategory
import com.coachfoska.app.domain.repository.ExerciseRepository

class ExerciseRepositoryImpl(
    private val dataSource: ExerciseSupabaseDataSource
) : ExerciseRepository {

    override suspend fun searchExercises(query: String): Result<List<Exercise>> {
        if (query.isBlank()) return Result.success(emptyList())
        return runCatching { dataSource.searchExercises(query.trim()).map { it.toDomain() } }
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
}
