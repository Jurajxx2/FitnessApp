# Exercise Rep Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two static side-by-side exercise photos on the detail screen with a single hero image that crossfade-loops between the start and end frames, reading as one body performing the rep.

**Architecture:** A new self-contained `ExerciseAnimatedImage` composable stacks two Coil `AsyncImage`s in a `Box` — the start frame opaque on the bottom, the end frame on top with its alpha driven by an infinite keyframe animation (holds at each end, smooth morphs between). A pure `animatedImageMode(start, end)` helper decides animated vs. static vs. nothing and is unit-tested. `ExerciseDetailScreen` swaps its static photo `Row` for one call to the new component.

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform 1.10.2, Coil 3.3.0 (`coil3.compose.AsyncImage`), `androidx.compose.animation.core` (`rememberInfiniteTransition`, `keyframes`), `kotlin.test` for unit tests.

---

### Task 1: `animatedImageMode` helper + tests

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImage.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImageTest.kt`

- [ ] **Step 1: Write the failing test**

Create `ExerciseAnimatedImageTest.kt`:

```kotlin
package com.coachfoska.app.ui.workout

import kotlin.test.Test
import kotlin.test.assertEquals

class ExerciseAnimatedImageTest {

    @Test
    fun bothUrlsPresent_isAnimated() {
        assertEquals(
            AnimatedImageMode.ANIMATED,
            animatedImageMode("start.jpg", "end.jpg")
        )
    }

    @Test
    fun onlyStartUrl_isStatic() {
        assertEquals(
            AnimatedImageMode.STATIC,
            animatedImageMode("start.jpg", null)
        )
    }

    @Test
    fun onlyEndUrl_isStatic() {
        assertEquals(
            AnimatedImageMode.STATIC,
            animatedImageMode(null, "end.jpg")
        )
    }

    @Test
    fun noUrls_isNone() {
        assertEquals(
            AnimatedImageMode.NONE,
            animatedImageMode(null, null)
        )
    }
}
```

Note: when only `endUrl` is present, the STATIC frame must be the end frame (see Step 3) — there is always exactly one frame to show in STATIC mode.

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.ui.workout.ExerciseAnimatedImageTest"`
Expected: FAIL — compilation error, `animatedImageMode` and `AnimatedImageMode` unresolved.

- [ ] **Step 3: Write minimal implementation**

Create `ExerciseAnimatedImage.kt` with just the helper for now:

```kotlin
package com.coachfoska.app.ui.workout

enum class AnimatedImageMode { ANIMATED, STATIC, NONE }

fun animatedImageMode(startUrl: String?, endUrl: String?): AnimatedImageMode =
    when {
        startUrl != null && endUrl != null -> AnimatedImageMode.ANIMATED
        startUrl != null || endUrl != null -> AnimatedImageMode.STATIC
        else -> AnimatedImageMode.NONE
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.ui.workout.ExerciseAnimatedImageTest"`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImage.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImageTest.kt
git commit -m "feat(ui): add animatedImageMode helper for exercise rep animation"
```

---

### Task 2: `ExerciseAnimatedImage` composable

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImage.kt`

This composable has no unit test — animation timing and Coil rendering are verified visually in Task 4. Build correctness is verified by compiling.

- [ ] **Step 1: Add the composable to the existing file**

Append to `ExerciseAnimatedImage.kt` (keep the existing `enum` + `animatedImageMode` from Task 1). Full file after this step:

```kotlin
package com.coachfoska.app.ui.workout

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import androidx.compose.foundation.layout.Box

enum class AnimatedImageMode { ANIMATED, STATIC, NONE }

fun animatedImageMode(startUrl: String?, endUrl: String?): AnimatedImageMode =
    when {
        startUrl != null && endUrl != null -> AnimatedImageMode.ANIMATED
        startUrl != null || endUrl != null -> AnimatedImageMode.STATIC
        else -> AnimatedImageMode.NONE
    }

@Composable
fun ExerciseAnimatedImage(
    startUrl: String?,
    endUrl: String?,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(12.dp)
    val box = @Composable { content: @Composable () -> Unit ->
        Box(
            modifier = modifier
                .aspectRatio(1f)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f))
        ) { content() }
    }

    when (animatedImageMode(startUrl, endUrl)) {
        AnimatedImageMode.NONE -> Unit

        AnimatedImageMode.STATIC -> box {
            AsyncImage(
                model = startUrl ?: endUrl,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }

        AnimatedImageMode.ANIMATED -> {
            val transition = rememberInfiniteTransition(label = "rep")
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 0f,
                animationSpec = infiniteRepeatable(
                    animation = keyframes {
                        durationMillis = 3600
                        0f at 0
                        0f at 600
                        1f at 1800 using FastOutSlowInEasing
                        1f at 2400
                        0f at 3600 using FastOutSlowInEasing
                    },
                    repeatMode = RepeatMode.Restart
                ),
                label = "progress"
            )
            box {
                AsyncImage(
                    model = startUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
                AsyncImage(
                    model = endUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer { alpha = progress }
                )
            }
        }
    }
}
```

