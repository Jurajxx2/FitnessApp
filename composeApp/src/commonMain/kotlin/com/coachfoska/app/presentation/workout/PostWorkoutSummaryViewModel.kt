package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.formatWeightKg
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

private const val TAG = "PostWorkoutSummaryVM"

data class PostWorkoutSummaryState(
    val workoutName: String = "",
    val dateDisplay: String = "",
    val durationMinutes: Int = 0,
    val totalVolumeKg: Float = 0f,
    val setsCompleted: Int = 0,
    val setsTotal: Int = 0,
    val exerciseCount: Int = 0,
    val personalRecords: List<SessionPR> = emptyList(),
    val isLoading: Boolean = false,
)

class PostWorkoutSummaryViewModel(
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val userId: String,
    private val logId: String,
    sessionPRs: List<SessionPR> = emptyList(),
) : ViewModel() {

    private val _state = MutableStateFlow(PostWorkoutSummaryState(personalRecords = sessionPRs))
    val state: StateFlow<PostWorkoutSummaryState> = _state.asStateFlow()

    init {
        loadSummary()
    }

    private fun loadSummary() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutHistoryUseCase(userId).onSuccess { history ->
                val log = history.find { it.id == logId }
                if (log != null) {
                    val tz = TimeZone.currentSystemDefault()
                    val localDate = log.loggedAt.toLocalDateTime(tz).date

                    val totalVolume = log.exerciseLogs.sumOf { ex ->
                        ex.sets.filter { it.completed }.sumOf { s ->
                            ((s.actualWeightKg ?: 0f) * (s.actualReps ?: 0)).toDouble()
                        }
                    }.toFloat()

                    val setsCompleted = log.exerciseLogs.sumOf { it.setsCompletedCount }
                    val setsTotal = log.exerciseLogs.sumOf { it.sets.size }

                    _state.update {
                        it.copy(
                            isLoading = false,
                            workoutName = log.workoutName,
                            dateDisplay = "${localDate.month.name.lowercase().replaceFirstChar { c -> c.uppercase() }} ${localDate.dayOfMonth}, ${localDate.year}",
                            durationMinutes = log.durationMinutes,
                            totalVolumeKg = totalVolume,
                            setsCompleted = setsCompleted,
                            setsTotal = setsTotal,
                            exerciseCount = log.exerciseLogs.size,
                        )
                    }
                } else {
                    _state.update { it.copy(isLoading = false) }
                }
            }.onFailure { e ->
                Napier.e("loadSummary failed", e, tag = TAG)
                _state.update { it.copy(isLoading = false) }
            }
        }
    }
}
