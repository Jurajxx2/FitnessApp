package com.coachfoska.app.presentation.recipe

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "RecipeDetailViewModel"

data class RecipeDetailState(
    val isLoading: Boolean = true,
    val recipe: Recipe? = null,
    val error: String? = null
)

class RecipeDetailViewModel(
    private val getRecipeByIdUseCase: GetRecipeByIdUseCase,
    private val recipeId: String
) : ViewModel() {

    private val _state = MutableStateFlow(RecipeDetailState())
    val state: StateFlow<RecipeDetailState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getRecipeByIdUseCase(recipeId)
                .onSuccess { recipe ->
                    if (recipe != null) {
                        _state.update { it.copy(isLoading = false, recipe = recipe) }
                    } else {
                        _state.update { it.copy(isLoading = false, error = "Recipe not found") }
                    }
                }
                .onFailure { e ->
                    Napier.e("load recipe failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }
}
