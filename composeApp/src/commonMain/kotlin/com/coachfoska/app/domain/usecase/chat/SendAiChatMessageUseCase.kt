package com.coachfoska.app.domain.usecase.chat

import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.repository.ChatRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.onStart

class SendAiChatMessageUseCase(
    private val chatRepository: ChatRepository,
    private val aiProvider: ChatAiProvider
) {
    /**
     * Persists the user message, then streams the AI response as text chunks.
     * The caller is responsible for assembling and persisting the complete AI reply.
     */
    operator fun invoke(
        userId: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String> = aiProvider
        .streamResponse(
            systemPrompt = BuildKonfig.AI_COACH_SYSTEM_PROMPT,
            history = history,
            userMessage = userMessage
        )
        .onStart {
            // Persist the user's message before streaming begins
            chatRepository.sendMessage(
                userId = userId,
                chatType = ChatType.Ai,
                content = MessageContent.Text(userMessage)
            )
        }
}
