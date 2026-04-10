# Coach Foska — App Review & Test Implementation Design

**Date:** 2026-04-03  
**Scope:** Full app code review, fix all findings, implement unit tests for UseCases + ViewModels + RepositoryImpls  
**Approach:** Option C — layered review + fix + test per feature domain

---

## 1. Code Review Findings

### Critical (must fix)

| # | Location | Issue |
|---|----------|-------|
| 1 | `WorkoutViewModel.loadWorkouts()` | On API failure, silently falls back to `MockData.workoutPlan`. User sees mock data with no error indication. Remove fallback; surface error to state instead. |
| 2 | `WorkoutViewModel.loadWorkouts()` | On success with empty list, also falls back to `MockData.workoutPlan`. Empty state is valid — show it. |
| 3 | `NutritionViewModel.loadMealPlan()` | Same MockData fallback on failure and on null plan. Remove; surface error or show empty state. |
| 4 | `NutritionViewModel.loadRecipes()` | Contains `delay(500)` to simulate a network call. Demo/test code in production. Remove delay; recipes use case should be wired up or stub removed cleanly. |
| 5 | `HomeViewModel.loadData()` | All 3 parallel call failures are logged but never set `state.error`. Screen shows empty silently. Surface at least one error to state. |
| 6 | `WorkoutViewModel.selectWorkoutLog()` | If log not found locally, triggers `loadHistory()` as a hidden side effect with no loading state update. Make explicit or remove side effect. |

### Architecture

| # | Location | Issue |
|---|----------|-------|
| 7 | `src/commonMain/kotlin/com/coachfoska/app/model/` | Duplicate model package alongside `domain/model/`. Consolidate into `domain/model/` only. |

### Minor

| # | Location | Issue |
|---|----------|-------|
| 8 | Several ViewModels | Some load functions do not reset `error = null` before starting. `DismissError` intent exists but state can be stale. Ensure all load paths reset error at start. |

---

## 2. Test Infrastructure

### Source Sets
Add `commonTest` source set to `composeApp/build.gradle.kts`.

### Dependencies (commonTest)
```kotlin
commonTest.dependencies {
    implementation(kotlin("test"))
    implementation(libs.kotlinx.coroutines.test)
    implementation(libs.turbine)
    implementation(libs.mockk)
}
```

Add to `libs.versions.toml`:
- `kotlinx-coroutines-test` (matches existing coroutines version)
- `app.cash.turbine:turbine`
- `io.mockk:mockk` (KMP, runs on JVM target for commonTest)

### Test Utilities (commonTest)
- `TestDispatchers` — `StandardTestDispatcher` wrapper, injected into ViewModels in place of `Dispatchers.Main`
- Domain model fixture builders — e.g. `aWorkout()`, `aMealPlan()`, `aUser()` for concise test data construction

---

## 3. Test Strategy

### Approach
- All tests in `commonTest` — pure Kotlin, no Android/iOS-specific dependencies
- MockK for mocking Repository interfaces and DataSource interfaces
- Turbine for asserting `StateFlow` emissions in ViewModel tests
- `runTest` for all coroutine-based tests

### Domain Order & Coverage

#### Auth
- `SendOtpUseCase` — success, invalid email (failure propagated)
- `VerifyOtpUseCase` — success, wrong OTP (failure propagated)
- `ObserveSessionUseCase` — emits `SessionAuthState` transitions
- `AuthViewModel` — OTP send: loading → success/error; OTP verify: loading → success/error

#### Workout
- `GetAssignedWorkoutsUseCase` — delegates to repo, returns mapped result
- `LogWorkoutUseCase` — success, failure propagation
- `WorkoutRepositoryImpl` — DTO→domain mapping; `logWorkout` skips exercise log insert when list is empty
- `WorkoutViewModel` — load success (real data, no MockData); load failure (error state set); log workout success/failure; `selectWorkoutLog` found/not-found

#### Nutrition
- `GetActiveMealPlanUseCase`, `LogMealUseCase`, `GetMealHistoryUseCase` — success/failure delegation
- `MealRepositoryImpl` — DTO→domain mapping
- `NutritionViewModel` — load plan success/failure (no MockData fallback); log meal success/failure; select meal

#### Profile
- `GetUserProfileUseCase`, `UpdateUserProfileUseCase`, `LogWeightUseCase`, `GetWeightHistoryUseCase` — success/failure
- `UserRepositoryImpl` — DTO→domain mapping
- `ProfileViewModel` — load, update, weight log flows; error states

#### Home
- `HomeViewModel` — all 3 loads succeed → state populated; partial failures → error surfaced; today's workout filtered correctly by day-of-week index

---

## 4. Out of Scope

- UI / Compose screenshot tests
- iOS-specific instrumented tests
- Integration tests against real Supabase
- Exercise domain (read-only API calls, lower risk)

---

## 5. Completion Criteria

- All findings from Section 1 fixed
- `commonTest` source set configured and building
- ~20 test files, all green
- No `MockData` references remain in ViewModel production logic
- No `delay()` simulation in production code
