package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.ActivityType
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ActivityDtoTest {

    @Test
    fun `toDomain maps every ActivityType string`() {
        ActivityType.entries.forEach { type ->
            val dto = GeneralActivityLogDto(
                id = "id",
                userId = "u",
                activityType = type.name,
                durationMinutes = 30,
                distanceKm = null,
                rpe = null,
                loggedAt = "2026-05-21T10:00:00Z",
                notes = null,
            )
            assertEquals(type, dto.toDomain().type)
        }
    }

    @Test
    fun `toDomain unknown activity_type falls back to OTHER`() {
        val dto = GeneralActivityLogDto(
            id = "id", userId = "u", activityType = "PADEL",
            durationMinutes = 30, distanceKm = null, rpe = null,
            loggedAt = "2026-05-21T10:00:00Z", notes = null,
        )
        assertEquals(ActivityType.OTHER, dto.toDomain().type)
    }

    @Test
    fun `toDomain preserves optional fields`() {
        val dto = GeneralActivityLogDto(
            id = "id-1", userId = "u-1", activityType = "RUNNING",
            durationMinutes = 45, distanceKm = 7.5, rpe = 8,
            loggedAt = "2026-05-21T10:00:00Z", notes = "hilly route",
        )
        val domain = dto.toDomain()
        assertEquals("id-1", domain.id)
        assertEquals("u-1", domain.userId)
        assertEquals(45, domain.durationMinutes)
        assertEquals(7.5, domain.distanceKm)
        assertEquals(8, domain.rpe)
        assertEquals(Instant.parse("2026-05-21T10:00:00Z"), domain.loggedAt)
        assertEquals("hilly route", domain.notes)
    }

    @Test
    fun `toDomain treats nulls as null`() {
        val dto = GeneralActivityLogDto(
            id = "id", userId = "u", activityType = "YOGA",
            durationMinutes = 60, distanceKm = null, rpe = null,
            loggedAt = "2026-05-21T10:00:00Z", notes = null,
        )
        val domain = dto.toDomain()
        assertNull(domain.distanceKm)
        assertNull(domain.rpe)
        assertNull(domain.notes)
    }
}
