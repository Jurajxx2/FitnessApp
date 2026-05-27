# Workout Screens Full Redesign — Design Spec

## Context

Coach Foska's workout feature is functional but lacks the polish and UX patterns proven by top workout apps (Hevy 4.9★ 5M+, Strong 4.7★ 1M+, JEFIT 4.6★ 5M+). This redesign applies competitive insights while preserving Coach Foska's unique coached-workout model.

**Competitive research sources:** Hevy (set logging UX, PREVIOUS column, social), Strong (minimalist logging, templates, plate calc), JEFIT (exercise library, adaptive plans, analytics depth).

## Scope

Full redesign of all workout/exercise screens:
- Activity Hub (entry point)
- Active Workout Session (logging)
- Exercise Detail (info + analytics)
- Workout History + Detail
- Progress Dashboard
- Post-Workout Summary
- Exercise Library (refinements)

**Out of scope:** Social features, AI workout generation, smartwatch companion, workout plan builder (coach-assigned only).

## Tech Constraints

- Kotlin Multiplatform + Compose Multiplatform
- MVI architecture (Intent → ViewModel → State)
- Supabase backend (Auth, Postgrest, Realtime)
- Single `composeApp` module
- Material 3 theming (both dark and light)

---

## 1. Activity Hub — Today-First Layout

**Current:** Card-based hub with equal-weight cards for Plan, History, Library, Log Activity.

**New:** Today's workout is the hero. Everything else is secondary.

### Screen Structure

```
┌─────────────────────────────────┐
│ ACTIVITY                    [⚙] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🏋️ Today's Workout          │ │
│ │ Push Day · 6 exercises      │ │
│ │ ~55 min · Chest, Triceps    │ │
│ │                             │ │
│ │    [ ▶ START WORKOUT ]      │ │
│ └─────────────────────────────┘ │
│                                 │
│ This Week          3/5 ●●●○○   │
│ ┌──┬──┬──┬──┬──┬──┬──┐        │
│ │Mo│Tu│We│Th│Fr│Sa│Su│        │
│ │✓ │✓ │- │✓ │- │  │  │        │
│ └──┴──┴──┴──┴──┴──┴──┘        │
│                                 │
│ Recent Sessions                 │
│ ┌─────────────────────────────┐ │
│ │ Pull Day · May 26 · 48min  │ │
│ │ Push Day · May 25 · 52min  │ │
│ └─────────────────────────────┘ │
│ See all history →               │
│                                 │
│ ┌──────────┐ ┌──────────┐      │
│ │ 📚       │ │ ➕       │      │
│ │ Exercise │ │ Log      │      │
│ │ Library  │ │ Activity │      │
│ └──────────┘ └──────────┘      │
└─────────────────────────────────┘
```

### Components

- **Hero workout card:** Pulls today's assigned workout from `WorkoutRepository.getAssignedWorkouts()`. Shows workout name, exercise count, estimated duration, target muscle groups. Prominent "START WORKOUT" button. If no workout assigned today: show "Rest day" or "No workout scheduled" with option to browse library.
- **Weekly calendar strip:** Mon-Sun row showing completed (✓), missed (-), and upcoming (empty) days. Shows `X/Y workouts` counter. Calculated from `WorkoutRepository.getWorkoutHistory()` for current week.
- **Recent sessions:** Last 2-3 workout logs with name, date, duration. Tappable to open `WorkoutHistoryDetail`. "See all history →" link navigates to full `WorkoutHistory`.
- **Quick action cards:** Two equal-width cards at bottom — Exercise Library and Log Activity (general activities like walking, running).

### State

```kotlin
data class ActivityHubState(
    val todayWorkout: Workout?,        // null = rest day
    val weeklyCompletions: List<DayCompletion>, // Mon-Sun
    val recentSessions: List<WorkoutLog>,       // last 3
    val isLoading: Boolean,
)

data class DayCompletion(
    val dayOfWeek: DayOfWeek,
    val status: CompletionStatus, // COMPLETED, MISSED, UPCOMING, TODAY
)
```

---

## 2. Active Workout Session — Hybrid Tab Strip

**Current:** HorizontalPager (one exercise per page), basic text fields for reps/weight, RPE slider, checkbox. No PREVIOUS data, no rest timer, no PR tracking.

**New:** Scrollable exercise chip tabs at top + expanded exercise detail below. PREVIOUS column, inline rest timer, PR detection, green completion feedback.

### Screen Structure

