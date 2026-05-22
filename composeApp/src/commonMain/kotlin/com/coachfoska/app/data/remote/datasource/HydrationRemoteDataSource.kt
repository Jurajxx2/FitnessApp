package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.data.remote.dto.HydrationSettingsDto
import com.coachfoska.app.data.remote.dto.WaterContainerDto
import com.coachfoska.app.data.remote.dto.WaterContainerFavoriteUpdateDto
import com.coachfoska.app.data.remote.dto.WaterContainerInsertDto
import com.coachfoska.app.data.remote.dto.WaterLogDto
import com.coachfoska.app.data.remote.dto.WaterLogInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.plus

class HydrationRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun insertWaterLog(userId: String, amountMl: Int): WaterLogDto {
        val payload = WaterLogInsertDto(
            userId = userId,
            amountMl = amountMl,
            loggedAt = currentInstant().toString()
        )
        return supabase.postgrest["water_logs"]
            .insert(payload) { select() }
            .decodeSingle<WaterLogDto>()
    }

    suspend fun getTodayLogs(userId: String): List<WaterLogDto> {
        val today = todayDate()
        val tomorrow = today.plus(1, DateTimeUnit.DAY)
        return supabase.postgrest["water_logs"]
            .select {
                filter {
                    eq("user_id", userId)
                    gte("logged_at", "${today}T00:00:00Z")
                    lt("logged_at", "${tomorrow}T00:00:00Z")
                }
                order("logged_at", Order.DESCENDING)
            }
            .decodeList<WaterLogDto>()
    }

    suspend fun deleteLog(logId: String) {
        supabase.postgrest["water_logs"]
            .delete { filter { eq("id", logId) } }
    }

    suspend fun getSettings(userId: String): HydrationSettingsDto? =
        supabase.postgrest["hydration_settings"]
            .select { filter { eq("user_id", userId) } }
            .decodeList<HydrationSettingsDto>()
            .firstOrNull()

    suspend fun upsertSettings(dto: HydrationSettingsDto) {
        supabase.postgrest["hydration_settings"]
            .upsert(dto) { onConflict = "user_id" }
    }

    suspend fun listContainers(userId: String): List<WaterContainerDto> =
        supabase.postgrest["water_containers"]
            .select {
                filter { eq("user_id", userId) }
                order("is_favorite", Order.DESCENDING)
                order("created_at",  Order.DESCENDING)
            }
            .decodeList<WaterContainerDto>()

    suspend fun insertContainer(
        userId: String,
        name: String,
        volumeMl: Int,
        iconName: String = "bottle",
    ): WaterContainerDto =
        supabase.postgrest["water_containers"]
            .insert(
                WaterContainerInsertDto(
                    userId = userId, name = name, volumeMl = volumeMl, iconName = iconName,
                ),
            ) { select() }
            .decodeSingle<WaterContainerDto>()

    suspend fun deleteContainer(containerId: String) {
        supabase.postgrest["water_containers"]
            .delete { filter { eq("id", containerId) } }
    }

    suspend fun setContainerFavorite(containerId: String, isFavorite: Boolean): WaterContainerDto =
        supabase.postgrest["water_containers"]
            .update(WaterContainerFavoriteUpdateDto(isFavorite)) {
                filter { eq("id", containerId) }
                select()
            }
            .decodeSingle<WaterContainerDto>()
}
