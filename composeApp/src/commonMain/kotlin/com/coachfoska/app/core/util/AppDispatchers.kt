package com.coachfoska.app.core.util

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

object AppDispatchers {
    val io: CoroutineDispatcher = Dispatchers.Default   // Dispatchers.IO not available in KMP; use Default for IO work
    val main: CoroutineDispatcher = Dispatchers.Main
    val default: CoroutineDispatcher = Dispatchers.Default
}
