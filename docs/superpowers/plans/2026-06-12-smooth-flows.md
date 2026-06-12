# Smooth Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every daily action — start workout, log meal, log water — reachable from Home in 1–2 taps, and make logging a planned meal a one-tap prefill.

**Architecture:** Five additive changes to the existing MVI screens. New pure-domain `CalculateMacroTargetsUseCase` feeds macro progress bars on Home. Home gains navigation callbacks (same pattern as `onChatClick`) and a `QuickAddWater` intent. `MealCapture` route becomes a data class carrying optional `recipeId`/`mealId`; `NutritionViewModel` resolves them into a `CapturePrefill` that the screen consumes once.

**Tech Stack:** KMP + Compose Multiplatform, Koin, kotlinx.datetime, mockk + kotlin.test (androidUnitTest source set). Tests run with `./gradlew :composeApp:testDebugUnitTest`.

**Spec:** `docs/superpowers/specs/2026-06-12-smooth-flows-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt` | Modify | Add `MacroTargets` model |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCase.kt` | Create | TDEE + macro target math |
| `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCaseTest.kt` | Create | Unit tests for the math |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt` | Modify | `macroTargets`, water optimistic state |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeIntent.kt` | Modify | `QuickAddWater` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt` | Modify | Compute targets; quick-add water |
| `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt` | Modify | New tests |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt` | Modify | Progress bars, START button, water `+`, LOG MEAL |
| `composeApp/src/commonMain/composeResources/values/strings.xml` | Modify | New strings |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt` | Modify | `MealCapture(recipeId?, mealId?)` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` | Modify | Wire all new callbacks |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt` | Modify | `CapturePrefill` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt` | Modify | `LoadCapturePrefill` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt` | Modify | Prefill resolution |
| `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt` | Modify | Prefill tests |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt` | Modify | Consume prefill |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/recipe/RecipeDetailScreen.kt` | Modify | LOG THIS MEAL button |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealDetailScreen.kt` | Modify | LOG THIS MEAL button |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt` | Modify | Register new deps |

---

### Task 1: MacroTargets model + CalculateMacroTargetsUseCase

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt`
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCase.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCaseTest.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`

- [ ] **Step 1: Write the failing test**

Create `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCaseTest.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.usecase.auth.aUser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.math.roundToInt

class CalculateMacroTargetsUseCaseTest {

    private val useCase = CalculateMacroTargetsUseCase()

    // aUser(): 30y, 175 cm, 75 kg, MUSCLE_GAIN, MODERATELY_ACTIVE
    // BMR  = 10*75 + 6.25*175 - 5*30 + 5 = 1698.75
    // TDEE = 1698.75 * 1.55 = 2633.06
    // MUSCLE_GAIN +10% => 2896.37 -> 2896 kcal
    // protein = 75 * 1.8 = 135 g
    // fat = 2896.37 * 0.25 / 9 = 80.45 -> 80 g
    // carbs = (2896.37 - 135*4 - 80.45*9) / 4 = 408.06 -> 408 g
    @Test
    fun `computes targets for muscle gain`() {
        val targets = useCase(aUser())
        assertNotNull(targets)
        assertEquals(2896, targets.calories.roundToInt())
        assertEquals(135, targets.proteinG.roundToInt())
        assertEquals(80, targets.fatG.roundToInt())
        assertEquals(408, targets.carbsG.roundToInt())
    }

    @Test
    fun `weight loss reduces calories by 15 percent`() {
        val user = aUser().copy(goal = UserGoal.WEIGHT_LOSS)
        val targets = useCase(user)
        assertNotNull(targets)
        // 2633.06 * 0.85 = 2238.1
        assertEquals(2238, targets.calories.roundToInt())
    }

    @Test
    fun `mental strength keeps tdee unchanged`() {
        val user = aUser().copy(goal = UserGoal.MENTAL_STRENGTH)
        val targets = useCase(user)
        assertNotNull(targets)
        assertEquals(2633, targets.calories.roundToInt())
    }

    @Test
    fun `sedentary uses 1_2 multiplier`() {
        val user = aUser().copy(goal = UserGoal.MENTAL_STRENGTH, activityLevel = ActivityLevel.SEDENTARY)
        val targets = useCase(user)
        assertNotNull(targets)
        // 1698.75 * 1.2 = 2038.5
        assertEquals(2039, targets.calories.roundToInt())
    }

    @Test
    fun `returns null when body stats missing`() {
        assertNull(useCase(aUser().copy(weightKg = null)))
        assertNull(useCase(aUser().copy(heightCm = null)))
        assertNull(useCase(aUser().copy(age = null)))
        assertNull(useCase(aUser().copy(activityLevel = null)))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCaseTest" --console=plain`
