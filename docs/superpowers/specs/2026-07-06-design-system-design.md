# Design System (`:designsystem`) — Design Spec

**Date:** 2026-07-06
**Status:** Approved (brainstorming session)
**Goal:** A scalable, whitelabel-ready design system for Coach Foska: token-based theming, brand-agnostic component library, runtime-capable theme engine, full migration of the existing app.

## 1. Decisions (locked)

| Axis | Decision |
|---|---|
| Whitelabel delivery | Build-time brand selection, runtime-capable core. Each brand ships as its own build; the theme engine resolves tokens at runtime from a `Brand` value, so server-driven theming / in-app brand preview can be added later without rearchitecting. |
| Customization scope | Colors + assets, typography (fonts + scale), shapes + spacing density, brand strings + feature flags. |
| Token architecture | Extended Material3: custom semantic token layer via CompositionLocals on top of a bridged `MaterialTheme`. |
| Token authoring | Hand-written Kotlin `Brand` objects (no JSON/codegen, no server fetch — deferred). |
| Module structure | New KMP Gradle module `:designsystem`; app depends on it one-way. |
| Component naming | Neutral `Ds*` prefix (`DsButton`, `DsChip`, …). |
| Gallery | Debug-only gallery screen inside the app (route registered only when `BuildKonfig.DEBUG`), with runtime brand switcher and dark/light toggle. |
| Migration | Full sweep — done means no theme constant is referenced outside `:designsystem`. |
| Portability | The implementation plan must be executable by non-Claude agents (Codex, Gemini): self-contained tasks, explicit file paths, `./gradlew` verification only, no MCP-only tooling. |

## 2. Current state (facts)

- Theme lives in `composeApp/src/commonMain/kotlin/com/coachfoska/app/theme/`:
  `Color.kt` (global vals: black/white/red brand palette, chart colors, `muscleGroupColor()`),
  `Type.kt` (M3 `Typography` + `MetricLarge/MetricMedium/MetricSmall` global vals),
  `Dimens.kt` (`Spacing`, `Sizes` objects), `Theme.kt` (`CoachFoskaTheme` → `MaterialTheme`, hand-mapped light/dark schemes, `Shapes`).
- `core/theme/ThemeRepository.kt`: dark-mode persistence, `StateFlow<Boolean>` + multiplatform Settings.
- 43 files import `com.coachfoska.app.theme` — the migration surface.
- Shared components in `ui/components/`: `CoachButton` (+`CoachButtonVariant`), `CoachOutlinedButton`, `CoachCard`, `CoachSearchField`, `CoachTextField`, `coachTextFieldColors`, `CoachSectionHeader`, `CoachLoadingBox` (in `CoachComponents.kt`), `CoachTopBar`, `BottomNavBar` (+`BottomNavTab` enum), `HubIconCard`, `HubImageCard`, `EmptyState`, `FoskaFilterChip`, `MetricCard`, `SectionHeader`, `Shimmer`, `StatRow`, `MediaCaptureBottomSheet`, `DayOfWeekExtensions`.
- Hardcoded `Color(0x…)` leaks outside the theme package: `ui/profile/ProgressScreen.kt`, `ui/workout/components/PRBanner.kt`, `ui/workout/components/SetRow.kt`.
- BuildKonfig plugin already configured in `composeApp/build.gradle.kts` (`packageName = "com.coachfoska.app"`, fields incl. `DEBUG` boolean, values from `local.properties`).
- `settings.gradle.kts` includes only `:composeApp`; `TYPESAFE_PROJECT_ACCESSORS` enabled.
- Note: root `DESIGN.md` describes an older lime/teal design prompt. The implemented palette in `theme/Color.kt` is the source of truth for the default brand.

## 3. Module & layering

New KMP module `:designsystem` (targets matching `composeApp`: Android + iOS), namespace `com.coachfoska.designsystem`. Dependencies: Compose Multiplatform (foundation, material3, resources), kotlinx basics, Compottie (for `DsLoadingBox`/Lottie assets). **Forbidden dependencies:** domain models, Koin, Ktor/Supabase, navigation — the module is domain-agnostic.

