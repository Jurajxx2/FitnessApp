package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.usecase.workout.GetProgressDashboardUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutsPerWeekUseCase
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ProgressDashboardVM"

class ProgressDashboardViewModel(
    private val getProgressDashboardUseCase: GetProgressDashboardUseCase,
    private val getWorkoutsPerWeekUseCase: GetWorkoutsPerWeekUseCase,
    private val userId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ProgressDashboardState())
    val state: StateFlow<ProgressDashboardState> = _state.asStateFlow()

    init {
        loadDashboard()
        loadWorkoutsPerWeek()
    }

    fun onTimePeriodSelected(period: TimePeriod) {
        _state.update { it.copy(selectedTimePeriod = period) }
        loadWorkoutsPerWeek()
    }

    private fun loadDashboard() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getProgressDashboardUseCase(userId).onSuccess { data ->
                _state.update {
                    it.copy(
                        isLoading = false,
                        weeklyCompletions = data.weeklyCompletions,
                        completedWorkoutsThisWeek = data.completedWorkoutsThisWeek,
                        plannedWorkoutsThisWeek = data.plannedWorkoutsThisWeek,
                        totalVolumeThisWeek = data.totalVolumeThisWeek,
                        currentStreak = data.currentStreak,
                        muscleDistribution = data.muscleDistribution,
                        recentPRs = data.recentPRs,
                    )
                }
            }.onFailure { e ->
                Napier.e("loadDashboard failed", e, tag = TAG)
                _state.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    private fun loadWorkoutsPerWeek() {
        viewModelScope.launch {
            getWorkoutsPerWeekUseCase(userId, _state.value.selectedTimePeriod)
                .onSuccess { counts ->
                    _state.update { it.copy(workoutsPerWeek = counts) }
                }
                .onFailure { e ->
                    Napier.e("loadWorkoutsPerWeek failed", e, tag = TAG)
                }
        }
    }
}
