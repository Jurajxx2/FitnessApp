package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.WgerExercise

interface ExerciseRepository {
    /** Search exercises by name from WGER API. */
    suspend fun searchExercises(query: String): Result<List<WgerExercise>>

    /** Get detailed exercise info by WGER exercise ID. */
    suspend fun getExerciseById(id: Int): Result<WgerExercise>

    /** Get exercises by muscle group category ID. */
    suspend fun getExercisesByCategory(categoryId: Int): Result<List<WgerExercise>>
}
