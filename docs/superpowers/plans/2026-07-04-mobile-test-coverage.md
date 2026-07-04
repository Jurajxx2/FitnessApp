# Mobile App Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push `composeApp` to near-full unit-test coverage of its business logic — fill every fully-untested ViewModel, use case, and repository impl, deepen the shallow ones, and add Kover so coverage is measurable.

**Architecture:** All work is test additions plus one build-config change (Kover in Task 0). No production `src/commonMain` logic changes. Each task creates or extends one test file following the established pattern: mock repositories/datasources with `mockk()`, build **real** use-case instances from those mocks, drive ViewModels through `onIntent(...)`/public methods, and assert on `state.value`. Flows use Turbine.

**Tech Stack:** `kotlin.test`, MockK, Turbine, `kotlinx-coroutines-test` (`UnconfinedTestDispatcher`), Kover.

## Global Constraints

- Kotlin `2.3.20`; test source set is `composeApp/src/androidUnitTest`; run tests with `./gradlew :composeApp:testDebugUnitTest`.
- All new tests live under `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/<mirrored-package>`.
- ViewModel tests install `Dispatchers.setMain(UnconfinedTestDispatcher())` in `@BeforeTest` and `Dispatchers.resetMain()` in `@AfterTest`.
- Mock repositories/datasources/providers; construct **real** use cases from them. Never mock a use case a ViewModel orchestrates.
- Reuse fixtures in `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/fixtures/Fixtures.kt` (`aUser`, `aWorkout`, `aWorkoutLog`, `anExerciseLog`, `aSetLog`, `aRecipe`, `aChatMessage`, `aGeneralActivityLog`, …). Extend that file rather than inlining ad-hoc objects.
- Stage explicit file paths in every commit — never `git add -A` or `git add .`.
- Every `./gradlew` command is pre-approved.
- Out of scope: DTO serialization tests, remote datasource tests, Compose UI tests, the `admin/` module, any production refactor, and any Kover build-failing threshold.

---

## File Structure

| Task | File | Type |
|---|---|---|
| 0 | `gradle/libs.versions.toml`, `composeApp/build.gradle.kts` | Modify (Kover) |
| 1 | `…/data/repository/AppConfigRepositoryImplTest.kt` | Create (fill) |
| 2 | `…/domain/usecase/SettingsUseCasesTest.kt` | Create (fill) |
| 3 | `…/presentation/settings/SettingsViewModelTest.kt` | Create (fill) |
| 4 | `…/domain/usecase/workout/ProgressUseCasesTest.kt` | Create (fill) |
| 5 | `…/presentation/workout/PostWorkoutSummaryViewModelTest.kt` | Create (fill) |
| 6 | `…/presentation/workout/ProgressDashboardViewModelTest.kt` | Create (fill) |
| 7 | `…/data/repository/OnboardingRepositoryImplTest.kt` | Create (fill) |
| 8 | `…/data/repository/WorkoutRepositoryImplTest.kt` | Extend (deepen) |
| 9 | `…/presentation/workout/ActiveSessionViewModelTest.kt` | Extend (deepen) |
| 10 | `…/data/repository/MealRepositoryImplTest.kt` | Extend (deepen) |
| 11 | `…/presentation/profile/ProfileViewModelTest.kt` + `…/presentation/onboarding/OnboardingViewModelTest.kt` | Extend (deepen) |
| 12 | — | Final full-suite + Kover delta |

Base path for all test files: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/`

---

### Task 0: Add Kover (report-only) and capture baseline

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `composeApp/build.gradle.kts`

- [ ] **Step 1: Add the Kover version + plugin to the catalog**

In `gradle/libs.versions.toml`, under `[versions]` add:

```toml
kover = "0.9.1"
```

Under `[plugins]` add:

```toml
kover = { id = "org.jetbrains.kotlinx.kover", version.ref = "kover" }
```

- [ ] **Step 2: Apply Kover in composeApp**

In `composeApp/build.gradle.kts`, add to the `plugins { }` block (after the existing `alias(...)` lines):

```kotlin
    alias(libs.plugins.kover)
