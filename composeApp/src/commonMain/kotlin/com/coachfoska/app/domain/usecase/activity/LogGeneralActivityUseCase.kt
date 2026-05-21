package com.coachfoska.app.domain.usecase.activity

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.repository.ActivityRepository
import kotlinx.datetime.Instant

class LogGeneralActivityUseCase(private val repo: ActivityRepository) {
    suspend operator fun invoke(
        userId: String,
        type: ActivityType,
        durationMinutes: Int,
        distanceKm: Double?,
        rpe: Int?,
        loggedAt: Instant,
        notes: String?,
    ): Result<GeneralActivityLog> =
        repo.logActivity(userId, type, durationMinutes, distanceKm, rpe, loggedAt, notes)
}
