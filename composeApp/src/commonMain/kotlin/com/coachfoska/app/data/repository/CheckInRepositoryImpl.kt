package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.CheckInRemoteDataSource
import com.coachfoska.app.data.remote.dto.CheckInUpsertDto
import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.repository.CheckInRepository
import kotlinx.datetime.LocalDate

class CheckInRepositoryImpl(
    private val dataSource: CheckInRemoteDataSource,
) : CheckInRepository {

    override suspend fun submit(checkIn: CheckIn): Result<CheckIn> = runCatching {
        val dto = CheckInUpsertDto(
            userId = checkIn.userId,
            weekOf = checkIn.weekOf.toString(),
            weightKg = checkIn.weightKg,
            energyLevel = checkIn.energyLevel,
            sleepQuality = checkIn.sleepQuality,
            stressLevel = checkIn.stressLevel,
            trainingAdherence = checkIn.trainingAdherence,
            nutritionAdherence = checkIn.nutritionAdherence,
            notes = checkIn.notes,
            photoFrontPath = checkIn.photoFrontPath,
            photoSidePath = checkIn.photoSidePath,
        )
        dataSource.upsert(dto).toDomain()
    }

    override suspend fun getHistory(userId: String): Result<List<CheckIn>> = runCatching {
        dataSource.getHistory(userId).map { it.toDomain() }
    }

    override suspend fun getForWeek(userId: String, weekOf: LocalDate): Result<CheckIn?> = runCatching {
        dataSource.getForWeek(userId, weekOf.toString())?.toDomain()
    }

    override suspend fun uploadPhoto(userId: String, weekOf: LocalDate, slot: String, bytes: ByteArray): Result<String> = runCatching {
        dataSource.uploadPhoto(weekOf.toString(), slot, bytes)
    }

    override suspend fun signedPhotoUrl(path: String): Result<String> = runCatching {
        dataSource.signedPhotoUrl(path)
    }
}
