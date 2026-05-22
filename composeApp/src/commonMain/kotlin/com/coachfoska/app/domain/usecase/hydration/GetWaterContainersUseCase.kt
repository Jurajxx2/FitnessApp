package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.domain.repository.HydrationRepository

class GetWaterContainersUseCase(private val repo: HydrationRepository) {
    suspend operator fun invoke(userId: String): Result<List<WaterContainer>> = repo.getContainers(userId)
}
