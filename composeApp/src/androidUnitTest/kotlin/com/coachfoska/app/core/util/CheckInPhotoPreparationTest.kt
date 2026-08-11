package com.coachfoska.app.core.util

import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals

class CheckInPhotoPreparationTest {

    @Test
    fun `photo dimensions preserve aspect ratio and bound the long edge`() {
        assertEquals(ImageDimensions(2_000, 1_500), fitCheckInPhotoDimensions(4_000, 3_000))
        assertEquals(ImageDimensions(800, 600), fitCheckInPhotoDimensions(800, 600))
    }

    @Test
    fun `legacy Android decode samples large images before allocating pixels`() {
        assertEquals(1, calculateCheckInDecodeSampleSize(2_000, 1_500))
        assertEquals(4, calculateCheckInDecodeSampleSize(12_000, 9_000))
        assertEquals(16, calculateCheckInDecodeSampleSize(48_000, 36_000))
    }

    @Test
    fun `Prague check-in week crosses Monday after spring DST transition`() {
        assertEquals(
            "2026-03-23",
            currentCheckInWeekMonday(Instant.parse("2026-03-29T21:30:00Z")).toString(),
        )
        assertEquals(
            "2026-03-30",
            currentCheckInWeekMonday(Instant.parse("2026-03-29T22:30:00Z")).toString(),
        )
    }

    @Test
    fun `Prague check-in week crosses Monday after autumn DST transition`() {
        assertEquals(
            "2026-10-19",
            currentCheckInWeekMonday(Instant.parse("2026-10-25T22:30:00Z")).toString(),
        )
        assertEquals(
            "2026-10-26",
            currentCheckInWeekMonday(Instant.parse("2026-10-25T23:30:00Z")).toString(),
        )
    }
}
