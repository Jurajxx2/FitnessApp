package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.UserRepository
import kotlinx.datetime.LocalDate

class UserRepositoryImpl(
    private val userDataSource: UserRemoteDataSource
) : UserRepository {

    override suspend fun getProfile(userId: String): Result<User> = runCatching {
        userDataSource.getProfile(userId).toDomain()
    }

    override suspend fun updateProfile(
        userId: String,
        fullName: String?,
        age: Int?,
        heightCm: Float?,
        weightKg: Float?,
        goal: UserGoal?,
        activityLevel: ActivityLevel?
    ): Result<User> = runCatching {
        val existing = runCatching { userDataSource.getProfile(userId) }.getOrElse {
            UserDto(id = userId, email = "")
        }
        val updated = existing.copy(
            fullName = fullName ?: existing.fullName,
            age = age ?: existing.age,
            heightCm = heightCm ?: existing.heightCm,
            weightKg = weightKg ?: existing.weightKg,
            goal = goal?.name?.lowercase() ?: existing.goal,
            activityLevel = activityLevel?.name?.lowercase() ?: existing.activityLevel
        )
        userDataSource.upsertProfile(updated)
        userDataSource.getProfile(userId).toDomain()
    }

    override suspend fun completeOnboarding(
        userId: String,
        goal: UserGoal,
        heightCm: Float,
        weightKg: Float,
        age: Int,
        activityLevel: ActivityLevel
    ): Result<Unit> = runCatching {
        val existing = runCatching { userDataSource.getProfile(userId) }.getOrElse {
            UserDto(id = userId, email = "")
        }
        val updated = existing.copy(
            goal = goal.name.lowercase(),
            heightCm = heightCm,
            weightKg = weightKg,
            age = age,
            activityLevel = activityLevel.name.lowercase(),
            onboardingComplete = true
        )
        userDataSource.upsertProfile(updated)
        Unit
    }

    override suspend fun getWeightHistory(userId: String): Result<List<WeightEntry>> = runCatching {
        userDataSource.getWeightHistory(userId).map { it.toDomain() }
    }

    override suspend fun logWeight(
        userId: String,
        weightKg: Float,
        date: LocalDate,
        notes: String?
    ): Result<WeightEntry> = runCatching {
        userDataSource.insertWeightEntry(userId, weightKg, date, notes).toDomain()
    }
}
