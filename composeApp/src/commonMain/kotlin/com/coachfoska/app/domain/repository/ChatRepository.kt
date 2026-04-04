package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import kotlinx.coroutines.flow.Flow

interface ChatRepository {
    /** Observe paginated message history, updated in real time when new messages arrive. */
    fun observeMessages(userId: String, chatType: ChatType): Flow<List<ChatMessage>>

    /** Send a message. For Human chat, persists immediately. For Ai chat, persists the user message. */
    suspend fun sendMessage(
        userId: String,
        chatType: ChatType,
        content: MessageContent
    ): Result<ChatMessage>

    /** Mark all unread messages in a conversation as read. */
    suspend fun markMessagesRead(userId: String, chatType: ChatType): Result<Unit>

    /** Returns a summary (last message + unread count) for each conversation type. */
    suspend fun getConversationSummaries(userId: String): Result<List<ChatConversationSummary>>

    /** Uploads image bytes to storage and returns the public URL. */
    suspend fun uploadImage(userId: String, imageBytes: ByteArray): Result<String>
}
