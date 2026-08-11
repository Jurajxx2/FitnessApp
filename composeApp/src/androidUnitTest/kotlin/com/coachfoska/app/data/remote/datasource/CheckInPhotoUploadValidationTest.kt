package com.coachfoska.app.data.remote.datasource

import io.github.jan.supabase.SupabaseClient
import io.ktor.client.HttpClient
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertFailsWith

class CheckInPhotoUploadValidationTest {

    private val dataSource = CheckInRemoteDataSource(
        httpClient = mockk<HttpClient>(),
        supabase = mockk<SupabaseClient>(),
    )

    @Test
    fun invalidSlotIsRejectedBeforeAuthOrNetwork() = runTest {
        assertFailsWith<IllegalArgumentException> {
            dataSource.uploadPhoto("2026-08-10", "profile", jpegBytes())
        }
    }

    @Test
    fun oversizedPhotoIsRejectedBeforeAuthOrNetwork() = runTest {
        assertFailsWith<IllegalArgumentException> {
            dataSource.uploadPhoto("2026-08-10", "front", ByteArray(8 * 1024 * 1024 + 1))
        }
    }

    @Test
    fun unsupportedContentIsRejectedBeforeAuthOrNetwork() = runTest {
        assertFailsWith<IllegalArgumentException> {
            dataSource.uploadPhoto("2026-08-10", "side", "not-an-image".encodeToByteArray())
        }
    }

    private fun jpegBytes() = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0x00)
}
