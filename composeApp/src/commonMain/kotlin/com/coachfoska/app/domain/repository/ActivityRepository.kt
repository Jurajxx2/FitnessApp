package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import kotlinx.datetime.Instant

interface ActivityRepository {
    suspend fun logActivity(
        userId: String,
        type: ActivityType,
        durationMinutes: Int,
        distanceKm: Double?,
        rpe: Int?,
        loggedAt: Instant,
        notes: String?,
    ): Result<GeneralActivityLog>

    suspend fun getActivityHistory(userId: String): Result<List<GeneralActivityLog>>
}
