package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.domain.model.WaterLog

interface HydrationRepository {
    suspend fun logWater(userId: String, amountMl: Int): Result<WaterLog>
    suspend fun getTodayLogs(userId: String): Result<List<WaterLog>>
    suspend fun deleteLog(userId: String, logId: String): Result<Unit>
    suspend fun getSettings(userId: String): Result<HydrationSettings>
    suspend fun saveSettings(userId: String, settings: HydrationSettings): Result<Unit>
    suspend fun getContainers(userId: String): Result<List<WaterContainer>>
    suspend fun addContainer(userId: String, name: String, volumeMl: Int, iconName: String = "bottle"): Result<WaterContainer>
    suspend fun deleteContainer(containerId: String): Result<Unit>
    suspend fun toggleFavoriteContainer(containerId: String, isFavorite: Boolean): Result<WaterContainer>
}
