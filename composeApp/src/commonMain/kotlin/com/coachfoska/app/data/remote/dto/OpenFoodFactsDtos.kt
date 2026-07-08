package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Food
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OpenFoodFactsResponse(
    val status: Int? = null,
    val code: String? = null,
    val product: OpenFoodFactsProduct? = null,
)

@Serializable
data class OpenFoodFactsProduct(
    @SerialName("product_name") val productName: String? = null,
    val brands: String? = null,
    @SerialName("serving_size") val servingSize: String? = null,
    val nutriments: OpenFoodFactsNutriments? = null,
)

@Serializable
data class OpenFoodFactsNutriments(
    @SerialName("energy-kcal_100g") val energyKcal100g: Float? = null,
    @SerialName("proteins_100g") val proteins100g: Float? = null,
    @SerialName("carbohydrates_100g") val carbohydrates100g: Float? = null,
    @SerialName("fat_100g") val fat100g: Float? = null,
)

fun OpenFoodFactsResponse.toFood(): Food? {
    val p = product ?: return null
    val name = p.productName?.takeIf { it.isNotBlank() } ?: return null
    val kcal = p.nutriments?.energyKcal100g ?: return null
    return Food(
        id = code ?: name,
        name = name,
        calories = kcal,
        proteinG = p.nutriments.proteins100g ?: 0f,
        carbsG = p.nutriments.carbohydrates100g ?: 0f,
        fatG = p.nutriments.fat100g ?: 0f,
        servingSize = 100f,
        servingUnit = "g",
        brand = p.brands?.takeIf { it.isNotBlank() },
        isVerified = false,
    )
}
