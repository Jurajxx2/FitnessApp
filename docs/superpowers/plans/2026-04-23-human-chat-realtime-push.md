# Human Chat: Reliable Realtime + Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Human chat so coach messages reliably appear in real time (subscribe-before-seed, reconnect gap-fill, optimistic sends), and add push notification infrastructure that alerts the user when the coach sends a message while the app is backgrounded.

**Architecture:** Subscribe to Supabase Realtime first, then seed from the DB — this eliminates the insert-in-the-gap race condition. A separate `_optimistic` StateFlow in ChatViewModel holds pending user messages until confirmed by Realtime, preventing flicker. Push notifications use a Supabase Edge Function triggered by DB webhook on `chat_messages` INSERT, which reads device tokens from a new `device_tokens` table and posts to FCM. Firebase integration is stubbed (returns `null` token) until `google-services.json` is added.

**Tech Stack:** Kotlin Multiplatform, Supabase Kotlin 3.4.1 (postgrest + realtime), Koin 4.1.1, MockK, kotlinx-coroutines-test, Turbine, Deno Edge Function, FCM v1 API

---

## File Map

**Created:**
- `supabase/migrations/20260423000000_add_device_tokens.sql`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/push/PushNotificationService.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/push/AndroidPushNotificationService.kt`
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/push/IosPushNotificationService.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/DeviceTokenDto.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/DeviceTokenDataSource.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/DeviceTokenRepository.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImpl.kt`
- `supabase/functions/notify-chat-message/index.ts`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImplTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/chat/ChatViewModelTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImplTest.kt`

**Modified:**
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ChatRemoteDataSource.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImpl.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatViewModel.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatState.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/splash/SplashViewModel.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt`
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/MainActivity.kt`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/fixtures/Fixtures.kt`

---

### Task 1: DB migration — device_tokens table

**Files:**
- Create: `supabase/migrations/20260423000000_add_device_tokens.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260423000000_add_device_tokens.sql`:

```sql
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  token text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table device_tokens enable row level security;

create policy "Users can manage own device tokens"
  on device_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

Expected: migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260423000000_add_device_tokens.sql
git commit -m "feat(db): add device_tokens table for push notification registration"
```

---

### Task 2: ChatRemoteDataSource — add fetchMessagesSince

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ChatRemoteDataSource.kt`

- [ ] **Step 1: Add the import and the new method**

Add `import kotlinx.datetime.Instant` to the import block at the top of `ChatRemoteDataSource.kt`.

Add this method to the `ChatRemoteDataSource` class body, after `fetchLatestMessage`:

```kotlin
suspend fun fetchMessagesSince(
    userId: String,
    chatType: ChatType,
    since: Instant
): List<ChatMessageDto> = supabase.postgrest[TABLE]
    .select {
        filter {
            eq("user_id", userId)
            eq("chat_type", chatType.toDbValue())
            gt("created_at", since.toString())
        }
        order("created_at", Order.ASCENDING)
    }
    .decodeList<ChatMessageDto>()
```

- [ ] **Step 2: Compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/ChatRemoteDataSource.kt
git commit -m "feat(chat): add fetchMessagesSince to ChatRemoteDataSource"
```

---

### Task 3: ChatRepositoryImpl — subscribe-first + reconnect with gap fill

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImpl.kt`

- [ ] **Step 1: Replace observeMessages entirely**

The current `observeMessages` fetches messages then subscribes — backwards. Replace the full method with the subscribe-first version below. Also add `import kotlinx.coroutines.delay` and `import kotlinx.datetime.Instant` to the import block.

Replace `observeMessages` with:

```kotlin
override fun observeMessages(userId: String, chatType: ChatType): Flow<List<ChatMessage>> =
    channelFlow {
        val messages = mutableListOf<ChatMessage>()
        var lastSeenAt: Instant? = null

        suspend fun addAndEmit(msg: ChatMessage) {
            if (messages.none { it.id == msg.id }) {
                messages.add(msg)
                messages.sortBy { it.createdAt }
            }
            lastSeenAt = messages.maxOfOrNull { it.createdAt }
            send(messages.toList())
        }

        suspend fun fillGap() {
            val since = lastSeenAt ?: return
            val gap = runCatching { dataSource.fetchMessagesSince(userId, chatType, since) }
                .getOrElse { emptyList() }
            var changed = false
            for (dto in gap) {
                val msg = dto.toDomain()
                if (messages.none { it.id == msg.id }) {
                    messages.add(msg)
                    changed = true
                }
            }
            if (changed) {
                messages.sortBy { it.createdAt }
                lastSeenAt = messages.maxOfOrNull { it.createdAt }
                send(messages.toList())
            }
        }

        // Subscribe FIRST — channel buffers any inserts that arrive during the seed fetch below
        val realtimeJob = launch {
            var attempt = 0
            while (attempt <= MAX_RETRIES) {
                val error = runCatching {
                    dataSource.observeNewMessages(userId, chatType).collect { dto ->
                        addAndEmit(dto.toDomain())
                    }
                }.exceptionOrNull()

                if (error == null) break
                attempt++
                if (attempt > MAX_RETRIES) {
                    Napier.e("Realtime gave up after $MAX_RETRIES retries", error, tag = TAG)
                    break
                }
                Napier.w("Realtime disconnected (attempt $attempt), retrying in ${retryDelayMs(attempt)}ms", tag = TAG)
                delay(retryDelayMs(attempt))
                fillGap()
            }
        }

        // Seed with persisted history AFTER Realtime is subscribed
        val initial = runCatching { dataSource.fetchMessages(userId, chatType) }
            .getOrElse { emptyList() }
        for (dto in initial.sortedBy { it.createdAt }) {
            if (messages.none { it.id == dto.id }) messages.add(dto.toDomain())
        }
        messages.sortBy { it.createdAt }
        lastSeenAt = messages.maxOfOrNull { it.createdAt }
        send(messages.toList())

        realtimeJob.join()
    }
