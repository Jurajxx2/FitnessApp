package com.coachfoska.app.domain.repository

interface DeviceTokenRepository {
    suspend fun upsertToken(userId: String): Result<Unit>
}
