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
