# Activity / Dashboard / Nutrition Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Weekly Activity strip from the Activity tab to the Dashboard, add a "See all" affordance to Assigned Workouts, and restructure the Nutrition tab around a Log Meal button + a featured-recipes slider backed by a real `featured` flag.

**Architecture:** Reuse existing pure-domain helpers (`buildWeeklyActivity`, `deriveTodayVolumeKg`) by extracting the weekly UI into a shared `WeeklyActivitySection` composable. The Dashboard's `HomeViewModel` starts loading workout history so it can render the strip. Recipes gain an `isFeatured` flag end-to-end (migration → DTO → domain → state), surfaced through a derived `featuredRecipes` list with a first-N fallback.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform, Koin DI, Coil 3 (`coil3.compose.AsyncImage`), Supabase/Postgrest, kotlin.test + MockK (androidUnitTest).

**Working directory:** `/Users/juraj/StudioProjects/coach-foska/.claude/worktrees/activity-dashboard-nutrition-refactor` (branch `worktree-activity-dashboard-nutrition-refactor`, based on `master` @ `15ff591`).

**Test command:** `./gradlew :composeApp:testDebugUnitTest` (compiles commonMain + androidMain + androidUnitTest and runs all unit tests). Single class: append `--tests "com.coachfoska.app.<...>.<ClassName>"`. All `./gradlew` commands are pre-approved.

**Commit rule:** stage explicit paths only — never `git add -A`/`.`. End commit messages with the Co-Authored-By trailer below.

---

## Task 1: Add `featured` flag to recipes (domain + DTO + migration)

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt` (Recipe data class, ~line 57-73)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/NutritionDto.kt` (RecipeDto, ~line 184-216)
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/RecipeDtoTest.kt`
- Create: `supabase/migrations/20260527100000_recipe_featured.sql`

- [ ] **Step 1: Write the failing test**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/RecipeDtoTest.kt`:

```kotlin
package com.coachfoska.app.data.remote.dto

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RecipeDtoTest {

    @Test fun `RecipeDto maps featured flag to domain isFeatured`() {
        val dto = RecipeDto(id = "r1", name = "Oats", featured = true)
        assertTrue(dto.toDomain().isFeatured)
    }

    @Test fun `RecipeDto defaults featured to false`() {
        val dto = RecipeDto(id = "r2", name = "Toast")
        assertFalse(dto.toDomain().isFeatured)
        assertEquals("r2", dto.toDomain().id)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.remote.dto.RecipeDtoTest"`
Expected: FAIL — `RecipeDto` has no `featured` parameter / `Recipe` has no `isFeatured`.

- [ ] **Step 3: Add `isFeatured` to the `Recipe` domain model**

In `Nutrition.kt`, add the field to `data class Recipe` (after `ingredients`, keep default so existing constructors compile):

```kotlin
data class Recipe(
    val id: String,
    val name: String,
    val description: String,
    val calories: Float,
    val protein: Float,
    val carbs: Float,
    val fat: Float,
    val imageUrl: String? = null,
    val prepTimeMinutes: Int? = null,
    val cookTimeMinutes: Int? = null,
    val servings: Int = 1,
    val difficulty: String? = null,
    val tags: List<String> = emptyList(),
    val steps: List<RecipeStep> = emptyList(),
    val ingredients: List<RecipeIngredient> = emptyList(),
    val isFeatured: Boolean = false
)
```

- [ ] **Step 4: Add `featured` to `RecipeDto` and map it**

In `NutritionDto.kt`, add the serialized field to `RecipeDto` (after `tags`) and set `isFeatured` in `toDomain()`:

