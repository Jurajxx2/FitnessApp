package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import kotlinx.datetime.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ChatMessageDto(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("chat_type") val chatType: String,
    @SerialName("sender_type") val senderType: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("text_content") val textContent: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("read_at") val readAt: String? = null
) {
    fun toDomain(): ChatMessage = ChatMessage(
        id = id,
        userId = userId,
        chatType = when (chatType) {
            "human" -> ChatType.Human
            else -> ChatType.Ai
        },
        senderType = when (senderType) {
            "user" -> SenderType.User
            "coach" -> SenderType.Coach
            else -> SenderType.Ai
        },
        content = when (contentType) {
            "image" -> MessageContent.Image(url = imageUrl ?: "", thumbnailUrl = null)
            else -> MessageContent.Text(text = textContent ?: "")
        },
        createdAt = Instant.parse(createdAt),
        readAt = readAt?.let { Instant.parse(it) }
    )
}

@Serializable
data class ChatMessageInsertDto(
    @SerialName("user_id") val userId: String,
    @SerialName("chat_type") val chatType: String,
    @SerialName("sender_type") val senderType: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("text_content") val textContent: String? = null,
    @SerialName("image_url") val imageUrl: String? = null
)
