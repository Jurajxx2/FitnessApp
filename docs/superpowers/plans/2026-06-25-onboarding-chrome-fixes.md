# Onboarding Chrome & Navigation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix onboarding navigation/chrome defects by moving the progress bar + back button into a single parent toolbar, replacing the swipe-disabled pager with `AnimatedContent`, rate-limiting step advances, hardening name-field focus, and making the number pickers snap to a centered selection.

**Architecture:** `OnboardingRoute` becomes the owner of chrome: a `Column` renders a persistent `OnboardingTopBar` (progress bar + optional back) above an `AnimatedContent` that shows only the current step. The ViewModel gains an in-memory nav-lock so a stray second tap during a transition cannot advance twice. Back at step 0 calls a new `onExit` callback that pops the nav back stack (returns to Settings when launched from there).

**Tech Stack:** Kotlin Multiplatform, Compose Multiplatform 1.10.2, Jetpack Navigation (typesafe), Koin, kotlinx-coroutines-test + MockK for unit tests.

---

## Environment Note (read first)

- Work in the worktree: `/Users/juraj/StudioProjects/coach-foska/.claude/worktrees/onboarding-chrome-fixes` (branch `worktree-onboarding-chrome-fixes`). Run all commands from there.
- `local.properties` (with `sdk.dir`) has already been copied into the worktree; Gradle works. If a future fresh checkout is missing it, copy it from `/Users/juraj/StudioProjects/coach-foska/local.properties`.
- All `./gradlew` commands are pre-approved.
- Baseline is green: `./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"` → BUILD SUCCESSFUL.
- When committing, stage **explicit paths only** (never `git add -A`/`.`).

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `presentation/onboarding/OnboardingViewModel.kt` | Step state + nav-lock guarding `advanceStep`/`goBack` | 1 |
| `androidUnitTest/.../OnboardingViewModelTest.kt` | Updated + new nav-lock/showBack tests | 1, 2 |
| `presentation/onboarding/OnboardingStep.kt` | `showBack` property (replaces `showChrome`) | 2, 4 |
| `ui/onboarding/components/OnboardingTopBar.kt` | **New** — persistent progress bar + optional back button | 3 |
| `ui/onboarding/OnboardingFlow.kt` | Parent `Column` + `OnboardingTopBar` + `AnimatedContent`; `onExit`; centralized back | 4 |
| `ui/onboarding/components/OnboardingScaffold.kt` | **Deleted** — replaced by `OnboardingTopBar` + parent | 4 |
| `App.kt` | Settings launch keeps Settings on stack; pass `onExit` to `OnboardingRoute` | 4 |
| `ui/onboarding/screens/NameStep.kt` | `runCatching` around focus request | 5 |
| `ui/onboarding/components/ScrollWheelPicker.kt` | Snap-to-center wheel with fixed-height rows + center band | 6 |

Package root for paths below: `composeApp/src/commonMain/kotlin/com/coachfoska/app` (tests under `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app`).

---

## Task 1: ViewModel nav-lock (defeat double-tap skip)

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModel.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt`

Two existing tests fire rapid synchronous `NextStep`/`PreviousStep` and assume each one advances. After the nav-lock, advances within ~350ms of each other are ignored, so those tests must advance virtual time between steps. We also add a new test that proves the lock blocks a double-tap then releases.

- [ ] **Step 1: Update the two existing rapid-advance tests to be time-aware (they will otherwise fail)**

In `OnboardingViewModelTest.kt`, replace the existing `back navigation decrements and clamps at zero` test (currently lines ~76–86) with:

```kotlin
    @Test
    fun `back navigation decrements and clamps at zero`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.NextStep); advanceTimeBy(400)
        vm.onIntent(OnboardingIntent.NextStep); advanceTimeBy(400)
        assertEquals(2, vm.state.value.currentStep)
        vm.onIntent(OnboardingIntent.PreviousStep); advanceTimeBy(400)
        assertEquals(1, vm.state.value.currentStep)
        vm.onIntent(OnboardingIntent.PreviousStep); advanceTimeBy(400)
        vm.onIntent(OnboardingIntent.PreviousStep); advanceTimeBy(400)
        assertEquals(0, vm.state.value.currentStep)
    }
```

And replace the existing `advance clamps at the last step` test (currently lines ~88–93) with:

```kotlin
    @Test
    fun `advance clamps at the last step`() = runTest {
        val vm = viewModel()
        repeat(OnboardingStep.entries.size + 3) {
            vm.onIntent(OnboardingIntent.NextStep)
            advanceTimeBy(400)
        }
        assertEquals(OnboardingStep.entries.size - 1, vm.state.value.currentStep)
    }
