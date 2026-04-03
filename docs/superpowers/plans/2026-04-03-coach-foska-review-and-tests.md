# Coach Foška App Review & Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all production code review findings and implement unit tests for UseCase, ViewModel, and RepositoryImpl layers.

**Architecture:** Tests live in `androidUnitTest` source set (JVM target, MockK compatible). ViewModels are tested via `Dispatchers.setMain(UnconfinedTestDispatcher())` which makes `viewModelScope.launch` run synchronously. Each domain is handled atomically: fix → test.

**Tech Stack:** Kotlin 2.3.10, KMP (Android + iOS), MockK 1.13.12, Turbine 1.2.0, kotlinx-coroutines-test 1.10.2, kotlin-test

---

## File Map

**Modified:**
- `gradle/libs.versions.toml` — add mockk, turbine versions and library entries
- `composeApp/build.gradle.kts` — add `androidUnitTest` source set with test dependencies
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModel.kt` — remove MockData fallbacks, fix selectWorkoutLog side effect
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt` — remove MockData fallback, remove delay(500)
- `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt` — surface errors to state

**Created (tests):**
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/auth/AuthUseCasesTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/auth/AuthViewModelTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/WorkoutUseCasesTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImplTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModelTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/NutritionUseCasesTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/MealRepositoryImplTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/profile/ProfileUseCasesTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/UserRepositoryImplTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/profile/ProfileViewModelTest.kt`
- `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt`

---

## Task 0: Test Infrastructure Setup

**Files:**
- Modify: `gradle/libs.versions.toml`
- Modify: `composeApp/build.gradle.kts`

- [ ] **Step 1: Add test dependency versions and libraries to libs.versions.toml**

In `gradle/libs.versions.toml`, add to `[versions]`:
```toml
mockk = "1.13.12"
turbine = "1.2.0"
```

Add to `[libraries]`:
```toml
mockk = { module = "io.mockk:mockk", version.ref = "mockk" }
turbine = { module = "app.cash.turbine:turbine", version.ref = "turbine" }
kotlinx-coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "kotlinx-coroutines" }
```

- [ ] **Step 2: Add androidUnitTest source set to composeApp/build.gradle.kts**

Inside the `sourceSets { }` block, after `iosMain.dependencies { ... }`, add:
```kotlin
val androidUnitTest by getting {
    dependencies {
        implementation(libs.mockk)
        implementation(libs.turbine)
        implementation(libs.kotlinx.coroutines.test)
        implementation(kotlin("test"))
    }
}
```

- [ ] **Step 3: Verify the build compiles with no errors**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: BUILD SUCCESSFUL (0 tests run — no test files yet)

- [ ] **Step 4: Commit**

```bash
git add gradle/libs.versions.toml composeApp/build.gradle.kts
git commit -m "chore: add test infrastructure (MockK, Turbine, coroutines-test)"
```

---

## Task 1: Auth — UseCase Tests

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/auth/AuthUseCasesTest.kt`

- [ ] **Step 1: Create test file with SendOtpUseCase tests**

```kotlin
package com.coachfoska.app.domain.usecase.auth

import com.coachfoska.app.domain.repository.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthUseCasesTest {

    private val authRepository: AuthRepository = mockk()

    // --- SendOtpUseCase ---

    @Test
    fun `sendOtp with valid email calls repository`() = runTest {
        coEvery { authRepository.sendEmailOtp("test@example.com") } returns Result.success(Unit)
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("test@example.com")

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { authRepository.sendEmailOtp("test@example.com") }
    }

    @Test
    fun `sendOtp trims whitespace before calling repository`() = runTest {
        coEvery { authRepository.sendEmailOtp("test@example.com") } returns Result.success(Unit)
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("  test@example.com  ")

        assertTrue(result.isSuccess)
        coVerify { authRepository.sendEmailOtp("test@example.com") }
    }

    @Test
    fun `sendOtp with blank email returns failure without calling repository`() = runTest {
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("")

        assertTrue(result.isFailure)
        assertEquals("Invalid email address", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `sendOtp with email missing at-sign returns failure without calling repository`() = runTest {
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("notanemail")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.sendEmailOtp(any()) }
    }

    @Test
    fun `sendOtp propagates repository failure`() = runTest {
        coEvery { authRepository.sendEmailOtp(any()) } returns Result.failure(RuntimeException("Server error"))
        val useCase = SendOtpUseCase(authRepository)

        val result = useCase("test@example.com")

        assertTrue(result.isFailure)
        assertEquals("Server error", result.exceptionOrNull()?.message)
    }

    // --- VerifyOtpUseCase ---

    @Test
    fun `verifyOtp with valid 6-digit OTP calls repository`() = runTest {
        val user = aUser()
        coEvery { authRepository.verifyEmailOtp("test@example.com", "123456") } returns Result.success(user)
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "123456")

        assertTrue(result.isSuccess)
        assertEquals(user, result.getOrThrow())
    }

    @Test
    fun `verifyOtp with OTP shorter than 6 digits returns failure`() = runTest {
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "12345")

        assertTrue(result.isFailure)
        assertEquals("OTP must be 6 digits", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `verifyOtp with non-digit OTP returns failure`() = runTest {
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "12345X")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { authRepository.verifyEmailOtp(any(), any()) }
    }

    @Test
    fun `verifyOtp propagates repository failure`() = runTest {
        coEvery { authRepository.verifyEmailOtp(any(), any()) } returns Result.failure(RuntimeException("Invalid OTP"))
        val useCase = VerifyOtpUseCase(authRepository)

        val result = useCase("test@example.com", "999999")

        assertTrue(result.isFailure)
        assertEquals("Invalid OTP", result.exceptionOrNull()?.message)
    }
}

// --- Shared fixtures ---

fun aUser(
    id: String = "user-1",
    email: String = "test@example.com",
    onboardingComplete: Boolean = true
) = com.coachfoska.app.domain.model.User(
    id = id,
    email = email,
    fullName = "Test User",
    age = 30,
    heightCm = 175f,
    weightKg = 75f,
    goal = com.coachfoska.app.domain.model.UserGoal.MUSCLE_GAIN,
    activityLevel = com.coachfoska.app.domain.model.ActivityLevel.MODERATELY_ACTIVE,
    onboardingComplete = onboardingComplete
)
```

