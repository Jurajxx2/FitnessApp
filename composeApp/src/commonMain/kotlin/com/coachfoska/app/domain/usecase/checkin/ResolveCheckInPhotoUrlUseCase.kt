package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.repository.CheckInRepository

class ResolveCheckInPhotoUrlUseCase(private val repository: CheckInRepository) {
    suspend operator fun invoke(path: String): Result<String> =
        repository.signedPhotoUrl(path)
}
