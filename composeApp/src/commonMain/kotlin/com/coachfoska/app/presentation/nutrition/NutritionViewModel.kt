package com.coachfoska.app.presentation.nutrition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import io.github.aakira.napier.Napier
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
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(NutritionState())
    val state: StateFlow<NutritionState> = _state.asStateFlow()

    init {
        onIntent(NutritionIntent.LoadMealPlan)
    }

    fun onIntent(intent: NutritionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            NutritionIntent.LoadMealPlan -> loadMealPlan()
            NutritionIntent.LoadHistory -> loadHistory()
            NutritionIntent.LoadRecipes -> _state.update { it.copy(isRecipesLoading = false) }
            is NutritionIntent.SelectMeal -> selectMeal(intent.mealId)
            is NutritionIntent.LogMeal -> logMeal(intent)
            NutritionIntent.DismissError -> _state.update { it.copy(error = null) }
            NutritionIntent.MealLogged -> _state.update { it.copy(mealLoggedSuccess = false) }
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
}
