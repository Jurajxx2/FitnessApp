package com.coachfoska.app.domain.usecase.chat

import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.repository.ChatRepository

class MarkMessagesReadUseCase(private val chatRepository: ChatRepository) {
    suspend operator fun invoke(userId: String, chatType: ChatType): Result<Unit> =
        chatRepository.markMessagesRead(userId, chatType)
}
