package com.coachfoska.app.data.remote.dto

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class OpenFoodFactsMapperTest {

    private fun response(
        code: String? = "737628064502",
        name: String? = "Peanut Butter",
        brands: String? = "Acme",
        kcal: Float? = 588f,
        protein: Float? = 25f,
        carbs: Float? = 20f,
        fat: Float? = 50f,
        product: Boolean = true,
    ) = OpenFoodFactsResponse(
        status = 1,
        code = code,
        product = if (product) OpenFoodFactsProduct(
            productName = name,
            brands = brands,
            servingSize = "32 g",
            nutriments = OpenFoodFactsNutriments(
                energyKcal100g = kcal,
                proteins100g = protein,
                carbohydrates100g = carbs,
                fat100g = fat,
            )
        ) else null
    )

    @Test
    fun `maps a complete product to Food per 100g`() {
        val food = response().toFood()!!
        assertEquals("737628064502", food.id)
        assertEquals("Peanut Butter", food.name)
        assertEquals(588f, food.calories)
        assertEquals(25f, food.proteinG)
        assertEquals(20f, food.carbsG)
        assertEquals(50f, food.fatG)
        assertEquals(100f, food.servingSize)
        assertEquals("g", food.servingUnit)
        assertEquals("Acme", food.brand)
        assertEquals(false, food.isVerified)
    }

    @Test
    fun `null product returns null`() {
        assertNull(response(product = false).toFood())
    }

    @Test
    fun `blank name returns null`() {
        assertNull(response(name = "  ").toFood())
    }

    @Test
    fun `missing kcal returns null`() {
        assertNull(response(kcal = null).toFood())
    }

    @Test
    fun `missing non-kcal nutriments coerce to zero`() {
        val food = response(protein = null, carbs = null, fat = null).toFood()!!
        assertEquals(0f, food.proteinG)
        assertEquals(0f, food.carbsG)
        assertEquals(0f, food.fatG)
    }

    @Test
    fun `falls back to name as id when code is null`() {
        assertEquals("Peanut Butter", response(code = null).toFood()!!.id)
    }
}
