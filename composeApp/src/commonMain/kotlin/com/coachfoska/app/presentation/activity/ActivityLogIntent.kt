package com.coachfoska.app.presentation.activity

import com.coachfoska.app.domain.model.ActivityType
import kotlinx.datetime.Instant

sealed interface ActivityLogIntent {
    data object LoadHistory : ActivityLogIntent
    data object Submit : ActivityLogIntent
    data object ResetSuccess : ActivityLogIntent
    data object DismissError : ActivityLogIntent
    
    // Form updates
    data class UpdateType(val type: ActivityType) : ActivityLogIntent
    data class UpdateDuration(val text: String) : ActivityLogIntent
    data class UpdateDistance(val text: String) : ActivityLogIntent
    data class UpdateRpe(val rpe: Int?) : ActivityLogIntent
    data class UpdateLoggedAt(val instant: Instant) : ActivityLogIntent
    data class UpdateNotes(val notes: String) : ActivityLogIntent
}