```
┌─────────────────────────────────┐
│ ← PUSH DAY   ⏱1:15  📊6.8t [⋮]│
├─────────────────────────────────┤
│ [Bench Press] [Incline DB] [Fly]│  ← scrollable chip tabs
├─────────────────────────────────┤
│ Bench Press (Barbell)           │
│ Chest · 3 × 10 · 90s rest      │
│ Keep elbows at 45°              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ REST TIME        1:12       │ │  ← inline timer (when active)
│ │ ████████░░░  [-30s][+30s][⏭]│ │
│ └─────────────────────────────┘ │
│                                 │
│ SET  PREV     KG   REPS   ✓    │
│ W    40×7     40    8    [✅]   │  ← warmup (yellow badge)
│ 1    62×7     65    8    [✅]   │  ← completed (green bg)
│ 2    62×7     65    8    [✅]   │  ← completed (green bg)
│ 3    -        70    —    [ ]   │  ← next set (green border)
│                                 │
│ + Add Set                       │
│                                 │
│ 💬 Add note for this exercise   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🏋️ Tap to view form guide → │ │  ← opens ExerciseDetail
│ └─────────────────────────────┘ │
│                                 │
│          [FINISH WORKOUT]       │  ← appears on last exercise
└─────────────────────────────────┘
```

### Exercise Tab Strip

- Horizontally scrollable `LazyRow` of `FilterChip` composables
- Active exercise chip: filled primary color
- Completed exercise chip: filled with checkmark icon
- Incomplete exercise chip: outlined, secondary color
- Tapping a chip scrolls the detail area to that exercise
- Auto-advances to next incomplete exercise when all sets of current exercise are completed

### Set Logging Table

Each row contains:

| Column | Width | Content |
|--------|-------|---------|
| SET | 32dp | Set number (Int) or "W" for warmup (yellow) |
| PREV | 64dp | Previous session data: `{weight} × {reps}` from last log of same exercise. Gray text. Dash if no history. |
| KG | 56dp | Editable weight field. Auto-filled from PREV on first load. Keyboard: decimal number. |
| REPS | 48dp | Editable reps field. Auto-filled from target reps. Keyboard: number. |
| ✓ | 32dp | Completion toggle. Tap → green checkmark animation + row background turns green + rest timer auto-starts. |

### PREVIOUS Column Data

Requires a new use case:

```kotlin
class GetPreviousExerciseLogsUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseNames: List<String>
    ): Map<String, List<SetLog>>
    // Returns the most recent SetLog list for each exercise name
}
```

Repository addition:

```kotlin
// In WorkoutRepository
suspend fun getLastLogForExercise(
    userId: String,
    exerciseName: String
): ExerciseLog?
```

### Set Completion Flow

1. User taps ✓ on a set row
2. Row background animates to green (200ms ease-in)
3. Checkmark scales up with spring animation
4. If `targetRestSeconds > 0`: inline rest timer appears below the completed set
5. Timer counts down with progress bar
6. When timer hits 0: haptic buzz, timer collapses, next set row gets green border (focused)
7. Weight field of next set auto-fills from the just-completed set's weight
8. If all sets of exercise completed: tab chip gets checkmark, auto-advance to next exercise after 1s delay

### Rest Timer

- Appears inline within the exercise card, between the last completed set and the next set
- Shows: countdown (large, tabular-nums font), progress bar, -30s button, +30s button, Skip button
- Auto-starts when a set is marked complete (if rest seconds > 0)
- Sends haptic feedback on completion
- Timer state lives in ViewModel (survives recomposition)

```kotlin
data class RestTimerState(
    val isActive: Boolean = false,
    val remainingSeconds: Int = 0,
    val totalSeconds: Int = 0,
)
```

### PR Detection

During set completion, check if the logged weight × reps exceeds any previous log for that exercise:

```kotlin
class CheckPersonalRecordUseCase(
    private val workoutRepository: WorkoutRepository
) {
    suspend operator fun invoke(
        userId: String,
        exerciseName: String,
        weightKg: Float,
        reps: Int
    ): PersonalRecord?
}

data class PersonalRecord(
    val type: PRType,       // HEAVIEST_WEIGHT, MOST_REPS_AT_WEIGHT, BEST_ESTIMATED_1RM
    val previousBest: String, // "65kg × 8"
    val newRecord: String,    // "70kg × 8"
)
```

When a PR is detected: show a brief celebratory banner (gold background, trophy icon) that appears above the set table for 3 seconds, then collapses. Also mark the set row with a small 🏆 badge.

### Session Header

