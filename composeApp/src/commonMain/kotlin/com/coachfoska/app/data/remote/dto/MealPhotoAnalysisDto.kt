package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.MealPhotoAnalysis
import com.coachfoska.app.domain.model.MealPhotoAnalysisFood
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MealPhotoAnalysisDto(
    val mealName: String = "Meal",
    val foods: List<MealPhotoAnalysisFoodDto> = emptyList()
) {
    fun toDomain(): MealPhotoAnalysis = MealPhotoAnalysis(
        mealName = mealName,
        foods = foods.map { it.toDomain() }
    )
}

@Serializable
data class MealPhotoAnalysisFoodDto(
    val name: String = "",
    val amount: Float = 100f,
    val unit: String = "g",
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f
) {
    fun toDomain(): MealPhotoAnalysisFood = MealPhotoAnalysisFood(
        name = name,
        amount = amount,
        unit = unit,
        calories = calories,
        proteinG = proteinG,
        carbsG = carbsG,
        fatG = fatG
    )
}