```

(`runTest`, `advanceTimeBy`, `assertEquals` are already imported in this file.)

- [ ] **Step 2: Add the new nav-lock test**

Add this test method to the same class:

```kotlin
    @Test
    fun `rapid double NextStep advances only one step then lock releases`() = runTest {
        val vm = viewModel()
        vm.onIntent(OnboardingIntent.NextStep)   // 0 -> 1, lock engaged
        vm.onIntent(OnboardingIntent.NextStep)   // ignored while locked
        assertEquals(1, vm.state.value.currentStep)
        advanceTimeBy(400)                        // lock releases
        vm.onIntent(OnboardingIntent.NextStep)   // 1 -> 2
        assertEquals(2, vm.state.value.currentStep)
    }
```

- [ ] **Step 3: Run the tests to verify the two updated ones still pass and the new one FAILS**

Run:
```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"
```
Expected: FAIL. `rapid double NextStep…` fails (asserts step 1 but gets 2, because no lock exists yet). The two updated tests pass (extra `advanceTimeBy` is harmless with current code).

- [ ] **Step 4: Implement the nav-lock in the ViewModel**

In `OnboardingViewModel.kt`, add the constant next to the existing one near the top of the file:

```kotlin
private const val AUTO_ADVANCE_DELAY_MS = 300L
private const val NAV_LOCK_MS = 350L
```

Add a backing field inside the class, directly below the `_state`/`state` declarations:

```kotlin
    /** Blocks a second advance/back while a transition is in flight (defeats double-tap skip). */
    private var navLocked = false
```

Replace the existing `advanceStep()` and `goBack()` functions with:

```kotlin
    private fun advanceStep() {
        if (navLocked) return
        navLocked = true
        _state.update {
            it.copy(currentStep = (it.currentStep + 1).coerceAtMost(OnboardingStep.entries.size - 1))
        }
        viewModelScope.launch {
            delay(NAV_LOCK_MS)
            navLocked = false
        }
    }

    private fun goBack() {
        if (navLocked) return
        navLocked = true
        _state.update { it.copy(currentStep = (it.currentStep - 1).coerceAtLeast(0)) }
        viewModelScope.launch {
            delay(NAV_LOCK_MS)
            navLocked = false
        }
    }
```

(`viewModelScope`, `launch`, `delay`, `update` are already imported.)

- [ ] **Step 5: Run the tests to verify all pass**

Run:
```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"
```
Expected: PASS (BUILD SUCCESSFUL).

- [ ] **Step 6: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModel.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt
git commit -m "fix(onboarding): nav-lock advanceStep/goBack to stop double-tap skip"
```

---

## Task 2: `OnboardingStep.showBack` property

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingStep.kt`
- Test: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt`

Add `showBack` **alongside** the existing `showChrome` (still used by `OnboardingFlow` until Task 4), so the build stays green.

- [ ] **Step 1: Write the failing test**

Add to `OnboardingViewModelTest.kt`:

```kotlin
    @Test
    fun `showBack is true for every step except plan loading`() {
        OnboardingStep.entries.forEach { step ->
            val expected = step != OnboardingStep.PLAN_LOADING
            assertEquals(expected, step.showBack, "showBack for $step")
        }
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"
```
Expected: FAIL to compile — `showBack` is unresolved.

- [ ] **Step 3: Add the property**

In `OnboardingStep.kt`, add the property below the existing `showChrome` (keep `showChrome` for now):

```kotlin
    /** Chrome (progress bar + back arrow) is hidden on hero/value-prop/loading screens. */
    val showChrome: Boolean
        get() = this !in setOf(VALUE_PROP_1, VALUE_PROP_2, PLAN_LOADING)

    /** Back arrow shows on every step except the terminal plan-loading screen. */
    val showBack: Boolean
        get() = this != PLAN_LOADING
```

- [ ] **Step 4: Run it to verify it passes**

Run:
```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingStep.kt \
        composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt
git commit -m "feat(onboarding): add OnboardingStep.showBack"
```

---

## Task 3: `OnboardingTopBar` component

**Files:**
- Create: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingTopBar.kt`

This is a pure addition (not yet wired in), so it just needs to compile. It reuses the existing `OnboardingProgressBar` and the same back icon + content description that `OnboardingScaffold` uses today.

- [ ] **Step 1: Create the component**

Create `OnboardingTopBar.kt` with exactly:

```kotlin
package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.ob_back_cd