Expected: FAIL — `CalculateMacroTargetsUseCase` unresolved.

- [ ] **Step 3: Add the model and the use case**

Append to `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt`:

```kotlin
data class MacroTargets(
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)
```

Create `composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCase.kt`:

```kotlin
package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.MacroTargets
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal

/**
 * Daily calorie / macro targets from profile data.
 * BMR via Mifflin–St Jeor; the profile has no sex field yet, so the male
 * constant (+5) is used for everyone until onboarding collects it.
 */
class CalculateMacroTargetsUseCase {

    operator fun invoke(user: User): MacroTargets? {
        val weight = user.weightKg ?: return null
        val height = user.heightCm ?: return null
        val age = user.age ?: return null
        val activity = user.activityLevel ?: return null

        val bmr = 10f * weight + 6.25f * height - 5f * age + 5f
        val tdee = bmr * activity.tdeeMultiplier()
        val calories = tdee * user.goal.calorieAdjustment()

        val proteinG = weight * 1.8f
        val fatG = calories * 0.25f / 9f
        val carbsG = ((calories - proteinG * 4f - fatG * 9f) / 4f).coerceAtLeast(0f)

        return MacroTargets(calories = calories, proteinG = proteinG, carbsG = carbsG, fatG = fatG)
    }

    private fun ActivityLevel.tdeeMultiplier(): Float = when (this) {
        ActivityLevel.SEDENTARY -> 1.2f
        ActivityLevel.LIGHTLY_ACTIVE -> 1.375f
        ActivityLevel.MODERATELY_ACTIVE -> 1.55f
        ActivityLevel.ACTIVE -> 1.725f
        ActivityLevel.VERY_ACTIVE -> 1.9f
    }

    private fun UserGoal?.calorieAdjustment(): Float = when (this) {
        UserGoal.WEIGHT_LOSS -> 0.85f
        UserGoal.MUSCLE_GAIN -> 1.10f
        UserGoal.MENTAL_STRENGTH, null -> 1.0f
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCaseTest" --console=plain`
Expected: PASS (5 tests)

- [ ] **Step 5: Register in Koin**

In `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`, next to `factory { CalculateWaterGoalUseCase() }` (~line 269) add:

```kotlin
factory { com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase() }
```

(Or add an import and use the short name, matching surrounding style.)

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/model/Nutrition.kt \
  composeApp/src/commonMain/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCase.kt \
  composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/CalculateMacroTargetsUseCaseTest.kt \
  composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt
git commit -m "feat(domain): add CalculateMacroTargetsUseCase (Mifflin-St Jeor TDEE)"
```

---

### Task 2: HomeViewModel exposes macroTargets

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt`

- [ ] **Step 1: Write the failing test**

In `HomeViewModelTest.kt`, the `viewModel()` helper must gain the new constructor parameter (Step 3 changes the constructor; mirror it here):

```kotlin
private fun viewModel() = HomeViewModel(
    getUserProfileUseCase = GetUserProfileUseCase(userRepo),
    getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
    getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(mealRepo),
    observeChatMessagesUseCase = ObserveChatMessagesUseCase(chatRepo),
    hydrationRepository = hydrationRepo,
    calculateWaterGoalUseCase = CalculateWaterGoalUseCase(),
    calculateMacroTargetsUseCase = CalculateMacroTargetsUseCase(),
    getWaterContainersUseCase = GetWaterContainersUseCase(hydrationRepo),
    userId = "user-1"
)
```

