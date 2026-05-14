package com.coachfoska.app.core.util

import kotlinx.datetime.Instant
import platform.Foundation.NSDate
import platform.Foundation.timeIntervalSince1970

actual fun currentInstant(): Instant =
    Instant.fromEpochMilliseconds((NSDate().timeIntervalSince1970 * 1000).toLong())
