package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.OnboardingData

interface OnboardingRepository {
    suspend fun saveResponses(userId: String, data: OnboardingData): Result<Unit>
}
