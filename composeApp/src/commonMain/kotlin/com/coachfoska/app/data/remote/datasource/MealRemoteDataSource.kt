package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.MealLogDto
import com.coachfoska.app.data.remote.dto.MealLogFoodDto
import com.coachfoska.app.data.remote.dto.MealLogFoodInsertDto
import com.coachfoska.app.data.remote.dto.MealLogInsertDto
import com.coachfoska.app.data.remote.dto.CurrentMealPlanIdDto
import com.coachfoska.app.data.remote.dto.GetCurrentMealPlanIdParams
import com.coachfoska.app.data.remote.dto.GetActiveNutritionTargetParams
import com.coachfoska.app.data.remote.dto.NutritionTargetDto
import com.coachfoska.app.data.remote.dto.MealPlanDto
import com.coachfoska.app.data.remote.dto.RecipeDetailDto
import com.coachfoska.app.data.remote.dto.RecipeDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.LocalDate
import kotlinx.serialization.Serializable

private const val RECIPE_FAVORITES_TABLE = "recipe_favorites"

class MealRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getActiveNutritionTarget(userId: String): NutritionTargetDto? =
        supabase.postgrest
            .rpc("get_active_nutrition_target", GetActiveNutritionTargetParams(userId))
            .decodeList<NutritionTargetDto>()
            .firstOrNull()

    suspend fun getActiveMealPlan(userId: String): MealPlanDto? {
        val mealPlanId = supabase.postgrest
            .rpc("get_current_meal_plan_id", GetCurrentMealPlanIdParams(userId))
            .decodeList<CurrentMealPlanIdDto>()
            .firstOrNull()
            ?.mealPlanId
            ?: return null

        return supabase.postgrest["meal_plans"]
            .select(columns = Columns.raw("*, meals(*, meal_foods(*))")) {
                filter { eq("id", mealPlanId) }
            }
            .decodeList<MealPlanDto>()
            .firstOrNull()
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

    suspend fun searchFoods(query: String): List<com.coachfoska.app.data.remote.dto.FoodDto> =
        supabase.postgrest["foods"]
            .select {
                filter { ilike("name", "%$query%") }
                limit(20)
            }
            .decodeList<com.coachfoska.app.data.remote.dto.FoodDto>()

    suspend fun getRecipes(): List<RecipeDto> =
        supabase.postgrest["recipes"]
            .select {
                filter { eq("is_active", true) }
            }
            .decodeList<RecipeDto>()

    suspend fun getRecipeById(id: String): RecipeDetailDto? =
        supabase.postgrest["recipes"]
            .select(columns = Columns.raw("*, recipe_ingredients(*), recipe_steps(*)")) {
                filter {
                    eq("id", id)
                    eq("is_active", true)
                }
                order("step_number", Order.ASCENDING, referencedTable = "recipe_steps")
                order("sort_order", Order.ASCENDING, referencedTable = "recipe_ingredients")
                limit(1)
            }
            .decodeList<RecipeDetailDto>()
            .firstOrNull()

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

    suspend fun getFavoriteRecipeIds(userId: String): List<String> =
        supabase.postgrest[RECIPE_FAVORITES_TABLE]
            .select(columns = Columns.raw("recipe_id")) {
                filter { eq("user_id", userId) }
            }
            .decodeList<RecipeFavoriteRow>()
            .map { it.recipe_id }

    suspend fun addFavoriteRecipe(userId: String, recipeId: String) {
        supabase.postgrest[RECIPE_FAVORITES_TABLE]
            .upsert(RecipeFavoriteInsertDto(user_id = userId, recipe_id = recipeId))
    }

    suspend fun removeFavoriteRecipe(userId: String, recipeId: String) {
        supabase.postgrest[RECIPE_FAVORITES_TABLE]
            .delete {
                filter {
                    eq("user_id", userId)
                    eq("recipe_id", recipeId)
                }
            }
    }
}

@Serializable
private data class RecipeFavoriteRow(val recipe_id: String)

@Serializable
private data class RecipeFavoriteInsertDto(val user_id: String, val recipe_id: String)
