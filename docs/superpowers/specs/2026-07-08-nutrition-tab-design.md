# Nutrition Tab — Macro Summary + Barcode Scanner (Design)

**Date:** 2026-07-08
**Source analysis:** `nutrition_tab_analysis.md` (external, Gemini brain dir)
**Status:** Approved design — ready for implementation planning

---

## 1. Goal & Scope

Improve the Nutrition tab per the source analysis, focused on two features:

1. **Daily macro summary on the Nutrition hub** — surface today's consumed-vs-target
   macros (calories / protein / carbs / fat) at the top of `NutritionHubScreen`, reusing
   the existing Home-tab presentation.
2. **Barcode scanner** — scan a packaged food's barcode, look it up via Open Food Facts,
   and auto-fill a food entry in the meal-capture flow. **Android only** (real impl); iOS
   is a no-op stub matching current conventions.

### Explicitly out of scope (deferred — recorded so they are not lost)

- Recent / frequent meals quick-log on the log sheet
- AI voice logging
- Logging streak / gamification
- Personalized greeting ("Good morning, Juraj — 1,200 kcal remaining")
- User-editable macro target overrides (targets remain computed from profile)

These are listed in §8 (Future Work).

### Reality check vs the source analysis

The analysis is partly stale. Verified against the codebase:

| Analysis claim | Actual state |
|---|---|
| "Hub lacks a glanceable macro summary" | True on the hub, but **Home already** renders consumed-vs-target macros via `MacroRow`/`MacroItem` (`HomeScreen.kt`) fed by `GetDailyNutritionSummaryUseCase` + `CalculateMacroTargetsUseCase`. This is **wiring**, not building. |
| "Ensure we collect age/weight/height/activity/goal + calc TDEE" | Already done: onboarding `BodyStatsStep.kt` collects them; `CalculateMacroTargetsUseCase` computes TDEE via Mifflin–St Jeor. |
| "Enhance photo logging" | `AnalyzeMealPhotoUseCase` + capture flow already exist. |
| Barcode / voice / recent meals / streak | Genuinely absent. |

---

## 2. Current-State Facts (grounding for implementers)

All paths under `composeApp/src/commonMain/kotlin/com/coachfoska/app/` unless noted.

**Nutrition hub**
- `ui/nutrition/NutritionHubScreen.kt` — `NutritionHubRoute` + `NutritionHubScreen`. Renders:
  Log Meal button → Featured Recipes slider → 3 `DsHubImageCard`s (Plan / History / Water).
  No macro summary today.
- `presentation/nutrition/NutritionViewModel.kt` — constructor takes 9 deps + `userId`.
  Loads meal plan (init), recipes, favorites, history; handles logging, photo analysis,
  food search, prefill. **Does not** load daily summary or targets.
- `presentation/nutrition/NutritionState.kt` — no summary/targets fields.
- `presentation/nutrition/NutritionIntent.kt` — MVI intents.

**Reusable macro presentation (Home)**
- `ui/home/HomeScreen.kt` — `private fun MacroRow(summary: DailyNutritionSummary, targets: MacroTargets?)`
  and `private fun MacroItem(label, value, target, suffix, modifier)` (lines ~330–375).
  `MacroItem` already degrades gracefully: when `target == null || target <= 0` it hides the
  `/target` line and the progress bar (shows value only).
- `presentation/home/HomeViewModel.kt` — the canonical load pattern:
  `nutritionSummary = getDailyNutritionSummaryUseCase(userId, today).getOrNull()` and
  `macroTargets = user?.let { calculateMacroTargetsUseCase(it) }`.

**Domain (already exist)**
- `domain/model/Nutrition.kt` — `DailyNutritionSummary(calories, proteinG, carbsG, fatG)`,
  `MacroTargets(...)`, `Food(id, name, calories, proteinG, carbsG, fatG, servingSize, servingUnit, brand, isVerified)`.
