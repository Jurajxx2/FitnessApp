package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.UserRepository

class GetWeightHistoryUseCase(private val userRepository: UserRepository) {
    suspend operator fun invoke(userId: String): Result<List<WeightEntry>> =
        userRepository.getWeightHistory(userId)
}
