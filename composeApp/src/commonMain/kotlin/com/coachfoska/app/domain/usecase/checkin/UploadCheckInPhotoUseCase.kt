package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.repository.CheckInRepository
import kotlinx.datetime.LocalDate

class UploadCheckInPhotoUseCase(private val repository: CheckInRepository) {
    suspend operator fun invoke(userId: String, weekOf: LocalDate, slot: String, bytes: ByteArray): Result<String> =
        repository.uploadPhoto(userId, weekOf, slot, bytes)
}
