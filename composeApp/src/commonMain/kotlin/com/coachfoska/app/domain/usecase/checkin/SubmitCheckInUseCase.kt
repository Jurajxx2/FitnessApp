package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.repository.CheckInRepository
import com.coachfoska.app.domain.repository.UserRepository

class SubmitCheckInUseCase(
    private val checkInRepository: CheckInRepository,
    private val userRepository: UserRepository,
) {
    suspend operator fun invoke(checkIn: CheckIn): Result<CheckIn> {
        val previousWeight = checkInRepository.getForWeek(checkIn.userId, checkIn.weekOf)
            .getOrNull()
            ?.weightKg
        val submitted = checkInRepository.submit(checkIn)
        // Mirror weight into weight_entries so the Progress chart stays in sync. Best-effort:
        // only log when the weight actually changed, so editing other fields on an existing
        // check-in doesn't re-insert a duplicate weight_entries row.
        val weight = checkIn.weightKg
        if (submitted.isSuccess && weight != null && weight != previousWeight) {
            runCatching { userRepository.logWeight(checkIn.userId, weight, checkIn.weekOf, null) }
        }
        return submitted
    }
}
