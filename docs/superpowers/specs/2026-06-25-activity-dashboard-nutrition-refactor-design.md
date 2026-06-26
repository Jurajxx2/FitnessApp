# Activity / Dashboard / Nutrition Refactor — Design Spec

**Date:** 2026-06-25
**Branch / Worktree:** `worktree-activity-dashboard-nutrition-refactor` (based on `master` @ `15ff591`)
**Status:** Approved design — ready for implementation planning

## Goal

Rebalance content across three top-level tabs:

1. **Dashboard (Home)** — replace the "Today's Focus" workout card with the **Weekly Activity** strip (moved from the Activity tab). The strip's "today" bar carries today's plan/workout info.
2. **Activity tab (Activity Hub)** — remove the Weekly Activity section (now on the dashboard) and add a **SEE ALL** button next to **ASSIGNED WORKOUTS**.
3. **Nutrition tab** — full restructure: a primary **Log Meal** button at the top, a **FEATURED RECIPES** header with **SEE ALL**, a horizontal **featured recipes slider**, and **other buttons** (Plan / History / Water) at the bottom.

Supporting data work: a real `featured` flag on recipes (DB migration + DTO + domain + state).

## Non-goals

- No change to workout-logging, meal-capture, recipe-detail, hydration, or chat flows.
- No redesign of the `WeeklyActivityGrid` cell visuals, `AssignedWorkoutCard`, or `HubImageCard` internals — they are reused as-is.
- No new "featured" curation UI; the `featured` flag is set in the DB directly for now.

---

## Current state (reference)

### Activity Hub — `composeApp/.../ui/workout/ActivityHubScreen.kt`
Vertical scroll column: `BrandHeader` → `StartWorkoutButton` → **WEEKLY ACTIVITY** (`SectionLabel` + `WeeklyActivityGrid` + `DaySummaryBar`) → **ASSIGNED WORKOUTS** (`SectionLabel` + static `"SCROLL →"` `Text` + `LazyRow` of `AssignedWorkoutCard`) → quick links (`QuickLinkRow` × 4) → error.
- Derivations memoized in the composable: `todayWorkout`, `weeklyDays = buildWeeklyActivity(...)`, `volumeKg = deriveTodayVolumeKg(...)`.
- Pure helpers live in `domain/usecase/workout/ActivityHubLogic.kt`: `buildWeeklyActivity`, `deriveTodayVolumeKg`, `formatVolumeKg`, `deriveCategoryLabel`.
- `WorkoutState` (`presentation/workout/WorkoutState.kt`) already holds `workouts: List<Workout>` and `workoutHistory: List<WorkoutLog>`.

### Dashboard — `composeApp/.../ui/home/HomeScreen.kt`
Column: optional `CoachMessagePreviewCard` → header (welcome + name) → **Today's Focus** (`WorkoutHomeCard` or recovery surface) → **Daily Nutrition** (`MacroRow` + `WaterProgressRow` + Log meal `TextButton`) → error.
- `HomeState` (`presentation/home/HomeState.kt`) holds `todayWorkout` but **not** `workouts` or `workoutHistory`.
- `HomeViewModel` already fetches assigned workouts via `getAssignedWorkoutsUseCase` but discards the full list (keeps only `todayWorkout`). It does **not** fetch workout history.
- `HomeRoute` already wires `onWorkoutClick` and `onStartWorkout`.

### Nutrition Hub — `composeApp/.../ui/nutrition/NutritionHubScreen.kt`
Column: `"NUTRITION"` title → `TodayPlanPanel` (plan name, meal macro pills, Log meal + Follow plan buttons) → Weekly Plan `HubImageCard` → row of `HubImageCard` (History / Recipes / Water).
- `NutritionHubRoute` params: `onPlanClick`, `onRecordMealClick`, `onHistoryClick`, `onRecipesClick`, `onWaterClick`. **No** `onRecipeClick`.
- `NutritionViewModel.loadRecipes()` exists but is only triggered by `NutritionIntent.LoadRecipes` (today only fired by `RecipesListScreen`). The hub does not load recipes.
- `NutritionState` holds `allRecipes`, `favoriteRecipeIds`, derived `recipes`.

### Recipe data layer
- `Recipe` domain (`domain/model/Nutrition.kt`): no `isFeatured`.
- `RecipeDto` (`data/remote/dto/NutritionDto.kt`): maps `recipes` columns; `toDomain()`. No `featured`.
- `MealRemoteDataSource.getRecipes()` uses `.select()` (selects `*`), so a new column is auto-included once the DTO field exists.
- Coil image loading pattern in use elsewhere: `import coil3.compose.AsyncImage` → `AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = ...)`.
- Navigation routes available (`App.kt`): `WorkoutPlan`, `RecipesList`, `RecipeDetail(recipeId)`, `MealCapture()`, `MealPlanDetail`, `MealHistory`, `Hydration`.

