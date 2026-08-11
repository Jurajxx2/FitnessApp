package com.coachfoska.app.data.ai

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AiProxyRequestContractTest {

    @Test
    fun requestContainsMessagesButNeverCallerControlledSystemPrompt() {
        val encoded = Json.encodeToString(
            AiProxyRequest(messages = listOf(ClaudeMessage(role = "user", content = "hello"))),
        )

        assertTrue("\"messages\"" in encoded)
        assertFalse("\"system\"" in encoded)
    }
}
