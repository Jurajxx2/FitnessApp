package com.coachfoska.app.presentation.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.usecase.chat.MarkMessagesReadUseCase
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.chat.SendAiChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.SendHumanChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.UploadChatImageUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.coachfoska.app.core.util.currentInstant
import kotlin.math.abs

private const val TAG = "ChatViewModel"
private const val OPTIMISTIC_MATCH_WINDOW_SECONDS = 5L

class ChatViewModel(
    private val observeChatMessages: ObserveChatMessagesUseCase,
    private val sendHumanMessage: SendHumanChatMessageUseCase,
    private val sendAiMessage: SendAiChatMessageUseCase,
    private val markMessagesRead: MarkMessagesReadUseCase,
    private val uploadChatImage: UploadChatImageUseCase,
    private val userId: String,
    private val chatType: ChatType
) : ViewModel() {

    private val _state = MutableStateFlow(ChatState())
    val state: StateFlow<ChatState> = _state.asStateFlow()

    // Server-confirmed messages from the repository flow
    private val _serverMessages = MutableStateFlow<List<ChatMessage>>(emptyList())

    // Locally added optimistic messages awaiting server confirmation
    private val _optimistic = MutableStateFlow<List<ChatMessage>>(emptyList())

    private var observeJob: Job? = null

    init {
        startObserving()
    }

    fun onIntent(intent: ChatIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            ChatIntent.LoadMessages -> {
                observeJob?.cancel()
                startObserving()
            }
            ChatIntent.LoadMoreMessages -> Napier.d("LoadMoreMessages: not yet implemented", tag = TAG)
            is ChatIntent.SendTextMessage -> sendText(intent.text)
            is ChatIntent.SendImageMessage -> sendImage(intent.imageBytes)
            ChatIntent.MarkAllRead -> markAllRead()
        }
    }

    private fun startObserving() {
        observeJob = viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            // Merge server + optimistic into displayed messages
            launch {
                combine(_serverMessages, _optimistic) { server, optimistic ->
                    val confirmed = optimistic.filter { opt -> server.any { srv -> srv.isConfirmedFor(opt) } }
                    if (confirmed.isNotEmpty()) {
                        _optimistic.update { current -> current - confirmed.toSet() }
                    }
                    (server + _optimistic.value).sortedBy { it.createdAt }
                }.collect { combined ->
                    _state.update { it.copy(messages = combined) }
                }
            }

            observeChatMessages(userId, chatType)
                .catch { e ->
                    Napier.e("observeMessages failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
                .collect { messages ->
                    _serverMessages.value = messages
                    _state.update { it.copy(isLoading = false) }
                    markAllRead()
                }
        }
    }

    private fun sendText(text: String) {
        if (text.isBlank()) return
        when (chatType) {
            ChatType.Human -> sendHumanText(text)
            ChatType.Ai -> sendAiText(text)
        }
    }

    private fun sendHumanText(text: String) {
        val optimistic = ChatMessage(
            id = "optimistic-${currentInstant().toEpochMilliseconds()}",
            userId = userId,
            chatType = ChatType.Human,
            senderType = SenderType.User,
            content = MessageContent.Text(text),
            createdAt = currentInstant()
        )
        _optimistic.update { it + optimistic }

        viewModelScope.launch {
            _state.update { it.copy(isSending = true, error = null) }
            sendHumanMessage(userId, MessageContent.Text(text))
                .onFailure { e ->
                    Napier.e("sendHumanMessage failed", e, tag = TAG)
                    _optimistic.update { list -> list.filter { it.id != optimistic.id } }
                    _state.update { it.copy(isSending = false, error = e.message) }
                }
                .onSuccess {
                    _state.update { it.copy(isSending = false) }
                }
        }
    }

    private fun sendAiText(text: String) {
        viewModelScope.launch {
            _state.update { it.copy(isAiStreaming = true, streamingText = "", error = null) }
            val history = _state.value.messages
            val accumulatedText = StringBuilder()

            sendAiMessage(userId, history, text)
                .catch { e ->
                    Napier.e("sendAiMessage stream failed", e, tag = TAG)
                    _state.update { it.copy(isAiStreaming = false, streamingText = "", error = e.message) }
                }
                .collect { chunk ->
                    accumulatedText.append(chunk)
                    _state.update { it.copy(streamingText = accumulatedText.toString()) }
                }

            val fullText = accumulatedText.toString()
            if (fullText.isNotEmpty()) {
                val aiMessage = ChatMessage(
                    id = "ai-${currentInstant().toEpochMilliseconds()}",
                    userId = userId,
                    chatType = ChatType.Ai,
                    senderType = SenderType.Ai,
                    content = MessageContent.Text(fullText),
                    createdAt = currentInstant()
                )
                _state.update { state ->
                    state.copy(
                        isAiStreaming = false,
                        streamingText = "",
                        messages = state.messages + aiMessage
                    )
                }
            } else {
                _state.update { it.copy(isAiStreaming = false, streamingText = "") }
            }
        }
    }

    private fun sendImage(imageBytes: ByteArray) {
        viewModelScope.launch {
            _state.update { it.copy(isSending = true, error = null) }
            val url = uploadChatImage(userId, imageBytes).getOrElse { e ->
                Napier.e("uploadChatImage failed", e, tag = TAG)
                _state.update { it.copy(isSending = false, error = e.message) }
                return@launch
            }
            sendHumanMessage(userId, MessageContent.Image(url = url, thumbnailUrl = null))
                .onFailure { e ->
                    Napier.e("sendImageMessage failed", e, tag = TAG)
                    _state.update { it.copy(isSending = false, error = e.message) }
                }
                .onSuccess {
                    _state.update { it.copy(isSending = false) }
                }
        }
    }

    private fun markAllRead() {
        viewModelScope.launch {
            markMessagesRead(userId, chatType)
                .onFailure { e -> Napier.e("markMessagesRead failed", e, tag = TAG) }
        }
    }

    // A server message confirms an optimistic one if it's the same user text within a 5s window
    private fun ChatMessage.isConfirmedFor(optimistic: ChatMessage): Boolean {
        if (senderType != SenderType.User) return false
        val thisContent = content
        val optContent = optimistic.content
        if (thisContent !is MessageContent.Text || optContent !is MessageContent.Text) return false
        if (thisContent.text != optContent.text) return false
        if (userId != optimistic.userId) return false
        return abs((createdAt - optimistic.createdAt).inWholeSeconds) <= OPTIMISTIC_MATCH_WINDOW_SECONDS
    }
}
