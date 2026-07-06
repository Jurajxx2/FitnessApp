# Design System (`:designsystem`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Portability note:** This plan is self-contained and executable by any coding agent (Claude, Codex, Gemini). It requires only a shell, a text editor, and `./gradlew`. No MCP tools, no IDE features.

**Goal:** Extract a whitelabel-ready design system into a new `:designsystem` KMP module — semantic tokens, `Brand` contract, `DsTheme` engine with Material3 bridge, `Ds*` component library, debug gallery, guardrail tests — and fully migrate the app off the old `com.coachfoska.app.theme` package.

**Architecture:** Build-time brand selection (`BuildKonfig.BRAND_ID` → `BrandRegistry`) feeding a runtime-capable theme engine (`DsTheme(brand, darkTheme)` provides `@Immutable` token classes via `staticCompositionLocalOf`, and bridges them onto a real `MaterialTheme` so stock M3 widgets inherit brand styling). Components are stateless, domain-agnostic, and read every value from `DsTheme`.

**Tech Stack:** Kotlin 2.3.20, Compose Multiplatform 1.10.3, Material3 1.9.0, BuildKonfig 0.18.0, Compottie 2.1.0 — all already in `gradle/libs.versions.toml`; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-06-design-system-design.md`

> **Status: COMPLETE (2026-07-06).** All 13 tasks implemented and committed;
> `:designsystem` + `:composeApp` compile on Android and iOS, all unit tests
> pass (`BrandContrastTest`, `NoHardcodedColorsTest`), and `:composeApp:assembleDebug`
> succeeds. One ordering deviation from the plan: the legacy theme package was
> deleted (Task 13) before adding the guardrail test (Task 10), so the temporary
> allowlist described in Task 10 Step 2 / Task 13 Step 3 was never needed — the
> guardrail passes with zero allowlist.

## Global Constraints

- All commands run from the repo root (`/…/coach-foska`). All `./gradlew` commands are pre-approved.
- New module namespace/package: `com.coachfoska.designsystem`. Component prefix: `Ds`.
- `:designsystem` may depend ONLY on: Compose (runtime, foundation, material3, material-icons, ui, components-resources, ui-tooling-preview), Compottie, kotlin-test (test only). NEVER on: Koin, Ktor, Supabase, navigation, coil, app domain models, or `coachfoska.composeapp.generated.resources`.
- **Visual neutrality:** `FoskaBrand` token values are copied verbatim from `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Color.kt`, `Type.kt`, `Dimens.kt`, `Theme.kt` — never re-derived. Exception (documented in Task 9): the hardcoded-color leak files normalize onto nearest semantic tokens.
- **Git:** stage explicit paths only — NEVER `git add -A` or `git add .` (repo contains untracked cruft). Commit after every task.
- Fast per-task verification: `./gradlew :composeApp:compileDebugKotlinAndroid :designsystem:compileDebugKotlinAndroid`. Test runs: `./gradlew :designsystem:testDebugUnitTest` / `./gradlew :composeApp:testDebugUnitTest`. Expected: `BUILD SUCCESSFUL`.
- Kotlin files in this plan are complete — copy them as written. Where a step says "move a file", the current file in the repo is the source of truth; apply ONLY the listed substitutions.

---

### Task 1: Create the `:designsystem` module skeleton

**Files:**
- Modify: `settings.gradle.kts` (last line)
- Create: `designsystem/build.gradle.kts`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsSpacing.kt`
- Move: `composeApp/src/commonMain/composeResources/files/barbell_loader.json` → `designsystem/src/commonMain/composeResources/files/barbell_loader.json` (COPY in this task; the composeApp original is deleted in Task 7)

**Interfaces:**
- Produces: Gradle project `:designsystem`, package `com.coachfoska.designsystem`, resource class `com.coachfoska.designsystem.generated.resources.Res`, and `DsSpacing` (consumed by every later task).

- [x] **Step 1: Register the module**

In `settings.gradle.kts`, append after `include(":composeApp")`:

```kotlin
include(":designsystem")
```

- [x] **Step 2: Create `designsystem/build.gradle.kts`**

```kotlin
import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    androidTarget {
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.material3)
            implementation(libs.compose.material.icons)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)
            implementation(libs.compose.ui.tooling.preview)
            implementation(libs.compottie)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

compose.resources {
    packageOfResClass = "com.coachfoska.designsystem.generated.resources"
    // Public so app code (e.g. SplashScreen) can read brand assets via DsTheme.assets paths.
    publicResClass = true
}

android {
    namespace = "com.coachfoska.designsystem"
    compileSdk = 36
    defaultConfig {
        minSdk = 24
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
```

- [x] **Step 3: Copy the Lottie asset into the module**

```bash
mkdir -p designsystem/src/commonMain/composeResources/files
cp composeApp/src/commonMain/composeResources/files/barbell_loader.json designsystem/src/commonMain/composeResources/files/barbell_loader.json
```

(Do NOT delete the composeApp copy yet — `CoachLoadingBox` still reads it until Task 7.)

- [x] **Step 4: Create the first token file so the module has something to compile**

Create `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsSpacing.kt`:

```kotlin
package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Spacing scale. Reference these everywhere; no ad-hoc dp values in components. */
@Immutable
data class DsSpacing(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 24.dp,
    val xxl: Dp = 32.dp,
)
```

- [x] **Step 5: Wire composeApp → designsystem**

In `composeApp/build.gradle.kts`, inside `commonMain.dependencies { … }`, add as the first line:

```kotlin
implementation(projects.designsystem)
```

- [x] **Step 6: Verify it compiles**

Run: `./gradlew :designsystem:compileDebugKotlinAndroid :composeApp:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL`

- [x] **Step 7: Commit**

```bash
git add settings.gradle.kts designsystem/build.gradle.kts designsystem/src composeApp/build.gradle.kts
git commit -m "feat(designsystem): add :designsystem KMP module skeleton"
```

---

### Task 2: Semantic token classes

**Files:**
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsColors.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsTypography.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsShapes.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsSizes.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens/DsMotion.kt`

**Interfaces:**
- Consumes: `DsSpacing` (Task 1).
- Produces: `DsColors` (all fields below + `categoricalFor(label: String?): Color`), `DsTypography` + `DsTypographyDefaults.default(fontFamily: FontFamily?): DsTypography`, `DsShapes`, `DsSizes`, `DsMotion`. Every later task reads these exact names.

- [x] **Step 1: Create `DsColors.kt`**

```kotlin
package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Semantic color tokens. Components and screens read ONLY these —
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
    /** Accent-colored text. Reserve for large/bold usage — AA large-text (3:1) is the floor. */
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
```

- [x] **Step 2: Create `DsTypography.kt`**

Values are copied verbatim from `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Type.kt`.

```kotlin
package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Full type ramp + the app's signature oversized metric styles. */
@Immutable
data class DsTypography(
    val displayLarge: TextStyle,
    val displayMedium: TextStyle,
    val headlineLarge: TextStyle,
    val headlineMedium: TextStyle,
    val headlineSmall: TextStyle,
    val titleLarge: TextStyle,
    val titleMedium: TextStyle,
    val titleSmall: TextStyle,
    val bodyLarge: TextStyle,
    val bodyMedium: TextStyle,
    val bodySmall: TextStyle,
    val labelLarge: TextStyle,
    val labelMedium: TextStyle,
    val labelSmall: TextStyle,
    /** Stat readouts — oversized, extra-bold, tight tracking (visual signature). */
    val metricLarge: TextStyle,
    val metricMedium: TextStyle,
    val metricSmall: TextStyle,
)

