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
