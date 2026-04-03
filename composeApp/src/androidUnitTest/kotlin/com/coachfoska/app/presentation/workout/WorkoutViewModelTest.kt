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
    fun `loadWorkouts failure shows error state not mock data`() = runTest {
        coEvery { repo.getAssignedWorkouts(any()) } returns Result.failure(RuntimeException("Network error"))

        val vm = viewModel()

        assertNotNull(vm.state.value.error)
        assertEquals("Network error", vm.state.value.error)
        assertTrue(vm.state.value.workouts.isEmpty())
    }
}
