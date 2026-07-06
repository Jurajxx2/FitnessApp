package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class DsSizes(
    /** Accessibility floor: minimum touch target. */
    val touchTarget: Dp = 48.dp,
    val buttonHeight: Dp = 56.dp,
    val buttonHeightCompact: Dp = 48.dp,
    val iconLarge: Dp = 48.dp,
)
