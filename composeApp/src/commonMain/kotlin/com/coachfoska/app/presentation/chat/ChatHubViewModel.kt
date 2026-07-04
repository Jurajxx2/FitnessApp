package com.coachfoska.app.presentation.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.repository.ChatRepository
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ChatHubViewModel"

data class ChatHubState(
    val summaries: List<ChatConversationSummary> = emptyList(),
    val isLoading: Boolean = false
)

class ChatHubViewModel(
    private val chatRepository: ChatRepository,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(ChatHubState())
    val state: StateFlow<ChatHubState> = _state.asStateFlow()

    init {
        loadSummaries()
        observeLiveSummaries()
    }

    private fun loadSummaries() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            chatRepository.getConversationSummaries(userId)
                .onSuccess { summaries ->
                    _state.update { it.copy(summaries = summaries, isLoading = false) }
                }
                .onFailure { e ->
                    Napier.e("loadSummaries failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false) }
                }
        }
    }

    private fun observeLiveSummaries() {
        ChatType.entries.forEach { chatType ->
            viewModelScope.launch {
                chatRepository.observeMessages(userId, chatType)
                    .catch { e -> Napier.e("observeLiveSummaries failed for $chatType", e, tag = TAG) }
                    .collect { messages ->
                        val summary = ChatConversationSummary(
                            chatType = chatType,
                            lastMessage = messages.lastOrNull(),
                            unreadCount = messages.count {
                                it.senderType != SenderType.User && it.readAt == null
                            },
                        )
                        _state.update { state ->
                            val updated = (state.summaries.filterNot { it.chatType == chatType } + summary)
                                .sortedBy { it.chatType.ordinal }
                            state.copy(summaries = updated, isLoading = false)
                        }
                    }
            }
        }
    }
}
