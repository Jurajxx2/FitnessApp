package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.repository.CheckInRepository

class GetCheckInHistoryUseCase(private val repository: CheckInRepository) {
    suspend operator fun invoke(userId: String): Result<List<CheckIn>> =
        repository.getHistory(userId)
}
