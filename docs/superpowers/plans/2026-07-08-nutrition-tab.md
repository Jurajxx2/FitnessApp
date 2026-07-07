# Nutrition Tab (Macro Summary + Barcode Scanner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily consumed-vs-target macro summary to the top of the Nutrition hub, and an Android barcode scanner that looks food up via Open Food Facts and auto-fills a meal-capture food entry.

**Architecture:** Reuse the existing Home-tab macro presentation by extracting it into a shared component; wire the already-existing `GetDailyNutritionSummaryUseCase` / `CalculateMacroTargetsUseCase` / `GetUserProfileUseCase` into `NutritionViewModel`. For barcode, follow the existing `expect/actual` capture pattern (Android real via ML Kit Google code scanner; iOS no-op stub) and add an `OpenFoodFactsDataSource` + pure `toFood()` mapper + `LookupFoodByBarcodeUseCase`, surfaced through MVI into the meal-capture food-search dialog.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform, Koin, Ktor, kotlinx.serialization, kotlinx.datetime, ML Kit `play-services-code-scanner`, JUnit + mockk + kotlinx-coroutines-test.

**Reference spec:** `docs/superpowers/specs/2026-07-08-nutrition-tab-design.md`

## Global Constraints

- **Clean Architecture / MVI:** presentation (`NutritionViewModel` + `NutritionState` + `NutritionIntent`) → domain (use cases) → data (data sources). Follow the existing nutrition package layout.
- **Localization:** every new user-facing string goes in BOTH `composeApp/src/commonMain/composeResources/values/strings.xml` (**Czech = default**) and `composeApp/src/commonMain/composeResources/values-en/strings.xml` (English). Czech first.
- **Git staging:** always stage explicit paths. NEVER `git add -A` or `git add .` (the repo has much untracked cruft).
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **iOS is a stub target:** iOS camera actuals are no-ops (`MediaCapture.ios.kt`). The barcode iOS actual MUST be a no-op too. Do not add iOS camera code.
- **Design system:** use `DsTheme.colors.*` / `MaterialTheme.typography.*`; do not hardcode colors. Match surrounding style.
- **Gradle:** all `./gradlew` commands are pre-approved. Android compile check: `./gradlew :composeApp:compileDebugKotlinAndroid`. Unit tests: `./gradlew :composeApp:testDebugUnitTest`.
- **Package roots:** app code `com.coachfoska.app`; design system `com.coachfoska.designsystem`.

---

## File Structure

**Feature 1 — Macro summary**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MacroSummaryRow.kt` — shared macro row (extracted from Home).
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt` — use the extracted component.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt` — summary/targets fields.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt` — `LoadDailySummary`.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt` — load summary+targets.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` — extend the `NutritionViewModel` factory.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt` — render + resume reload.
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`.

**Feature 2 — Barcode scanner**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsDtos.kt` — DTOs + `toFood()` mapper.
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/OpenFoodFactsDataSource.kt` — HTTP lookup.
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCase.kt`.
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.kt` — `expect`.
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.android.kt` — ML Kit actual.
- Create: `composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.ios.kt` — no-op actual.
- Modify: `NutritionState.kt`, `NutritionIntent.kt`, `NutritionViewModel.kt`, `AppModule.kt` — MVI wiring + DI.
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt` — scan button + auto-fill.
- Modify: `gradle/libs.versions.toml`, `composeApp/build.gradle.kts`, `composeApp/src/androidMain/AndroidManifest.xml`.
- Modify: both `strings.xml` files.
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsMapperTest.kt`, `.../domain/usecase/nutrition/LookupFoodByBarcodeUseCaseTest.kt`, and `NutritionViewModelTest.kt`.

---

## Task 1: Extract `MacroSummaryRow` shared component

Pure refactor: move Home's private `MacroRow`/`MacroItem` into a shared, public component so the Nutrition hub can reuse it. Behavior-preserving — Home must look identical.

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MacroSummaryRow.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt` (remove the private `MacroRow`/`MacroItem`, ~lines 330–376; add an import + call)

**Interfaces:**
- Produces: `@Composable fun MacroSummaryRow(summary: DailyNutritionSummary, targets: MacroTargets?, modifier: Modifier = Modifier)` in package `com.coachfoska.app.ui.components`.

- [ ] **Step 1: Create the shared component file**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MacroSummaryRow.kt` with the exact logic currently in `HomeScreen.kt` (public `MacroSummaryRow` renamed from `MacroRow`; keep `MacroItem` private in this file):

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.designsystem.theme.DsTheme
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.macro_kcal
import coachfoska.composeapp.generated.resources.macro_protein
import coachfoska.composeapp.generated.resources.macro_carbs
import coachfoska.composeapp.generated.resources.macro_fat
import org.jetbrains.compose.resources.stringResource

@Composable
fun MacroSummaryRow(
    summary: DailyNutritionSummary,
    targets: MacroTargets?,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth()) {
        MacroItem(stringResource(Res.string.macro_kcal), summary.calories, targets?.calories, modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_protein), summary.proteinG, targets?.proteinG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_carbs), summary.carbsG, targets?.carbsG, suffix = "g", modifier = Modifier.weight(1f))
        MacroItem(stringResource(Res.string.macro_fat), summary.fatG, targets?.fatG, suffix = "g", modifier = Modifier.weight(1f))
    }
}

@Composable
private fun MacroItem(
    label: String,
    value: Float,
    target: Float?,
    suffix: String = "",
    modifier: Modifier = Modifier,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier.padding(horizontal = 4.dp)) {
        Text(
            text = "${value.toInt()}$suffix",
            style = MaterialTheme.typography.headlineMedium,
            color = DsTheme.colors.textPrimary
        )
        if (target != null && target > 0f) {
            Text(
                text = "/ ${target.toInt()}$suffix",
                style = MaterialTheme.typography.labelSmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (value / target).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(50)),
                color = DsTheme.colors.actionPrimary,
                trackColor = DsTheme.colors.textPrimary.copy(alpha = 0.08f)
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DsTheme.colors.textPrimary.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
    }
}
```

