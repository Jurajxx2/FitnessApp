package com.coachfoska.app.theme

import androidx.compose.ui.unit.dp

// Fixed spacing scale (spec §2.2) — reference these everywhere; no ad-hoc dp values.
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
}

object Sizes {
    /** Accessibility floor: minimum touch target (spec §7). */
    val touchTarget = 48.dp
}
