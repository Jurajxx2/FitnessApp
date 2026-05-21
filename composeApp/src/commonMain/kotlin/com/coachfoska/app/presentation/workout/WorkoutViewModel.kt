package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.activity.GetActivityHistoryUseCase
import com.coachfoska.app.domain.usecase.activity.LogGeneralActivityUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.core.util.currentInstant
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "WorkoutViewModel"

class WorkoutViewModel(
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val logGeneralActivityUseCase: LogGeneralActivityUseCase,
    private val getActivityHistoryUseCase: GetActivityHistoryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutState())
    val state: StateFlow<WorkoutState> = _state.asStateFlow()

    init {
        onIntent(WorkoutIntent.LoadWorkouts)
    }

    fun onIntent(intent: WorkoutIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            WorkoutIntent.LoadWorkouts -> loadWorkouts()
            is WorkoutIntent.SelectWorkout -> selectWorkout(intent.workoutId)
            WorkoutIntent.LoadHistory -> loadHistory()
            is WorkoutIntent.LogWorkout -> logWorkout(intent)
            WorkoutIntent.LoadActivityHistory -> loadActivityHistory()
            is WorkoutIntent.LogGeneralActivity -> logGeneralActivity(intent)
            WorkoutIntent.DismissError -> _state.update { it.copy(error = null) }
            WorkoutIntent.WorkoutLogged -> _state.update { it.copy(workoutLoggedSuccess = false) }
            is WorkoutIntent.SelectWorkoutLog -> selectWorkoutLog(intent.logId)
            is WorkoutIntent.AttachVideoToLog -> { /* TODO */ }
        }
    }

    private fun loadWorkouts() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getAssignedWorkoutsUseCase(userId)
                .onSuccess { workouts -> _state.update { it.copy(workouts = workouts, isLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
        }
    }

    private fun selectWorkout(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId)
                .onSuccess { workout -> _state.update { it.copy(selectedWorkout = workout, isLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
        }
    }

    private fun logWorkout(intent: WorkoutIntent.LogWorkout) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true) }
            logWorkoutUseCase(
                userId, intent.workoutId, intent.workoutName,
                intent.durationMinutes, intent.notes, intent.exerciseLogs
            ).onSuccess {
                _state.update { it.copy(isLogging = false, workoutLoggedSuccess = true) }
                loadHistory()
            }.onFailure { e ->
                _state.update { it.copy(isLogging = false, error = e.message) }
            }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true) }
            getWorkoutHistoryUseCase(userId)
                .onSuccess { history -> _state.update { it.copy(workoutHistory = history, isHistoryLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isHistoryLoading = false) } }
        }
    }

    private fun loadActivityHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true) }
            getActivityHistoryUseCase(userId)
                .onSuccess { history -> _state.update { it.copy(activityHistory = history, isHistoryLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isHistoryLoading = false) } }
        }
    }

    private fun logGeneralActivity(intent: WorkoutIntent.LogGeneralActivity) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true) }
            logGeneralActivityUseCase(
                userId = userId,
                type = intent.type,
                durationMinutes = intent.durationMinutes,
                distanceKm = intent.distanceKm,
                rpe = intent.rpe,
                loggedAt = currentInstant(),
                notes = intent.notes
            ).onSuccess {
                _state.update { it.copy(isLogging = false, workoutLoggedSuccess = true) }
                loadActivityHistory()
            }.onFailure { e ->
                _state.update { it.copy(isLogging = false, error = e.message) }
            }
        }
    }

    private fun selectWorkoutLog(logId: String) {
        val log = _state.value.workoutHistory.find { it.id == logId }
        _state.update { it.copy(selectedWorkoutLog = log) }
    }
}
