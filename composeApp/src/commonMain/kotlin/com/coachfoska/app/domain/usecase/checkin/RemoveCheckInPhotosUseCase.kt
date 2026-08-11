package com.coachfoska.app.domain.usecase.checkin

import com.coachfoska.app.domain.repository.CheckInRepository

class RemoveCheckInPhotosUseCase(private val repository: CheckInRepository) {
    suspend operator fun invoke(paths: List<String>): Result<Unit> = repository.removePhotos(paths)
}
