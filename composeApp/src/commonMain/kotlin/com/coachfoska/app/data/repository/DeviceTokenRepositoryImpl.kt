package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import io.github.aakira.napier.Napier

private const val TAG = "DeviceTokenRepository"

class DeviceTokenRepositoryImpl(
    private val dataSource: DeviceTokenDataSource,
    private val pushService: PushNotificationService,
    private val platform: String
) : DeviceTokenRepository {

    override suspend fun upsertToken(userId: String): Result<Unit> = runCatching {
        val token = pushService.getToken() ?: run {
            Napier.d("Push token unavailable, skipping upsert", tag = TAG)
            return Result.success(Unit)
        }
        dataSource.upsert(userId, platform, token)
        Napier.d("Device token upserted for $platform", tag = TAG)
    }
}