object DsTypographyDefaults {
    /** Default ramp; [fontFamily] = null keeps the platform system font. */
    fun default(fontFamily: FontFamily? = null): DsTypography = DsTypography(
        displayLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.ExtraBold, fontSize = 36.sp, lineHeight = 40.sp, letterSpacing = (-1).sp),
        displayMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = (-0.5).sp),
        headlineLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 28.sp, letterSpacing = (-0.25).sp),
        headlineMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 24.sp, letterSpacing = 0.sp),
        headlineSmall = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 22.sp, letterSpacing = 0.sp),
        titleLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 22.sp, letterSpacing = 0.sp),
        titleMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp, letterSpacing = 0.sp),
        titleSmall = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 18.sp, letterSpacing = 0.sp),
        bodyLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp, letterSpacing = 0.sp),
        bodyMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp, letterSpacing = 0.sp),
        bodySmall = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.sp),
        labelLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 16.sp, letterSpacing = 0.5.sp),
        labelMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.5.sp),
        labelSmall = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Medium, fontSize = 10.sp, lineHeight = 12.sp, letterSpacing = 0.5.sp),
        metricLarge = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.ExtraBold, fontSize = 44.sp, lineHeight = 48.sp, letterSpacing = (-1.5).sp),
        metricMedium = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = (-0.5).sp),
        metricSmall = TextStyle(fontFamily = fontFamily, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 22.sp, letterSpacing = 0.sp),
    )
}
```

- [x] **Step 3: Create `DsShapes.kt`**

Radii xs–xl are verbatim from `Theme.kt` `CoachFoskaShapes`; `xxl` covers the hub cards' 16dp.

```kotlin
package com.coachfoska.designsystem.tokens

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.dp

@Immutable
data class DsShapes(
    val xs: CornerBasedShape = RoundedCornerShape(4.dp),
    val sm: CornerBasedShape = RoundedCornerShape(6.dp),
    val md: CornerBasedShape = RoundedCornerShape(8.dp),
    val lg: CornerBasedShape = RoundedCornerShape(10.dp),
    val xl: CornerBasedShape = RoundedCornerShape(12.dp),
    val xxl: CornerBasedShape = RoundedCornerShape(16.dp),
    val full: CornerBasedShape = CircleShape,
)
```

- [x] **Step 4: Create `DsSizes.kt`**

```kotlin
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
```

- [x] **Step 5: Create `DsMotion.kt`**

```kotlin
package com.coachfoska.designsystem.tokens

import androidx.compose.runtime.Immutable

@Immutable
data class DsMotion(
    val durationShortMs: Int = 150,
    val durationMediumMs: Int = 300,
    val durationLongMs: Int = 700,
    val shimmerCycleMs: Int = 1100,
)
```

- [x] **Step 6: Verify and commit**

Run: `./gradlew :designsystem:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL`

```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/tokens
git commit -m "feat(designsystem): add semantic token classes"
```

---

### Task 3: Brand contract, FoskaBrand, registry — TDD via contrast test

**Files:**
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/Brand.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/BrandRegistry.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/foska/FoskaBrand.kt`
- Test: `designsystem/src/commonTest/kotlin/com/coachfoska/designsystem/brand/BrandContrastTest.kt`

**Interfaces:**
- Consumes: all token classes (Task 2).
- Produces: `interface Brand` (properties: `id: String`, `lightColors/darkColors: DsColors`, `fonts: BrandFonts`, `shapes: DsShapes`, `spacing: DsSpacing`, `sizes: DsSizes`, `motion: DsMotion`, `assets: BrandAssets`, `strings: BrandStrings`, `features: BrandFeatures`, `fun typography(fontFamily: FontFamily?): DsTypography`), `object FoskaBrand : Brand`, `object BrandRegistry { val all: List<Brand>; fun fromId(id: String): Brand }`.

- [x] **Step 1: Write the failing contrast test**

Create `designsystem/src/commonTest/kotlin/com/coachfoska/designsystem/brand/BrandContrastTest.kt`:

```kotlin
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
```

- [x] **Step 2: Run the test to verify it fails**

Run: `./gradlew :designsystem:testDebugUnitTest --tests "com.coachfoska.designsystem.brand.BrandContrastTest"`
Expected: FAIL — compilation error, `BrandRegistry` unresolved.

- [x] **Step 3: Create the brand contract**

Create `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/Brand.kt`:

```kotlin
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
 * The whitelabel seam: one implementation per brand. Adding a brand =
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
```

- [x] **Step 4: Create FoskaBrand**

Create `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/foska/FoskaBrand.kt`. Every hex value below is copied from `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Color.kt` and the scheme mapping in `Theme.kt` — do not adjust them.

```kotlin
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

// Raw Foska palette — private to this brand file. Components never see these.
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
    Color(0xFFCF2E2E), // red    — chest
    Color(0xFF5B8DEF), // blue   — back
    Color(0xFFE3A13B), // amber  — legs
    Color(0xFF58B368), // green  — shoulders
    Color(0xFFB06AC9), // purple — arms
    Color(0xFF4FB6C4), // teal   — core
)

/** Default brand — the implemented Coach Foska black/white/red look, 1:1. */
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

    override val fonts = BrandFonts() // system fonts, as today
    override val shapes = DsShapes()
    override val spacing = DsSpacing()
    override val sizes = DsSizes()
    override val motion = DsMotion()
    override val assets = BrandAssets(loaderLottiePath = "files/barbell_loader.json")
    override val strings = BrandStrings(appName = "Foska", coachName = "Andrea")
    override val features = BrandFeatures()
}
```

- [x] **Step 5: Create the registry**

Create `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/BrandRegistry.kt`:

```kotlin
package com.coachfoska.designsystem.brand

import com.coachfoska.designsystem.brand.foska.FoskaBrand

object BrandRegistry {
    val all: List<Brand> = listOf(FoskaBrand)

    /** Falls back to FoskaBrand for unknown ids so a misconfigured build still boots branded. */
    fun fromId(id: String): Brand = all.firstOrNull { it.id == id } ?: FoskaBrand
}
```

- [x] **Step 6: Run the test to verify it passes**

Run: `./gradlew :designsystem:testDebugUnitTest --tests "com.coachfoska.designsystem.brand.BrandContrastTest"`
Expected: PASS (Foska dark textAccent/background lands ≈ 4.08, above the 3.0 floor; everything else clears 4.5).

- [x] **Step 7: Commit**

```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand designsystem/src/commonTest
git commit -m "feat(designsystem): add Brand contract, FoskaBrand, registry + WCAG contrast test"
```

---

### Task 4: DsTheme engine, Material3 bridge, reduce-motion

**Files:**
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/theme/DsTheme.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/theme/MaterialBridge.kt`
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/theme/ReduceMotion.kt`
- Create: `designsystem/src/androidMain/kotlin/com/coachfoska/designsystem/theme/ReduceMotion.android.kt`
- Create: `designsystem/src/iosMain/kotlin/com/coachfoska/designsystem/theme/ReduceMotion.ios.kt`