(`GetWaterContainersUseCase` is added here too because Task 3 needs it; add
`coEvery { hydrationRepo.getContainers(any()) } returns Result.success(emptyList())` to `setUp()`.)

Add imports `com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase` and `com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase`, then add the test:

```kotlin
@Test
fun `loadData computes macro targets from profile`() = runTest {
    coEvery { userRepo.getProfile("user-1") } returns Result.success(aUser())
    coEvery { workoutRepo.getAssignedWorkouts("user-1") } returns Result.success(emptyList())
    coEvery { mealRepo.getDailyNutritionSummary("user-1", any()) } returns Result.success(null)

    val vm = viewModel()

    val targets = vm.state.value.macroTargets
    assertNotNull(targets)
    assertEquals(135, targets.proteinG.toInt())
}
```

> The existing tests in this file stub `userRepo.getProfile` etc. — copy the exact stubbing
> style used by the neighbouring `loadData` tests if names differ; the assertions above are the
> contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest" --console=plain`
Expected: FAIL — `macroTargets` / constructor params unresolved.

- [ ] **Step 3: Implement**

`HomeState.kt` — add the field:

```kotlin
import com.coachfoska.app.domain.model.MacroTargets

data class HomeState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val todayWorkout: Workout? = null,
    val nutritionSummary: DailyNutritionSummary? = null,
    val macroTargets: MacroTargets? = null,
    val lastCoachMessage: ChatMessage? = null,
    val waterConsumedMl: Int = 0,
    val waterGoalMl: Int = 2000,
    val error: String? = null
)
```

`HomeViewModel.kt` — add constructor params after `calculateWaterGoalUseCase`:

```kotlin
private val calculateMacroTargetsUseCase: CalculateMacroTargetsUseCase,
private val getWaterContainersUseCase: GetWaterContainersUseCase,
```

with imports
`com.coachfoska.app.domain.usecase.nutrition.CalculateMacroTargetsUseCase` and
`com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase`.
In `loadData`, inside the final `_state.update`, derive targets from the loaded profile:

```kotlin
val loadedUser = profileResult.getOrNull()
_state.update {
    it.copy(
        isLoading = false,
        user = loadedUser,
        todayWorkout = todayWorkout,
        nutritionSummary = nutritionResult.getOrNull(),
        macroTargets = loadedUser?.let { u -> calculateMacroTargetsUseCase(u) },
        lastCoachMessage = lastCoachMessage,
        waterConsumedMl = waterConsumed,
        waterGoalMl = waterGoal,
        error = error
    )
}
```

`AppModule.kt` line ~221 — two more `get()`s (positions match the constructor order):

```kotlin
viewModel { (userId: String) -> HomeViewModel(get(), get(), get(), get(), get(), get(), get(), get(), userId) }
```

- [ ] **Step 4: Run the Home tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest" --console=plain`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add -A composeApp/src
git commit -m "feat(home): expose macro targets in HomeState"
```

---

### Task 3: Quick-add water intent

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt`

- [ ] **Step 1: Write the failing tests**

