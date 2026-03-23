package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.MealLogDto
import com.coachfoska.app.data.remote.dto.MealLogFoodDto
import com.coachfoska.app.data.remote.dto.MealLogFoodInsertDto
import com.coachfoska.app.data.remote.dto.MealLogInsertDto
import com.coachfoska.app.data.remote.dto.MealPlanDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.LocalDate

class MealRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getActiveMealPlan(userId: String): MealPlanDto? {
        val global = supabase.postgrest["meal_plans"]
            .select {
                filter {
                    exact("user_id", null)
                    eq("is_active", true)
                }
                limit(1)
            }
            .decodeList<MealPlanDto>()

        val userSpecific = supabase.postgrest["meal_plans"]
            .select {
                filter {
                    eq("user_id", userId)
                    eq("is_active", true)
                }
                limit(1)
            }
            .decodeList<MealPlanDto>()

        return (userSpecific + global).firstOrNull()
    }

    suspend fun insertMealLog(
        userId: String,
        mealName: String,
        notes: String?,
        imageUrl: String? = null
    ): MealLogDto {
        val payload = MealLogInsertDto(
            userId = userId,
            mealName = mealName,
            loggedAt = currentInstant().toString(),
            notes = notes,
            imageUrl = imageUrl
        )
        return supabase.postgrest["meal_logs"]
            .insert(payload) { select() }
            .decodeSingle<MealLogDto>()
    }

    suspend fun insertMealLogFoods(foods: List<MealLogFoodInsertDto>): List<MealLogFoodDto> =
        supabase.postgrest["meal_log_foods"]
            .insert(foods) { select() }
            .decodeList<MealLogFoodDto>()

    suspend fun getMealHistory(userId: String): List<MealLogDto> =
        supabase.postgrest["meal_logs"]
            .select {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<MealLogDto>()

    suspend fun getMealLogsByDate(userId: String, date: LocalDate): List<MealLogDto> =
        supabase.postgrest["meal_logs"]
            .select {
                filter {
                    eq("user_id", userId)
                    gte("logged_at", "${date}T00:00:00Z")
                    lt("logged_at", "${date.run { LocalDate(year, monthNumber, dayOfMonth + 1) }}T00:00:00Z")
                }
            }
            .decodeList<MealLogDto>()
}
