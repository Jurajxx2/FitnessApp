package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.AppConfigDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest

class AppConfigRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getAllConfig(): Map<String, String> =
        supabase.postgrest["app_config"]
            .select()
            .decodeList<AppConfigDto>()
            .associate { it.key to it.value }
}