```

Add inside the class body (before `observeMessages`):

```kotlin
companion object {
    private const val MAX_RETRIES = 3
    private fun retryDelayMs(attempt: Int): Long = 1000L shl (attempt - 1) // 1s, 2s, 4s
}
```

- [ ] **Step 2: Compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImpl.kt
git commit -m "fix(chat): subscribe-first ordering + reconnect retry with gap fill"
```

---

### Task 4: ChatViewModel — optimistic inserts

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatViewModel.kt`

- [ ] **Step 1: Add isReconnecting to ChatState**

Replace `ChatState.kt` with:

```kotlin
package com.coachfoska.app.presentation.chat

import com.coachfoska.app.domain.model.ChatMessage

data class ChatState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val isAiStreaming: Boolean = false,
    val streamingText: String = "",
    val error: String? = null,
    val hasMorePages: Boolean = false,
    val isReconnecting: Boolean = false
)
```

- [ ] **Step 2: Rewrite ChatViewModel**

Replace the full contents of `ChatViewModel.kt`:

```kotlin
package com.coachfoska.app.presentation.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.ChatMessage
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.usecase.chat.MarkMessagesReadUseCase
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.chat.SendAiChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.SendHumanChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.UploadChatImageUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.coachfoska.app.core.util.currentInstant
import kotlin.math.abs

private const val TAG = "ChatViewModel"
private const val OPTIMISTIC_MATCH_WINDOW_SECONDS = 5L

