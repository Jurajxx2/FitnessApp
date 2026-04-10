package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealFood
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealLogFood
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.RecipeIngredient
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MealPlanDto(
    val id: String,
    val name: String,
    val description: String? = null,
    @SerialName("valid_from") val validFrom: String? = null,
    @SerialName("valid_to") val validTo: String? = null,
    val meals: List<MealDto> = emptyList()
) {
    fun toDomain(): MealPlan = MealPlan(
        id = id,
        name = name,
        description = description,
        meals = meals.map { it.toDomain() },
        validFrom = validFrom?.let { LocalDate.parse(it) },
        validTo = validTo?.let { LocalDate.parse(it) }
    )
}

@Serializable
data class MealDto(
    val id: String,
    @SerialName("meal_plan_id") val mealPlanId: String,
    val name: String,
    @SerialName("time_of_day") val timeOfDay: String? = null,
    @SerialName("sort_order") val sortOrder: Int = 0,
    @SerialName("meal_foods") val foods: List<MealFoodDto> = emptyList()
) {
    fun toDomain(): Meal = Meal(
        id = id,
        mealPlanId = mealPlanId,
        name = name,
        timeOfDay = timeOfDay,
        sortOrder = sortOrder,
        foods = foods.map { it.toDomain() }
    )
}

@Serializable
data class MealFoodDto(
    val id: String,
    @SerialName("meal_id") val mealId: String,
    val name: String,
    @SerialName("amount_grams") val amountGrams: Float = 100f,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f
) {
    fun toDomain(): MealFood = MealFood(
        id = id,
        mealId = mealId,
        name = name,
        amountGrams = amountGrams,
        calories = calories,
        proteinG = proteinG,
        carbsG = carbsG,
        fatG = fatG
    )
}

@Serializable
data class MealLogInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("meal_name") val mealName: String,
    @SerialName("logged_at") val loggedAt: String,
    val notes: String? = null,
    @SerialName("image_url") val imageUrl: String? = null
)

@Serializable
data class MealLogFoodInsertDto(
    @SerialName("meal_log_id") val mealLogId: String,
    val name: String,
    @SerialName("amount_grams") val amountGrams: Float = 100f,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f
)

@Serializable
data class MealLogDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("meal_name") val mealName: String,
    val notes: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("logged_at") val loggedAt: String,
    @SerialName("meal_log_foods") val foods: List<MealLogFoodDto> = emptyList()
) {
    fun toDomain(): MealLog = MealLog(
        id = id,
        userId = userId,
        mealName = mealName,
        notes = notes,
        foods = foods.map { it.toDomain() },
        imageUrl = imageUrl,
        loggedAt = Instant.parse(loggedAt)
    )
}

@Serializable
data class RecipeIngredientDto(
    val id: String,
    @SerialName("recipe_id") val recipeId: String,
    val name: String,
    val quantity: Float? = null,
    val unit: String? = null,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f,
    @SerialName("sort_order") val sortOrder: Int = 0
) {
    fun toDomain(): RecipeIngredient = RecipeIngredient(
        name = name,
        quantity = quantity,
        unit = unit,
        calories = calories,
        proteinG = proteinG,
        carbsG = carbsG,
        fatG = fatG
    )
}

/** Lightweight DTO used for the recipe list — no ingredients. */
@Serializable
data class RecipeDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("prep_time_min") val prepTimeMin: Int? = null,
    @SerialName("cook_time_min") val cookTimeMin: Int? = null,
    val servings: Int = 1,
    val difficulty: String? = null,
    val tags: List<String> = emptyList(),
    val steps: List<String> = emptyList()
) {
    fun toDomain(): Recipe = Recipe(
        id = id,
        name = name,
        description = description ?: "",
        calories = calories,
        protein = proteinG,
        carbs = carbsG,
        fat = fatG,
        imageUrl = photoUrl,
        prepTimeMinutes = prepTimeMin,
        cookTimeMinutes = cookTimeMin,
        servings = servings,
        difficulty = difficulty,
        tags = tags,
        steps = steps,
        ingredients = emptyList()
    )
}

/** Full DTO used for recipe detail — includes nested recipe_ingredients. */
@Serializable
data class RecipeDetailDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("prep_time_min") val prepTimeMin: Int? = null,
    @SerialName("cook_time_min") val cookTimeMin: Int? = null,
    val servings: Int = 1,
    val difficulty: String? = null,
    val tags: List<String> = emptyList(),
    val steps: List<String> = emptyList(),
    @SerialName("recipe_ingredients") val ingredients: List<RecipeIngredientDto> = emptyList()
) {
    fun toDomain(): Recipe = Recipe(
        id = id,
        name = name,
        description = description ?: "",
        calories = calories,
        protein = proteinG,
        carbs = carbsG,
        fat = fatG,
        imageUrl = photoUrl,
        prepTimeMinutes = prepTimeMin,
        cookTimeMinutes = cookTimeMin,
        servings = servings,
        difficulty = difficulty,
        tags = tags,
        steps = steps,
        ingredients = ingredients.sortedBy { it.sortOrder }.map { it.toDomain() }
    )
}

@Serializable
data class MealLogFoodDto(
    val id: String,
    @SerialName("meal_log_id") val mealLogId: String,
    val name: String,
    @SerialName("amount_grams") val amountGrams: Float = 100f,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f
) {
    fun toDomain(): MealLogFood = MealLogFood(
        id = id,
        mealLogId = mealLogId,
        name = name,
        amountGrams = amountGrams,
        calories = calories,
        proteinG = proteinG,
        carbsG = carbsG,
        fatG = fatG
    )
}
