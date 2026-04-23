# Activity & Nutrition Hub Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tab-row navigation inside the Workout and Nutrition screens with a magazine-style card grid, rename the "Workout" bottom nav tab to "Activity", and add grayscale image backgrounds to the cards.

**Architecture:** Two new hub screens (`ActivityHubScreen`, `NutritionHubScreen`) replace the existing tab-based screens. Each hub shows a hero card + 2-col grid that navigates to dedicated sub-screens for Plan, History, and Library/Recipes. A shared `HubImageCard` composable renders the grayscale image cards.

**Tech Stack:** Compose Multiplatform, KMP, Koin, Jetpack Navigation (typesafe), `composeResources/drawable/` for bundled JPEG assets.

---

## File Map

**Create:**
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/HubImageCard.kt` — shared image card composable
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt` — magazine grid hub (replaces WorkoutListScreen's role)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutPlanScreen.kt` — standalone plan content (extracted from WorkoutsTab)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseLibraryScreen.kt` — standalone category grid (extracted from ExercisesTab)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt` — magazine grid hub (replaces MealPlanScreen's role)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealPlanDetailScreen.kt` — standalone plan content (extracted from PlanTab)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/RecipesListScreen.kt` — standalone recipes grid (extracted from RecipesTab)
- `composeApp/src/commonMain/composeResources/drawable/img_activity_plan.jpg` — hero image for Activity plan card
- `composeApp/src/commonMain/composeResources/drawable/img_activity_history.jpg` — image for Activity history card
- `composeApp/src/commonMain/composeResources/drawable/img_activity_library.jpg` — image for Activity library card
- `composeApp/src/commonMain/composeResources/drawable/img_nutrition_plan.jpg` — hero image for Nutrition plan card
- `composeApp/src/commonMain/composeResources/drawable/img_nutrition_history.jpg` — image for Nutrition history card
- `composeApp/src/commonMain/composeResources/drawable/img_nutrition_recipes.jpg` — image for Nutrition recipes card

**Modify:**
- `composeApp/src/commonMain/composeResources/values/strings.xml` — add `nav_activity` string
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/BottomNavBar.kt` — rename `Workout` → `Activity`
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt` — add 4 new routes
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt` — wire new screens, fix tab enum references
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutListScreen.kt` — delete file (all content moves to new files)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealPlanScreen.kt` — delete file (all content moves to new files)

---

## Task 1: Add `nav_activity` string resource and rename bottom nav enum

**Files:**
- Modify: `composeApp/src/commonMain/composeResources/values/strings.xml`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/BottomNavBar.kt`

- [ ] **Step 1: Add `nav_activity` string to strings.xml**

In `strings.xml`, replace line 76:
```xml
<string name="nav_workout">Workout</string>
```
with:
```xml
<string name="nav_workout">Workout</string>
<string name="nav_activity">Activity</string>
```

- [ ] **Step 2: Rename the enum entry in BottomNavBar.kt**

Replace the full file content:
```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

enum class BottomNavTab(val labelRes: StringResource, val icon: ImageVector) {
    Home(Res.string.nav_home, Icons.Default.Home),
    Activity(Res.string.nav_activity, Icons.Default.FitnessCenter),
    Chat(Res.string.nav_chat, Icons.AutoMirrored.Filled.Chat),
    Nutrition(Res.string.nav_nutrition, Icons.Default.Restaurant),
    Profile(Res.string.nav_profile, Icons.Default.Person)
}

@Composable
fun BottomNavBar(
    selectedTab: BottomNavTab,
    onTabSelected: (BottomNavTab) -> Unit,
    chatUnreadCount: Int = 0
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.background,
        tonalElevation = 0.dp
    ) {
        BottomNavTab.entries.forEach { tab ->
            val label = stringResource(tab.labelRes)
            NavigationBarItem(
                selected = selectedTab == tab,
                onClick = { onTabSelected(tab) },
                icon = {
                    if (tab == BottomNavTab.Chat && chatUnreadCount > 0) {
                        BadgedBox(
                            badge = { Badge { Text(chatUnreadCount.coerceAtMost(99).toString()) } }
                        ) {
                            Icon(tab.icon, contentDescription = label)
                        }
                    } else {
                        Icon(tab.icon, contentDescription = label)
                    }
                },
                label = {
                    Text(label, style = MaterialTheme.typography.labelSmall)
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
                )
            )
        }
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL. The only compile errors at this point will be in `App.kt` which still references `BottomNavTab.Workout` — that is expected and will be fixed in Task 4.

---

## Task 2: Add new routes

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/navigation/Routes.kt`

