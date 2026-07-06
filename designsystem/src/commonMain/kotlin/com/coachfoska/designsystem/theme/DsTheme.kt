package com.coachfoska.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.font.FontFamily
import com.coachfoska.designsystem.brand.Brand
import com.coachfoska.designsystem.brand.BrandAssets
import com.coachfoska.designsystem.brand.BrandFeatures
import com.coachfoska.designsystem.brand.BrandStrings
import com.coachfoska.designsystem.brand.foska.FoskaBrand
import com.coachfoska.designsystem.tokens.DsColors
import com.coachfoska.designsystem.tokens.DsMotion
import com.coachfoska.designsystem.tokens.DsShapes
import com.coachfoska.designsystem.tokens.DsSizes
import com.coachfoska.designsystem.tokens.DsSpacing
import com.coachfoska.designsystem.tokens.DsTypography
import org.jetbrains.compose.resources.Font

val LocalBrand = staticCompositionLocalOf<Brand> { FoskaBrand }
internal val LocalDsColors = staticCompositionLocalOf { FoskaBrand.darkColors }
internal val LocalDsTypography = staticCompositionLocalOf { FoskaBrand.typography(null) }
internal val LocalDsShapes = staticCompositionLocalOf { FoskaBrand.shapes }
internal val LocalDsSpacing = staticCompositionLocalOf { FoskaBrand.spacing }
internal val LocalDsSizes = staticCompositionLocalOf { FoskaBrand.sizes }
internal val LocalDsMotion = staticCompositionLocalOf { FoskaBrand.motion }

/**
 * Design-system theme root. Brand is a plain parameter: build-time constant
 * in production, runtime-switchable in the gallery (and server-drivable later).
 * Also provides a bridged MaterialTheme and LocalReduceMotion.
 */
@Composable
fun DsTheme(
    brand: Brand,
    darkTheme: Boolean,
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) brand.darkColors else brand.lightColors
    val fontFamily = brand.fonts.body?.let { FontFamily(Font(it)) }
    val typography = brand.typography(fontFamily)

    CompositionLocalProvider(
        LocalBrand provides brand,
        LocalDsColors provides colors,
        LocalDsTypography provides typography,
        LocalDsShapes provides brand.shapes,
        LocalDsSpacing provides brand.spacing,
        LocalDsSizes provides brand.sizes,
        LocalDsMotion provides brand.motion,
        LocalReduceMotion provides rememberPlatformReduceMotion(),
    ) {
        MaterialTheme(
            colorScheme = colors.toMaterialColorScheme(darkTheme),
            typography = typography.toMaterialTypography(),
            shapes = brand.shapes.toMaterialShapes(),
            content = content,
        )
    }
}

/** Accessors, mirroring the MaterialTheme object pattern. */
object DsTheme {
    val colors: DsColors
        @Composable @ReadOnlyComposable get() = LocalDsColors.current
    val type: DsTypography
        @Composable @ReadOnlyComposable get() = LocalDsTypography.current
    val shapes: DsShapes
        @Composable @ReadOnlyComposable get() = LocalDsShapes.current
    val spacing: DsSpacing
        @Composable @ReadOnlyComposable get() = LocalDsSpacing.current
    val sizes: DsSizes
        @Composable @ReadOnlyComposable get() = LocalDsSizes.current
    val motion: DsMotion
        @Composable @ReadOnlyComposable get() = LocalDsMotion.current
    val assets: BrandAssets
        @Composable @ReadOnlyComposable get() = LocalBrand.current.assets
    val strings: BrandStrings
        @Composable @ReadOnlyComposable get() = LocalBrand.current.strings
    val features: BrandFeatures
        @Composable @ReadOnlyComposable get() = LocalBrand.current.features
}
