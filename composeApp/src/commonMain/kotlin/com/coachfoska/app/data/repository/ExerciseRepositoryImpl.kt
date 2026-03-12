package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ExerciseApiDataSource
import com.coachfoska.app.domain.model.WgerExercise
import com.coachfoska.app.domain.repository.ExerciseRepository

class ExerciseRepositoryImpl(
    private val exerciseApiDataSource: ExerciseApiDataSource
) : ExerciseRepository {

    override suspend fun searchExercises(query: String): Result<List<WgerExercise>> = runCatching {
        exerciseApiDataSource.searchExercises(query).map { it.toDomain() }
    }

    override suspend fun getExerciseById(id: Int): Result<WgerExercise> = runCatching {
        exerciseApiDataSource.getExerciseById(id).toDomain()
    }

    override suspend fun getExercisesByCategory(categoryId: Int): Result<List<WgerExercise>> = runCatching {
        exerciseApiDataSource.getExercisesByCategory(categoryId).map { it.toDomain() }
    }
}