/**
 * Persistent onboarding chrome, rendered once by [OnboardingRoute] above the step content.
 * The progress bar always shows; the back button shows only when [showBack] is true.
 */
@Composable
fun OnboardingTopBar(
    progress: Float,
    showBack: Boolean,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxWidth()) {
        OnboardingProgressBar(progress)
        if (showBack) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(Res.string.ob_back_cd),
                    tint = MaterialTheme.colorScheme.onBackground
                )
            }
        }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingTopBar.kt
git commit -m "feat(onboarding): add OnboardingTopBar (shared chrome)"
```

---

## Task 4: Parent toolbar + AnimatedContent + back-to-Settings

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/OnboardingFlow.kt`
- Delete: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingScaffold.kt`
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingStep.kt` (remove now-unused `showChrome`)
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt`

This is the structural swap. It must land as one compilable unit.

- [ ] **Step 1: Confirm `OnboardingScaffold` has no other usages**

Run:
```bash
grep -rn "OnboardingScaffold" composeApp/src --include=*.kt | grep -v "/build/"
```
Expected: only `OnboardingFlow.kt` (and the file itself). If anything else appears, stop and report.

- [ ] **Step 2: Rewrite `OnboardingFlow.kt`**

Replace the entire contents of `OnboardingFlow.kt` with:

```kotlin
package com.coachfoska.app.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingStep
import com.coachfoska.app.presentation.onboarding.OnboardingViewModel
import com.coachfoska.app.ui.onboarding.components.OnboardingTopBar
import com.coachfoska.app.ui.onboarding.screens.*
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun OnboardingRoute(
    userId: String,
    onComplete: () -> Unit,
    onExit: () -> Unit,
    viewModel: OnboardingViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val step = state.currentStepEnum

    fun handleBack() {
        when {
            step == OnboardingStep.PLAN_LOADING -> Unit              // block back while saving
            state.currentStep > 0 -> viewModel.onIntent(OnboardingIntent.PreviousStep)
            else -> onExit()
        }
    }

    OnboardingBackHandler(enabled = true) { handleBack() }

    Column(Modifier.fillMaxSize()) {
        OnboardingTopBar(
            progress = state.progress,
            showBack = step.showBack,
            onBack = { handleBack() }
        )
        AnimatedContent(
            targetState = step,
            transitionSpec = {
                val forward = targetState.ordinal > initialState.ordinal
                if (forward) {
                    (slideInHorizontally(tween(300)) { it } + fadeIn(tween(300))) togetherWith
                        (slideOutHorizontally(tween(300)) { -it } + fadeOut(tween(300)))
                } else {
                    (slideInHorizontally(tween(300)) { -it } + fadeIn(tween(300))) togetherWith
                        (slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)))
                }
            },
            modifier = Modifier.fillMaxSize(),
            label = "ob-step"
        ) { current ->
            Box(Modifier.fillMaxSize()) {
                val bodyModifier = Modifier.padding(horizontal = 24.dp)
                when (current) {
                    OnboardingStep.GENDER -> GenderStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                    OnboardingStep.GOAL -> GoalStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                    OnboardingStep.EXPERIENCE -> ExperienceStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                    OnboardingStep.FOCUS_AREAS -> FocusAreasStep(state, viewModel::onIntent, bodyModifier)
                    OnboardingStep.VALUE_PROP_1 -> ValueProp1Step(onContinue = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                    OnboardingStep.FREQUENCY -> FrequencyStep(state, viewModel::onIntent, bodyModifier)
                    OnboardingStep.EQUIPMENT -> EquipmentStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                    OnboardingStep.BODY_STATS -> BodyStatsStep(state, viewModel::onIntent, bodyModifier)
                    OnboardingStep.VALUE_PROP_2 -> ValueProp2Step(onContinue = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                    OnboardingStep.TRAINING_PREFERENCE -> TrainingPreferenceStep(state, viewModel::onSingleSelectAndAdvance, bodyModifier)
                    OnboardingStep.NAME -> NameStep(state, viewModel::onIntent, onDone = { viewModel.onIntent(OnboardingIntent.NextStep) }, modifier = bodyModifier)
                    OnboardingStep.PLAN_LOADING -> PlanLoadingStep(state, viewModel::onIntent, onDone = onComplete, modifier = bodyModifier)
                }
            }
        }
    }
}
```

- [ ] **Step 3: Delete `OnboardingScaffold.kt`**

Run:
```bash
git rm composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingScaffold.kt
```

- [ ] **Step 4: Remove the now-unused `showChrome` from `OnboardingStep.kt`**

Edit `OnboardingStep.kt` so only `showBack` remains (delete the `showChrome` property and its doc comment):

```kotlin
package com.coachfoska.app.presentation.onboarding

