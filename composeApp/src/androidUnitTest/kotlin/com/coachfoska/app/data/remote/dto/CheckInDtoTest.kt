package com.coachfoska.app.data.remote.dto

import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

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
    }
}