- [ ] **Step 1: Add 4 new routes to Routes.kt**

Add after the existing `// Workout` section routes:
```kotlin
// Workout
@Serializable object WorkoutList
@Serializable data class WorkoutDetail(val workoutId: String)
@Serializable data class ExerciseDetail(val exerciseId: String)
@Serializable data class ExercisesByCategory(val categoryId: Int, val categoryName: String)
@Serializable object LogWorkout
@Serializable object WorkoutHistory
@Serializable data class WorkoutHistoryDetail(val logId: String)
@Serializable object WorkoutPlan        // NEW: today's assigned workouts
@Serializable object ExerciseLibrary    // NEW: exercise category grid
```

And after the `// Nutrition` section:
```kotlin
// Nutrition
@Serializable object MealPlan
@Serializable data class MealDetail(val mealId: String)
@Serializable object MealCapture
@Serializable object MealHistory
@Serializable data class MealHistoryDetail(val logId: String)
@Serializable data class RecipeDetail(val recipeId: String)
@Serializable object MealPlanDetail     // NEW: daily meal plan + record button
@Serializable object RecipesList        // NEW: recipes grid
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (or same prior errors from Task 1 in App.kt only).

---

## Task 3: Add image assets

**Files:**
- Create: `composeApp/src/commonMain/composeResources/drawable/` (6 JPEG files)

- [ ] **Step 1: Create the drawable directory**

```bash
mkdir -p composeApp/src/commonMain/composeResources/drawable
```

- [ ] **Step 2: Download and place 6 JPEG images**

Download these images from Unsplash (or any source) and save them with the exact filenames below. Target size: ~600×400px, JPEG. Grayscale or low-saturation aesthetic is fine but not required — the app applies a `ColorFilter` for desaturation at runtime.

| Filename | Subject |
|----------|---------|
| `img_activity_plan.jpg` | Gym interior, barbell, or squat rack |
| `img_activity_history.jpg` | Athlete lifting, kettlebell, or dumbbells |
| `img_activity_library.jpg` | Exercise equipment, pull-up bar, or cable machine |
| `img_nutrition_plan.jpg` | Healthy meal overhead shot, meal prep containers |
| `img_nutrition_history.jpg` | Food journal, bowl of food, smoothie |
| `img_nutrition_recipes.jpg` | Ingredients flat-lay, cutting board, colorful vegetables |

Suggested Unsplash search terms: "gym barbell", "athlete weights", "fitness equipment", "healthy meal prep", "food bowl", "ingredients flat lay".

Place all 6 files at: `composeApp/src/commonMain/composeResources/drawable/<filename>.jpg`

- [ ] **Step 3: Verify assets are discovered**

```bash
./gradlew :composeApp:generateComposeResClass
```
Expected: BUILD SUCCESSFUL. The generated `Res` class will now include `drawable.img_activity_plan` etc.

---

## Task 4: Create `HubImageCard` shared composable

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/components/HubImageCard.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource

@Composable
fun HubImageCard(
    imageRes: DrawableResource,
    eyebrow: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: String? = null
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(16.dp)
    ) {
        Box {
            Image(
                painter = painterResource(imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                colorFilter = ColorFilter.colorMatrix(
                    ColorMatrix().apply { setToSaturation(0.3f) }
                )
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.78f))
                        )
                    )
            )
            badge?.let {
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = Color.White.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        letterSpacing = 1.sp
                    )
                }
            }
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = eyebrow.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.5f),
                    letterSpacing = 1.5.sp
                )
                Text(
                    text = title.uppercase(),
                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
                    color = Color.White,
                    letterSpacing = (-0.3).sp
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.55f)
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 5: Create `WorkoutPlanScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutPlanScreen.kt`

This is the extracted "PLAN" tab content from `WorkoutListScreen` — the list of assigned workouts + the LOG SESSION button.

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun WorkoutPlanRoute(
    userId: String,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    WorkoutPlanScreen(
        state = state,
        onWorkoutClick = onWorkoutClick,
        onLogWorkoutClick = onLogWorkoutClick,
        onBackClick = onBackClick
    )
}

@Composable
fun WorkoutPlanScreen(
    state: WorkoutState,
    onWorkoutClick: (String) -> Unit,
    onLogWorkoutClick: () -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "PLAN", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(state.workouts) { workout ->
                    WorkoutPlanCard(workout = workout, onClick = { onWorkoutClick(workout.id) })
                }
                if (state.workouts.isEmpty()) {
                    item {
                        Text(
                            text = "No workouts assigned yet.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                        )
                    }
                }
            }

            CoachButton(
                text = "LOG SESSION",
                onClick = onLogWorkoutClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 24.dp)
            )
        }
    }
}

@Composable
private fun WorkoutPlanCard(workout: Workout, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            workout.dayOfWeek?.let {
                Text(
                    text = it.displayName.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                    letterSpacing = 1.sp
                )
            }
            Text(
                text = workout.name,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${workout.exercises.size} Exercises",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                if (workout.durationMinutes > 0) {
                    androidx.compose.foundation.layout.Box(
                        modifier = Modifier
                            .size(3.dp)
                            .background(
                                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                                RoundedCornerShape(50)
                            )
                    )
                    Text(
                        text = "${workout.durationMinutes} Min",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 6: Create `ExerciseLibraryScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseLibraryScreen.kt`

This is the extracted "LIBRARY" tab content — the category grid.

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.exercise.ExerciseIntent
import com.coachfoska.app.presentation.exercise.ExerciseViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ExerciseLibraryRoute(
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: ExerciseViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(ExerciseIntent.LoadCategories) }

    ExerciseLibraryScreen(
        categories = state.categories,
        isLoading = state.isCategoriesLoading,
        onCategoryClick = onCategoryClick,
        onBackClick = onBackClick
    )
}

@Composable
fun ExerciseLibraryScreen(
    categories: List<com.coachfoska.app.domain.model.ExerciseCategory>,
    isLoading: Boolean,
    onCategoryClick: (categoryId: Int, categoryName: String) -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "LIBRARY", onBackClick = onBackClick)

        if (isLoading) {
            CoachLoadingBox()
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(24.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(categories) { category ->
                    Surface(
                        onClick = { onCategoryClick(category.id, category.name) },
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.background,
                        border = androidx.compose.foundation.BorderStroke(
                            1.dp,
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f)
                        )
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1.2f)
                                .padding(16.dp),
                            contentAlignment = Alignment.BottomStart
                        ) {
                            Text(
                                text = category.name.uppercase(),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onBackground,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 7: Create `ActivityHubScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_activity_history
