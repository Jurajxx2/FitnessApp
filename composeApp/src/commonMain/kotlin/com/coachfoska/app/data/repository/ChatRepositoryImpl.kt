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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.datetime.Instant

private const val TAG = "ChatRepositoryImpl"

class ChatRepositoryImpl(
    private val dataSource: ChatRemoteDataSource,
    private val storageDataSource: ChatStorageDataSource,
    @Suppress("UNUSED_PARAMETER") private val aiProvider: ChatAiProvider
) : ChatRepository {

    companion object {
        private const val MAX_RETRIES = 3
        private fun retryDelayMs(attempt: Int): Long = 1000L shl (attempt - 1) // 1s, 2s, 4s
    }

    override fun observeMessages(userId: String, chatType: ChatType): Flow<List<ChatMessage>> =
        channelFlow {
            val messages = mutableListOf<ChatMessage>()
            var lastSeenAt: Instant? = null

            suspend fun addAndEmit(msg: ChatMessage) {
                if (messages.none { it.id == msg.id }) {
                    messages.add(msg)
                    messages.sortBy { it.createdAt }
                    lastSeenAt = messages.maxOfOrNull { it.createdAt }
                    send(messages.toList())
                }
            }

            suspend fun fillGap() {
                val since = lastSeenAt ?: return
                val gap = runCatching { dataSource.fetchMessagesSince(userId, chatType, since) }
                    .getOrElse { emptyList() }
                var changed = false
                for (dto in gap) {
                    val msg = dto.toDomain()
                    if (messages.none { it.id == msg.id }) {
                        messages.add(msg)
                        changed = true
                    }
                }
                if (changed) {
                    messages.sortBy { it.createdAt }
                    lastSeenAt = messages.maxOfOrNull { it.createdAt }
                    send(messages.toList())
                }
            }

            // Subscribe FIRST — channel buffers any inserts that arrive during the seed fetch below
            val realtimeJob = launch {
                var attempt = 0
                while (attempt <= MAX_RETRIES) {
                    val error = runCatching {
                        dataSource.observeNewMessages(userId, chatType).collect { dto ->
                            addAndEmit(dto.toDomain())
                        }
                    }.exceptionOrNull()

                    if (error == null) break
                    attempt++
                    if (attempt > MAX_RETRIES) {
                        Napier.e("Realtime gave up after $MAX_RETRIES retries", error, tag = TAG)
                        throw error!!
                    }
                    Napier.w("Realtime disconnected (attempt $attempt), retrying in ${retryDelayMs(attempt)}ms", tag = TAG)
                    delay(retryDelayMs(attempt))
                    fillGap()
                }
            }

            // Seed with persisted history AFTER Realtime is subscribed
            val initial = runCatching { dataSource.fetchMessages(userId, chatType) }
                .getOrElse { e ->
                    Napier.e("Failed to fetch initial messages", e, tag = TAG)
                    emptyList()
                }
            for (dto in initial.sortedBy { it.createdAt }) {
                if (messages.none { it.id == dto.id }) messages.add(dto.toDomain())
            }
            messages.sortBy { it.createdAt }
            lastSeenAt = messages.maxOfOrNull { it.createdAt }
            send(messages.toList())

            realtimeJob.join()
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
