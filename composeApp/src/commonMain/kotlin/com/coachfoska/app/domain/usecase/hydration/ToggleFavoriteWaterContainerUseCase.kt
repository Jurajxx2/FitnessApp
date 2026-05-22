package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.domain.repository.HydrationRepository

class ToggleFavoriteWaterContainerUseCase(private val repo: HydrationRepository) {
    suspend operator fun invoke(containerId: String, isFavorite: Boolean): Result<WaterContainer> =
        repo.toggleFavoriteContainer(containerId, isFavorite)
}
