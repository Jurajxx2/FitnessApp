package com.coachfoska.app.presentation.chat

import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.repository.ChatRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ChatHubViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val chatRepository: ChatRepository = mockk()

    private fun viewModel() = ChatHubViewModel(chatRepository, "user-1")

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init loads summaries on creation`() = runTest {
        val summaries = listOf(ChatConversationSummary(chatType = ChatType.Human, unreadCount = 2))
        coEvery { chatRepository.getConversationSummaries("user-1") } returns Result.success(summaries)

        val vm = viewModel()

        assertEquals(1, vm.state.value.summaries.size)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `init shows empty summaries on repository failure`() = runTest {
        coEvery { chatRepository.getConversationSummaries(any()) } returns Result.failure(RuntimeException("Server error"))

        val vm = viewModel()

        assertTrue(vm.state.value.summaries.isEmpty())
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `summaries preserve unread counts and chatType from repository`() = runTest {
        val summaries = listOf(
            ChatConversationSummary(chatType = ChatType.Human, unreadCount = 3),
            ChatConversationSummary(chatType = ChatType.Ai, unreadCount = 0)
        )
        coEvery { chatRepository.getConversationSummaries("user-1") } returns Result.success(summaries)

        val vm = viewModel()

        assertEquals(2, vm.state.value.summaries.size)
        assertEquals(3, vm.state.value.summaries[0].unreadCount)
        assertEquals(ChatType.Human, vm.state.value.summaries[0].chatType)
        assertEquals(ChatType.Ai, vm.state.value.summaries[1].chatType)
    }

    @Test
    fun `empty summaries list is valid success state`() = runTest {
        coEvery { chatRepository.getConversationSummaries(any()) } returns Result.success(emptyList())

        val vm = viewModel()

        assertTrue(vm.state.value.summaries.isEmpty())
        assertFalse(vm.state.value.isLoading)
    }
}