Top bar shows:
- Back button (with "discard workout?" confirmation dialog)
- Workout name (uppercase)
- Running timer (from session start)
- Total volume (sum of weight × reps for all completed sets, formatted as kg/tons)
- Overflow menu: Skip exercise, Finish workout, Discard workout

### Intents (additions to existing WorkoutIntent)

```kotlin
sealed interface WorkoutIntent {
    // ... existing intents ...
    data class StartRestTimer(val exerciseIndex: Int, val seconds: Int) : WorkoutIntent
    data object SkipRestTimer : WorkoutIntent
    data class AdjustRestTimer(val deltaSeconds: Int) : WorkoutIntent
    data class SwitchExercise(val exerciseIndex: Int) : WorkoutIntent
    data class AddExerciseNote(val exerciseIndex: Int, val note: String) : WorkoutIntent
}
```

---

## 3. Exercise Detail — Tabbed Info Screen

**Current:** `ExerciseDetailScreen` shows exercise info (name, description, muscles, equipment, video). No history, charts, or records.

**New:** Four-tab layout accessible by tapping exercise name from workout, library, or history.

### Tab Structure

```
┌─────────────────────────────────┐
│ ← Bench Press (Barbell)    [♡] │
│ Chest · Barbell                 │
├──────┬────────┬────────┬────────┤
│Guide │History │ Charts │Records │
├──────┴────────┴────────┴────────┤
│                                 │
│  (tab content below)            │
│                                 │
└─────────────────────────────────┘
```

### Guide Tab (refactored from current ExerciseDetail)

- Exercise description text
- Animated GIF or video (tappable for fullscreen playback)
- Primary muscles (list with optional body-map illustration)
- Secondary muscles
- Equipment needed
- Tips from coach (if available from workout assignment)
- Difficulty badge

### History Tab

- Chronological list of all logged sessions containing this exercise
- Each entry shows: date, sets completed, best set (heaviest weight × reps), total volume
- Tappable to expand and see individual set data

### Charts Tab

- Time filter chips: `1M | 3M | 6M | 1Y | All`
- Line chart showing selected metric over time
- Metric toggle chips: `Heaviest Weight | Est. 1RM | Best Volume | # of Reps`
- PR markers on the chart (🏆 icon at PR data points)
- Chart implementation: custom Canvas composable or a lightweight KMP chart library

### Records Tab

- All-time personal records listed:
  - Heaviest weight: `70kg × 8 reps — May 25, 2026`
  - Most reps at weight: `60kg × 15 reps — Apr 12, 2026`
  - Highest estimated 1RM: `82.5kg — May 25, 2026`
  - Highest volume (single session): `4,200kg — May 20, 2026`
- Each record shows the date achieved and a 🏆 badge

### Data Requirements

New repository method:

```kotlin
// In WorkoutRepository
suspend fun getExerciseHistory(
    userId: String,
    exerciseName: String
): List<ExerciseLog>

suspend fun getExerciseRecords(
    userId: String,
    exerciseName: String
): ExerciseRecords

data class ExerciseRecords(
    val heaviestWeight: RecordEntry?,
    val mostRepsAtWeight: RecordEntry?,
    val highestEstimated1RM: RecordEntry?,
    val highestVolume: RecordEntry?,
)

data class RecordEntry(
    val value: String,
    val detail: String, // e.g., "70kg × 8 reps"
    val date: LocalDate,
)
```

---

## 4. Workout Progress Dashboard

**New screen** accessible from Activity Hub "See all history →" or as a section within the History flow.

### Screen Structure

