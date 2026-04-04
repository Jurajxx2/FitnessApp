package com.coachfoska.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private const val TAG = "HomeViewModel"

class HomeViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getDailyNutritionSummaryUseCase: GetDailyNutritionSummaryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    init {
        onIntent(HomeIntent.LoadData)
    }

    fun onIntent(intent: HomeIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            HomeIntent.LoadData, HomeIntent.Refresh -> loadData()
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            val today = todayDate()
            val todayDayOfWeek = currentInstant()
                .toLocalDateTime(TimeZone.currentSystemDefault())
                .dayOfWeek
                .ordinal // 0=Monday in kotlinx.datetime

            val profileDeferred = async { getUserProfileUseCase(userId) }
            val workoutsDeferred = async { getAssignedWorkoutsUseCase(userId) }
            val nutritionDeferred = async { getDailyNutritionSummaryUseCase(userId, today) }

            val profileResult = profileDeferred.await()
            val workoutsResult = workoutsDeferred.await()
            val nutritionResult = nutritionDeferred.await()

            profileResult.onFailure { e -> Napier.e("loadProfile failed", e, tag = TAG) }
            workoutsResult.onFailure { e -> Napier.e("loadWorkouts failed", e, tag = TAG) }
            nutritionResult.onFailure { e -> Napier.e("loadNutrition failed", e, tag = TAG) }

            val error = profileResult.exceptionOrNull()?.message
                ?: workoutsResult.exceptionOrNull()?.message
                ?: nutritionResult.exceptionOrNull()?.message

            val workouts = workoutsResult.getOrNull() ?: emptyList()
            val todayWorkout = workouts.firstOrNull { it.dayOfWeek?.index == todayDayOfWeek }

            _state.update {
                it.copy(
                    isLoading = false,
                    user = profileResult.getOrNull(),
                    todayWorkout = todayWorkout,
                    nutritionSummary = nutritionResult.getOrNull(),
                    error = error
                )
            }
        }
    }
}