```
designsystem/src/commonMain/kotlin/com/coachfoska/designsystem/
  tokens/
    palette/            # internal raw color ramps (FoskaPalette) — never referenced by components
    DsColors.kt         # @Immutable semantic color set
    DsTypography.kt     # @Immutable text-style set incl. metric styles
    DsShapes.kt         # radius scale
    DsSpacing.kt        # spacing scale
    DsSizes.kt          # touch target, control heights, icon sizes
    DsMotion.kt         # durations + easings
  brand/
    Brand.kt            # brand contract (interface)
    BrandFonts.kt       # FontResource handles; null → system font
    BrandAssets.kt      # logo, illustration, Lottie references
    BrandStrings.kt     # whitelabel-variable copy (appName, coachName, …)
    BrandFeatures.kt    # per-brand feature Booleans
    BrandRegistry.kt    # id → Brand lookup
    foska/FoskaBrand.kt # default brand = current implemented look
  theme/
    DsTheme.kt          # composable fun DsTheme(brand, darkTheme) + object DsTheme accessors
    MaterialBridge.kt   # Brand+mode → M3 ColorScheme/Typography/Shapes mapping
  components/
    DsButton.kt, DsCard.kt, DsTextField.kt, DsSearchField.kt, DsChip.kt,
    DsMetricCard.kt, DsStatRow.kt, DsSectionHeader.kt, DsEmptyState.kt,
    DsTopBar.kt, DsBottomNav.kt, DsShimmer.kt, DsLoadingBox.kt
  gallery/
    GalleryScreen.kt    # debug-only; brand switcher + dark toggle + all components/states
```

### Token layers

1. **Primitives** (`tokens/palette/`, `internal`): raw hex ramps. Only `brand/` files may reference them.
2. **Semantic tokens** (public): what components and screens read. `@Immutable` data classes:
   - `DsColors`: `background`, `surface`, `surfaceElevated`, `textPrimary`, `textSecondary`, `textAccent`, `accent`, `onAccent` (brand accent — red for Foska), `actionPrimary`, `onActionPrimary`, `actionSecondary`, `onActionSecondary` (primary/secondary action surfaces — black/white for Foska, distinct from the accent), `success`, `warning`, `error`, `onError`, `outline`, `outlineSubtle`, `chartLine`, `chartFill`, `chartGrid`, `shimmerBase`, `shimmerHighlight`, `categorical` (data-viz palette replacing `MuscleGroupPalette`), plus `categoricalFor(label: String?): Color` (moves `muscleGroupColor()` logic).
   - `DsTypography`: full ramp (`displayLarge` … `labelSmall`) + `metricLarge/metricMedium/metricSmall`, built from `BrandFonts` + `DsTypographyConfig` (per-brand scale/weight adjustments).
   - `DsShapes` (xs/sm/md/lg/xl radii), `DsSpacing` (xs 4 / sm 8 / md 12 / lg 16 / xl 24 / xxl 32 as today), `DsSizes` (touchTarget 48dp, buttonHeight 56dp, …), `DsMotion`.
3. **Component defaults**: per-component `Defaults` objects (`DsButtonDefaults`, `DsTextFieldDefaults`, …) that read semantic tokens and expose override points.

## 4. Brand contract

```kotlin
interface Brand {
    val id: String
    val lightColors: DsColors
    val darkColors: DsColors
    val fonts: BrandFonts              // FontResource refs; FoskaBrand uses system fonts (null)
    val typographyConfig: DsTypographyConfig
    val shapes: DsShapes
    val spacing: DsSpacing
    val assets: BrandAssets
    val strings: BrandStrings
    val features: BrandFeatures        // e.g. hydration, aiCoach, recipes, activityImport
}
```