enum class OnboardingStep {
    GENDER,
    GOAL,
    EXPERIENCE,
    FOCUS_AREAS,
    VALUE_PROP_1,
    FREQUENCY,
    EQUIPMENT,
    BODY_STATS,
    VALUE_PROP_2,
    TRAINING_PREFERENCE,
    NAME,
    PLAN_LOADING;

    /** Back arrow shows on every step except the terminal plan-loading screen. */
    val showBack: Boolean
        get() = this != PLAN_LOADING
}
```

- [ ] **Step 5: Wire `onExit` + keep Settings on the back stack in `App.kt`**

In `App.kt`, the `composable<Onboarding>` block currently (around lines 222–232) is:

```kotlin
                composable<Onboarding> { backStackEntry ->
                    val route = backStackEntry.toRoute<Onboarding>()
                    OnboardingRoute(
                        userId = route.userId,
                        onComplete = {
                            navController.navigate(Home) {
                                popUpTo(Onboarding(route.userId)) { inclusive = true }
                            }
                        }
                    )
                }
```

Replace it with (adds `onExit`):

```kotlin
                composable<Onboarding> { backStackEntry ->
                    val route = backStackEntry.toRoute<Onboarding>()
                    OnboardingRoute(
                        userId = route.userId,
                        onComplete = {
                            navController.navigate(Home) {
                                popUpTo(Onboarding(route.userId)) { inclusive = true }
                            }
                        },
                        onExit = { navController.popBackStack() }
                    )
                }
```

And the Settings launch (around lines 535–539) currently is:

```kotlin
                        onLaunchOnboarding = {
                            navController.navigate(Onboarding(currentUserId)) {
                                popUpTo<Settings> { inclusive = true }
                            }
                        }
```

Replace it with (keep Settings on the back stack so step-0 back returns to it):

```kotlin
                        onLaunchOnboarding = {
                            navController.navigate(Onboarding(currentUserId))
                        }
```

- [ ] **Step 6: Verify it compiles**

Run:
```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```
Expected: BUILD SUCCESSFUL. If `showChrome` is reported unresolved anywhere, grep for stragglers: `grep -rn "showChrome" composeApp/src --include=*.kt | grep -v /build/` and remove them.

- [ ] **Step 7: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/OnboardingFlow.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingStep.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/App.kt \
        composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/OnboardingScaffold.kt
git commit -m "refactor(onboarding): shared top bar + AnimatedContent + back-to-settings"
```

---

## Task 5: Harden `NameStep` focus request

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/screens/NameStep.kt`

- [ ] **Step 1: Wrap the focus request**

In `NameStep.kt`, change the line:

```kotlin
    LaunchedEffect(Unit) { focus.requestFocus() }
```

to:

```kotlin
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/screens/NameStep.kt
git commit -m "fix(onboarding): guard NameStep focus request against crash"
```

---

## Task 6: Snap-to-center wheel picker

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/ScrollWheelPicker.kt`

This is Compose UI (no unit test). It must compile and be verified visually in Task 7. Key changes: snap fling, centered index computed from layout info (not `firstVisibleItemIndex`), fixed-height rows so the selection never changes row height, two blank spacer rows top and bottom so the selected value sits dead-center with neighbours above/below, and a fixed center band.

- [ ] **Step 1: Replace the entire contents of `ScrollWheelPicker.kt`**