- [ ] **Step 2: Remove the private copies from `HomeScreen.kt` and call the shared one**

In `HomeScreen.kt`:
1. Delete the private `MacroRow` and `MacroItem` functions (the block spanning roughly lines 330–376, ending at the final closing brace of `MacroItem`).
2. Change the call site (`MacroRow(nutrition, state.macroTargets)`, ~line 211) to `MacroSummaryRow(nutrition, state.macroTargets)`.
3. Add import `import com.coachfoska.app.ui.components.MacroSummaryRow`.
4. Remove any now-unused imports in `HomeScreen.kt` that were used ONLY by the deleted functions (verify the compiler flags — e.g. if `macro_kcal`/`macro_protein`/`macro_carbs`/`macro_fat` string imports or `LinearProgressIndicator` are no longer referenced elsewhere in the file, delete them). Keep imports still used by other Home composables (e.g. `LinearProgressIndicator` is also used by `WaterProgressRow` — do NOT remove that one).

- [ ] **Step 3: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL`. If it fails with "unused import" it won't (Kotlin doesn't fail on unused imports); if it fails with "unresolved reference" you deleted an import still needed elsewhere — restore it.

- [ ] **Step 4: Run the existing test suite to confirm no regressions**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL` (all existing tests still pass; the refactor changes no behavior).

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/MacroSummaryRow.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt
git commit -m "$(cat <<'EOF'
refactor(ui): extract shared MacroSummaryRow from HomeScreen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Load daily macro summary + targets into `NutritionViewModel`

TDD. Add state fields, a `LoadDailySummary` intent, and a `loadDailySummary()` that fetches today's summary + profile-derived targets on init and on the intent. Extend the DI factory and the test helper.

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (`NutritionViewModel` factory ~line 272)
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`

**Interfaces:**
- Consumes: `GetDailyNutritionSummaryUseCase(userId, LocalDate): Result<DailyNutritionSummary>`, `CalculateMacroTargetsUseCase(user: User): MacroTargets?`, `GetUserProfileUseCase(userId): Result<User>` (all already exist), `todayDate(): LocalDate` (`com.coachfoska.app.core.util.todayDate`).
- Produces: `NutritionState.nutritionSummary: DailyNutritionSummary?`, `NutritionState.macroTargets: MacroTargets?`, `NutritionState.isSummaryLoading: Boolean`; `NutritionIntent.LoadDailySummary`.

- [ ] **Step 1: Write the failing tests**

Add to `NutritionViewModelTest.kt`. First, extend the class fixtures — add a `UserRepository` mock and the three new use cases to the `viewModel()` helper, plus a default profile stub and a default summary stub:

```kotlin
// --- add imports at top of the test file ---
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.mockk.coVerify
```

Add a second repo mock field next to `private val repo`:

```kotlin
    private val userRepo: UserRepository = mockk()
```

Replace the `viewModel()` helper with the extended constructor call (note the new parameters — keep existing ones):

```kotlin
    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        analyzeMealPhotoUseCase = AnalyzeMealPhotoUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        getRecipesUseCase = GetRecipesUseCase(repo),
        searchFoodsUseCase = SearchFoodsUseCase(repo),
        getFavoriteRecipeIdsUseCase = GetFavoriteRecipeIdsUseCase(repo),
        toggleFavoriteRecipeUseCase = ToggleFavoriteRecipeUseCase(repo),
        getRecipeByIdUseCase = GetRecipeByIdUseCase(repo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(repo),
        calculateMacroTargetsUseCase = CalculateMacroTargetsUseCase(),
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        userId = "user-1"
    )
```

Extend `setUp()` with default stubs for the new calls:

```kotlin
    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.getDailyNutritionSummary(any(), any()) } returns
            Result.success(DailyNutritionSummary(1200f, 80f, 100f, 40f))
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
    }
```

Add the fixture and the new tests:

```kotlin
    @Test
    fun `init loads daily summary and computes macro targets from profile`() = runTest {
        val vm = viewModel()

        val s = vm.state.value
        assertNotNull(s.nutritionSummary)
        assertEquals(1200f, s.nutritionSummary!!.calories)
        assertNotNull(s.macroTargets)   // aUser() has complete stats
        assertFalse(s.isSummaryLoading)
    }

    @Test
    fun `incomplete profile leaves macro targets null but keeps summary`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser(weightKg = null))

        val vm = viewModel()

        assertNotNull(vm.state.value.nutritionSummary)
        assertNull(vm.state.value.macroTargets)
    }

    @Test
    fun `LoadDailySummary reloads the summary`() = runTest {
        val vm = viewModel()               // init -> 1 call
        vm.onIntent(NutritionIntent.LoadDailySummary)   // -> 2nd call

        coVerify(exactly = 2) { repo.getDailyNutritionSummary(any(), any()) }
    }

    @Test
    fun `daily summary load failure is non-fatal`() = runTest {
        coEvery { repo.getDailyNutritionSummary(any(), any()) } returns
            Result.failure(RuntimeException("offline"))

        val vm = viewModel()

        assertNull(vm.state.value.nutritionSummary)
        assertFalse(vm.state.value.isSummaryLoading)
    }
