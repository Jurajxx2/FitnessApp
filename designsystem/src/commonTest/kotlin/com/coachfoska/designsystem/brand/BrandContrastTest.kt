package com.coachfoska.designsystem.brand

import androidx.compose.ui.graphics.Color
import com.coachfoska.designsystem.tokens.DsColors
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * WCAG contrast guardrail: a whitelabel palette that fails accessibility
 * fails the build. Thresholds: 4.5:1 (AA normal text) for text/action/error
 * pairs; 3.0:1 (AA large text) for textAccent, which is reserved for
 * large/bold usage.
 */
class BrandContrastTest {

    @Test
    fun everyRegisteredBrandMeetsContrastFloors() {
        BrandRegistry.all.forEach { brand ->
            checkScheme("${brand.id}/light", brand.lightColors)
            checkScheme("${brand.id}/dark", brand.darkColors)
        }
    }

    private fun checkScheme(name: String, c: DsColors) {
        assertAtLeast(name, "textPrimary/background", c.textPrimary, c.background, 4.5)
        assertAtLeast(name, "textSecondary/background", c.textSecondary, c.background, 4.5)
        assertAtLeast(name, "textPrimary/surface", c.textPrimary, c.surface, 4.5)
        assertAtLeast(name, "onActionPrimary/actionPrimary", c.onActionPrimary, c.actionPrimary, 4.5)
        assertAtLeast(name, "onAccent/accent", c.onAccent, c.accent, 4.5)
        assertAtLeast(name, "onError/error", c.onError, c.error, 4.5)
        assertAtLeast(name, "textAccent/background", c.textAccent, c.background, 3.0)
    }

    private fun assertAtLeast(scheme: String, pair: String, fg: Color, bg: Color, floor: Double) {
        val ratio = contrastRatio(fg, bg)
        assertTrue(
            ratio >= floor,
            "$scheme $pair contrast is ${(ratio * 100).toInt() / 100.0}, needs >= $floor"
        )
    }

    private fun contrastRatio(a: Color, b: Color): Double {
        val la = relativeLuminance(a)
        val lb = relativeLuminance(b)
        val lighter = maxOf(la, lb)
        val darker = minOf(la, lb)
        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun relativeLuminance(c: Color): Double {
        fun channel(v: Float): Double {
            val d = v.toDouble()
            return if (d <= 0.03928) d / 12.92 else ((d + 0.055) / 1.055).pow(2.4)
        }
        return 0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue)
    }
}
