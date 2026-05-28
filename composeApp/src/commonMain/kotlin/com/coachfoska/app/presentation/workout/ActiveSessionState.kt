package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.model.SetLog

data class ActiveSessionState(
    val sessionDraft: SessionDraft? = null,
    val currentExerciseIndex: Int = 0,
    val previousData: Map<String, List<SetLog>> = emptyMap(),
    val restTimer: RestTimerState = RestTimerState(),
    val sessionPRs: List<SessionPR> = emptyList(),
    val activePRBanner: SessionPR? = null,
    val sessionStartTime: Long = 0L,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val submittedLogId: String? = null,
    val error: String? = null,
)

data class RestTimerState(
    val isActive: Boolean = false,
    val remainingSeconds: Int = 0,
    val totalSeconds: Int = 0,
)
