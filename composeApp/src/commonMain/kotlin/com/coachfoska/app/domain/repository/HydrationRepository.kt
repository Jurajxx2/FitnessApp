package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog

interface HydrationRepository {
    suspend fun logWater(userId: String, amountMl: Int): Result<WaterLog>
    suspend fun getTodayLogs(userId: String): Result<List<WaterLog>>
    suspend fun deleteLog(userId: String, logId: String): Result<Unit>
    suspend fun getSettings(userId: String): Result<HydrationSettings>
    suspend fun saveSettings(userId: String, settings: HydrationSettings): Result<Unit>
}
