package com.coachfoska.app.data.repository

import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.data.remote.datasource.ChatRemoteDataSource
import com.coachfoska.app.data.remote.datasource.ChatStorageDataSource
import com.coachfoska.app.data.remote.dto.ChatMessageInsertDto
import com.coachfoska.app.domain.model.ChatConversationSummary
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.repository.ChatRepository
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow

private const val TAG = "ChatRepositoryImpl"

class ChatRepositoryImpl(
    private val dataSource: ChatRemoteDataSource,
    private val storageDataSource: ChatStorageDataSource,
    @Suppress("UNUSED_PARAMETER") private val aiProvider: ChatAiProvider
) : ChatRepository {

    override fun observeMessages(userId: String, chatType: ChatType): Flow<List<ChatMessage>> =
        channelFlow {
            val messages = mutableListOf<ChatMessage>()

            // Seed with persisted history (newest first from DB → reverse to oldest first for display)
            val initial = runCatching {
                dataSource.fetchMessages(userId, chatType)
            }.getOrElse { e ->
                Napier.e("Failed to fetch initial messages", e, tag = TAG)
                emptyList()
            }
            messages.addAll(initial.map { it.toDomain() }.sortedBy { it.createdAt })
            send(messages.toList())

            // Stream new inserts via Realtime
            dataSource.observeNewMessages(userId, chatType).collect { dto ->
                val msg = dto.toDomain()
                if (messages.none { it.id == msg.id }) {
                    messages.add(msg)
                    messages.sortBy { it.createdAt }
                    send(messages.toList())
                }
            }
        }

    override suspend fun sendMessage(
        userId: String,
        chatType: ChatType,
        content: MessageContent
    ): Result<ChatMessage> = runCatching {
        // For image content, upload to Storage first to get a persisted URL
        val resolvedContent = if (content is MessageContent.Image && content.url.isEmpty()) {
            content // URL already set externally — use as-is
        } else {
            content
        }

        val insertDto = ChatMessageInsertDto(
            userId = userId,
            chatType = chatType.toDbValue(),
            senderType = SenderType.User.toDbValue(),
            contentType = resolvedContent.toContentType(),
            textContent = (resolvedContent as? MessageContent.Text)?.text,
            imageUrl = (resolvedContent as? MessageContent.Image)?.url
        )
        dataSource.insertMessage(insertDto).toDomain()
    }

    override suspend fun uploadImage(userId: String, imageBytes: ByteArray): Result<String> =
        storageDataSource.uploadImage(userId, imageBytes)

    override suspend fun markMessagesRead(userId: String, chatType: ChatType): Result<Unit> =
        runCatching {
            dataSource.markRead(userId, chatType)
        }

    override suspend fun getConversationSummaries(userId: String): Result<List<ChatConversationSummary>> =
        runCatching {
            ChatType.entries.map { chatType ->
                val lastMessage = dataSource.fetchLatestMessage(userId, chatType)?.toDomain()
                val unreadCount = dataSource.countUnread(userId, chatType)
                ChatConversationSummary(
                    chatType = chatType,
                    lastMessage = lastMessage,
                    unreadCount = unreadCount
                )
            }
        }

    private fun ChatType.toDbValue(): String = when (this) {
        ChatType.Human -> "human"
        ChatType.Ai -> "ai"
    }

    private fun SenderType.toDbValue(): String = when (this) {
        SenderType.User -> "user"
        SenderType.Coach -> "coach"
        SenderType.Ai -> "ai"
    }

    private fun MessageContent.toContentType(): String = when (this) {
        is MessageContent.Text -> "text"
        is MessageContent.Image -> "image"
    }
}
