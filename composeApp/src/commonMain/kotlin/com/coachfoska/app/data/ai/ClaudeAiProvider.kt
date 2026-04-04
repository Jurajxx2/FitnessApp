package com.coachfoska.app.data.ai

import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import io.github.aakira.napier.Napier
import io.ktor.client.HttpClient
import io.ktor.client.request.headers
import io.ktor.client.request.preparePost
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.utils.io.readUTF8Line
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private const val TAG = "ClaudeAiProvider"
private const val API_URL = "https://api.anthropic.com/v1/messages"
private const val MODEL = "claude-sonnet-4-6"
private const val MAX_TOKENS = 1024
private const val ANTHROPIC_VERSION = "2023-06-01"

class ClaudeAiProvider(
    private val httpClient: HttpClient,
    private val apiKey: String
) : ChatAiProvider {

    private val json = Json { ignoreUnknownKeys = true }

    override fun streamResponse(
        systemPrompt: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String> = channelFlow {
        val messages = history
            .filter { it.content is MessageContent.Text }
            .map { msg ->
                ClaudeMessage(
                    role = if (msg.senderType == SenderType.User) "user" else "assistant",
                    content = (msg.content as MessageContent.Text).text
                )
            } + ClaudeMessage(role = "user", content = userMessage)

        val requestBody = ClaudeRequest(
            model = MODEL,
            maxTokens = MAX_TOKENS,
            system = systemPrompt,
            messages = messages,
            stream = true
        )

        val bodyJson = json.encodeToString(ClaudeRequest.serializer(), requestBody)

        httpClient.preparePost(API_URL) {
            headers {
                append("x-api-key", apiKey)
                append("anthropic-version", ANTHROPIC_VERSION)
            }
            contentType(ContentType.Application.Json)
            setBody(bodyJson)
        }.execute { response ->
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
                    Napier.w("Skipping unparseable SSE chunk: $data", tag = TAG)
                }
            }
        }
    }
}

@Serializable
private data class ClaudeRequest(
    val model: String,
    @SerialName("max_tokens") val maxTokens: Int,
    val system: String,
    val messages: List<ClaudeMessage>,
    val stream: Boolean
)

@Serializable
private data class ClaudeMessage(
    val role: String,
    val content: String
)
