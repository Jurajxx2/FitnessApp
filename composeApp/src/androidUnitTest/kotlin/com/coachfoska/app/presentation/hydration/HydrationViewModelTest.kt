package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
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
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class HydrationViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val hydrationRepo: HydrationRepository = mockk()
    private val userRepo: UserRepository = mockk()
    private val scheduler: WaterReminderScheduler = mockk(relaxed = true)

    private val aUser = User(
        id = "u1", email = "a@b.com", fullName = null,
        age = null, heightCm = null,
        weightKg = 80f, goal = UserGoal.MUSCLE_GAIN,
        activityLevel = ActivityLevel.ACTIVE
    )

    private fun viewModel() = HydrationViewModel(
        hydrationRepository = hydrationRepo,
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        calculateWaterGoalUseCase = CalculateWaterGoalUseCase(),
        reminderScheduler = scheduler,
        userId = "u1"
    )

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { userRepo.getProfile("u1") } returns Result.success(aUser)
        coEvery { hydrationRepo.getTodayLogs("u1") } returns Result.success(emptyList())
        coEvery { hydrationRepo.getSettings("u1") } returns Result.success(HydrationSettings())
    }

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData sets goalMl from profile`() = runTest {
        val vm = viewModel()
        // 80kg * 35 * 1.3 (ACTIVE) = 3640
        assertEquals(3640, vm.state.value.goalMl)
    }

    @Test
    fun `logWater adds to todayLogs`() = runTest {
        val log = WaterLog("log1", 250, Instant.parse("2026-04-24T10:00:00Z"))
        coEvery { hydrationRepo.logWater("u1", 250) } returns Result.success(log)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.LogWater(250))

        assertEquals(1, vm.state.value.todayLogs.size)
        assertEquals(250, vm.state.value.consumedMl)
    }

    @Test
    fun `deleteLog removes entry from state`() = runTest {
        val log = WaterLog("log1", 500, Instant.parse("2026-04-24T10:00:00Z"))
        coEvery { hydrationRepo.getTodayLogs("u1") } returns Result.success(listOf(log))
        coEvery { hydrationRepo.deleteLog("u1", "log1") } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.DeleteLog("log1"))

        assertTrue(vm.state.value.todayLogs.isEmpty())
    }

    @Test
    fun `updateSettings persists and reschedules reminders`() = runTest {
        val newSettings = HydrationSettings(intervalMinutes = 60, remindersEnabled = true)
        coEvery { hydrationRepo.saveSettings("u1", newSettings) } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.UpdateSettings(newSettings))

        assertEquals(newSettings, vm.state.value.settings)
        verify { scheduler.schedule(newSettings, any()) }
    }

    @Test
    fun `updateSettings with reminders disabled calls cancel`() = runTest {
        val newSettings = HydrationSettings(remindersEnabled = false)
        coEvery { hydrationRepo.saveSettings("u1", newSettings) } returns Result.success(Unit)
        val vm = viewModel()

        vm.onIntent(HydrationIntent.UpdateSettings(newSettings))

        verify { scheduler.cancel() }
    }

    @Test
    fun `showCustomAmountDialog toggles dialog state`() = runTest {
        val vm = viewModel()
        assertFalse(vm.state.value.showCustomAmountDialog)

        vm.onIntent(HydrationIntent.ShowCustomAmountDialog)
        assertTrue(vm.state.value.showCustomAmountDialog)

        vm.onIntent(HydrationIntent.DismissCustomAmountDialog)
        assertFalse(vm.state.value.showCustomAmountDialog)
    }
}