- [ ] **Step 2: Run the tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.AuthUseCasesTest"`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add Auth UseCase tests"
```

---

## Task 2: Auth — ViewModel Tests

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/auth/AuthViewModelTest.kt`

- [ ] **Step 1: Create AuthViewModelTest**

```kotlin
package com.coachfoska.app.presentation.auth

import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import com.coachfoska.app.domain.usecase.auth.aUser
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val sendOtpUseCase: SendOtpUseCase = mockk()
    private val verifyOtpUseCase: VerifyOtpUseCase = mockk()
    private val signInWithGoogleUseCase: SignInWithGoogleUseCase = mockk()
    private val signInWithAppleUseCase: SignInWithAppleUseCase = mockk()

    private fun viewModel() = AuthViewModel(
        sendOtpUseCase, verifyOtpUseCase, signInWithGoogleUseCase, signInWithAppleUseCase
    )

    @BeforeTest
    fun setUp() = Dispatchers.setMain(testDispatcher)

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state is empty`() {
        val vm = viewModel()
        assertEquals("", vm.state.value.email)
        assertEquals("", vm.state.value.otp)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `EmailChanged updates email and clears error`() {
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))
        assertEquals("test@example.com", vm.state.value.email)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `OtpChanged updates otp`() {
        val vm = viewModel()
        vm.onIntent(AuthIntent.OtpChanged("123456"))
        assertEquals("123456", vm.state.value.otp)
    }

    @Test
    fun `sendOtp success sets otpSent true and clears loading`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.success(Unit)
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))

        vm.onIntent(AuthIntent.SendOtp)

        assertTrue(vm.state.value.otpSent)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `sendOtp failure sets error message`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.failure(RuntimeException("Network error"))
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))

        vm.onIntent(AuthIntent.SendOtp)

        assertFalse(vm.state.value.otpSent)
        assertFalse(vm.state.value.isLoading)
        assertEquals("Network error", vm.state.value.error)
    }

    @Test
    fun `verifyOtp success with onboarding complete navigates to home`() = runTest {
        val user = aUser(onboardingComplete = true)
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.success(user)
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertTrue(vm.state.value.navigateToHome)
        assertFalse(vm.state.value.navigateToOnboarding)
        assertEquals(user, vm.state.value.authenticatedUser)
    }

    @Test
    fun `verifyOtp success with onboarding incomplete navigates to onboarding`() = runTest {
        val user = aUser(onboardingComplete = false)
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.success(user)
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertFalse(vm.state.value.navigateToHome)
        assertTrue(vm.state.value.navigateToOnboarding)
    }

    @Test
    fun `verifyOtp failure sets error message`() = runTest {
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.failure(RuntimeException("Invalid OTP"))
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertEquals("Invalid OTP", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.authenticatedUser)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()
        vm.onIntent(AuthIntent.SendOtp)
        assertNotNull(vm.state.value.error)

        vm.onIntent(AuthIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}
```

- [ ] **Step 2: Run the tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.AuthViewModelTest"`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add AuthViewModel tests"
```

---

## Task 3: Fix WorkoutViewModel

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModel.kt`

- [ ] **Step 1: Write failing test that proves the bug exists**

Add this test to `WorkoutViewModelTest.kt` (create the file now):

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import io.mockk.mockk
import io.mockk.coEvery
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.assertFalse

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk()

    private fun viewModel() = WorkoutViewModel(
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(repo),
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadWorkouts failure shows error state not mock data`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertEquals("Network error", vm.state.value.error)
        assertTrue(vm.state.value.workouts.isEmpty())
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.WorkoutViewModelTest.loadWorkouts failure shows error state not mock data"`
Expected: FAIL — `workouts` is not empty (MockData fallback is active)

- [ ] **Step 3: Fix WorkoutViewModel — remove MockData fallbacks and selectWorkoutLog side effect**

Replace the full file `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModel.kt`:

```kotlin
package com.coachfoska.app.presentation.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "WorkoutViewModel"

class WorkoutViewModel(
    private val getAssignedWorkoutsUseCase: GetAssignedWorkoutsUseCase,
    private val getWorkoutByIdUseCase: GetWorkoutByIdUseCase,
    private val logWorkoutUseCase: LogWorkoutUseCase,
    private val getWorkoutHistoryUseCase: GetWorkoutHistoryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(WorkoutState())
    val state: StateFlow<WorkoutState> = _state.asStateFlow()

    init {
        onIntent(WorkoutIntent.LoadWorkouts)
    }

    fun onIntent(intent: WorkoutIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            WorkoutIntent.LoadWorkouts -> loadWorkouts()
            is WorkoutIntent.SelectWorkout -> selectWorkout(intent.workoutId)
            WorkoutIntent.LoadHistory -> loadHistory()
            is WorkoutIntent.LogWorkout -> logWorkout(intent)
            WorkoutIntent.DismissError -> _state.update { it.copy(error = null) }
            WorkoutIntent.WorkoutLogged -> _state.update { it.copy(workoutLoggedSuccess = false) }
            is WorkoutIntent.SelectWorkoutLog -> selectWorkoutLog(intent.logId)
            is WorkoutIntent.AttachVideoToLog -> attachVideo(intent.exerciseLogId, intent.videoBytes)
        }
    }

    private fun selectWorkoutLog(logId: String) {
        val log = _state.value.workoutHistory.find { it.id == logId }
        _state.update { it.copy(selectedWorkoutLog = log) }
    }

    private fun attachVideo(exerciseLogId: String, videoBytes: ByteArray) {
        Napier.d("Attaching video to $exerciseLogId (${videoBytes.size} bytes)", tag = TAG)
    }

    private fun loadWorkouts() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getAssignedWorkoutsUseCase(userId)
                .onSuccess { workouts ->
                    _state.update { it.copy(isLoading = false, workouts = workouts) }
                }
                .onFailure { e ->
                    Napier.e("loadWorkouts failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun selectWorkout(workoutId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            getWorkoutByIdUseCase(workoutId)
                .onSuccess { workout -> _state.update { it.copy(isLoading = false, selectedWorkout = workout) } }
                .onFailure { e ->
                    Napier.e("selectWorkout($workoutId) failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true, error = null) }
            getWorkoutHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, workoutHistory = logs) } }
                .onFailure { e ->
                    Napier.e("loadHistory failed", e, tag = TAG)
                    _state.update { it.copy(isHistoryLoading = false, error = e.message) }
                }
        }
    }

    private fun logWorkout(intent: WorkoutIntent.LogWorkout) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true, error = null) }
            logWorkoutUseCase(
                userId, intent.workoutId, intent.workoutName,
                intent.durationMinutes, intent.notes, intent.exerciseLogs
            )
                .onSuccess {
                    Napier.i("Workout logged: ${intent.workoutName}", tag = TAG)
                    _state.update { it.copy(isLogging = false, workoutLoggedSuccess = true) }
                }
                .onFailure { e ->
                    Napier.e("logWorkout failed", e, tag = TAG)
                    _state.update { it.copy(isLogging = false, error = e.message) }
                }
        }
    }
}
```

- [ ] **Step 4: Run the failing test again — it must pass now**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.WorkoutViewModelTest.loadWorkouts failure shows error state not mock data"`
Expected: PASS

- [ ] **Step 5: Commit the fix**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModel.kt
git commit -m "fix: WorkoutViewModel removes MockData fallbacks and hidden loadHistory side effect"
```

---

## Task 4: Workout — Repository & UseCase Tests

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/WorkoutRepositoryImplTest.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/workout/WorkoutUseCasesTest.kt`

- [ ] **Step 1: Create WorkoutRepositoryImplTest**

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.WorkoutRemoteDataSource
import com.coachfoska.app.data.remote.dto.ExerciseLogDto
import com.coachfoska.app.data.remote.dto.ExerciseLogInsertDto
import com.coachfoska.app.data.remote.dto.WorkoutDto
import com.coachfoska.app.data.remote.dto.WorkoutLogDto
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.ExerciseLog
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutRepositoryImplTest {

    private val dataSource: WorkoutRemoteDataSource = mockk()
    private val repository = WorkoutRepositoryImpl(dataSource)

    @Test
    fun `getAssignedWorkouts maps DTOs to domain models`() = runTest {
        val dto = WorkoutDto(id = "w1", name = "Monday Push", dayOfWeek = 0, durationMinutes = 60)
        coEvery { dataSource.getAssignedWorkouts("user-1") } returns listOf(dto)

        val result = repository.getAssignedWorkouts("user-1")

        assertTrue(result.isSuccess)
        val workouts = result.getOrThrow()
        assertEquals(1, workouts.size)
        assertEquals("w1", workouts[0].id)
        assertEquals("Monday Push", workouts[0].name)
        assertEquals(DayOfWeek.MONDAY, workouts[0].dayOfWeek)
        assertEquals(60, workouts[0].durationMinutes)
    }

    @Test
    fun `getAssignedWorkouts propagates data source exception`() = runTest {
        coEvery { dataSource.getAssignedWorkouts(any()) } throws RuntimeException("DB error")

        val result = repository.getAssignedWorkouts("user-1")

        assertTrue(result.isFailure)
        assertEquals("DB error", result.exceptionOrNull()?.message)
    }

    @Test
    fun `logWorkout with exercise logs calls insertExerciseLogs`() = runTest {
        val logDto = aWorkoutLogDto()
        coEvery { dataSource.insertWorkoutLog(any(), any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertExerciseLogs(any()) } returns listOf(anExerciseLogDto())

        val exerciseLogs = listOf(anExerciseLog())
        val result = repository.logWorkout("user-1", "w1", "Push Day", 60, null, exerciseLogs)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertExerciseLogs(any()) }
    }

    @Test
    fun `logWorkout with empty exercise logs skips insertExerciseLogs`() = runTest {
        val logDto = aWorkoutLogDto()
        coEvery { dataSource.insertWorkoutLog(any(), any(), any(), any(), any()) } returns logDto

        repository.logWorkout("user-1", null, "Push Day", 60, null, emptyList())

        coVerify(exactly = 0) { dataSource.insertExerciseLogs(any()) }
    }

    @Test
    fun `getWorkoutHistory maps DTOs to domain models`() = runTest {
        coEvery { dataSource.getWorkoutHistory("user-1") } returns listOf(aWorkoutLogDto())

        val result = repository.getWorkoutHistory("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals("log-1", result.getOrThrow()[0].id)
    }
}

private fun aWorkoutLogDto() = WorkoutLogDto(
    id = "log-1",
    userId = "user-1",
    workoutName = "Push Day",
    durationMinutes = 60,
    loggedAt = "2026-04-03T10:00:00Z"
)

private fun anExerciseLogDto() = ExerciseLogDto(
    id = "elog-1",
    workoutLogId = "log-1",
    exerciseName = "Bench Press",
    setsCompleted = 3
)

private fun anExerciseLog() = ExerciseLog(
    id = "elog-1",
    workoutLogId = "log-1",
    exerciseName = "Bench Press",
    setsCompleted = 3,
    repsCompleted = "10",
    weightKg = 80f,
    notes = null
)
```

- [ ] **Step 2: Create WorkoutUseCasesTest**

```kotlin
package com.coachfoska.app.domain.usecase.workout

import com.coachfoska.app.domain.model.ExerciseLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WorkoutUseCasesTest {

    private val repo: WorkoutRepository = mockk()

    @Test
    fun `GetAssignedWorkoutsUseCase delegates to repository`() = runTest {
        coEvery { repo.getAssignedWorkouts("user-1") } returns Result.success(listOf(aWorkout()))
        val useCase = GetAssignedWorkoutsUseCase(repo)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        coVerify { repo.getAssignedWorkouts("user-1") }
    }

    @Test
    fun `GetWorkoutByIdUseCase delegates to repository`() = runTest {
        coEvery { repo.getWorkoutById("w1") } returns Result.success(aWorkout())
        val useCase = GetWorkoutByIdUseCase(repo)

        val result = useCase("w1")

        assertTrue(result.isSuccess)
        assertEquals("w1", result.getOrThrow().id)
    }

    @Test
    fun `LogWorkoutUseCase delegates to repository`() = runTest {
        val log = aWorkoutLog()
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(log)
        val useCase = LogWorkoutUseCase(repo)

        val result = useCase("user-1", "w1", "Push Day", 60, null, emptyList())

        assertTrue(result.isSuccess)
        coVerify { repo.logWorkout("user-1", "w1", "Push Day", 60, null, emptyList()) }
    }

    @Test
    fun `GetWorkoutHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getWorkoutHistory("user-1") } returns Result.success(listOf(aWorkoutLog()))
        val useCase = GetWorkoutHistoryUseCase(repo)

        val result = useCase("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }
}

private fun aWorkout() = Workout(
    id = "w1", name = "Push Day", dayOfWeek = null, durationMinutes = 60, exercises = emptyList()
)

private fun aWorkoutLog() = WorkoutLog(
    id = "log-1", userId = "user-1", workoutId = "w1", workoutName = "Push Day",
    durationMinutes = 60, notes = null, exerciseLogs = emptyList(),
    loggedAt = Instant.parse("2026-04-03T10:00:00Z")
)
```

- [ ] **Step 3: Run all workout tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.WorkoutRepositoryImplTest" --tests "*.WorkoutUseCasesTest"`
Expected: All 9 tests PASS

- [ ] **Step 4: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add Workout Repository and UseCase tests"
```

---

## Task 5: Workout — ViewModel Tests (complete)

**Files:**
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/workout/WorkoutViewModelTest.kt`

- [ ] **Step 1: Expand WorkoutViewModelTest with full coverage**

Replace the contents of the file with:

```kotlin
package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class WorkoutViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: WorkoutRepository = mockk()

    private fun viewModel() = WorkoutViewModel(
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(repo),
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(repo),
        logWorkoutUseCase = LogWorkoutUseCase(repo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadWorkouts success populates workouts list`() = runTest {
        val workouts = listOf(aWorkout())
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(workouts)

        val vm = viewModel()

        assertEquals(1, vm.state.value.workouts.size)
        assertEquals("w1", vm.state.value.workouts[0].id)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadWorkouts success with empty list shows empty state`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())

        val vm = viewModel()

        assertTrue(vm.state.value.workouts.isEmpty())
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadWorkouts failure shows error state not mock data`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertEquals("Network error", vm.state.value.error)
        assertTrue(vm.state.value.workouts.isEmpty())
    }

    @Test
    fun `logWorkout success sets workoutLoggedSuccess true`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(aWorkoutLog())
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.LogWorkout("w1", "Push Day", 60, null, emptyList()))

        assertTrue(vm.state.value.workoutLoggedSuccess)
        assertFalse(vm.state.value.isLogging)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `logWorkout failure sets error state`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("Log failed"))
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.LogWorkout("w1", "Push Day", 60, null, emptyList()))

        assertEquals("Log failed", vm.state.value.error)
        assertFalse(vm.state.value.isLogging)
    }

    @Test
    fun `selectWorkoutLog found in history sets selectedWorkoutLog`() = runTest {
        val log = aWorkoutLog()
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.getWorkoutHistory(any()) } returns Result.success(listOf(log))
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.LoadHistory)

        vm.onIntent(WorkoutIntent.SelectWorkoutLog("log-1"))

        assertEquals(log, vm.state.value.selectedWorkoutLog)
    }

    @Test
    fun `selectWorkoutLog not found leaves selectedWorkoutLog null`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.SelectWorkoutLog("non-existent"))

        assertNull(vm.state.value.selectedWorkoutLog)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()
        assertNotNull(vm.state.value.error)

        vm.onIntent(WorkoutIntent.DismissError)

        assertNull(vm.state.value.error)
    }

    @Test
    fun `WorkoutLogged intent resets workoutLoggedSuccess`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { repo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(aWorkoutLog())
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.LogWorkout("w1", "Push", 60, null, emptyList()))
        assertTrue(vm.state.value.workoutLoggedSuccess)

        vm.onIntent(WorkoutIntent.WorkoutLogged)

        assertFalse(vm.state.value.workoutLoggedSuccess)
    }
}

