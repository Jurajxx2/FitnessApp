# Activity Hub with Integrated Day Summary — Design

**Date:** 2026-06-23
**Status:** Approved design → implementation plan
**Source mock:** Stitch project `Coach foska` (3563414049263135061), screen `Activity Hub with Integrated Day Summary` (`cc98bc9edf3e4a239e4297b40c550d4e`). Local copy of the rendered HTML: `/tmp/activity_hub.html` (reference only; not committed).

## 1. Summary

Redesign the existing **Activity Hub** screen (the Activity tab) to match the Stitch mock — a brutalist monochrome layout — using **only data already present in `WorkoutState`**. No Supabase, DTO, repository, or use-case changes. No new network calls.

The Activity tab currently renders `ActivityHubScreen` (`composeApp/src/commonMain/kotlin/com/coachfoska/app/ui/workout/ActivityHubScreen.kt`) via `ActivityHubRoute`, wired in `App.kt` under `composable<WorkoutList>`. This task rewrites that screen's body and its supporting components.

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Visual scope | Full redesign, replacing the current layout |
| 2 | Data the mock shows but the model lacks (volume kg, category, intensity) | Derive what's cheap from existing data; drop the rest. **No DB/schema changes.** |
| 3 | Quick links | Four actions: Exercise Library, Workout History, Progress Analytics, Log Activity |
| 4 | Corner style | **Square corners + 1px `outlineVariant` borders**, scoped to this screen now. Intended as the first step of an app-wide brutalist shift. The **global `CoachFoskaShapes` flip is deferred to a separate follow-up task** (see §8). |
| 5 | Top-bar notifications bell + avatar | **Omitted.** No notifications feature/destination exists; shipping dead controls is worse than omitting. |
| 6 | Inline "Recent Sessions" list (present in current screen) | **Removed.** History remains reachable via the "Workout History" quick link. |
| 7 | Assigned-workout card tap target | Opens **workout detail** (`WorkoutDetail(workoutId)`). The top Start button starts the active session. |

## 3. Existing context (verified)

