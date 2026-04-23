# Activity & Nutrition Hub — Card Redesign Spec

## Overview

Replace the tab-row navigation inside the Workout and Nutrition screens with a magazine-style card grid. Rename the "Workout" bottom nav tab to "Activity". Each card navigates to the existing content screen for that section.

---

## Screen Changes

### Activity Hub (replaces WorkoutListScreen)

The `WorkoutListScreen` (`ui/workout/WorkoutListScreen.kt`) is replaced by an `ActivityHubScreen`. The `TabRow` (PLAN / HISTORY / LIBRARY) is removed entirely. Instead the screen shows:

- **Hero card** (full width, ~160dp tall): "Today's Plan" → navigates to `WorkoutsTab` content (existing assigned workout list + LOG SESSION button), wrapped in a new `WorkoutPlanScreen`
- **2-column grid** (square cards, equal size):
  - Left: "History" → navigates to `WorkoutHistoryScreen` (already exists at route `WorkoutHistory`)
  - Right: "Library" → navigates to `ExerciseByCategoryScreen` hub (already exists at route `ExercisesByCategory` — but needs a new `ExerciseLibraryScreen` that shows the category grid, since the existing route requires a category ID)

Each card has:
- Bundled grayscale image background with dark overlay (`scrim` gradient, bottom-weighted)
- Small uppercase eyebrow label (e.g. "PLAN", "LOG", "BROWSE")
- Large bold title (e.g. "TODAY'S WORKOUTS")
- Small subtitle (dynamic: e.g. "3 sessions assigned", "12 sessions logged")
- "TODAY" pill badge on the hero card only

### Nutrition Hub (replaces MealPlanScreen)

The `MealPlanScreen` (`ui/nutrition/MealPlanScreen.kt`) is replaced by a `NutritionHubScreen`. The `TabRow` (PLAN / HISTORY / RECIPES) is removed. Instead:

- **Hero card** (full width, ~160dp tall): "Daily Meal Plan" → navigates to `PlanTab` content wrapped in a new `MealPlanDetailScreen`
- **2-column grid**:
  - Left: "History" → navigates to `MealHistoryScreen` (already exists at route `MealHistory`)
  - Right: "Recipes" → navigates to existing recipes grid (currently `RecipesTab` content, extract to `RecipesScreen`)

Subtitle on hero card shows dynamic data: meal count + total kcal from `NutritionState`.

---

## Navigation Changes

### Bottom Nav

`BottomNavBar.kt` — rename enum entry:
```kotlin
// Before
Workout(Res.string.nav_workout, Icons.Default.FitnessCenter)
// After
Activity(Res.string.nav_activity, Icons.Default.FitnessCenter)
```

Update `nav_activity` string resource in all locale files.

`App.kt` — two places reference `BottomNavTab.Workout` by name and must be updated:
1. `selectedTab` derivedStateOf: the `contains("Workout")` string check stays valid for the new routes (WorkoutPlan, WorkoutHistory) — no change needed there. But the result must yield `BottomNavTab.Activity` instead of `BottomNavTab.Workout`.
2. `onTabSelected` when clause: `BottomNavTab.Workout -> WorkoutList` becomes `BottomNavTab.Activity -> WorkoutList`.

### New Routes

Two new routes are needed to host the extracted tab content as standalone screens:

```kotlin
@Serializable object WorkoutPlan       // today's assigned workouts + LOG SESSION
@Serializable object ExerciseLibrary   // category grid (was tab 2 of WorkoutListScreen)
@Serializable object MealPlanDetail    // daily meal plan + RECORD MEAL
@Serializable object RecipesList       // recipes grid (was tab 2 of MealPlanScreen)
```

The hub screens (`ActivityHubScreen`, `NutritionHubScreen`) replace the existing `WorkoutList` and `MealPlan` routes respectively — no route renames needed at the top level.

---

## Image Assets

Six bundled images added to `commonMain/composeResources/drawable/`:

| File | Used in | Subject |
|------|---------|---------|
| `img_activity_plan.jpg` | Activity hero card | Gym / barbell close-up |
| `img_activity_history.jpg` | Activity history card | Athlete lifting weights |
| `img_activity_library.jpg` | Activity library card | Exercise equipment |
| `img_nutrition_plan.jpg` | Nutrition hero card | Healthy meal overhead shot |
| `img_nutrition_history.jpg` | Nutrition history card | Food journal / bowl |
| `img_nutrition_recipes.jpg` | Nutrition recipes card | Ingredient flat-lay |

All images: JPEG, ~400×300px source, desaturated/grayscale aesthetic (can be achieved via `ColorFilter` in Compose rather than pre-processing — apply `ColorMatrix` with saturation ≈ 0.3).

---

## Card Component Design

Extract a shared `HubImageCard` composable in `ui/components/`:

```
HubImageCard(
    imageRes: DrawableResource,
    eyebrow: String,
    title: String,
    subtitle: String,
    badge: String? = null,       // e.g. "TODAY" pill
    onClick: () -> Unit,
    modifier: Modifier
)
```

Internals:
- `Box` with `Image(contentScale = ContentScale.Crop)` + `ColorFilter` for desaturation
- Dark gradient scrim overlay (`Brush.verticalGradient`, transparent → Black 70%)
- Text stacked at bottom-start: eyebrow (labelSmall, 40% alpha) → title (headlineSmall, bold, uppercase) → subtitle (bodySmall, 50% alpha)
- Optional badge pill (top-end, frosted appearance via semi-transparent surface)
- `RoundedCornerShape(16.dp)`
- Ripple on click via `Surface(onClick = ...)`

---

## Hub Screen Layout

Both hub screens share the same structure:

```
Column(fillMaxSize, background) {
    Text("ACTIVITY" / "NUTRITION", displayMedium, padding 24dp)
    
    Column(padding horizontal 16dp, gap 10dp) {
        HubImageCard(hero, modifier = fillMaxWidth + height(160dp))
        Row(gap 10dp) {
            HubImageCard(left, modifier = weight(1f) + aspectRatio(1f))
            HubImageCard(right, modifier = weight(1f) + aspectRatio(1f))
        }
    }
}
```

Dynamic subtitles require the hub screens to observe their respective ViewModels (same VMs as before — `WorkoutViewModel` and `NutritionViewModel`).

---

## Scope

**In scope:**
- `ActivityHubScreen` replacing `WorkoutListScreen`
- `NutritionHubScreen` replacing `MealPlanScreen`
- `WorkoutPlanScreen`, `ExerciseLibraryScreen`, `MealPlanDetailScreen`, `RecipesListScreen` as extracted content screens
- `HubImageCard` shared composable
- Bottom nav rename + string resource
- 6 bundled image assets
- New routes wired in nav graph

**Out of scope:**
- Changes to any detail screens (`WorkoutDetailScreen`, `MealDetailScreen`, `RecipeDetailScreen`, etc.)
- Backend / Supabase changes
- Image upload flow or dynamic images
- Home screen card redesign
