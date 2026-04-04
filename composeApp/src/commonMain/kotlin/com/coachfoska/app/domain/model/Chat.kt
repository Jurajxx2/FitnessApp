package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

enum class ChatType {
    Human,
    Ai
}

enum class SenderType {
    User,
    Coach,
    Ai
}

sealed class MessageContent {
    data class Text(val text: String) : MessageContent()
    data class Image(val url: String, val thumbnailUrl: String? = null) : MessageContent()
}

data class ChatMessage(
    val id: String,
    val userId: String,
    val chatType: ChatType,
    val senderType: SenderType,
    val content: MessageContent,
    val createdAt: Instant,
    val readAt: Instant? = null
)

data class ChatConversationSummary(
    val chatType: ChatType,
    val lastMessage: ChatMessage? = null,
    val unreadCount: Int = 0
)