```

Then add this top-level `kover { }` block (anywhere after the `android { }` block, at file top level — not nested):

```kotlin
kover {
    reports {
        filters {
            excludes {
                packages(
                    "com.coachfoska.app.di",
                    "com.coachfoska.app.ui",
                    "com.coachfoska.app.data.remote.dto",
                    "com.coachfoska.app.data.remote.datasource",
                )
                classes(
                    "*ComposableSingletons*",
                    "*\$\$serializer",
                )
            }
        }
    }
}
```

- [ ] **Step 3: Discover the exact report task name and run it**

Kover's report task name can vary by variant. Discover it, then run it:

```bash
./gradlew :composeApp:tasks --all 2>/dev/null | grep -i "koverHtmlReport"
```

Run the reported task (it is `koverHtmlReport` for a single-variant setup; if the list shows only `koverHtmlReportDebug`, use that):

```bash
./gradlew :composeApp:koverHtmlReport 2>&1 | tail -5
```

Expected: `BUILD SUCCESSFUL`, report written to `composeApp/build/reports/kover/html/index.html`.

- [ ] **Step 4: Record the baseline**

```bash
./gradlew :composeApp:koverLog 2>&1 | tail -5 || echo "koverLog not available; open the HTML report and read the overall %"
```

Record the overall % and the `domain` / `presentation` / `data.repository` package %s as a comment at the top of this plan file (or in the commit message). This is the baseline the later tasks are measured against.

- [ ] **Step 5: Commit**

```bash
git add gradle/libs.versions.toml composeApp/build.gradle.kts
git commit -m "test: add Kover coverage reporting (report-only, in-scope package filters)"
```

---

### Task 1: AppConfigRepositoryImpl (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/AppConfigRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `AppConfigRepositoryImpl(dataSource: AppConfigRemoteDataSource)`; `dataSource.getAllConfig(): Map<String, String>`; `getAppLinks(): Result<AppLinks>` maps keys `privacy_policy_url` / `terms_of_service_url` / `account_deletion_url`, missing keys → `""`.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.AppConfigRemoteDataSource
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AppConfigRepositoryImplTest {

    private val dataSource: AppConfigRemoteDataSource = mockk()
    private val repository = AppConfigRepositoryImpl(dataSource)

    @Test
    fun `getAppLinks maps config map to AppLinks`() = runTest {
        coEvery { dataSource.getAllConfig() } returns mapOf(
            "privacy_policy_url" to "https://coachfoska.com/privacy",
            "terms_of_service_url" to "https://coachfoska.com/terms",
            "account_deletion_url" to "https://coachfoska.com/delete",
        )

        val result = repository.getAppLinks()

        assertTrue(result.isSuccess)
        val links = result.getOrThrow()
        assertEquals("https://coachfoska.com/privacy", links.privacyPolicyUrl)
        assertEquals("https://coachfoska.com/terms", links.termsOfServiceUrl)
        assertEquals("https://coachfoska.com/delete", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks defaults missing keys to empty string`() = runTest {
        coEvery { dataSource.getAllConfig() } returns mapOf(
            "privacy_policy_url" to "https://coachfoska.com/privacy"
        )

        val links = repository.getAppLinks().getOrThrow()

        assertEquals("https://coachfoska.com/privacy", links.privacyPolicyUrl)
        assertEquals("", links.termsOfServiceUrl)
        assertEquals("", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks returns empty strings when config is empty`() = runTest {
        coEvery { dataSource.getAllConfig() } returns emptyMap()

        val links = repository.getAppLinks().getOrThrow()

        assertEquals("", links.privacyPolicyUrl)
        assertEquals("", links.termsOfServiceUrl)
        assertEquals("", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks wraps data source exception as failure`() = runTest {
        coEvery { dataSource.getAllConfig() } throws RuntimeException("Network error")

        val result = repository.getAppLinks()

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.AppConfigRepositoryImplTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 4 tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/AppConfigRepositoryImplTest.kt
git commit -m "test: add AppConfigRepositoryImpl tests"
```

---

### Task 2: Settings use cases — GetAppLinks + ResetOnboarding (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/SettingsUseCasesTest.kt`

**Interfaces:**
- Consumes: `GetAppLinksUseCase(repository: AppConfigRepository)` with `invoke(): Result<AppLinks>` delegating to `repository.getAppLinks()`; `ResetOnboardingUseCase(userRepository: UserRepository)` with `invoke(userId): Result<Unit>` delegating to `userRepository.resetOnboarding(userId)`.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.domain.usecase

import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SettingsUseCasesTest {

    private val appConfigRepository: AppConfigRepository = mockk()
    private val userRepository: UserRepository = mockk()

    @Test
    fun `getAppLinks delegates to repository`() = runTest {
        val links = AppLinks("https://p", "https://t", "https://d")
        coEvery { appConfigRepository.getAppLinks() } returns Result.success(links)

        val result = GetAppLinksUseCase(appConfigRepository)()

        assertTrue(result.isSuccess)
        assertEquals(links, result.getOrThrow())
        coVerify(exactly = 1) { appConfigRepository.getAppLinks() }
    }

    @Test
    fun `getAppLinks propagates failure`() = runTest {
        coEvery { appConfigRepository.getAppLinks() } returns Result.failure(RuntimeException("boom"))

        val result = GetAppLinksUseCase(appConfigRepository)()

        assertTrue(result.isFailure)
        assertEquals("boom", result.exceptionOrNull()?.message)
    }

    @Test
    fun `resetOnboarding delegates to userRepository with userId`() = runTest {
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.success(Unit)

        val result = ResetOnboardingUseCase(userRepository)("user-1")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { userRepository.resetOnboarding("user-1") }
    }

    @Test
    fun `resetOnboarding propagates failure`() = runTest {
        coEvery { userRepository.resetOnboarding(any()) } returns Result.failure(RuntimeException("db"))

        val result = ResetOnboardingUseCase(userRepository)("user-1")

        assertTrue(result.isFailure)
        assertEquals("db", result.exceptionOrNull()?.message)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.SettingsUseCasesTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 4 tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/SettingsUseCasesTest.kt
git commit -m "test: add GetAppLinks and ResetOnboarding use case tests"
```

---

### Task 3: SettingsViewModel (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/settings/SettingsViewModelTest.kt`

**Interfaces:**
- Consumes: `SettingsViewModel(getAppLinksUseCase, getCurrentUserUseCase, resetOnboardingUseCase)`. `init` calls `loadLinks()`. Public `debugResetOnboarding()`. `GetCurrentUserUseCase(authRepository)` → `authRepository.getCurrentUser(): User?`. `SettingsState` fields used: `isLoading`, `privacyPolicyUrl`, `termsOfServiceUrl`, `accountDeletionUrl`, `error`, `debugResetOnboardingLoading`, `debugResetOnboardingSuccess`.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.presentation.settings

import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.auth.GetCurrentUserUseCase
import com.coachfoska.app.domain.usecase.config.GetAppLinksUseCase
import com.coachfoska.app.domain.usecase.debug.ResetOnboardingUseCase
import com.coachfoska.app.fixtures.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val appConfigRepository: AppConfigRepository = mockk()
    private val authRepository: AuthRepository = mockk()
    private val userRepository: UserRepository = mockk()

    private fun viewModel() = SettingsViewModel(
        getAppLinksUseCase = GetAppLinksUseCase(appConfigRepository),
        getCurrentUserUseCase = GetCurrentUserUseCase(authRepository),
        resetOnboardingUseCase = ResetOnboardingUseCase(userRepository),
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    private fun stubLinksSuccess() {
        coEvery { appConfigRepository.getAppLinks() } returns Result.success(
            AppLinks("https://p", "https://t", "https://d")
        )
    }

    @Test
    fun `init loads links into state`() = runTest {
        stubLinksSuccess()

        val vm = viewModel()

        assertEquals("https://p", vm.state.value.privacyPolicyUrl)
        assertEquals("https://t", vm.state.value.termsOfServiceUrl)
        assertEquals("https://d", vm.state.value.accountDeletionUrl)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `init sets error when links load fails`() = runTest {
        coEvery { appConfigRepository.getAppLinks() } returns Result.failure(RuntimeException("net"))

        val vm = viewModel()

        assertEquals("net", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `debugResetOnboarding success sets success flag`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns aUser(id = "user-1")
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.success(Unit)
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertTrue(vm.state.value.debugResetOnboardingSuccess)
        assertFalse(vm.state.value.debugResetOnboardingLoading)
    }

    @Test
    fun `debugResetOnboarding with no user sets error and does not call reset`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns null
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertEquals("No authenticated user", vm.state.value.error)
        assertFalse(vm.state.value.debugResetOnboardingSuccess)
        assertFalse(vm.state.value.debugResetOnboardingLoading)
        coVerify(exactly = 0) { userRepository.resetOnboarding(any()) }
    }

    @Test
    fun `debugResetOnboarding failure sets error`() = runTest {
        stubLinksSuccess()
        coEvery { authRepository.getCurrentUser() } returns aUser(id = "user-1")
        coEvery { userRepository.resetOnboarding("user-1") } returns Result.failure(RuntimeException("reset failed"))
        val vm = viewModel()

        vm.debugResetOnboarding()

        assertEquals("reset failed", vm.state.value.error)
        assertFalse(vm.state.value.debugResetOnboardingSuccess)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.settings.SettingsViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 5 tests passing. If a `SettingsState` property name mismatch appears, open `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/settings/SettingsState.kt` and align the assertion to the real field name (the VM's `it.copy(...)` calls list the exact names).

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/settings/SettingsViewModelTest.kt
git commit -m "test: add SettingsViewModel tests"
```

---

### Task 4: Progress & exercise-record use cases (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/ProgressUseCasesTest.kt`

**Interfaces:**
- Consumes: `GetExerciseHistoryUseCase(repo)(userId, exerciseName): Result<List<ExerciseLog>>`; `GetExerciseRecordsUseCase(repo)(userId, exerciseName): Result<ExerciseRecords>`; `GetWorkoutsPerWeekUseCase(repo)(userId, period): Result<List<WeeklyCount>>` (period→daysBack: ONE_MONTH=30, THREE_MONTHS=90, SIX_MONTHS=180, ONE_YEAR=365, ALL=1095; delegates to `repo.getWorkoutCountByWeek(userId, since)`); `GetProgressDashboardUseCase(repo)(userId): Result<DashboardData>` which calls `getWorkoutHistory` (getOrThrow), `getCurrentStreak` (getOrDefault 0), `getRecentPersonalRecords(userId,5)` (getOrDefault empty), `getAssignedWorkouts` (getOrDefault empty). `DashboardData(weeklyCompletions, totalVolumeThisWeek, currentStreak, muscleDistribution, recentPRs)`.
- Determinism: `currentInstant()` (import `com.coachfoska.app.core.util.currentInstant`) is the same wall clock the production code reads, so a log stamped `loggedAt = currentInstant()` is always inside "this week". For `getWorkoutsPerWeek`, assert the *difference* between two periods' `since` values (clock-independent).

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.model.CompletionStatus
import com.coachfoska.app.domain.model.ExerciseRecords
import com.coachfoska.app.domain.model.PersonalRecord
import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.fixtures.aSetLog
import com.coachfoska.app.fixtures.aWorkoutLog
import com.coachfoska.app.fixtures.anExerciseLog
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProgressUseCasesTest {

    private val repo: WorkoutRepository = mockk()

    // --- GetExerciseHistoryUseCase ---

    @Test
    fun `getExerciseHistory delegates to repository`() = runTest {
        val logs = listOf(anExerciseLog())
        coEvery { repo.getExerciseHistory("user-1", "Bench Press") } returns Result.success(logs)

        val result = GetExerciseHistoryUseCase(repo)("user-1", "Bench Press")

        assertTrue(result.isSuccess)
        assertEquals(logs, result.getOrThrow())
    }

    @Test
    fun `getExerciseHistory propagates failure`() = runTest {
        coEvery { repo.getExerciseHistory(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetExerciseHistoryUseCase(repo)("user-1", "Squat")

        assertTrue(result.isFailure)
        assertEquals("db", result.exceptionOrNull()?.message)
    }

    // --- GetExerciseRecordsUseCase ---

    @Test
    fun `getExerciseRecords delegates to repository`() = runTest {
        val records = ExerciseRecords(null, null, null, null)
        coEvery { repo.getExerciseRecords("user-1", "Bench Press") } returns Result.success(records)

        val result = GetExerciseRecordsUseCase(repo)("user-1", "Bench Press")

        assertTrue(result.isSuccess)
        assertEquals(records, result.getOrThrow())
    }

    @Test
    fun `getExerciseRecords propagates failure`() = runTest {
        coEvery { repo.getExerciseRecords(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetExerciseRecordsUseCase(repo)("user-1", "Squat")

        assertTrue(result.isFailure)
    }

    // --- GetWorkoutsPerWeekUseCase ---

    @Test
    fun `getWorkoutsPerWeek returns repository counts`() = runTest {
        val counts = listOf(WeeklyCount(LocalDate.parse("2026-06-01"), 3))
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.success(counts)

        val result = GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.THREE_MONTHS)

        assertTrue(result.isSuccess)
        assertEquals(counts, result.getOrThrow())
    }

    @Test
    fun `getWorkoutsPerWeek since window widens with longer period`() = runTest {
        val sinceSlot = slot<LocalDate>()
        coEvery { repo.getWorkoutCountByWeek(any(), capture(sinceSlot)) } returns Result.success(emptyList())

        GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.ONE_MONTH)
        val sinceOneMonth = sinceSlot.captured
        GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.SIX_MONTHS)
        val sinceSixMonths = sinceSlot.captured

        // 180 - 30 = 150 days earlier, independent of the wall clock
        assertEquals(150, sinceOneMonth.toEpochDays() - sinceSixMonths.toEpochDays())
    }

    @Test
    fun `getWorkoutsPerWeek propagates failure`() = runTest {
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.failure(RuntimeException("db"))

        val result = GetWorkoutsPerWeekUseCase(repo)("user-1", TimePeriod.ALL)

        assertTrue(result.isFailure)
    }

    // --- GetProgressDashboardUseCase ---

    private fun stubDashboardDeps(
        history: Result<List<WorkoutLog>> = Result.success(emptyList()),
        streak: Result<Int> = Result.success(0),
        prs: Result<List<PersonalRecord>> = Result.success(emptyList()),
        workouts: Result<List<Workout>> = Result.success(emptyList()),
    ) {
        coEvery { repo.getWorkoutHistory("user-1") } returns history
        coEvery { repo.getCurrentStreak("user-1") } returns streak
        coEvery { repo.getRecentPersonalRecords("user-1", 5) } returns prs
        coEvery { repo.getAssignedWorkouts("user-1") } returns workouts
    }

    @Test
    fun `getProgressDashboard with empty history returns 7 day completions and zero volume`() = runTest {
        stubDashboardDeps(streak = Result.success(4))

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertEquals(7, data.weeklyCompletions.size)
        assertEquals(1, data.weeklyCompletions.count { it.status == CompletionStatus.TODAY })
        assertEquals(0f, data.totalVolumeThisWeek)
        assertEquals(4, data.currentStreak)
        assertTrue(data.muscleDistribution.isEmpty())
    }

    @Test
    fun `getProgressDashboard aggregates volume for a workout logged today`() = runTest {
        val todayLog = aWorkoutLog(id = "today").copy(
            loggedAt = currentInstant(),
            exerciseLogs = listOf(
                anExerciseLog(
                    sets = listOf(
                        aSetLog(actualWeightKg = 100f, actualReps = 5, completed = true),
                        aSetLog(actualWeightKg = 100f, actualReps = 5, completed = false), // not counted
                    )
                )
            )
        )
        stubDashboardDeps(history = Result.success(listOf(todayLog)))

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        // only the completed set: 100 * 5 = 500
        assertEquals(500f, data.totalVolumeThisWeek)
    }

    @Test
    fun `getProgressDashboard fails when getWorkoutHistory fails`() = runTest {
        stubDashboardDeps(history = Result.failure(RuntimeException("history down")))

        val result = GetProgressDashboardUseCase(repo)("user-1")

        assertTrue(result.isFailure)
        assertEquals("history down", result.exceptionOrNull()?.message)
    }

    @Test
    fun `getProgressDashboard tolerates streak and PR failures via defaults`() = runTest {
        stubDashboardDeps(
            streak = Result.failure(RuntimeException("streak down")),
            prs = Result.failure(RuntimeException("prs down")),
        )

        val data = GetProgressDashboardUseCase(repo)("user-1").getOrThrow()

        assertEquals(0, data.currentStreak)
        assertTrue(data.recentPRs.isEmpty())
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.domain.usecase.workout.ProgressUseCasesTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 11 tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/ProgressUseCasesTest.kt
git commit -m "test: add progress dashboard, workouts-per-week, and exercise-record use case tests"
```

---

### Task 5: PostWorkoutSummaryViewModel (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/PostWorkoutSummaryViewModelTest.kt`

**Interfaces:**
- Consumes: `PostWorkoutSummaryViewModel(getWorkoutHistoryUseCase, userId, logId, sessionPRs = emptyList())`. `init` calls `loadSummary()` which finds the log by id in `getWorkoutHistoryUseCase(userId)` and computes `totalVolumeKg` (completed sets only, `weight*reps`), `setsCompleted`, `setsTotal` (`ex.sets.size`), `exerciseCount`, `workoutName`, `durationMinutes`. `SessionPR(exerciseName, record)`. State fields: `personalRecords`, `workoutName`, `durationMinutes`, `totalVolumeKg`, `setsCompleted`, `setsTotal`, `exerciseCount`, `isLoading`.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.SessionPR
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.fixtures.aSetLog
import com.coachfoska.app.fixtures.aWorkoutLog
import com.coachfoska.app.fixtures.anExerciseLog
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

@OptIn(ExperimentalCoroutinesApi::class)
class PostWorkoutSummaryViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk()

    private fun viewModel(logId: String = "log-1", sessionPRs: List<SessionPR> = emptyList()) =
        PostWorkoutSummaryViewModel(
            getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(repo),
            userId = "user-1",
            logId = logId,
            sessionPRs = sessionPRs,
        )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `sessionPRs passed in constructor are in initial state`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(emptyList())
        val prs = listOf(SessionPR("Bench Press", "100 kg"))

        val vm = viewModel(sessionPRs = prs)

        assertEquals(prs, vm.state.value.personalRecords)
    }

    @Test
    fun `loadSummary populates metrics for the matching log`() = runTest {
        val log = aWorkoutLog(id = "log-1", workoutName = "Push Day").copy(
            durationMinutes = 55,
            exerciseLogs = listOf(
                anExerciseLog(
                    sets = listOf(
                        aSetLog(actualWeightKg = 100f, actualReps = 5, completed = true),
                        aSetLog(actualWeightKg = 50f, actualReps = 10, completed = true),
                        aSetLog(actualWeightKg = 60f, actualReps = 8, completed = false),
                    )
                )
            )
        )
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(listOf(log))

        val vm = viewModel(logId = "log-1")

        assertEquals("Push Day", vm.state.value.workoutName)
        assertEquals(55, vm.state.value.durationMinutes)
        // completed sets only: 100*5 + 50*10 = 1000
        assertEquals(1000f, vm.state.value.totalVolumeKg)
        assertEquals(2, vm.state.value.setsCompleted)
        assertEquals(3, vm.state.value.setsTotal)
        assertEquals(1, vm.state.value.exerciseCount)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadSummary leaves defaults when logId not found`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(listOf(aWorkoutLog(id = "other")))

        val vm = viewModel(logId = "missing")

        assertEquals("", vm.state.value.workoutName)
        assertEquals(0f, vm.state.value.totalVolumeKg)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadSummary clears loading on repository failure`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.failure(RuntimeException("down"))

        val vm = viewModel()

        assertFalse(vm.state.value.isLoading)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.workout.PostWorkoutSummaryViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 4 tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/PostWorkoutSummaryViewModelTest.kt
git commit -m "test: add PostWorkoutSummaryViewModel tests"
```

---

### Task 6: ProgressDashboardViewModel (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardViewModelTest.kt`

**Interfaces:**
- Consumes: `ProgressDashboardViewModel(getProgressDashboardUseCase, getWorkoutsPerWeekUseCase, userId)`. `init` calls `loadDashboard()` + `loadWorkoutsPerWeek()`. Public `onTimePeriodSelected(period)` updates `selectedTimePeriod` then reloads counts. Both use cases wrap the same real `WorkoutRepository` mock. `ProgressDashboardState` defaults `selectedTimePeriod = THREE_MONTHS`; fields `currentStreak`, `weeklyCompletions`, `workoutsPerWeek`, `isLoading`, `error`.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.TimePeriod
import com.coachfoska.app.domain.model.WeeklyCount
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetProgressDashboardUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutsPerWeekUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.LocalDate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class ProgressDashboardViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk()

    private fun stubAll(countsResult: Result<List<WeeklyCount>> = Result.success(emptyList())) {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(emptyList())
        coEvery { repo.getCurrentStreak("user-1") } returns Result.success(7)
        coEvery { repo.getRecentPersonalRecords("user-1", 5) } returns Result.success(emptyList())
        coEvery { repo.getAssignedWorkouts("user-1") } returns Result.success(emptyList())
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns countsResult
    }

    private fun viewModel() = ProgressDashboardViewModel(
        getProgressDashboardUseCase = GetProgressDashboardUseCase(repo),
        getWorkoutsPerWeekUseCase = GetWorkoutsPerWeekUseCase(repo),
        userId = "user-1",
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init loads dashboard data into state`() = runTest {
        stubAll()

        val vm = viewModel()

        assertEquals(7, vm.state.value.currentStreak)
        assertEquals(7, vm.state.value.weeklyCompletions.size)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `init loads workouts per week into state`() = runTest {
        val counts = listOf(WeeklyCount(LocalDate.parse("2026-06-01"), 3))
        stubAll(countsResult = Result.success(counts))

        val vm = viewModel()

        assertEquals(counts, vm.state.value.workoutsPerWeek)
    }

    @Test
    fun `default selected time period is THREE_MONTHS`() = runTest {
        stubAll()

        val vm = viewModel()

        assertEquals(TimePeriod.THREE_MONTHS, vm.state.value.selectedTimePeriod)
    }

    @Test
    fun `onTimePeriodSelected updates period and reloads counts`() = runTest {
        stubAll()
        val vm = viewModel()

        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.success(
            listOf(WeeklyCount(LocalDate.parse("2026-01-01"), 9))
        )
        vm.onTimePeriodSelected(TimePeriod.ONE_YEAR)

        assertEquals(TimePeriod.ONE_YEAR, vm.state.value.selectedTimePeriod)
        assertEquals(9, vm.state.value.workoutsPerWeek.first().count)
    }

    @Test
    fun `dashboard load failure sets error`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.failure(RuntimeException("boom"))
        coEvery { repo.getWorkoutCountByWeek(any(), any()) } returns Result.success(emptyList())

        val vm = viewModel()

        assertEquals("boom", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.workout.ProgressDashboardViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 5 tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/ProgressDashboardViewModelTest.kt
git commit -m "test: add ProgressDashboardViewModel tests"
```

---

### Task 7: OnboardingRepositoryImpl (fill)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/OnboardingRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `OnboardingRepositoryImpl(onboardingDataSource, userDataSource)`. `saveResponses(userId, data): Result<Unit>` → `onboardingDataSource.upsertResponse(dto)` (Unit), then `userDataSource.getProfile(userId): UserDto` (falls back to `UserDto(id=userId, email="")` on throw), then `userDataSource.upsertProfile(updated)` mirroring `fullName` (`data.name.ifBlank { existing.fullName }`), `age`, `heightCm = data.heightCm.toFloat()`, `weightKg`, `goal = data.goal?.name?.lowercase()`, `onboardingComplete = true`. `OnboardingData(goal, age, heightCm: Int, weightKg: Float, name, …)`. `UserDto` requires `id`, `email`; other fields default.

- [ ] **Step 1: Write the test file**

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.OnboardingRemoteDataSource
import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.OnboardingData
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OnboardingRepositoryImplTest {

    private val onboardingDataSource: OnboardingRemoteDataSource = mockk()
    private val userDataSource: UserRemoteDataSource = mockk()
    private val repository = OnboardingRepositoryImpl(onboardingDataSource, userDataSource)

    private val data = OnboardingData(
        goal = FitnessGoal.BUILD_MUSCLE,
        age = 28,
        heightCm = 180,
        weightKg = 82f,
        name = "Alice",
    )

    @Test
    fun `saveResponses persists quiz answers and mirrors profile fields`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } returns UserDto(id = "user-1", email = "a@b.com", fullName = "Old")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isSuccess)
        val saved = profileSlot.captured
        assertEquals("Alice", saved.fullName)
        assertEquals(28, saved.age)
        assertEquals(180f, saved.heightCm)
        assertEquals(82f, saved.weightKg)
        assertEquals("build_muscle", saved.goal)
        assertTrue(saved.onboardingComplete)
    }

    @Test
    fun `saveResponses falls back to skeleton profile when getProfile fails`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } throws RuntimeException("no profile yet")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isSuccess)
        assertEquals("user-1", profileSlot.captured.id)
        assertEquals("Alice", profileSlot.captured.fullName)
        assertTrue(profileSlot.captured.onboardingComplete)
    }

    @Test
    fun `saveResponses keeps existing name when onboarding name is blank`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } just Runs
        coEvery { userDataSource.getProfile("user-1") } returns UserDto(id = "user-1", email = "a@b.com", fullName = "Existing")
        val profileSlot = slot<UserDto>()
        coEvery { userDataSource.upsertProfile(capture(profileSlot)) } just Runs

        val result = repository.saveResponses("user-1", data.copy(name = ""))

        assertTrue(result.isSuccess)
        assertEquals("Existing", profileSlot.captured.fullName)
    }

    @Test
    fun `saveResponses returns failure when upsertResponse throws`() = runTest {
        coEvery { onboardingDataSource.upsertResponse(any()) } throws RuntimeException("db down")

        val result = repository.saveResponses("user-1", data)

        assertTrue(result.isFailure)
        assertEquals("db down", result.exceptionOrNull()?.message)
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.OnboardingRepositoryImplTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, 4 tests passing. If `UserDto` field names differ (`heightCm`/`weightKg`/`goal`), open `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/dto/UserDto.kt` and align.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/OnboardingRepositoryImplTest.kt
git commit -m "test: add OnboardingRepositoryImpl tests"
```

---

## Deepen tasks (8–11)

Deepen tasks extend existing test files. The rule for each: **read the existing test file and the production file first**, list the public methods/branches with no assertion, then add one focused test per uncovered branch following the exact patterns already in that test file (same imports, same fixtures, same dispatcher setup). Do **not** duplicate scenarios already present. Each listed scenario below is a known gap — cover at least these, plus any other uncovered branch you find.

---

### Task 8: Deepen WorkoutRepositoryImpl tests

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImplTest.kt`
- Read first: that file + `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImpl.kt` + `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/remote/datasource/WorkoutRemoteDataSource.kt`.

Already covered: `getAssignedWorkouts` (map + error), `logWorkout` (set-log insert + empty-sets skip), `getWorkoutHistory` (stitch). **21 override methods exist; most are untested.**

- [ ] **Step 1: Add tests for these uncovered methods** (one success test + one failure/edge test each, mocking the datasource per the existing file's pattern):
  - `getWorkoutById` — maps DTO to domain; propagates datasource exception.
  - `getAllWorkouts` — maps list; empty list.
  - `getExerciseHistory` — returns stitched exercise logs for the named exercise.
  - `getExerciseRecords` — returns computed `ExerciseRecords` (assert the heaviest/1RM/volume entries for a small fixed set of logs; if the computation is elaborate, assert the non-null record whose value you can predict from the input).
  - `getRecentPersonalRecords` — returns up to `limit` records; empty when no history.
  - `getWorkoutCountByWeek` — groups logs by ISO week since the given date.
  - `getCurrentStreak` — consecutive-day/week streak from history; `0` when empty.
  - `createUserWorkout` / `updateUserWorkout` / `deleteUserWorkout` — success maps result; datasource exception → `Result.failure`.
  - `saveSetLog` / `updateSetLog` / `deleteSetLog` — delegate + wrap.
  - `startWorkoutSession` / `finishWorkoutSession` / `discardWorkoutSession` / `getInProgressSession` — success + `null`/failure branch.

  Use `runCatching`-wrapping assertions (`assertTrue(result.isFailure)` + message) for the failure branches, matching the existing `getAssignedWorkouts propagates data source exception` test.

- [ ] **Step 2: Run**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.WorkoutRepositoryImplTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, original 5 tests + at least 20 new tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImplTest.kt
git commit -m "test: deepen WorkoutRepositoryImpl coverage across all repository methods"
```

---

### Task 9: Deepen ActiveSessionViewModel tests

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModelTest.kt`
- Read first: that file + `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModel.kt` + `ActiveSessionIntent` (grep the sealed intent variants) + `ActiveSessionState`.

Already covered: substitute swap/first-origin/dismiss, set-complete autosave, autosave-failure retry, unmark set, finish→completed, resume rebuild.

- [ ] **Step 1: Enumerate the `ActiveSessionIntent` variants** (grep `sealed`/`data class`/`object` under `ActiveSessionIntent`) **and add one test per intent/branch not already asserted.** Likely gaps to cover (only those that exist in the sealed hierarchy):
  - editing a set's target/actual reps or weight updates the corresponding row in state;
  - add-set / remove-set changes the set count for an exercise;
  - rest-timer start/skip/tick transitions (assert the timer-related state field, driven through the intent — advance virtual time with `advanceTimeBy` on a `StandardTestDispatcher` if the existing file uses one, otherwise follow the file's existing timing approach);
  - notes edit updates state;
  - discard session calls `discardWorkoutSession` and moves to the discarded/exit state;
  - finishing with incomplete sets (if the VM has that branch) behaves per production.
  Follow the mocking + dispatcher setup already in the file (do not introduce a new dispatcher style).

- [ ] **Step 2: Run**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.workout.ActiveSessionViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, original 8 + at least 6 new tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/ActiveSessionViewModelTest.kt
git commit -m "test: deepen ActiveSessionViewModel coverage across session intents"
```

---

### Task 10: Deepen MealRepositoryImpl tests

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/MealRepositoryImplTest.kt`
- Read first: that file + `composeApp/src/commonMain/kotlin/com/coachfoska/app/data/repository/MealRepositoryImpl.kt` + `MealRemoteDataSource`.

Public methods: `getRecipes`, `getRecipeById`, `getActiveMealPlan`, `logMeal`, `analyzeMealPhoto`, `getMealHistory`, `searchFoods`, `getDailyNutritionSummary`, `getFavoriteRecipeIds`, `setRecipeFavorite`.

- [ ] **Step 1: For each public method not already asserted, add a success test and a failure/edge test** (mock `MealRemoteDataSource` per the file's pattern). Prioritise: `getRecipeById` (found + `null` when absent), `getActiveMealPlan` (present + `null`), `logMeal` (maps and returns the created log; failure), `getDailyNutritionSummary` (aggregates the day's foods), `searchFoods` (maps + empty), `getFavoriteRecipeIds` (set), `setRecipeFavorite` (add + remove branch).

- [ ] **Step 2: Run**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.data.repository.MealRepositoryImplTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, original tests + new tests passing.

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/MealRepositoryImplTest.kt
git commit -m "test: deepen MealRepositoryImpl coverage across all methods"
```

---

### Task 11: Deepen ProfileViewModel + OnboardingViewModel tests

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/profile/ProfileViewModelTest.kt`
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt`
- Read first: each test file + its production ViewModel + the `*Intent` sealed hierarchy.

- [ ] **Step 1 (ProfileViewModel):** grep `ProfileIntent` variants; add a test per uncovered intent/branch — likely weight-log input validation (invalid/empty weight sets error without repo call), successful weight log refreshes history, profile edit field updates, load-profile failure sets error, dismiss error clears it.

- [ ] **Step 2 (OnboardingViewModel):** grep `OnboardingIntent` variants + the public `onSingleSelectAndAdvance(intent)` method; add tests for multi-step navigation (advance/back changes the step), single-select-and-advance both updates the field and advances, focus-area toggle add/remove, training-day toggle, and any validation branch not already covered.

- [ ] **Step 3: Run both**

```bash
./gradlew :composeApp:testDebugUnitTest --tests "com.coachfoska.app.presentation.profile.ProfileViewModelTest" --tests "com.coachfoska.app.presentation.onboarding.OnboardingViewModelTest" 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`, original + new tests passing.

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/profile/ProfileViewModelTest.kt composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/onboarding/OnboardingViewModelTest.kt
git commit -m "test: deepen ProfileViewModel and OnboardingViewModel coverage"
```

---

### Task 12: Full-suite verification + Kover delta

- [ ] **Step 1: Run the entire suite**

```bash
./gradlew :composeApp:testDebugUnitTest 2>&1 | tail -15
```

Expected: `BUILD SUCCESSFUL`, all green (from 359 up to ~430+ tests).

- [ ] **Step 2: Regenerate the coverage report and compare to the Task 0 baseline**

```bash
./gradlew :composeApp:koverHtmlReport 2>&1 | tail -5
./gradlew :composeApp:koverLog 2>&1 | tail -5 || echo "read overall % from composeApp/build/reports/kover/html/index.html"
```

Confirm `domain`, `presentation`, and `data.repository` package %s all rose versus the Task 0 baseline. Note the final numbers in the completion summary.

- [ ] **Step 3: No commit needed** — all test files were committed in their own tasks.

---

## Self-Review notes

- **Spec coverage:** Kover (Task 0) ✓; all 3 untested VMs (Tasks 3, 5, 6) ✓; all 6 untested use cases — GetAppLinks/ResetOnboarding (Task 2), GetProgressDashboard/GetWorkoutsPerWeek/GetExerciseHistory/GetExerciseRecords (Task 4) ✓; 2 untested repos — AppConfig (Task 1), Onboarding (Task 7) ✓; deepen shallow VMs/repos (Tasks 8–11) ✓; DTOs/datasources/UI excluded ✓.
- **Determinism:** the two clock-dependent use cases are tested without static mocking (relative-difference assertion + `currentInstant()`-stamped fixtures), matching the "no production changes" constraint.
- **Fill tasks** carry complete verbatim test code. **Deepen tasks** are bounded "read production + existing test, cover each uncovered branch" tasks naming the real methods/intents — the target files are all in-repo.