```

Add the `aUser` fixture near the bottom with the other `private fun a...()` fixtures:

```kotlin
private fun aUser(
    weightKg: Float? = 80f,
    heightCm: Float? = 180f,
    age: Int? = 30,
    activityLevel: ActivityLevel? = ActivityLevel.MODERATELY_ACTIVE,
    goal: FitnessGoal? = FitnessGoal.STAY_FIT,
) = User(
    id = "user-1", email = "u@e.com", fullName = "U",
    age = age, heightCm = heightCm, weightKg = weightKg,
    goal = goal, activityLevel = activityLevel, onboardingComplete = true,
)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest"`
Expected: FAIL — compilation error (`NutritionViewModel` has no such constructor parameters / `NutritionIntent.LoadDailySummary` unresolved / `nutritionSummary` unresolved).

- [ ] **Step 3: Add the state fields**

In `NutritionState.kt`, add these fields to the `NutritionState` data class (near the other loading flags; `DailyNutritionSummary` and `MacroTargets` need imports):

```kotlin
// add imports
import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.MacroTargets

// add fields inside NutritionState(...)
    val nutritionSummary: DailyNutritionSummary? = null,
    val macroTargets: MacroTargets? = null,
    val isSummaryLoading: Boolean = false,
```

- [ ] **Step 4: Add the intent**

In `NutritionIntent.kt`, add inside the sealed interface:

```kotlin
    data object LoadDailySummary : NutritionIntent
```

- [ ] **Step 5: Wire the ViewModel**

In `NutritionViewModel.kt`:

Add imports:
```kotlin
import com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.core.util.todayDate
import kotlinx.coroutines.async
```
(`todayDate` may already be imported — keep a single import.)

Add the three constructor parameters (before `userId`):
```kotlin
    private val getDailyNutritionSummaryUseCase: GetDailyNutritionSummaryUseCase,
    private val calculateMacroTargetsUseCase: CalculateMacroTargetsUseCase,
    private val getUserProfileUseCase: GetUserProfileUseCase,
```

In `init`, add after the existing `onIntent(NutritionIntent.LoadMealPlan)`:
```kotlin
        loadDailySummary()
```

Add the `LoadDailySummary` branch in the `when (intent)`:
```kotlin
            NutritionIntent.LoadDailySummary -> loadDailySummary()
```

Add the loader function:
```kotlin
    private fun loadDailySummary() {
        viewModelScope.launch {
            _state.update { it.copy(isSummaryLoading = true) }
            val today = todayDate()
            val summaryDeferred = async { getDailyNutritionSummaryUseCase(userId, today) }
            val profileDeferred = async { getUserProfileUseCase(userId) }

            val summaryResult = summaryDeferred.await()
            val profileResult = profileDeferred.await()

            summaryResult.onFailure { e -> Napier.e("loadDailySummary summary failed", e, tag = TAG) }
            profileResult.onFailure { e -> Napier.e("loadDailySummary profile failed", e, tag = TAG) }

            val targets = profileResult.getOrNull()?.let { calculateMacroTargetsUseCase(it) }
            _state.update {
                it.copy(
                    isSummaryLoading = false,
                    nutritionSummary = summaryResult.getOrNull() ?: it.nutritionSummary,
                    macroTargets = targets ?: it.macroTargets,
                )
            }
        }
    }
```

- [ ] **Step 6: Extend the DI factory**

In `AppModule.kt`, update the `NutritionViewModel` factory (~line 272) to pass the three new dependencies (add three `get()` in the constructor order — summary, targets, profile — before `userId`):

```kotlin
    viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
```

(That is 12 `get()` calls now. The order matches the constructor: the last three added `get()`s resolve `GetDailyNutritionSummaryUseCase`, `CalculateMacroTargetsUseCase`, `GetUserProfileUseCase`, which are already registered in this module.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest"`
Expected: PASS (all tests, including the four new ones).

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt
git commit -m "$(cat <<'EOF'
feat(nutrition): load daily macro summary + targets in NutritionViewModel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Render the macro summary on the Nutrition hub

UI wiring. Show the summary card at the top of `NutritionHubScreen`, and reload it on every hub resume.

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt`

**Interfaces:**
- Consumes: `MacroSummaryRow` (Task 1), `NutritionState.nutritionSummary/macroTargets/isSummaryLoading` (Task 2), `NutritionIntent.LoadDailySummary` (Task 2).

- [ ] **Step 1: Add the resume-reload effect in `NutritionHubRoute`**

In `NutritionHubScreen.kt`, add imports:
```kotlin
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.Lifecycle
import com.coachfoska.app.ui.components.MacroSummaryRow
import com.coachfoska.designsystem.components.DsLoadingBox
import coachfoska.composeapp.generated.resources.start_logging_meals
```
(`DsLoadingBox` is already imported — keep single import.)

In `NutritionHubRoute`, replace the existing `LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }` block by ADDING a resume effect next to it (keep the recipes load):
```kotlin
    LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        viewModel.onIntent(NutritionIntent.LoadDailySummary)
    }
