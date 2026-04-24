package com.coachfoska.app.presentation.hydration

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "HydrationViewModel"

class HydrationViewModel(
    private val hydrationRepository: HydrationRepository,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val calculateWaterGoalUseCase: CalculateWaterGoalUseCase,
    private val reminderScheduler: WaterReminderScheduler,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(HydrationState())
    val state: StateFlow<HydrationState> = _state.asStateFlow()

    init {
        reminderScheduler.setUserId(userId)
        onIntent(HydrationIntent.LoadData)
    }

    fun onIntent(intent: HydrationIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            HydrationIntent.LoadData -> loadData()
            is HydrationIntent.LogWater -> logWater(intent.amountMl)
            is HydrationIntent.DeleteLog -> deleteLog(intent.logId)
            is HydrationIntent.UpdateSettings -> updateSettings(intent.settings)
            HydrationIntent.ShowCustomAmountDialog -> _state.update { it.copy(showCustomAmountDialog = true) }
            HydrationIntent.DismissCustomAmountDialog -> _state.update { it.copy(showCustomAmountDialog = false) }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            val profileDeferred = async { getUserProfileUseCase(userId) }
            val logsDeferred = async { hydrationRepository.getTodayLogs(userId) }
            val settingsDeferred = async { hydrationRepository.getSettings(userId) }

            val profileResult = profileDeferred.await()
            val logsResult = logsDeferred.await()
            val settingsResult = settingsDeferred.await()

            val profile = profileResult.getOrNull()
            val goalMl = if (profile != null) calculateWaterGoalUseCase(profile) else 2000

            val error = logsResult.exceptionOrNull()?.message
                ?: profileResult.exceptionOrNull()?.message
                ?: settingsResult.exceptionOrNull()?.message

            _state.update {
                it.copy(
                    isLoading = false,
                    todayLogs = logsResult.getOrDefault(emptyList()),
                    goalMl = goalMl,
                    settings = settingsResult.getOrDefault(it.settings),
                    error = error
                )
            }
        }
    }

    private fun logWater(amountMl: Int) {
        viewModelScope.launch {
            hydrationRepository.logWater(userId, amountMl)
                .onSuccess { log ->
                    _state.update { it.copy(todayLogs = listOf(log) + it.todayLogs) }
                }
                .onFailure { e ->
                    Napier.e("logWater failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }

    private fun deleteLog(logId: String) {
        viewModelScope.launch {
            hydrationRepository.deleteLog(userId, logId)
                .onSuccess {
                    _state.update { it.copy(todayLogs = it.todayLogs.filter { log -> log.id != logId }) }
                }
                .onFailure { e ->
                    Napier.e("deleteLog failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }

    private fun updateSettings(settings: HydrationSettings) {
        viewModelScope.launch {
            hydrationRepository.saveSettings(userId, settings)
                .onSuccess {
                    val goalMl = _state.value.goalMl
                    _state.update { it.copy(settings = settings) }
                    if (settings.remindersEnabled) {
                        reminderScheduler.schedule(settings, goalMl)
                    } else {
                        reminderScheduler.cancel()
                    }
                }
                .onFailure { e ->
                    Napier.e("saveSettings failed", e, tag = TAG)
                    _state.update { it.copy(error = e.message) }
                }
        }
    }
}
