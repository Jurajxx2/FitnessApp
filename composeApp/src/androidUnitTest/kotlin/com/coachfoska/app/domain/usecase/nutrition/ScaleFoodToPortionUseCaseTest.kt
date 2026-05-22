package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.Food
import com.coachfoska.app.domain.model.MealLogFood
import kotlin.test.Test
import kotlin.test.assertEquals

class ScaleFoodToPortionUseCaseTest {
    private val useCase = ScaleFoodToPortionUseCase()

    private val chicken = Food(
        id = "f1", name = "Chicken breast",
        calories = 165f, proteinG = 31f, carbsG = 0f, fatG = 3.6f,
        servingSize = 100f, servingUnit = "g", brand = null, isVerified = true,
    )

    @Test
    fun `scales linearly when same unit, double portion`() {
        val result = useCase(chicken, amount = 200f, unit = "g")
        assertEquals(330f, result.calories)
        assertEquals(62f, result.proteinG)
        assertEquals(200f, result.amount)
        assertEquals("g", result.unit)
    }

    @Test
    fun `passes through when amount equals serving size`() {
        val result = useCase(chicken, amount = 100f, unit = "g")
        assertEquals(165f, result.calories)
        assertEquals(31f, result.proteinG)
    }

    @Test
    fun `unit mismatch keeps user amount and scales by ratio against serving size`() {
        // User picked "1 piece" of a 150g serving; we treat 1 unit as 1.0 ratio fallback.
        val result = useCase(chicken, amount = 1f, unit = "piece")
        assertEquals(165f, result.calories) // ratio 1.0 because unit mismatch
        assertEquals("piece", result.unit)
        assertEquals(1f, result.amount)
    }

    @Test
    fun `zero amount yields zero macros`() {
        val result = useCase(chicken, amount = 0f, unit = "g")
        assertEquals(0f, result.calories)
        assertEquals(0f, result.proteinG)
    }
}
