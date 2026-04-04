package com.coachfoska.app.data.ai

import com.coachfoska.app.domain.model.ChatMessage
import kotlinx.coroutines.flow.Flow

/** Abstraction over an AI chat backend. Swap implementations to change providers. */
interface ChatAiProvider {
    /**
     * Streams the AI response as text chunks.
     *
     * @param systemPrompt Instructions that define the AI coach persona.
     * @param history Ordered conversation history (oldest first).
     * @param userMessage The latest user message to respond to.
     * @return A [Flow] emitting incremental text chunks as they arrive.
     */
    fun streamResponse(
        systemPrompt: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String>
}
