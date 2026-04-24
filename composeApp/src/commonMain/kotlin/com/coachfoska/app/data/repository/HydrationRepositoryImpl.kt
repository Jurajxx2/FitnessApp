package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.HydrationRemoteDataSource
import com.coachfoska.app.data.remote.dto.HydrationSettingsDto
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.domain.repository.HydrationRepository

class HydrationRepositoryImpl(
    private val dataSource: HydrationRemoteDataSource
) : HydrationRepository {

    override suspend fun logWater(userId: String, amountMl: Int): Result<WaterLog> =
        runCatching { dataSource.insertWaterLog(userId, amountMl).toDomain() }

    override suspend fun getTodayLogs(userId: String): Result<List<WaterLog>> =
        runCatching { dataSource.getTodayLogs(userId).map { it.toDomain() } }

    override suspend fun deleteLog(userId: String, logId: String): Result<Unit> =
        runCatching { dataSource.deleteLog(logId) }

    override suspend fun getSettings(userId: String): Result<HydrationSettings> =
        runCatching {
            dataSource.getSettings(userId)?.toDomain() ?: HydrationSettings()
        }

    override suspend fun saveSettings(userId: String, settings: HydrationSettings): Result<Unit> =
        runCatching {
            dataSource.upsertSettings(
                HydrationSettingsDto(
                    userId = userId,
                    intervalMinutes = settings.intervalMinutes,
                    startHour = settings.startHour,
                    endHour = settings.endHour,
                    smartSuppress = settings.smartSuppress,
                    remindersEnabled = settings.remindersEnabled
                )
            )
        }
}
