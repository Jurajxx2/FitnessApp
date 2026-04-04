package com.coachfoska.app.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.util.rememberUriBytesReader
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.presentation.chat.ChatIntent
import com.coachfoska.app.presentation.chat.ChatState
import com.coachfoska.app.presentation.chat.ChatViewModel
import com.coachfoska.app.ui.chat.components.ChatBubble
import com.coachfoska.app.ui.chat.components.ChatInputBar
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.MediaCaptureBottomSheet
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ChatRoute(
    userId: String,
    chatType: ChatType,
    viewModel: ChatViewModel = koinViewModel { parametersOf(userId, chatType) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ChatScreen(
        state = state,
        chatType = chatType,
        onIntent = viewModel::onIntent
    )
}

@Composable
fun ChatScreen(
    state: ChatState,
    chatType: ChatType,
    onIntent: (ChatIntent) -> Unit
) {
    val listState = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }
    var inputText by remember { mutableStateOf("") }
    var showImageSheet by remember { mutableStateOf(false) }
    val readUriBytes = rememberUriBytesReader()

    // Auto-scroll to bottom when new messages arrive or streaming updates
    LaunchedEffect(state.messages.size, state.streamingText) {
        val targetIndex = if (state.isAiStreaming) state.messages.size else state.messages.size - 1
        if (targetIndex >= 0) {
            listState.animateScrollToItem(targetIndex)
        }
    }

    // Show error as snackbar
    LaunchedEffect(state.error) {
        if (state.error != null) {
            snackbarHostState.showSnackbar(state.error)
        }
    }

    if (showImageSheet) {
        MediaCaptureBottomSheet(
            mode = MediaCaptureMode.PHOTO,
            onDismiss = { showImageSheet = false },
            onResult = { uriString ->
                showImageSheet = false
                uriString?.let { uri ->
                    val bytes = readUriBytes(uri)
                    if (bytes != null) {
                        onIntent(ChatIntent.SendImageMessage(bytes))
                    }
                }
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (state.isLoading) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary
            )
        }

        Box(modifier = Modifier.weight(1f)) {
            when {
                state.isLoading && state.messages.isEmpty() -> CoachLoadingBox()
                state.messages.isEmpty() && !state.isLoading -> EmptyChat(chatType)
                else -> LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(state.messages, key = { it.id }) { message ->
                        ChatBubble(
                            message = message,
                            isOwn = message.senderType == SenderType.User
                        )
                    }

                    // Streaming AI response as a partial bubble
                    if (state.isAiStreaming) {
                        item(key = "streaming") {
                            val displayText = if (state.streamingText.isNotEmpty())
                                state.streamingText + " ▋"
                            else
                                "▋"
                            val streamingMessage = com.coachfoska.app.domain.model.ChatMessage(
                                id = "streaming",
                                userId = "",
                                chatType = ChatType.Ai,
                                senderType = SenderType.Ai,
                                content = MessageContent.Text(displayText),
                                createdAt = currentInstant()
                            )
                            ChatBubble(message = streamingMessage, isOwn = false)
                        }
                    }
                }
            }

            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            ) { data ->
                Snackbar(snackbarData = data)
            }
        }

        ChatInputBar(
            text = inputText,
            onTextChange = { inputText = it },
            onSend = {
                onIntent(ChatIntent.SendTextMessage(inputText))
                inputText = ""
            },
            onImageAttach = { showImageSheet = true },
            isSending = state.isSending || state.isAiStreaming
        )
    }
}

@Composable
private fun EmptyChat(chatType: ChatType) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text = when (chatType) {
                ChatType.Human -> "No messages yet.\nSend a message to your coach."
                ChatType.Ai -> "No messages yet.\nAsk your AI coach anything."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(32.dp)
        )
    }
}
