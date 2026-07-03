package com.coachfoska.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
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
    private val calculateMacroTargetsUseCase: CalculateMacroTargetsUseCase,
    private val getWaterContainersUseCase: GetWaterContainersUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val getWeightHistoryUseCase: GetWeightHistoryUseCase,
    private val workoutRepository: WorkoutRepository,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state.asStateFlow()

    private var initialLoadStarted = false
    private var clearedCoachMessage: Any? = null

    init {
        onIntent(HomeIntent.LoadData)
    }

    fun onIntent(intent: HomeIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            HomeIntent.LoadData -> loadData(force = false)
            HomeIntent.Refresh -> loadData(force = true)
            HomeIntent.QuickAddWater -> quickAddWater()
            HomeIntent.MarkCoachMessageRead -> {
                clearedCoachMessage = _state.value.lastCoachMessage
                _state.update { it.copy(hasUnreadCoachMessage = false) }
            }
            HomeIntent.RetryMetrics -> loadMetrics()
        }
    }

    private fun quickAddWater() {
        val amountMl = _state.value.quickAddVolumeMl
        _state.update { it.copy(waterConsumedMl = it.waterConsumedMl + amountMl) }
        viewModelScope.launch {
            hydrationRepository.logWater(userId, amountMl).onFailure { e ->
                Napier.e("quickAddWater failed", e, tag = TAG)
                _state.update { it.copy(waterConsumedMl = (it.waterConsumedMl - amountMl).coerceAtLeast(0), error = e.message) }
            }
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
            val historyDeferred = async { getWorkoutHistoryUseCase(userId) }
            val nutritionDeferred = async { getDailyNutritionSummaryUseCase(userId, today) }
            val chatDeferred = async {
                runCatching {
                    observeChatMessagesUseCase(userId, ChatType.Human).first().lastOrNull()
                }.getOrNull()
            }
            val waterLogsDeferred = async { hydrationRepository.getTodayLogs(userId) }
            val containersDeferred = async { getWaterContainersUseCase(userId) }
            val weightHistoryDeferred = async { getWeightHistoryUseCase(userId) }
            val streakDeferred = async { workoutRepository.getCurrentStreak(userId) }

            val profileResult = profileDeferred.await()
            val workoutsResult = workoutsDeferred.await()
            val historyResult = historyDeferred.await()
            val nutritionResult = nutritionDeferred.await()
            val lastCoachMessage = chatDeferred.await()
            val waterLogsResult = waterLogsDeferred.await()
            val containers = containersDeferred.await().getOrDefault(emptyList())
            val waterConsumed = waterLogsResult.getOrDefault(emptyList()).sumOf { it.amountMl }
            val waterGoal = profileResult.getOrNull()?.let { calculateWaterGoalUseCase(it) } ?: 2000
            val quickAddVolume = (containers.firstOrNull { it.isFavorite } ?: containers.firstOrNull())?.volumeMl ?: 250
            val weightResult = weightHistoryDeferred.await()
            val streakResult = streakDeferred.await()

            profileResult.onFailure { e -> Napier.e("loadProfile failed", e, tag = TAG) }
            workoutsResult.onFailure { e -> Napier.e("loadWorkouts failed", e, tag = TAG) }
            nutritionResult.onFailure { e -> Napier.e("loadNutrition failed", e, tag = TAG) }
            waterLogsResult.onFailure { e -> Napier.e("loadWaterLogs failed", e, tag = TAG) }
            historyResult.onFailure { e -> Napier.e("loadHistory failed", e, tag = TAG) }
            weightResult.onFailure { e -> Napier.e("loadWeightHistory failed", e, tag = TAG) }
            streakResult.onFailure { e -> Napier.e("loadStreak failed", e, tag = TAG) }

            val error = profileResult.exceptionOrNull()?.message
                ?: workoutsResult.exceptionOrNull()?.message
                ?: nutritionResult.exceptionOrNull()?.message

            val workouts = workoutsResult.getOrNull() ?: emptyList()
            val todayWorkout = workouts.firstOrNull { it.dayOfWeek?.index == todayDayOfWeek }
            val loadedUser = profileResult.getOrNull()
            val workoutHistory = historyResult.getOrDefault(emptyList())

            // Week window: Monday 00:00 local (week starts Monday; ordinal 0 = Monday)
            val todayEpoch = today.toEpochDays()
            val mondayEpoch = todayEpoch - today.dayOfWeek.ordinal
            val weekWorkoutsDone = workoutHistory.count { log ->
                log.loggedAt.toLocalDateTime(TimeZone.currentSystemDefault())
                    .date.toEpochDays() >= mondayEpoch
            }

            // Weight metrics: latest entry = current; delta vs. entry closest to 30 days back
            val weightEntries = weightResult.getOrDefault(emptyList())
                .sortedByDescending { it.recordedAt }
            val currentWeightKg = weightEntries.firstOrNull()?.weightKg
            val thirtyDaysEpoch = todayEpoch - 30
            val weightDeltaKg = if (weightEntries.size >= 2 && currentWeightKg != null) {
                val referenceEntry = weightEntries.drop(1).minByOrNull { entry ->
                    kotlin.math.abs(entry.recordedAt.toEpochDays() - thirtyDaysEpoch)
                }
                referenceEntry?.let { currentWeightKg - it.weightKg }
            } else null

            val streakWeeks = streakResult.getOrDefault(0)
            // First-run: no workout history AND no coach-assigned workouts
            val isFirstRun = workoutHistory.isEmpty() && workouts.isEmpty()
            // Metrics error is non-fatal — other cards still render
            val metricsError = weightResult.isFailure || streakResult.isFailure

            _state.update {
                it.copy(
                    isLoading = false,
                    user = loadedUser,
                    todayWorkout = todayWorkout,
                    workouts = workouts,
                    workoutHistory = workoutHistory,
                    nutritionSummary = nutritionResult.getOrNull(),
                    macroTargets = loadedUser?.let { u -> calculateMacroTargetsUseCase(u) },
                    lastCoachMessage = lastCoachMessage,
                    hasUnreadCoachMessage = lastCoachMessage != null && lastCoachMessage != clearedCoachMessage,
                    waterConsumedMl = waterConsumed,
                    waterGoalMl = waterGoal,
                    quickAddVolumeMl = quickAddVolume,
                    error = error,
                    weekWorkoutsDone = weekWorkoutsDone,
                    currentWeightKg = currentWeightKg,
                    weightDeltaKg = weightDeltaKg,
                    streakWeeks = streakWeeks,
                    isFirstRun = isFirstRun,
                    metricsError = metricsError,
                )
            }
        }
    }

    /** Re-runs only the metrics loads without blanking the whole screen. */
    private fun loadMetrics() {
        viewModelScope.launch {
            _state.update { it.copy(metricsError = false) }
            val today = todayDate()
            val todayEpoch = today.toEpochDays()
            val weightResult = getWeightHistoryUseCase(userId)
            val streakResult = workoutRepository.getCurrentStreak(userId)

            weightResult.onFailure { e -> Napier.e("retryMetrics: loadWeightHistory failed", e, tag = TAG) }
            streakResult.onFailure { e -> Napier.e("retryMetrics: loadStreak failed", e, tag = TAG) }

            val weightEntries = weightResult.getOrDefault(emptyList())
                .sortedByDescending { it.recordedAt }
            val currentWeightKg = weightEntries.firstOrNull()?.weightKg
            val thirtyDaysEpoch = todayEpoch - 30
            val weightDeltaKg = if (weightEntries.size >= 2 && currentWeightKg != null) {
                val referenceEntry = weightEntries.drop(1).minByOrNull { entry ->
                    kotlin.math.abs(entry.recordedAt.toEpochDays() - thirtyDaysEpoch)
                }
                referenceEntry?.let { currentWeightKg - it.weightKg }
            } else null

            val streakWeeks = streakResult.getOrDefault(0)
            val metricsError = weightResult.isFailure || streakResult.isFailure

            _state.update {
                it.copy(
                    currentWeightKg = currentWeightKg,
                    weightDeltaKg = weightDeltaKg,
                    streakWeeks = streakWeeks,
                    metricsError = metricsError,
                )
            }
        }
    }
}
