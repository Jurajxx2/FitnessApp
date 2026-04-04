package com.coachfoska.app.domain.usecase.chat

import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.repository.ChatRepository
import kotlinx.coroutines.flow.Flow

class ObserveChatMessagesUseCase(private val chatRepository: ChatRepository) {
    operator fun invoke(userId: String, chatType: ChatType): Flow<List<ChatMessage>> =
        chatRepository.observeMessages(userId, chatType)
}
