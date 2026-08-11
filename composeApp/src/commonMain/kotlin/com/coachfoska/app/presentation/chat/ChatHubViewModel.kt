package com.coachfoska.app.presentation.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.core.debug.DebugCoachSubscriptionRepository
import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.core.logging.AppLogger as Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "ChatHubViewModel"

data class ChatHubState(
    val summaries: List<ChatConversationSummary> = emptyList(),
    val isLoading: Boolean = false,
    val isCoachSubscribed: Boolean = true
)

class ChatHubViewModel(
    private val chatRepository: ChatRepository,
    private val debugCoachSubscriptionRepository: DebugCoachSubscriptionRepository,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(ChatHubState())
    val state: StateFlow<ChatHubState> = _state.asStateFlow()

    private var summaryJobs: List<Job> = emptyList()

    init {
        observeCoachSubscription()
    }

    override fun onCleared() {
        stopLiveSummaries()
        super.onCleared()
    }

    private fun observeCoachSubscription() {
        viewModelScope.launch {
            debugCoachSubscriptionRepository.isCoachSubscribed.collect { subscribed ->
                _state.update {
                    it.copy(
                        isCoachSubscribed = subscribed,
                        summaries = if (subscribed) it.summaries else emptyList(),
                        isLoading = if (subscribed) it.isLoading else false
                    )
                }
                if (subscribed) {
                    loadSummaries()
                    observeLiveSummaries()
                } else {
                    stopLiveSummaries()
                }
            }
        }
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
        if (summaryJobs.isNotEmpty()) return
        summaryJobs = ChatType.entries.map { chatType ->
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

    private fun stopLiveSummaries() {
        summaryJobs.forEach { it.cancel() }
        summaryJobs = emptyList()
    }
}
