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
    val sessionDiscarded: Boolean = false,
    val sessionSaveDegraded: Boolean = false,
    val error: String? = null,
    /** (oldName, newName) — set after a session-scope substitution; consumed by UI for snackbar. */
    val lastSubstitution: Pair<String, String>? = null,
)

data class RestTimerState(
    val isActive: Boolean = false,
    val remainingSeconds: Int = 0,
    val totalSeconds: Int = 0,
    /** The completed set whose rest period is being tracked. */
    val exerciseIndex: Int? = null,
    val setIndex: Int? = null,
    /** Wall-clock start used to catch up correctly after the app has been backgrounded. */
    val startedAtEpochMillis: Long = 0L,
)
