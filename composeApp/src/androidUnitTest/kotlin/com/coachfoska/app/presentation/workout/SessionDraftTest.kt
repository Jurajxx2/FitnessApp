package com.coachfoska.app.presentation.workout

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Pure timing math for the durable exercise stopwatch. These assertions carry the precision the
 * ViewModel tests deliberately avoid (the real clock only advances microseconds inside a test),
 * so the wall-clock fold is exercised here with an explicit `now`.
 */
class SessionDraftTest {

    @Test
    fun `paused timer (null anchor) returns the baseline unchanged`() {
        assertEquals(42, currentElapsedSeconds(baselineSeconds = 42, startedAtEpochMillis = null, nowEpochMillis = 10_000_000))
    }

    @Test
    fun `null baseline while paused reads as zero`() {
        assertEquals(0, currentElapsedSeconds(baselineSeconds = null, startedAtEpochMillis = null, nowEpochMillis = 10_000_000))
    }

    @Test
    fun `running timer advances by the wall-clock delta on top of the baseline`() {
        val start = 1_000_000L
        // 30s of wall-clock elapsed since the anchor, folded onto a 10s baseline.
        assertEquals(40, currentElapsedSeconds(baselineSeconds = 10, startedAtEpochMillis = start, nowEpochMillis = start + 30_000))
    }

    @Test
    fun `running timer with null baseline counts pure wall-clock elapsed`() {
        val start = 5_000_000L
        assertEquals(30, currentElapsedSeconds(baselineSeconds = null, startedAtEpochMillis = start, nowEpochMillis = start + 30_500))
    }

    @Test
    fun `a large now-gap (simulated background) yields the full larger elapsed`() {
        val start = 0L
        // App backgrounded for 10 minutes on top of a 15s baseline — must reflect real time.
        assertEquals(615, currentElapsedSeconds(baselineSeconds = 15, startedAtEpochMillis = start, nowEpochMillis = start + 600_000))
    }

    @Test
    fun `a now earlier than the anchor never produces a negative elapsed`() {
        val start = 1_000_000L
        // Clock skew / anchor in the future must clamp the delta at zero, not subtract from baseline.
        assertEquals(20, currentElapsedSeconds(baselineSeconds = 20, startedAtEpochMillis = start, nowEpochMillis = start - 5_000))
    }

    @Test
    fun `sub-second elapsed truncates toward the completed second`() {
        val start = 2_000_000L
        assertEquals(0, currentElapsedSeconds(baselineSeconds = 0, startedAtEpochMillis = start, nowEpochMillis = start + 999))
        assertEquals(1, currentElapsedSeconds(baselineSeconds = 0, startedAtEpochMillis = start, nowEpochMillis = start + 1_000))
    }

    @Test
    fun `folding a same-second run with no baseline yields null, not a 0-second set`() {
        val start = 3_000_000L
        // Start then complete/pause within the same wall-clock second, with nothing recorded yet:
        // persisting a literal 0 would create a meaningless timed set, so it must drop back to null.
        assertNull(foldedDurationSeconds(baselineSeconds = null, startedAtEpochMillis = start, nowEpochMillis = start + 400))
    }

    @Test
    fun `folding real elapsed with no baseline keeps the counted seconds`() {
        val start = 3_000_000L
        assertEquals(30, foldedDurationSeconds(baselineSeconds = null, startedAtEpochMillis = start, nowEpochMillis = start + 30_000))
    }

    @Test
    fun `folding a same-second run onto a non-null baseline preserves that baseline`() {
        val start = 3_000_000L
        // A prior baseline (even 0) is a real recorded value, so it is never dropped to null.
        assertEquals(30, foldedDurationSeconds(baselineSeconds = 30, startedAtEpochMillis = start, nowEpochMillis = start + 400))
        assertEquals(0, foldedDurationSeconds(baselineSeconds = 0, startedAtEpochMillis = start, nowEpochMillis = start + 400))
    }
}
