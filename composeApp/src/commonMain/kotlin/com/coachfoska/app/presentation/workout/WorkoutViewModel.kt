package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class WorkoutViewModel(
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutState())
    val state: StateFlow<WorkoutState> = _state.asStateFlow()

    init {
        onIntent(WorkoutIntent.LoadWorkouts)
    }

    fun onIntent(intent: WorkoutIntent) {
        when (intent) {
            WorkoutIntent.LoadWorkouts -> loadWorkouts()
            is WorkoutIntent.SelectWorkout -> selectWorkout(intent.workoutId)
            WorkoutIntent.LoadHistory -> loadHistory()
            is WorkoutIntent.LogWorkout -> logWorkout(intent)
            WorkoutIntent.DismissError -> _state.update { it.copy(error = null) }
            WorkoutIntent.WorkoutLogged -> _state.update { it.copy(workoutLoggedSuccess = false) }
        }
    }

    private fun loadWorkouts() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getAssignedWorkoutsUseCase(userId)
                .onSuccess { workouts -> _state.update { it.copy(isLoading = false, workouts = workouts) } }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message) } }
        }
    }

    private fun selectWorkout(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId)
                .onSuccess { workout -> _state.update { it.copy(isLoading = false, selectedWorkout = workout) } }
                .onFailure { e -> _state.update { it.copy(isLoading = false, error = e.message) } }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true) }
            getWorkoutHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, workoutHistory = logs) } }
                .onFailure { e -> _state.update { it.copy(isHistoryLoading = false, error = e.message) } }
        }
    }

    private fun logWorkout(intent: WorkoutIntent.LogWorkout) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true, error = null) }
            logWorkoutUseCase(
                userId, intent.workoutId, intent.workoutName,
                intent.durationMinutes, intent.notes, intent.exerciseLogs
            )
                .onSuccess { _state.update { it.copy(isLogging = false, workoutLoggedSuccess = true) } }
                .onFailure { e -> _state.update { it.copy(isLogging = false, error = e.message) } }
        }
    }
}