Note the missing import: add `import androidx.compose.animation.core.animateFloat` and `import androidx.compose.ui.unit.dp` — both are required. The complete import list must include all symbols used: `animateFloat`, `dp`, plus those already listed above. If the build reports an unresolved reference, add the matching import.

- [ ] **Step 2: Verify it compiles**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL. If unresolved-reference errors appear, add the corresponding import (`androidx.compose.animation.core.animateFloat`, `androidx.compose.ui.unit.dp`) and re-run.

- [ ] **Step 3: Run the existing unit tests to confirm no regression**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.ui.workout.ExerciseAnimatedImageTest"`
Expected: PASS — 4 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseAnimatedImage.kt
git commit -m "feat(ui): add ExerciseAnimatedImage crossfade rep loop"
```

---

### Task 3: Wire `ExerciseAnimatedImage` into the detail screen

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt:76-94`

- [ ] **Step 1: Replace the static photo block**

In `ExerciseDetailScreen.kt`, find this block (currently lines 76–94):

```kotlin
                    if (exercise.imageUrl != null || exercise.imageUrl2 != null) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOfNotNull(exercise.imageUrl, exercise.imageUrl2).forEach { url ->
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
                            }
                        }
                    }
```

Replace it with:

```kotlin
                    ExerciseAnimatedImage(
                        startUrl = exercise.imageUrl,
                        endUrl = exercise.imageUrl2,
                        modifier = Modifier.fillMaxWidth()
                    )
```

`ExerciseAnimatedImage` lives in the same package (`com.coachfoska.app.ui.workout`), so no import is needed.

- [ ] **Step 2: Remove now-unused imports**

The old block was the only user of `AsyncImage` and `ContentScale` in this file. Check whether any other code in `ExerciseDetailScreen.kt` still references them. If not, remove these two imports:

```kotlin
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
```

Leave `clip`, `background`, `RoundedCornerShape` imports if they are still used elsewhere in the file (the `InfoSection` composable uses `RoundedCornerShape`; `clip`/`background` may now be unused — remove only the genuinely unused ones). When in doubt, run the compile step below; the Kotlin compiler warns on unused imports.

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew :composeApp:compileDebugKotlinAndroid`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Run the exercise unit tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.ui.workout.*" --tests "com.coachfoska.app.presentation.exercise.*"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ExerciseDetailScreen.kt
git commit -m "feat(ui): use ExerciseAnimatedImage on exercise detail screen"
```

---

### Task 4: Visual verification on device/emulator

**Files:** none (manual verification)

- [ ] **Step 1: Build and install the debug app**

Run: `./gradlew :composeApp:installDebug`
Expected: BUILD SUCCESSFUL, app installed on the running emulator/device.

- [ ] **Step 2: Manually verify the animation**

Open the app → Workouts → a category → tap an exercise with two photos. Confirm:
- The hero image loops: holds on the start pose, smoothly crossfades to the end pose, holds, fades back. Cycle ~3.6s.
- The whole body is visible (Fit, not cropped) with a subtle rounded background behind any letterbox.
- Open an exercise with only one photo (if any exist) → static image, no flicker.
- The animation is smooth (no janky frame on the first loop after images finish loading).

- [ ] **Step 3: Note the result**

If the first loop flashes a placeholder before the end frame loads, that is the known/accepted MVP behavior (Coil caches after the first cycle). No fix required. If anything else is wrong (e.g. animation not running, images cropped), stop and revisit Task 2.

---

## Notes for the implementer

- All `./gradlew` commands are pre-approved in this project.
- Coil's `AsyncImage` is already used elsewhere in the app (`ExerciseDetailScreen`, exercise list) — the dependency and any required setup are in place.
- The `keyframes` infix syntax (`value at timeMs using easing`) is from `androidx.compose.animation.core.KeyframesSpec`. `using` is the correct infix for per-segment easing.
