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