```
┌─────────────────────────────────┐
│ ← Your Progress                 │
├─────────────────────────────────┤
│ This Week         3/5 workouts  │
│ [Mo✓][Tu✓][We-][Th✓][Fr-][Sa][Su]│
│                                 │
│ ┌──────────┐ ┌──────────┐      │
│ │ 12,450kg │ │ 🔥 4     │      │
│ │ volume   │ │ wk streak│      │
│ └──────────┘ └──────────┘      │
│                                 │
│ Volume by Muscle Group          │
│ Chest    ████████░░  34%        │
│ Back     ██████░░░░  28%        │
│ Legs     █████░░░░░  22%        │
│ Shoulders ████░░░░░  16%        │
│                                 │
│ 🏆 Recent PRs                   │
│ Bench Press 70kg×8 · 2 days ago │
│ Squat 95kg×5 · 5 days ago      │
│                                 │
│ Workouts Per Week    [3M ▼]     │
│ ┌───────────────────────────┐   │
│ │ █ █ █ █ █ █ █ █ █ █ █ █ │   │
│ │ 3 4 5 4 3 5 4 3 4 5 3 4 │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

### Components

- **Weekly calendar:** Same as Activity Hub but tappable to navigate between weeks
- **Stat cards:** Total volume this week, current streak (consecutive weeks with ≥1 workout)
- **Muscle group distribution:** Horizontal bar chart showing volume percentage per muscle group for selected time period. Calculated from logged exercises' muscle group tags.
- **Recent PRs:** Last 5 personal records across all exercises, with exercise name, record value, and relative date
- **Workouts per week:** Bar chart with time period selector (1M/3M/6M/1Y). Shows workout count per week.

### State

```kotlin
data class ProgressDashboardState(
    val weeklyCompletions: List<DayCompletion>,
    val totalVolumeThisWeek: Float,
    val currentStreak: Int,
    val muscleDistribution: List<MuscleVolumeEntry>,
    val recentPRs: List<RecentPR>,
    val workoutsPerWeek: List<WeeklyCount>,
    val selectedTimePeriod: TimePeriod,
    val isLoading: Boolean,
)

enum class TimePeriod { ONE_MONTH, THREE_MONTHS, SIX_MONTHS, ONE_YEAR, ALL }
```

---

## 5. Post-Workout Summary

**New screen** shown after tapping "Finish Workout" and successful save.

### Screen Structure

```
┌─────────────────────────────────┐
│                                 │
│         🎉 Workout Complete!    │
│                                 │
│    ┌───────────────────────┐    │
│    │     PUSH DAY          │    │
│    │     May 27, 2026      │    │
│    │                       │    │
│    │  ⏱ 52 min             │    │
│    │  📊 6,800 kg volume   │    │
│    │  ✅ 18/18 sets        │    │
│    │  💪 6 exercises       │    │
│    │                       │    │
│    │  🏆 2 Personal Records│    │
│    │  Bench Press 70kg×8   │    │
│    │  Squat 95kg×5         │    │
│    └───────────────────────┘    │
│                                 │
│       [ DONE ]                  │
│                                 │
└─────────────────────────────────┘
```

### Behavior

- Shown as a full-screen overlay or navigation destination after successful workout log
- Displays: workout name, date, duration, total volume, sets completed/total, exercise count
- PR section (if any): lists exercises where PRs were hit during this session
- "Done" button navigates back to Activity Hub
- Confetti or subtle celebration animation on first render
- Summary data calculated from the just-saved `WorkoutLog`

### State

```kotlin
data class PostWorkoutSummaryState(
    val workoutName: String,
    val date: LocalDate,
    val durationMinutes: Int,
    val totalVolumeKg: Float,
    val setsCompleted: Int,
    val setsTotal: Int,
    val exerciseCount: Int,
    val personalRecords: List<SessionPR>,
)

data class SessionPR(
    val exerciseName: String,
    val record: String, // "70kg × 8"
)
```

---

## 6. Exercise Library Refinements

**Current:** `ExerciseLibraryScreen` with search and category filtering. Works well.

**Changes:**
- Tap exercise name → navigate to new tabbed `ExerciseDetail` (with History/Charts/Records/Guide)
- Add favorite toggle (heart icon) on each exercise card (already exists in repository)
- Add "Favorites" filter chip alongside category chips
- Exercise cards show small muscle group tag chips

No major structural changes — the library is already solid.

---

## 7. Workout History Refinements

**Current:** `WorkoutHistoryScreen` shows list of past sessions. `WorkoutHistoryDetailScreen` shows per-exercise breakdown.

**Changes:**
- Add "Your Progress" card/button at top of history list → navigates to Progress Dashboard
- History detail: add per-exercise "View Charts →" link that opens Exercise Detail Charts tab
- Add summary stats to each history card: total volume, duration, PR count (if any)

---

## 8. Navigation Updates

### New Routes

```kotlin
@Serializable data object ProgressDashboard : Route
@Serializable data class PostWorkoutSummary(val logId: String) : Route
```

### Modified Routes

- `ExerciseDetail(exerciseId)` — now opens tabbed view with Guide/History/Charts/Records
- `ActiveSession(workoutId)` — on finish, navigate to `PostWorkoutSummary(logId)` instead of popping back

### Navigation Flow

```
ActivityHub
├── Start Workout → ActiveSession → PostWorkoutSummary → ActivityHub
├── See all history → WorkoutHistory → WorkoutHistoryDetail
│                                    → ProgressDashboard
├── Exercise Library → ExerciseDetail (tabbed)
├── Log Activity → ActivityTypeSelector → LogActivityForm → ActivityHub
└── Today's card (when multiple workouts) → WorkoutPlan → WorkoutDetail → ActiveSession
```

### Deprecated Screens

- `WorkoutPlanScreen` — still reachable when user has multiple assigned workouts for the day, but the primary "start today's workout" flow bypasses it via the hero card. If only one workout is assigned today, tapping "Start" goes directly to `ActiveSession`.

---

## 9. Theme

Both dark and light themes using Material 3 dynamic theming. The design mockups use a dark palette as reference, but all components use `MaterialTheme.colorScheme` tokens so they adapt automatically.

Key color semantics:
- **Primary (green):** Completed sets, active timer, positive actions, active chips
- **Warning (amber/gold):** Warmup sets, PR badges and notifications
- **Surface variants:** Card backgrounds, inactive chips, table headers
- **Error (red):** Discard workout confirmation

---

## 10. Data Model Additions

### New Domain Models

```kotlin
data class PersonalRecord(
    val type: PRType,
    val exerciseName: String,
    val value: String,
    val previousBest: String?,
    val achievedAt: Instant,
)

