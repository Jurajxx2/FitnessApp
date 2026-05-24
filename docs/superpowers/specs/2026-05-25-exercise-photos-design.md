# Exercise Photos — Design Spec

**Date:** 2026-05-25
**Scope:** Fix exercise detail photo rendering + add list thumbnails

---

## Problem

- `ExerciseDetailScreen` has `AsyncImage` code for both photos but images are not visible in the app.
- `ExerciseByCategoryScreen` list rows are text-only — no thumbnail.

Both `image_url` and `image_url_2` are populated in the DB and fetched via `SELECT *` in the data source. Root cause of detail screen failure is likely a missing `clip` modifier (the existing `background(color, shape)` draws behind the image but does not clip it) combined with silent Coil failures (no error/loading states).

---

## Decisions

| Topic | Decision |
|---|---|
| Detail layout | Side-by-side equal squares (Option A) |
| List thumbnail style | Full-height strip flush left (Option B) |
| Performance | Same `image_url` in both places; rely on Coil disk cache (MVP) |
| Supabase image transforms | Not used — free plan |

---

## 1. Fix ExerciseDetailScreen

### What changes

In `ExerciseDetailScreen.kt`, the `AsyncImage` modifier is missing `clip`:

```kotlin
// Current (broken — no clip, image overflows rounded corner background)
modifier = Modifier
    .weight(1f)
    .aspectRatio(1f)
    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f), RoundedCornerShape(12.dp))

// Fixed
modifier = Modifier
    .weight(1f)
    .aspectRatio(1f)
    .clip(RoundedCornerShape(12.dp))
    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f))
```

The `clip` modifier must come before `background` so the shape clips both the drawn background and the image content.

### Debug logging

During implementation, log `exercise.imageUrl` from the ViewModel's `SelectExercise` handler to confirm URLs are non-null. If null, the issue is upstream (DB data or DTO mapping), not Coil.

### No placeholder/error state

Keep it simple for MVP — the `surfaceVariant` background is sufficient as an implicit placeholder. No spinner or broken-image icon needed now.

---

## 2. Add list thumbnail to ExerciseByCategoryScreen

### Behaviour

- When `exercise.imageUrl != null`: show the full-height strip on the left edge of the row
- When `exercise.imageUrl == null`: row is text-only, no empty column reserved

### Layout spec

`ExerciseListItem` becomes a `Row` where the image strip is drawn outside the content padding:

```
┌─────────────────────────────────────────┐
│ [img strip 64dp] │ Name          ›      │
│                  │ Muscles              │
└─────────────────────────────────────────┘

without image:
┌─────────────────────────────────────────┐
│  Name                          ›        │
│  Muscles                                │
└─────────────────────────────────────────┘
```

- Image strip width: `72.dp`, full row height via `fillMaxHeight()`
- `ContentScale.Crop`
- No rounded corners on the strip (flush left edge of the card)
- Card background `RoundedCornerShape(10.dp)` with `clip` so the strip is clipped to the card corners on the left side
- Same `image_url` used here as in the detail screen — Coil caches by URL, so detail screen gets it from disk cache if the list was already scrolled

### Performance

`LazyColumn` only loads visible rows (~5–8 at a time). Full image downloads on first scroll (~80–250 KB each). Coil's disk cache persists across sessions. Acceptable for MVP — revisit with Supabase image transforms when upgrading to Pro.

---

## 3. No schema or data layer changes

- No new DB columns
- No changes to `ExerciseSupabaseDataSource` (already fetches `*`)
- No changes to `ExerciseDto` or `Exercise` domain model
- No ViewModel changes

---

## Files touched

| File | Change |
|---|---|
| `ui/workout/ExerciseDetailScreen.kt` | Add `clip`, fix modifier order |
| `ui/workout/ExerciseByCategoryScreen.kt` | Add thumbnail strip to `ExerciseListItem` |

---

## Out of scope

- `ExerciseLibraryScreen` (category grid) — no images for categories
- Video playback (`videoUrl` field) — future feature
- Supabase image transforms — revisit on Pro plan
- Separate thumbnail URLs — revisit if performance is a problem post-MVP
