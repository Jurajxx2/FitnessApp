# Exercise Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent photo rendering failure on the exercise detail screen and add a full-height image strip thumbnail to each exercise list row.

**Architecture:** Two isolated UI-only changes — no data layer, no ViewModel, no DB changes. `ExerciseDetailScreen` gets a corrected `clip` + `background` modifier order so `AsyncImage` is clipped to rounded corners. `ExerciseByCategoryScreen`'s `ExerciseListItem` gains a conditional full-height image strip on the left using the same `image_url` already on the `Exercise` model.

**Tech Stack:** Compose Multiplatform, Coil 3 (`coil3.compose.AsyncImage`), Kotlin

---

## Files

| File | Change |
|---|---|
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt` | Fix `clip` + `background` modifier order on `AsyncImage` |
| `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt` | Add thumbnail strip to `ExerciseListItem`; add Coil/clip imports |

---

## Task 1: Fix photo rendering in ExerciseDetailScreen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt:75-95`

The bug: `background(color, shape)` draws a rounded background behind the image but does not clip the image itself — the image renders as a full rectangle on top. `clip(shape)` must come first to constrain both background and image content to the rounded rect.

- [ ] **Step 1: Fix the modifier order on AsyncImage**

In `ExerciseDetailScreen.kt`, find the `AsyncImage` inside the photo row (around line 81) and replace its modifier:

```kotlin
// Before
AsyncImage(
    model = url,
    contentDescription = null,
    contentScale = ContentScale.Crop,
    modifier = Modifier
        .weight(1f)
        .aspectRatio(1f)
        .background(
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
            RoundedCornerShape(12.dp)
        )
)

// After
AsyncImage(
    model = url,
    contentDescription = null,
    contentScale = ContentScale.Crop,
    modifier = Modifier
        .weight(1f)
        .aspectRatio(1f)
        .clip(RoundedCornerShape(12.dp))
        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f))
)
```

Add `import androidx.compose.ui.draw.clip` to the import block (after the existing `androidx.compose.foundation.*` imports).

- [ ] **Step 2: Build to verify no compilation errors**

```bash
./gradlew :composeApp:compileKotlinAndroid
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Run on device/emulator and verify photos appear**

Open the exercise library → tap a category → tap any exercise that has a photo. Confirm two side-by-side rounded images appear below the exercise name.

If images still don't appear, the URLs are null — add a temporary log in `ExerciseViewModel.kt` inside the `SelectExercise` handler:

```kotlin
// In ExerciseViewModel, inside the SelectExercise intent block, after loading:
io.github.aakira.napier.Napier.d("Exercise imageUrl=${exercise.imageUrl} imageUrl2=${exercise.imageUrl2}", tag = "ExercisePhoto")
```

Run with Logcat filtered to tag `ExercisePhoto`. If both values are null, the DB rows have null `image_url` — the fix is a data issue, not a code issue. Remove the log after confirming.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt
git commit -m "fix(ui): clip AsyncImage to rounded corners on exercise detail"
```

---

## Task 2: Add thumbnail strip to exercise list rows

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt:94-129`

When `exercise.imageUrl != null`, the row shows a 72dp-wide full-height image strip flush against the left edge of the card. When null, the row is text-only with no reserved space.

- [ ] **Step 1: Add required imports**

Add these imports to `ExerciseByCategoryScreen.kt` (after existing imports):

```kotlin
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
```

- [ ] **Step 2: Replace ExerciseListItem**

Replace the entire `ExerciseListItem` composable (lines 94–129) with:

```kotlin
@Composable
private fun ExerciseListItem(exercise: Exercise, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (exercise.imageUrl != null) {
            AsyncImage(
                model = exercise.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .width(72.dp)
                    .height(64.dp)
            )
        }
        Row(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = exercise.name,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium
                )
                if (exercise.muscles.isNotEmpty()) {
                    Text(
                        text = exercise.muscles.joinToString(", "),
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                        fontSize = 12.sp
                    )
                }
            }
            Text(
                text = "›",
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                fontSize = 20.sp
            )
        }
    }
}
```

Note: `clip` is applied to the outer `Row` before `background` so the image strip is clipped to the card's rounded corners on the left side. The image has a fixed `height(64.dp)` that matches the typical row height — `ContentScale.Crop` fills the 72×64dp area.

- [ ] **Step 3: Build**

```bash
./gradlew :composeApp:compileKotlinAndroid
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Run and verify**

Open exercise library → tap a category. Confirm:
- Exercises with photos show the full-height image strip on the left
- Exercises without photos show a text-only row with no empty gap on the left
- Row tap still navigates to exercise detail

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseByCategoryScreen.kt
git commit -m "feat(ui): add thumbnail strip to exercise list rows"
```
