package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.repository.CheckInRepository
import kotlinx.datetime.LocalDate

class GetCurrentWeekCheckInUseCase(private val repository: CheckInRepository) {
    suspend operator fun invoke(userId: String, weekOf: LocalDate): Result<CheckIn?> =
        repository.getForWeek(userId, weekOf)
}