```kotlin
data class RecipeDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val calories: Float = 0f,
    @SerialName("protein_g") val proteinG: Float = 0f,
    @SerialName("carbs_g") val carbsG: Float = 0f,
    @SerialName("fat_g") val fatG: Float = 0f,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("prep_time_min") val prepTimeMin: Int? = null,
    @SerialName("cook_time_min") val cookTimeMin: Int? = null,
    val servings: Int = 1,
    val difficulty: String? = null,
    val tags: List<String> = emptyList(),
    val featured: Boolean = false
) {
    fun toDomain(): Recipe = Recipe(
        id = id,
        name = name,
        description = description ?: "",
        calories = calories,
        protein = proteinG,
        carbs = carbsG,
        fat = fatG,
        imageUrl = photoUrl,
        prepTimeMinutes = prepTimeMin,
        cookTimeMinutes = cookTimeMin,
        servings = servings,
        difficulty = difficulty,
        tags = tags,
        steps = emptyList(),
        ingredients = emptyList(),
        isFeatured = featured
    )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.remote.dto.RecipeDtoTest"`
Expected: PASS (2 tests).

- [ ] **Step 6: Create the migration**

Create `supabase/migrations/20260527100000_recipe_featured.sql`:

```sql
-- Add a curated "featured" flag to recipes for the Nutrition hub slider.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
```

> `MealRemoteDataSource.getRecipes()` selects `*`, so the new column flows through without query changes. Applying the migration to Supabase is a separate deploy step the user owns; do not run it here.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/NutritionDto.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/remote/dto/RecipeDtoTest.kt \
        supabase/migrations/20260527100000_recipe_featured.sql
git commit -m "feat(nutrition): add featured flag to recipes (domain, DTO, migration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Derive `featuredRecipes` on `NutritionState`

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionStateTest.kt`

- [ ] **Step 1: Write the failing test**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionStateTest.kt`:

```kotlin
package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Recipe
import kotlin.test.Test
import kotlin.test.assertEquals

class NutritionStateTest {

    private fun recipe(id: String, featured: Boolean = false) =
        Recipe(id = id, name = id, description = "", calories = 0f, protein = 0f, carbs = 0f, fat = 0f, isFeatured = featured)

    @Test fun `featuredRecipes returns only flagged recipes when some are featured`() {
        val state = NutritionState(
            allRecipes = listOf(recipe("a"), recipe("b", featured = true), recipe("c", featured = true))
        )
        assertEquals(listOf("b", "c"), state.featuredRecipes.map { it.id })
    }

    @Test fun `featuredRecipes falls back to first 10 when none are flagged`() {
        val all = (1..15).map { recipe("r$it") }
        val state = NutritionState(allRecipes = all)
        assertEquals(10, state.featuredRecipes.size)
        assertEquals("r1", state.featuredRecipes.first().id)
    }

    @Test fun `featuredRecipes is empty when there are no recipes`() {
        assertEquals(emptyList(), NutritionState().featuredRecipes)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionStateTest"`
Expected: FAIL — `featuredRecipes` is unresolved.

- [ ] **Step 3: Add the derived property**

In `NutritionState.kt`, add inside the class body next to the existing `recipes` getter:

```kotlin
    val featuredRecipes: List<Recipe>
        get() = allRecipes.filter { it.isFeatured }.ifEmpty { allRecipes.take(10) }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionStateTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionStateTest.kt
git commit -m "feat(nutrition): derive featuredRecipes with first-N fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extract `WeeklyActivitySection` shared component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyActivitySection.kt`

This moves the section label + grid + day-summary bar into a reusable composable. The day bar becomes optionally clickable (used by the Dashboard).

- [ ] **Step 1: Create the component file**

Create `WeeklyActivitySection.kt` with the full content below (the `DaySummaryBar`/`SummaryMetric` bodies are moved verbatim from `ActivityHubScreen.kt`):

