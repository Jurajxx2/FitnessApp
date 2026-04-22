# Human Chat: Reliable Realtime + Push Notifications

**Date:** 2026-04-23
**Scope:** Human chat only (`ChatType.Human`) — coach ↔ user messaging

---

## Problem

The current Human chat has two reliability gaps:

1. **Messages from the coach never appear** (or only appear after restart). Root causes:
   - `fetchMessages` runs before the Realtime channel subscribes — any insert in that window is dropped
   - If the WebSocket disconnects, the flow dies silently with no recovery
2. **No background delivery** — when the user is not on the chat screen, they receive no notification that the coach sent a message

---

## Goals

- Coach sends a message → user sees it within ~1s if the app is in the foreground
- Coach sends a message → user receives a push notification if the app is backgrounded or killed
- Tapping the push notification opens the Human chat screen directly
- Own sent messages appear immediately (optimistic insert)
- The solution is testable at every layer

---

## Out of Scope

- AI chat (`ChatType.Ai`) — not changed
- Read receipts / delivery receipts beyond what already exists
- Rich push notification media
- iOS APNs direct integration (deferred until Firebase project is created; iOS uses FCM via APNs gateway once credentials exist)

---

## Architecture

### 1. Fix Realtime subscription race condition

**Current flow (broken):**
```
fetchMessages() → [gap where messages can be missed] → subscribe Realtime
```

**Fixed flow:**
```
subscribe Realtime (channel buffering starts) → fetchMessages() → merge
```

In `ChatRemoteDataSource.observeNewMessages()`, the channel is subscribed before initial messages are fetched. Any inserts during the seed fetch are buffered by `channelFlow` and deduplicated by message ID in the repository.

**Reconnection recovery:**

`observeNewMessages` wraps the Realtime subscription in `retryWhen` with exponential backoff (delays: 1s, 2s, 4s — max 3 retries). On each retry, the repository re-fetches messages since the last known `createdAt` timestamp to fill the gap that occurred during the disconnect.

**Backoff limits:** After 3 failed retries, the flow emits an error that the ViewModel surfaces as a "reconnecting…" banner. It does not crash the screen.

### 2. Optimistic sends

When the user sends a message, `ChatViewModel.sendHumanText()` immediately appends a local `ChatMessage` to the state with a temporary ID (`optimistic-<timestamp>`). When the Realtime echo arrives with the real server ID, the repository deduplicates: if a message with the same `textContent + userId` whose optimistic `createdAt` is within 5 seconds of the server `createdAt` already exists, the Realtime insert replaces the optimistic entry. If no match, it is appended normally.

### 3. Device token management

**New Supabase table: `device_tokens`**

```sql
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  token text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table device_tokens enable row level security;
create policy "Users manage own tokens" on device_tokens
  for all using (auth.uid() = user_id);
```

**KMP: `PushNotificationService` (expect/actual)**

```
expect class PushNotificationService {
    suspend fun getToken(): String?
    fun requestPermission()   // iOS only; no-op on Android
}
```

- **Android actual**: calls `FirebaseMessaging.getInstance().token` (coroutine-wrapped). Returns `null` until `google-services.json` is added.
- **iOS actual**: calls `UNUserNotificationCenter.requestAuthorization` then returns the APNs token converted via FCM SDK. Stubbed to return `null` until Firebase credentials exist.

**`DeviceTokenRepository`** (new, thin):
- `suspend fun upsertToken(userId: String, platform: String, token: String): Result<Unit>`
- Called from the auth success handler and on each app foreground event (token can rotate)

### 4. Supabase Edge Function: `notify-chat-message`

Triggered by a **Database Webhook** on `INSERT` to `chat_messages` where `chat_type = 'human'` and `sender_type = 'coach'`.

**Function logic:**
1. Read `user_id` from the inserted row
2. Query `device_tokens` for all tokens belonging to that `user_id`
3. For each token, POST to FCM v1 API (`https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send`)
4. Payload:
   ```json
   {
     "message": {
       "token": "<device_token>",
       "notification": { "title": "Coach", "body": "<first 100 chars of message>" },
       "data": { "chat_type": "human", "screen": "chat" }
     }
   }
   ```
5. Log delivery errors but do not throw — a failed push does not break the insert

**Supabase secrets required (added when Firebase project exists):**
- `FCM_SERVER_KEY` — Firebase service account JSON or legacy server key
- `FCM_PROJECT_ID` — Firebase project ID

### 5. Notification tap handling

On Android, the `MainActivity` reads the `data` payload from the FCM `Intent`. If `screen == "chat"` and `chat_type == "human"`, it navigates to the Human chat route. This is handled in `MainActivity.onCreate` and `onNewIntent`.

On iOS, the `AppDelegate` (or SwiftUI `@main`) reads the notification `userInfo` and calls into the KMP navigation layer via a shared `DeepLinkHandler`.

---

## Data Flow Summary

**Foreground (user on chat screen):**
```
Coach sends → DB insert → Realtime INSERT event → ChatRemoteDataSource emits DTO
→ ChatRepositoryImpl deduplicates → ChatViewModel updates state → UI renders bubble
```

**Background/killed:**
```
Coach sends → DB insert → Database Webhook fires → Edge Function notify-chat-message
→ FCM push to device → OS shows notification → user taps → app opens → navigates to Human chat
→ ChatViewModel.LoadMessages fetches fresh from DB
```

---

## Tests

### `ChatRemoteDataSource`
- `observeNewMessages` emits items collected during the seed window (subscribe-before-fetch ordering verified)
- Retry: on simulated disconnect, subscription restarts and re-fetches since last timestamp
- Channel is cleaned up on flow cancellation

### `ChatRepositoryImpl`
- Deduplication: Realtime echo of an already-seeded message is not emitted twice
- Gap-fill: on reconnect, messages since `lastSeenAt` are fetched and merged
- Optimistic message is replaced when Realtime echo arrives within the match window

### `ChatViewModel`
- `sendText` immediately adds an optimistic message to state
- On Realtime echo, optimistic message is replaced (not duplicated)
- After 3 retries, error state shows reconnecting banner
- `markAllRead` is called on first successful collect

### `DeviceTokenRepository`
- Upsert calls the correct Supabase table with correct platform string
- Returns `Result.failure` on network error without throwing
- No-op when `getToken()` returns `null`

### Edge Function (`notify-chat-message`)
- Given a valid insert payload with `chat_type=human` and `sender_type=coach`, makes FCM call for each token
- Skips notification for `sender_type=user` inserts
- Handles empty `device_tokens` result without error
- Logs but does not rethrow on FCM delivery failure

---

## Deferred Until Firebase Project Exists

- Add `google-services.json` to `composeApp/src/androidMain`
- Add Firebase dependency to `build.gradle.kts`
- Add `GoogleService-Info.plist` to the iOS target
- Set `FCM_SERVER_KEY` and `FCM_PROJECT_ID` Supabase secrets
- Android actual `PushNotificationService` becomes non-stub

Until then: Realtime fix and device token infrastructure are fully functional. Push delivery is a no-op (tokens are `null`, upsert is skipped).
