# Onboarding Chrome & Navigation Fixes — Design

**Date:** 2026-06-24
**Branch:** `worktree-onboarding-chrome-fixes`
**Status:** Approved (design), pending implementation plan

## Problem

The onboarding flow (`composeApp/.../ui/onboarding`) has several navigation and chrome
defects, all rooted in chrome being rendered *per page* inside a swipe-disabled
`HorizontalPager`:

1. **Cannot return to Settings from the first page.** Onboarding launched from Settings
   (`App.kt`) pops Settings off the back stack (`popUpTo<Settings>{inclusive=true}`), and
   the onboarding `BackHandler` is enabled but no-ops at step 0 — so back is swallowed and
   the user is stuck on the first page (GENDER).
2. **Progress bar animates/slides on every page switch.** `OnboardingProgressBar` lives
   inside each page (via `OnboardingScaffold`), so it physically slides with the pager and
   re-runs its fill tween on each transition.
3. **No back button on the value-prop screens** "Tvůj trenér. Tvůj plán." (`VALUE_PROP_1`)
   and "Osobní přístup, který funguje." (`VALUE_PROP_2`) — these have `showChrome = false`.
4. **Number pickers (age/height/weight) don't center the selection.** `ScrollWheelPicker`
   uses `firstVisibleItemIndex` as the selected index and has no snap fling, so the chosen
   number rests at arbitrary offsets; the enlarged centered text also shifts row heights.
5. **A step is skipped and the app crashes.** On `VALUE_PROP_2` → Continue, the still-visible
   button stays tappable during the ~300ms pager animation, so a double-tap advances twice and
   skips `TRAINING_PREFERENCE`; landing on `NAME`, `NameStep`'s `focus.requestFocus()` in
   `LaunchedEffect(Unit)` throws "FocusRequester is not initialized" (offscreen/transition
   composition).

## Approved Decisions

- **Number picker:** keep the wheel, but make it snap-to-center with a fixed center band.
- **Toolbar scope:** show the shared toolbar (progress bar + back) on **every** step,
  including the value-prop screens. Progress fills continuously.
- **Container:** replace the swipe-disabled `HorizontalPager` with `AnimatedContent`.

## Design

### 1. Shared toolbar owned by the parent (`OnboardingRoute`)

Restructure `OnboardingRoute` so chrome is rendered **once**, above the step content:

```
Column(Modifier.fillMaxSize()) {
    OnboardingTopBar(
        progress = state.progress,
        showBack = state.currentStepEnum.showBack,   // read from state, NOT the per-page `step`
        onBack   = ::handleBack,
    )                                   // mounted once — never slides, only its fill tweens
    AnimatedContent(
        targetState   = state.currentStepEnum,
        transitionSpec = { /* slide L/R by ordinal direction */ },
        modifier      = Modifier.fillMaxSize(),
    ) { step ->
        Box(Modifier.fillMaxSize()) {
            val bodyModifier = Modifier.padding(horizontal = 24.dp)
            when (step) { /* same screen call sites as today, passing bodyModifier */ }
        }
    }
}
```

- `OnboardingProgressBar` sits **outside** `AnimatedContent`, so it stays fixed at the top.
  Only its `animateFloatAsState` fill animates — it no longer slides or re-mounts.
- **New component `OnboardingTopBar`** (in `ui/onboarding/components/`): a `Column` of
  `OnboardingProgressBar(progress)` + a back `IconButton` (the same `ArrowBack` icon and
  `ob_back_cd` content description currently in `OnboardingScaffold`). The back button is
  rendered only when `showBack` is true; the progress bar always renders.
- **Delete `OnboardingScaffold`** — its responsibility moves to `OnboardingTopBar` + the
  parent `Column`. The per-screen body modifier (`padding(horizontal = 24.dp)`) is now
  produced inside the `AnimatedContent` content lambda, so individual screen call sites
  (`GenderStep(state, …, bodyModifier)` etc.) are unchanged.

### 2. Replace `HorizontalPager` with `AnimatedContent`

- Only the current step is composed → the offscreen `NameStep` `FocusRequester` crash can no
  longer occur from pre-composition.
- Remove `pagerState`, `rememberPagerState`, and the `LaunchedEffect(state.currentStep)` that
  drove `animateScrollToPage`.