- `domain/usecase/nutrition/GetDailyNutritionSummaryUseCase.kt` (needs `userId`, `LocalDate`).
- `domain/usecase/nutrition/CalculateMacroTargetsUseCase.kt` (needs `User`; returns null if profile incomplete).
- `domain/usecase/profile/GetUserProfileUseCase.kt` — returns `Result<User>`.

**Meal-capture / food-add flow**
- `ui/nutrition/MealCaptureScreen.kt` — a list of `FoodEntry` rows; each row's search action
  sets `searchingIndex = i` and opens `FoodSearchDialog`. `FoodSearchDialog(state, onSearch, onDismiss, onSelect)`
  emits a `Food`; `onSelect(food)` fills `foods[searchingIndex]` with a new `FoodEntry` derived
  from the `Food` (name, amount = servingSize, unit = servingUnit, base macros). **This is the
  exact path a scanned product reuses.**
- Existing food search: `NutritionIntent.SearchFoods(query)` → `SearchFoodsUseCase` →
  `MealRepository.searchFoods` → Supabase `foods` table. (Name search; not barcode-indexed.)

**Platform capture pattern (to mirror for the scanner)**
- `core/util/MediaCapture.kt` — `@Composable expect fun rememberPhotoCaptureLauncher(onResult: (String?) -> Unit): () -> Unit`.
- `core/util/MediaCapture.android.kt` — Android actual using `rememberLauncherForActivityResult`
  + runtime `CAMERA` permission.
- `core/util/MediaCapture.ios.kt` — **all actuals are no-ops** (`{ onResult(null) }`). iOS has
  no working camera feature; `iosApp/` has only `iOSApp.swift` + `ContentView.swift` (no Xcode
  project, no Info.plist, so no `NSCameraUsageDescription`).

**Networking / DI**
- `core/di/AppModule.kt` — `single { HttpClient { install(ContentNegotiation){ json(...) }; install(Logging){...} } }`
  (shared, cross-platform; android=`ktor-client-android`, ios=`ktor-client-darwin`).
- `NutritionViewModel` DI (AppModule.kt ~line 272):
  `viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }`
- `GetDailyNutritionSummaryUseCase`, `CalculateMacroTargetsUseCase`, `GetUserProfileUseCase`
  are all already registered.
- External-HTTP precedent: `data/ai/ClaudeAiProvider.kt` calls a non-Supabase host with the shared `HttpClient`.

**Resources / build**
- Strings: `composeApp/src/commonMain/composeResources/values/strings.xml` (**Czech = default**)
  and `values-en/strings.xml` (English). New strings go in **both**.
- Android manifest: `composeApp/src/androidMain/AndroidManifest.xml`.
- Deps: `composeApp/build.gradle.kts` (`androidMain.dependencies` block ~lines 90–106);
  version catalog `gradle/libs.versions.toml`. Ktor `3.4.2`.
- Tests: only `composeApp/src/androidUnitTest/` exists (no `commonTest`). Convention: `mockk`
  + `turbine` + `kotlinx-coroutines-test`. **No `ktor-client-mock`** in the catalog.

---

## 3. Architecture

```
Presentation
  NutritionState        + nutritionSummary, macroTargets, isSummaryLoading
                        + isLookingUpBarcode, barcodeFood (one-shot)
  NutritionViewModel    loads summary+targets (init + after log); handles LookupBarcode
  NutritionHubScreen    MacroSummaryRow card at top
  FoodSearchDialog      "Scan barcode" button → launcher → LookupBarcode
  rememberBarcodeScannerLauncher   expect/actual (core/util)

Domain
  LookupFoodByBarcodeUseCase(dataSource) -> Result<Food?>
  (reuses GetDailyNutritionSummaryUseCase, CalculateMacroTargetsUseCase, GetUserProfileUseCase)

Data
  OpenFoodFactsDataSource(httpClient)  GET .../product/{barcode}.json
  OpenFoodFactsDtos + toFood()  (pure mapper, unit-testable)

Shared UI
  ui/components/MacroSummaryRow.kt   (extracted from HomeScreen; used by Home + Nutrition)
```

---

## 4. Feature 1 — Daily Macro Summary on the Hub

