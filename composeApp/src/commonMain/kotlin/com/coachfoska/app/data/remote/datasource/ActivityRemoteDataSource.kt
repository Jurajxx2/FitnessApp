package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.GeneralActivityLogDto
import com.coachfoska.app.data.remote.dto.GeneralActivityLogInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order

class ActivityRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun insertActivity(payload: GeneralActivityLogInsertDto): GeneralActivityLogDto =
        supabase.postgrest["general_activity_logs"]
            .insert(payload) { select() }
            .decodeSingle<GeneralActivityLogDto>()

    suspend fun getHistory(userId: String): List<GeneralActivityLogDto> =
        supabase.postgrest["general_activity_logs"]
            .select {
                filter { eq("user_id", userId) }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<GeneralActivityLogDto>()
}
