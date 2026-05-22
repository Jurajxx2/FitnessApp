package com.coachfoska.app.domain.usecase.recipe

import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.model.RecipeIngredient

class ScaleRecipeUseCase {
    operator fun invoke(recipe: Recipe, targetServings: Int): Recipe {
        val clamped = targetServings.coerceAtLeast(1)
        val base = recipe.servings.coerceAtLeast(1)
        val ratio: Float = clamped.toFloat() / base.toFloat()

        return recipe.copy(
            servings = clamped,
            calories = recipe.calories * ratio,
            protein  = recipe.protein  * ratio,
            carbs    = recipe.carbs    * ratio,
            fat      = recipe.fat      * ratio,
            ingredients = recipe.ingredients.map { ing -> ing.scaled(ratio) },
        )
    }

    private fun RecipeIngredient.scaled(ratio: Float): RecipeIngredient = copy(
        quantity = quantity?.let { it * ratio },
        calories = calories * ratio,
        proteinG = proteinG * ratio,
        carbsG   = carbsG   * ratio,
        fatG     = fatG     * ratio,
    )
}
