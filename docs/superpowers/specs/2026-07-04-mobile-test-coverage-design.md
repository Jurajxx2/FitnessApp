# Mobile App Test Coverage — Design Spec

**Date:** 2026-07-04
**Scope:** `composeApp` (KMP mobile) only — excludes `admin/` and any web surface.
**Goal:** Push the mobile app to near-full unit-test coverage of its business logic
(domain + presentation + data-repository layers), organized per feature.

---

## Decisions (locked)

| Question | Decision |
|---|---|
| Coverage depth | **Thorough business logic** — every ViewModel, use case, and repository impl gets thorough unit tests (success + failure + edge/branch). Fill fully-untested classes **and** deepen shallow existing tests. No new test infra. |
| Measurement | **Add Kover, report-only.** Configure `org.jetbrains.kotlinx.kover` to emit HTML/XML reports. **No** build-failing threshold. |
| Data edges | **Skip DTOs and remote datasources.** DTOs are plain `@Serializable` holders; datasources are thin Supabase wrappers not unit-testable without integration infra. |
| Structure | **Per-feature vertical slices.** One task group per feature; within each, fill untested classes then deepen shallow ones; re-run Kover per feature. |
| UI layer | **Out of scope.** No Compose UI / Robolectric tests. |

---

## Current-state coverage map (baseline at spec time)

359 test functions across 65 test files in `composeApp/src/androidUnitTest`. No coverage tooling configured.

| Layer | Total | Tested | Untested |
|---|---|---|---|
| ViewModels | 18 | 15 | 3 — `SettingsViewModel`, `PostWorkoutSummaryViewModel`, `ProgressDashboardViewModel` |
| Use cases | 61 | ~55 | 6 — `GetAppLinksUseCase`, `GetExerciseHistoryUseCase`, `GetExerciseRecordsUseCase`, `GetProgressDashboardUseCase`, `GetWorkoutsPerWeekUseCase`, `ResetOnboardingUseCase` |
| Repository impls | 11 | 9 | 2 — `AppConfigRepositoryImpl`, `OnboardingRepositoryImpl` |

**Shallow ("tested" but thin) — deepen candidates:**
`ActiveSessionViewModel` (8 tests, complex session engine), `WorkoutRepositoryImpl` (5),
`ProfileViewModel` (6), `OnboardingViewModel`, `NutritionViewModel`/`MealRepositoryImpl`,
`UserRepositoryImpl`. Exact deepen targets confirmed per-feature during planning by reading
each file and listing its untested branches.

**Explicitly out of scope:** all `data/remote/dto/*`, all `data/remote/datasource/*`,
all Compose UI in `ui/`, the `admin/` module.

---

## Testing conventions (locked from the existing suite)

All new tests follow the established project pattern — no new patterns introduced:

- **Frameworks:** `kotlin.test`, MockK, Turbine, `kotlinx-coroutines-test`.
- **Dispatcher:** `UnconfinedTestDispatcher()`, installed via `Dispatchers.setMain(...)` in
  `@BeforeTest` and `Dispatchers.resetMain()` in `@AfterTest` for ViewModel tests.
- **Mocking:** mock repositories / providers with `mockk()`. Build **real** use-case
  instances from those mocks. Never mock a use case when the VM's job is to orchestrate it.
- **ViewModels:** drive through the public `onIntent(...)` API; assert on `vm.state.value`.
  Flow-exposed state uses Turbine (`state.test { ... }`).
- **Repositories:** mock the datasource(s), assert `Result.success`/`Result.failure`
  wrapping, mapping correctness, and error propagation.
- **Use cases:** assert delegation to the repository (`coVerify`), argument pass-through,
  and success/failure propagation.
- **Fixtures:** reuse builders in
  `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/fixtures/Fixtures.kt`
  (`aUser`, `aWorkout`, `aWorkoutLog`, `aRecipe`, `aChatMessage`, `aGeneralActivityLog`, …).
  Extend this file with new builders rather than inlining ad-hoc objects.
- **Location:** every test lives under
  `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/<mirrored-package>`.