```kotlin
package com.coachfoska.app.ui.workout.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.WeekDayActivity
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.usecase.workout.formatVolumeKg

private val SquareShape = RoundedCornerShape(0.dp)

@Composable
fun WeeklyActivitySection(
    days: List<WeekDayActivity>,
    todayWorkout: Workout?,
    volumeKg: Double?,
    onTodayClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "WEEKLY ACTIVITY",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 1.5.sp,
        )
        WeeklyActivityGrid(days = days)
        DaySummaryBar(todayWorkout = todayWorkout, volumeKg = volumeKg, onClick = onTodayClick)
    }
}

@Composable
private fun DaySummaryBar(todayWorkout: Workout?, volumeKg: Double?, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), SquareShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (todayWorkout != null) "TODAY'S FOCUS" else "REST DAY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                letterSpacing = 1.sp,
            )
            Text(
                text = todayWorkout?.name?.uppercase() ?: "Recovery — no workout scheduled",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }
        if (todayWorkout != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                SummaryMetric("DURATION", "${todayWorkout.durationMinutes}m")
                SummaryMetric("EXERCISES", todayWorkout.exercises.size.toString())
                if (volumeKg != null) {
                    SummaryMetric("VOLUME", formatVolumeKg(volumeKg))
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.End) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 1.sp)
        Text(value, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — whole module (incl. this new file) compiles; existing tests green. (`DaySummaryBar` still also exists privately in `ActivityHubScreen.kt` at this point — that's fine, they are different private symbols in different files. Task 4 removes the old copy.)

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/components/WeeklyActivitySection.kt
git commit -m "feat(activity): extract WeeklyActivitySection shared component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Activity Hub — remove Weekly Activity, add SEE ALL

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt`

- [ ] **Step 1: Remove the WEEKLY ACTIVITY block from `ActivityHubScreen`**

Delete this `Column` (currently between `StartWorkoutButton(...)` and the assigned-workouts `if`):

```kotlin
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionLabel("WEEKLY ACTIVITY")
                    WeeklyActivityGrid(days = weeklyDays)
                    DaySummaryBar(todayWorkout = todayWorkout, volumeKg = volumeKg)
                }
```

- [ ] **Step 2: Remove now-unused derivations**

In `ActivityHubScreen(...)`, delete the `weeklyDays` and `volumeKg` `remember` blocks and the `zone` val. Keep `today` and `todayWorkout` (still used). After editing, the top of the function body reads:

```kotlin
    val today = todayDate()
    val todayWorkout = remember(state.workouts, today) {
        state.workouts.firstOrNull { it.dayOfWeek?.index == today.dayOfWeek.ordinal }
    }
```

- [ ] **Step 3: Replace `SCROLL →` with a clickable SEE ALL**

In the ASSIGNED WORKOUTS header `Row`, replace:

```kotlin
                            Text(
                                text = "SCROLL →",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                letterSpacing = 1.sp,
                            )
```

with:

```kotlin
                            Text(
                                text = "SEE ALL",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                                letterSpacing = 1.sp,
                                modifier = Modifier.clickable(onClick = onPlanClick),
                            )
```

- [ ] **Step 4: Remove the moved private composables**

Delete the private `DaySummaryBar` and `SummaryMetric` composables from `ActivityHubScreen.kt` (now in `WeeklyActivitySection.kt`).

- [ ] **Step 5: Fix imports**

In `ActivityHubScreen.kt`:
- Add: `import androidx.compose.foundation.clickable`
- Remove (now unused): `import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity`, `import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg`, `import com.coachfoska.app.domain.usecase.workout.formatVolumeKg`, `import com.coachfoska.app.ui.workout.components.WeeklyActivityGrid`, `import kotlinx.datetime.TimeZone`.
- Keep `import com.coachfoska.app.domain.usecase.workout.deriveCategoryLabel` (still used by AssignedWorkoutCard) and `import com.coachfoska.app.ui.workout.components.AssignedWorkoutCard` / `QuickLinkRow`.
- `BorderStroke`/`border` imports may now be unused (they were only used by the removed `DaySummaryBar`) — remove them if the Kotlin compiler/lint flags them; the `StartWorkoutButton` does not use a border.