private fun aWorkout() = Workout(
    id = "w1", name = "Push Day", dayOfWeek = null, durationMinutes = 60, exercises = emptyList()
)

private fun aWorkoutLog() = WorkoutLog(
    id = "log-1", userId = "user-1", workoutId = "w1", workoutName = "Push Day",
    durationMinutes = 60, notes = null, exerciseLogs = emptyList(),
    loggedAt = Instant.parse("2026-04-03T10:00:00Z")
)
```

- [ ] **Step 2: Run all workout ViewModel tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.WorkoutViewModelTest"`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add WorkoutViewModel tests"
```

---

## Task 6: Fix NutritionViewModel

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt`

- [ ] **Step 1: Write failing test that proves the bug**

Create `NutritionViewModelTest.kt`:

```kotlin
package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class NutritionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: MealRepository = mockk()

    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadMealPlan failure shows error state not mock data`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.mealPlan)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.NutritionViewModelTest.loadMealPlan failure shows error state not mock data"`
Expected: FAIL — `mealPlan` is not null (MockData fallback is active)

- [ ] **Step 3: Fix NutritionViewModel**

Replace the full file `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt`:

```kotlin
package com.coachfoska.app.presentation.nutrition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import io.github.aakira.napier.Napier
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val TAG = "NutritionViewModel"

class NutritionViewModel(
    private val getActiveMealPlanUseCase: GetActiveMealPlanUseCase,
    private val logMealUseCase: LogMealUseCase,
    private val getMealHistoryUseCase: GetMealHistoryUseCase,
    private val userId: String
) : ViewModel() {

    private val _state = MutableStateFlow(NutritionState())
    val state: StateFlow<NutritionState> = _state.asStateFlow()

    init {
        onIntent(NutritionIntent.LoadMealPlan)
    }

    fun onIntent(intent: NutritionIntent) {
        Napier.d("onIntent: $intent", tag = TAG)
        when (intent) {
            NutritionIntent.LoadMealPlan -> loadMealPlan()
            NutritionIntent.LoadHistory -> loadHistory()
            NutritionIntent.LoadRecipes -> _state.update { it.copy(isRecipesLoading = false) }
            is NutritionIntent.SelectMeal -> selectMeal(intent.mealId)
            is NutritionIntent.LogMeal -> logMeal(intent)
            NutritionIntent.DismissError -> _state.update { it.copy(error = null) }
            NutritionIntent.MealLogged -> _state.update { it.copy(mealLoggedSuccess = false) }
        }
    }

    private fun loadMealPlan() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            getActiveMealPlanUseCase(userId)
                .onSuccess { plan ->
                    _state.update { it.copy(isLoading = false, mealPlan = plan) }
                }
                .onFailure { e ->
                    Napier.e("loadMealPlan failed", e, tag = TAG)
                    _state.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    private fun loadHistory() {
        viewModelScope.launch {
            _state.update { it.copy(isHistoryLoading = true, error = null) }
            getMealHistoryUseCase(userId)
                .onSuccess { logs -> _state.update { it.copy(isHistoryLoading = false, mealHistory = logs) } }
                .onFailure { e ->
                    Napier.e("loadHistory failed", e, tag = TAG)
                    _state.update { it.copy(isHistoryLoading = false, error = e.message) }
                }
        }
    }

    private fun selectMeal(mealId: String) {
        val meal = _state.value.mealPlan?.meals?.firstOrNull { it.id == mealId }
        _state.update { it.copy(selectedMeal = meal) }
    }

    private fun logMeal(intent: NutritionIntent.LogMeal) {
        viewModelScope.launch {
            _state.update { it.copy(isLogging = true, error = null) }
            logMealUseCase(userId, intent.mealName, intent.foods, intent.notes)
                .onSuccess {
                    Napier.i("Meal logged: ${intent.mealName}", tag = TAG)
                    _state.update { it.copy(isLogging = false, mealLoggedSuccess = true) }
                }
                .onFailure { e ->
                    Napier.e("logMeal failed", e, tag = TAG)
                    _state.update { it.copy(isLogging = false, error = e.message) }
                }
        }
    }
}
```