- `FoskaBrand` encodes the current implemented look 1:1 (black/white/red, AA-safe `TextAccent`, metric type ramp). The migration is visually neutral.
- `BrandRegistry.fromId(id: String): Brand` with fallback to `FoskaBrand`; brand chosen via new `BuildKonfig.BRAND_ID` string field (default `"foska"`, key `brand.id` in `local.properties`).
- Adding a whitelabel = one `Brand` object + registry entry + app icon/name/flavor wiring (flavor recipe documented in the plan, not built now for a second brand).
- Localization stays in compose resources; `BrandStrings` covers only the whitelabel-variable subset (app display name, coach name, tone-specific phrases). Feature *enforcement* (hiding tabs/routes) stays in the app layer, reading `DsTheme.features`.

## 5. Theme engine & reactivity

`DsTheme` mirrors the `MaterialTheme` pattern — composable function + accessor object:

```kotlin
@Composable
fun DsTheme(
    brand: Brand,
    darkTheme: Boolean,
    content: @Composable () -> Unit
) { /* provides CompositionLocals + bridged MaterialTheme */ }

object DsTheme {
    val colors: DsColors @Composable get() = LocalDsColors.current
    val type: DsTypography @Composable get() = LocalDsTypography.current
    val shapes: DsShapes @Composable get() = LocalDsShapes.current
    val spacing: DsSpacing @Composable get() = LocalDsSpacing.current
    val sizes: DsSizes @Composable get() = LocalDsSizes.current
    val motion: DsMotion @Composable get() = LocalDsMotion.current
    val assets: BrandAssets @Composable get() = LocalBrand.current.assets
    val strings: BrandStrings @Composable get() = LocalBrand.current.strings
    val features: BrandFeatures @Composable get() = LocalBrand.current.features
}
```

- Locals are `staticCompositionLocalOf`; token classes are `@Immutable`. Theme switches (dark toggle, gallery brand switch) recompose the tree — rare events, acceptable, standard.
- **Material bridge:** `DsTheme` internally invokes `MaterialTheme(colorScheme, typography, shapes)` derived from the active brand/mode, so raw M3 widgets (dialogs, date pickers, ripples, `ModalBottomSheet`) inherit brand styling automatically. `MaterialTheme.colorScheme` reads in app code remain *correct*, but new code should prefer `DsTheme`.
- **Reactivity:** `ThemeRepository` stays in `composeApp` unchanged and keeps owning dark mode as `StateFlow<Boolean>`; the app root collects it and passes it into `DsTheme`. Brand is a constructor-style parameter: `BuildKonfig.BRAND_ID` in production, runtime-switchable state in the gallery. Server-driven theming later = deserialize a `Brand` and pass it in — no rearchitecting.
- `CoachFoskaTheme` is deleted at the end of migration; the app root composable calls `DsTheme` directly.

## 6. Component library

### Migration map

| Current (composeApp) | New (`:designsystem`) | Notes |
|---|---|---|
| `CoachButton` + `CoachOutlinedButton` + `CoachButtonVariant` | `DsButton`, `variant: DsButtonVariant` (Primary, Secondary, Outlined, Destructive) | Outlined folds in as a variant |
| `CoachCard` | `DsCard` | |
| `CoachTextField`, `coachTextFieldColors` | `DsTextField` + `DsTextFieldDefaults` | |
| `CoachSearchField` | `DsSearchField` | |
| `CoachSectionHeader`, `SectionHeader` | `DsSectionHeader` | merge the two |
| `CoachLoadingBox` | `DsLoadingBox` | Lottie ref comes from `BrandAssets` |
| `CoachTopBar` | `DsTopBar` | |
| `BottomNavBar` | `DsBottomNav` | takes generic items `(icon, label, selected, onClick)`; `BottomNavTab` enum **stays in app** (references app string resources + navigation) |
| `FoskaFilterChip` | `DsChip` | |
| `MetricCard` | `DsMetricCard` | |
| `StatRow` | `DsStatRow` | |
| `EmptyState` | `DsEmptyState` | painters/strings passed as parameters, no app resource refs |
| `Shimmer` | `DsShimmer` | colors from `DsColors.shimmerBase/Highlight` |
| `MediaCaptureBottomSheet`, `DayOfWeekExtensions`, `ExerciseLogCard` | **stay in app** | domain/resource-coupled; rebuilt on Ds components where applicable |

