package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.domain.push.PushNotificationService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DeviceTokenRepositoryImplTest {

    private val dataSource: DeviceTokenDataSource = mockk()
    private val pushService: PushNotificationService = mockk()

    private fun repo(platform: String = "android") =
        DeviceTokenRepositoryImpl(dataSource, pushService, platform)

    @Test
    fun `upsertToken calls dataSource when token available`() = runTest {
        coEvery { pushService.getToken() } returns "fcm-token-123"
        coEvery { dataSource.upsert(any(), any(), any()) } returns Unit

        val result = repo().upsertToken("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.upsert("user-1", "android", "fcm-token-123") }
    }

    @Test
    fun `upsertToken is no-op and succeeds when token is null`() = runTest {
        coEvery { pushService.getToken() } returns null

        val result = repo().upsertToken("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { dataSource.upsert(any(), any(), any()) }
    }

    @Test
    fun `upsertToken returns failure when dataSource throws`() = runTest {
        coEvery { pushService.getToken() } returns "fcm-token-123"
        coEvery { dataSource.upsert(any(), any(), any()) } throws RuntimeException("DB error")

        val result = repo().upsertToken("user-1")

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }
}
