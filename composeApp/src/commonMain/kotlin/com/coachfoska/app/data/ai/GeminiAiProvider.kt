package com.coachfoska.app.data.ai

import com.coachfoska.app.domain.model.ChatMessage
import io.ktor.client.HttpClient
import kotlinx.coroutines.flow.Flow

/**
 * Stub implementation of [ChatAiProvider] for Google Gemini.
 * Not yet implemented — swap [ClaudeAiProvider] for this in the DI module to activate.
 */
class GeminiAiProvider(
    @Suppress("UNUSED_PARAMETER") httpClient: HttpClient,
    @Suppress("UNUSED_PARAMETER") apiKey: String
) : ChatAiProvider {

    override fun streamResponse(
        systemPrompt: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String> = throw NotImplementedError(
        "GeminiAiProvider is not yet implemented. Use ClaudeAiProvider."
    )
}