import coachfoska.composeapp.generated.resources.img_activity_library
import coachfoska.composeapp.generated.resources.img_activity_plan
import com.coachfoska.app.presentation.workout.WorkoutState
import com.coachfoska.app.presentation.workout.WorkoutViewModel
import com.coachfoska.app.ui.components.HubImageCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun ActivityHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit,
    viewModel: WorkoutViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ActivityHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onLibraryClick = onLibraryClick
    )
}

@Composable
fun ActivityHubScreen(
    state: WorkoutState,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onLibraryClick: () -> Unit
) {
    val planSubtitle = when {
        state.isLoading -> "Loading..."
        state.workouts.isEmpty() -> "No workouts assigned"
        else -> "${state.workouts.size} sessions assigned"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Text(
            text = "ACTIVITY",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )
        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            HubImageCard(
                imageRes = Res.drawable.img_activity_plan,
                eyebrow = "Plan",
                title = "Today's Workouts",
                subtitle = planSubtitle,
                badge = "TODAY",
                onClick = onPlanClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HubImageCard(
                    imageRes = Res.drawable.img_activity_history,
                    eyebrow = "Log",
                    title = "History",
                    subtitle = "View your sessions",
                    onClick = onHistoryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
                HubImageCard(
                    imageRes = Res.drawable.img_activity_library,
                    eyebrow = "Browse",
                    title = "Library",
                    subtitle = "By category",
                    onClick = onLibraryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 8: Create `MealPlanDetailScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealPlanDetailScreen.kt`

This is the extracted "PLAN" tab content from `MealPlanScreen` — the list of meals + RECORD MEAL button.

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun MealPlanDetailRoute(
    userId: String,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MealPlanDetailScreen(
        state = state,
        onMealClick = onMealClick,
        onRecordMealClick = onRecordMealClick,
        onBackClick = onBackClick
    )
}

@Composable
fun MealPlanDetailScreen(
    state: NutritionState,
    onMealClick: (String) -> Unit,
    onRecordMealClick: () -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "MEAL PLAN", onBackClick = onBackClick)

        if (state.isLoading) {
            CoachLoadingBox()
            return@Column
        }

        Column(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text(
                        text = "DAILY MEAL PLAN",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 1.5.sp
                    )
                }
                state.mealPlan?.let { plan ->
                    items(plan.meals.sortedBy { it.sortOrder }) { meal ->
                        MealPlanDetailCard(meal = meal, onClick = { onMealClick(meal.id) })
                    }
                } ?: item {
                    Text(
                        text = "No meal plan assigned yet.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    )
                }
            }

            CoachButton(
                text = "RECORD MEAL",
                onClick = onRecordMealClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 24.dp)
            )
        }
    }
}

@Composable
private fun MealPlanDetailCard(meal: Meal, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = meal.name,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onBackground
                )
                meal.timeOfDay?.let {
                    Text(
                        text = it.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                        letterSpacing = 0.5.sp
                    )
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${meal.totalCalories.toInt()} KCAL",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .size(3.dp)
                        .background(
                            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.2f),
                            RoundedCornerShape(50)
                        )
                )
                Text(
                    text = "${meal.totalProtein.toInt()}G PROTEIN",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 9: Create `RecipesListScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/RecipesListScreen.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.Recipe
import com.coachfoska.app.presentation.nutrition.NutritionIntent
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.CoachLoadingBox
import com.coachfoska.app.ui.components.CoachTopBar
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun RecipesListRoute(
    userId: String,
    onRecipeClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.onIntent(NutritionIntent.LoadRecipes) }
    RecipesListScreen(
        state = state,
        onRecipeClick = onRecipeClick,
        onBackClick = onBackClick
    )
}

@Composable
fun RecipesListScreen(
    state: NutritionState,
    onRecipeClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        CoachTopBar(title = "RECIPES", onBackClick = onBackClick)

        if (state.isRecipesLoading) {
            CoachLoadingBox()
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(24.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.recipes) { recipe ->
                    RecipesListCard(recipe = recipe, onClick = { onRecipeClick(recipe.id) })
                }
            }
        }
    }
}

@Composable
private fun RecipesListCard(recipe: Recipe, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.onBackground.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = recipe.name.uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.5.sp,
                maxLines = 2
            )
            Text(
                text = "${recipe.calories.toInt()} kcal",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 10: Create `NutritionHubScreen`

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/NutritionHubScreen.kt`

- [ ] **Step 1: Create the file**

```kotlin
package com.coachfoska.app.ui.nutrition

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.img_nutrition_history
import coachfoska.composeapp.generated.resources.img_nutrition_plan
import coachfoska.composeapp.generated.resources.img_nutrition_recipes
import com.coachfoska.app.presentation.nutrition.NutritionState
import com.coachfoska.app.presentation.nutrition.NutritionViewModel
import com.coachfoska.app.ui.components.HubImageCard
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun NutritionHubRoute(
    userId: String,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit,
    viewModel: NutritionViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    NutritionHubScreen(
        state = state,
        onPlanClick = onPlanClick,
        onHistoryClick = onHistoryClick,
        onRecipesClick = onRecipesClick
    )
}

@Composable
fun NutritionHubScreen(
    state: NutritionState,
    onPlanClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onRecipesClick: () -> Unit
) {
    val planSubtitle = when {
        state.isLoading -> "Loading..."
        state.mealPlan == null -> "No meal plan assigned"
        else -> {
            val mealCount = state.mealPlan.meals.size
            val totalKcal = state.mealPlan.meals.sumOf { it.totalCalories.toDouble() }.toInt()
            "$mealCount meals · $totalKcal kcal"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Text(
            text = "NUTRITION",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)
        )
        Column(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            HubImageCard(
                imageRes = Res.drawable.img_nutrition_plan,
                eyebrow = "Plan",
                title = "Daily Meal Plan",
                subtitle = planSubtitle,
                badge = "TODAY",
                onClick = onPlanClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_history,
                    eyebrow = "Log",
                    title = "History",
                    subtitle = "Past meals",
                    onClick = onHistoryClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
                HubImageCard(
                    imageRes = Res.drawable.img_nutrition_recipes,
                    eyebrow = "Browse",
                    title = "Recipes",
                    subtitle = "Meal ideas",
                    onClick = onRecipesClick,
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL (same prior App.kt errors only).

---

## Task 11: Wire everything in `App.kt` and fix nav references

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

- [ ] **Step 1: Update imports**

`App.kt` already has `import com.coachfoska.app.navigation.*` so new routes are automatically in scope. Only the screen imports need changing.

Remove:
```kotlin
import com.coachfoska.app.ui.nutrition.MealPlanRoute
import com.coachfoska.app.ui.workout.WorkoutListRoute
```
Add:
```kotlin
import com.coachfoska.app.ui.nutrition.MealPlanDetailRoute
import com.coachfoska.app.ui.nutrition.NutritionHubRoute
import com.coachfoska.app.ui.nutrition.RecipesListRoute
import com.coachfoska.app.ui.workout.ActivityHubRoute
import com.coachfoska.app.ui.workout.ExerciseLibraryRoute
import com.coachfoska.app.ui.workout.WorkoutPlanRoute
```

- [ ] **Step 2: Fix `selectedTab` derivedStateOf — rename `BottomNavTab.Workout` to `BottomNavTab.Activity`**

In the `selectedTab` derivedStateOf block, change:
```kotlin
currentRoute?.contains("Workout", ignoreCase = true) == true ||
    currentRoute?.contains("Exercise", ignoreCase = true) == true -> BottomNavTab.Workout
```
to:
```kotlin
currentRoute?.contains("Workout", ignoreCase = true) == true ||
    currentRoute?.contains("Exercise", ignoreCase = true) == true -> BottomNavTab.Activity
```

- [ ] **Step 3: Fix `onTabSelected` — rename `BottomNavTab.Workout` to `BottomNavTab.Activity`**

In the `onTabSelected` when block, change:
```kotlin
BottomNavTab.Workout -> WorkoutList
```
to:
```kotlin
BottomNavTab.Activity -> WorkoutList
```

- [ ] **Step 4: Replace the `WorkoutList` composable destination with `ActivityHubRoute`**

Replace:
```kotlin
composable<WorkoutList>(
    enterTransition = { fadeIn(tween(150)) },
    exitTransition = { fadeOut(tween(150)) },
    popEnterTransition = { fadeIn(tween(150)) },
    popExitTransition = { fadeOut(tween(150)) }
) {
    WorkoutListRoute(
        userId = currentUserId,
        onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
        onLogWorkoutClick = { navController.navigate(LogWorkout) },
        onCategoryClick = { categoryId, categoryName ->
            navController.navigate(ExercisesByCategory(categoryId, categoryName))
        },
        onHistoryItemClick = { logId -> navController.navigate(WorkoutHistoryDetail(logId)) }
    )
}
```
with:
```kotlin
composable<WorkoutList>(
    enterTransition = { fadeIn(tween(150)) },
    exitTransition = { fadeOut(tween(150)) },
    popEnterTransition = { fadeIn(tween(150)) },
    popExitTransition = { fadeOut(tween(150)) }
) {
    ActivityHubRoute(
        userId = currentUserId,
        onPlanClick = { navController.navigate(WorkoutPlan) },
        onHistoryClick = { navController.navigate(WorkoutHistory) },
        onLibraryClick = { navController.navigate(ExerciseLibrary) }
    )
}
```

- [ ] **Step 5: Add `WorkoutPlan` and `ExerciseLibrary` composable destinations**

Add these two new `composable` blocks inside the `NavHost`, after the existing `WorkoutHistory` block:
```kotlin
composable<WorkoutPlan> {
    WorkoutPlanRoute(
        userId = currentUserId,
        onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
        onLogWorkoutClick = { navController.navigate(LogWorkout) },
        onBackClick = { navController.popBackStack() }
    )
}

composable<ExerciseLibrary> {
    ExerciseLibraryRoute(
        onCategoryClick = { categoryId, categoryName ->
            navController.navigate(ExercisesByCategory(categoryId, categoryName))
        },
        onBackClick = { navController.popBackStack() }
    )
}
```

- [ ] **Step 6: Replace the `MealPlan` composable destination with `NutritionHubRoute`**

Replace:
```kotlin
composable<MealPlan>(
    enterTransition = { fadeIn(tween(150)) },
    exitTransition = { fadeOut(tween(150)) },
    popEnterTransition = { fadeIn(tween(150)) },
    popExitTransition = { fadeOut(tween(150)) }
) {
    MealPlanRoute(
        userId = currentUserId,
        onMealClick = { mealId -> navController.navigate(MealDetail(mealId)) },
        onRecordMealClick = { navController.navigate(MealCapture) },
        onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) }
    )
}
```
with:
```kotlin
composable<MealPlan>(
    enterTransition = { fadeIn(tween(150)) },
    exitTransition = { fadeOut(tween(150)) },
    popEnterTransition = { fadeIn(tween(150)) },
    popExitTransition = { fadeOut(tween(150)) }
) {
    NutritionHubRoute(
        userId = currentUserId,
        onPlanClick = { navController.navigate(MealPlanDetail) },
        onHistoryClick = { navController.navigate(MealHistory) },
        onRecipesClick = { navController.navigate(RecipesList) }
    )
}
```

- [ ] **Step 7: Add `MealPlanDetail` and `RecipesList` composable destinations**

Add after the existing `MealHistory` block:
```kotlin
composable<MealPlanDetail> {
    MealPlanDetailRoute(
        userId = currentUserId,
        onMealClick = { mealId -> navController.navigate(MealDetail(mealId)) },
        onRecordMealClick = { navController.navigate(MealCapture) },
        onBackClick = { navController.popBackStack() }
    )
}

composable<RecipesList> {
    RecipesListRoute(
        userId = currentUserId,
        onRecipeClick = { recipeId -> navController.navigate(RecipeDetail(recipeId)) },
        onBackClick = { navController.popBackStack() }
    )
}
```

- [ ] **Step 8: Full build and verify**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL with zero errors. All `BottomNavTab.Workout` references are gone, all new routes are wired.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): Activity & Nutrition hub card redesign — magazine grid with grayscale image cards"
```

---

## Task 12: Delete dead code from old screens

**Files:**
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutListScreen.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealPlanScreen.kt`

- [ ] **Step 1: Delete WorkoutListScreen.kt**

```bash
rm composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/WorkoutListScreen.kt
```

- [ ] **Step 2: Delete MealPlanScreen.kt**

```bash
rm composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/nutrition/MealPlanScreen.kt
```

- [ ] **Step 3: Final build**

```bash
./gradlew :composeApp:compileKotlinAndroid
```
Expected: BUILD SUCCESSFUL. No references to the deleted files remain.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(ui): remove old tab-based WorkoutListScreen and MealPlanScreen"
```
