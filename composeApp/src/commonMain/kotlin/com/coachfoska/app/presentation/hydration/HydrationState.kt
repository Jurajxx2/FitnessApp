package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog

data class HydrationState(
    val isLoading: Boolean = false,
    val todayLogs: List<WaterLog> = emptyList(),
    val goalMl: Int = 2000,
    val settings: HydrationSettings = HydrationSettings(),
    val error: String? = null,
    val showCustomAmountDialog: Boolean = false
) {
    val consumedMl: Int get() = todayLogs.sumOf { it.amountMl }
    val progressFraction: Float get() = if (goalMl > 0) (consumedMl.toFloat() / goalMl).coerceIn(0f, 1f) else 0f
}
