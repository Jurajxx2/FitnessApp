package com.coachfoska.app.domain.usecase.chat

import com.coachfoska.app.domain.repository.ChatRepository

class UploadChatImageUseCase(private val repository: ChatRepository) {
    suspend operator fun invoke(userId: String, imageBytes: ByteArray): Result<String> =
        repository.uploadImage(userId, imageBytes)
}
