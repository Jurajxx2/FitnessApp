package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.data.remote.dto.ChatMessageDto
import com.coachfoska.app.data.remote.dto.ChatMessageInsertDto
import com.coachfoska.app.domain.model.ChatType
import io.github.aakira.napier.Napier
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.datetime.Instant

private const val TAG = "ChatRemoteDataSource"
private const val TABLE = "chat_messages"
private const val PAGE_SIZE = 50

class ChatRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun fetchMessages(
        userId: String,
        chatType: ChatType,
        limit: Int = PAGE_SIZE,
        offset: Int = 0
    ): List<ChatMessageDto> = supabase.postgrest[TABLE]
        .select {
            filter {
                eq("user_id", userId)
                eq("chat_type", chatType.toDbValue())
            }
            order("created_at", Order.DESCENDING)
            // range(from, to) implements LIMIT + OFFSET
            range(offset.toLong(), (offset + limit - 1).toLong())
        }
        .decodeList<ChatMessageDto>()

    suspend fun insertMessage(dto: ChatMessageInsertDto): ChatMessageDto =
        supabase.postgrest[TABLE]
            .insert(dto) { select() }
            .decodeSingle<ChatMessageDto>()

    suspend fun markRead(userId: String, chatType: ChatType) {
        supabase.postgrest[TABLE].update(
            update = { set("read_at", currentInstant().toString()) },
            request = {
                filter {
                    eq("user_id", userId)
                    eq("chat_type", chatType.toDbValue())
                    filter("read_at", FilterOperator.IS, null)
                }
            }
        )
    }

    suspend fun fetchLatestMessage(userId: String, chatType: ChatType): ChatMessageDto? =
        supabase.postgrest[TABLE]
            .select {
                filter {
                    eq("user_id", userId)
                    eq("chat_type", chatType.toDbValue())
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }
            .decodeList<ChatMessageDto>()
            .firstOrNull()

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

    suspend fun countUnread(userId: String, chatType: ChatType): Int =
        supabase.postgrest[TABLE]
            .select {
                filter {
                    eq("user_id", userId)
                    eq("chat_type", chatType.toDbValue())
                    eq("sender_type", "coach")
                    filter("read_at", FilterOperator.IS, null)
                }
            }
            .decodeList<ChatMessageDto>()
            .size

    /**
     * Opens a Supabase Realtime channel and emits new inserts to [TABLE] for this user.
     * The channel is automatically cleaned up when the Flow collector cancels.
     */
    fun observeNewMessages(userId: String, chatType: ChatType): Flow<ChatMessageDto> = channelFlow {
        val chatTypeStr = chatType.toDbValue()
        val channelName = "chat-$userId-$chatTypeStr"
        val realtimeChannel = supabase.channel(channelName)

        val insertFlow = realtimeChannel.postgresChangeFlow<PostgresAction.Insert>(schema = "public") {
            table = TABLE
            filter("user_id", FilterOperator.EQ, userId)
        }

        try {
            realtimeChannel.subscribe(blockUntilSubscribed = true)
            Napier.d("Realtime subscribed: $channelName", tag = TAG)

            insertFlow.collect { action ->
                try {
                    val dto = action.decodeRecord<ChatMessageDto>()
                    if (dto.chatType == chatTypeStr) {
                        send(dto)
                    }
                } catch (e: Exception) {
                    Napier.e("Failed to decode realtime record", e, tag = TAG)
                }
            }
        } finally {
            realtimeChannel.unsubscribe()
            supabase.realtime.removeChannel(realtimeChannel)
            Napier.d("Realtime unsubscribed: $channelName", tag = TAG)
        }
    }

    private fun ChatType.toDbValue(): String = when (this) {
        ChatType.Human -> "human"
        ChatType.Ai -> "ai"
    }
}