### 4.1 Shared component extraction
- Create `ui/components/MacroSummaryRow.kt`, package `com.coachfoska.app.ui.components`.
- Move `MacroRow` (public, rename to `MacroSummaryRow`) and its helper `MacroItem` out of
  `HomeScreen.kt` into this file (verbatim logic — including the null-target degradation).
- Update `HomeScreen.kt` to import and call `MacroSummaryRow(...)` (behavior-preserving; the
  Home layout must look identical after the move).

### 4.2 State
Add to `NutritionState`:
```kotlin
val nutritionSummary: DailyNutritionSummary? = null,
val macroTargets: MacroTargets? = null,
val isSummaryLoading: Boolean = false,
```

### 4.3 ViewModel
- Inject `GetDailyNutritionSummaryUseCase`, `CalculateMacroTargetsUseCase`, `GetUserProfileUseCase`
  into `NutritionViewModel`.
- Add intent `object LoadDailySummary : NutritionIntent`.
- Add `private fun loadDailySummary()`: sets `isSummaryLoading=true`; concurrently fetches
  today's summary (`todayDate()`) and the user profile; sets `nutritionSummary` and
  `macroTargets = user?.let { calculateMacroTargetsUseCase(it) }`; clears `isSummaryLoading`.
  Failures are non-fatal (log via Napier; leave fields null — the hub still renders).
- Call `loadDailySummary()` in `init` (first paint) and on the `LoadDailySummary` intent.
- **Refresh on return:** the hub route fires `LoadDailySummary` on each `ON_RESUME` (§4.4).
  Meal logging happens in a *separate* `NutritionViewModel` instance (the capture screen is a
  different nav destination), so a same-VM "after log" reload would not reach the hub. Resume-based
  reload is what makes the numbers update after the user logs a meal and returns.

### 4.4 UI (`NutritionHubScreen`)
- Insert a summary card at the **top of the content Column**, above the Log Meal button, in the
  same `Surface` wrapper style Home uses (`RoundedCornerShape(12.dp)`, `textPrimary.copy(alpha=0.03f)`).
- Render logic:
  - `isSummaryLoading && nutritionSummary == null` → `DsLoadingBox`.
  - `nutritionSummary != null` → `MacroSummaryRow(nutritionSummary, macroTargets)`.
  - else → the `start_logging_meals` hint text (reuse existing string).
- `NutritionHubRoute` already has `userId`; no new nav params.
- **Resume reload:** add `LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.onIntent(NutritionIntent.LoadDailySummary) }`
  in `NutritionHubRoute` (from `androidx.lifecycle.compose`, already on the classpath via
  `collectAsStateWithLifecycle`). Fires on first show and every return to the hub.

### 4.5 Edge cases
- Profile incomplete → `macroTargets == null` → `MacroItem` shows values without bars (already handled).
- Nothing logged today → summary is all-zero → still render (zeros + targets), not the empty hint,
  when a summary object exists. (If the repo returns null for no data, show the hint.)

---

## 5. Feature 2 — Barcode Scanner (Android real, iOS stub)

### 5.1 Scanner launcher (expect/actual)
- `core/util/BarcodeScanner.kt`:
  ```kotlin
  @Composable expect fun rememberBarcodeScannerLauncher(onResult: (String?) -> Unit): () -> Unit
  ```
- `core/util/BarcodeScanner.android.kt`: use ML Kit **Google code scanner**
  (`com.google.android.gms:play-services-code-scanner`) — `GmsBarcodeScanning.getClient(context)`,
  `.startScan()` → `addOnSuccessListener { onResult(it.rawValue) }`, cancel/failure → `onResult(null)`.
  No `CAMERA` permission needed (runs in Play Services). Restrict formats to common product
  symbologies (EAN-13/EAN-8/UPC-A/UPC-E) via `GmsBarcodeScannerOptions`.
- `core/util/BarcodeScanner.ios.kt`: `{ onResult(null) }` (no-op stub, matches `MediaCapture.ios.kt`).

