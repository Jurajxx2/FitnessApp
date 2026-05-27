package com.coachfoska.app.presentation.nutrition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetFavoriteRecipeIdsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetRecipesUseCase
import com.coachfoska.app.domain.usecase.nutrition.SearchFoodsUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import com.coachfoska.app.domain.usecase.nutrition.ToggleFavoriteRecipeUseCase
import com.coachfoska.app.core.util.todayDate
import io.github.aakira.napier.Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "NutritionViewModel"

class NutritionViewModel(
    private val getActiveMealPlanUseCase: GetActiveMealPlanUseCase,
    private val logMealUseCase: LogMealUseCase,
    private val getMealHistoryUseCase: GetMealHistoryUseCase,
    private val getRecipesUseCase: GetRecipesUseCase,
    private val searchFoodsUseCase: SearchFoodsUseCase,
    private val getFavoriteRecipeIdsUseCase: GetFavoriteRecipeIdsUseCase,
    private val toggleFavoriteRecipeUseCase: ToggleFavoriteRecipeUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(NutritionState(selectedDayOfWeek = todayDayOfWeek()))
    val state: StateFlow<NutritionState> = _state.asStateFlow()

    private var loadFavoritesJob: Job? = null

    init {
        onIntent(NutritionIntent.LoadMealPlan)
    }

    fun onIntent(intent: NutritionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            NutritionIntent.LoadMealPlan -> loadMealPlan()
            NutritionIntent.LoadHistory -> loadHistory()
            NutritionIntent.LoadRecipes -> loadRecipes()
            is NutritionIntent.SelectMeal -> selectMeal(intent.mealId)
            is NutritionIntent.SelectMealLog -> selectMealLog(intent.logId)
            is NutritionIntent.LogMeal -> logMeal(intent)
            NutritionIntent.DismissError -> _state.update { it.copy(error = null) }
            NutritionIntent.MealLogged -> _state.update { it.copy(mealLoggedSuccess = false) }
            is NutritionIntent.SearchFoods -> searchFoods(intent.query)
            is NutritionIntent.SelectDay -> _state.update { it.copy(selectedDayOfWeek = intent.dayOfWeek) }
            is NutritionIntent.ToggleFavoriteRecipe -> toggleFavoriteRecipe(intent.recipeId)
            NutritionIntent.ToggleFavoritesFilter -> _state.update { it.copy(showOnlyFavorites = !it.showOnlyFavorites) }
        }
    }

    private fun searchFoods(query: String) {
        if (query.isBlank()) {
            _state.update { it.copy(searchResults = emptyList()) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isSearching = true) }
            searchFoodsUseCase(query)
                .onSuccess { results ->
                    _state.update { it.copy(isSearching = false, searchResults = results) }
                }
                .onFailure { e ->
                    Napier.e("searchFoods($query) failed", e, tag = TAG)
                    _state.update { it.copy(isSearching = false, error = e.message) }
                }
        }
    }

    private fun loadMealPlan() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getActiveMealPlanUseCase(userId)
                .onSuccess { plan ->
                    _state.update { it.copy(isLoading = false, mealPlan = plan) }
                }
                .onFailure { e ->
                    Napier.e("loadMealPlan failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun loadRecipes() {
        viewModelScope.launch {
            _state.update { it.copy(isRecipesLoading = true, error = null) }
            getRecipesUseCase()
                .onSuccess { recipes -> _state.update { it.copy(isRecipesLoading = false, allRecipes = recipes) } }
                .onFailure { e ->
                    Napier.e("loadRecipes failed", e, tag = TAG)
                    _state.update { it.copy(isRecipesLoading = false, error = e.message) }
                }
        }
        loadFavoritesJob = viewModelScope.launch {
            getFavoriteRecipeIdsUseCase(userId)
                .onSuccess { ids -> _state.update { it.copy(favoriteRecipeIds = ids) } }
                .onFailure { e -> Napier.e("loadFavoriteRecipes failed", e, tag = TAG) }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true, error = null) }
            getMealHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, mealHistory = logs) } }
                .onFailure { e ->
                    Napier.e("loadHistory failed", e, tag = TAG)
                    _state.update { it.copy(isHistoryLoading = false, error = e.message) }
                }
        }
    }

    private fun selectMeal(mealId: String) {
        val meal = _state.value.mealPlan?.meals?.firstOrNull { it.id == mealId }
        _state.update { it.copy(selectedMeal = meal) }
    }

    private fun selectMealLog(logId: String) {
        val log = _state.value.mealHistory.firstOrNull { it.id == logId }
        _state.update { it.copy(selectedMealLog = log) }
    }

    private fun logMeal(intent: NutritionIntent.LogMeal) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true, error = null) }
            logMealUseCase(userId, intent.mealName, intent.foods, intent.notes)
                .onSuccess {
                    Napier.i("Meal logged: ${intent.mealName}", tag = TAG)
                    _state.update { it.copy(isLogging = false, mealLoggedSuccess = true) }
                }
                .onFailure { e ->
                    Napier.e("logMeal failed", e, tag = TAG)
                    _state.update { it.copy(isLogging = false, error = e.message) }
                }
        }
    }

    private fun toggleFavoriteRecipe(recipeId: String) {
        loadFavoritesJob?.cancel()
        val current = _state.value.favoriteRecipeIds
        val nowFavorite = recipeId !in current
        _state.update {
            it.copy(favoriteRecipeIds = if (nowFavorite) current + recipeId else current - recipeId)
        }
        viewModelScope.launch {
            toggleFavoriteRecipeUseCase(userId, recipeId, nowFavorite)
                .onFailure { e ->
                    Napier.e("toggleFavoriteRecipe($recipeId) failed", e, tag = TAG)
                    _state.update {
                        it.copy(favoriteRecipeIds = if (nowFavorite) it.favoriteRecipeIds - recipeId else it.favoriteRecipeIds + recipeId)
                    }
                }
        }
    }

    private fun todayDayOfWeek(): Int = todayDate().dayOfWeek.ordinal
}
