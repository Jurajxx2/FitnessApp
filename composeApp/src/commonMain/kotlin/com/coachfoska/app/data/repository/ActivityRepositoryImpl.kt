package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.ActivityRemoteDataSource
import com.coachfoska.app.data.remote.dto.GeneralActivityLogInsertDto
import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.repository.ActivityRepository
import kotlinx.datetime.Instant

class ActivityRepositoryImpl(
    private val dataSource: ActivityRemoteDataSource,
) : ActivityRepository {

    override suspend fun logActivity(
        userId: String,
        type: ActivityType,
        durationMinutes: Int,
        distanceKm: Double?,
        rpe: Int?,
        loggedAt: Instant,
        notes: String?,
    ): Result<GeneralActivityLog> = runCatching {
        val payload = GeneralActivityLogInsertDto(
            userId = userId,
            activityType = type.name,
            durationMinutes = durationMinutes,
            distanceKm = distanceKm,
            rpe = rpe,
            loggedAt = loggedAt.toString(),
            notes = notes,
        )
        dataSource.insertActivity(payload).toDomain()
    }

    override suspend fun getActivityHistory(userId: String): Result<List<GeneralActivityLog>> =
        runCatching { dataSource.getHistory(userId).map { it.toDomain() } }
}