class ChatViewModel(
    private val observeChatMessages: ObserveChatMessagesUseCase,
    private val sendHumanMessage: SendHumanChatMessageUseCase,
    private val sendAiMessage: SendAiChatMessageUseCase,
    private val markMessagesRead: MarkMessagesReadUseCase,
    private val uploadChatImage: UploadChatImageUseCase,
    private val userId: String,
    private val chatType: ChatType
) : ViewModel() {

    private val _state = MutableStateFlow(ChatState())
    val state: StateFlow<ChatState> = _state.asStateFlow()

    // Server-confirmed messages from the repository flow
    private val _serverMessages = MutableStateFlow<List<ChatMessage>>(emptyList())

    // Locally added optimistic messages awaiting server confirmation
    private val _optimistic = MutableStateFlow<List<ChatMessage>>(emptyList())

    private var observeJob: Job? = null

    init {
        startObserving()
    }

    fun onIntent(intent: ChatIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            ChatIntent.LoadMessages -> {
                observeJob?.cancel()
                startObserving()
            }
            ChatIntent.LoadMoreMessages -> Napier.d("LoadMoreMessages: not yet implemented", tag = TAG)
            is ChatIntent.SendTextMessage -> sendText(intent.text)
            is ChatIntent.SendImageMessage -> sendImage(intent.imageBytes)
            ChatIntent.MarkAllRead -> markAllRead()
        }
    }

    private fun startObserving() {
        observeJob = viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            // Merge server + optimistic into displayed messages
            launch {
                combine(_serverMessages, _optimistic) { server, optimistic ->
                    val confirmed = optimistic.filter { opt -> server.any { srv -> srv.isConfirmedFor(opt) } }
                    if (confirmed.isNotEmpty()) {
                        _optimistic.update { current -> current - confirmed.toSet() }
                    }
                    (server + _optimistic.value).sortedBy { it.createdAt }
                }.collect { combined ->
                    _state.update { it.copy(messages = combined) }
                }
            }

            observeChatMessages(userId, chatType)
                .catch { e ->
                    Napier.e("observeMessages failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
                .collect { messages ->
                    _serverMessages.value = messages
                    _state.update { it.copy(isLoading = false) }
                    markAllRead()
                }
        }
    }

    private fun sendText(text: String) {
        if (text.isBlank()) return
        when (chatType) {
            ChatType.Human -> sendHumanText(text)
            ChatType.Ai -> sendAiText(text)
        }
    }

    private fun sendHumanText(text: String) {
        val optimistic = ChatMessage(
            id = "optimistic-${currentInstant().toEpochMilliseconds()}",
            userId = userId,
            chatType = ChatType.Human,
            senderType = SenderType.User,
            content = MessageContent.Text(text),
            createdAt = currentInstant()
        )
        _optimistic.update { it + optimistic }

        viewModelScope.launch {
            _state.update { it.copy(isSending = true, error = null) }
            sendHumanMessage(userId, MessageContent.Text(text))
                .onFailure { e ->
                    Napier.e("sendHumanMessage failed", e, tag = TAG)
                    _optimistic.update { list -> list.filter { it.id != optimistic.id } }
                    _state.update { it.copy(isSending = false, error = e.message) }
                }
                .onSuccess {
                    _state.update { it.copy(isSending = false) }
                }
        }
    }

    private fun sendAiText(text: String) {
        viewModelScope.launch {
            _state.update { it.copy(isAiStreaming = true, streamingText = "", error = null) }
            val history = _state.value.messages
            val accumulatedText = StringBuilder()

            sendAiMessage(userId, history, text)
                .catch { e ->
                    Napier.e("sendAiMessage stream failed", e, tag = TAG)
                    _state.update { it.copy(isAiStreaming = false, streamingText = "", error = e.message) }
                }
                .collect { chunk ->
                    accumulatedText.append(chunk)
                    _state.update { it.copy(streamingText = accumulatedText.toString()) }
                }

            val fullText = accumulatedText.toString()
            if (fullText.isNotEmpty()) {
                val aiMessage = ChatMessage(
                    id = "ai-${currentInstant().toEpochMilliseconds()}",
                    userId = userId,
                    chatType = ChatType.Ai,
                    senderType = SenderType.Ai,
                    content = MessageContent.Text(fullText),
                    createdAt = currentInstant()
                )
                _state.update { state ->
                    state.copy(
                        isAiStreaming = false,
                        streamingText = "",
                        messages = state.messages + aiMessage
                    )
                }
            } else {
                _state.update { it.copy(isAiStreaming = false, streamingText = "") }
            }
        }
    }

    private fun sendImage(imageBytes: ByteArray) {
        viewModelScope.launch {
            _state.update { it.copy(isSending = true, error = null) }
            val url = uploadChatImage(userId, imageBytes).getOrElse { e ->
                Napier.e("uploadChatImage failed", e, tag = TAG)
                _state.update { it.copy(isSending = false, error = e.message) }
                return@launch
            }
            sendHumanMessage(userId, MessageContent.Image(url = url, thumbnailUrl = null))
                .onFailure { e ->
                    Napier.e("sendImageMessage failed", e, tag = TAG)
                    _state.update { it.copy(isSending = false, error = e.message) }
                }
                .onSuccess {
                    _state.update { it.copy(isSending = false) }
                }
        }
    }

    private fun markAllRead() {
        viewModelScope.launch {
            markMessagesRead(userId, chatType)
                .onFailure { e -> Napier.e("markMessagesRead failed", e, tag = TAG) }
        }
    }

    // A server message confirms an optimistic one if it's the same user text within a 5s window
    private fun ChatMessage.isConfirmedFor(optimistic: ChatMessage): Boolean {
        if (senderType != SenderType.User) return false
        val thisContent = content
        val optContent = optimistic.content
        if (thisContent !is MessageContent.Text || optContent !is MessageContent.Text) return false
        if (thisContent.text != optContent.text) return false
        if (userId != optimistic.userId) return false
        return abs((createdAt - optimistic.createdAt).inWholeSeconds) <= OPTIMISTIC_MATCH_WINDOW_SECONDS
    }
}
```

- [ ] **Step 3: Compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatViewModel.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/chat/ChatState.kt
git commit -m "feat(chat): optimistic inserts with server confirmation dedup"
```

---

### Task 5: Tests — ChatRepositoryImpl

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/fixtures/Fixtures.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImplTest.kt`

- [ ] **Step 1: Add aChatMessageDto fixture**

At the end of `Fixtures.kt`, add:

```kotlin
import com.coachfoska.app.data.remote.dto.ChatMessageDto

fun aChatMessageDto(
    id: String = "msg-1",
    userId: String = "user-1",
    chatType: String = "human",
    senderType: String = "coach",
    textContent: String = "Great workout today!",
    createdAt: String = "2026-04-23T10:00:00Z"
) = ChatMessageDto(
    id = id,
    userId = userId,
    chatType = chatType,
    senderType = senderType,
    contentType = "text",
    textContent = textContent,
    imageUrl = null,
    createdAt = createdAt,
    readAt = null
)
```

- [ ] **Step 2: Write the test file**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImplTest.kt`:

```kotlin
package com.coachfoska.app.data.repository

import app.cash.turbine.test
import com.coachfoska.app.data.ai.ChatAiProvider
import com.coachfoska.app.data.remote.datasource.ChatRemoteDataSource
import com.coachfoska.app.data.remote.datasource.ChatStorageDataSource
import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.fixtures.aChatMessageDto
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.seconds

class ChatRepositoryImplTest {

    private val dataSource: ChatRemoteDataSource = mockk()
    private val storageDataSource: ChatStorageDataSource = mockk()
    private val aiProvider: ChatAiProvider = mockk()

    private fun repo() = ChatRepositoryImpl(dataSource, storageDataSource, aiProvider)

    @Test
    fun `observeMessages emits seeded messages from DB`() = runTest {
        val dto = aChatMessageDto()
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf()

        repo().observeMessages("user-1", ChatType.Human).test {
            val first = awaitItem()
            assertEquals(1, first.size)
            assertEquals("msg-1", first[0].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages deduplicates realtime echo of seeded message`() = runTest {
        val dto = aChatMessageDto(id = "msg-1")
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf(dto)

        repo().observeMessages("user-1", ChatType.Human).test {
            // Collect all emissions and verify the message only appears once in the final state
            val emissions = mutableListOf<Int>()
            while (true) {
                val item = awaitItem()
                emissions.add(item.size)
                if (emissions.size >= 2) break
            }
            assertEquals(1, emissions.last())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages emits realtime message not present in seed`() = runTest {
        val seed = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")
        val newMsg = aChatMessageDto(id = "msg-2", createdAt = "2026-04-23T10:01:00Z")
        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(seed)
        coEvery { dataSource.observeNewMessages(any(), any()) } returns flowOf(newMsg)

        repo().observeMessages("user-1", ChatType.Human).test {
            val afterSeed = awaitItem()
            assertEquals(1, afterSeed.size)
            val withRealtime = awaitItem()
            assertEquals(2, withRealtime.size)
            assertEquals("msg-2", withRealtime[1].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `observeMessages retries on realtime error and fills gap`() = runTest {
        val dto1 = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")
        val dto2 = aChatMessageDto(id = "msg-2", createdAt = "2026-04-23T10:01:00Z")

        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto1)

        var realtimeCallCount = 0
        coEvery { dataSource.observeNewMessages(any(), any()) } answers {
            realtimeCallCount++
            if (realtimeCallCount == 1) flow { throw RuntimeException("disconnected") }
            else flowOf()
        }
        coEvery { dataSource.fetchMessagesSince(any(), any(), any()) } returns listOf(dto2)

        repo().observeMessages("user-1", ChatType.Human).test(timeout = 10.seconds) {
            awaitItem() // initial seed emission
            val afterGap = awaitItem() // gap fill after reconnect
            assertEquals(2, afterGap.size)
            assertEquals("msg-2", afterGap[1].id)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `fetchMessagesSince is called with lastSeenAt after reconnect`() = runTest {
        val dto1 = aChatMessageDto(id = "msg-1", createdAt = "2026-04-23T10:00:00Z")

        coEvery { dataSource.fetchMessages(any(), any(), any(), any()) } returns listOf(dto1)
        var realtimeCallCount = 0
        coEvery { dataSource.observeNewMessages(any(), any()) } answers {
            realtimeCallCount++
            if (realtimeCallCount == 1) flow { throw RuntimeException("disconnected") }
            else flowOf()
        }
        coEvery { dataSource.fetchMessagesSince(any(), any(), any()) } returns emptyList()

        repo().observeMessages("user-1", ChatType.Human).test(timeout = 10.seconds) {
            awaitItem() // seed
            cancelAndIgnoreRemainingEvents()
        }

        coVerify(atLeast = 1) { dataSource.fetchMessagesSince("user-1", ChatType.Human, any()) }
    }
}
```

- [ ] **Step 3: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "*.ChatRepositoryImplTest" 2>&1 | tail -30
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/fixtures/Fixtures.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/ChatRepositoryImplTest.kt
git commit -m "test(chat): add ChatRepositoryImpl tests for subscribe-first and gap-fill"
```

---

### Task 6: Tests — ChatViewModel

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/chat/ChatViewModelTest.kt`

- [ ] **Step 1: Write the test file**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/chat/ChatViewModelTest.kt`:

```kotlin
package com.coachfoska.app.presentation.chat

import com.coachfoska.app.domain.model.ChatType
import com.coachfoska.app.domain.model.MessageContent
import com.coachfoska.app.domain.model.SenderType
import com.coachfoska.app.domain.repository.ChatRepository
import com.coachfoska.app.domain.usecase.chat.MarkMessagesReadUseCase
import com.coachfoska.app.domain.usecase.chat.ObserveChatMessagesUseCase
import com.coachfoska.app.domain.usecase.chat.SendAiChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.SendHumanChatMessageUseCase
import com.coachfoska.app.domain.usecase.chat.UploadChatImageUseCase
import com.coachfoska.app.fixtures.aChatMessage
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val chatRepo: ChatRepository = mockk()
    private val sendHumanUseCase: SendHumanChatMessageUseCase = mockk()
    private val sendAiUseCase: SendAiChatMessageUseCase = mockk()
    private val markReadUseCase: MarkMessagesReadUseCase = mockk(relaxed = true)
    private val uploadImageUseCase: UploadChatImageUseCase = mockk()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(
        serverMessages: List<com.coachfoska.app.domain.model.ChatMessage> = emptyList()
    ): ChatViewModel {
        coEvery { chatRepo.observeMessages(any(), any()) } returns flowOf(serverMessages)
        return ChatViewModel(
            observeChatMessages = ObserveChatMessagesUseCase(chatRepo),
            sendHumanMessage = sendHumanUseCase,
            sendAiMessage = sendAiUseCase,
            markMessagesRead = markReadUseCase,
            uploadChatImage = uploadImageUseCase,
            userId = "user-1",
            chatType = ChatType.Human
        )
    }

    @Test
    fun `sendText adds optimistic message to state immediately`() = runTest {
        coEvery { sendHumanUseCase(any(), any()) } returns Result.success(aChatMessage())

        val vm = viewModel()
        advanceUntilIdle()

        vm.onIntent(ChatIntent.SendTextMessage("Hello coach"))

        val optimistic = vm.state.value.messages.filter { it.id.startsWith("optimistic-") }
        assertEquals(1, optimistic.size)
        assertEquals(MessageContent.Text("Hello coach"), optimistic[0].content)
        assertEquals(SenderType.User, optimistic[0].senderType)
    }

    @Test
    fun `optimistic message removed on send failure`() = runTest {
        coEvery { sendHumanUseCase(any(), any()) } returns Result.failure(RuntimeException("network error"))

        val vm = viewModel()
        advanceUntilIdle()
        vm.onIntent(ChatIntent.SendTextMessage("Hello"))
        advanceUntilIdle()

        val optimistic = vm.state.value.messages.filter { it.id.startsWith("optimistic-") }
        assertEquals(0, optimistic.size)
        assertEquals("network error", vm.state.value.error)
    }

    @Test
    fun `isSending is true while send is in progress`() = runTest {
        coEvery { sendHumanUseCase(any(), any()) } returns Result.success(aChatMessage())

        val vm = viewModel()
        advanceUntilIdle()
        vm.onIntent(ChatIntent.SendTextMessage("Hello"))

        assertTrue(vm.state.value.isSending)
        advanceUntilIdle()
        assertFalse(vm.state.value.isSending)
    }

    @Test
    fun `state not loading after messages collected`() = runTest {
        val vm = viewModel(serverMessages = listOf(aChatMessage()))
        advanceUntilIdle()

        assertFalse(vm.state.value.isLoading)
        assertEquals(1, vm.state.value.messages.size)
    }

    @Test
    fun `no error in state on successful load`() = runTest {
        val vm = viewModel(serverMessages = listOf(aChatMessage()))
        advanceUntilIdle()

        assertNull(vm.state.value.error)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "*.ChatViewModelTest" 2>&1 | tail -30
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/chat/ChatViewModelTest.kt
git commit -m "test(chat): add ChatViewModel tests for optimistic insert behavior"
```

---

### Task 7: PushNotificationService interface + platform stubs + DI

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/push/PushNotificationService.kt`
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/push/AndroidPushNotificationService.kt`
- Create: `composeApp/src/iosMain/kotlin/com/coachfoska/app/push/IosPushNotificationService.kt`
- Modify: `composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt`
- Modify: `composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt`

- [ ] **Step 1: Create the interface**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/push/PushNotificationService.kt`:

```kotlin
package com.coachfoska.app.domain.push

interface PushNotificationService {
    /** Returns the FCM/APNs device token, or null if Firebase is not yet configured. */
    suspend fun getToken(): String?
}
```

- [ ] **Step 2: Create Android stub**

Create `composeApp/src/androidMain/kotlin/com/coachfoska/app/push/AndroidPushNotificationService.kt`:

```kotlin
package com.coachfoska.app.push

import com.coachfoska.app.domain.push.PushNotificationService

// Stub — replace getToken() body with FirebaseMessaging.getInstance().token once
// google-services.json and the firebase-messaging dependency are added.
class AndroidPushNotificationService : PushNotificationService {
    override suspend fun getToken(): String? = null
}
```

- [ ] **Step 3: Create iOS stub**

Create `composeApp/src/iosMain/kotlin/com/coachfoska/app/push/IosPushNotificationService.kt`:

```kotlin
package com.coachfoska.app.push

import com.coachfoska.app.domain.push.PushNotificationService

// Stub — replace getToken() body with APNs/FCM token retrieval once
// GoogleService-Info.plist and Firebase credentials are added.
class IosPushNotificationService : PushNotificationService {
    override suspend fun getToken(): String? = null
}
```

- [ ] **Step 4: Update AndroidModule to bind PushNotificationService**

Replace the full contents of `composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt`:

```kotlin
package com.coachfoska.app.di

import com.coachfoska.app.auth.AndroidSocialAuthProvider
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.data.repository.DeviceTokenRepositoryImpl
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.push.AndroidPushNotificationService
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    single<SocialAuthProvider> { AndroidSocialAuthProvider(androidContext()) }
    single<PushNotificationService> { AndroidPushNotificationService() }
    single<DeviceTokenRepository> {
        DeviceTokenRepositoryImpl(dataSource = get(), pushService = get(), platform = "android")
    }
}
```

- [ ] **Step 5: Update IosModule to bind PushNotificationService**

Replace the full contents of `composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt`:

```kotlin
package com.coachfoska.app.di

import com.coachfoska.app.auth.IosSocialAuthProvider
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.data.repository.DeviceTokenRepositoryImpl
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.push.IosPushNotificationService
import org.koin.dsl.module

val iosModule = module {
    single<SocialAuthProvider> { IosSocialAuthProvider() }
    single<PushNotificationService> { IosPushNotificationService() }
    single<DeviceTokenRepository> {
        DeviceTokenRepositoryImpl(dataSource = get(), pushService = get(), platform = "ios")
    }
}
```

Note: `DeviceTokenDataSource` (`get()`) is provided by `pushModule` defined in the next task.

- [ ] **Step 6: Compile check (will fail until Task 8 creates DeviceTokenRepositoryImpl)**

Skip until after Task 8 is complete.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/push/PushNotificationService.kt \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/push/AndroidPushNotificationService.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/push/IosPushNotificationService.kt \
        composeApp/src/androidMain/kotlin/com/coachfoska/app/di/AndroidModule.kt \
        composeApp/src/iosMain/kotlin/com/coachfoska/app/di/IosModule.kt
git commit -m "feat(push): add PushNotificationService interface + platform stubs"
```

---

### Task 8: DeviceToken data layer + DI + tests

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/DeviceTokenDto.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/DeviceTokenDataSource.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/DeviceTokenRepository.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImpl.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImplTest.kt`

- [ ] **Step 1: Write the failing tests first**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImplTest.kt`:

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.domain.push.PushNotificationService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DeviceTokenRepositoryImplTest {

    private val dataSource: DeviceTokenDataSource = mockk()
    private val pushService: PushNotificationService = mockk()

    private fun repo(platform: String = "android") =
        DeviceTokenRepositoryImpl(dataSource, pushService, platform)

    @Test
    fun `upsertToken calls dataSource when token available`() = runTest {
        coEvery { pushService.getToken() } returns "fcm-token-123"
        coEvery { dataSource.upsert(any(), any(), any()) } returns Unit

        val result = repo().upsertToken("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.upsert("user-1", "android", "fcm-token-123") }
    }

    @Test
    fun `upsertToken is no-op and succeeds when token is null`() = runTest {
        coEvery { pushService.getToken() } returns null

        val result = repo().upsertToken("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 0) { dataSource.upsert(any(), any(), any()) }
    }

    @Test
    fun `upsertToken returns failure when dataSource throws`() = runTest {
        coEvery { pushService.getToken() } returns "fcm-token-123"
        coEvery { dataSource.upsert(any(), any(), any()) } throws RuntimeException("DB error")

        val result = repo().upsertToken("user-1")

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }
}
```

- [ ] **Step 2: Run to confirm they fail (types not yet defined)**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "*.DeviceTokenRepositoryImplTest" 2>&1 | tail -10
```

Expected: compile error — `DeviceTokenDataSource`, `DeviceTokenRepository`, `DeviceTokenRepositoryImpl` not found.

- [ ] **Step 3: Create the DTO**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/DeviceTokenDto.kt`:

```kotlin
package com.coachfoska.app.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeviceTokenInsertDto(
    @SerialName("user_id") val userId: String,
    val platform: String,
    val token: String
)
```

- [ ] **Step 4: Create the data source**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/DeviceTokenDataSource.kt`:

```kotlin
package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.DeviceTokenInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest

private const val TABLE = "device_tokens"

class DeviceTokenDataSource(private val supabase: SupabaseClient) {

    suspend fun upsert(userId: String, platform: String, token: String) {
        supabase.postgrest[TABLE].upsert(
            DeviceTokenInsertDto(userId = userId, platform = platform, token = token)
        ) {
            onConflict = "user_id,platform"
        }
    }
}
```

- [ ] **Step 5: Create the repository interface**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/DeviceTokenRepository.kt`:

```kotlin
package com.coachfoska.app.domain.repository

interface DeviceTokenRepository {
    suspend fun upsertToken(userId: String): Result<Unit>
}
```

- [ ] **Step 6: Create the repository implementation**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImpl.kt`:

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import io.github.aakira.napier.Napier

private const val TAG = "DeviceTokenRepository"

class DeviceTokenRepositoryImpl(
    private val dataSource: DeviceTokenDataSource,
    private val pushService: PushNotificationService,
    private val platform: String
) : DeviceTokenRepository {

    override suspend fun upsertToken(userId: String): Result<Unit> = runCatching {
        val token = pushService.getToken() ?: run {
            Napier.d("Push token unavailable, skipping upsert", tag = TAG)
            return Result.success(Unit)
        }
        dataSource.upsert(userId, platform, token)
        Napier.d("Device token upserted for $platform", tag = TAG)
    }
}
```

- [ ] **Step 7: Register DeviceTokenDataSource in AppModule**

In `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`:

Add imports:
```kotlin
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
```

Add a new `pushModule` after the `chatModule` declaration:
```kotlin
val pushModule = module {
    single { DeviceTokenDataSource(get()) }
    // DeviceTokenRepository is provided by platform modules (androidModule / iosModule)
    // because the platform string ("android" / "ios") differs per platform
}
```

Add `pushModule` to `appModules`:
```kotlin
val appModules = listOf(
    themeModule,
    networkModule,
    dataSourceModule,
    repositoryModule,
    useCaseModule,
    viewModelModule,
    chatModule,
    pushModule
)
```

- [ ] **Step 8: Run the failing tests — now they should compile and pass**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "*.DeviceTokenRepositoryImplTest" 2>&1 | tail -30
```

Expected: 3 tests pass.

- [ ] **Step 9: Full compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 10: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/DeviceTokenDto.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/DeviceTokenDataSource.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/repository/DeviceTokenRepository.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImpl.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/DeviceTokenRepositoryImplTest.kt
git commit -m "feat(push): add DeviceTokenRepository with upsert logic + tests"
```

---

### Task 9: Token upsert on session start

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/splash/SplashViewModel.kt`

- [ ] **Step 1: Rewrite SplashViewModel to inject DeviceTokenRepository**

Replace the full contents of `SplashViewModel.kt`:

```kotlin
package com.coachfoska.app.presentation.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.model.SessionAuthState
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.domain.usecase.auth.ObserveSessionUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.launch

private const val TAG = "SplashViewModel"

sealed interface SplashNavState {
    data object Loading : SplashNavState
    data class NavigateToHome(val userId: String) : SplashNavState
    data class NavigateToOnboarding(val userId: String) : SplashNavState
    data object NavigateToWelcome : SplashNavState
}

class SplashViewModel(
    private val observeSession: ObserveSessionUseCase,
    private val deviceTokenRepository: DeviceTokenRepository
) : ViewModel() {

    val state: StateFlow<SplashNavState> = observeSession()
        .map { sessionState ->
            when (sessionState) {
                SessionAuthState.Loading -> SplashNavState.Loading
                is SessionAuthState.Authenticated -> {
                    val user = sessionState.user
                    if (user.onboardingComplete) SplashNavState.NavigateToHome(user.id)
                    else SplashNavState.NavigateToOnboarding(user.id)
                }
                SessionAuthState.NotAuthenticated -> SplashNavState.NavigateToWelcome
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SplashNavState.Loading)

    init {
        viewModelScope.launch {
            observeSession()
                .filterIsInstance<SessionAuthState.Authenticated>()
                .take(1)
                .collect { authState ->
                    deviceTokenRepository.upsertToken(authState.user.id)
                        .onFailure { e -> Napier.e("Token upsert failed", e, tag = TAG) }
                }
        }
    }
}
```

`viewModelOf(::SplashViewModel)` in `AppModule` uses Koin constructor injection, so `DeviceTokenRepository` is resolved automatically as long as it's registered in the platform module loaded before `viewModelModule`. No change needed in `AppModule`.

- [ ] **Step 2: Compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/splash/SplashViewModel.kt
git commit -m "feat(push): upsert device token when session is authenticated"
```

---

### Task 10: Supabase Edge Function — notify-chat-message

**Files:**
- Create: `supabase/functions/notify-chat-message/index.ts`

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/notify-chat-message/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    // Only notify the user when their coach sends a human chat message
    if (record.chat_type !== "human" || record.sender_type !== "coach") {
      return new Response("skipped", { status: 200 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID")
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY")

    if (!fcmProjectId || !fcmServerKey) {
      console.log("FCM not configured — skipping push notification")
      return new Response("fcm_not_configured", { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", record.user_id)

    if (error) {
      console.error("Failed to fetch device tokens:", error)
      return new Response("token_fetch_error", { status: 200 })
    }

    if (!tokens || tokens.length === 0) {
      return new Response("no_tokens", { status: 200 })
    }

    const body = record.text_content
      ? record.text_content.substring(0, 100)
      : "New message from your coach"

    const sends = tokens.map(({ token }: { token: string }) =>
      fetch(
        `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fcmServerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: "Coach", body },
              data: { chat_type: "human", screen: "chat" },
            },
          }),
        }
      )
    )

    const results = await Promise.allSettled(sends)
    const failures = results.filter((r) => r.status === "rejected").length
    if (failures > 0) {
      console.error(`${failures}/${tokens.length} FCM sends failed`)
    }

    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error("notify-chat-message error:", err)
    return new Response("error", { status: 500 })
  }
})
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy notify-chat-message
```

Expected: Function deployed successfully.

- [ ] **Step 3: Register the Database Webhook**

In Supabase Dashboard → Database → Webhooks → Create webhook:
- **Name:** `chat-message-notify`
- **Table:** `chat_messages`
- **Events:** INSERT only
- **URL:** `https://<your-project-ref>.supabase.co/functions/v1/notify-chat-message`
- **HTTP method:** POST
- **Headers:** `Authorization: Bearer <service-role-key>`

- [ ] **Step 4: Smoke test the deployed function**

```bash
curl -s -X POST \
  "https://<your-project-ref>.supabase.co/functions/v1/notify-chat-message" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"record":{"user_id":"test-user","chat_type":"human","sender_type":"coach","text_content":"Hello"}}'
```

Expected response body: `"fcm_not_configured"` — correct, because FCM secrets aren't set yet.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/notify-chat-message/index.ts
git commit -m "feat(push): add notify-chat-message Edge Function for FCM delivery"
```

---

### Task 11: Android — navigate to HumanCoachChat on notification tap

**Files:**
- Modify: `composeApp/src/androidMain/kotlin/com/coachfoska/app/MainActivity.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

- [ ] **Step 1: Parse notification intent in MainActivity**

Replace the full contents of `MainActivity.kt`:

```kotlin
package com.coachfoska.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            App(openHumanChat = intent.isChatNotificationTap())
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recreate()
    }

    private fun Intent.isChatNotificationTap(): Boolean =
        getStringExtra("screen") == "chat" && getStringExtra("chat_type") == "human"
}
```

- [ ] **Step 2: Update App composable signature**

In `App.kt`, change the function signature from:

```kotlin
@Composable
fun App() {
```

to:

```kotlin
@Composable
fun App(openHumanChat: Boolean = false) {
```

Add the following `LaunchedEffect` inside the `CoachFoskaTheme` block, immediately after:
```kotlin
var currentUserId by remember { mutableStateOf("") }
```

Insert:
```kotlin
LaunchedEffect(openHumanChat, currentUserId) {
    if (openHumanChat && currentUserId.isNotEmpty()) {
        navController.navigate(HumanCoachChat) {
            launchSingleTop = true
        }
    }
}
```

The iOS entry point `MainViewController.kt` calls `App()` without arguments — the default `openHumanChat = false` means no change needed there.

- [ ] **Step 3: Compile check**

```bash
./gradlew :composeApp:compileKotlinAndroid --quiet 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/androidMain/kotlin/com/coachfoska/app/MainActivity.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(push): navigate to human chat on notification tap (Android)"
```

---

### Final: Run full test suite

- [ ] **Run all unit tests**

```bash
./gradlew :composeApp:testDebugUnitTest 2>&1 | tail -40
```

Expected: All tests pass, including the new `ChatRepositoryImplTest`, `ChatViewModelTest`, and `DeviceTokenRepositoryImplTest`.

---

## Activating Firebase (when project is ready)

Complete these steps once `google-services.json` exists:

1. Add to `composeApp/build.gradle.kts` `androidMain` dependencies:
   ```kotlin
   implementation(platform("com.google.firebase:firebase-bom:33.x.x"))
   implementation("com.google.firebase:firebase-messaging-ktx")
   ```
2. Place `google-services.json` in `composeApp/src/androidMain/`
3. Apply Google Services plugin in `build.gradle.kts`
4. Replace `AndroidPushNotificationService.getToken()` stub:
   ```kotlin
   override suspend fun getToken(): String? = suspendCancellableCoroutine { cont ->
       FirebaseMessaging.getInstance().token
           .addOnCompleteListener { task ->
               cont.resume(if (task.isSuccessful) task.result else null)
           }
   }
   ```
5. Set Supabase secrets: `FCM_PROJECT_ID` and `FCM_SERVER_KEY`
6. Place `GoogleService-Info.plist` in the iOS target and update `IosPushNotificationService`