```kotlin
package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlin.math.abs

/**
 * Vertical wheel picker. Shows [values], snaps the centered item to a fixed centre band, and
 * reports it via [onSelected]. The centred (selected) value is rendered brighter/bolder than its
 * neighbours; every row has the same height so the selection never shifts the layout.
 */
@Composable
fun <T> ScrollWheelPicker(
    values: List<T>,
    selected: T,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    label: (T) -> String = { it.toString() }
) {
    val itemHeight = 44.dp
    val visibleCount = 5
    val edgeSpacers = visibleCount / 2          // 2 blank rows top & bottom so item centres
    val initialIndex = values.indexOf(selected).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val snapBehavior = rememberSnapFlingBehavior(listState)

    // Data index whose row centre is nearest the viewport centre. Global list indices are offset
    // by [edgeSpacers] because of the leading blank rows, so subtract it.
    val centeredIndex by remember(values) {
        derivedStateOf {
            val info = listState.layoutInfo
            if (info.visibleItemsInfo.isEmpty()) return@derivedStateOf initialIndex
            val viewportCenter = (info.viewportStartOffset + info.viewportEndOffset) / 2
            val globalIndex = info.visibleItemsInfo
                .minByOrNull { abs((it.offset + it.size / 2) - viewportCenter) }!!.index
            (globalIndex - edgeSpacers).coerceIn(0, values.lastIndex)
        }
    }

    LaunchedEffect(listState, values) {
        snapshotFlow { centeredIndex }
            .distinctUntilChanged()
            .collect { idx -> values.getOrNull(idx)?.let(onSelected) }
    }

    Box(modifier.height(itemHeight * visibleCount), contentAlignment = Alignment.Center) {
        // Fixed centre selection band.
        Box(
            Modifier
                .fillMaxWidth()
                .height(itemHeight)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
        )
        LazyColumn(
            state = listState,
            flingBehavior = snapBehavior,
            modifier = Modifier.fillMaxWidth()
        ) {
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            itemsIndexed(values) { index, value ->
                val isCenter = index == centeredIndex
                Box(
                    Modifier.fillMaxWidth().height(itemHeight),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label(value),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = if (isCenter) FontWeight.Bold else FontWeight.Normal,
                        color = if (isCenter) MaterialTheme.colorScheme.onBackground
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.graphicsLayer {
                            val scale = if (isCenter) 1f else 0.82f
                            scaleX = scale
                            scaleY = scale
                        }
                    )
                }
            }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
            item { Spacer(Modifier.fillMaxWidth().height(itemHeight)) }
        }
    }
}
```

Note: `edgeSpacers` is `visibleCount / 2` = 2; the two leading `item { Spacer }` blocks match it. If `visibleCount` is ever changed, adjust the number of `Spacer` items to match `edgeSpacers`.

- [ ] **Step 2: Verify it compiles**

Run:
```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```
Expected: BUILD SUCCESSFUL. (`BodyStatsStep` call sites are unchanged — same `values`/`selected`/`onSelected`/`label` signature.)

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/onboarding/components/ScrollWheelPicker.kt
git commit -m "fix(onboarding): snap-to-center wheel picker with fixed-height rows"
```

---

## Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full onboarding unit test suite**

Run:
```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.onboarding.*"
```
Expected: BUILD SUCCESSFUL, all tests pass.

- [ ] **Step 2: Compile the whole Android variant**

Run:
```bash
./gradlew :composeApp:compileDebugKotlinAndroid
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Confirm no stragglers**

Run:
```bash
grep -rn "showChrome\|OnboardingScaffold" composeApp/src --include=*.kt | grep -v /build/
```
Expected: no output.

- [ ] **Step 4: Manual verification checklist (run the app on a device/emulator)**

Build and install: `./gradlew :composeApp:installDebug` (or run from Android Studio). Then verify:
  - Progress bar stays fixed at the top and does **not** slide/animate-jump when moving between steps; only its fill grows.
  - Every step including "Tvůj trenér. Tvůj plán." (VALUE_PROP_1) and "Osobní přístup, který funguje." (VALUE_PROP_2) shows a back button; `PLAN_LOADING` shows no back button.
  - Launch onboarding from Settings → debug "Launch onboarding"; on the first page (GENDER) the back button (and system back) returns to Settings.
  - On VALUE_PROP_2, tapping Continue once advances exactly one step to TRAINING_PREFERENCE — rapid double-taps do **not** skip it; no crash landing on NAME.
  - On the body-stats step, each of age / height / weight locks the selected number to the exact centre band; rows keep equal height; flinging snaps to a centered value.
  - Back navigation works across all steps; PLAN_LOADING ignores back.

- [ ] **Step 5: Final confirmation commit (if any verification fixups were needed)**

If steps 1–4 required no code changes, nothing to commit. Otherwise commit fixes with explicit paths and a `fix(onboarding): …` message.

---

## Self-Review Notes (author)

- **Spec coverage:** §1 shared toolbar → Tasks 3,4; §2 AnimatedContent → Task 4; §3 showBack → Tasks 2,4; §4 back-to-Settings → Task 4; §5 nav-lock → Task 1; §6 NameStep focus → Task 5; §7 snap picker → Task 6; testing → Tasks 1,2,7. All covered.
- **Type/name consistency:** `OnboardingRoute(userId, onComplete, onExit, viewModel)`; `OnboardingTopBar(progress, showBack, onBack, modifier)`; `OnboardingStep.showBack`; `ScrollWheelPicker(values, selected, onSelected, modifier, label)` — used consistently across tasks and unchanged at call sites.
- **No placeholders:** every code/edit step shows full code; every run step states the exact command and expected result.
