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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.coachfoska.app.core.util.currentInstant

private const val TAG = "ChatViewModel"

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

    private var observeJob: Job? = null

    init {
        onIntent(ChatIntent.LoadMessages)
    }

    fun onIntent(intent: ChatIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            ChatIntent.LoadMessages -> loadMessages()
            ChatIntent.LoadMoreMessages -> loadMoreMessages()
            is ChatIntent.SendTextMessage -> sendText(intent.text)
            is ChatIntent.SendImageMessage -> sendImage(intent.imageBytes)
            ChatIntent.MarkAllRead -> markAllRead()
        }
    }

    private fun loadMessages() {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            observeChatMessages(userId, chatType)
                .catch { e ->
                    Napier.e("observeMessages failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
                .collect { messages ->
                    _state.update { it.copy(isLoading = false, messages = messages) }
                    // Mark as read on first load
                    markAllRead()
                }
        }
    }

    private fun loadMoreMessages() {
        // Pagination: future implementation via ChatIntent.LoadMoreMessages
        Napier.d("LoadMoreMessages: not yet implemented", tag = TAG)
    }

    private fun sendText(text: String) {
        if (text.isBlank()) return
        when (chatType) {
            ChatType.Human -> sendHumanText(text)
            ChatType.Ai -> sendAiText(text)
        }
    }

    private fun sendHumanText(text: String) {
        viewModelScope.launch {
            _state.update { it.copy(isSending = true, error = null) }
            sendHumanMessage(userId, MessageContent.Text(text))
                .onFailure { e ->
                    Napier.e("sendHumanMessage failed", e, tag = TAG)
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

            // Stream complete — append the full AI message to the list
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
}