- **Run one file:** `./gradlew :composeApp:testDebugUnitTest --tests "<fqcn>"`.
- **Run all:** `./gradlew :composeApp:testDebugUnitTest`.

---

## Task 0 — Kover setup (prerequisite)

Add the Kover Gradle plugin (`org.jetbrains.kotlinx.kover`) to the version catalog and apply
it in `composeApp/build.gradle.kts`, report-only (no `koverVerify` threshold wired into
`check`). Deliverable: `./gradlew :composeApp:koverHtmlReport` produces
`composeApp/build/reports/kover/html/index.html`. Record the baseline overall % and the
per-package % for `domain`, `presentation`, and `data.repository` in the plan so progress is
measurable. Kover config must exclude `di/`, `ui/`, DTOs, and datasources from the headline
number so the report reflects the in-scope surface.

---

## Per-feature task groups

Each group's Definition of Done: every in-scope class in the feature has a test file;
success + failure + relevant edge/branch paths covered; `./gradlew :composeApp:testDebugUnitTest`
green; Kover re-run and the feature's package % recorded.

### Group 1 — Settings & App Config
- **Fill:** `SettingsViewModel` (deps: `GetAppLinksUseCase`, `GetCurrentUserUseCase`,
  `ResetOnboardingUseCase`), `GetAppLinksUseCase`, `ResetOnboardingUseCase`,
  `AppConfigRepositoryImpl` (dep: `AppConfigRemoteDataSource`).
- Key scenarios: reset-onboarding with null user id (no-op), success, failure; app-links
  load success/failure; config repo Result wrapping.

### Group 2 — Workouts & Progress
- **Fill:** `PostWorkoutSummaryViewModel` (deps: `GetWorkoutHistoryUseCase`, `userId`,
  `logId`, `sessionPRs`), `ProgressDashboardViewModel` (deps: `GetProgressDashboardUseCase`,
  `GetWorkoutsPerWeekUseCase`, `userId`), `GetProgressDashboardUseCase`,
  `GetWorkoutsPerWeekUseCase`, `GetExerciseHistoryUseCase`, `GetExerciseRecordsUseCase`.
- **Deepen:** `ActiveSessionViewModel` (rest timers, set completion, PR detection,
  discard/finish paths), `WorkoutRepositoryImpl` (mapping + error branches).

### Group 3 — Onboarding
- **Fill:** `OnboardingRepositoryImpl` (deps: `OnboardingRemoteDataSource`,
  `UserRemoteDataSource`).
- **Deepen:** `OnboardingViewModel` (validation branches, multi-step navigation edge cases).

### Group 4 — Nutrition & Recipes
- **Deepen:** `MealRepositoryImpl` (mapping + failure branches), `NutritionViewModel`
  (error/empty/edge paths), recipe scaling edge cases.

### Group 5 — Profile
- **Deepen:** `ProfileViewModel` (weight-log validation, load failure), `UserRepositoryImpl`
  (profile update/mapping branches).

### Group 6 — Auth · Home · Hydration · Chat · Activity · Exercises
- **Deepen:** targeted error/branch gaps where existing coverage is thin. Confirm each file's
  missing branches at planning time; add only genuinely-missing scenarios (avoid duplicating
  existing assertions).

---

## Ordering & rationale

Order = highest untested-surface first: Group 1 and 2 create the most new files (all three
untested VMs + all six untested use cases + two of the untested repos live there), so the
coverage number moves fastest early. Groups 4–6 are deepen-heavy refinement. Each group is an
independent, reviewable checkpoint and commits separately.

## Execution constraints (project conventions)

- All new files are pure test additions **plus** the one Kover build-config change (Task 0);
  no production `src/commonMain` logic changes.
- Stage explicit file paths in every commit — never `git add -A` or `git add .`.
- All `./gradlew` commands are pre-approved.
- Plan must be portable: self-contained tasks, exact file paths, exact gradle commands, no
  "figure it out" prose — executable by a subagent without extra context.

## Out of scope (explicit)

DTO serialization tests; remote datasource tests; Compose UI / screen tests; `admin/` module;
any production-code refactor; a Kover coverage gate/threshold.
