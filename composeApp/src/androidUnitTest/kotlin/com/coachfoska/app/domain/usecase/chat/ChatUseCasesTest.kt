package com.coachfoska.app.domain.usecase.chat

import app.cash.turbine.test
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.fixtures.aChatMessage
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ChatUseCasesTest {

    private val chatRepository: ChatRepository = mockk()
    private val aiProvider: ChatAiProvider = mockk()

    private val markMessagesReadUseCase = MarkMessagesReadUseCase(chatRepository)
    private val observeChatMessagesUseCase = ObserveChatMessagesUseCase(chatRepository)
    private val sendHumanChatMessageUseCase = SendHumanChatMessageUseCase(chatRepository)
    private val uploadChatImageUseCase = UploadChatImageUseCase(chatRepository)
    private val sendAiChatMessageUseCase = SendAiChatMessageUseCase(chatRepository, aiProvider)

    // --- MarkMessagesReadUseCase ---

    @Test
    fun `markMessagesRead delegates to repository with userId and chatType`() = runTest {
        coEvery { chatRepository.markMessagesRead("user-1", ChatType.Human) } returns Result.success(Unit)

        val result = markMessagesReadUseCase("user-1", ChatType.Human)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { chatRepository.markMessagesRead("user-1", ChatType.Human) }
    }

    @Test
    fun `markMessagesRead propagates repository failure`() = runTest {
        coEvery { chatRepository.markMessagesRead(any(), any()) } returns Result.failure(RuntimeException("DB error"))

        val result = markMessagesReadUseCase("user-1", ChatType.Ai)

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    // --- ObserveChatMessagesUseCase ---

    @Test
    fun `observeChatMessages delegates to repository and emits messages`() = runTest {
        val messages = listOf(aChatMessage())
        every { chatRepository.observeMessages("user-1", ChatType.Human) } returns flowOf(messages)

        observeChatMessagesUseCase("user-1", ChatType.Human).test {
            val emitted = awaitItem()
            assertEquals(1, emitted.size)
            assertEquals("msg-1", emitted[0].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    // --- SendHumanChatMessageUseCase ---

    @Test
    fun `sendHumanChatMessage sends to Human chatType`() = runTest {
        val message = aChatMessage()
        val content = MessageContent.Text("Hello coach")
        coEvery { chatRepository.sendMessage("user-1", ChatType.Human, content) } returns Result.success(message)

        val result = sendHumanChatMessageUseCase("user-1", content)

        assertTrue(result.isSuccess)
        assertEquals(message, result.getOrThrow())
        coVerify(exactly = 1) { chatRepository.sendMessage("user-1", ChatType.Human, content) }
    }

    @Test
    fun `sendHumanChatMessage propagates repository failure`() = runTest {
        val content = MessageContent.Text("Hello")
        coEvery { chatRepository.sendMessage(any(), any(), any()) } returns Result.failure(RuntimeException("Send failed"))

        val result = sendHumanChatMessageUseCase("user-1", content)

        assertTrue(result.isFailure)
        assertEquals("Send failed", result.exceptionOrNull()?.message)
    }

    // --- UploadChatImageUseCase ---

    @Test
    fun `uploadChatImage delegates to repository and returns url`() = runTest {
        val bytes = byteArrayOf(1, 2, 3)
        coEvery { chatRepository.uploadImage("user-1", bytes) } returns Result.success("https://storage/image.jpg")

        val result = uploadChatImageUseCase("user-1", bytes)

        assertTrue(result.isSuccess)
        assertEquals("https://storage/image.jpg", result.getOrThrow())
    }

    @Test
    fun `uploadChatImage propagates repository failure`() = runTest {
        coEvery { chatRepository.uploadImage(any(), any()) } returns Result.failure(RuntimeException("Upload failed"))

        val result = uploadChatImageUseCase("user-1", byteArrayOf())

        assertTrue(result.isFailure)
        assertEquals("Upload failed", result.exceptionOrNull()?.message)
    }

    // --- SendAiChatMessageUseCase ---

    @Test
    fun `sendAiChatMessage streams AI response and persists user message on start`() = runTest {
        val chunks = listOf("Hello", " coach", "!")
        every { aiProvider.streamResponse(any(), any(), any()) } returns flowOf(*chunks.toTypedArray())
        coEvery { chatRepository.sendMessage(any(), any(), any()) } returns Result.success(aChatMessage())

        val collected = mutableListOf<String>()
        sendAiChatMessageUseCase.invoke("user-1", emptyList(), "Hi coach")
            .collect { collected.add(it) }

        assertEquals(chunks, collected)
        coVerify(exactly = 1) {
            chatRepository.sendMessage("user-1", ChatType.Ai, MessageContent.Text("Hi coach"))
        }
    }
}
