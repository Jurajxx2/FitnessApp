package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.repository.CheckInRepository
import com.coachfoska.app.domain.repository.UserRepository

class SubmitCheckInUseCase(
    private val checkInRepository: CheckInRepository,
    private val userRepository: UserRepository,
) {
    suspend operator fun invoke(checkIn: CheckIn): Result<CheckIn> {
        val submitted = checkInRepository.submit(checkIn)
        // Mirror weight into weight_entries so the Progress chart stays in sync. Best-effort.
        val weight = checkIn.weightKg
        if (submitted.isSuccess && weight != null) {
            userRepository.logWeight(checkIn.userId, weight, checkIn.weekOf, null)
        }
        return submitted
    }
}
