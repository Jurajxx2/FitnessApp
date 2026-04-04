package com.coachfoska.app.domain.usecase.chat

import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.repository.ChatRepository

class SendHumanChatMessageUseCase(private val chatRepository: ChatRepository) {
    suspend operator fun invoke(userId: String, content: MessageContent): Result<ChatMessage> =
        chatRepository.sendMessage(userId, ChatType.Human, content)
}