**Interfaces:**
- Consumes: `Brand`, `BrandRegistry` (Task 3); all tokens (Task 2).
- Produces: `@Composable fun DsTheme(brand: Brand, darkTheme: Boolean, content: @Composable () -> Unit)`; `object DsTheme` with `@Composable` getters `colors`, `type`, `shapes`, `spacing`, `sizes`, `motion`, `assets`, `strings`, `features`; `LocalBrand`; `LocalReduceMotion` (design-system copy — the app's `com.coachfoska.app.core.util.LocalReduceMotion` is replaced by this in Task 5).

- [x] **Step 1: Move reduce-motion into the design system**

The app files are the source of truth:
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt`
- `composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.android.kt`
- `composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.ios.kt`

Copy each file to the matching `designsystem/src/<sourceSet>/kotlin/com/coachfoska/designsystem/theme/` path listed above, changing ONLY the package line to `package com.coachfoska.designsystem.theme`. Keep the app copies for now — they are deleted in Task 5.

- [x] **Step 2: Create `MaterialBridge.kt`**

The mapping reproduces `Theme.kt`'s `DarkColorScheme`/`LightColorScheme` value-for-value (verify against that file if in doubt).

```kotlin
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
 * not MaterialTheme — the bridge exists for M3 internals.
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
```

- [x] **Step 3: Create `DsTheme.kt`**

```kotlin
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
```

- [x] **Step 4: Verify and commit**

Run: `./gradlew :designsystem:compileDebugKotlinAndroid :designsystem:compileKotlinIosSimulatorArm64`
Expected: `BUILD SUCCESSFUL` (the iOS compile validates the expect/actual pair).

```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/theme designsystem/src/androidMain designsystem/src/iosMain
git commit -m "feat(designsystem): add DsTheme engine with Material3 bridge and reduce-motion"
```

---

### Task 5: BRAND_ID + switch the app root to DsTheme

**Files:**
- Modify: `composeApp/build.gradle.kts` (buildkonfig block, ~line 162)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`
- Modify (imports only): `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/Shimmer.kt`, `.../ui/components/MetricCard.kt`, `.../ui/workout/ActiveSessionScreen.kt`, `.../ui/workout/components/SetRow.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt`, `composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.android.kt`, `composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.ios.kt`

**Interfaces:**
- Consumes: `DsTheme`, `BrandRegistry` (Tasks 3–4).
- Produces: `BuildKonfig.BRAND_ID` (String); app root themed by `DsTheme`. All old theme constants keep working through the Material bridge until Task 9.

- [x] **Step 1: Add BRAND_ID to BuildKonfig**

In `composeApp/build.gradle.kts`, inside `buildkonfig { defaultConfigs { … } }`, add after the `DEBUG` field:

```kotlin
buildConfigField(
    STRING, "BRAND_ID",
    localProperties.getProperty("brand.id") ?: "foska"
)
```

- [x] **Step 2: Swap the theme root in App.kt**

In `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`:

Replace these imports:
```kotlin
import com.coachfoska.app.core.util.LocalReduceMotion
import com.coachfoska.app.core.util.rememberPlatformReduceMotion
import com.coachfoska.app.theme.CoachFoskaTheme
```
with:
```kotlin
import com.coachfoska.designsystem.brand.BrandRegistry
import com.coachfoska.designsystem.theme.DsTheme
```
(Also delete the now-unused `import androidx.compose.runtime.CompositionLocalProvider` if no other usage remains in the file.)

Replace:
```kotlin
    CoachFoskaTheme(darkTheme = isDarkTheme) {
        CompositionLocalProvider(LocalReduceMotion provides rememberPlatformReduceMotion()) {
```
with:
```kotlin
    DsTheme(brand = BrandRegistry.fromId(BuildKonfig.BRAND_ID), darkTheme = isDarkTheme) {
```
and remove the matching closer near the end of `App()`: delete the line `} // CompositionLocalProvider` (keep the outer brace structure balanced — one `{` was removed, so one `}` must go).

Add the BuildKonfig import if not present: `import com.coachfoska.app.BuildKonfig`. (BuildKonfig is generated in package `com.coachfoska.app` — same package as App.kt, so the import may be unnecessary; the compiler will tell you.)

- [x] **Step 3: Re-point reduce-motion consumers**

In each of `Shimmer.kt`, `MetricCard.kt`, `ActiveSessionScreen.kt`, `SetRow.kt`, replace the import:
```kotlin
import com.coachfoska.app.core.util.LocalReduceMotion
```
with:
```kotlin
import com.coachfoska.designsystem.theme.LocalReduceMotion
```
Then delete the three app-side ReduceMotion files listed in **Files**.

- [x] **Step 4: Verify — full compile plus existing tests**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL`, all existing tests pass. The app renders identically: the bridge reproduces the legacy Material scheme exactly.

- [x] **Step 5: Commit**

```bash
git add composeApp/build.gradle.kts composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/Shimmer.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MetricCard.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActiveSessionScreen.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/SetRow.kt
git rm composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.kt composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.android.kt composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/ReduceMotion.ios.kt
git commit -m "feat(app): theme root on DsTheme with BRAND_ID brand selection"
```

---

### Task 6: Components batch A — DsCard, DsChip, DsStatRow, DsSectionHeader, DsSectionLabel, DsEmptyState, DsShimmer

These are verbatim moves plus token substitution. For each: create the new file in `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/components/`, package `com.coachfoska.designsystem.components`, body copied from the source file with the substitutions applied; delete the source declaration; update all call sites (rename + import). Enumerate call sites with:
`grep -rln "<OldName>" composeApp/src --include="*.kt"`

**Universal substitution table (applies to every component move in Tasks 6–8):**

| Old expression | New expression |
|---|---|
| `MaterialTheme.colorScheme.background` | `DsTheme.colors.background` |
| `MaterialTheme.colorScheme.onBackground` | `DsTheme.colors.textPrimary` |
| `MaterialTheme.colorScheme.surface` | `DsTheme.colors.surface` |
| `MaterialTheme.colorScheme.onSurface` | `DsTheme.colors.textPrimary` |
| `MaterialTheme.colorScheme.surfaceVariant` | `DsTheme.colors.surfaceElevated` |
| `MaterialTheme.colorScheme.onSurfaceVariant` | `DsTheme.colors.textSecondary` |
| `MaterialTheme.colorScheme.primary` | `DsTheme.colors.actionPrimary` |
| `MaterialTheme.colorScheme.onPrimary` | `DsTheme.colors.onActionPrimary` |
| `MaterialTheme.colorScheme.error` | `DsTheme.colors.error` |
| `MaterialTheme.colorScheme.onError` | `DsTheme.colors.onError` |
| `MaterialTheme.colorScheme.outline` | `DsTheme.colors.outline` |
| `MaterialTheme.colorScheme.outlineVariant` | `DsTheme.colors.outlineSubtle` |
| `MaterialTheme.typography.<style>` | `DsTheme.type.<style>` |
| `MaterialTheme.shapes.extraSmall/small/medium/large/extraLarge` | `DsTheme.shapes.xs/sm/md/lg/xl` |
| `RoundedCornerShape(16.dp)` | `DsTheme.shapes.xxl` |
| `Spacing.<x>` (import `com.coachfoska.app.theme.Spacing`) | `DsTheme.spacing.<x>` |
| `Sizes.touchTarget` | `DsTheme.sizes.touchTarget` |
| `MetricLarge` / `MetricMedium` / `MetricSmall` | `DsTheme.type.metricLarge/metricMedium/metricSmall` |
| `Success` (theme import) | `DsTheme.colors.success` |
| `TextAccent` | `DsTheme.colors.textAccent` |
| `BrandRed` | `DsTheme.colors.accent` |
| `ChartLine`/`ChartFill`/`ChartGrid` | `DsTheme.colors.chartLine/chartFill/chartGrid` |
| `muscleGroupColor(x)` | `DsTheme.colors.categoricalFor(x)` |
| `import com.coachfoska.app.core.util.LocalReduceMotion` | `import com.coachfoska.designsystem.theme.LocalReduceMotion` |

Required import in every Ds component: `import com.coachfoska.designsystem.theme.DsTheme`.

**Files:**
- Create: `designsystem/.../components/DsCard.kt` — from `CoachCard` in `composeApp/.../ui/components/CoachComponents.kt` (lines ~120–153), renamed `DsCard`. Default `shape = DsTheme.shapes.xl`, `containerColor = DsTheme.colors.surface`, `contentColor = DsTheme.colors.textPrimary`, `border = BorderStroke(1.dp, DsTheme.colors.outlineSubtle)`.
- Create: `designsystem/.../components/DsChip.kt` — from `FoskaFilterChip` in `FoskaChip.kt`, renamed `DsChip`. Colors: `selectedContainerColor = DsTheme.colors.actionPrimary`, `selectedLabelColor = DsTheme.colors.onActionPrimary`, `selectedLeadingIconColor = DsTheme.colors.onActionPrimary`. Delete `FoskaChip.kt`.
- Create: `designsystem/.../components/DsStatRow.kt` — from `StatRow.kt`, renamed `DsStatRow`. Delete `StatRow.kt`.
- Create: `designsystem/.../components/DsSectionHeader.kt` — TWO composables: `DsSectionHeader` (from `SectionHeader.kt` — uppercase title + optional action; action color becomes `DsTheme.colors.actionPrimary`) and `DsSectionLabel` (from `CoachSectionHeader` in `CoachComponents.kt` — tiny letterspaced label; color `DsTheme.colors.textPrimary.copy(alpha = 0.4f)`). The spec's "merge" resolves to these two named primitives: they serve different roles. Delete `SectionHeader.kt` and the `CoachSectionHeader` function.
- (Note: `EmptyState` is NOT part of this task — it calls `CoachButton`, so it moves in Task 7 right after `DsButton` exists. Leave `EmptyState.kt` untouched here.)
- Create: `designsystem/.../components/DsShimmer.kt` — from `Shimmer.kt`: `ShimmerBox` → `DsShimmerBox` (base color `DsTheme.colors.shimmerBase`, gradient middle stop `DsTheme.colors.shimmerHighlight`, shape `DsTheme.shapes.md`, cycle `DsTheme.motion.shimmerCycleMs`), `MetricCardSkeleton` → `DsMetricCardSkeleton`. Delete `Shimmer.kt`.

**Interfaces:**
- Consumes: `DsTheme` accessors (Task 4).
- Produces: `DsCard`, `DsChip`, `DsStatRow`, `DsSectionHeader`, `DsSectionLabel`, `DsShimmerBox`, `DsMetricCardSkeleton` — signatures identical to their sources except the rename and defaults noted above.

- [x] **Step 1:** Move `CoachCard` → `DsCard.kt`; apply substitutions; delete `CoachCard` from `CoachComponents.kt`.
- [x] **Step 2:** Move `FoskaFilterChip` → `DsChip.kt` (rename to `DsChip`); delete `FoskaChip.kt`.
- [x] **Step 3:** Move `StatRow` → `DsStatRow.kt` (rename `DsStatRow`); delete `StatRow.kt`.
- [x] **Step 4:** Create `DsSectionHeader.kt` with `DsSectionHeader` + `DsSectionLabel` as described; delete `SectionHeader.kt` and `CoachSectionHeader`.
- [x] **Step 5:** Move `ShimmerBox`/`MetricCardSkeleton` → `DsShimmer.kt` (renames above); delete `Shimmer.kt`.
- [x] **Step 6:** Update every call site: for each old name run `grep -rlnE "CoachCard|FoskaFilterChip|StatRow|SectionHeader|CoachSectionHeader|ShimmerBox|MetricCardSkeleton" composeApp/src --include="*.kt"`, then in each hit replace the name and swap the import to `com.coachfoska.designsystem.components.<DsName>`. Beware substring collisions: `StatRow` also matches `DsStatRow` after edits — re-grep to confirm no stale references: `grep -rnE "ui\.components\.(CoachCard|StatRow|SectionHeader|ShimmerBox)|FoskaFilterChip|CoachSectionHeader" composeApp/src --include="*.kt"` → expect no output.
- [x] **Step 7:** Run: `./gradlew :composeApp:compileDebugKotlinAndroid :designsystem:compileDebugKotlinAndroid` — Expected: `BUILD SUCCESSFUL`.
- [x] **Step 8:** Commit:
```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/components composeApp/src/commonMain/kotlin/com/coachfoska/app/ui
git commit -m "feat(designsystem): migrate cards, chips, stat rows, section headers, shimmer to Ds components"
```
(If `git status` shows deleted files under `composeApp/.../ui/components/`, stage them explicitly with `git add <path>` — a deleted tracked file is staged the same way.)

---

### Task 7: Components batch B — DsButton, DsTextField, DsSearchField, DsLoadingBox, DsEmptyState

**Files:**
- Create: `designsystem/.../components/DsButton.kt` (full code below)
- Create: `designsystem/.../components/DsTextField.kt` — `DsTextField`, `DsSearchField`, `DsTextFieldDefaults.colors()` moved from `CoachComponents.kt` (`CoachTextField`, `CoachSearchField`, `coachTextFieldColors`), substitution table applied; `coachTextFieldColors` becomes `DsTextFieldDefaults.colors()` (an `object DsTextFieldDefaults` with a `@Composable fun colors(): TextFieldColors`).
- Create: `designsystem/.../components/DsLoadingBox.kt` (full code below)
- Create: `designsystem/.../components/DsEmptyState.kt` — from `EmptyState.kt` (rename `DsEmptyState`, substitutions, `CoachButton` call → `DsButton`). Delete `EmptyState.kt`.
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/CoachComponents.kt` (all its declarations are now migrated), `composeApp/src/commonMain/composeResources/files/barbell_loader.json`

**Interfaces:**
- Consumes: `DsTheme`, `BrandAssets.loaderLottiePath` (Task 3), designsystem `Res` (Task 1).
- Produces:
  - `enum class DsButtonVariant { Primary, Secondary, Outlined, Destructive }`
  - `@Composable fun DsButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier.fillMaxWidth(), enabled: Boolean = true, isLoading: Boolean = false, variant: DsButtonVariant = DsButtonVariant.Primary, shape: Shape = DsTheme.shapes.md)`
  - `@Composable fun DsTextField(...)` / `DsSearchField(...)` — same params as Coach versions; `object DsTextFieldDefaults { @Composable fun colors(): TextFieldColors }`
  - `@Composable fun DsLoadingBox(modifier: Modifier = Modifier.fillMaxSize())`
  - `@Composable fun DsEmptyState(...)` — same params as `EmptyState`

- [x] **Step 1: Create `DsButton.kt`**

```kotlin
package com.coachfoska.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.theme.DsTheme

enum class DsButtonVariant { Primary, Secondary, Outlined, Destructive }

@Composable
fun DsButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    enabled: Boolean = true,
    isLoading: Boolean = false,
    variant: DsButtonVariant = DsButtonVariant.Primary,
    shape: Shape = DsTheme.shapes.md,
) {
    if (variant == DsButtonVariant.Outlined) {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(DsTheme.sizes.buttonHeightCompact),
            enabled = enabled && !isLoading,
            shape = shape,
            border = BorderStroke(1.dp, DsTheme.colors.outline),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = DsTheme.colors.textPrimary,
                disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f),
            )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = DsTheme.colors.actionPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(text = text, style = DsTheme.type.labelLarge)
            }
        }
        return
    }

    val colors = when (variant) {
        DsButtonVariant.Primary -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.actionPrimary,
            contentColor = DsTheme.colors.onActionPrimary,
            disabledContainerColor = DsTheme.colors.textPrimary.copy(alpha = 0.12f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Secondary -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.actionSecondary,
            contentColor = DsTheme.colors.onActionSecondary,
            disabledContainerColor = DsTheme.colors.textPrimary.copy(alpha = 0.08f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Destructive -> ButtonDefaults.buttonColors(
            containerColor = DsTheme.colors.error,
            contentColor = DsTheme.colors.onError,
            disabledContainerColor = DsTheme.colors.error.copy(alpha = 0.12f),
            disabledContentColor = DsTheme.colors.textPrimary.copy(alpha = 0.38f)
        )
        DsButtonVariant.Outlined -> error("handled above")
    }

    Button(
        onClick = onClick,
        modifier = modifier.height(DsTheme.sizes.buttonHeight),
        shape = shape,
        colors = colors,
        elevation = null,
        enabled = enabled && !isLoading
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = DsTheme.colors.onActionPrimary,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                style = DsTheme.type.labelLarge,
                letterSpacing = 1.sp
            )
        }
    }
}
```

- [x] **Step 2: Create `DsTextField.kt`** — move `CoachTextField`, `CoachSearchField`, `coachTextFieldColors` from `CoachComponents.kt` with renames `DsTextField`, `DsSearchField`, `DsTextFieldDefaults.colors()` and the substitution table. In `DsSearchField`, `shape = MaterialTheme.shapes.extraLarge` → `DsTheme.shapes.xl`; in `DsTextField`, `shape = MaterialTheme.shapes.medium` → `DsTheme.shapes.md`. In `DsTextFieldDefaults.colors()`: `focusedBorderColor`/`cursorColor`/`focusedLabelColor` → `DsTheme.colors.actionPrimary`; text colors → `DsTheme.colors.textPrimary`; `outlineVariant` → `DsTheme.colors.outlineSubtle`; `onSurfaceVariant` → `DsTheme.colors.textSecondary`.

- [x] **Step 3: Create `DsLoadingBox.kt`**

```kotlin
package com.coachfoska.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.generated.resources.Res
import com.coachfoska.designsystem.theme.DsTheme
import io.github.alexzhirkevich.compottie.Compottie
import io.github.alexzhirkevich.compottie.LottieCompositionSpec
import io.github.alexzhirkevich.compottie.rememberLottieComposition
import io.github.alexzhirkevich.compottie.rememberLottiePainter

/** Brand loader animation (from BrandAssets), with a plain spinner fallback. */
@Composable
fun DsLoadingBox(modifier: Modifier = Modifier.fillMaxSize()) {
    val lottiePath = DsTheme.assets.loaderLottiePath
    val composition by rememberLottieComposition(lottiePath) {
        LottieCompositionSpec.JsonString(
            Res.readBytes(lottiePath).decodeToString()
        )
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (composition != null) {
            Image(
                painter = rememberLottiePainter(
                    composition = composition,
                    iterations = Compottie.IterateForever
                ),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.sizeIn(maxWidth = 200.dp, maxHeight = 200.dp).fillMaxSize()
            )
        } else {
            CircularProgressIndicator(
                color = DsTheme.colors.textPrimary,
                strokeWidth = 2.dp,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
```

(If `rememberLottieComposition(key) { … }` does not accept a key argument in Compottie 2.1.0, use the no-key overload `rememberLottieComposition { … }` — the path is constant per brand at runtime.)

- [x] **Step 4: Move `EmptyState` → `DsEmptyState.kt`** (rename, substitutions, `CoachButton(...)` → `DsButton(...)`). Delete `EmptyState.kt`.

- [x] **Step 4b: Re-point SplashScreen's Lottie read to the designsystem resources.** `composeApp/.../ui/splash/SplashScreen.kt:59-63` inlines its own Lottie composition from the app-resource copy of the loader (do NOT replace it with `DsLoadingBox` — Splash animates the painter inside its own layout). Edit `SplashScreen.kt`:

Add imports (the file keeps its existing app `Res` import for strings):
```kotlin
import com.coachfoska.designsystem.generated.resources.Res as DsRes
import com.coachfoska.designsystem.theme.DsTheme
```
Replace:
```kotlin
    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(
            Res.readBytes("files/barbell_loader.json").decodeToString()
        )
    }
```
with:
```kotlin
    val lottiePath = DsTheme.assets.loaderLottiePath
    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(
            DsRes.readBytes(lottiePath).decodeToString()
        )
    }
```

(The app-resource copy of the JSON is deleted in Step 5, guarded by a grep.)

- [x] **Step 5: Update call sites.** Enumerate: `grep -rlnE "CoachButton|CoachOutlinedButton|CoachTextField|CoachSearchField|coachTextFieldColors|CoachLoadingBox|EmptyState\(" composeApp/src --include="*.kt"`. Replacements: `CoachButton(` → `DsButton(`; `CoachButtonVariant.X` → `DsButtonVariant.X`; `CoachOutlinedButton(…)` → `DsButton(…, variant = DsButtonVariant.Outlined)` — append the variant as the LAST argument so any positional arguments stay valid; `CoachTextField` → `DsTextField`; `CoachSearchField` → `DsSearchField`; `coachTextFieldColors()` → `DsTextFieldDefaults.colors()`; `CoachLoadingBox` → `DsLoadingBox`; `EmptyState(` → `DsEmptyState(`. Fix imports to `com.coachfoska.designsystem.components.*` names. Delete `CoachComponents.kt`. Then confirm nothing in composeApp still references the app-resource copy of the loader:
```bash
grep -rn "files/barbell_loader.json" composeApp/src --include="*.kt"
```
Expected: no output (Splash reads the DS copy after Step 4b; `CoachLoadingBox` is gone with `CoachComponents.kt`). Only then delete `composeApp/src/commonMain/composeResources/files/barbell_loader.json`.

- [x] **Step 6:** Verify: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest` — Expected: `BUILD SUCCESSFUL`.

- [x] **Step 7:** Commit:
```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/components composeApp/src/commonMain/kotlin/com/coachfoska/app/ui composeApp/src/commonMain/composeResources
git commit -m "feat(designsystem): migrate buttons, text fields, loading box, empty state"
```

---

### Task 8: Components batch C — DsTopBar, DsBottomNav, DsMetricCard, DsHubIconCard, DsHubImageCard

**Files:**
- Create: `designsystem/.../components/DsTopBar.kt` — from `CoachTopBar.kt`, renamed `DsTopBar`, with signature change: `backContentDescription: String? = null` parameter replaces the app-resource lookup (the DS module must not reference `coachfoska.composeapp.generated.resources`). Body: `contentDescription = backContentDescription`. Substitutions per table. Delete `CoachTopBar.kt`.
- Create: `designsystem/.../components/DsBottomNav.kt` (full code below) — from `BottomNavBar.kt`. The `BottomNavTab` enum STAYS in the app: move it to a new file `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/BottomNavTab.kt` (same content, package `com.coachfoska.app.navigation`). Delete `BottomNavBar.kt`.
- Create: `designsystem/.../components/DsMetricCard.kt` — from `MetricCard.kt`, renamed `DsMetricCard`; substitutions (`MetricMedium` → `DsTheme.type.metricMedium`, `Success` → `DsTheme.colors.success`, `TextAccent` → `DsTheme.colors.textAccent`, `Spacing` → `DsTheme.spacing`, M3 reads per table; count-up duration `700` → `DsTheme.motion.durationLongMs`). Delete `MetricCard.kt`.
- Create: `designsystem/.../components/DsHubIconCard.kt`, `DsHubImageCard.kt` — from `HubIconCard.kt` / `HubImageCard.kt`, renamed with `Ds` prefix (including their `@Preview` functions — wrap previews in `DsTheme(FoskaBrand, darkTheme = true)`). `RoundedCornerShape(16.dp)` → `DsTheme.shapes.xxl`; badge `RoundedCornerShape(20.dp)` → `DsTheme.shapes.full`; substitutions per table (`primary` here is decorative accent-on-surface → map `MaterialTheme.colorScheme.primary` to `DsTheme.colors.actionPrimary` for exact visual parity). `Color.Black` scrim gradients in `DsHubImageCard` stay as-is (named constants don't violate the `Color(0x` guardrail; the scrim is not brand-varying). Delete the two source files.

**Interfaces:**
- Consumes: `DsTheme` (Task 4).
- Produces:
  - `data class DsBottomNavItem(val id: String, val icon: ImageVector, val label: String, val badgeCount: Int = 0)`
  - `@Composable fun DsBottomNav(items: List<DsBottomNavItem>, selectedId: String, onItemSelected: (String) -> Unit)`
  - `@Composable fun DsTopBar(title: String, onBackClick: (() -> Unit)? = null, backContentDescription: String? = null, actions: @Composable () -> Unit = {})`
  - `DsMetricCard`, `DsHubIconCard`, `DsHubImageCard` — same params as sources.

- [x] **Step 1: Create `DsBottomNav.kt`**

```kotlin
package com.coachfoska.designsystem.components

import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.theme.DsTheme

@Immutable
data class DsBottomNavItem(
    val id: String,
    val icon: ImageVector,
    val label: String,
    val badgeCount: Int = 0,
)

@Composable
fun DsBottomNav(
    items: List<DsBottomNavItem>,
    selectedId: String,
    onItemSelected: (String) -> Unit,
) {
    NavigationBar(
        containerColor = DsTheme.colors.background,
        tonalElevation = 0.dp
    ) {
        items.forEach { item ->
            NavigationBarItem(
                selected = selectedId == item.id,
                onClick = { onItemSelected(item.id) },
                icon = {
                    if (item.badgeCount > 0) {
                        BadgedBox(
                            badge = { Badge { Text(item.badgeCount.coerceAtMost(99).toString()) } }
                        ) {
                            Icon(item.icon, contentDescription = item.label)
                        }
                    } else {
                        Icon(item.icon, contentDescription = item.label)
                    }
                },
                label = { Text(item.label, style = DsTheme.type.labelSmall) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = DsTheme.colors.actionPrimary,
                    selectedTextColor = DsTheme.colors.actionPrimary,
                    unselectedIconColor = DsTheme.colors.textSecondary,
                    unselectedTextColor = DsTheme.colors.textSecondary,
                    indicatorColor = DsTheme.colors.actionPrimary.copy(alpha = 0.1f)
                )
            )
        }
    }
}
```

- [x] **Step 2: Move `BottomNavTab` and adapt `App.kt`.** Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/BottomNavTab.kt` containing the enum exactly as in `BottomNavBar.kt` (package `com.coachfoska.app.navigation`; keep the `StringResource`/`ImageVector` imports and `Res.string.nav_*` references — allowed, this file is app-side). In `App.kt`, replace the `BottomNavBar(...)` call with:

```kotlin
    val tabs = BottomNavTab.entries.map { tab ->
        DsBottomNavItem(id = tab.name, icon = tab.icon, label = stringResource(tab.labelRes))
    }
    DsBottomNav(
        items = tabs,
        selectedId = selectedTab.name,
        onItemSelected = { id ->
            val tab = BottomNavTab.valueOf(id)
            val route: Any = when (tab) {
                BottomNavTab.Home -> Home
                BottomNavTab.Activity -> WorkoutList
                BottomNavTab.Chat -> Chat
                BottomNavTab.Nutrition -> MealPlan
                BottomNavTab.Profile -> Profile
            }
            navController.navigate(route) {
                popUpTo<Home> { saveState = true }
                launchSingleTop = true
                restoreState = true
            }
        }
    )
```

Imports in `App.kt`: replace `com.coachfoska.app.ui.components.BottomNavBar` / `com.coachfoska.app.ui.components.BottomNavTab` with `com.coachfoska.designsystem.components.DsBottomNav`, `com.coachfoska.designsystem.components.DsBottomNavItem`, `com.coachfoska.app.navigation.BottomNavTab`, `org.jetbrains.compose.resources.stringResource`. Delete `BottomNavBar.kt`.

- [x] **Step 3: Move `CoachTopBar` → `DsTopBar`.** Callers pass the content description now: at each call site (`grep -rln "CoachTopBar" composeApp/src --include="*.kt"`) replace `CoachTopBar(` with `DsTopBar(` and, where `onBackClick` is passed, add `backContentDescription = stringResource(Res.string.back_cd),` (add the `Res`/`stringResource` imports if missing — they are app-side files). Delete `CoachTopBar.kt`.

- [x] **Step 4: Move `MetricCard` → `DsMetricCard`, `HubIconCard` → `DsHubIconCard`, `HubImageCard` → `DsHubImageCard`** per **Files** notes; update call sites via `grep -rlnE "MetricCard|HubIconCard|HubImageCard" composeApp/src --include="*.kt"`; delete the three source files.

- [x] **Step 5:** Verify: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest` — Expected: `BUILD SUCCESSFUL`. Also confirm the old components directory holds only app-side files: `ls composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/` → expect only `DayOfWeekExtensions.kt`, `MediaCaptureBottomSheet.kt`.

- [x] **Step 6:** Commit:
```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/components composeApp/src/commonMain/kotlin/com/coachfoska/app
git commit -m "feat(designsystem): migrate top bar, bottom nav, metric and hub cards"
```

---

### Task 9: Screen sweep — retire old theme constants from all screens

**Files:**
- Modify: every file returned by `grep -rln "import com.coachfoska.app.theme" composeApp/src --include="*.kt"` EXCEPT the `theme/` package itself (~35 files at this point: 28 import `Spacing`, 12 `Sizes`, plus singles for `BrandRed`, `TextAccent`, `Success`, `Error`, `ChartLine`, `muscleGroupColor`).
- Modify: every file returned by `grep -rln "MaterialTheme.colorScheme" composeApp/src/commonMain --include="*.kt"` (~96 files at plan time), replacing color-scheme reads where a semantic token exists.
- Modify (hardcoded/named color leaks): `composeApp/.../ui/profile/ProgressScreen.kt`, `composeApp/.../ui/workout/components/PRBanner.kt`, `composeApp/.../ui/workout/components/SetRow.kt`, `composeApp/.../ui/home/HomeScreen.kt`.

**Interfaces:**
- Consumes: `DsTheme` accessors (Task 4).
- Produces: zero references to `com.coachfoska.app.theme.*` outside the `theme/` package itself (checked by grep; the package is deleted in Task 13), and no `MaterialTheme.colorScheme` reads except the explicit KEEP list in Step 1b.

- [x] **Step 1: Sweep the mechanical imports.** For each file from the grep, apply the universal substitution table from Task 6 (`Spacing.x` → `DsTheme.spacing.x`, `Sizes.touchTarget` → `DsTheme.sizes.touchTarget`, `Metric*` → `DsTheme.type.metric*`, color constants per table), replacing the `com.coachfoska.app.theme.*` import with `import com.coachfoska.designsystem.theme.DsTheme`. Watch for non-composable contexts: `DsTheme.spacing` is `@Composable`-only — if a `Spacing` reference sits in a non-composable helper, hoist the value to a parameter with the call site reading `DsTheme.spacing` (there are no known cases; the compiler will flag any).

- [x] **Step 1b: Sweep `MaterialTheme.colorScheme` reads onto semantic tokens** (spec §9.3 — "where a semantic token exists"; ~715 reads across ~100 files, all mechanical). Enumerate with `grep -rln "MaterialTheme.colorScheme" composeApp/src/commonMain --include="*.kt"`. Apply the Task 6 universal table plus these additional rows:

| Old expression | New expression |
|---|---|
| `MaterialTheme.colorScheme.primaryContainer` | `DsTheme.colors.surfaceElevated` |
| `MaterialTheme.colorScheme.onPrimaryContainer` | `DsTheme.colors.textPrimary` |
| `MaterialTheme.colorScheme.tertiary` | `DsTheme.colors.accent` |
| `MaterialTheme.colorScheme.surfaceContainerHighest` | `DsTheme.colors.surfaceHighest` |

KEEP on `MaterialTheme.colorScheme` (no semantic token exists; the bridge keeps them brand-correct): `inversePrimary`, `inverseSurface`, `inverseOnSurface`, `errorContainer`, `onErrorContainer`, `tertiaryContainer`, `onTertiaryContainer`, `secondaryContainer`. Verify the sweep with `grep -roE "MaterialTheme\.colorScheme\.[a-zA-Z]+" composeApp/src/commonMain --include="*.kt" | awk -F. '{print $NF}' | sort -u` — the output must contain only names from the KEEP list.

**Explicit scope boundary:** `MaterialTheme.typography`/`MaterialTheme.shapes` reads in screens may remain (the bridge makes them identical); raw layout literals (`.dp`, `.sp`, `RoundedCornerShape` in screen layout code) are NOT tokenized — spacing tokens govern components and shared rhythm, not every screen-local offset. Do not sweep those.

- [x] **Step 2: Fix the hardcoded/named color leak files** (deliberate shade normalization onto semantic tokens — the sanctioned visual deviations, per spec §9.3):
  - `ProgressScreen.kt:152`: `if (diff <= 0) Color(0xFF81C784) else Color(0xFFE57373)` → `if (diff <= 0) DsTheme.colors.successSoft else DsTheme.colors.errorSoft` (identical values — no visual change).
  - `PRBanner.kt`: `Color(0xFFFFF3CD)` → `DsTheme.colors.warningContainer`; both `Color(0xFF856404)` → `DsTheme.colors.onWarningContainer` (identical values). Also `RoundedCornerShape(8.dp)` → `DsTheme.shapes.md`.
  - `SetRow.kt:124-125`: `SetType.WARMUP -> Color(0xFFFFC107)` → `DsTheme.colors.warning` (FFC107 → F9A825, one amber shade); `SetType.DROP_SET -> Color(0xFFFF9800)` → `DsTheme.colors.warningStrong` (identical). `SetRow.kt:294`: `SetSaveState.Saved -> Color(0xFF4CAF50)` → `DsTheme.colors.successSoft` (4CAF50 → 81C784, one green shade — chosen over `success` 2E7D32 which would be too dark on the black background). If these expressions live in a non-composable `when` helper, convert the helper to `@Composable` or hoist `DsTheme.colors` into a local before the `when`.
  - `HomeScreen.kt:270`: notification-dot `.background(Color.Red)` → `.background(DsTheme.colors.error)` (pure red → brand error red — deliberate normalization).
  - `ProgressScreen.kt:229`: `drawCircle(Color.Black.copy(alpha = 0.2f), …)` STAYS — it is a chart-point shadow, not a brand color; `Color.Black`/`Color.White` scrims and shadows are allowlisted by the Task 10 guardrail.

- [x] **Step 3: Verify no theme imports remain outside the theme package:**

Run: `grep -rln "import com.coachfoska.app.theme" composeApp/src --include="*.kt"`
Expected output: only `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingProgressBar.kt` (its `CoachFoskaTheme` preview import — handled in Task 13). If anything else appears, sweep it.

- [x] **Step 4:** Run: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest` — Expected: `BUILD SUCCESSFUL`.

- [x] **Step 5:** Commit:
```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app
git commit -m "refactor(app): sweep screens onto DsTheme tokens; retire hardcoded colors"
```

---

### Task 10: Guardrail — source-scan test for hardcoded colors

**Files:**
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/guardrails/NoHardcodedColorsTest.kt`

**Interfaces:**
- Consumes: nothing (pure file-system test).
- Produces: a failing build whenever a raw hex color constructor or disallowed named Compose color appears anywhere in `composeApp/src`.

- [x] **Step 1: Write the test**

```kotlin
package com.coachfoska.app.guardrails

import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Design-system guardrail: raw hex colors and lazy named colors are only
 * allowed inside :designsystem (tokens + brand files). Everything in
 * composeApp must read DsTheme semantic tokens.
 *
 * Allowlisted named colors (NOT flagged): Color.Black, Color.White,
 * Color.Transparent, Color.Unspecified — legitimate for scrims, shadows,
 * and gradient overlays that must not vary by brand.
 */
class NoHardcodedColorsTest {

    @Test
    fun composeAppContainsNoRawHexColors() {
        val root = findRepoRoot()
        val pattern = Regex("""Color\(0x|Color\.(Red|Green|Blue|Yellow|Magenta|Cyan|Gray|LightGray|DarkGray)\b""")
        val offenders = File(root, "composeApp/src").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { file -> file.readText().contains(pattern) }
            .map { it.relativeTo(root).path }
            .toList()
        assertTrue(
            offenders.isEmpty(),
            "Raw hex color constructor or named Compose color found — use DsTheme.colors tokens instead:\n" +
                offenders.joinToString("\n")
        )
    }

    private fun findRepoRoot(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("Could not locate repo root from ${System.getProperty("user.dir")}")
        }
        return dir
    }
}
```

- [x] **Step 2: Run it — expect a controlled failure, then allowlist the legacy package**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.guardrails.NoHardcodedColorsTest"`
Expected: FAIL, listing ONLY files under `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/` (the legacy package that Task 13 deletes). If anything OUTSIDE that package is listed, Task 9 missed a sweep — fix that file first.

Then add this temporary allowlist line directly after the `.filter { it.isFile && it.extension == "kt" }` line (Task 13 removes it):

```kotlin
            .filterNot { it.path.contains("com/coachfoska/app/theme/") } // legacy package, deleted in Task 13
```

Re-run the same command. Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/guardrails/NoHardcodedColorsTest.kt
git commit -m "test(app): guardrail against raw hex colors outside the design system"
```

---

### Task 11: Gallery screen + debug route

**Files:**
- Create: `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/gallery/GalleryScreen.kt`
- Modify: the navigation routes file (find it: `grep -rn "object Settings" composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation --include="*.kt"`) — add a `Gallery` route object next to `Settings`, matching the file's existing `@Serializable` style.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` — register the route.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/profile/SettingsScreen.kt` — debug entry row.

**Interfaces:**
- Consumes: every Ds component (Tasks 6–8), `BrandRegistry`, `DsTheme`.
- Produces: `@Composable fun GalleryScreen(onBackClick: () -> Unit)` — self-themed (nested `DsTheme` with its own brand/dark state), so it can override the app theme for previewing.

- [x] **Step 1: Create `GalleryScreen.kt`**

```kotlin
package com.coachfoska.designsystem.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.brand.Brand
import com.coachfoska.designsystem.brand.BrandRegistry
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsButtonVariant
import com.coachfoska.designsystem.components.DsCard
import com.coachfoska.designsystem.components.DsChip
import com.coachfoska.designsystem.components.DsEmptyState
import com.coachfoska.designsystem.components.DsMetricCard
import com.coachfoska.designsystem.components.DsMetricCardSkeleton
import com.coachfoska.designsystem.components.DsSearchField
import com.coachfoska.designsystem.components.DsSectionHeader
import com.coachfoska.designsystem.components.DsSectionLabel
import com.coachfoska.designsystem.components.DsShimmerBox
import com.coachfoska.designsystem.components.DsStatRow
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.designsystem.theme.DsTheme

/**
 * Debug-only living documentation: every component in all variants/states,
 * with runtime brand + dark/light switching. Wraps itself in its own DsTheme
 * so switching here never touches the app's real theme state.
 */
@Composable
fun GalleryScreen(onBackClick: () -> Unit) {
    var brand by remember { mutableStateOf<Brand>(BrandRegistry.all.first()) }
    var dark by remember { mutableStateOf(true) }

    DsTheme(brand = brand, darkTheme = dark) {
        Column(
            modifier = Modifier.fillMaxSize().background(DsTheme.colors.background)
        ) {
            DsTopBar(title = "DS Gallery", onBackClick = onBackClick, backContentDescription = "Back")

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = DsTheme.spacing.lg),
                horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)
            ) {
                BrandRegistry.all.forEach { b ->
                    DsChip(selected = brand.id == b.id, label = b.id, onClick = { brand = b })
                }
                Spacer(Modifier.weight(1f))
                DsChip(selected = dark, label = if (dark) "dark" else "light", onClick = { dark = !dark })
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(DsTheme.spacing.lg)
            ) {
                item { DsSectionHeader(title = "Brand") }
                item {
                    DsCard {
                        DsStatRow("appName", DsTheme.strings.appName)
                        DsStatRow("coachName", DsTheme.strings.coachName)
                        DsStatRow("features.aiCoach", DsTheme.features.aiCoach.toString())
                    }
                }

                item { DsSectionHeader(title = "Colors") }
                items(colorSwatches()) { (name, color) ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(32.dp).background(color(DsTheme.colors)))
                        Spacer(Modifier.size(DsTheme.spacing.md))
                        Text(name, style = DsTheme.type.bodyMedium, color = DsTheme.colors.textPrimary)
                    }
                }

                item { DsSectionHeader(title = "Typography") }
                item {
                    Column {
                        Text("Display Large", style = DsTheme.type.displayLarge, color = DsTheme.colors.textPrimary)
                        Text("Headline Medium", style = DsTheme.type.headlineMedium, color = DsTheme.colors.textPrimary)
                        Text("Body Large", style = DsTheme.type.bodyLarge, color = DsTheme.colors.textPrimary)
                        Text("Label Small", style = DsTheme.type.labelSmall, color = DsTheme.colors.textSecondary)
                        Text("1234", style = DsTheme.type.metricLarge, color = DsTheme.colors.textPrimary)
                    }
                }

                item { DsSectionHeader(title = "Buttons") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsButton(text = "Primary", onClick = {})
                        DsButton(text = "Secondary", onClick = {}, variant = DsButtonVariant.Secondary)
                        DsButton(text = "Outlined", onClick = {}, variant = DsButtonVariant.Outlined)
                        DsButton(text = "Destructive", onClick = {}, variant = DsButtonVariant.Destructive)
                        DsButton(text = "Disabled", onClick = {}, enabled = false)
                        DsButton(text = "Loading", onClick = {}, isLoading = true)
                    }
                }

                item { DsSectionHeader(title = "Chips + Fields") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                            DsChip(selected = true, label = "Selected", onClick = {})
                            DsChip(selected = false, label = "Unselected", onClick = {}, leadingIcon = Icons.Default.Star)
                        }
                        DsTextField(value = "Value", onValueChange = {}, label = "DsTextField")
                        DsSearchField(value = "", onValueChange = {}, placeholder = "DsSearchField")
                    }
                }

                item { DsSectionHeader(title = "Cards + Metrics") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsMetricCard(value = "1234", label = "metric card", delta = "+5%", deltaPositive = true)
                        DsMetricCard(value = "87", label = "negative delta", delta = "-3%", deltaPositive = false)
                        DsCard { Text("DsCard content", style = DsTheme.type.bodyLarge, color = DsTheme.colors.textPrimary, modifier = Modifier.padding(DsTheme.spacing.lg)) }
                    }
                }

                item { DsSectionHeader(title = "Section labels") }
                item { DsSectionLabel(text = "DS SECTION LABEL") }

                item { DsSectionHeader(title = "Loading / Shimmer") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                        DsShimmerBox(Modifier.fillMaxWidth().height(24.dp))
                        DsMetricCardSkeleton()
                    }
                }

                item { DsSectionHeader(title = "Empty state") }
                item {
                    DsEmptyState(
                        icon = Icons.Default.Star,
                        title = "Nothing here",
                        message = "This is the single empty treatment.",
                        actionLabel = "Action",
                        onAction = {},
                    )
                }
            }
        }
    }
}

