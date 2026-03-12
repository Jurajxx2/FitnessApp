package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.UserRepository
import kotlinx.datetime.LocalDate

class LogWeightUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(
        userId: String,
        weightKg: Float,
        date: LocalDate,
        notes: String? = null
    ): Result<WeightEntry> = userRepository.logWeight(userId, weightKg, date, notes)
}
