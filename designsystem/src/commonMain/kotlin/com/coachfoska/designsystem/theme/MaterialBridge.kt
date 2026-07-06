package com.coachfoska.designsystem.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import com.coachfoska.designsystem.tokens.DsColors
import com.coachfoska.designsystem.tokens.DsShapes
import com.coachfoska.designsystem.tokens.DsTypography

/**
 * Bridges Ds tokens onto Material3 so stock M3 widgets (dialogs, pickers,
 * ripples, sheets) inherit brand styling. App code should read DsTheme,
 * not MaterialTheme - the bridge exists for M3 internals.
 */
internal fun DsColors.toMaterialColorScheme(darkTheme: Boolean): ColorScheme {
    // secondaryContainer differed per mode in the legacy scheme (Gray800 dark /
    // Gray100 light); surfaceHighest vs surfaceElevated preserves both exactly.
    val secondaryContainer = if (darkTheme) surfaceHighest else surfaceElevated
    return if (darkTheme) {
        darkColorScheme(
            primary = actionPrimary,
            onPrimary = onActionPrimary,
            primaryContainer = surfaceElevated,
            onPrimaryContainer = textPrimary,
            secondary = actionPrimary,
            onSecondary = onActionPrimary,
            secondaryContainer = secondaryContainer,
            onSecondaryContainer = textPrimary,
            tertiary = accent,
            background = background,
            onBackground = textPrimary,
            surface = surface,
            onSurface = textPrimary,
            surfaceVariant = surfaceElevated,
            onSurfaceVariant = textSecondary,
            surfaceContainerHighest = surfaceHighest,
            error = error,
            onError = onError,
            outline = outline,
            outlineVariant = outlineSubtle,
        )
    } else {
        lightColorScheme(
            primary = actionPrimary,
            onPrimary = onActionPrimary,
            primaryContainer = surfaceElevated,
            onPrimaryContainer = textPrimary,
            secondary = actionPrimary,
            onSecondary = onActionPrimary,
            secondaryContainer = secondaryContainer,
            onSecondaryContainer = textPrimary,
            tertiary = accent,
            background = background,
            onBackground = textPrimary,
            surface = surface,
            onSurface = textPrimary,
            surfaceVariant = surfaceElevated,
            onSurfaceVariant = textSecondary,
            surfaceContainerHighest = surfaceHighest,
            error = error,
            onError = onError,
            outline = outline,
            outlineVariant = outlineSubtle,
        )
    }
}

internal fun DsTypography.toMaterialTypography(): Typography = Typography(
    displayLarge = displayLarge,
    displayMedium = displayMedium,
    headlineLarge = headlineLarge,
    headlineMedium = headlineMedium,
    headlineSmall = headlineSmall,
    titleLarge = titleLarge,
    titleMedium = titleMedium,
    titleSmall = titleSmall,
    bodyLarge = bodyLarge,
    bodyMedium = bodyMedium,
    bodySmall = bodySmall,
    labelLarge = labelLarge,
    labelMedium = labelMedium,
    labelSmall = labelSmall,
)

internal fun DsShapes.toMaterialShapes(): Shapes = Shapes(
    extraSmall = xs,
    small = sm,
    medium = md,
    large = lg,
    extraLarge = xl,
)
