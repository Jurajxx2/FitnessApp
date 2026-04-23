# Workout Exercise Picker — Design Spec

**Date:** 2026-04-23  
**Scope:** Admin workout plan editor (`admin/src/pages/admin/Workouts.tsx`)

---

## Problem

When creating or editing a workout plan, admins type exercise names and muscle groups as free text. The `exercises` table holds a database of hundreds of exercises with names, categories, images, and muscle data that is never surfaced during workout creation.

---

## Solution Overview

Two complementary interaction paths for picking exercises from the database:

1. **Inline autocomplete** — type in the exercise name field, a dropdown shows matching exercises, selecting one fills name + muscle group.
2. **Browse button → SlideOver** — a small "Browse" button next to the name field opens a full exercise browser panel for search + category filtering + multi-add.

---

## Components

### 1. `ExerciseCombobox`

A self-contained combobox that replaces the plain `Input` for exercise name in each `ExerciseDraft` card.

**Behaviour:**
- Renders a text input. Once the user types ≥ 2 characters, fires a debounced (200 ms) Supabase query: `ilike('name_en', '%term%')`, limited to 6 results ordered by `name_en`.
- Dropdown is rendered into a portal (`document.body`) and positioned via `getBoundingClientRect` so it escapes the modal's `overflow-y: auto` scroll container.
- Each dropdown row shows: thumbnail (`image_url`, 24×24, rounded), `name_en`, primary muscle (`primary_muscles[0]` or category name as fallback).
- Selecting a result:
  - Sets `name` ← `exercise.name_en`
  - Sets `muscle_group` ← `exercise.primary_muscles[0]` (empty string if none)
  - Does **not** touch `sets`, `reps`, `rest_seconds`, or `tips` — their current values are preserved regardless of whether they are defaults or user-entered.
- Clicking outside or pressing Escape closes the dropdown without selecting.
- The field still accepts free text — admins can ignore the dropdown and type any name.

**Props:**
```ts
interface ExerciseComboboxProps {
  value: string
  onChange: (name: string, muscleGroup: string) => void
  onBrowse: () => void
}
```

The `onBrowse` callback is wired to the Browse button rendered as a sibling, not inside the combobox itself (keeps concerns separate).

---

### 2. Browse Button

A small ghost button (`⊞ Browse`) rendered inline next to `ExerciseCombobox` using a flex row wrapper.

- Clicking it calls `onBrowse`, which opens the `ExerciseBrowserSlideOver`.
- The button passes no slot index to the SlideOver — the SlideOver always **appends** new exercises to the list (simpler mental model, avoids slot-targeting complexity).

---

### 3. `ExerciseBrowserSlideOver`

Reuses the existing `SlideOver` component. A dedicated panel for browsing and multi-adding exercises.

**Props:**
```ts
interface ExerciseBrowserSlideOverProps {
  open: boolean
  onClose: () => void
  addedNames: string[]           // names already in the workout list
  onAdd: (name: string, muscleGroup: string) => void
}
```

**Contents:**
- **Search input** — debounced text search (`ilike` on `name_en`), resets page to 0 on change.
- **Category chips** — loaded once from `exercise_categories`, toggling one filters the list. "All" chip deselects category filter.
- **Exercise list** — 25 per page. Each row:
  - Thumbnail (24×24), `name_en`, primary muscle / category name.
  - `+` button → calls `onAdd(name_en, primary_muscles[0])`, which appends a new `ExerciseDraft` with defaults (`sets: 3, reps: '10', rest_seconds: 60, tips: ''`).
  - If `name_en` is in `addedNames`, show a `✓ added` badge instead of `+`. The badge is informational only — clicking it does nothing.
- **Pagination** — prev/next buttons, "1–25 of N" label.
- **Done button** — closes the panel.

**Data fetching:** Uses a React Query key of `['exercises-browser', search, categoryId, page]`. This is a separate query from the Exercises admin page — no shared cache key, avoids interference.

---

## Data Flow

```
ExerciseDraft[] (local state in Workouts.tsx)
   ↓ passed as props
ExerciseCombobox  →  onSelect  →  updateExercise(i, 'name', …) + updateExercise(i, 'muscle_group', …)
Browse button     →  onBrowse  →  setSlideOverOpen(true)
ExerciseBrowserSlideOver  →  onAdd  →  setExercises(ex => [...ex, newDraft])
```

No new database writes are introduced. The `WorkoutExercise` table schema is unchanged — exercise picker only pre-fills the `name` and `muscle_group` fields before the workout is saved.

---

## File Changes

| File | Change |
|------|--------|
| `admin/src/pages/admin/Workouts.tsx` | Replace name `Input` with `ExerciseCombobox` + Browse button; add `ExerciseBrowserSlideOver` usage; wire `addedNames` and `onAdd` |
| `admin/src/components/ExerciseCombobox.tsx` | New component |
| `admin/src/components/ExerciseBrowserSlideOver.tsx` | New component |

---

## Edge Cases

- **Dropdown z-index:** Portal dropdown must have `z-index` above the modal (`z-50` → dropdown at `z-[200]`).
- **SlideOver z-index:** `ExerciseBrowserSlideOver` sits above the workout modal (`z-[60]`).
- **Empty image:** If `image_url` is null, show a grey placeholder box, not a broken image.
- **No results:** Show "No exercises found" inside the dropdown / SlideOver list.
- **Free-text name:** If the user types a name and never picks from the dropdown, `muscle_group` stays whatever it was — the admin can still fill it manually.
- **Duplicate via SlideOver:** The `✓ added` badge is a soft guard (name-based match). It does not prevent adding the same exercise twice if the admin ignores the badge.
