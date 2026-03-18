package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.data.remote.dto.WeightEntryDto
import com.coachfoska.app.data.remote.dto.WeightEntryInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.datetime.LocalDate

class UserRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun getProfile(userId: String): UserDto =
        supabase.postgrest["profiles"]
            .select {
                filter { eq("id", userId) }
            }
            .decodeSingle<UserDto>()

    suspend fun upsertProfile(dto: UserDto) {
        supabase.postgrest["profiles"]
            .upsert(dto) { onConflict = "id" }
    }

    suspend fun getWeightHistory(userId: String): List<WeightEntryDto> =
        supabase.postgrest["weight_entries"]
            .select {
                filter { eq("user_id", userId) }
                order("recorded_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }
            .decodeList<WeightEntryDto>()

    suspend fun insertWeightEntry(
        userId: String,
        weightKg: Float,
        date: LocalDate,
        notes: String?
    ): WeightEntryDto {
        val payload = WeightEntryInsertDto(
            userId = userId,
            weightKg = weightKg,
            recordedAt = date.toString(),
            notes = notes
        )
        return supabase.postgrest["weight_entries"]
            .insert(payload) { select() }
            .decodeSingle<WeightEntryDto>()
    }
}
