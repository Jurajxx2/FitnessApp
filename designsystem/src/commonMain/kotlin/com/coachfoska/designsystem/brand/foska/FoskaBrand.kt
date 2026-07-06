package com.coachfoska.designsystem.brand.foska

import androidx.compose.ui.graphics.Color
import com.coachfoska.designsystem.brand.Brand
import com.coachfoska.designsystem.brand.BrandAssets
import com.coachfoska.designsystem.brand.BrandFeatures
import com.coachfoska.designsystem.brand.BrandFonts
import com.coachfoska.designsystem.brand.BrandStrings
import com.coachfoska.designsystem.tokens.DsColors
import com.coachfoska.designsystem.tokens.DsMotion
import com.coachfoska.designsystem.tokens.DsShapes
import com.coachfoska.designsystem.tokens.DsSizes
import com.coachfoska.designsystem.tokens.DsSpacing

// Raw Foska palette - private to this brand file. Components never see these.
private val BrandRed = Color(0xFFA90707)
private val BrandRedLight = Color(0xFFCF2E2E)
private val Black = Color(0xFF000000)
private val White = Color(0xFFFFFFFF)
private val Gray100 = Color(0xFFF5F5F5)
private val Gray200 = Color(0xFFEEEEEE)
private val Gray300 = Color(0xFFE0E0E0)
private val Gray400 = Color(0xFFBDBDBD)
private val Gray500 = Color(0xFF9E9E9E)
private val Gray600 = Color(0xFF757575)
private val Gray700 = Color(0xFF444444)
private val Gray800 = Color(0xFF32373C)
private val Gray900 = Color(0xFF1A1A1A)
private val Gray950 = Color(0xFF0F0F0F)

private val Categorical = listOf(
    Color(0xFFCF2E2E), // red - chest
    Color(0xFF5B8DEF), // blue - back
    Color(0xFFE3A13B), // amber - legs
    Color(0xFF58B368), // green - shoulders
    Color(0xFFB06AC9), // purple - arms
    Color(0xFF4FB6C4), // teal - core
)

/** Default brand - the implemented Coach Foska black/white/red look, 1:1. */
object FoskaBrand : Brand {
    override val id = "foska"

    override val darkColors = DsColors(
        background = Black,
        surface = Gray950,
        surfaceElevated = Gray900,
        surfaceHighest = Gray800,
        textPrimary = White,
        textSecondary = Gray400,
        textAccent = BrandRedLight,
        accent = BrandRed,
        onAccent = White,
        actionPrimary = White,
        onActionPrimary = Black,
        actionSecondary = Gray900,
        onActionSecondary = White,
        success = Color(0xFF2E7D32),
        successSoft = Color(0xFF81C784),
        warning = Color(0xFFF9A825),
        warningStrong = Color(0xFFFF9800),
        warningContainer = Color(0xFFFFF3CD),
        onWarningContainer = Color(0xFF856404),
        error = Color(0xFFCF2E2E),
        onError = White,
        errorSoft = Color(0xFFE57373),
        outline = Gray700,
        outlineSubtle = Gray800,
        chartLine = BrandRed,
        chartFill = Color(0x26A90707),
        chartGrid = Color(0x14FFFFFF),
        categorical = Categorical,
        categoricalFallback = Gray500,
        shimmerBase = Gray900,
        shimmerHighlight = Gray900.copy(alpha = 0.4f),
    )

    override val lightColors = DsColors(
        background = White,
        surface = White,
        surfaceElevated = Gray100,
        surfaceHighest = Gray200,
        textPrimary = Black,
        textSecondary = Gray600,
        textAccent = BrandRedLight,
        accent = BrandRed,
        onAccent = White,
        actionPrimary = Black,
        onActionPrimary = White,
        actionSecondary = Gray100,
        onActionSecondary = Black,
        success = Color(0xFF2E7D32),
        successSoft = Color(0xFF81C784),
        warning = Color(0xFFF9A825),
        warningStrong = Color(0xFFFF9800),
        warningContainer = Color(0xFFFFF3CD),
        onWarningContainer = Color(0xFF856404),
        error = Color(0xFFCF2E2E),
        onError = White,
        errorSoft = Color(0xFFE57373),
        outline = Gray300,
        outlineSubtle = Gray200,
        chartLine = BrandRed,
        chartFill = Color(0x26A90707),
        chartGrid = Color(0x14000000),
        categorical = Categorical,
        categoricalFallback = Gray500,
        shimmerBase = Gray100,
        shimmerHighlight = Gray100.copy(alpha = 0.4f),
    )

    override val fonts = BrandFonts()
    override val shapes = DsShapes()
    override val spacing = DsSpacing()
    override val sizes = DsSizes()
    override val motion = DsMotion()
    override val assets = BrandAssets(loaderLottiePath = "files/barbell_loader.json")
    override val strings = BrandStrings(appName = "Foska", coachName = "Andrea")
    override val features = BrandFeatures()
}