---

## Target design

### 1. Shared component — `WeeklyActivitySection`

**New file:** `composeApp/.../ui/workout/components/WeeklyActivitySection.kt`

A self-contained composable that renders the section label, the 7-day grid, and the "today" summary bar. Extracted so the dashboard owns it cleanly and there is one source of truth.

Signature:
```kotlin
@Composable
fun WeeklyActivitySection(
    days: List<WeekDayActivity>,
    todayWorkout: Workout?,
    volumeKg: Double?,
    onTodayClick: (() -> Unit)? = null, // tap on the today bar; null = non-interactive
    modifier: Modifier = Modifier,
)
```

Content (moved verbatim from `ActivityHubScreen`):
- `SectionLabel("WEEKLY ACTIVITY")` (promote the private `SectionLabel` style into this component, or inline equivalent `Text`).
- `WeeklyActivityGrid(days = days)`.
- The current `DaySummaryBar(todayWorkout, volumeKg)` body — label "TODAY'S FOCUS"/"REST DAY", workout name, and `SummaryMetric`s (duration / exercises / volume). When `onTodayClick != null`, wrap the bar in a clickable modifier (it opens today's workout). Keep `formatVolumeKg` usage.

Move `DaySummaryBar` and `SummaryMetric` (private helpers in `ActivityHubScreen.kt`) into this file as private composables.

### 2. Activity Hub — remove weekly activity, add SEE ALL

**File:** `ui/workout/ActivityHubScreen.kt`

- **Remove** the `WEEKLY ACTIVITY` `Column` block (lines ~134–138: `SectionLabel("WEEKLY ACTIVITY")` + `WeeklyActivityGrid` + `DaySummaryBar`).
- **Remove** the now-unused local derivations `weeklyDays` and `volumeKg`, plus their imports (`buildWeeklyActivity`, `deriveTodayVolumeKg`, `formatVolumeKg`, `WeekDayActivity`, `TimeZone`, `zone`). Keep `todayWorkout` (still used by `StartWorkoutButton`).
- **Remove** the private `DaySummaryBar` and `SummaryMetric` composables (now in `WeeklyActivitySection`).
- In the **ASSIGNED WORKOUTS** header `Row`, replace the static `Text("SCROLL →")` with a clickable **SEE ALL** affordance → `onPlanClick`. Use a `Text` with a `clickable` modifier (or `TextButton`) styled like a label:
  ```kotlin
  Text(
      text = "SEE ALL",
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.primary,
      letterSpacing = 1.sp,
      modifier = Modifier.clickable(onClick = onPlanClick),
  )
  ```
- Resulting order: `BrandHeader` → `StartWorkoutButton` → **ASSIGNED WORKOUTS** (label + SEE ALL + `LazyRow`) → quick links → error.
- `onPlanClick` is already a param and already wired in `App.kt` to `navController.navigate(WorkoutPlan)`. No navigation change needed.

### 3. Dashboard — Weekly Activity replaces Today's Focus

**File:** `presentation/home/HomeState.kt`
- Add `val workouts: List<Workout> = emptyList()` and `val workoutHistory: List<WorkoutLog> = emptyList()`.
- Import `com.coachfoska.app.domain.model.WorkoutLog`.

**File:** `presentation/home/HomeViewModel.kt`
- Add constructor dependency `getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase` (`domain.usecase.workout.GetWorkoutHistoryUseCase`).
- In `loadData`, add `val historyDeferred = async { getWorkoutHistoryUseCase(userId) }`; await it (best-effort, log on failure like the others).
- In the final `_state.update`, set `workouts = workouts` (the full list already computed) and `workoutHistory = historyResult.getOrDefault(emptyList())`. Keep existing `todayWorkout` derivation.
- **DI:** register the new dependency in the Koin module that builds `HomeViewModel` (`core/di/AppModule.kt`). `GetWorkoutHistoryUseCase` is already provided (used by `WorkoutViewModel`); just inject it.

**File:** `ui/home/HomeScreen.kt`
- Replace the **Today's Focus** `Column` (label + `WorkoutHomeCard`/recovery surface) with the weekly activity section. Inside the `else` (not loading) branch:
  ```kotlin
  val today = todayDate()
  val zone = TimeZone.currentSystemDefault()
  val weeklyDays = remember(state.workouts, state.workoutHistory, today, zone) {
      buildWeeklyActivity(state.workouts, state.workoutHistory, today, zone)
  }
  val volumeKg = remember(state.todayWorkout, state.workoutHistory) {
      deriveTodayVolumeKg(state.todayWorkout, state.workoutHistory)
  }
  WeeklyActivitySection(
      days = weeklyDays,
      todayWorkout = state.todayWorkout,
      volumeKg = volumeKg,
      onTodayClick = state.todayWorkout?.let { w -> { onWorkoutClick(w.id) } },
  )
  ```
- Keep the **Daily Nutrition** section unchanged below.
- The private `WorkoutHomeCard` composable becomes unused — remove it and its now-unused imports/string resources (`todays_focus`, `recovery_day`, `recovery_day_desc`, `start_workout`, `exercises_count`, `duration_min`) **only if** no longer referenced anywhere in the file. Verify with a grep before deleting string resources; leave shared string resources in `strings.xml` untouched (other screens may use them).
- `HomeRoute`/`App.kt` already pass `onWorkoutClick`; no navigation wiring change.

> Note: today's nutrition plan is **not** added here — per the approved design, the weekly-activity "today" bar represents today's plan, and the Daily Nutrition section already covers nutrition.

### 4. Nutrition Hub — full restructure

**File:** `data/remote/.../` + domain (see §5 first for the `featured` flag).

**File:** `presentation/nutrition/NutritionState.kt`
- Add derived property:
  ```kotlin
  val featuredRecipes: List<Recipe>
      get() = allRecipes.filter { it.isFeatured }
          .ifEmpty { allRecipes.take(10) } // graceful fallback so the slider is never empty
  ```

**File:** `ui/nutrition/NutritionHubScreen.kt` — rewrite the body top→bottom:
1. `"NUTRITION"` title (kept).
2. **Log Meal** primary button — full width, filled `Button`, `Icons.Default.Add`, label "Log meal" → `onRecordMealClick`.
3. **Header row:** `Text("FEATURED RECIPES", labelLarge, letterSpacing 1.5.sp)` + **SEE ALL** (`labelSmall`, primary, `clickable → onRecipesClick`), arranged `SpaceBetween`.
4. **Featured recipes slider:** `LazyRow(horizontalArrangement = spacedBy(12.dp), contentPadding = PaddingValues(horizontal = 16.dp))` of `FeaturedRecipeCard` (new component, §6). Tap → `onRecipeClick(recipe.id)`.
   - While `state.isRecipesLoading && state.allRecipes.isEmpty()`, show `CoachLoadingBox` (height ~150.dp).
   - If loaded and `featuredRecipes` empty (no recipes at all), hide the slider (the SEE ALL still navigates to the full list).
5. **Bottom "other buttons":** a `Row` of three `HubImageCard`s — Weekly Plan (`img_nutrition_plan` → `onPlanClick`), History (`img_nutrition_history` → `onHistoryClick`), Water (`img_nutrition_history` → `onWaterClick`) — same `weight(1f).aspectRatio(1f)` styling as today's row. (Mirror current eyebrow/title/subtitle text.)
- **Remove** `TodayPlanPanel`, `NutritionPill`, and the `List<Meal>` macro extension helpers if they become unused after the panel is removed. Remove now-unused imports.
- Wrap the screen content in a `verticalScroll` column (the slider + cards may exceed screen height) with horizontal padding consistent with the current 16.dp.

**File:** `ui/nutrition/NutritionHubScreen.kt` — `NutritionHubRoute`
- Add param `onRecipeClick: (recipeId: String) -> Unit`.
- Add `LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }` so featured recipes load on entry.
- Pass `onRecipeClick` into `NutritionHubScreen`.

**File:** `App.kt` — `NutritionHubRoute(...)` call site
- Add `onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) }`.

### 5. `featured` flag — data layer

**New migration:** `supabase/migrations/<timestamp>_recipe_featured.sql`
```sql
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
```
(Use a timestamp later than the latest existing migration. No RLS change — `recipes` is already readable by clients per existing policies.)

**File:** `data/remote/dto/NutritionDto.kt` — `RecipeDto`
- Add field: `@SerialName("featured") val featured: Boolean = false`.
- In `toDomain()`: add `isFeatured = featured`.

**File:** `domain/model/Nutrition.kt` — `Recipe`
- Add field: `val isFeatured: Boolean = false` (default keeps all existing constructors/tests compiling).

> `MealRemoteDataSource.getRecipes()` already selects `*`, so no query change. `RecipeDetailDto` does not need the flag (detail screen unaffected).

### 6. New component — `FeaturedRecipeCard`

**New file:** `composeApp/.../ui/nutrition/components/FeaturedRecipeCard.kt`

A fixed-width vertical card for the horizontal slider.
```kotlin
@Composable
fun FeaturedRecipeCard(recipe: Recipe, onClick: () -> Unit, modifier: Modifier = Modifier)
```
- Width ~200.dp; `Surface(onClick, shape = RoundedCornerShape(8.dp), border = 1.dp outline)`.
- Top: `AsyncImage(model = recipe.imageUrl, contentScale = Crop)` in a ~110.dp-tall box with rounded top; fallback background when `imageUrl == null` (e.g., surface tint, optional `Icons.Default.RestaurantMenu`).
- Below: `recipe.name` (titleSmall bold, max 2 lines, ellipsis); a metadata line — `"${recipe.calories.toInt()} kcal"` plus optional prep/cook time (mirror `RecipesListScreen` time formatting).
- Use `coil3.compose.AsyncImage`.

---

## Data flow summary

- **Dashboard weekly activity:** `HomeViewModel.loadData` → `getAssignedWorkoutsUseCase` + `getWorkoutHistoryUseCase` → `HomeState.workouts/workoutHistory/todayWorkout` → `HomeScreen` derives `weeklyDays`/`volumeKg` via existing pure helpers → `WeeklyActivitySection`.
- **Featured recipes:** `NutritionHubRoute` `LaunchedEffect` → `NutritionIntent.LoadRecipes` → `getRecipesUseCase` (now includes `isFeatured`) → `NutritionState.featuredRecipes` (filter + fallback) → slider.

## Error handling

- Workout history load failure on the dashboard is best-effort (log + empty list); the grid still renders with assigned workouts only, exactly as the Activity Hub already degrades.
- Recipe load failure on the nutrition hub: existing `loadRecipes` sets `error`; the slider shows nothing (no crash). SEE ALL still works.
- `featured` defaulting to `false` means an un-migrated DB simply yields the first-N fallback.

## Testing

- **`HomeViewModelTest`** (`androidUnitTest/.../presentation/home/HomeViewModelTest.kt`): extend the fake/mocks to provide `GetWorkoutHistoryUseCase`; assert `state.workouts` and `state.workoutHistory` are populated after load, and that history failure degrades gracefully (empty list, no error surfaced for history).
- **Recipe DTO mapping:** add/extend a test asserting `RecipeDto(featured = true).toDomain().isFeatured == true` and that the default is `false`.
- **`NutritionState.featuredRecipes`:** unit-test the derivation — returns featured when present; falls back to first 10 when none featured; respects empty list.
- **Activity Hub:** update any existing test/preview referencing the removed weekly-activity block; ensure `ActivityHubScreenPreview` still compiles.
- Run the full suite: `./gradlew :composeApp:testDebugUnitTest` (or the project's standard unit-test task) — green before finishing.

## Files touched (summary)

**New**
- `ui/workout/components/WeeklyActivitySection.kt`
- `ui/nutrition/components/FeaturedRecipeCard.kt`
- `supabase/migrations/<timestamp>_recipe_featured.sql`

**Modified**
- `ui/workout/ActivityHubScreen.kt` (remove weekly section + helpers, add SEE ALL)
- `ui/home/HomeScreen.kt` (Today's Focus → WeeklyActivitySection)
- `presentation/home/HomeState.kt` (+workouts, +workoutHistory)
- `presentation/home/HomeViewModel.kt` (+history load)
- `core/di/AppModule.kt` (inject `GetWorkoutHistoryUseCase` into `HomeViewModel`)
- `ui/nutrition/NutritionHubScreen.kt` (restructure + onRecipeClick + LoadRecipes)
- `presentation/nutrition/NutritionState.kt` (+featuredRecipes)
- `domain/model/Nutrition.kt` (Recipe.isFeatured)
- `data/remote/dto/NutritionDto.kt` (RecipeDto.featured + map)
- `App.kt` (NutritionHubRoute onRecipeClick wiring)
- Tests: `HomeViewModelTest.kt`, recipe DTO / NutritionState tests

## Open decisions (resolved)

- Weekly activity placement → **replaces Today's Focus** on the dashboard; the today bar carries today's plan and is tappable to open today's workout.
- Nutrition top → **Log Meal button only** (TodayPlanPanel removed).
- Nutrition bottom → **Plan / History / Water** as `HubImageCard`s.
- Featured source → **real `featured` flag**, with first-N fallback when none flagged.
