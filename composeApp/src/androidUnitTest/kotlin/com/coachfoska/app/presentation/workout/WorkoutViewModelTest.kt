package com.coachfoska.app.presentation.workout

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.model.GeneralActivityLog
import com.coachfoska.app.domain.model.Workout
import com.coachfoska.app.domain.model.WorkoutLog
import com.coachfoska.app.domain.repository.ActivityRepository
import com.coachfoska.app.domain.repository.WorkoutRepository
import com.coachfoska.app.domain.usecase.activity.GetActivityHistoryUseCase
import com.coachfoska.app.domain.usecase.activity.LogGeneralActivityUseCase
import com.coachfoska.app.domain.usecase.workout.GetAssignedWorkoutsUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutByIdUseCase
import com.coachfoska.app.domain.usecase.workout.GetWorkoutHistoryUseCase
import com.coachfoska.app.domain.usecase.workout.LogWorkoutUseCase
import com.coachfoska.app.fixtures.aGeneralActivityLog
import com.coachfoska.app.fixtures.aWorkout
import com.coachfoska.app.fixtures.aWorkoutLog
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
    private val workoutRepo: WorkoutRepository = mockk()
    private val activityRepo: ActivityRepository = mockk()

    private fun viewModel() = WorkoutViewModel(
        getAssignedWorkoutsUseCase = GetAssignedWorkoutsUseCase(workoutRepo),
        getWorkoutByIdUseCase = GetWorkoutByIdUseCase(workoutRepo),
        logWorkoutUseCase = LogWorkoutUseCase(workoutRepo),
        getWorkoutHistoryUseCase = GetWorkoutHistoryUseCase(workoutRepo),
        logGeneralActivityUseCase = LogGeneralActivityUseCase(activityRepo),
        getActivityHistoryUseCase = GetActivityHistoryUseCase(activityRepo),
        userId = "user-1"
    )

    @BeforeTest fun setUp() = Dispatchers.setMain(testDispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadWorkouts success populates workouts list`() = runTest {
        val workouts = listOf(aWorkout(id = "w1"))
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(workouts)

        val vm = viewModel()

        assertEquals(1, vm.state.value.workouts.size)
        assertEquals("w1", vm.state.value.workouts[0].id)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `loadWorkouts failure shows error state`() = runTest {
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertEquals("Network error", vm.state.value.error)
    }

    @Test
    fun `logWorkout success sets workoutLoggedSuccess true`() = runTest {
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.logWorkout(any(), any(), any(), any(), any(), any()) } returns Result.success(aWorkoutLog())
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(emptyList())
        val vm = viewModel()

        vm.onIntent(WorkoutIntent.LogWorkout("w1", "Push Day", 60, null, emptyList()))

        assertTrue(vm.state.value.workoutLoggedSuccess)
    }

    @Test
    fun `selectWorkoutLog found in history sets selectedWorkoutLog`() = runTest {
        val log = aWorkoutLog(id = "log-1")
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { workoutRepo.getWorkoutHistory(any()) } returns Result.success(listOf(log))
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.LoadHistory)

        vm.onIntent(WorkoutIntent.SelectWorkoutLog("log-1"))

        assertEquals(log, vm.state.value.selectedWorkoutLog)
    }

    @Test
    fun `logGeneralActivity success sets success state and reloads history`() = runTest {
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { activityRepo.logActivity(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(aGeneralActivityLog())
        coEvery { activityRepo.getActivityHistory(any()) } returns Result.success(emptyList())
        
        val vm = viewModel()
        vm.onIntent(WorkoutIntent.LogGeneralActivity(ActivityType.RUNNING, 30, 5.0, 7, null))

        assertTrue(vm.state.value.workoutLoggedSuccess)
        assertFalse(vm.state.value.isLogging)
    }

    @Test
    fun `loadActivityHistory success populates activityHistory`() = runTest {
        val logs = listOf(aGeneralActivityLog(id = "a1"))
        coEvery { workoutRepo.getAssignedWorkouts(any()) } returns Result.success(emptyList())
        coEvery { activityRepo.getActivityHistory(any()) } returns Result.success(logs)

        val vm = viewModel()
        vm.onIntent(WorkoutIntent.LoadActivityHistory)

        assertEquals(1, vm.state.value.activityHistory.size)
        assertEquals("a1", vm.state.value.activityHistory[0].id)
    }
}