```kotlin
@Test
fun `quick add water uses favorite container volume`() = runTest {
    coEvery { userRepo.getProfile("user-1") } returns Result.success(aUser())
    coEvery { workoutRepo.getAssignedWorkouts("user-1") } returns Result.success(emptyList())
    coEvery { mealRepo.getDailyNutritionSummary("user-1", any()) } returns Result.success(null)
    coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(
        listOf(
            WaterContainer(id = "c1", name = "Glass", volumeMl = 250),
            WaterContainer(id = "c2", name = "Bottle", volumeMl = 500, isFavorite = true),
        )
    )
    coEvery { hydrationRepo.logWater("user-1", 500) } returns
        Result.success(WaterLog(id = "w1", amountMl = 500, loggedAt = Instant.parse("2026-06-12T10:00:00Z")))

    val vm = viewModel()
    val before = vm.state.value.waterConsumedMl

    vm.onIntent(HomeIntent.QuickAddWater)

    assertEquals(before + 500, vm.state.value.waterConsumedMl)
    coVerify { hydrationRepo.logWater("user-1", 500) }
}

@Test
fun `quick add water falls back to 250ml without containers`() = runTest {
    coEvery { userRepo.getProfile("user-1") } returns Result.success(aUser())
    coEvery { workoutRepo.getAssignedWorkouts("user-1") } returns Result.success(emptyList())
    coEvery { mealRepo.getDailyNutritionSummary("user-1", any()) } returns Result.success(null)
    coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(emptyList())
    coEvery { hydrationRepo.logWater("user-1", 250) } returns
        Result.success(WaterLog(id = "w1", amountMl = 250, loggedAt = Instant.parse("2026-06-12T10:00:00Z")))

    val vm = viewModel()
    vm.onIntent(HomeIntent.QuickAddWater)

    coVerify { hydrationRepo.logWater("user-1", 250) }
}

@Test
fun `quick add water reverts on failure`() = runTest {
    coEvery { userRepo.getProfile("user-1") } returns Result.success(aUser())
    coEvery { workoutRepo.getAssignedWorkouts("user-1") } returns Result.success(emptyList())
    coEvery { mealRepo.getDailyNutritionSummary("user-1", any()) } returns Result.success(null)
    coEvery { hydrationRepo.getContainers("user-1") } returns Result.success(emptyList())
    coEvery { hydrationRepo.logWater("user-1", 250) } returns Result.failure(RuntimeException("offline"))

    val vm = viewModel()
    val before = vm.state.value.waterConsumedMl

    vm.onIntent(HomeIntent.QuickAddWater)

    assertEquals(before, vm.state.value.waterConsumedMl)
    assertNotNull(vm.state.value.error)
}
```

Imports needed: `com.coachfoska.app.domain.model.WaterContainer`, `com.coachfoska.app.domain.model.WaterLog`, `io.mockk.coVerify`, `kotlinx.datetime.Instant`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest" --console=plain`
Expected: FAIL — `QuickAddWater` unresolved.

- [ ] **Step 3: Implement**

`HomeIntent.kt`:

```kotlin
sealed interface HomeIntent {
    data object LoadData : HomeIntent
    data object Refresh : HomeIntent
    data object QuickAddWater : HomeIntent
}
```

`HomeViewModel.kt` — handle the intent in `onIntent`:

```kotlin
HomeIntent.QuickAddWater -> quickAddWater()
```

and add:

