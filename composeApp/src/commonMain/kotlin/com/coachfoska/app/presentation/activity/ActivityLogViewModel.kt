package com.coachfoska.app.presentation.activity

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.usecase.activity.GetActivityHistoryUseCase
import com.coachfoska.app.domain.usecase.activity.LogGeneralActivityUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ActivityLogViewModel(
    private val logUseCase: LogGeneralActivityUseCase,
    private val historyUseCase: GetActivityHistoryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(ActivityLogState())
    val state: StateFlow<ActivityLogState> = _state.asStateFlow()

    init {
        onIntent(ActivityLogIntent.LoadHistory)
    }

    fun onIntent(intent: ActivityLogIntent) {
        when (intent) {
            ActivityLogIntent.LoadHistory -> loadHistory()
            ActivityLogIntent.Submit -> submit()
            ActivityLogIntent.ResetSuccess -> _state.update { it.copy(success = false) }
            ActivityLogIntent.DismissError -> _state.update { it.copy(error = null) }
            is ActivityLogIntent.UpdateType -> updateForm { it.copy(selectedType = intent.type) }
            is ActivityLogIntent.UpdateDuration -> updateForm { it.copy(durationMinutesText = intent.text) }
            is ActivityLogIntent.UpdateDistance -> updateForm { it.copy(distanceKmText = intent.text) }
            is ActivityLogIntent.UpdateRpe -> updateForm { it.copy(rpe = intent.rpe) }
            is ActivityLogIntent.UpdateLoggedAt -> updateForm { it.copy(loggedAt = intent.instant) }
            is ActivityLogIntent.UpdateNotes -> updateForm { it.copy(notes = intent.notes) }
        }
    }

    private fun updateForm(reducer: (ActivityLogState) -> ActivityLogState) {
        _state.update { s ->
            val next = reducer(s)
            val duration = next.durationMinutesText.toIntOrNull()
            val distance = next.distanceKmText.takeIf { it.isNotBlank() }?.toDoubleOrNull()
            val rpe = next.rpe
            
            val durationValid = duration != null && duration in 1..1440
            val distanceValid = next.distanceKmText.isBlank() || distance != null
            val rpeValid = rpe == null || rpe in 1..10
            
            next.copy(canSubmit = durationValid && distanceValid && rpeValid)
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            historyUseCase(userId)
                .onSuccess { history -> _state.update { it.copy(history = history, isLoading = false) } }
                .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
        }
    }

    private fun submit() {
        val s = _state.value
        if (!s.canSubmit) return
        
        val duration = s.durationMinutesText.toIntOrNull() ?: return
        
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true) }
            logUseCase(
                userId = userId,
                type = s.selectedType,
                durationMinutes = duration,
                distanceKm = s.distanceKmText.toDoubleOrNull(),
                rpe = s.rpe,
                loggedAt = s.loggedAt ?: currentInstant(),
                notes = s.notes.takeIf { it.isNotBlank() }
            ).onSuccess {
                _state.update { it.copy(
                    isLogging = false, success = true, canSubmit = false,
                    durationMinutesText = "", distanceKmText = "", rpe = null, notes = ""
                ) }
                loadHistory()
            }.onFailure { e ->
                _state.update { it.copy(isLogging = false, error = e.message) }
            }
        }
    }
}
