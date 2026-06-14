package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.OnboardingResponseDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest

class OnboardingRemoteDataSource(private val supabase: SupabaseClient) {

    suspend fun upsertResponse(dto: OnboardingResponseDto) {
        supabase.postgrest["onboarding_responses"]
            .upsert(dto) { onConflict = "user_id" }
    }
}
