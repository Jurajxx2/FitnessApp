package com.coachfoska.app.presentation.recipe

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.domain.usecase.recipe.ScaleRecipeUseCase
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "RecipeDetailViewModel"

data class RecipeDetailState(
    val isLoading: Boolean = true,
    val originalRecipe: Recipe? = null,
    val recipe: Recipe? = null,
    val selectedServings: Int = 1,
    val error: String? = null,
    val isFavorite: Boolean = false,
)

sealed interface RecipeDetailIntent {
    data object Reload : RecipeDetailIntent
    data class AdjustRecipeServings(val servings: Int) : RecipeDetailIntent
    data object ToggleFavorite : RecipeDetailIntent
}

class RecipeDetailViewModel(
    private val repository: MealRepository,
    private val scaleRecipe: ScaleRecipeUseCase,
    private val getFavoriteRecipeIdsUseCase: GetFavoriteRecipeIdsUseCase,
    private val toggleFavoriteRecipeUseCase: ToggleFavoriteRecipeUseCase,
    private val recipeId: String,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RecipeDetailState(isLoading = true))
    val state: StateFlow<RecipeDetailState> = _state.asStateFlow()

    private var loadFavoriteJob: Job? = null

    init {
        load()
        loadFavorite()
    }

    fun onIntent(intent: RecipeDetailIntent) {
        when (intent) {
            is RecipeDetailIntent.AdjustRecipeServings -> adjustServings(intent.servings)
            RecipeDetailIntent.Reload -> load()
            RecipeDetailIntent.ToggleFavorite -> toggleFavorite()
        }
    }

    private fun load() {
        _state.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            repository.getRecipeById(recipeId).fold(
                onSuccess = { recipe ->
                    if (recipe == null) {
                        _state.update { it.copy(isLoading = false, error = "Recipe not found") }
                    } else {
                        _state.update {
                            it.copy(
                                isLoading = false,
                                originalRecipe = recipe,
                                recipe = recipe,
                                selectedServings = recipe.servings.coerceAtLeast(1),
                                error = null,
                            )
                        }
                    }
                },
                onFailure = { t ->
                    Napier.e("load recipe failed", t, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = t.message ?: "Failed to load") }
                },
            )
        }
    }

    private fun loadFavorite() {
        loadFavoriteJob = viewModelScope.launch {
            getFavoriteRecipeIdsUseCase(userId)
                .onSuccess { ids -> _state.update { it.copy(isFavorite = recipeId in ids) } }
                .onFailure { e -> Napier.e("loadFavorite failed", e, tag = TAG) }
        }
    }

    private fun toggleFavorite() {
        loadFavoriteJob?.cancel()
        val nowFavorite = !_state.value.isFavorite
        _state.update { it.copy(isFavorite = nowFavorite) }
        viewModelScope.launch {
            toggleFavoriteRecipeUseCase(userId, recipeId, nowFavorite)
                .onFailure { e ->
                    Napier.e("toggleFavorite($recipeId) failed", e, tag = TAG)
                    _state.update { it.copy(isFavorite = !nowFavorite) }
                }
        }
    }

    private fun adjustServings(target: Int) {
        val base = _state.value.originalRecipe ?: return
        val scaled = scaleRecipe(base, target)
        _state.update { it.copy(recipe = scaled, selectedServings = scaled.servings) }
    }
}
