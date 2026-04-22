package com.coachfoska.app.presentation.chat

import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.usecase.chat.MarkMessagesReadUseCase
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.chat.SendAiChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.SendHumanChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.UploadChatImageUseCase
import com.coachfoska.app.fixtures.aChatMessage
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val chatRepo: ChatRepository = mockk()
    private val sendHumanUseCase: SendHumanChatMessageUseCase = mockk()
    private val sendAiUseCase: SendAiChatMessageUseCase = mockk()
    private val markReadUseCase: MarkMessagesReadUseCase = mockk(relaxed = true)
    private val uploadImageUseCase: UploadChatImageUseCase = mockk()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(
        serverMessages: List<com.coachfoska.app.domain.model.ChatMessage> = emptyList()
    ): ChatViewModel {
        coEvery { chatRepo.observeMessages(any(), any()) } returns flowOf(serverMessages)
        return ChatViewModel(
            observeChatMessages = ObserveChatMessagesUseCase(chatRepo),
            sendHumanMessage = sendHumanUseCase,
            sendAiMessage = sendAiUseCase,
            markMessagesRead = markReadUseCase,
            uploadChatImage = uploadImageUseCase,
            currentUserId = "user-1",
            chatType = ChatType.Human
        )
    }

    @Test
    fun `sendText adds optimistic message to state immediately`() = runTest {
        coEvery { sendHumanUseCase(any(), any()) } returns Result.success(aChatMessage())

        val vm = viewModel()
        advanceUntilIdle()

        vm.onIntent(ChatIntent.SendTextMessage("Hello coach"))

        val optimistic = vm.state.value.messages.filter { it.id.startsWith("optimistic-") }
        assertEquals(1, optimistic.size)
        assertEquals(MessageContent.Text("Hello coach"), optimistic[0].content)
        assertEquals(SenderType.User, optimistic[0].senderType)
    }

    @Test
    fun `optimistic message removed on send failure`() = runTest {
        coEvery { sendHumanUseCase(any(), any()) } returns Result.failure(RuntimeException("network error"))

        val vm = viewModel()
        advanceUntilIdle()
        vm.onIntent(ChatIntent.SendTextMessage("Hello"))
        advanceUntilIdle()

        val optimistic = vm.state.value.messages.filter { it.id.startsWith("optimistic-") }
        assertEquals(0, optimistic.size)
        assertEquals("network error", vm.state.value.error)
    }

    @Test
    fun `isSending is true while send is in progress`() = runTest(StandardTestDispatcher()) {
        val latch = CompletableDeferred<Result<com.coachfoska.app.domain.model.ChatMessage>>()
        coEvery { sendHumanUseCase(any(), any()) } coAnswers { latch.await() }

        coEvery { chatRepo.observeMessages(any(), any()) } returns flowOf(emptyList())
        val vm = ChatViewModel(
            observeChatMessages = ObserveChatMessagesUseCase(chatRepo),
            sendHumanMessage = sendHumanUseCase,
            sendAiMessage = sendAiUseCase,
            markMessagesRead = markReadUseCase,
            uploadChatImage = uploadImageUseCase,
            currentUserId = "user-1",
            chatType = ChatType.Human
        )
        advanceUntilIdle()

        vm.onIntent(ChatIntent.SendTextMessage("Hello"))
        advanceUntilIdle() // lets the coroutine reach the suspended sendHumanUseCase call

        assertTrue(vm.state.value.isSending)

        latch.complete(Result.success(aChatMessage()))
        advanceUntilIdle()
        assertFalse(vm.state.value.isSending)
    }

    @Test
    fun `state not loading after messages collected`() = runTest {
        val vm = viewModel(serverMessages = listOf(aChatMessage()))
        advanceUntilIdle()

        assertFalse(vm.state.value.isLoading)
        assertEquals(1, vm.state.value.messages.size)
    }

    @Test
    fun `no error in state on successful load`() = runTest {
        val vm = viewModel(serverMessages = listOf(aChatMessage()))
        advanceUntilIdle()

        assertNull(vm.state.value.error)
    }
}