enum class PRType {
    HEAVIEST_WEIGHT,
    MOST_REPS_AT_WEIGHT,
    BEST_ESTIMATED_1RM,
    HIGHEST_SESSION_VOLUME,
}

data class MuscleVolumeEntry(
    val muscleGroup: String,
    val volumeKg: Float,
    val percentage: Float,
)

data class WeeklyCount(
    val weekStart: LocalDate,
    val count: Int,
)
```

### New Use Cases

| Use Case | Purpose |
|----------|---------|
| `GetPreviousExerciseLogsUseCase` | Fetch last session's set data for PREVIOUS column |
| `CheckPersonalRecordUseCase` | Compare set against all-time bests during logging |
| `GetExerciseHistoryUseCase` | Fetch all logs for a specific exercise (charts/history tabs) |
| `GetExerciseRecordsUseCase` | Fetch all-time records for an exercise (records tab) |
| `GetProgressDashboardUseCase` | Aggregate weekly stats, streaks, muscle distribution, recent PRs |
| `GetWorkoutsPerWeekUseCase` | Count workouts per week for bar chart |
| `CalculateEstimated1RMUseCase` | Epley/Brzycki formula for estimated 1RM from weight × reps |

### Repository Additions

```kotlin
// WorkoutRepository additions
suspend fun getLastLogForExercise(userId: String, exerciseName: String): ExerciseLog?
suspend fun getExerciseHistory(userId: String, exerciseName: String): List<ExerciseLog>
suspend fun getAllPersonalRecords(userId: String, exerciseName: String): ExerciseRecords
suspend fun getRecentPersonalRecords(userId: String, limit: Int): List<PersonalRecord>
suspend fun getWorkoutCountByWeek(userId: String, since: LocalDate): List<WeeklyCount>
suspend fun getCurrentStreak(userId: String): Int
```

---

## 11. New Supabase Queries Required

The PREVIOUS column, PR detection, and analytics all require new queries against the existing `workout_logs` / `exercise_logs` / `set_logs` tables. No schema changes needed — these are read-only aggregations on existing data.

Key queries:
1. Last exercise log for a given exercise name + user (for PREVIOUS)
2. Max weight, max reps-at-weight, max volume for a given exercise + user (for PRs)
3. Exercise logs grouped by session date (for charts)
4. Workout count grouped by ISO week (for workouts-per-week chart)
5. Sum of volume by muscle group for a date range (for muscle distribution)

---

## Summary of Screens

| Screen | Status | Key Changes |
|--------|--------|-------------|
| ActivityHub | **Redesign** | Today-first hero card, weekly calendar, recent sessions, quick actions |
| ActiveSession | **Redesign** | Tab strip, PREVIOUS column, inline rest timer, PR detection, green completion |
| ExerciseDetail | **Redesign** | Four-tab layout: Guide / History / Charts / Records |
| ProgressDashboard | **New** | Weekly stats, streak, muscle distribution, PRs, workouts-per-week chart |
| PostWorkoutSummary | **New** | Celebration screen with session stats and PRs |
| ExerciseLibrary | **Refine** | Favorites filter, muscle group tags, link to tabbed detail |
| WorkoutHistory | **Refine** | Progress dashboard link, enhanced history cards |
| WorkoutHistoryDetail | **Refine** | Per-exercise chart links |
