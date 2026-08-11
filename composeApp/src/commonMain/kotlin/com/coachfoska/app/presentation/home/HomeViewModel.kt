package com.coachfoska.app.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetActiveNutritionTargetUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.coachfoska.app.core.util.currentInstant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.math.abs

private const val TAG = "HomeViewModel"

class HomeViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getDailyNutritionSummaryUseCase: GetDailyNutritionSummaryUseCase,
    private val getActiveNutritionTargetUseCase: GetActiveNutritionTargetUseCase,
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
        Napier.d("Intent received: ${intent::class.simpleName}", tag = TAG)
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

            val profileResult = getUserProfileUseCase(userId)
            val loadedUser = profileResult.getOrNull()
            val canAccessActivity = loadedUser?.accessMode?.canAccessActivity ?: true
            val canAccessNutrition = loadedUser?.accessMode?.canAccessNutrition ?: true
            val workoutsDeferred = if (canAccessActivity) async { getAssignedWorkoutsUseCase(userId) } else null
            val historyDeferred = if (canAccessActivity) async { getWorkoutHistoryUseCase(userId) } else null
            val nutritionDeferred = if (canAccessNutrition) async { getDailyNutritionSummaryUseCase(userId, today) } else null
            val macroTargetDeferred = if (canAccessNutrition) async { getActiveNutritionTargetUseCase(userId) } else null
            val chatDeferred = async {
                runCatching {
                    observeChatMessagesUseCase(userId, ChatType.Human).first().lastOrNull()
                }.getOrNull()
            }
            val waterLogsDeferred = if (canAccessNutrition) async { hydrationRepository.getTodayLogs(userId) } else null
            val containersDeferred = if (canAccessNutrition) async { getWaterContainersUseCase(userId) } else null
            val weightHistoryDeferred = async { getWeightHistoryUseCase(userId) }
            val streakDeferred = if (canAccessActivity) async { workoutRepository.getCurrentStreak(userId) } else null

            val workoutsResult = workoutsDeferred?.await() ?: Result.success(emptyList())
            val historyResult = historyDeferred?.await() ?: Result.success(emptyList())
            val nutritionResult = nutritionDeferred?.await() ?: Result.success(null)
            val macroTargetResult = macroTargetDeferred?.await() ?: Result.success(null)
            val lastCoachMessage = chatDeferred.await()
            val waterLogsResult = waterLogsDeferred?.await() ?: Result.success(emptyList())
            val containers = containersDeferred?.await()?.getOrDefault(emptyList()) ?: emptyList()
            val waterConsumed = waterLogsResult.getOrDefault(emptyList()).sumOf { it.amountMl }
            val waterGoal = profileResult.getOrNull()?.let { calculateWaterGoalUseCase(it) } ?: 2000
            val quickAddVolume = (containers.firstOrNull { it.isFavorite } ?: containers.firstOrNull())?.volumeMl ?: 250
            val weightResult = weightHistoryDeferred.await()
            val streakResult = streakDeferred?.await() ?: Result.success(0)

            profileResult.onFailure { e -> Napier.e("loadProfile failed", e, tag = TAG) }
            workoutsResult.onFailure { e -> Napier.e("loadWorkouts failed", e, tag = TAG) }
            nutritionResult.onFailure { e -> Napier.e("loadNutrition failed", e, tag = TAG) }
            macroTargetResult.onFailure { e -> Napier.e("loadMacroTarget failed; using calculated fallback", e, tag = TAG) }
            waterLogsResult.onFailure { e -> Napier.e("loadWaterLogs failed", e, tag = TAG) }
            historyResult.onFailure { e -> Napier.e("loadHistory failed", e, tag = TAG) }
            weightResult.onFailure { e -> Napier.e("loadWeightHistory failed", e, tag = TAG) }
            streakResult.onFailure { e -> Napier.e("loadStreak failed", e, tag = TAG) }

            val error = profileResult.exceptionOrNull()?.message
                ?: workoutsResult.exceptionOrNull()?.message
                ?: nutritionResult.exceptionOrNull()?.message

            val workouts = workoutsResult.getOrNull() ?: emptyList()
            val todayWorkout = workouts.firstOrNull { it.dayOfWeek?.index == todayDayOfWeek }
            val workoutHistory = historyResult.getOrDefault(emptyList())

            val weekWorkoutsDone =
                countLogsSinceMonday(workoutHistory, today, TimeZone.currentSystemDefault())
            val (currentWeightKg, weightDeltaKg) =
                computeWeightMetrics(weightResult.getOrDefault(emptyList()), today)

            val streakWeeks = streakResult.getOrDefault(0)
            // First-run: no workout history AND no coach-assigned workouts
            val isFirstRun = canAccessActivity && workoutHistory.isEmpty() && workouts.isEmpty()
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
                    macroTargets = macroTargetResult.getOrNull()
                        ?: loadedUser?.let { u -> calculateMacroTargetsUseCase(u) },
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
            val weightResult = getWeightHistoryUseCase(userId)
            val streakResult = workoutRepository.getCurrentStreak(userId)

            weightResult.onFailure { e -> Napier.e("retryMetrics: loadWeightHistory failed", e, tag = TAG) }
            streakResult.onFailure { e -> Napier.e("retryMetrics: loadStreak failed", e, tag = TAG) }

            val (currentWeightKg, weightDeltaKg) =
                computeWeightMetrics(weightResult.getOrDefault(emptyList()), today)
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

/**
 * Counts workout logs recorded on or after Monday 00:00 of [today]'s week
 * (week starts Monday; kotlinx.datetime DayOfWeek.ordinal 0 = Monday).
 */
internal fun countLogsSinceMonday(
    history: List<WorkoutLog>,
    today: LocalDate,
    zone: TimeZone,
): Int {
    val mondayEpoch = today.toEpochDays() - today.dayOfWeek.ordinal
    return history.count { log ->
        log.loggedAt.toLocalDateTime(zone).date.toEpochDays() >= mondayEpoch
    }
}

/**
 * Weight metrics from history: latest entry = current weight; delta = current minus
 * the earlier entry closest to 30 days before [today] (null when fewer than 2 entries).
 */
private fun computeWeightMetrics(
    entries: List<WeightEntry>,
    today: LocalDate,
): Pair<Float?, Float?> {
    val sorted = entries.sortedByDescending { it.recordedAt }
    val current = sorted.firstOrNull()?.weightKg ?: return null to null
    val thirtyDaysEpoch = today.toEpochDays() - 30
    val delta = if (sorted.size >= 2) {
        sorted.drop(1)
            .minByOrNull { entry -> abs(entry.recordedAt.toEpochDays() - thirtyDaysEpoch) }
            ?.let { current - it.weightKg }
    } else null
    return current to delta
}
