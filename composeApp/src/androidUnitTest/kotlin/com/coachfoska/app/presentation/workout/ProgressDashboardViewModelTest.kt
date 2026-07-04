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
