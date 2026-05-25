package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.ExerciseCategoryDto
import com.coachfoska.app.data.remote.dto.ExerciseDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.Serializable

private const val EXERCISE_COLUMNS = "*, exercise_categories(id, name)"
private const val FAVORITES_TABLE = "exercise_favorites"

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

    suspend fun getExercises(
        offset: Int,
        limit: Int,
        categoryId: Int? = null,
        query: String? = null,
        difficulty: String? = null,
        sortDescending: Boolean = false,
        ids: List<String>? = null
    ): List<ExerciseDto> =
        supabase.postgrest["exercises"]
            .select(columns = Columns.raw(EXERCISE_COLUMNS)) {
                filter {
                    eq("is_active", true)
                    if (categoryId != null) eq("category_id", categoryId)
                    if (!query.isNullOrBlank()) {
                        or {
                            ilike("name_en", "%$query%")
                            ilike("name_cs", "%$query%")
                        }
                    }
                    if (difficulty != null) eq("difficulty", difficulty)
                    if (!ids.isNullOrEmpty()) isIn("id", ids)
                }
                order("name_en", if (sortDescending) Order.DESCENDING else Order.ASCENDING)
                range(offset.toLong(), (offset + limit - 1).toLong())
            }
            .decodeList()

    suspend fun getFavoriteIds(userId: String): List<String> =
        supabase.postgrest[FAVORITES_TABLE]
            .select(columns = Columns.raw("exercise_id")) {
                filter { eq("user_id", userId) }
            }
            .decodeList<FavoriteRow>()
            .map { it.exercise_id }

    suspend fun addFavorite(userId: String, exerciseId: String) {
        supabase.postgrest[FAVORITES_TABLE]
            .upsert(FavoriteInsertDto(user_id = userId, exercise_id = exerciseId))
    }

    suspend fun removeFavorite(userId: String, exerciseId: String) {
        supabase.postgrest[FAVORITES_TABLE]
            .delete {
                filter {
                    eq("user_id", userId)
                    eq("exercise_id", exerciseId)
                }
            }
    }
}

@Serializable
private data class FavoriteRow(val exercise_id: String)

@Serializable
private data class FavoriteInsertDto(
    val user_id: String,
    val exercise_id: String
)