- **Slide direction:** inside `transitionSpec`, forward when
  `targetState.ordinal > initialState.ordinal`:
  - forward: `slideInHorizontally { it } + fadeIn()` `togetherWith` `slideOutHorizontally { -it } + fadeOut()`
  - backward: `slideInHorizontally { -it } + fadeIn()` `togetherWith` `slideOutHorizontally { it } + fadeOut()`
  - Use `tween(300)` to match the previous feel. Wrap the result with `.using(SizeTransform(clip = false))` is not required; keep defaults.

### 3. `OnboardingStep.showChrome` → `showBack`

Replace the `showChrome` property:

```kotlin
/** Back arrow is shown on every step except the terminal plan-loading screen. */
val showBack: Boolean get() = this != PLAN_LOADING
```

The progress bar shows on all steps (rendered unconditionally by `OnboardingTopBar`), so the
value-prop screens now display both progress and a back button. `PLAN_LOADING` shows the
progress bar (at 100%) but no back button.

### 4. Back navigation: return to Settings from step 0

- **`App.kt` Settings launch:** remove `popUpTo<Settings>{inclusive=true}` so Settings stays
  on the back stack:
  ```kotlin
  onLaunchOnboarding = { navController.navigate(Onboarding(currentUserId)) }
  ```
- **`OnboardingRoute` gains `onExit: () -> Unit`.** Centralize back handling in one lambda
  used by both the toolbar button and the system `BackHandler`:
  ```kotlin
  fun handleBack() {
      when {
          state.currentStepEnum == OnboardingStep.PLAN_LOADING -> Unit   // block back while saving
          state.currentStep > 0 -> viewModel.onIntent(OnboardingIntent.PreviousStep)
          else -> onExit()
      }
  }
  ```
  - `OnboardingBackHandler(enabled = true) { handleBack() }`
  - `OnboardingTopBar(onBack = ::handleBack)`
- **`composable<Onboarding>` in `App.kt`** passes `onExit = { navController.popBackStack() }`.
  - Launched from Settings → Settings is on the stack → returns to Settings.
  - Launched from auth (Welcome/VerifyOtp pop their source inclusive) → onboarding is the
    only entry → `popBackStack()` is a harmless no-op (user stays on step 0). This is the
    desired behavior: don't drop a first-time user out of onboarding.

### 5. Double-tap skip guard (`OnboardingViewModel`)

Add a re-entrancy lock so a second tap on the still-visible outgoing screen during the
transition cannot advance twice:

```kotlin
private const val NAV_LOCK_MS = 350L   // slightly longer than the 300ms slide

private var navLocked = false

private fun advanceStep() {
    if (navLocked) return
    navLocked = true
    _state.update {
        it.copy(currentStep = (it.currentStep + 1).coerceAtMost(OnboardingStep.entries.size - 1))
    }
    viewModelScope.launch { delay(NAV_LOCK_MS); navLocked = false }
}

private fun goBack() {
    if (navLocked) return
    navLocked = true
    _state.update { it.copy(currentStep = (it.currentStep - 1).coerceAtLeast(0)) }
    viewModelScope.launch { delay(NAV_LOCK_MS); navLocked = false }
}
```

- `onSingleSelectAndAdvance` already inserts `AUTO_ADVANCE_DELAY_MS` (300ms) before calling
  `advanceStep`, so legitimate auto-advances are spaced and unaffected by the lock.
- The lock is in-memory transient state on the ViewModel (not part of `OnboardingState`), so
  it does not affect equality/recomposition.

### 6. `NameStep` focus hardening

Wrap the focus request so it can never crash even in an unexpected composition state:

```kotlin
LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
```

(With `AnimatedContent` the page is composed only when current, so this is belt-and-suspenders.)

### 7. Snap-to-center wheel picker (`ScrollWheelPicker`)

Rework so the selected value is always locked to the visual center:

