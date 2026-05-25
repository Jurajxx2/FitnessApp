# Exercise Rep Animation — Design Spec

**Date:** 2026-05-25
**Scope:** Animate the two exercise photos (start/end frames) on the detail screen into a looping rep animation.

---

## Problem

`ExerciseDetailScreen` currently shows the two exercise photos (`imageUrl` = start position, `imageUrl2` = end position) as **static side-by-side squares** (lines 76–94). Two static frames poorly convey the *motion* of an exercise — the whole point of exercise media is showing how the movement is performed.

We have exactly two frames per exercise (the free-exercise-db / wger format). Rather than license video or attempt AI video generation (rejected: form-accuracy/liability risk, non-deterministic QA cost), we animate the two frames we already own into a rep-like loop. Cost: $0, assets already in hand.

---

## Decisions

| Topic | Decision |
|---|---|
| Transition | Crossfade ping-pong (start→end→start, smooth dissolve) |
| Pacing | Hold at each end: 0.6s hold → 1.2s morph → 0.6s hold → 1.2s morph back |
| Playback control | Auto-loop, always on while detail screen visible. No controls. |
| Scope | Detail screen only. List thumbnails stay static. |
| Content fit | `ContentScale.Fit` — whole body always visible, letterboxed on subtle background. |
| Video | `videoUrl` field remains unused (out of scope) |

---

## Component: `ExerciseAnimatedImage`

New composable in its own file under `ui/workout/` (single responsibility, isolated from the detail screen).

### Signature

```kotlin
@Composable
fun ExerciseAnimatedImage(
    startUrl: String?,
    endUrl: String?,
    modifier: Modifier = Modifier
)
```

### Rendering

A `Box` with two stacked Coil `AsyncImage`s:

- **Bottom layer:** `startUrl`, always `alpha = 1f` (opaque — prevents background bleed-through during the dissolve).
- **Top layer:** `endUrl`, `alpha = progress` (applied via `graphicsLayer { alpha = progress }`).

Both images use `ContentScale.Fit`, `clip(RoundedCornerShape(12.dp))`, and the existing `surfaceVariant.copy(alpha = 0.2f)` background. The `Box` is `fillMaxWidth().aspectRatio(1f)`.

### Animation

`progress` is driven by a `rememberInfiniteTransition` + `animateFloat` with keyframes that bake in the end-holds:

```kotlin
val transition = rememberInfiniteTransition(label = "rep")
val progress by transition.animateFloat(
    initialValue = 0f,
    targetValue = 0f,
    animationSpec = infiniteRepeatable(
        animation = keyframes {
            durationMillis = 3600
            0f at 0
            0f at 600                              // hold start
            1f at 1800 using FastOutSlowInEasing   // morph to end
            1f at 2400                             // hold end
            0f at 3600 using FastOutSlowInEasing   // morph back to start
        },
        repeatMode = RepeatMode.Restart
    ),
    label = "progress"
)
```

`RepeatMode.Restart` (not `Reverse`) — the keyframes already encode the full back-and-forth cycle.

### Fallbacks

| Condition | Behavior |
|---|---|
| `startUrl != null && endUrl != null` | Animated crossfade loop (the main path) |
| `startUrl != null && endUrl == null` | Single static `AsyncImage` of `startUrl`, no animation, no infinite transition started |
| both `null` | Render nothing (Box not emitted) |

### Testable helper

Extract the alpha/fallback logic so it is unit-testable without the Compose runtime:

```kotlin
enum class AnimatedImageMode { ANIMATED, STATIC, NONE }

fun animatedImageMode(startUrl: String?, endUrl: String?): AnimatedImageMode =
    when {
        startUrl != null && endUrl != null -> AnimatedImageMode.ANIMATED
        startUrl != null -> AnimatedImageMode.STATIC
        else -> AnimatedImageMode.NONE
    }
```

`ExerciseAnimatedImage` branches on `animatedImageMode(...)`. The animation timing itself is verified visually, not unit-tested.

---

## Changes to `ExerciseDetailScreen.kt`

Replace the photo block (current lines 76–94):

```kotlin
if (exercise.imageUrl != null || exercise.imageUrl2 != null) {
    Row(...) {
        listOfNotNull(exercise.imageUrl, exercise.imageUrl2).forEach { url ->
            AsyncImage(...)
        }
    }
}
```

with:

```kotlin
ExerciseAnimatedImage(
    startUrl = exercise.imageUrl,
    endUrl = exercise.imageUrl2,
    modifier = Modifier.fillMaxWidth()
)
```

(`ExerciseAnimatedImage` emits nothing when both URLs are null, so no outer `if` guard is needed.)

No other changes to the screen.

---

## No data / schema / ViewModel changes

- No DB columns, no DTO changes, no domain model changes.
- `ExerciseSupabaseDataSource` already fetches both URLs.
- No ViewModel changes.

---

## Out of scope

- List thumbnails (`ExerciseByCategoryScreen`) — stay static.
- `videoUrl` playback.
- System reduce-motion / accessibility preference handling — revisit post-MVP.
- Preloading the end frame — Coil caches after the first cycle; a minor first-loop placeholder flash on the top layer is acceptable for MVP.
- Tap-to-pause / scrubbing controls.

---

## Files touched

| File | Change |
|---|---|
| `ui/workout/ExerciseAnimatedImage.kt` | **New** — animated crossfade component + `animatedImageMode` helper |
| `ui/workout/ExerciseDetailScreen.kt` | Replace static photo `Row` with `ExerciseAnimatedImage` |
| `androidUnitTest/.../ExerciseAnimatedImageTest.kt` (or existing exercise test file) | **New** — unit tests for `animatedImageMode` |
