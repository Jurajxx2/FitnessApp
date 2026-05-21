package com.coachfoska.app.presentation.activity

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import kotlinx.datetime.Instant

data class ActivityLogState(
    val history: List<GeneralActivityLog> = emptyList(),
    val isLoading: Boolean = false,
    val isLogging: Boolean = false,
    val success: Boolean = false,
    val error: String? = null,
    
    // Form state
    val selectedType: ActivityType = ActivityType.WALKING,
    val durationMinutesText: String = "",
    val distanceKmText: String = "",
    val rpe: Int? = null,
    val loggedAt: Instant? = null,
    val notes: String = "",
    val canSubmit: Boolean = false
)