### 5.2 Open Food Facts data source
- `data/remote/dto/OpenFoodFactsDtos.kt`:
  - `@Serializable OpenFoodFactsResponse(val status: Int? = null, val product: OpenFoodFactsProduct? = null)`
  - `@Serializable OpenFoodFactsProduct(productName, brands, servingSize, nutriments, code)` with
    `@SerialName` for `product_name`, `serving_size`.
  - `@Serializable OpenFoodFactsNutriments(...)` with `@SerialName("energy-kcal_100g")`,
    `proteins_100g`, `carbohydrates_100g`, `fat_100g` (all nullable Float).
  - `fun OpenFoodFactsResponse.toFood(): Food?` — **pure mapper**. Success is keyed on **data
    presence, not the `status` field** (OFF's `status` encoding differs across API versions — do
    not hard-compare it): return null if `product == null`, `productName` blank, or `energy-kcal_100g`
    null; otherwise build `Food` with per-100g macros (`servingSize = 100f`, `servingUnit = "g"`,
    `brand = brands`, `isVerified = false`, `id = code ?: productName`). Nutriment nulls other than
    kcal coerce to `0f`.
- `data/remote/datasource/OpenFoodFactsDataSource.kt`:
  ```kotlin
  class OpenFoodFactsDataSource(private val httpClient: HttpClient) {
    suspend fun lookup(barcode: String): OpenFoodFactsResponse  // GET v2 product endpoint
  }
  ```
  URL: `https://world.openfoodfacts.org/api/v2/product/$barcode.json?fields=code,product_name,brands,serving_size,nutriments`.
  Set a `User-Agent` header (OFF requests one). Use the shared `HttpClient` JSON decoding.

### 5.3 Use case
- `domain/usecase/nutrition/LookupFoodByBarcodeUseCase.kt`:
  ```kotlin
  class LookupFoodByBarcodeUseCase(private val dataSource: OpenFoodFactsDataSource) {
    suspend operator fun invoke(barcode: String): Result<Food?> =
      runCatching { dataSource.lookup(barcode).toFood() }
  }
  ```
  (Repository interface optional — MVP keeps the datasource direct, like the AI providers. A
  `FoodLookupRepository` interface may be added later if a second source appears.)

### 5.4 MVI wiring
- `NutritionIntent`: add `data class LookupBarcode(val barcode: String)` and `object BarcodeConsumed`.
- `NutritionState`: add `val isLookingUpBarcode: Boolean = false`, `val barcodeFood: Food? = null`
  (one-shot), `val barcodeNotFound: Boolean = false` (one-shot).