- [ ] **Step 4: Run the failing test — must pass now**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.NutritionViewModelTest.loadMealPlan failure shows error state not mock data"`
Expected: PASS

- [ ] **Step 5: Commit the fix**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModel.kt
git commit -m "fix: NutritionViewModel removes MockData fallbacks and delay simulation"
```

---

## Task 7: Nutrition — Repository, UseCase & ViewModel Tests (complete)

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/MealRepositoryImplTest.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/nutrition/NutritionUseCasesTest.kt`
- Modify: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/nutrition/NutritionViewModelTest.kt`

- [ ] **Step 1: Create MealRepositoryImplTest**

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.MealRemoteDataSource
import com.coachfoska.app.data.remote.dto.MealLogDto
import com.coachfoska.app.data.remote.dto.MealLogFoodDto
import com.coachfoska.app.data.remote.dto.MealLogFoodInsertDto
import com.coachfoska.app.data.remote.dto.MealPlanDto
import com.coachfoska.app.domain.model.MealLogFood
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MealRepositoryImplTest {

    private val dataSource: MealRemoteDataSource = mockk()
    private val repository = MealRepositoryImpl(dataSource)

    @Test
    fun `getActiveMealPlan returns null when data source returns null`() = runTest {
        coEvery { dataSource.getActiveMealPlan(any()) } returns null

        val result = repository.getActiveMealPlan("user-1")

        assertTrue(result.isSuccess)
        assertNull(result.getOrThrow())
    }

    @Test
    fun `getActiveMealPlan maps DTO to domain`() = runTest {
        val dto = MealPlanDto(id = "mp-1", name = "Week 1 Plan")
        coEvery { dataSource.getActiveMealPlan("user-1") } returns dto

        val result = repository.getActiveMealPlan("user-1")

        assertTrue(result.isSuccess)
        assertEquals("mp-1", result.getOrThrow()?.id)
        assertEquals("Week 1 Plan", result.getOrThrow()?.name)
    }

    @Test
    fun `logMeal with foods calls insertMealLogFoods`() = runTest {
        val logDto = aMealLogDto()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto
        coEvery { dataSource.insertMealLogFoods(any()) } returns listOf(aMealLogFoodDto())
        val foods = listOf(aMealLogFood())

        val result = repository.logMeal("user-1", "Lunch", foods, null)

        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { dataSource.insertMealLogFoods(any()) }
    }

    @Test
    fun `logMeal with empty foods skips insertMealLogFoods`() = runTest {
        val logDto = aMealLogDto()
        coEvery { dataSource.insertMealLog(any(), any(), any(), any()) } returns logDto

        repository.logMeal("user-1", "Lunch", emptyList(), null)

        coVerify(exactly = 0) { dataSource.insertMealLogFoods(any()) }
    }

    @Test
    fun `getDailyNutritionSummary aggregates calories from meal logs`() = runTest {
        val foodDto = aMealLogFoodDto(calories = 500f, proteinG = 40f, carbsG = 50f, fatG = 20f)
        val logDto = aMealLogDto(foods = listOf(foodDto))
        coEvery { dataSource.getMealLogsByDate(any(), any()) } returns listOf(logDto, logDto)

        val result = repository.getDailyNutritionSummary("user-1", LocalDate.parse("2026-04-03"))

        assertTrue(result.isSuccess)
        val summary = result.getOrThrow()
        assertEquals(1000f, summary.calories)
        assertEquals(80f, summary.proteinG)
        assertEquals(100f, summary.carbsG)
        assertEquals(40f, summary.fatG)
    }
}

private fun aMealLogDto(foods: List<MealLogFoodDto> = emptyList()) = MealLogDto(
    id = "log-1", userId = "user-1", mealName = "Lunch",
    loggedAt = "2026-04-03T12:00:00Z", foods = foods
)

private fun aMealLogFoodDto(
    calories: Float = 300f,
    proteinG: Float = 25f,
    carbsG: Float = 30f,
    fatG: Float = 10f
) = MealLogFoodDto(
    id = "food-1", mealLogId = "log-1", name = "Chicken",
    amountGrams = 150f, calories = calories, proteinG = proteinG, carbsG = carbsG, fatG = fatG
)

private fun aMealLogFood() = MealLogFood(
    id = "food-1", mealLogId = "log-1", name = "Chicken",
    amountGrams = 150f, calories = 300f, proteinG = 25f, carbsG = 30f, fatG = 10f
)
```