- `WorkoutViewModel` (`presentation/workout/WorkoutViewModel.kt`) loads `workouts` in `init` (`LoadWorkouts`) and `workoutHistory` via `LoadHistory` (called by `ActivityHubRoute`'s `LaunchedEffect`). Both lists are already in `WorkoutState`. **No ViewModel change required** for data.
- `WorkoutState` fields used: `workouts: List<Workout>`, `workoutHistory: List<WorkoutLog>`, `isLoading`, `error`.
- Domain models (`domain/model/Workout.kt`):
  - `Workout(id, name, dayOfWeek: DayOfWeek?, durationMinutes: Int, exercises: List<WorkoutExercise>, notes, isActive)`
  - `WorkoutExercise(... name, muscleGroup: String?, sets: Int, reps: String, ...)` — **no target weight, no category, no intensity.**
  - `WorkoutLog(id, userId, workoutId: String?, workoutName, durationMinutes, exerciseLogs, loggedAt: Instant)`
  - `ExerciseLog(... sets: List<SetLog>)`; `SetLog(... actualReps: Int?, actualWeightKg: Float?, completed: Boolean, ...)`
- `DayOfWeek` has an `index` property; `todayDate()` lives in `core/util` (used by the current screen).
- Palette already matches the mock: `primary = White`, `background = Black`, `onBackground = White`, `outlineVariant = Gray800`, `surface = Gray950`. Brand red is only `tertiary` and is **not** used here.
- **`WeeklyCalendarStrip` (`ui/workout/components/WeeklyCalendarStrip.kt`) is shared:** consumed by **both** `ActivityHubScreen` (line 133) **and** `ProgressDashboardScreen` (line 64). It must **NOT** be deleted or modified — the Activity Hub gets a brand-new grid component instead.
- **`CompletionStatus` (`domain/model/DayCompletion.kt`) is shared:** `GetProgressDashboardUseCase` produces `UPCOMING`, and `WeeklyCalendarStrip` has exhaustive `when (status)` blocks over its 4 values. It must **NOT** be renamed or extended — doing so would break the Progress Dashboard. The Activity Hub introduces its **own** status type (§6.1).

## 4. Visual language (this screen only)

- Define a screen-local `val SquareShape = RoundedCornerShape(0.dp)` (or use `RectangleShape`) and apply to all surfaces/cards/buttons in this screen and its components.
- Borders: `BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)`.
- Backgrounds: `background` (Black) base; `surface`/`surfaceVariant` for raised cells; `surfaceContainerHighest` for the emphasized "today" cell.
- Headings uppercase, using existing `MaterialTheme.typography` (`labelLarge`/`labelMedium` for section labels with letter-spacing; `displayMedium`/`headlineMedium` for titles). Do **not** add new fonts.
- Pills (badges) may stay fully rounded (`RoundedCornerShape(50)`) — matches the mock's `full: 9999px` exception — OR square; pick square for consistency with the brutalist intent. **Use square** for badges.

## 5. Screen layout (top → bottom)

1. **Header** — `COACH FOSKA` wordmark, centered, uppercase, bold. No bell, no avatar (decision 5).
2. **Start Workout button** — full-width, filled `primary` (white) on `onPrimary` (black), square, uppercase, leading play icon.
   - `todayWorkout != null` → label `START WORKOUT`, `onStartWorkout(todayWorkout.id)`.
   - `todayWorkout == null` (rest day) → label `BROWSE WORKOUTS`, `onPlanClick()`.
3. **Weekly Activity grid** — new `WeeklyActivityGrid` component. Section label `WEEKLY ACTIVITY`. 7 equal square bordered cells (Mon→Sun). Each cell: weekday initial + status icon.
4. **Integrated Day Summary bar** — bordered row directly under the grid (the headline feature).
   - Left: `TODAY'S FOCUS` label + workout name uppercase. Rest day → title `REST DAY`, subtitle "Recovery — no workout scheduled", no metrics.
   - Right: metric columns. Always `DURATION {durationMinutes}m` and `EXERCISES {count}`. `VOLUME {x}` shown **only** when `deriveTodayVolumeKg` returns non-null.
5. **Assigned Workouts slider** — section label `ASSIGNED WORKOUTS` + a `SCROLL →` hint. Horizontal `LazyRow` of `AssignedWorkoutCard`s. Shown only if `workouts` is non-empty; otherwise an empty-state line "No workouts assigned yet."
6. **Quick Links** — four full-width bordered `QuickLinkRow`s, in order:
   - Exercise Library → `onLibraryClick`
   - Workout History → `onHistoryClick`
   - Progress Analytics → `onProgressClick` *(new wiring)*
   - Log Activity → `onLogGeneralActivityClick`

Loading: when `state.isLoading && workouts.isEmpty()`, show the existing `CoachLoadingBox` pattern in place of sections 3–5. Error: render `state.error` as a small error-colored line near the bottom (as the current screens do).

## 6. Pure domain logic (TDD — unit tested)

All three are pure functions (no Compose, no coroutines), placed in `domain/usecase/workout/ActivityHubLogic.kt` (top-level functions) so they are trivially testable in `androidUnitTest`.

### 6.1 Weekly activity model
**Do NOT touch the shared `CompletionStatus`/`DayCompletion`.** Introduce a dedicated Activity-Hub type in a new file `domain/model/WeekDayActivity.kt`:
```
enum class DayActivityStatus { COMPLETED, TODAY, SCHEDULED, MISSED, REST }

data class WeekDayActivity(
    val dayOfWeek: DayOfWeek,
    val status: DayActivityStatus,
)
```
This richer model (rest vs. scheduled distinction) is unique to the Activity Hub; the Progress Dashboard keeps using `CompletionStatus` unchanged.

```
fun buildWeeklyActivity(
    workouts: List<Workout>,
    history: List<WorkoutLog>,
    today: LocalDate,
    zone: TimeZone,
): List<WeekDayActivity>
```
Rules, per weekday `d` (Mon..Sun) with `todayDow = today.dayOfWeek.ordinal`:
- `COMPLETED` if any log's `loggedAt` (in `zone`) falls in the current week (from `today - todayDow` to `today`) on day `d`.
- else `TODAY` if `d == todayDow`.
- else if a workout has `dayOfWeek?.index == d` (a workout is assigned that weekday): `MISSED` when `d < todayDow`, otherwise `SCHEDULED`.
- else `REST`.

Icon mapping (in the component, §7.1):
COMPLETED→`check_circle`(filled) · TODAY→`bolt` (emphasized border) · SCHEDULED→`calendar_today` · MISSED→`calendar_today` (dimmed) · REST→`bed` (dimmed).

### 6.2 Today's volume
```
fun deriveTodayVolumeKg(todayWorkout: Workout?, history: List<WorkoutLog>): Double?
```
- Return `null` if `todayWorkout == null`.
- Pick the **most recent** `WorkoutLog` (max `loggedAt`) matching by `workoutId == todayWorkout.id`, falling back to `workoutName == todayWorkout.name` when `workoutId` is null.
- If none, return `null`.
- Otherwise sum over its `exerciseLogs.flatMap { it.sets }.filter { it.completed }` of `(actualWeightKg ?: 0f) * (actualReps ?: 0)`. Return `null` if the sum is `0.0` (nothing to show).

Formatting helper (UI side): `formatVolumeKg(kg: Double): String` → `"12.4k kg"` for ≥1000 (one decimal, drop trailing `.0`), `"840 kg"` otherwise.

### 6.3 Category label
```
fun deriveCategoryLabel(workout: Workout): String
```
- Most frequent non-null `muscleGroup` among `workout.exercises`, uppercased. Tie → first by encounter order.
- Fallback `"WORKOUT"` when none.

## 7. UI components (`ui/workout/components/`)

### 7.1 `WeeklyActivityGrid.kt`
`@Composable fun WeeklyActivityGrid(days: List<WeekDayActivity>, modifier: Modifier = Modifier)`. Row of 7 weight-1 square bordered cells. `DayActivityStatus` → icon/emphasis per §6.1 mapping. Today cell uses 2px `primary` border + `surfaceContainerHighest`; REST/MISSED cells use `alpha 0.5`. Uses Material Icons from `androidx.compose.material.icons` (`CheckCircle`, `Bolt`, `CalendarToday`/`Event`, `Bedtime`/`Hotel`) — pick the closest available filled/outlined icons; document the exact icon imports in the plan.

### 7.2 `AssignedWorkoutCard.kt`
`@Composable fun AssignedWorkoutCard(workout: Workout, categoryLabel: String, onClick: () -> Unit, modifier: Modifier = Modifier)`. Fixed width ~280.dp, square aspect, bordered, square corners. Top: square category badge + a workout icon (`FitnessCenter`). Bottom (pinned): name uppercase (`headlineMedium`) + meta row `schedule {durationMinutes} Min` · `{exercises.size} exercises`. No intensity, no volume.

### 7.3 `QuickLinkRow.kt`
`@Composable fun QuickLinkRow(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier)`. Full-width bordered (bottom border) row: leading icon + uppercase label + trailing `ArrowForward`.

### 7.4 Day-summary bar
May be a private composable inside `ActivityHubScreen.kt` (no separate file needed): `DaySummaryBar(todayWorkout: Workout?, volumeKg: Double?)`.

### 7.5 `WeeklyCalendarStrip.kt` — leave untouched
**Do not delete or modify.** It is still used by `ProgressDashboardScreen`. The Activity Hub simply stops importing it and uses `WeeklyActivityGrid` instead.

## 8. Screen + navigation changes

### 8.1 `ActivityHubScreen.kt`
- `ActivityHubRoute` and `ActivityHubScreen` gain two params: `onWorkoutClick: (workoutId: String) -> Unit` and `onProgressClick: () -> Unit`.
- Rewrite `ActivityHubScreen` body to the layout in §5. Compute `todayWorkout`, `weeklyDays = buildWeeklyActivity(...)`, `volumeKg = deriveTodayVolumeKg(...)`, and per-card `deriveCategoryLabel(...)`.
- Keep `findTodayWorkout` (or fold into the new logic file).
- Add `@Preview`s: populated week + assigned workouts; rest-day/empty state.

### 8.2 `App.kt` — `composable<WorkoutList>`
Add to the `ActivityHubRoute(...)` call:
```
onWorkoutClick = { workoutId -> navController.navigate(WorkoutDetail(workoutId)) },
onProgressClick = { navController.navigate(ProgressDashboard) },
```
(`WorkoutDetail` and `ProgressDashboard` routes already exist in `Routes.kt`.)

### 8.3 Deferred (separate follow-up task, NOT in this PR)
Flip global `CoachFoskaShapes` in `theme/Theme.kt` to square and remove per-screen square overrides, migrating other screens. Out of scope here to keep this PR reviewable.

## 9. Testing

- `ActivityHubLogicTest` (`androidUnitTest/.../presentation/workout/` or `domain/usecase/workout/`):
  - `buildWeeklyActivity`: completed day, today, scheduled future, missed past, rest day (no assignment), week-boundary filtering.
  - `deriveTodayVolumeKg`: null workout → null; no matching log → null; match by id; fallback by name; sum over completed sets only; zero → null; thousands rounding via `formatVolumeKg`.
  - `deriveCategoryLabel`: most-frequent muscle group; tie; empty → "WORKOUT".
- Compose previews compile (smoke).
- Build gate: `./gradlew :composeApp:compileDebugKotlinAndroid` and the unit-test task green.

## 10. Out of scope / non-goals

- No Supabase/migration/DTO/repository changes.
- No notifications feature, no avatar wiring.
- No global theme shape change (deferred, §8.3).
- No changes to Home, Nutrition, Profile, or other tabs.
- No new intensity/category/target-weight persistence.

## 11. File change manifest

**New**
- `domain/model/WeekDayActivity.kt` (`DayActivityStatus` enum + `WeekDayActivity`)
- `domain/usecase/workout/ActivityHubLogic.kt` (`buildWeeklyActivity`, `deriveTodayVolumeKg`, `deriveCategoryLabel`, `formatVolumeKg`)
- `ui/workout/components/WeeklyActivityGrid.kt`
- `ui/workout/components/AssignedWorkoutCard.kt`
- `ui/workout/components/QuickLinkRow.kt`
- `androidUnitTest/.../ActivityHubLogicTest.kt`

**Modified**
- `ui/workout/ActivityHubScreen.kt` (rewrite body, new params `onWorkoutClick`/`onProgressClick`, previews; stop importing `WeeklyCalendarStrip`)
- `App.kt` (`composable<WorkoutList>` wiring)

**Untouched (explicitly do not change)**
- `domain/model/DayCompletion.kt` / `CompletionStatus`
- `ui/workout/components/WeeklyCalendarStrip.kt` (still used by ProgressDashboard)
- `GetProgressDashboardUseCase.kt`, `ProgressDashboardScreen.kt`

**Deleted**
- _(none)_
