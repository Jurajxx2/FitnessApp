package com.coachfoska.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
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
    private val observeChatMessagesUseCase: ObserveChatMessagesUseCase,
    private val hydrationRepository: HydrationRepository,
    private val calculateWaterGoalUseCase: CalculateWaterGoalUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    private var initialLoadStarted = false

    init {
        onIntent(HomeIntent.LoadData)
    }

    fun onIntent(intent: HomeIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            HomeIntent.LoadData -> loadData(force = false)
            HomeIntent.Refresh -> loadData(force = true)
        }
    }

    private fun loadData(force: Boolean = false) {
        if (!force && (initialLoadStarted || _state.value.isLoading)) {
            Napier.d("loadData skipped — already loaded or in progress", tag = TAG)
            return
        }
        initialLoadStarted = true
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
            val chatDeferred = async {
                runCatching {
                    observeChatMessagesUseCase(userId, ChatType.Human).first().lastOrNull()
                }.getOrNull()
            }
            val waterLogsDeferred = async { hydrationRepository.getTodayLogs(userId) }

            val profileResult = profileDeferred.await()
            val workoutsResult = workoutsDeferred.await()
            val nutritionResult = nutritionDeferred.await()
            val lastCoachMessage = chatDeferred.await()
            val waterLogsResult = waterLogsDeferred.await()
            val waterConsumed = waterLogsResult.getOrDefault(emptyList()).sumOf { it.amountMl }
            val waterGoal = profileResult.getOrNull()?.let { calculateWaterGoalUseCase(it) } ?: 2000

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
                    lastCoachMessage = lastCoachMessage,
                    waterConsumedMl = waterConsumed,
                    waterGoalMl = waterGoal,
                    error = error
                )
            }
        }
    }
}