- [ ] **Step 2: Create NutritionUseCasesTest**

```kotlin
package com.coachfoska.app.domain.usecase.nutrition

import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NutritionUseCasesTest {

    private val repo: MealRepository = mockk()

    @Test
    fun `GetActiveMealPlanUseCase delegates to repository`() = runTest {
        val plan = aMealPlan()
        coEvery { repo.getActiveMealPlan("user-1") } returns Result.success(plan)

        val result = GetActiveMealPlanUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals("mp-1", result.getOrThrow()?.id)
    }

    @Test
    fun `LogMealUseCase delegates to repository`() = runTest {
        val log = aMealLog()
        // imageBytes defaults to null; Kotlin passes all 5 args at call site
        coEvery { repo.logMeal(any(), any(), any(), any(), isNull()) } returns Result.success(log)

        val result = LogMealUseCase(repo)("user-1", "Lunch", emptyList(), null)

        assertTrue(result.isSuccess)
        coVerify { repo.logMeal("user-1", "Lunch", emptyList(), null, null) }
    }

    @Test
    fun `GetMealHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getMealHistory("user-1") } returns Result.success(listOf(aMealLog()))

        val result = GetMealHistoryUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }
}

private fun aMealPlan() = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = emptyList(),
    validFrom = null, validTo = null
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)
```

- [ ] **Step 3: Expand NutritionViewModelTest with full coverage**

Replace the contents of `NutritionViewModelTest.kt`:

```kotlin
package com.coachfoska.app.presentation.nutrition