> The two `@Preview` functions at the bottom (`ActivityHubScreenPreview`, `ActivityHubScreenRestDayPreview`) still compile unchanged — they only pass `WorkoutState`.

- [ ] **Step 6: Verify it compiles and tests pass**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — module compiles, no unresolved references, existing tests green.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt
git commit -m "feat(activity): move weekly activity out, add See all to assigned workouts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Dashboard — load workout history and show Weekly Activity

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` (line 231)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt`
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt`

- [ ] **Step 1: Write the failing test**

In `HomeViewModelTest.kt`:

(a) Add imports near the others:
```kotlin
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.model.WorkoutLog
import kotlin.test.assertTrue
```

(b) Add `getWorkoutHistoryUseCase` to the `viewModel()` helper (as the last use-case arg before `userId`):
```kotlin
        getWaterContainersUseCase = GetWaterContainersUseCase(hydrationRepo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(workoutRepo),
        userId = "user-1"
```

(c) In `setUp()`, add a default history stub so existing tests keep passing:
```kotlin
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(emptyList())
```

(d) Add a new test:
```kotlin
    @Test
    fun `loadData populates workouts and workout history for weekly activity`() = runTest {
        val workout = Workout(id = "w1", name = "Push", dayOfWeek = null, durationMinutes = 45, exercises = emptyList())
        val log = WorkoutLog(
            id = "l1", userId = "user-1", workoutId = "w1", workoutName = "Push",
            durationMinutes = 45, notes = null, exerciseLogs = emptyList(),
            loggedAt = Instant.parse("2026-06-22T10:00:00Z"),
        )
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(listOf(workout))
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(listOf(log))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertEquals(listOf(workout), vm.state.value.workouts)
        assertEquals(listOf(log), vm.state.value.workoutHistory)
    }

    @Test
    fun `loadData history failure degrades to empty list without breaking load`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.failure(RuntimeException("history offline"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(DailyNutritionSummary(0f, 0f, 0f, 0f))

        val vm = viewModel()

        assertTrue(vm.state.value.workoutHistory.isEmpty())
        assertFalse(vm.state.value.isLoading)
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest"`
Expected: FAIL — `HomeViewModel` has no `getWorkoutHistoryUseCase` param / `state.workouts` unresolved.

- [ ] **Step 3: Extend `HomeState`**

In `HomeState.kt` add the imports and fields:

```kotlin
import com.coachfoska.app.domain.model.WorkoutLog
```

```kotlin
data class HomeState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val todayWorkout: Workout? = null,
    val workouts: List<Workout> = emptyList(),
    val workoutHistory: List<WorkoutLog> = emptyList(),
    val nutritionSummary: DailyNutritionSummary? = null,
    val macroTargets: MacroTargets? = null,
    val lastCoachMessage: ChatMessage? = null,
    val waterConsumedMl: Int = 0,
    val waterGoalMl: Int = 2000,
    val quickAddVolumeMl: Int = 250,
    val error: String? = null
)
```

- [ ] **Step 4: Inject the use case and load history in `HomeViewModel`**

(a) Add the import:
```kotlin
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
```

(b) Add the constructor parameter (last before `userId`):
```kotlin
    private val getWaterContainersUseCase: GetWaterContainersUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val userId: String
```

(c) In `loadData`, add the deferred load next to the others:
```kotlin
            val workoutsDeferred = async { getAssignedWorkoutsUseCase(userId) }
            val historyDeferred = async { getWorkoutHistoryUseCase(userId) }
```

(d) Await it after `workoutsResult`:
```kotlin
            val workoutsResult = workoutsDeferred.await()
            val historyResult = historyDeferred.await()
```

(e) Log failure best-effort (next to the other `onFailure` logs):
```kotlin
            historyResult.onFailure { e -> Napier.e("loadHistory failed", e, tag = TAG) }
```

(f) Set the new state fields in the final `_state.update { it.copy(...) }` (the local `workouts` val already exists):
```kotlin
                    todayWorkout = todayWorkout,
                    workouts = workouts,
                    workoutHistory = historyResult.getOrDefault(emptyList()),
```

- [ ] **Step 5: Update Koin registration**

In `AppModule.kt` line 231, add one more `get()` (positionally matching the new constructor param, before `userId`):

```kotlin
    viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), get(), get(), get(), get(), get(), userId) }
```

- [ ] **Step 6: Run the ViewModel tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest"`
Expected: PASS (all existing + 2 new tests).

- [ ] **Step 7: Replace Today's Focus with WeeklyActivitySection in `HomeScreen`**

In `HomeScreen.kt`, add imports:
```kotlin
import com.coachfoska.app.core.util.todayDate
import com.coachfoska.app.domain.usecase.workout.buildWeeklyActivity
import com.coachfoska.app.domain.usecase.workout.deriveTodayVolumeKg
import com.coachfoska.app.ui.workout.components.WeeklyActivitySection
import kotlinx.datetime.TimeZone
```

Replace the entire **Today's Focus** `Column` block (the one starting `// Today's Focus` with `state.todayWorkout?.let { ... } ?: Surface { ... recovery ... }`) with:

```kotlin
                // Weekly Activity (replaces Today's Focus)
                run {
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
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
```

- [ ] **Step 8: Remove the now-unused `WorkoutHomeCard`**

Delete the private `WorkoutHomeCard` composable from `HomeScreen.kt`. Then remove imports/usages that become unused **only if** the compiler flags them (e.g. `onStartWorkout` is still a `HomeScreen` param but no longer used internally — keep the param to preserve `HomeRoute`'s signature; an unused param is not a compile error). Leave all `Res.string.*` imports as-is (wildcard import `coachfoska.composeapp.generated.resources.*` already covers them and other sections still use it).

- [ ] **Step 9: Verify it compiles and all tests pass**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — full module compiles, all unit tests green.

- [ ] **Step 10: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt
git commit -m "feat(home): show Weekly Activity on dashboard, load workout history

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `FeaturedRecipeCard` slider component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/components/FeaturedRecipeCard.kt`

- [ ] **Step 1: Create the component**

Create `FeaturedRecipeCard.kt`:

```kotlin
package com.coachfoska.app.ui.nutrition.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.coachfoska.app.domain.model.Recipe

@Composable
fun FeaturedRecipeCard(
    recipe: Recipe,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.width(200.dp),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .clip(RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                    .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f)),
                contentAlignment = Alignment.Center,
            ) {
                if (recipe.imageUrl != null) {
                    AsyncImage(
                        model = recipe.imageUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.RestaurantMenu,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.25f),
                        modifier = Modifier.size(32.dp),
                    )
                }
            }
            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = recipe.name,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val meta = listOfNotNull(
                    "${recipe.calories.toInt()} kcal",
                    recipe.prepTimeMinutes?.let { "${it}m prep" },
                ).joinToString(" · ")
                Text(
                    text = meta,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — module compiles, existing tests green.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/components/FeaturedRecipeCard.kt
git commit -m "feat(nutrition): add FeaturedRecipeCard slider component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Nutrition Hub — restructure + featured slider + wiring

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt` (full rewrite)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` (NutritionHubRoute call site, ~line 392)

- [ ] **Step 1: Rewrite `NutritionHubScreen.kt`**

Replace the entire file with:

```kotlin
package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_nutrition_history
import coachfoska.composeapp.generated.resources.img_nutrition_plan
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.HubImageCard
import com.coachfoska.app.ui.nutrition.components.FeaturedRecipeCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onRecordMealClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onRecipeClick: (recipeId: String) -> Unit,
    onWaterClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onRecordMealClick = onRecordMealClick,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick,
        onRecipeClick = onRecipeClick,
        onWaterClick = onWaterClick
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onRecordMealClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    onRecipeClick: (recipeId: String) -> Unit,
    onWaterClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "NUTRITION",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )

        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Log meal — primary entry point
            Button(
                onClick = onRecordMealClick,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "LOG MEAL",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
            }

            // Featured recipes header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "FEATURED RECIPES",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    letterSpacing = 1.5.sp,
                )
                Text(
                    text = "SEE ALL",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.clickable(onClick = onRecipesClick),
                )
            }

            // Featured recipes slider
            val featured = state.featuredRecipes
            when {
                state.isRecipesLoading && state.allRecipes.isEmpty() ->
                    CoachLoadingBox(modifier = Modifier.fillMaxWidth().height(150.dp))
                featured.isEmpty() ->
                    Text(
                        text = "No recipes yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                    )
                else ->
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(end = 16.dp),
                    ) {
                        items(featured, key = { it.id }) { recipe ->
                            FeaturedRecipeCard(recipe = recipe, onClick = { onRecipeClick(recipe.id) })
                        }
                    }
            }

            // Other destinations
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_plan,
                    eyebrow = "Plan",
                    title = "Weekly Plan",
                    subtitle = "Your meals",
                    onClick = onPlanClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = "Log",
                    title = "History",
                    subtitle = "Past meals",
                    onClick = onHistoryClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = "Track",
                    title = "Water",
                    subtitle = "Daily intake",
                    onClick = onWaterClick,
                    modifier = Modifier.weight(1f).aspectRatio(1f),
                )
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
```

> This removes `TodayPlanPanel`, `NutritionPill`, and the `List<Meal>` macro extensions. The `img_nutrition_recipes` drawable is no longer referenced here (still used elsewhere/available) — its import is dropped.

- [ ] **Step 2: Wire `onRecipeClick` in `App.kt`**

In the `NutritionHubRoute(...)` call (~line 392), add the new handler:

```kotlin
                    NutritionHubRoute(
                        userId = currentUserId,
                        onPlanClick = { navController.navigate(MealPlanDetail) },
                        onRecordMealClick = { navController.navigate(MealCapture()) },
                        onHistoryClick = { navController.navigate(MealHistory) },
                        onRecipesClick = { navController.navigate(RecipesList) },
                        onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) },
                        onWaterClick = { navController.navigate(Hydration) }
                    )