private fun colorSwatches(): List<Pair<String, (com.coachfoska.designsystem.tokens.DsColors) -> androidx.compose.ui.graphics.Color>> = listOf(
    "background" to { it.background },
    "surface" to { it.surface },
    "surfaceElevated" to { it.surfaceElevated },
    "textPrimary" to { it.textPrimary },
    "textSecondary" to { it.textSecondary },
    "accent" to { it.accent },
    "textAccent" to { it.textAccent },
    "actionPrimary" to { it.actionPrimary },
    "actionSecondary" to { it.actionSecondary },
    "success" to { it.success },
    "warning" to { it.warning },
    "error" to { it.error },
    "outline" to { it.outline },
    "chartLine" to { it.chartLine },
)
```

Note: if `DsSectionLabel`'s parameter is named `text` vs `title`, match whatever name Task 6 Step 4 produced (`DsSectionLabel(text = …)` is the expected signature, inherited from `CoachSectionHeader(text: String, …)`).

- [x] **Step 2: Add the route.** In the navigation routes file found via the grep in **Files**, add next to `Settings` (matching its serialization style, e.g. `@Serializable data object Gallery` or `@Serializable object Gallery`):

```kotlin
@Serializable
data object Gallery
```

- [x] **Step 3: Register the route in `App.kt`**, after the `composable<Settings> { … }` block:

```kotlin
composable<Gallery> {
    GalleryScreen(onBackClick = { navController.popBackStack() })
}
```

Import: `com.coachfoska.designsystem.gallery.GalleryScreen` (and `Gallery` if the routes file needs explicit import — it's covered by the existing `com.coachfoska.app.navigation.*` wildcard).

- [x] **Step 4: Debug entry in Settings.** In `SettingsScreen.kt`: add parameters `onOpenGallery: () -> Unit = {}` to both `SettingsRoute` and `SettingsScreen` (pass through). Inside the existing debug `SettingsSection` (after the launch-onboarding `DebugRow`), add:

```kotlin
if (BuildKonfig.DEBUG) {
    SettingsDivider()
    SettingsRow(
        title = "Design System Gallery",
        description = "All components, brands, light/dark",
        onClick = onOpenGallery
    )
}
```

Import `com.coachfoska.app.BuildKonfig` if needed. In `App.kt`, pass `onOpenGallery = { navController.navigate(Gallery) }` at the `SettingsRoute(...)` call site.

- [x] **Step 5:** Verify: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest` — Expected: `BUILD SUCCESSFUL`.