- **Snap fling:** `flingBehavior = rememberSnapFlingBehavior(listState)` on the `LazyColumn`.
- **Correct centered index** from layout info (item whose center is nearest the viewport
  center), replacing the `firstVisibleItemIndex` heuristic:
  ```kotlin
  val centeredIndex by remember {
      derivedStateOf {
          val info = listState.layoutInfo
          if (info.visibleItemsInfo.isEmpty()) return@derivedStateOf initialIndex
          val viewportCenter = (info.viewportStartOffset + info.viewportEndOffset) / 2
          info.visibleItemsInfo.minByOrNull {
              kotlin.math.abs((it.offset + it.size / 2) - viewportCenter)
          }!!.index
      }
  }
  ```
- **Report selection** via `snapshotFlow { centeredIndex }.distinctUntilChanged()` →
  `values.getOrNull(idx)?.let(onSelected)` (unchanged contract for callers).
- **Fixed-height, vertically-centered rows.** Each row is a `Box(Modifier.height(itemHeight),
  contentAlignment = Center)` containing the `Text`. The centered row differs from neighbours
  only by **color, alpha, and font weight** (and, if desired, a `graphicsLayer` scale that does
  not affect layout) — never by font size or padding that changes row height. Remove the
  current `padding(top = 8.dp)` and the `headlineSmall` vs `bodyLarge` size swap that caused
  uneven row heights.
- **Fixed center band overlay:** a non-interactive `Box` of `height(itemHeight)`, full width,
  centered in the picker, drawn as a subtle indicator (e.g. top + bottom 1.dp dividers in
  `MaterialTheme.colorScheme.outline`, or a faint `surfaceVariant` rounded rect). It marks the
  selection slot so the locked number reads as centered. The overlay must not intercept
  scroll (no clickable/pointer modifiers).
- Keep `itemHeight = 44.dp`, `visibleCount = 5`, and `contentPadding = vertical = itemHeight * 2`
  so the centered slot is the middle of five rows. Keep `initialFirstVisibleItemIndex =
  values.indexOf(selected).coerceAtLeast(0)`.
- Caller call sites in `BodyStatsStep` are unchanged (`values`, `selected`, `onSelected`,
  `label` signature preserved).

## Components Touched

| File | Change |
|------|--------|
| `ui/onboarding/OnboardingFlow.kt` | Parent `Column` + `OnboardingTopBar` + `AnimatedContent`; remove pager; add `onExit`; centralized `handleBack`. |
| `ui/onboarding/components/OnboardingTopBar.kt` | **New** — progress bar + optional back button. |
| `ui/onboarding/components/OnboardingScaffold.kt` | **Deleted** — replaced by `OnboardingTopBar` + parent. |
| `ui/onboarding/components/OnboardingProgressBar.kt` | Unchanged (reused by `OnboardingTopBar`). |
| `ui/onboarding/components/ScrollWheelPicker.kt` | Snap fling + layout-info centered index + fixed-height rows + center band. |
| `presentation/onboarding/OnboardingStep.kt` | `showChrome` → `showBack` (`!= PLAN_LOADING`). |
| `presentation/onboarding/OnboardingViewModel.kt` | Nav-lock in `advanceStep`/`goBack`. |
| `ui/onboarding/screens/NameStep.kt` | `runCatching { focus.requestFocus() }`. |
| `App.kt` | Settings launch keeps Settings on stack; `composable<Onboarding>` passes `onExit = { navController.popBackStack() }`. |

## Testing

**Unit tests** (`OnboardingViewModelTest.kt`, androidUnitTest, JVM):
- Rapid double `advanceStep` (two `NextStep` intents back-to-back) advances exactly **one**
  step (nav-lock). Use the test dispatcher / advance virtual time to assert the lock then
  releases and a later advance works.
- `goBack` at step 0 stays at 0; `advanceStep` at last step stays at last.
- `OnboardingStep.showBack` is false only for `PLAN_LOADING`, true for all others.

**Manual / build verification** (picker visuals, toolbar, slide animation, back-to-Settings,
no crash on NAME) — Compose UI, not unit-testable here. Verify via `./gradlew` build + on-device.

**Build:** `./gradlew :composeApp:compileDebugKotlinAndroid` (or the project's standard
compile task) and the unit-test task must pass.

## Out of Scope

- No redesign of individual step content beyond the picker.
- No change to onboarding data model, persistence, or `SaveOnboardingUseCase`.
- No change to the auth-path launch behavior (Welcome/VerifyOtp) beyond inheriting `onExit`.
