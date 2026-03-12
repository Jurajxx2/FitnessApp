package com.coachfoska.app.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

private val DarkColorScheme = darkColorScheme(
    primary = BrandRed,
    onPrimary = White,
    primaryContainer = BrandRedDark,
    onPrimaryContainer = White,
    secondary = Gray500,
    onSecondary = White,
    secondaryContainer = Gray800,
    onSecondaryContainer = Gray300,
    tertiary = Gray400,
    background = Black,
    onBackground = White,
    surface = Gray950,
    onSurface = White,
    surfaceVariant = Gray900,
    onSurfaceVariant = Gray400,
    surfaceContainerHighest = Gray800,
    error = Error,
    onError = White,
    outline = Gray700,
    outlineVariant = Gray800
)

private val LightColorScheme = lightColorScheme(
    primary = BrandRed,
    onPrimary = White,
    primaryContainer = BrandRedLight.copy(alpha = 0.12f),
    onPrimaryContainer = BrandRedDark,
    secondary = Gray600,
    onSecondary = White,
    secondaryContainer = Gray100,
    onSecondaryContainer = Gray800,
    tertiary = Gray500,
    background = White,
    onBackground = Black,
    surface = White,
    onSurface = Black,
    surfaceVariant = Gray100,
    onSurfaceVariant = Gray600,
    surfaceContainerHighest = Gray200,
    error = Error,
    onError = White,
    outline = Gray300,
    outlineVariant = Gray200
)

private val CoachFoskaShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(10.dp),
    extraLarge = RoundedCornerShape(12.dp)
)

@Composable
fun CoachFoskaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CoachFoskaTypography,
        shapes = CoachFoskaShapes,
        content = content
    )
}