```kotlin
private fun quickAddWater() {
    viewModelScope.launch {
        val containers = getWaterContainersUseCase(userId).getOrDefault(emptyList())
        val amountMl = (containers.firstOrNull { it.isFavorite } ?: containers.firstOrNull())
            ?.volumeMl ?: 250

        val previous = _state.value.waterConsumedMl
        _state.update { it.copy(waterConsumedMl = previous + amountMl) }

        hydrationRepository.logWater(userId, amountMl).onFailure { e ->
            Napier.e("quickAddWater failed", e, tag = TAG)
            _state.update { it.copy(waterConsumedMl = previous, error = e.message) }
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.HomeViewModelTest" --console=plain`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A composeApp/src
git commit -m "feat(home): one-tap water logging with optimistic update"
```

---

### Task 4: Home UI — progress bars, START button, water +, LOG MEAL button

**Files:**
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/home/HomeScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

No unit-test framework exists for Compose UI in this repo — verification is compilation plus the ViewModel tests above.

- [ ] **Step 1: Add strings**

In `strings.xml` (alongside `todays_focus`):

```xml
<string name="start_workout">START WORKOUT</string>
<string name="log_meal_button">LOG MEAL</string>
<string name="quick_add_water">Add water</string>
```

- [ ] **Step 2: Update HomeScreen signature and wiring**

`HomeRoute` and `HomeScreen` gain three callbacks (default `{}`), matching the existing `onChatClick` pattern:

```kotlin
onWorkoutClick: (String) -> Unit = {},
onStartWorkout: (String) -> Unit = {},
onLogMealClick: () -> Unit = {},
```

Pass them through `HomeRoute` → `HomeScreen` exactly like `onWaterClick`.

- [ ] **Step 3: Make the workout card actionable**

Replace `WorkoutHomeCard(workout)` call with `WorkoutHomeCard(workout, onClick = { onWorkoutClick(workout.id) }, onStart = { onStartWorkout(workout.id) })` and change the composable:

```kotlin
@Composable
private fun WorkoutHomeCard(workout: Workout, onClick: () -> Unit, onStart: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.onBackground,
        contentColor = MaterialTheme.colorScheme.background,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                text = workout.name.uppercase(),
                style = MaterialTheme.typography.displaySmall.copy(fontSize = 24.sp),
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.5).sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(Res.string.exercises_count, workout.exercises.size),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.background.copy(alpha = 0.7f)
                )
                Box(modifier = Modifier.size(3.dp).background(MaterialTheme.colorScheme.background.copy(alpha = 0.4f), RoundedCornerShape(50)))
                Text(
                    text = stringResource(Res.string.duration_min, workout.durationMinutes),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.background.copy(alpha = 0.7f)
                )
            }
            Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    contentColor = MaterialTheme.colorScheme.onBackground
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = stringResource(Res.string.start_workout),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}
```

(`Button`/`ButtonDefaults` come from the existing `androidx.compose.material3.*` wildcard import.)

- [ ] **Step 4: Macro progress bars**

Replace `MacroRow`/`MacroItem` with target-aware versions; the call site becomes
`MacroRow(nutrition, state.macroTargets)`:

```kotlin
@Composable
private fun MacroRow(summary: DailyNutritionSummary, targets: MacroTargets?) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
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
    modifier: Modifier = Modifier
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier.padding(horizontal = 4.dp)) {
        Text(
            text = "${value.toInt()}$suffix",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        if (target != null && target > 0f) {
            Text(
                text = "/ ${target.toInt()}$suffix",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (value / target).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(50)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 1.sp
        )
    }
}
```

Import `com.coachfoska.app.domain.model.MacroTargets`.

- [ ] **Step 5: Water + button and LOG MEAL button**

`WaterProgressRow` gains `onQuickAdd: () -> Unit`; the trailing edge of its `Row` gets:

```kotlin
Spacer(Modifier.width(8.dp))
IconButton(onClick = onQuickAdd, modifier = Modifier.size(28.dp)) {
    Icon(
        imageVector = Icons.Default.Add,
        contentDescription = stringResource(Res.string.quick_add_water),
        tint = MaterialTheme.colorScheme.primary
    )
}
```

Call site: `WaterProgressRow(consumedMl = …, goalMl = …, onClick = onWaterClick, onQuickAdd = { onIntent(HomeIntent.QuickAddWater) })`.
Imports: `androidx.compose.material.icons.Icons`, `androidx.compose.material.icons.filled.Add`.

Below the nutrition `Surface` block (after `WaterProgressRow`), inside the same Column, add:

```kotlin
TextButton(onClick = onLogMealClick, modifier = Modifier.align(Alignment.End)) {
    Text(
        text = stringResource(Res.string.log_meal_button),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        letterSpacing = 1.sp
    )
}
```

- [ ] **Step 6: Wire navigation in App.kt**

In the `composable<Home>` block:

```kotlin
HomeRoute(
    userId = currentUserId,
    onChatClick = { navController.navigate(HumanCoachChat) },
    onWaterClick = { navController.navigate(Hydration) },
    onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
    onStartWorkout = { workoutId -> navController.navigate(ActiveSession(workoutId)) },
    onLogMealClick = { navController.navigate(MealCapture()) }
)
```

> `MealCapture()` with parentheses only compiles after Task 5 turns the route into a data class.
> If implementing tasks strictly in order, write `MealCapture` here and flip it in Task 5 —
> or do Task 5 first. Either order is fine; the compiler will catch any mismatch.

- [ ] **Step 7: Compile + full Home tests**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.home.*" --console=plain`
Expected: BUILD SUCCESSFUL, tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A composeApp/src
git commit -m "feat(home): action hub — start workout, macro progress, one-tap water, log meal"
```

---

### Task 5: MealCapture route accepts recipeId/mealId

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` (3 call sites: lines ~395, ~411, ~430)

- [ ] **Step 1: Change the route**

```kotlin
@Serializable data class MealCapture(val recipeId: String? = null, val mealId: String? = null)
```

- [ ] **Step 2: Update call sites in App.kt**

Both `onRecordMealClick = { navController.navigate(MealCapture) }` become
`onRecordMealClick = { navController.navigate(MealCapture()) }` (and the Home `onLogMealClick` from Task 4 likewise).
The destination block:

```kotlin
composable<MealCapture> { backStackEntry ->
    val route = backStackEntry.toRoute<MealCapture>()
    MealCaptureRoute(
        userId = currentUserId,
        recipeId = route.recipeId,
        mealId = route.mealId,
        onBackClick = { navController.popBackStack() }
    )
}
```

(`MealCaptureRoute` gains the two parameters in Task 6 — to keep every commit compiling, do Steps 1–2 here and Task 6 Step 3's signature change in the same commit.)

- [ ] **Step 3: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid --console=plain`
Expected: fails only on `MealCaptureRoute` parameters → proceed straight to Task 6 Step 3, then compile again. Commit happens at the end of Task 6.

---

### Task 6: Capture prefill — intent, state, ViewModel, screen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionState.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionIntent.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/core/di/AppModule.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealCaptureScreen.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`

- [ ] **Step 1: Write the failing tests**

Add to `NutritionViewModelTest.kt` (mirror the file's existing mock setup — it already mocks `MealRepository`; the `viewModel()` helper gains `GetRecipeByIdUseCase(mealRepo)` as a constructor arg per Step 3):

```kotlin
@Test
fun `prefill from recipe maps ingredients`() = runTest {
    coEvery { mealRepo.getRecipeById("r1") } returns Result.success(
        aRecipe(id = "r1", name = "Avocado Toast").copy(
            ingredients = listOf(
                RecipeIngredient(name = "Avocado", quantity = 1f, unit = "x", calories = 160f, proteinG = 2f, carbsG = 8.5f, fatG = 14.7f),
                RecipeIngredient(name = "Bread", quantity = 2f, unit = "slice", calories = 180f, proteinG = 6f, carbsG = 34f, fatG = 2f),
            )
        )
    )

    val vm = viewModel()
    vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = "r1", mealId = null))

    val prefill = vm.state.value.capturePrefill
    assertNotNull(prefill)
    assertEquals("Avocado Toast", prefill.mealName)
    assertEquals(2, prefill.foods.size)
    assertEquals("Avocado", prefill.foods[0].name)
    assertEquals(160f, prefill.foods[0].calories)
}

@Test
fun `prefill from meal maps meal foods`() = runTest {
    coEvery { mealRepo.getActiveMealPlan("user-1") } returns Result.success(
        aMealPlan(
            meals = listOf(
                aMeal(id = "m1", name = "Lunch").copy(
                    foods = listOf(
                        MealFood(id = "f1", mealId = "m1", name = "Chicken", amountGrams = 150f, calories = 248f, proteinG = 46f, carbsG = 0f, fatG = 5f)
                    )
                )
            )
        )
    )

    val vm = viewModel()
    vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = null, mealId = "m1"))

    val prefill = vm.state.value.capturePrefill
    assertNotNull(prefill)
    assertEquals("Lunch", prefill.mealName)
    assertEquals("Chicken", prefill.foods[0].name)
    assertEquals(150f, prefill.foods[0].amount)
}

@Test
fun `prefill failure leaves state blank and does not error`() = runTest {
    coEvery { mealRepo.getRecipeById("missing") } returns Result.failure(RuntimeException("offline"))

    val vm = viewModel()
    vm.onIntent(NutritionIntent.LoadCapturePrefill(recipeId = "missing", mealId = null))

    assertNull(vm.state.value.capturePrefill)
}
```

> If the test file has no `aRecipe`/`aMealPlan`/`aMeal` fixtures, add minimal local ones at
> the bottom of the file with all-default fields (copy a `Recipe(...)`/`MealPlan(...)`/`Meal(...)`
> construction from any existing test in the same package).

- [ ] **Step 2: Run tests to verify they fail**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest" --console=plain`
Expected: FAIL — `LoadCapturePrefill` / `capturePrefill` unresolved.

- [ ] **Step 3: Implement state, intent, ViewModel**

`NutritionState.kt` — add at file level:

```kotlin
data class CapturePrefillFood(
    val name: String,
    val amount: Float,
    val unit: String,
    val calories: Float,
    val proteinG: Float,
    val carbsG: Float,
    val fatG: Float
)

data class CapturePrefill(
    val mealName: String,
    val foods: List<CapturePrefillFood>
)
```

and inside `NutritionState`: `val capturePrefill: CapturePrefill? = null,`

`NutritionIntent.kt`:

```kotlin
data class LoadCapturePrefill(val recipeId: String?, val mealId: String?) : NutritionIntent
```

`NutritionViewModel.kt` — add constructor param (after `toggleFavoriteRecipeUseCase`):

```kotlin
private val getRecipeByIdUseCase: GetRecipeByIdUseCase,
```

(import `com.coachfoska.app.domain.usecase.nutrition.GetRecipeByIdUseCase`), handle the intent:

```kotlin
is NutritionIntent.LoadCapturePrefill -> loadCapturePrefill(intent.recipeId, intent.mealId)
```

and implement:

```kotlin
private fun loadCapturePrefill(recipeId: String?, mealId: String?) {
    if (recipeId == null && mealId == null) return
    viewModelScope.launch {
        if (recipeId != null) {
            getRecipeByIdUseCase(recipeId)
                .onSuccess { recipe ->
                    if (recipe == null) return@onSuccess
                    _state.update {
                        it.copy(capturePrefill = CapturePrefill(
                            mealName = recipe.name,
                            foods = recipe.ingredients.map { ing ->
                                CapturePrefillFood(
                                    name = ing.name,
                                    amount = ing.quantity ?: 1f,
                                    unit = ing.unit ?: "x",
                                    calories = ing.calories,
                                    proteinG = ing.proteinG,
                                    carbsG = ing.carbsG,
                                    fatG = ing.fatG
                                )
                            }
                        ))
                    }
                }
                // Prefill is best-effort: failure degrades to blank capture, never blocks logging.
                .onFailure { e -> Napier.e("prefill recipe $recipeId failed", e, tag = TAG) }
        } else if (mealId != null) {
            getActiveMealPlanUseCase(userId)
                .onSuccess { plan ->
                    val meal = plan?.meals?.firstOrNull { it.id == mealId } ?: return@onSuccess
                    _state.update {
                        it.copy(capturePrefill = CapturePrefill(
                            mealName = meal.name,
                            foods = meal.foods.map { mf ->
                                CapturePrefillFood(
                                    name = mf.name,
                                    amount = mf.amountGrams,
                                    unit = "g",
                                    calories = mf.calories,
                                    proteinG = mf.proteinG,
                                    carbsG = mf.carbsG,
                                    fatG = mf.fatG
                                )
                            }
                        ))
                    }
                }
                .onFailure { e -> Napier.e("prefill meal $mealId failed", e, tag = TAG) }
        }
    }
}
```

`AppModule.kt` line ~224 — one more `get()`:

```kotlin
viewModel { (userId: String) -> NutritionViewModel(get(), get(), get(), get(), get(), get(), get(), get(), userId) }
```

- [ ] **Step 4: Screen consumes prefill**

`MealCaptureScreen.kt` — `MealCaptureRoute` gains parameters and fires the intent once:

```kotlin
@Composable
fun MealCaptureRoute(
    userId: String,
    onBackClick: () -> Unit,
    recipeId: String? = null,
    mealId: String? = null,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(recipeId, mealId) {
        viewModel.onIntent(NutritionIntent.LoadCapturePrefill(recipeId, mealId))
    }
    ...
```

In `MealCaptureScreen`, after the local state declarations (`mealName`, `foods`, …):

```kotlin
LaunchedEffect(state.capturePrefill) {
    val prefill = state.capturePrefill ?: return@LaunchedEffect
    // Only seed untouched forms — never clobber user input.
    if (mealName.isBlank() && foods.all { it.name.isBlank() }) {
        mealName = prefill.mealName
        foods = prefill.foods.map { f ->
            FoodEntry(
                name = f.name,
                amount = f.amount.toString().trimEnd('0').trimEnd('.'),
                unit = f.unit,
                baseCalories = f.calories,
                basePro = f.proteinG,
                baseCarbs = f.carbsG,
                baseFat = f.fatG,
                baseServingSize = f.amount,
                baseServingUnit = f.unit,
            )
        }
    }
}
```

- [ ] **Step 5: Run tests + compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.nutrition.NutritionViewModelTest" --console=plain`
Expected: BUILD SUCCESSFUL, tests pass.

- [ ] **Step 6: Commit (includes Task 5 route change)**

```bash
git add -A composeApp/src
git commit -m "feat(nutrition): MealCapture prefill from recipe or planned meal"
```

---

### Task 7: LOG THIS MEAL buttons on RecipeDetail and MealDetail

**Files:**
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/recipe/RecipeDetailScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealDetailScreen.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

- [ ] **Step 1: Add string**

```xml
<string name="log_this_meal">LOG THIS MEAL</string>
```

- [ ] **Step 2: RecipeDetail button**

`RecipeDetailRoute` gains `onLogMeal: () -> Unit = {}`. Inside the `state.recipe != null` branch, wrap the existing content so a pinned button sits under it:

```kotlin
state.recipe != null -> Column(modifier = Modifier.weight(1f)) {
    RecipeDetailScreen(
        recipe = state.recipe!!,
        selectedServings = state.selectedServings,
        onIntent = viewModel::onIntent,
        modifier = Modifier.weight(1f),
    )
    Button(
        onClick = onLogMeal,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(stringResource(Res.string.log_this_meal), fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    }
}
```

Add any missing imports (`Button`, `stringResource`, `Res`, `FontWeight`) following the file's existing imports.

- [ ] **Step 3: MealDetail button**

Same pattern: `MealDetailRoute` gains `onLogMeal: () -> Unit = {}` and renders the same `Button` pinned below the meal content (place it after the screen's main content `Column`/list, before the closing brace of the root `Column`).

- [ ] **Step 4: Wire in App.kt**

```kotlin
composable<RecipeDetail> { backStackEntry ->
    val route = backStackEntry.toRoute<RecipeDetail>()
    RecipeDetailRoute(
        recipeId = route.recipeId,
        userId = currentUserId,
        onBackClick = { navController.popBackStack() },
        onLogMeal = { navController.navigate(MealCapture(recipeId = route.recipeId)) }
    )
}

composable<MealDetail> { backStackEntry ->
    val route = backStackEntry.toRoute<MealDetail>()
    MealDetailRoute(
        mealId = route.mealId,
        userId = currentUserId,
        onBackClick = { navController.popBackStack() },
        onLogMeal = { navController.navigate(MealCapture(mealId = route.mealId)) }
    )
}
```

- [ ] **Step 5: Compile**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid --console=plain`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add -A composeApp/src
git commit -m "feat(nutrition): log-this-meal buttons on recipe and meal detail"
```

---

### Task 8: Full verification

- [ ] **Step 1: Full unit test suite**

Run: `./gradlew :composeApp:testDebugUnitTest --console=plain`
Expected: BUILD SUCCESSFUL, zero failures.

- [ ] **Step 2: Full compile (both targets if the Mac has Xcode time)**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid --console=plain`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Update plan checkboxes and commit any stragglers**

```bash
git add -A
git commit -m "chore: smooth-flows plan complete"
```