```

- [ ] **Step 2: Render the summary card at the top of the hub content**

In `NutritionHubScreen` (the stateless composable), inside the inner `Column(modifier = Modifier.padding(horizontal = 16.dp), ...)`, add the summary card as the FIRST child, above the `// Log meal — primary entry point` Button. Wrap in the same Surface style Home uses:

```kotlin
import androidx.compose.material3.Surface
// ...

            // Daily macro summary
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DsTheme.colors.textPrimary.copy(alpha = 0.03f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    when {
                        state.isSummaryLoading && state.nutritionSummary == null ->
                            DsLoadingBox(modifier = Modifier.fillMaxWidth().height(72.dp))
                        state.nutritionSummary != null ->
                            MacroSummaryRow(state.nutritionSummary!!, state.macroTargets)
                        else ->
                            Text(
                                text = stringResource(Res.string.start_logging_meals),
                                style = MaterialTheme.typography.bodyMedium,
                                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
                            )
                    }
                }
            }
```

(`RoundedCornerShape`, `Column`, `padding`, `height`, `fillMaxWidth`, `Text`, `MaterialTheme`, `stringResource`, `DsTheme` are all already imported in this file.)

- [ ] **Step 3: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Run the full test suite**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt
git commit -m "$(cat <<'EOF'
feat(nutrition): show daily macro summary on the hub with resume reload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Open Food Facts DTOs + `toFood()` pure mapper

TDD on a pure function — no HTTP, no mockk. This is the barcode → `Food` translation.

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsDtos.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsMapperTest.kt`

**Interfaces:**
- Produces: `OpenFoodFactsResponse`, `OpenFoodFactsProduct`, `OpenFoodFactsNutriments` (all `@Serializable`), and `fun OpenFoodFactsResponse.toFood(): Food?` in package `com.coachfoska.app.data.remote.dto`.

- [ ] **Step 1: Write the failing tests**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsMapperTest.kt`:

```kotlin
package com.coachfoska.app.data.remote.dto

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class OpenFoodFactsMapperTest {

    private fun response(
        code: String? = "737628064502",
        name: String? = "Peanut Butter",
        brands: String? = "Acme",
        kcal: Float? = 588f,
        protein: Float? = 25f,
        carbs: Float? = 20f,
        fat: Float? = 50f,
        product: Boolean = true,
    ) = OpenFoodFactsResponse(
        status = 1,
        code = code,
        product = if (product) OpenFoodFactsProduct(
            productName = name,
            brands = brands,
            servingSize = "32 g",
            nutriments = OpenFoodFactsNutriments(
                energyKcal100g = kcal,
                proteins100g = protein,
                carbohydrates100g = carbs,
                fat100g = fat,
            )
        ) else null
    )

    @Test
    fun `maps a complete product to Food per 100g`() {
        val food = response().toFood()!!
        assertEquals("737628064502", food.id)
        assertEquals("Peanut Butter", food.name)
        assertEquals(588f, food.calories)
        assertEquals(25f, food.proteinG)
        assertEquals(20f, food.carbsG)
        assertEquals(50f, food.fatG)
        assertEquals(100f, food.servingSize)
        assertEquals("g", food.servingUnit)
        assertEquals("Acme", food.brand)
        assertEquals(false, food.isVerified)
    }

    @Test
    fun `null product returns null`() {
        assertNull(response(product = false).toFood())
    }

    @Test
    fun `blank name returns null`() {
        assertNull(response(name = "  ").toFood())
    }

    @Test
    fun `missing kcal returns null`() {
        assertNull(response(kcal = null).toFood())
    }

    @Test
    fun `missing non-kcal nutriments coerce to zero`() {
        val food = response(protein = null, carbs = null, fat = null).toFood()!!
        assertEquals(0f, food.proteinG)
        assertEquals(0f, food.carbsG)
        assertEquals(0f, food.fatG)
    }

    @Test
    fun `falls back to name as id when code is null`() {
        assertEquals("Peanut Butter", response(code = null).toFood()!!.id)
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.remote.dto.OpenFoodFactsMapperTest"`
Expected: FAIL — compilation error (`OpenFoodFactsResponse` unresolved).

- [ ] **Step 3: Implement the DTOs + mapper**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsDtos.kt`:

```kotlin
package com.coachfoska.app.data.remote.dto

import com.coachfoska.app.domain.model.Food
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OpenFoodFactsResponse(
    val status: Int? = null,
    val code: String? = null,
    val product: OpenFoodFactsProduct? = null,
)

@Serializable
data class OpenFoodFactsProduct(
    @SerialName("product_name") val productName: String? = null,
    val brands: String? = null,
    @SerialName("serving_size") val servingSize: String? = null,
    val nutriments: OpenFoodFactsNutriments? = null,
)

@Serializable
data class OpenFoodFactsNutriments(
    @SerialName("energy-kcal_100g") val energyKcal100g: Float? = null,
    @SerialName("proteins_100g") val proteins100g: Float? = null,
    @SerialName("carbohydrates_100g") val carbohydrates100g: Float? = null,
    @SerialName("fat_100g") val fat100g: Float? = null,
)

/**
 * Maps an Open Food Facts response to a [Food] (per-100g serving). Success is keyed on data
 * presence, not the version-dependent `status` field. Returns null if there is no product,
 * no name, or no calorie value — the caller then shows a not-found message.
 */