```

Verify `RecipeDetail` is already imported in `App.kt` (it is used by the `RecipesList`/`RecipeDetail` composables). If not imported, add `import com.coachfoska.app.navigation.RecipeDetail` (match the existing route import style).

- [ ] **Step 3: Verify it compiles and all tests pass**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — full module compiles, all unit tests green.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt
git commit -m "feat(nutrition): restructure hub around log-meal + featured recipes slider

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Run the full unit-test suite**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: PASS — all tests green, no compilation errors.

- [ ] **Confirm the feature manually (optional, recommended)**

Launch the app (use the project's `run` skill or `./gradlew :composeApp:installDebug`) and verify:
- Activity tab: no Weekly Activity block; "SEE ALL" next to Assigned Workouts opens the Workout Plan.
- Dashboard: Weekly Activity strip + today bar replace the old Today's Focus card; tapping the today bar opens today's workout; nutrition summary still present.
- Nutrition tab: Log Meal button at top → meal capture; Featured Recipes header + See all → recipes list; slider cards open recipe detail; Plan/History/Water cards at the bottom.

---

## Notes for the executor

- The `featured` DB column is created by the migration but must be applied to Supabase separately (user-owned deploy). Until then, the slider shows the first-N fallback — this is expected and correct.
- Keep `onStartWorkout` in `HomeScreen`/`HomeRoute` signatures even though the dashboard no longer uses it internally — removing it would ripple into `App.kt` wiring for no benefit. An unused parameter is not a compile error in Kotlin.
- If the Kotlin compiler reports a genuinely unused import after a removal, delete that import; do not leave dead imports.
