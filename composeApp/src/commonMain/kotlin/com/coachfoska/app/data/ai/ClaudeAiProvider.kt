package com.coachfoska.app.data.ai

import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.core.logging.AppLogger as Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.preparePost
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.utils.io.readUTF8Line
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private const val TAG = "ClaudeAiProvider"

/**
 * Streams Claude responses through the `ai-proxy` Supabase Edge Function.
 * The Anthropic API key lives server-side as a function secret; the client
 * authenticates with the user's Supabase access token. Model and token limits
 * are pinned in the edge function.
 */
class ClaudeAiProvider(
    private val httpClient: HttpClient,
    private val supabase: SupabaseClient
) : ChatAiProvider {

    private val proxyUrl = "${BuildKonfig.SUPABASE_URL}/functions/v1/ai-proxy"
    private val json = Json { ignoreUnknownKeys = true }

    override fun streamResponse(
        systemPrompt: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String> = channelFlow {
        val accessToken = supabase.auth.currentAccessTokenOrNull()
            ?: throw IllegalStateException("AI coach requires an authenticated session")

        val messages = history
            .filter { it.content is MessageContent.Text }
            .map { msg ->
                ClaudeMessage(
                    role = if (msg.senderType == SenderType.User) "user" else "assistant",
                    content = (msg.content as MessageContent.Text).text
                )
            } + ClaudeMessage(role = "user", content = userMessage)

        // The interface keeps this parameter for provider portability. The hardened proxy owns its
        // system prompt server-side and must never accept caller-controlled instructions.
        @Suppress("UNUSED_VARIABLE")
        val ignoredSystemPrompt = systemPrompt
        val requestBody = AiProxyRequest(messages = messages)

        val bodyJson = json.encodeToString(AiProxyRequest.serializer(), requestBody)

        httpClient.preparePost(proxyUrl) {
            headers {
                append(HttpHeaders.Authorization, "Bearer $accessToken")
                append("apikey", BuildKonfig.SUPABASE_ANON_KEY)
            }
            contentType(ContentType.Application.Json)
            setBody(bodyJson)
        }.execute { response ->
            if (!response.status.isSuccess()) {
                val error = response.bodyAsText()
                Napier.e("ai-proxy request failed with status ${response.status}", tag = TAG)
                throw IllegalStateException("AI request failed (${response.status})")
            }
            val channel = response.bodyAsChannel()
            while (!channel.isClosedForRead) {
                val line = channel.readUTF8Line() ?: break
                if (!line.startsWith("data: ")) continue
                val data = line.removePrefix("data: ")
                if (data == "[DONE]") break
                try {
                    val jsonObj = json.parseToJsonElement(data).jsonObject
                    val type = jsonObj["type"]?.jsonPrimitive?.content
                    if (type == "content_block_delta") {
                        val text = jsonObj["delta"]?.jsonObject?.get("text")?.jsonPrimitive?.content
                        if (!text.isNullOrEmpty()) send(text)
                    }
                } catch (e: Exception) {
                    Napier.w("Skipping unparseable SSE chunk", tag = TAG)
                }
            }
        }
    }
}

@Serializable
internal data class AiProxyRequest(
    val messages: List<ClaudeMessage>
)

@Serializable
internal data class ClaudeMessage(
    val role: String,
    val content: String
)
