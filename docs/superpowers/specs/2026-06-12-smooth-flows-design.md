# Smooth Flows — Home as Action Hub (Design)

> Date: 2026-06-12
> Status: Approved by Juraj (all 5 items)
> Goal: every daily action — start workout, log meal, log water — reachable from Home in 1–2 taps.

## Problem

The Home screen is read-only. The workout card is not clickable, macros are raw numbers with no
targets, water requires opening the hydration screen, and logging a planned meal means re-entering
everything in `MealCapture` from scratch. The athlete's side of the coaching loop has too much
friction, so logging decays and the coach loses visibility.

## Scope — five changes

### 1. Start workout from Home

`WorkoutHomeCard` in [HomeScreen.kt](../../../composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt):

- Card body tap → `WorkoutDetail(workoutId)`.
- New prominent `START WORKOUT` button inside the card → `ActiveSession(workoutId)` (route exists).
- `HomeRoute` gains `onWorkoutClick: (String) -> Unit` and `onStartWorkout: (String) -> Unit`
  callbacks wired in `App.kt` navigation, same pattern as existing `onChatClick`/`onWaterClick`.
- No ViewModel change — `HomeState.todayWorkout` already carries the workout.

### 2. Macro targets with progress bars

- New domain model `MacroTargets(calories, proteinG, carbsG, fatG)` in `domain/model/Nutrition.kt`.
- New use case `CalculateMacroTargetsUseCase(user: User): MacroTargets?` in
  `domain/usecase/nutrition/`. Returns null when height/weight/age/activity missing.
  - BMR via Mifflin–St Jeor (male assumed until a sex field exists; documented in code).
  - TDEE = BMR × activity multiplier (SEDENTARY 1.2, LIGHTLY 1.375, MODERATELY 1.55,
    ACTIVE 1.725, VERY 1.9).
  - Goal adjustment: WEIGHT_LOSS −15%, MUSCLE_GAIN +10%, MENTAL_STRENGTH ±0%.
  - Protein 1.8 g/kg bodyweight; fat 25% of calories; carbs = remainder.
- `HomeState` gains `macroTargets: MacroTargets?`; `HomeViewModel` computes it from the loaded user.
- `MacroRow`/`MacroItem` render `value / target` with a thin `LinearProgressIndicator` per macro,
  same visual style as the existing water bar. No targets → current raw-number rendering.
- Pure-logic use case gets unit tests (TDEE math, missing-data null, goal adjustments).

### 3. One-tap water add on Home

- `WaterProgressRow` gains a `+` icon button on the trailing edge.
- Tap → `HomeIntent.QuickAddWater` → `HydrationRepository.logWater(userId, amountMl)` where
  `amountMl` = the user's favorite container, else first container, else 250 ml fallback
  (containers via existing `GetWaterContainersUseCase`).
- Optimistic update of `waterConsumedMl`; on failure revert + error.
- Row tap (everywhere except the button) still opens the Hydration screen.
- ViewModel test: quick add updates state, picks favorite container amount.

### 4. Quick meal log from Home

- Nutrition card on Home gains a `LOG MEAL` text button → navigates to `MealCapture`
  (new `onLogMealClick` callback, wired in `App.kt`).
- No data changes — entry point only; food search inside MealCapture works now that the
  `foods` table is live.

### 5. Log this meal from recipe / meal plan

- Route change: `@Serializable object MealCapture` → `data class MealCapture(val recipeId: String? = null, val mealId: String? = null)`.
  Update all `navigate(MealCapture)` call sites to `MealCapture()`.
- `RecipeDetail` and `MealDetail` screens get a `LOG THIS MEAL` primary button →
  `MealCapture(recipeId = …)` / `MealCapture(mealId = …)`.
- `NutritionViewModel` (MealCaptureScreen already uses it): on entry with `recipeId`/`mealId`, load the
  recipe ingredients (`RecipeIngredient` already has name + kcal/protein/carbs/fat) or meal foods
  (`MealFood`) and pre-fill the food entry rows; meal name pre-filled from recipe/meal name.
  User adjusts portions, taps Save — existing `NutritionIntent.LogMeal` path unchanged.
- Test: prefill maps ingredients → entry rows correctly; empty/missing recipe falls back to
  blank capture.

## Out of scope (deliberately)

- Coach-set macro overrides (needs profiles columns + admin UI) — later.
- Sex field for accurate BMR — later onboarding addition.
- AI features (photo logging, AI twin) — separate track, starts with the ai-proxy Edge Function.

## Error handling

All new paths reuse existing Result-based repository error propagation into `state.error`.
Quick-add water is optimistic with revert. Prefill failures degrade to blank MealCapture, never block.

## Testing

Unit tests per project convention (`androidUnitTest`): `CalculateMacroTargetsUseCase`,
`HomeViewModel.QuickAddWater`, MealCapture prefill mapping. UI changes verified by compilation +
existing ViewModel tests; no screenshot infra exists.