No deprecation shims — call sites updated in the same sweep.

### API conventions (all Ds components)

- Stateless / state-hoisted; `modifier: Modifier = Modifier` as first optional parameter; slot APIs for flexible content; variants as enums; overrides via `Defaults` objects.
- Zero literals: every color/size/style/duration read from `DsTheme`.
- No references to app resources (`coachfoska.composeapp.generated.resources`); assets arrive as parameters or via `BrandAssets`.

## 7. Gallery

`GalleryScreen` lives in `designsystem/gallery/`. The app registers a route to it only when `BuildKonfig.DEBUG` is true, reachable from Settings. Contents: every Ds component in all variants and states (enabled/disabled/loading/error), typography ramp, color swatches with token names, spacing/shape scales — under an in-screen brand switcher (all `BrandRegistry` entries) and dark/light toggle. Serves as living documentation and whitelabel preview.

## 8. Guardrails & testing

- **Source-scan test** (JVM unit test in `composeApp`): walks `composeApp/src/*/kotlin` and fails on `Color(0x` occurrences (allowlist: none at end state). Prevents hardcoded-color regressions; runs via `./gradlew` in any environment.
- **Brand contrast test** (unit test in `:designsystem`): for every registered `Brand` × light/dark, assert WCAG AA contrast ratios for key pairs — `textPrimary`/`background` ≥ 4.5, `textSecondary`/`background` ≥ 4.5, `onActionPrimary`/`actionPrimary` ≥ 4.5, `onAccent`/`accent` ≥ 4.5, `onError`/`error` ≥ 4.5, and `textAccent`/`background` ≥ 3.0 (large-text AA — accent text is reserved for large/bold usage per the existing `Color.kt` comment; Foska's `BrandRedLight` on black is ~4.1:1). A bad whitelabel palette fails the build.
- **Behavior neutrality:** existing test suite stays green; `FoskaBrand` must reproduce current visuals exactly (token values copied, not re-derived).

## 9. Migration plan (phases)

1. **Foundation:** create `:designsystem` module (settings.gradle.kts, build.gradle.kts), tokens, brand contract, `FoskaBrand`, `DsTheme` + Material bridge, `BRAND_ID` BuildKonfig field. App still compiles on the old theme.
2. **Components:** move + rename the shared components per the migration map in §6 (16 source declarations → 13 Ds components); update all call sites.
3. **Screen sweep** (43 files importing `com.coachfoska.app.theme`): `Spacing.*` → `DsTheme.spacing.*`, `Metric*` → `DsTheme.type.metric*`, named colors (`BrandRed`, `Gray700`, …) → semantic tokens, hardcoded `Color(0x…)` in `ProgressScreen`/`PRBanner`/`SetRow` → tokens, `muscleGroupColor()` → `DsTheme.colors.categoricalFor()`.
4. **Gallery + guardrails:** gallery screen + debug route, source-scan test, contrast test.
5. **Teardown:** swap app root to `DsTheme`, delete `composeApp/.../theme/` package and `CoachFoskaTheme`. Done = the only theme code in `composeApp` is the `ThemeRepository` wiring and `BottomNavTab`-style app-level definitions.

Each phase leaves the app compiling and tests green (`./gradlew build`).

## 10. Out of scope (deferred by design, not blocked by it)

- Server-driven brand documents (enabled later by feeding `DsTheme` a deserialized `Brand`).
- JSON token files / codegen pipelines (worth revisiting at ~10+ brands or designer-owned tokens).
- Animated theme-transition effects.
- Second-brand flavor/target wiring (Android flavors, iOS targets, icons) — recipe documented in the implementation plan only.
- Refreshing root `DESIGN.md` (stale design prompt).