- `NutritionViewModel`:
  - inject `LookupFoodByBarcodeUseCase`.
  - `LookupBarcode` → set `isLookingUpBarcode=true`, clear `barcodeNotFound`; on success non-null →
    `barcodeFood=food`; on success null → `barcodeNotFound=true`; on failure → `error = e.message`;
    always clear `isLookingUpBarcode`.
  - `BarcodeConsumed` → clear both `barcodeFood` and `barcodeNotFound`.
  - Not-found is a **flag, not a VM-set string** — the UI renders the localized
    `nutrition_barcode_not_found` resource (the VM can't read Compose string resources).

### 5.5 UI (`MealCaptureScreen` / `FoodSearchDialog`)
- Add a "Scan barcode" button in the `FoodSearchDialog` header (next to the search field).
  Create the launcher: `val scan = rememberBarcodeScannerLauncher { code -> if (code != null) onScan(code) }`
  where `onScan` calls `onIntent(NutritionIntent.LookupBarcode(code))`. Wire `onScan` down from
  `MealCaptureRoute`.
- Consume `state.barcodeFood`: a `LaunchedEffect(state.barcodeFood)` in `MealCaptureScreen` that,
  when non-null, fills `foods[searchingIndex]` using the **same `Food → FoodEntry` mapping already
  in `onSelect`**, then closes the dialog (`searchingIndex = null`) and fires
  `NutritionIntent.BarcodeConsumed`. The scan button lives only inside `FoodSearchDialog`, so
  `searchingIndex` is always non-null while scanning; treat a null index as a no-op (defensive).
- Show `isLookingUpBarcode` as a small progress indicator in the dialog.
- When `state.barcodeNotFound` is true, show the localized `nutrition_barcode_not_found` text in the
  dialog. A network failure still surfaces through the existing `state.error` text.

### 5.6 DI, Gradle, Manifest
- `AppModule.kt`: `single { OpenFoodFactsDataSource(get()) }`; `factory { LookupFoodByBarcodeUseCase(get()) }`;
  extend the `NutritionViewModel` factory with the new `get()`s (order matches the constructor).
- `gradle/libs.versions.toml`: add
  `play-services-code-scanner = { module = "com.google.android.gms:play-services-code-scanner", version = "16.1.0" }`.
- `composeApp/build.gradle.kts` `androidMain.dependencies`: `implementation(libs.play.services.code.scanner)`.
- `AndroidManifest.xml`: add ML Kit auto-install meta-data inside `<application>`:
  `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui"/>`.

### 5.7 New strings (add to BOTH `values/` [cs] and `values-en/` [en])
- `nutrition_scan_barcode` — button label ("Naskenovat kód" / "Scan barcode")
- `nutrition_barcode_not_found` — not-found message
  ("Produkt nenalezen — zadej ručně." / "Product not found — enter manually.")

---

## 6. Data Flow Summaries

**Macro summary:** hub opens → `NutritionViewModel.init` → `loadDailySummary()` →
(summary + profile) → state → `MacroSummaryRow`. After a meal is logged → `loadDailySummary()` re-runs.

**Barcode:** capture screen → food row search → dialog → tap Scan → `rememberBarcodeScannerLauncher`
→ raw barcode → `LookupBarcode` → `OpenFoodFactsDataSource.lookup` → `toFood()` → `barcodeFood`
→ `LaunchedEffect` fills the `FoodEntry` → `BarcodeConsumed`. User can still adjust portion via `PortionPicker`.

---

## 7. Testing

`androidUnitTest` (mockk-based; no HTTP mock dependency required):

- **`toFood()` mapper** (pure): valid OFF JSON fixture → correct `Food`; `status:0` → null;
  missing kcal → null; blank name → null; brand mapping; per-100g values.
- **`LookupFoodByBarcodeUseCase`**: mock `OpenFoodFactsDataSource` → found `Food`, not-found (null),
  thrown exception → `Result.failure`.
- **`NutritionViewModel`**: (a) `init` loads `nutritionSummary` + `macroTargets`; (b) after
  `LogMeal` success the summary reloads; (c) `LookupBarcode` success sets `barcodeFood` and clears
  `isLookingUpBarcode`; (d) not-found sets `error`; (e) `BarcodeConsumed` clears `barcodeFood`.
  Use fakes/mocks for the new use cases consistent with existing `NutritionViewModelTest`.
- **`NutritionStateTest`**: default values of the new fields.

Full-run gate: `./gradlew :composeApp:testDebugUnitTest` (or the project's standard test task) passes.

---

## 8. Future Work (deferred, not in this plan)

- Recent / frequent meals quick-log on the log sheet (derive from `getMealHistory`).
- AI voice logging (platform speech-to-text + LLM parse).
- Logging streak + personalized greeting (needs a streak query/RPC for meal logs).
- User-editable macro target overrides (persisted).
- Real iOS camera support (Xcode project + `NSCameraUsageDescription`) → then a real iOS
  barcode `actual`.
- Barcode caching / a `FoodLookupRepository` abstraction if a second barcode source is added.

---

## 9. Assumptions & Open Risks

- **iOS is a stub target today** — the barcode iOS actual is deliberately a no-op; Android is the
  shippable/testable path. Confirmed with the user.
- **ML Kit code scanner** requires Google Play Services on-device. Acceptable for the Android
  audience; the launcher returns null (graceful) where unavailable.
- **Open Food Facts coverage** is community data — some barcodes miss macros; `toFood()` returns
  null and the UI shows the not-found message so the user can enter manually.
- Macro-summary refresh is tied to in-session logging; it does not live-observe external changes
  (consistent with Home's one-shot load).
