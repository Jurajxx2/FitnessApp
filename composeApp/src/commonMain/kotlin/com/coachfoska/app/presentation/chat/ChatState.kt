package com.coachfoska.app.presentation.chat

import com.coachfoska.app.domain.model.ChatMessage

data class ChatState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val isAiStreaming: Boolean = false,
    val streamingText: String = "",
    val error: String? = null,
    val hasMorePages: Boolean = false
)