fun OpenFoodFactsResponse.toFood(): Food? {
    val p = product ?: return null
    val name = p.productName?.takeIf { it.isNotBlank() } ?: return null
    val kcal = p.nutriments?.energyKcal100g ?: return null
    return Food(
        id = code ?: name,
        name = name,
        calories = kcal,
        proteinG = p.nutriments.proteins100g ?: 0f,
        carbsG = p.nutriments.carbohydrates100g ?: 0f,
        fatG = p.nutriments.fat100g ?: 0f,
        servingSize = 100f,
        servingUnit = "g",
        brand = p.brands?.takeIf { it.isNotBlank() },
        isVerified = false,
    )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.remote.dto.OpenFoodFactsMapperTest"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsDtos.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/OpenFoodFactsMapperTest.kt
git commit -m "$(cat <<'EOF'
feat(nutrition): add Open Food Facts DTOs and toFood mapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `OpenFoodFactsDataSource` + `LookupFoodByBarcodeUseCase`

TDD the use case with a mocked data source (matching the codebase's mockk convention). The data source itself is a thin Ktor GET.

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/OpenFoodFactsDataSource.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCase.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (register both)
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCaseTest.kt`

**Interfaces:**
- Consumes: `OpenFoodFactsResponse` + `toFood()` (Task 4), shared `HttpClient` (DI single).
- Produces: `class OpenFoodFactsDataSource(httpClient: HttpClient) { suspend fun lookup(barcode: String): OpenFoodFactsResponse }`; `class LookupFoodByBarcodeUseCase(dataSource: OpenFoodFactsDataSource) { suspend operator fun invoke(barcode: String): Result<Food?> }`.

- [ ] **Step 1: Write the failing tests**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCaseTest.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.OpenFoodFactsNutriments
import com.coachfoska.app.data.remote.dto.OpenFoodFactsProduct
import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LookupFoodByBarcodeUseCaseTest {

    private val dataSource: OpenFoodFactsDataSource = mockk()
    private val useCase = LookupFoodByBarcodeUseCase(dataSource)

    @Test
    fun `returns mapped Food on a found product`() = runTest {
        coEvery { dataSource.lookup("123") } returns OpenFoodFactsResponse(
            status = 1, code = "123",
            product = OpenFoodFactsProduct(
                productName = "Milk", brands = "Farm", servingSize = "250 ml",
                nutriments = OpenFoodFactsNutriments(energyKcal100g = 42f, proteins100g = 3.4f, carbohydrates100g = 5f, fat100g = 1f)
            )
        )

        val food = useCase("123").getOrNull()
        assertEquals("Milk", food?.name)
        assertEquals(42f, food?.calories)
    }

    @Test
    fun `returns success-null when product not found`() = runTest {
        coEvery { dataSource.lookup("000") } returns OpenFoodFactsResponse(status = 0, code = "000", product = null)

        val result = useCase("000")
        assertTrue(result.isSuccess)
        assertNull(result.getOrNull())
    }

    @Test
    fun `returns failure on network error`() = runTest {
        coEvery { dataSource.lookup(any()) } throws RuntimeException("offline")

        val result = useCase("123")
        assertTrue(result.isFailure)
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCaseTest"`
Expected: FAIL — compilation error (`OpenFoodFactsDataSource` / `LookupFoodByBarcodeUseCase` unresolved).

- [ ] **Step 3: Implement the data source**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/OpenFoodFactsDataSource.kt`:

```kotlin
package com.coachfoska.app.data.remote.datasource

import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.http.HttpHeaders

/**
 * Looks up a product by barcode from the Open Food Facts v2 API. Uses the shared [HttpClient]
 * (JSON content negotiation is already installed). OFF asks callers to send a descriptive
 * User-Agent.
 */
class OpenFoodFactsDataSource(private val httpClient: HttpClient) {

    suspend fun lookup(barcode: String): OpenFoodFactsResponse =
        httpClient.get("https://world.openfoodfacts.org/api/v2/product/$barcode.json") {
            parameter("fields", "code,product_name,brands,serving_size,nutriments")
            header(HttpHeaders.UserAgent, "CoachFoska/1.0 (Android)")
        }.body()
}
```

- [ ] **Step 4: Implement the use case**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCase.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.toFood
import com.coachfoska.app.domain.model.Food

/**
 * Looks a barcode up via Open Food Facts and maps it to a [Food].
 * Success with a null value means "no usable product for this barcode" (caller shows not-found).
 */
class LookupFoodByBarcodeUseCase(private val dataSource: OpenFoodFactsDataSource) {
    suspend operator fun invoke(barcode: String): Result<Food?> =
        runCatching { dataSource.lookup(barcode).toFood() }
}
```

- [ ] **Step 5: Register both in DI**

In `AppModule.kt`, add near the other nutrition data source / use case registrations:

```kotlin
// with the other data sources (e.g. near MealRemoteDataSource registration)
    single { OpenFoodFactsDataSource(get()) }
// with the other nutrition use cases (e.g. near SearchFoodsUseCase registration)
    factory { LookupFoodByBarcodeUseCase(get()) }
```

Add the imports at the top of `AppModule.kt`:
```kotlin
import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCase
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCaseTest"`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/OpenFoodFactsDataSource.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCase.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/LookupFoodByBarcodeUseCaseTest.kt
git commit -m "$(cat <<'EOF'
feat(nutrition): Open Food Facts data source + barcode lookup use case

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Barcode MVI wiring in `NutritionViewModel`

TDD. Add the barcode state fields, intents, and handler.

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (`NutritionViewModel` factory — one more `get()`)
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`

**Interfaces:**
- Consumes: `LookupFoodByBarcodeUseCase` (Task 5), `Food` (`com.coachfoska.app.domain.model.Food`, already imported in `NutritionState`).
- Produces: `NutritionState.isLookingUpBarcode/barcodeFood/barcodeNotFound`; `NutritionIntent.LookupBarcode(barcode)`, `NutritionIntent.BarcodeConsumed`.

- [ ] **Step 1: Write the failing tests**

Add to `NutritionViewModelTest.kt`. First extend the `viewModel()` helper: add a mocked data source field and pass the use case (add the parameter LAST, before `userId`):

```kotlin
// add imports
import com.coachfoska.app.data.remote.datasource.OpenFoodFactsDataSource
import com.coachfoska.app.data.remote.dto.OpenFoodFactsNutriments
import com.coachfoska.app.data.remote.dto.OpenFoodFactsProduct
import com.coachfoska.app.data.remote.dto.OpenFoodFactsResponse
import com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCase

// add field near the other mocks
    private val offDataSource: OpenFoodFactsDataSource = mockk()
```

Add to the `viewModel()` constructor call, after `getUserProfileUseCase = ...` and before `userId`:
```kotlin
        lookupFoodByBarcodeUseCase = LookupFoodByBarcodeUseCase(offDataSource),
```

Add tests:
```kotlin
    @Test
    fun `LookupBarcode success sets barcodeFood and clears loading`() = runTest {
        coEvery { offDataSource.lookup("123") } returns OpenFoodFactsResponse(
            status = 1, code = "123",
            product = OpenFoodFactsProduct(
                productName = "Yogurt", brands = "Farm", servingSize = "150 g",
                nutriments = OpenFoodFactsNutriments(energyKcal100g = 60f, proteins100g = 5f, carbohydrates100g = 7f, fat100g = 2f)
            )
        )
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("123"))

        assertEquals("Yogurt", vm.state.value.barcodeFood?.name)
        assertFalse(vm.state.value.isLookingUpBarcode)
        assertFalse(vm.state.value.barcodeNotFound)
    }

    @Test
    fun `LookupBarcode not found sets barcodeNotFound`() = runTest {
        coEvery { offDataSource.lookup("000") } returns OpenFoodFactsResponse(status = 0, code = "000", product = null)
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("000"))

        assertNull(vm.state.value.barcodeFood)
        assertTrue(vm.state.value.barcodeNotFound)
        assertFalse(vm.state.value.isLookingUpBarcode)
    }

    @Test
    fun `LookupBarcode network failure sets error`() = runTest {
        coEvery { offDataSource.lookup(any()) } throws RuntimeException("offline")
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LookupBarcode("123"))

        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.isLookingUpBarcode)
    }

    @Test
    fun `BarcodeConsumed clears barcodeFood and barcodeNotFound`() = runTest {
        coEvery { offDataSource.lookup("000") } returns OpenFoodFactsResponse(status = 0, product = null)
        val vm = viewModel()
        vm.onIntent(NutritionIntent.LookupBarcode("000"))
        assertTrue(vm.state.value.barcodeNotFound)

        vm.onIntent(NutritionIntent.BarcodeConsumed)

        assertNull(vm.state.value.barcodeFood)
        assertFalse(vm.state.value.barcodeNotFound)
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest"`
Expected: FAIL — compilation error (constructor param / `LookupBarcode` / `barcodeFood` unresolved).

- [ ] **Step 3: Add the state fields**

In `NutritionState.kt`, add to the data class:
```kotlin
    val isLookingUpBarcode: Boolean = false,
    val barcodeFood: Food? = null,
    val barcodeNotFound: Boolean = false,
```
(`Food` is already imported in this file.)

- [ ] **Step 4: Add the intents**

In `NutritionIntent.kt`, add:
```kotlin
    data class LookupBarcode(val barcode: String) : NutritionIntent
    data object BarcodeConsumed : NutritionIntent
```

- [ ] **Step 5: Wire the ViewModel**

In `NutritionViewModel.kt`:

Add import:
```kotlin
import com.coachfoska.app.domain.usecase.nutrition.LookupFoodByBarcodeUseCase
```

Add the constructor parameter (last, before `userId`):
```kotlin
    private val lookupFoodByBarcodeUseCase: LookupFoodByBarcodeUseCase,
```

Add the `when` branches:
```kotlin
            is NutritionIntent.LookupBarcode -> lookupBarcode(intent.barcode)
            NutritionIntent.BarcodeConsumed -> _state.update { it.copy(barcodeFood = null, barcodeNotFound = false) }
```

Add the handler function:
```kotlin
    private fun lookupBarcode(barcode: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLookingUpBarcode = true, barcodeNotFound = false, error = null) }
            lookupFoodByBarcodeUseCase(barcode)
                .onSuccess { food ->
                    _state.update {
                        if (food != null) it.copy(isLookingUpBarcode = false, barcodeFood = food)
                        else it.copy(isLookingUpBarcode = false, barcodeNotFound = true)
                    }
                }
                .onFailure { e ->
                    Napier.e("lookupBarcode($barcode) failed", e, tag = TAG)
                    _state.update { it.copy(isLookingUpBarcode = false, error = e.message) }
                }
        }
    }
```

- [ ] **Step 6: Extend the DI factory**

In `AppModule.kt`, add one more `get()` to the `NutritionViewModel` factory (now 13 `get()`s, the last resolving `LookupFoodByBarcodeUseCase`):

```kotlin
    viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest"`
Expected: PASS (all tests including the four new barcode ones).

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt
git commit -m "$(cat <<'EOF'
feat(nutrition): MVI wiring for barcode lookup in NutritionViewModel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Barcode scanner launcher (expect/actual) + Gradle & manifest

Add the platform scanner launcher (Android = ML Kit Google code scanner; iOS = no-op stub) and the build config it needs. Compile-gated (no unit test — platform integration).

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.kt`
- Create: `composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.android.kt`
- Create: `composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.ios.kt`
- Modify: `gradle/libs.versions.toml`
- Modify: `composeApp/build.gradle.kts` (`androidMain.dependencies` block)
- Modify: `composeApp/src/androidMain/AndroidManifest.xml`

**Interfaces:**
- Produces: `@Composable expect fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit` in package `com.coachfoska.app.core.util`.

- [ ] **Step 1: Add the version catalog entry**

In `gradle/libs.versions.toml`, under `[libraries]`, add:
```toml
play-services-code-scanner = { module = "com.google.android.gms:play-services-code-scanner", version = "16.1.0" }
```

- [ ] **Step 2: Add the Android dependency**

In `composeApp/build.gradle.kts`, inside the `androidMain.dependencies { ... }` block (near `implementation(libs.work.runtime.ktx)`), add:
```kotlin
            implementation(libs.play.services.code.scanner)
```

- [ ] **Step 3: Add the ML Kit auto-install meta-data to the Android manifest**

In `composeApp/src/androidMain/AndroidManifest.xml`, inside the `<application ...>` element, add:
```xml
        <meta-data
            android:name="com.google.mlkit.vision.DEPENDENCIES"
            android:value="barcode_ui" />
```

- [ ] **Step 4: Create the `expect` declaration**

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.kt`:
```kotlin
package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

/**
 * Returns a function that launches a barcode scanner. On a successful scan the raw barcode value
 * is delivered; on cancel/failure/unsupported-platform, null is delivered.
 */
@Composable
expect fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit
```

- [ ] **Step 5: Create the Android actual (ML Kit Google code scanner)**

Create `composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.android.kt`:
```kotlin
package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

@Composable
actual fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit {
    val context = LocalContext.current
    return {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_UPC_A,
                Barcode.FORMAT_UPC_E,
            )
            .build()
        GmsBarcodeScanning.getClient(context, options)
            .startScan()
            .addOnSuccessListener { barcode -> onResult(barcode.rawValue) }
            .addOnCanceledListener { onResult(null) }
            .addOnFailureListener { onResult(null) }
    }
}
```

- [ ] **Step 6: Create the iOS no-op actual**

Create `composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.ios.kt`:
```kotlin
package com.coachfoska.app.core.util

import androidx.compose.runtime.Composable

// iOS camera is a stub target (see MediaCapture.ios.kt) — barcode scanning is a no-op until the
// iOS app gains real camera support (Xcode project + NSCameraUsageDescription).
@Composable
actual fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit = { onResult(null) }
```

- [ ] **Step 7: Compile Android**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL` (this downloads the ML Kit dependency and resolves the `expect`/`actual`).

- [ ] **Step 8: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.kt composeApp/src/androidMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.android.kt composeApp/src/iosMain/kotlin/com/coachfoska/app/core/util/BarcodeScanner.ios.kt gradle/libs.versions.toml composeApp/build.gradle.kts composeApp/src/androidMain/AndroidManifest.xml
git commit -m "$(cat <<'EOF'
feat(nutrition): add barcode scanner launcher (Android ML Kit, iOS stub)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: "Scan barcode" UI + auto-fill in the meal-capture flow

Add a scan button to `FoodSearchDialog`, consume the scanned `Food` to fill the active food entry, show progress + not-found, and add localized strings. Compile-gated.

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt`
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml` (Czech)
- Modify: `composeApp/src/commonMain/composeResources/values-en/strings.xml` (English)

**Interfaces:**
- Consumes: `rememberBarcodeScannerLauncher` (Task 7), `NutritionIntent.LookupBarcode/BarcodeConsumed` (Task 6), `NutritionState.isLookingUpBarcode/barcodeFood/barcodeNotFound` (Task 6), existing `FoodEntry` + `Food → FoodEntry` mapping in this file.

- [ ] **Step 1: Add the strings (Czech default first)**

In `composeApp/src/commonMain/composeResources/values/strings.xml`, add (near the other `meal_*` / `nutrition_*` strings):
```xml
    <string name="nutrition_scan_barcode">NASKENOVAT KÓD</string>
    <string name="nutrition_barcode_not_found">Produkt nenalezen — zadej ručně.</string>
```

In `composeApp/src/commonMain/composeResources/values-en/strings.xml`, add:
```xml
    <string name="nutrition_scan_barcode">SCAN BARCODE</string>
    <string name="nutrition_barcode_not_found">Product not found — enter manually.</string>
```

- [ ] **Step 2: Consume the scanned food in `MealCaptureScreen`**

In `MealCaptureScreen.kt`, add imports:
```kotlin
import androidx.compose.runtime.LaunchedEffect
import coachfoska.composeapp.generated.resources.nutrition_scan_barcode
import coachfoska.composeapp.generated.resources.nutrition_barcode_not_found
```
(`LaunchedEffect` may already be imported — keep a single import.)

The `FoodSearchDialog` is shown when `searchingIndex != null` (existing code around line 166). Add a `LaunchedEffect` just before that `if (searchingIndex != null)` block to fill the active entry when a scan resolves. It reuses the SAME `Food → FoodEntry` mapping already used by `onSelect`:

```kotlin
    LaunchedEffect(state.barcodeFood) {
        val food = state.barcodeFood ?: return@LaunchedEffect
        val index = searchingIndex
        if (index != null) {
            foods = foods.toMutableList().also {
                it[index] = FoodEntry(
                    name = food.name,
                    amount = food.servingSize.toString().trimEnd('0').trimEnd('.'),
                    unit = food.servingUnit,
                    baseCalories = food.calories,
                    basePro = food.proteinG,
                    baseCarbs = food.carbsG,
                    baseFat = food.fatG,
                    baseServingSize = food.servingSize,
                    baseServingUnit = food.servingUnit,
                )
            }
            searchingIndex = null
        }
        onIntent(NutritionIntent.BarcodeConsumed)
    }
```

> Note: match the `FoodEntry(...)` argument names to the existing `onSelect` mapping in this file (see the block around line 171–188). If any field name differs, use the file's existing names verbatim — do not invent fields.

- [ ] **Step 3: Add the scan button + states inside `FoodSearchDialog`**

`FoodSearchDialog` currently takes `(state, onSearch, onDismiss, onSelect)`. Add an `onScan: () -> Unit` parameter and render a scan button, a lookup progress indicator, and the not-found message.

Change the signature:
```kotlin
fun FoodSearchDialog(
    state: NutritionState,
    onSearch: (String) -> Unit,
    onDismiss: () -> Unit,
    onSelect: (Food) -> Unit,
    onScan: () -> Unit,
) {
```

Inside the dialog `Column`, right after the `DsTextField` (search field) and its trailing `Spacer(Modifier.height(16.dp))`, add:
```kotlin
            OutlinedButton(
                onClick = onScan,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(8.dp),
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(Res.string.nutrition_scan_barcode), style = MaterialTheme.typography.labelLarge)
            }
            if (state.isLookingUpBarcode) {
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            if (state.barcodeNotFound) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(Res.string.nutrition_barcode_not_found),
                    style = MaterialTheme.typography.bodySmall,
                    color = DsTheme.colors.error,
                )
            }
            Spacer(Modifier.height(16.dp))
