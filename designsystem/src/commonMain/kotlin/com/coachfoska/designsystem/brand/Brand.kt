package com.coachfoska.designsystem.brand

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.font.FontFamily
import com.coachfoska.designsystem.tokens.DsColors
import com.coachfoska.designsystem.tokens.DsMotion
import com.coachfoska.designsystem.tokens.DsShapes
import com.coachfoska.designsystem.tokens.DsSizes
import com.coachfoska.designsystem.tokens.DsSpacing
import com.coachfoska.designsystem.tokens.DsTypography
import com.coachfoska.designsystem.tokens.DsTypographyDefaults
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.FontResource

/** Font handles; null means platform system font. Resolved to FontFamily inside DsTheme. */
@Immutable
data class BrandFonts(
    val body: FontResource? = null,
    val display: FontResource? = null,
)

/** Brand-supplied visual assets. Paths point into the :designsystem resource tree. */
@Immutable
data class BrandAssets(
    /** Path for Res.readBytes within :designsystem, e.g. "files/barbell_loader.json". */
    val loaderLottiePath: String,
    val logo: DrawableResource? = null,
)

/** Whitelabel-variable copy. Full localization stays in compose resources. */
@Immutable
data class BrandStrings(
    val appName: String,
    val coachName: String,
)

/** Per-brand feature toggles. Enforcement (hiding tabs/routes) lives in the app layer. */
@Immutable
data class BrandFeatures(
    val hydration: Boolean = true,
    val aiCoach: Boolean = true,
    val recipes: Boolean = true,
    val chat: Boolean = true,
    val activityLogging: Boolean = true,
)

/**
 * The whitelabel boundary: one implementation per brand. Adding a brand =
 * one object + a BrandRegistry entry + app icon/name flavor wiring.
 */
interface Brand {
    val id: String
    val lightColors: DsColors
    val darkColors: DsColors
    val fonts: BrandFonts
    val shapes: DsShapes
    val spacing: DsSpacing
    val sizes: DsSizes
    val motion: DsMotion
    val assets: BrandAssets
    val strings: BrandStrings
    val features: BrandFeatures

    /** Override to reshape the ramp; fontFamily comes pre-resolved from BrandFonts. */
    fun typography(fontFamily: FontFamily?): DsTypography = DsTypographyDefaults.default(fontFamily)
}
