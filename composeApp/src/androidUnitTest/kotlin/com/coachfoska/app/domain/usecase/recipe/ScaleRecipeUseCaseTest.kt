package com.coachfoska.app.domain.usecase.recipe

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.RecipeIngredient
import kotlin.test.Test
import kotlin.test.assertEquals

class ScaleRecipeUseCaseTest {
    private val useCase = ScaleRecipeUseCase()

    private val baseRecipe = Recipe(
        id = "r1", name = "Pasta",
        description = "", calories = 600f, protein = 20f, carbs = 80f, fat = 18f,
        servings = 2,
        ingredients = listOf(
            RecipeIngredient(name = "Spaghetti", quantity = 200f, unit = "g",
                calories = 360f, proteinG = 12f, carbsG = 72f, fatG = 2f),
            RecipeIngredient(name = "Tomato sauce", quantity = null, unit = null,
                calories = 60f, proteinG = 1f, carbsG = 6f, fatG = 3f),
        ),
    )

    @Test
    fun `scaling to same servings keeps quantities and macros`() {
        val scaled = useCase(baseRecipe, targetServings = 2)
        assertEquals(200f, scaled.ingredients[0].quantity)
        assertEquals(600f, scaled.calories)
    }

    @Test
    fun `doubling servings doubles ingredient quantities and macros`() {
        val scaled = useCase(baseRecipe, targetServings = 4)
        assertEquals(400f, scaled.ingredients[0].quantity)
        assertEquals(1200f, scaled.calories)
        assertEquals(40f, scaled.protein)
        assertEquals(4, scaled.servings)
    }

    @Test
    fun `null quantities remain null after scaling`() {
        val scaled = useCase(baseRecipe, targetServings = 6)
        assertEquals(null, scaled.ingredients[1].quantity)
    }

    @Test
    fun `target servings below 1 is clamped to 1`() {
        val scaled = useCase(baseRecipe, targetServings = 0)
        assertEquals(1, scaled.servings)
        assertEquals(100f, scaled.ingredients[0].quantity) // halved
    }
}
