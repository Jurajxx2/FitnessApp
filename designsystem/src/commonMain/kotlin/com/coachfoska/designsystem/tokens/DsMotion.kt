package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable

@Immutable
data class DsMotion(
    val durationShortMs: Int = 150,
    val durationMediumMs: Int = 300,
    val durationLongMs: Int = 700,
    val shimmerCycleMs: Int = 1100,
)
