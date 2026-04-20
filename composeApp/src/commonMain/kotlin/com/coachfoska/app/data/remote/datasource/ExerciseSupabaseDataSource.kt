package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

private const val EXERCISE_COLUMNS = "*, exercise_categories(id, name)"

class ExerciseSupabaseDataSource(private val supabase: SupabaseClient) {

    suspend fun getCategories(): List<ExerciseCategoryDto> =
        supabase.postgrest["exercise_categories"]
            .select {
                order("name", Order.ASCENDING)
            }
            .decodeList()

    suspend fun getExercisesByCategory(categoryId: Int): List<ExerciseDto> =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter {
                    eq("category_id", categoryId)
                    eq("is_active", true)
                }
                order("name_en", Order.ASCENDING)
            }
            .decodeList()

    suspend fun getExerciseById(id: String): ExerciseDto =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter { eq("id", id) }
            }
            .decodeSingle()

    suspend fun searchExercises(query: String): List<ExerciseDto> =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter {
                    or {
                        ilike("name_en", "%$query%")
                        ilike("name_cs", "%$query%")
                    }
                    eq("is_active", true)
                }
                limit(20)
            }
            .decodeList()
}
