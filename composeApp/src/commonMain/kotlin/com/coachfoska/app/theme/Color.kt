package com.coachfoska.app.theme

import androidx.compose.ui.graphics.Color

// Coach Foska brand palette — black/white/red minimalism

// Primary — Deep Red (from coachfoska.com)
val BrandRed = Color(0xFFA90707)
val BrandRedLight = Color(0xFFCF2E2E)
val BrandRedDark = Color(0xFF7A0505)

// Neutrals — Pure black/white with grays
val Black = Color(0xFF000000)
val White = Color(0xFFFFFFFF)
val Gray50 = Color(0xFFFAFAFA)
val Gray100 = Color(0xFFF5F5F5)
val Gray200 = Color(0xFFEEEEEE)
val Gray300 = Color(0xFFE0E0E0)
val Gray400 = Color(0xFFBDBDBD)
val Gray500 = Color(0xFF9E9E9E)
val Gray600 = Color(0xFF757575)
val Gray700 = Color(0xFF444444)
val Gray800 = Color(0xFF32373C)
val Gray900 = Color(0xFF1A1A1A)
val Gray950 = Color(0xFF0F0F0F)

// Functional
val Success = Color(0xFF2E7D32)
val Error = Color(0xFFCF2E2E)

// Functional (extended)
val Warning = Color(0xFFF9A825)

// Text accent — BrandRed fails AA for small text on black (~2.4:1).
// Use TextAccent for red text; reserve BrandRed for icons, fills and large numerals.
val TextAccent = BrandRedLight

// Data-viz roles (spec §2.2) — one chart recipe across Dashboard and Me.
val ChartLine = BrandRed
val ChartFill = Color(0x26A90707) // BrandRed @ 15%
val ChartGrid = Color(0x14FFFFFF) // white @ 8%

// Muscle-group category colors — muted, distinguishable on black.
private val MuscleGroupPalette = listOf(
    Color(0xFFCF2E2E), // red     — chest
    Color(0xFF5B8DEF), // blue    — back
    Color(0xFFE3A13B), // amber   — legs
    Color(0xFF58B368), // green   — shoulders
    Color(0xFFB06AC9), // purple  — arms
    Color(0xFF4FB6C4), // teal    — core
)

fun muscleGroupColor(label: String?): Color {
    if (label.isNullOrBlank()) return Gray500
    val idx = label.lowercase().hashCode().mod(MuscleGroupPalette.size)
    return MuscleGroupPalette[idx]
}