import com.coachfoska.app.domain.model.Meal
import com.coachfoska.app.domain.model.MealLog
import com.coachfoska.app.domain.model.MealPlan
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.usecase.nutrition.GetActiveMealPlanUseCase
import com.coachfoska.app.domain.usecase.nutrition.GetMealHistoryUseCase
import com.coachfoska.app.domain.usecase.nutrition.LogMealUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.datetime.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class NutritionViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val repo: MealRepository = mockk()

    private fun viewModel() = NutritionViewModel(
        getActiveMealPlanUseCase = GetActiveMealPlanUseCase(repo),
        logMealUseCase = LogMealUseCase(repo),
        getMealHistoryUseCase = GetMealHistoryUseCase(repo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadMealPlan success populates mealPlan`() = runTest {
        val plan = aMealPlan()
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(plan)

        val vm = viewModel()

        assertEquals(plan, vm.state.value.mealPlan)
        assertNull(vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadMealPlan success with null plan leaves mealPlan null`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)

        val vm = viewModel()

        assertNull(vm.state.value.mealPlan)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadMealPlan failure shows error state not mock data`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.mealPlan)
    }

    @Test
    fun `selectMeal by id sets selectedMeal`() = runTest {
        val meal = aMeal()
        val plan = aMealPlan(meals = listOf(meal))
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(plan)
        val vm = viewModel()

        vm.onIntent(NutritionIntent.SelectMeal("meal-1"))

        assertEquals(meal, vm.state.value.selectedMeal)
    }

    @Test
    fun `logMeal success sets mealLoggedSuccess true`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.logMeal(any(), any(), any(), any(), isNull()) } returns Result.success(aMealLog())
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LogMeal("Lunch", emptyList(), null))

        assertTrue(vm.state.value.mealLoggedSuccess)
        assertFalse(vm.state.value.isLogging)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `logMeal failure sets error`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.success(null)
        coEvery { repo.logMeal(any(), any(), any(), any(), any()) } returns Result.failure(RuntimeException("Log failed"))
        val vm = viewModel()

        vm.onIntent(NutritionIntent.LogMeal("Lunch", emptyList(), null))

        assertEquals("Log failed", vm.state.value.error)
        assertFalse(vm.state.value.isLogging)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { repo.getActiveMealPlan(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()

        vm.onIntent(NutritionIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}

private fun aMealPlan(meals: List<Meal> = emptyList()) = MealPlan(
    id = "mp-1", name = "Week 1", description = null, meals = meals,
    validFrom = null, validTo = null
)

private fun aMeal() = Meal(
    id = "meal-1", mealPlanId = "mp-1", name = "Lunch",
    timeOfDay = "12:00", sortOrder = 0, foods = emptyList()
)

private fun aMealLog() = MealLog(
    id = "log-1", userId = "user-1", mealName = "Lunch", notes = null,
    foods = emptyList(), loggedAt = Instant.parse("2026-04-03T12:00:00Z")
)
```

- [ ] **Step 4: Run all nutrition tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.MealRepositoryImplTest" --tests "*.NutritionUseCasesTest" --tests "*.NutritionViewModelTest"`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add Nutrition Repository, UseCase, and ViewModel tests"
```

---

## Task 8: Profile — Repository, UseCase & ViewModel Tests

**Files:**
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/data/repository/UserRepositoryImplTest.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/domain/usecase/profile/ProfileUseCasesTest.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/profile/ProfileViewModelTest.kt`

- [ ] **Step 1: Create UserRepositoryImplTest**

```kotlin
package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.UserRemoteDataSource
import com.coachfoska.app.data.remote.dto.UserDto
import com.coachfoska.app.data.remote.dto.WeightEntryDto
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class UserRepositoryImplTest {

    private val dataSource: UserRemoteDataSource = mockk()
    private val repository = UserRepositoryImpl(dataSource)

    @Test
    fun `getProfile maps UserDto to domain User`() = runTest {
        val dto = UserDto(id = "user-1", email = "test@example.com", fullName = "Alice",
            goal = "muscle_gain", activityLevel = "moderately_active", onboardingComplete = true)
        coEvery { dataSource.getProfile("user-1") } returns dto

        val result = repository.getProfile("user-1")

        assertTrue(result.isSuccess)
        val user = result.getOrThrow()
        assertEquals("user-1", user.id)
        assertEquals("Alice", user.fullName)
        assertEquals(UserGoal.MUSCLE_GAIN, user.goal)
        assertEquals(ActivityLevel.MODERATELY_ACTIVE, user.activityLevel)
        assertTrue(user.onboardingComplete)
    }

    @Test
    fun `getProfile propagates data source exception`() = runTest {
        coEvery { dataSource.getProfile(any()) } throws RuntimeException("Not found")

        val result = repository.getProfile("user-1")

        assertTrue(result.isFailure)
        assertEquals("Not found", result.exceptionOrNull()?.message)
    }

    @Test
    fun `updateProfile merges fields and upserts`() = runTest {
        val existing = UserDto(id = "user-1", email = "test@example.com", fullName = "Alice")
        val updated = existing.copy(fullName = "Bob", weightKg = 80f)
        coEvery { dataSource.getProfile("user-1") } returns existing andThen updated
        coEvery { dataSource.upsertProfile(any()) } returns Unit

        val result = repository.updateProfile("user-1", fullName = "Bob", weightKg = 80f)

        assertTrue(result.isSuccess)
        coVerify { dataSource.upsertProfile(match { it.fullName == "Bob" && it.weightKg == 80f }) }
    }

    @Test
    fun `getWeightHistory maps DTOs to domain WeightEntries`() = runTest {
        val dto = WeightEntryDto(id = "we-1", userId = "user-1", weightKg = 75f, recordedAt = "2026-04-03")
        coEvery { dataSource.getWeightHistory("user-1") } returns listOf(dto)

        val result = repository.getWeightHistory("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals(75f, result.getOrThrow()[0].weightKg)
        assertEquals(LocalDate.parse("2026-04-03"), result.getOrThrow()[0].recordedAt)
    }

    @Test
    fun `logWeight inserts entry and maps to domain`() = runTest {
        val dto = WeightEntryDto(id = "we-1", userId = "user-1", weightKg = 74f, recordedAt = "2026-04-03")
        coEvery { dataSource.insertWeightEntry("user-1", 74f, LocalDate.parse("2026-04-03"), null) } returns dto

        val result = repository.logWeight("user-1", 74f, LocalDate.parse("2026-04-03"), null)

        assertTrue(result.isSuccess)
        assertEquals(74f, result.getOrThrow().weightKg)
    }
}
```

- [ ] **Step 2: Create ProfileUseCasesTest**

```kotlin
package com.coachfoska.app.domain.usecase.profile

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.auth.aUser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProfileUseCasesTest {

    private val repo: UserRepository = mockk()

    @Test
    fun `GetUserProfileUseCase delegates to repository`() = runTest {
        coEvery { repo.getProfile("user-1") } returns Result.success(aUser())

        val result = GetUserProfileUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        coVerify { repo.getProfile("user-1") }
    }

    @Test
    fun `UpdateUserProfileUseCase delegates to repository with all parameters`() = runTest {
        coEvery { repo.updateProfile(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(aUser())

        val result = UpdateUserProfileUseCase(repo)(
            userId = "user-1",
            fullName = "Alice",
            heightCm = 170f,
            weightKg = 65f,
            goal = UserGoal.WEIGHT_LOSS,
            activityLevel = ActivityLevel.LIGHTLY_ACTIVE
        )

        assertTrue(result.isSuccess)
        coVerify { repo.updateProfile("user-1", "Alice", null, 170f, 65f, UserGoal.WEIGHT_LOSS, ActivityLevel.LIGHTLY_ACTIVE) }
    }

    @Test
    fun `GetWeightHistoryUseCase delegates to repository`() = runTest {
        coEvery { repo.getWeightHistory("user-1") } returns Result.success(listOf(aWeightEntry()))

        val result = GetWeightHistoryUseCase(repo)("user-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
    }

    @Test
    fun `LogWeightUseCase delegates to repository`() = runTest {
        val entry = aWeightEntry()
        val date = LocalDate.parse("2026-04-03")
        coEvery { repo.logWeight("user-1", 74f, date, null) } returns Result.success(entry)

        val result = LogWeightUseCase(repo)("user-1", 74f, date, null)

        assertTrue(result.isSuccess)
        coVerify { repo.logWeight("user-1", 74f, date, null) }
    }
}

private fun aWeightEntry() = WeightEntry(
    id = "we-1", userId = "user-1", weightKg = 74f,
    recordedAt = LocalDate.parse("2026-04-03")
)
```

- [ ] **Step 3: Create ProfileViewModelTest**

```kotlin
package com.coachfoska.app.presentation.profile

import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.AuthRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.auth.SignOutUseCase
import com.coachfoska.app.domain.usecase.auth.aUser
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.profile.GetWeightHistoryUseCase
import com.coachfoska.app.domain.usecase.profile.LogWeightUseCase
import com.coachfoska.app.domain.usecase.profile.UpdateUserProfileUseCase
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val userRepo: UserRepository = mockk()
    private val authRepo: AuthRepository = mockk()

    private fun viewModel() = ProfileViewModel(
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        updateUserProfileUseCase = UpdateUserProfileUseCase(userRepo),
        getWeightHistoryUseCase = GetWeightHistoryUseCase(userRepo),
        logWeightUseCase = LogWeightUseCase(userRepo),
        signOutUseCase = SignOutUseCase(authRepo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadProfile success populates user`() = runTest {
        val user = aUser()
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)

        val vm = viewModel()

        assertEquals(user, vm.state.value.user)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadProfile failure sets error`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.failure(RuntimeException("Not found"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertNull(vm.state.value.user)
    }

    @Test
    fun `updateProfile success updates user in state`() = runTest {
        val user = aUser()
        val updatedUser = user.copy(fullName = "Updated Name")
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)
        coEvery { userRepo.updateProfile(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(updatedUser)
        val vm = viewModel()

        vm.onIntent(ProfileIntent.UpdateProfile("Updated Name", null, null, null, null))

        assertEquals("Updated Name", vm.state.value.user?.fullName)
        assertFalse(vm.state.value.isSavingProfile)
    }

    @Test
    fun `logWeight success prepends entry to history`() = runTest {
        val entry = WeightEntry("we-1", "user-1", 74f, LocalDate.parse("2026-04-03"))
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { userRepo.logWeight(any(), any(), any(), any()) } returns Result.success(entry)
        val vm = viewModel()

        vm.onIntent(ProfileIntent.LogWeight(74f, LocalDate.parse("2026-04-03"), null))

        assertEquals(1, vm.state.value.weightHistory.size)
        assertEquals(74f, vm.state.value.weightHistory[0].weightKg)
    }

    @Test
    fun `signOut success sets signedOut true`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { authRepo.signOut() } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(ProfileIntent.SignOut)

        assertTrue(vm.state.value.signedOut)
        assertFalse(vm.state.value.isSigningOut)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()
        assertNotNull(vm.state.value.error)

        vm.onIntent(ProfileIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}
```

- [ ] **Step 4: Run all profile tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.UserRepositoryImplTest" --tests "*.ProfileUseCasesTest" --tests "*.ProfileViewModelTest"`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add composeApp/src/androidUnitTest/
git commit -m "test: add Profile Repository, UseCase, and ViewModel tests"
```

---

## Task 9: Fix HomeViewModel & Add Tests

**Files:**
- Modify: `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`
- Create: `composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/presentation/home/HomeViewModelTest.kt`

- [ ] **Step 1: Write failing test that proves the bug**

Create `HomeViewModelTest.kt`:

```kotlin
package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.auth.aUser
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val userRepo: UserRepository = mockk()
    private val workoutRepo: WorkoutRepository = mockk()
    private val mealRepo: MealRepository = mockk()

    private fun viewModel() = HomeViewModel(
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(mealRepo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData with profile failure surfaces error to state`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.failure(RuntimeException("Unauthorized"))
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
    }
}
```

- [ ] **Step 2: Run failing test**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.HomeViewModelTest.loadData with profile failure surfaces error to state"`
Expected: FAIL — `error` is null (failure is swallowed)

- [ ] **Step 3: Fix HomeViewModel — surface errors to state**

Replace the `loadData` function in `composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt`:

```kotlin
private fun loadData() {
    viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        val today = todayDate()
        val todayDayOfWeek = currentInstant()
            .toLocalDateTime(TimeZone.currentSystemDefault())
            .dayOfWeek
            .ordinal

        val profileDeferred = async { getUserProfileUseCase(userId) }
        val workoutsDeferred = async { getAssignedWorkoutsUseCase(userId) }
        val nutritionDeferred = async { getDailyNutritionSummaryUseCase(userId, today) }

        val profileResult = profileDeferred.await()
        val workoutsResult = workoutsDeferred.await()
        val nutritionResult = nutritionDeferred.await()

        profileResult.onFailure { e -> Napier.e("loadProfile failed", e, tag = TAG) }
        workoutsResult.onFailure { e -> Napier.e("loadWorkouts failed", e, tag = TAG) }
        nutritionResult.onFailure { e -> Napier.e("loadNutrition failed", e, tag = TAG) }

        val error = profileResult.exceptionOrNull()?.message
            ?: workoutsResult.exceptionOrNull()?.message
            ?: nutritionResult.exceptionOrNull()?.message

        val workouts = workoutsResult.getOrNull() ?: emptyList()
        val todayWorkout = workouts.firstOrNull { it.dayOfWeek?.index == todayDayOfWeek }

        _state.update {
            it.copy(
                isLoading = false,
                user = profileResult.getOrNull(),
                todayWorkout = todayWorkout,
                nutritionSummary = nutritionResult.getOrNull(),
                error = error
            )
        }
    }
}
```

- [ ] **Step 4: Run failing test — must pass now**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.HomeViewModelTest.loadData with profile failure surfaces error to state"`
Expected: PASS

- [ ] **Step 5: Expand HomeViewModelTest with full coverage**

Replace the contents of `HomeViewModelTest.kt`:

```kotlin
package com.coachfoska.app.presentation.home

import com.coachfoska.app.domain.model.DailyNutritionSummary
import com.coachfoska.app.domain.model.DayOfWeek
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.repository.MealRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.auth.aUser
import com.coachfoska.app.domain.usecase.nutrition.GetDailyNutritionSummaryUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val userRepo: UserRepository = mockk()
    private val workoutRepo: WorkoutRepository = mockk()
    private val mealRepo: MealRepository = mockk()

    private fun viewModel() = HomeViewModel(
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
        getDailyNutritionSummaryUseCase = GetDailyNutritionSummaryUseCase(mealRepo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData success populates all state fields`() = runTest {
        val user = aUser()
        val nutrition = DailyNutritionSummary(2000f, 150f, 200f, 80f)
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(nutrition)

        val vm = viewModel()

        assertEquals(user, vm.state.value.user)
        assertEquals(nutrition, vm.state.value.nutritionSummary)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadData with profile failure surfaces error to state`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.failure(RuntimeException("Unauthorized"))
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `loadData with workouts failure surfaces error to state`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Workouts unavailable"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `loadData partial failure still populates available data`() = runTest {
        val user = aUser()
        coEvery { userRepo.getProfile(any()) } returns Result.success(user)
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("err"))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())

        val vm = viewModel()

        assertEquals(user, vm.state.value.user) // profile loaded despite workout failure
        assertNull(vm.state.value.todayWorkout)
        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `loadData filters today workout by day of week index`() = runTest {
        // Note: this test verifies the filter logic; the actual day index depends on system time,
        // so we verify that only matching day workouts appear in todayWorkout.
        // We use a workout with dayOfWeek = null which should never match today.
        val workoutNoDay = Workout(id = "w1", name = "Anytime", dayOfWeek = null, durationMinutes = 60, exercises = emptyList())
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(listOf(workoutNoDay))
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())

        val vm = viewModel()

        assertNull(vm.state.value.todayWorkout) // null dayOfWeek never matches
    }

    @Test
    fun `Refresh intent triggers reload`() = runTest {
        coEvery { userRepo.getProfile(any()) } returns Result.success(aUser())
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { mealRepo.getDailyNutritionSummary(any(), any()) } returns Result.success(mockk())
        val vm = viewModel()

        vm.onIntent(HomeIntent.Refresh)

        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }
}
```

- [ ] **Step 6: Run all home tests**

Run: `./gradlew :composeApp:testDebugUnitTest --tests "*.HomeViewModelTest"`
Expected: All 6 tests PASS

- [ ] **Step 7: Commit fix + tests together**

```bash
git add composeApp/src/commonMain/kotlin/com/coachfoska/app/presentation/home/HomeViewModel.kt \
        composeApp/src/androidUnitTest/
git commit -m "fix+test: HomeViewModel surfaces errors to state, add full test coverage"
```

---

## Task 10: Full Test Suite Green Check

- [ ] **Step 1: Run the complete test suite**

Run: `./gradlew :composeApp:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, all tests PASS, 0 failures

- [ ] **Step 2: Commit final status if any minor fixes were needed**

```bash
git add -A
git commit -m "test: all unit tests passing"
```

---

## Summary

| Domain | Fixed Issues | Tests Added |
|--------|-------------|-------------|
| Auth | — | SendOtpUseCase, VerifyOtpUseCase, AuthViewModel |
| Workout | MockData fallbacks, selectWorkoutLog side effect | WorkoutRepositoryImpl, WorkoutUseCases, WorkoutViewModel |
| Nutrition | MockData fallback, delay(500) simulation | MealRepositoryImpl, NutritionUseCases, NutritionViewModel |
| Profile | — | UserRepositoryImpl, ProfileUseCases, ProfileViewModel |
| Home | Silent error swallowing | HomeViewModel |
