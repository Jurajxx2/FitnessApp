package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.data.remote.dto.WeightEntryDto
import com.coachfoska.app.data.remote.dto.WeightEntryInsertDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.datetime.LocalDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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

    // Dedicated method to avoid the encodeDefaults issue — a full-object upsert would
    // omit `onboarding_complete = false` when the Json serializer has encodeDefaults=false.
    suspend fun setOnboardingComplete(userId: String, complete: Boolean) {
        supabase.postgrest["profiles"]
            .update(OnboardingCompleteUpdate(complete)) {
                filter { eq("id", userId) }
            }
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

@Serializable
private data class OnboardingCompleteUpdate(
    @SerialName("onboarding_complete") val onboardingComplete: Boolean
)
