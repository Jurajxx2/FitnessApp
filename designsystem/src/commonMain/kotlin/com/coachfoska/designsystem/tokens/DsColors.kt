package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Semantic color tokens. Components and screens read ONLY these -
 * never raw hex values, never Material color roles directly.
 */
@Immutable
data class DsColors(
    // Surfaces
    val background: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val surfaceHighest: Color,
    // Text
    val textPrimary: Color,
    val textSecondary: Color,
    /** Accent-colored text. Reserve for large/bold usage - AA large-text (3:1) is the floor. */
    val textAccent: Color,
    // Brand accent (icons, fills, large numerals)
    val accent: Color,
    val onAccent: Color,
    // Action surfaces (buttons). Distinct from accent: Foska actions are black/white.
    val actionPrimary: Color,
    val onActionPrimary: Color,
    val actionSecondary: Color,
    val onActionSecondary: Color,
    // Status
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningStrong: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val error: Color,
    val onError: Color,
    val errorSoft: Color,
    // Borders
    val outline: Color,
    val outlineSubtle: Color,
    // Data-viz
    val chartLine: Color,
    val chartFill: Color,
    val chartGrid: Color,
    val categorical: List<Color>,
    val categoricalFallback: Color,
    // Loading
    val shimmerBase: Color,
    val shimmerHighlight: Color,
) {
    /** Stable categorical color for a label (e.g. muscle group). */
    fun categoricalFor(label: String?): Color {
        if (label.isNullOrBlank()) return categoricalFallback
        val idx = label.lowercase().hashCode().mod(categorical.size)
        return categorical[idx]
    }
}
