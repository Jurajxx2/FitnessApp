package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.OnboardingRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.OnboardingResponseDto
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.domain.model.OnboardingData
import com.coachfoska.app.domain.repository.OnboardingRepository

class OnboardingRepositoryImpl(
    private val onboardingDataSource: OnboardingRemoteDataSource,
    private val userDataSource: UserRemoteDataSource
) : OnboardingRepository {

    override suspend fun saveResponses(userId: String, data: OnboardingData): Result<Unit> =
        runCatching {
            // 1. Persist the full quiz answer set.
            onboardingDataSource.upsertResponse(OnboardingResponseDto.fromDomain(userId, data))

            // 2. Mirror canonical fields into profiles so the rest of the app + admin see them.
            val existing = runCatching { userDataSource.getProfile(userId) }
                .getOrElse { UserDto(id = userId, email = "") }
            val updated = existing.copy(
                fullName = data.name.ifBlank { existing.fullName },
                age = data.age,
                heightCm = data.heightCm.toFloat(),
                weightKg = data.weightKg,
                goal = data.goal?.name?.lowercase() ?: existing.goal,
                onboardingComplete = true
            )
            userDataSource.upsertProfile(updated)
        }
}
