# Active Session Screen — Paged Exercise Design

**Date:** 2026-05-27  
**Status:** Approved  

## Overview

Replace the current scrollable list of all exercises in `ActiveSessionScreen` with a paged, one-exercise-at-a-time view. The user sees only the current exercise, navigates via swipe or buttons, tracks progress via a dot indicator, and can access overflow actions via a top-bar menu.

## 1. Data Model Changes

### `ExerciseDraft` — add two nullable fields

```kotlin
data class ExerciseDraft(
    val exerciseName: String,
    val sets: List<SetDraft>,
    val videoUrl: String? = null,
    val muscleGroup: String? = null,   // NEW
    val tips: String? = null,           // NEW
    val initialSetsGoal: Int = 3,
    val initialRepsGoal: String = "10"
)
```

### `WorkoutExercise.toDraft()` — copy new fields

```kotlin
fun WorkoutExercise.toDraft(): ExerciseDraft {
    val repsGoal = reps.substringBefore('-').filter { it.isDigit() }.toIntOrNull()
    return ExerciseDraft(
        exerciseName = name,
        initialSetsGoal = sets,
        initialRepsGoal = reps,
        muscleGroup = muscleGroup,   // NEW
        tips = tips,                  // NEW
        sets = (1..sets).map { order ->
            SetDraft(
                sortOrder = order,
                targetReps = repsGoal,
                actualReps = null,
                targetWeightKg = null,
                actualWeightKg = null,
                rpe = null,
                targetRestSeconds = restSeconds,
                actualRestSeconds = null
            )
        }
    )
}
```

No changes to `WorkoutState`, `WorkoutViewModel`, or `WorkoutIntent`.

## 2. Screen Structure

`ActiveSessionScreen` layout (top to bottom):

```
CoachTopBar(title = workoutName)       [⋮ DropdownMenu]
  DropdownMenu items:
    • "Skip exercise"  — advances pager to next page (hidden on last exercise)
    • "Finish workout" — triggers submit flow immediately

HorizontalPager(pageCount = exercises.size)   [weight(1f)]
  └─ ExercisePage (one per exercise)

ExerciseDotIndicator
  • One dot per exercise
  • Completed exercise → accent/green (MaterialTheme.colorScheme.primary)
  • Current exercise   → larger filled accent
  • Upcoming exercise  → muted (onSurface.copy(alpha = 0.3f))

Navigation row (padding 16dp horizontal, 8dp vertical):
  [< PREV]  (disabled / hidden on first page)
  [NEXT >]  (hidden on last page)
  [FINISH WORKOUT]  (CoachButton, only on last page)
```

The notes `CoachTextField` appears at the bottom of the last exercise page's scrollable content (inside `ExercisePage` when `isLastExercise = true`).

Notes state stays in `ActiveSessionRoute` as `var notes by remember { mutableStateOf("") }`, passed into the last page.

## 3. ExercisePage Layout

A `Column` with `Modifier.verticalScroll(rememberScrollState())` — avoids nested scroll conflicts with `HorizontalPager`.

```
ExerciseAnimatedImage(videoUrl)        height = 220.dp, fillMaxWidth
  └─ placeholder Box if videoUrl == null

[muscleGroup chip]                     SuggestionChip, shown only if muscleGroup != null

exerciseName (uppercase)               titleLarge
"initialSetsGoal × initialRepsGoal"    bodyMedium, onSurfaceVariant

tips text                              bodySmall, onSurfaceVariant
  └─ shown only if tips != null

── Sets ──
SetInputRow × N   (unchanged composable)
TextButton "+ ADD SET"

── Notes (last exercise only) ──
CoachTextField(label = "Notes (optional)", singleLine = false, minHeight = 96.dp)
```

## 4. ExerciseDotIndicator

New private composable in `ActiveSessionScreen.kt`:

```
Row(horizontalArrangement = spacedBy(6.dp), contentPadding = 16.dp vertical)
  for each exercise:
    Box(
      size = if (isCurrent) 10.dp else 8.dp,
      shape = CircleShape,
      color = when {
          isCompleted → MaterialTheme.colorScheme.primary
          isCurrent   → MaterialTheme.colorScheme.primary (larger)
          else        → onSurface.copy(alpha = 0.3f)
      }
    )
```

An exercise is considered **completed** when all its sets have `completed = true`.

## 5. Navigation

- `pagerState = rememberPagerState(pageCount = { exercises.size })`
- PREV button: `scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) }`
- NEXT button: `scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }`
- Skip (menu): same as NEXT
- Swipe: handled natively by `HorizontalPager`

## 6. Overflow Menu State

```kotlin
var menuExpanded by remember { mutableStateOf(false) }
```

Local UI state only. `CoachTopBar`'s `actions` slot hosts an `IconButton(Icons.Default.MoreVert)` that toggles `menuExpanded`, with a `DropdownMenu` anchored to it.

## 7. Files Changed

| File | Change |
|------|--------|
| `presentation/workout/SessionDraft.kt` | Add `muscleGroup`, `tips` to `ExerciseDraft`; update `toDraft()` |
| `ui/workout/ActiveSessionScreen.kt` | Full redesign: HorizontalPager, ExercisePage, dot indicator, nav row, overflow menu |

## 8. Out of Scope

- Rest timer between sets
- Exercise reordering
- Per-exercise completion state in the ViewModel (dots derive from `SetDraft.completed` in the UI layer only)