- [x] **Step 6:** Commit:
```bash
git add designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/gallery composeApp/src/commonMain/kotlin/com/coachfoska/app
git commit -m "feat(designsystem): debug gallery with brand switcher and dark/light toggle"
```

---

### Task 12: Wire the aiCoach feature flag

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/chat/ChatHubScreen.kt:85`

**Interfaces:**
- Consumes: `DsTheme.features` (Task 4).
- Produces: the AI coach entry respects both the build flag and the brand flag.

- [x] **Step 1:** In `ChatHubScreen.kt` line 85, change:

```kotlin
if (BuildKonfig.AI_COACH_ENABLED) {
```
to:
```kotlin
if (BuildKonfig.AI_COACH_ENABLED && DsTheme.features.aiCoach) {
```
Add `import com.coachfoska.designsystem.theme.DsTheme` if missing.

- [x] **Step 2:** Verify: `./gradlew :composeApp:compileDebugKotlinAndroid` — Expected: `BUILD SUCCESSFUL`. (FoskaBrand has `aiCoach = true`, so behavior is unchanged.)

- [x] **Step 3:** Commit:
```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/chat/ChatHubScreen.kt
git commit -m "feat(app): gate AI coach entry on brand feature flag"
```

---

### Task 13: Teardown — delete the legacy theme package; final verification

**Files:**
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/Theme.kt`, `Color.kt`, `Type.kt`, `Dimens.kt` (the whole `theme/` directory)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingProgressBar.kt` (preview)
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/guardrails/NoHardcodedColorsTest.kt` (remove the temporary allowlist filter if it was added in Task 10)

**Interfaces:**
- Consumes: everything.
- Produces: done state — no theme constant referenced outside `:designsystem`.

- [x] **Step 1:** In `OnboardingProgressBar.kt`, replace the preview wrapper: import `com.coachfoska.designsystem.theme.DsTheme` and `com.coachfoska.designsystem.brand.foska.FoskaBrand` instead of `com.coachfoska.app.theme.CoachFoskaTheme`, and change:
```kotlin
    CoachFoskaTheme { OnboardingProgressBar(progress = 0.4f) }
```
to:
```kotlin
    DsTheme(brand = FoskaBrand, darkTheme = true) { OnboardingProgressBar(progress = 0.4f) }
```

- [x] **Step 2:** Confirm nothing else references the package: `grep -rn "com.coachfoska.app.theme" composeApp/src --include="*.kt"` → the only hits must be inside `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/` itself. Then delete the directory:
```bash
git rm -r composeApp/src/commonMain/kotlin/com/coachfoska/app/theme
```

- [x] **Step 3:** If Task 10 added the `filterNot { … app/theme … }` allowlist line to `NoHardcodedColorsTest.kt`, remove it now.

- [x] **Step 4: Final verification — full suite:**

Run: `./gradlew :designsystem:testDebugUnitTest :composeApp:testDebugUnitTest :composeApp:assembleDebug :composeApp:compileKotlinIosSimulatorArm64`
Expected: `BUILD SUCCESSFUL`; all tests green, including `BrandContrastTest` and `NoHardcodedColorsTest` (now with zero allowlist).

- [x] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingProgressBar.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/guardrails/NoHardcodedColorsTest.kt
git commit -m "refactor(app): delete legacy theme package — design system migration complete"
```

---

## Adding a second brand later (recipe, not a task)

1. Create `designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/brand/<brandid>/<BrandId>Brand.kt` implementing `Brand` (copy `FoskaBrand` as the template; the contrast test will validate the palette automatically).
2. Add it to `BrandRegistry.all`.
3. Set `brand.id=<brandid>` in `local.properties` (or per-flavor Gradle property) — `BuildKonfig.BRAND_ID` picks it up.
4. Android: add a product flavor for applicationId/appName/icon. iOS: duplicate the target/xcconfig for bundle id, name, icon.
5. Brand fonts: drop `.ttf` files in `designsystem/src/commonMain/composeResources/font/` and reference them in the brand's `BrandFonts`.
6. Preview instantly: the new brand appears in the gallery's brand switcher with no wiring.
