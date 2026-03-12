package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WeightEntry
import kotlinx.datetime.LocalDate

interface UserRepository {
    suspend fun getProfile(userId: String): Result<User>

    suspend fun updateProfile(
        userId: String,
        fullName: String? = null,
        age: Int? = null,
        heightCm: Float? = null,
        weightKg: Float? = null,
        goal: UserGoal? = null,
        activityLevel: ActivityLevel? = null
    ): Result<User>

    suspend fun completeOnboarding(
        userId: String,
        goal: UserGoal,
        heightCm: Float,
        weightKg: Float,
        age: Int,
        activityLevel: ActivityLevel
    ): Result<Unit>

    suspend fun getWeightHistory(userId: String): Result<List<WeightEntry>>

    suspend fun logWeight(
        userId: String,
        weightKg: Float,
        date: LocalDate,
        notes: String? = null
    ): Result<WeightEntry>
}
