package com.coachfoska.app.domain.usecase.hydration

import com.coachfoska.app.domain.repository.HydrationRepository

class DeleteWaterContainerUseCase(private val repo: HydrationRepository) {
    suspend operator fun invoke(containerId: String): Result<Unit> = repo.deleteContainer(containerId)
}
