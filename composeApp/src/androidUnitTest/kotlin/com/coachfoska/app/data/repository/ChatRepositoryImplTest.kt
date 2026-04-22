package com.coachfoska.app.data.repository

import app.cash.turbine.test
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.data.remote.datasource.ChatRemoteDataSource
import com.coachfoska.app.data.remote.datasource.ChatStorageDataSource
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.fixtures.aChatMessageDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.seconds

class ChatRepositoryImplTest {

    private val dataSource: ChatRemoteDataSource = mockk()
    private val storageDataSource: ChatStorageDataSource = mockk()
    private val aiProvider: ChatAiProvider = mockk()

    private fun repo() = ChatRepositoryImpl(dataSource, storageDataSource, aiProvider)

    @Test
    fun `observeMessages emits seeded messages from DB`() = runTest {
        val dto = aChatMessageDto()
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf()

        repo().observeMessages("user-1", ChatType.Human).test {
            val first = awaitItem()
            assertEquals(1, first.size)
            assertEquals("msg-1", first[0].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages deduplicates realtime echo of seeded message`() = runTest {
        val dto = aChatMessageDto(id = "msg-1")
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf(dto)

        repo().observeMessages("user-1", ChatType.Human).test {
            // Only one emission expected: the seed. The realtime echo is deduplicated, so no second emission.
            val first = awaitItem()
            assertEquals(1, first.size)
            assertEquals("msg-1", first[0].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages emits realtime message not present in seed`() = runTest {
        val seed = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")
        val newMsg = aChatMessageDto(id = "msg-2", createdAt = "2026-04-23T10:01:00Z")
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(seed)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf(newMsg)

        repo().observeMessages("user-1", ChatType.Human).test {
            val afterSeed = awaitItem()
            assertEquals(1, afterSeed.size)
            val withRealtime = awaitItem()
            assertEquals(2, withRealtime.size)
            assertEquals("msg-2", withRealtime[1].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages retries on realtime error and fills gap`() = runTest {
        val dto1 = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")
        val dto2 = aChatMessageDto(id = "msg-2", createdAt = "2026-04-23T10:01:00Z")

        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto1)

        var realtimeCallCount = 0
        coEvery { dataSource.observeNewMessages(any(), any()) } answers {
            realtimeCallCount++
            if (realtimeCallCount == 1) flow { throw RuntimeException("disconnected") }
            else flowOf()
        }
        coEvery { dataSource.fetchMessagesSince(any(), any(), any()) } returns listOf(dto2)

        repo().observeMessages("user-1", ChatType.Human).test(timeout = 10.seconds) {
            awaitItem() // initial seed emission
            val afterGap = awaitItem() // gap fill after reconnect
            assertEquals(2, afterGap.size)
            assertEquals("msg-2", afterGap[1].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `fetchMessagesSince is called with lastSeenAt after reconnect`() = runTest {
        val dto1 = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")

        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto1)
        var realtimeCallCount = 0
        coEvery { dataSource.observeNewMessages(any(), any()) } answers {
            realtimeCallCount++
            if (realtimeCallCount == 1) flow { throw RuntimeException("disconnected") }
            else flowOf()
        }
        coEvery { dataSource.fetchMessagesSince(any(), any(), any()) } returns emptyList()

        repo().observeMessages("user-1", ChatType.Human).test(timeout = 10.seconds) {
            awaitItem() // seed
            // Advance virtual time past the retry delay (1000ms for attempt 1) to trigger reconnect + gap fill
            advanceTimeBy(1500L)
            cancelAndIgnoreRemainingEvents()
        }

        coVerify(atLeast = 1) { dataSource.fetchMessagesSince("user-1", ChatType.Human, any()) }
    }
}
