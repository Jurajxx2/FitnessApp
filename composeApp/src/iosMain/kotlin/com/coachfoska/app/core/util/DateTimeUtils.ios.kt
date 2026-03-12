package com.coachfoska.app.core.util

import kotlinx.datetime.Instant
import platform.Foundation.NSDate

actual fun currentInstant(): Instant =
    Instant.fromEpochMilliseconds((NSDate.date().timeIntervalSince1970 * 1000).toLong())
