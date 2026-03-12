package com.coachfoska.app.presentation.nutrition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

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
        when (intent) {
            NutritionIntent.LoadMealPlan -> loadMealPlan()
            NutritionIntent.LoadHistory -> loadHistory()
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
                .onSuccess { plan -> _state.update { it.copy(isLoading = false, mealPlan = plan) } }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message) } }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true) }
            getMealHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, mealHistory = logs) } }
                .onFailure { e -> _state.update { it.copy(isHistoryLoading = false, error = e.message) } }
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
                .onSuccess { _state.update { it.copy(isLogging = false, mealLoggedSuccess = true) } }
                .onFailure { e -> _state.update { it.copy(isLogging = false, error = e.message) } }
        }
    }
}
