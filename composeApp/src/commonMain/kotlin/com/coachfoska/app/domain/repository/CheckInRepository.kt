package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.CheckIn
import kotlinx.datetime.LocalDate

interface CheckInRepository {
    suspend fun submit(checkIn: CheckIn): Result<CheckIn>
    suspend fun getHistory(userId: String): Result<List<CheckIn>>
    suspend fun getForWeek(userId: String, weekOf: LocalDate): Result<CheckIn?>
    suspend fun uploadPhoto(userId: String, weekOf: LocalDate, slot: String, bytes: ByteArray): Result<String>
    suspend fun removePhotos(paths: List<String>): Result<Unit>
    suspend fun signedPhotoUrl(path: String): Result<String>
}
