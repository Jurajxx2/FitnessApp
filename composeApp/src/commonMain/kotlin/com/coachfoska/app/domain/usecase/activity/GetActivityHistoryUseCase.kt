package com.coachfoska.app.domain.usecase.activity

import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.repository.ActivityRepository

class GetActivityHistoryUseCase(private val repo: ActivityRepository) {
    suspend operator fun invoke(userId: String): Result<List<GeneralActivityLog>> =
        repo.getActivityHistory(userId)
}