```

Ensure these imports exist in the file (add any that are missing):
```kotlin
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Icon
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
```
(`LinearProgressIndicator`, `Text`, `Spacer`, `height`, `fillMaxWidth`, `MaterialTheme`, `stringResource`, `DsTheme` are already used in this file.)

- [ ] **Step 4: Pass the scanner launcher to the dialog at the call site**

At the `FoodSearchDialog(...)` call site (inside `MealCaptureScreen`, around line 166), create the launcher and pass `onScan`. Add the launcher near the top of the composable body (with the other `remember...` launchers) and wire it:

```kotlin
    val scanBarcode = rememberBarcodeScannerLauncher { code ->
        if (code != null) onIntent(NutritionIntent.LookupBarcode(code))
    }
```
Add import:
```kotlin
import com.coachfoska.app.core.util.rememberBarcodeScannerLauncher
```
Then, in the existing `FoodSearchDialog(...)` call, add ONE new trailing argument and change nothing else — leave `state`, `onSearch`, `onDismiss`, and the entire existing `onSelect = { food -> ... }` lambda exactly as they are. After the `onSelect = { ... }` argument, add:
```kotlin
            onScan = scanBarcode,
```

- [ ] **Step 5: Compile Android**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Run the full test suite**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL` (everything green).

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt composeApp/src/commonMain/composeResources/values/strings.xml composeApp/src/commonMain/composeResources/values-en/strings.xml
git commit -m "$(cat <<'EOF'
feat(nutrition): scan barcode button and auto-fill in meal capture

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Full compile (Android):** `./gradlew :composeApp:compileDebugKotlinAndroid` → `BUILD SUCCESSFUL`
- [ ] **Full unit tests:** `./gradlew :composeApp:testDebugUnitTest` → `BUILD SUCCESSFUL`
- [ ] **iOS metadata compile (optional, if the iOS toolchain is set up):** `./gradlew :composeApp:compileKotlinIosSimulatorArm64` → `BUILD SUCCESSFUL` (confirms the iOS no-op actual resolves)
- [ ] **Manual smoke (device/emulator, optional):** open Nutrition tab → macro summary card renders at top; log a meal → return to hub → numbers update; in meal capture, tap a food's search → "Scan barcode" → scan a product barcode → the food entry auto-fills; scan an unknown barcode → "Product not found" shows.

---

## Spec Coverage Map

| Spec section | Task(s) |
|---|---|
| §4.1 Shared component extraction | Task 1 |
| §4.2 State fields | Task 2 |
| §4.3 ViewModel load + LoadDailySummary | Task 2 |
| §4.4 Hub UI + resume reload | Task 3 |
| §4.5 Edge cases (null targets / empty) | Task 2 (targets), Task 3 (UI states) |
| §5.1 Scanner expect/actual | Task 7 |
| §5.2 OFF data source + DTOs + toFood | Task 4 (DTOs/mapper), Task 5 (data source) |
| §5.3 LookupFoodByBarcodeUseCase | Task 5 |
| §5.4 MVI wiring | Task 6 |
| §5.5 UI (scan button, auto-fill, not-found) | Task 8 |
| §5.6 DI, Gradle, manifest | Task 5 (DI), Task 7 (Gradle/manifest) |
| §5.7 New strings | Task 8 |
| §7 Testing | Tasks 2, 4, 5, 6 (unit); Task 8 final suite |
