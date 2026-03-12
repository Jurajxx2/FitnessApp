package com.coachfoska.app.core.util

import kotlinx.datetime.Instant

actual fun currentInstant(): Instant =
    Instant.fromEpochMilliseconds(java.lang.System.currentTimeMillis())
