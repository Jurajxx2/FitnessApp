package com.coachfoska.app.data.remote.dto

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CheckInDtoTest {

    @Test
    fun `toDomain maps all fields`() {
        val dto = CheckInDto(
            id = "ci-1", userId = "u-1", weekOf = "2026-07-06",
            weightKg = 74.5f, energyLevel = 4, sleepQuality = 3, stressLevel = 2,
            trainingAdherence = 3, nutritionAdherence = 5, notes = "felt strong",
            photoFrontPath = "u-1/front.jpg", photoSidePath = null,
            coachResponse = "great work", coachResponseAt = "2026-07-07T09:00:00Z",
            createdAt = "2026-07-06T08:00:00Z",
        )

        val domain = dto.toDomain()

        assertEquals("ci-1", domain.id)
        assertEquals(LocalDate.parse("2026-07-06"), domain.weekOf)
        assertEquals(74.5f, domain.weightKg)
        assertEquals(4, domain.energyLevel)
        assertEquals("felt strong", domain.notes)
        assertEquals("u-1/front.jpg", domain.photoFrontPath)
        assertNull(domain.photoSidePath)
        assertEquals("great work", domain.coachResponse)
        assertEquals("u-1", domain.userId)
        assertEquals(3, domain.sleepQuality)
        assertEquals(2, domain.stressLevel)
        assertEquals(3, domain.trainingAdherence)
        assertEquals(5, domain.nutritionAdherence)
        assertEquals(Instant.parse("2026-07-07T09:00:00Z"), domain.coachResponseAt)
        assertEquals(Instant.parse("2026-07-06T08:00:00Z"), domain.createdAt)
    }

    @Test
    fun `toDomain leaves null timestamps null`() {
        val dto = CheckInDto(
            id = "ci-2", userId = "u-1", weekOf = "2026-07-06",
            coachResponseAt = null, createdAt = null,
        )
        val domain = dto.toDomain()
        assertNull(domain.coachResponseAt)
        assertNull(domain.createdAt)
    }

    @Test
    fun `CheckInUpsertDto serializes cleared fields as explicit nulls`() {
        val dto = CheckInUpsertDto(
            userId = "u-1", weekOf = "2026-07-06",
            weightKg = null, energyLevel = 4, sleepQuality = 3, stressLevel = 2,
            trainingAdherence = 3, nutritionAdherence = 5, notes = null,
            photoFrontPath = "u-1/front.jpg", photoSidePath = null,
        )

        val encoded = Json.encodeToString(dto)

        assertTrue(encoded.contains("\"notes\":null"), "expected explicit null for notes in: $encoded")
        assertTrue(encoded.contains("\"weight_kg\":null"), "expected explicit null for weight_kg in: $encoded")
        assertTrue(encoded.contains("\"photo_side_path\":null"), "expected explicit null for photo_side_path in: $encoded")
    }
}
