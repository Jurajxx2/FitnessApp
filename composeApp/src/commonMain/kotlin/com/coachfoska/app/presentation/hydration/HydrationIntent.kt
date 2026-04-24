package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings

sealed interface HydrationIntent {
    data object LoadData : HydrationIntent
    data class LogWater(val amountMl: Int) : HydrationIntent
    data class DeleteLog(val logId: String) : HydrationIntent
    data class UpdateSettings(val settings: HydrationSettings) : HydrationIntent
    data object ShowCustomAmountDialog : HydrationIntent
    data object DismissCustomAmountDialog : HydrationIntent
}
