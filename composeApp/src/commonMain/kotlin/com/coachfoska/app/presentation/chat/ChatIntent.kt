package com.coachfoska.app.presentation.chat

sealed interface ChatIntent {
    data object LoadMessages : ChatIntent
    data object LoadMoreMessages : ChatIntent
    data class SendTextMessage(val text: String) : ChatIntent
    data class SendImageMessage(val imageBytes: ByteArray) : ChatIntent
    data object MarkAllRead : ChatIntent
}
