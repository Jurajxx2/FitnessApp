package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Recipe
import kotlin.test.Test
import kotlin.test.assertEquals

class NutritionStateTest {

    private fun recipe(id: String, featured: Boolean = false) =
        Recipe(id = id, name = id, description = "", calories = 0f, protein = 0f, carbs = 0f, fat = 0f, isFeatured = featured)

    @Test fun `featuredRecipes returns only flagged recipes when some are featured`() {
        val state = NutritionState(
            allRecipes = listOf(recipe("a"), recipe("b", featured = true), recipe("c", featured = true))
        )
        assertEquals(listOf("b", "c"), state.featuredRecipes.map { it.id })
    }

    @Test fun `featuredRecipes falls back to first 10 when none are flagged`() {
        val all = (1..15).map { recipe("r$it") }
        val state = NutritionState(allRecipes = all)
        assertEquals(10, state.featuredRecipes.size)
        assertEquals("r1", state.featuredRecipes.first().id)
    }

    @Test fun `featuredRecipes is empty when there are no recipes`() {
        assertEquals(emptyList(), NutritionState().featuredRecipes)
    }
}
