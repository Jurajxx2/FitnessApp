package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.domain.repository.HydrationRepository

class AddWaterContainerUseCase(private val repo: HydrationRepository) {
    suspend operator fun invoke(
        userId: String,
        name: String,
        volumeMl: Int,
        iconName: String = "bottle",
    ): Result<WaterContainer> {
        if (name.isBlank()) return Result.failure(IllegalArgumentException("Name required"))
        if (volumeMl <= 0)   return Result.failure(IllegalArgumentException("Volume must be positive"))
        return repo.addContainer(userId, name.trim(), volumeMl, iconName)
    }
}
