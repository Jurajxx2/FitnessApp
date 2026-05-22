package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings

sealed interface HydrationIntent {
    data object LoadData : HydrationIntent
    data class LogWater(val amountMl: Int) : HydrationIntent
    data class DeleteLog(val logId: String) : HydrationIntent
    data class UpdateSettings(val settings: HydrationSettings) : HydrationIntent
    data object ShowCustomAmountDialog : HydrationIntent
    data object DismissCustomAmountDialog : HydrationIntent

    // Containers
    data class LogFromContainer(val containerId: String) : HydrationIntent
    data class AddContainer(val name: String, val volumeMl: Int) : HydrationIntent
    data class DeleteContainer(val containerId: String) : HydrationIntent
    data class ToggleFavoriteContainer(val containerId: String, val isFavorite: Boolean) : HydrationIntent
    data object ShowManageContainersSheet : HydrationIntent
    data object DismissManageContainersSheet : HydrationIntent
}
