package com.coachfoska.app.presentation.hydration

import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterContainer
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.domain.repository.HydrationRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.hydration.AddWaterContainerUseCase
import com.coachfoska.app.domain.usecase.hydration.CalculateWaterGoalUseCase
import com.coachfoska.app.domain.usecase.hydration.DeleteWaterContainerUseCase
import com.coachfoska.app.domain.usecase.hydration.GetWaterContainersUseCase
import com.coachfoska.app.domain.usecase.hydration.ToggleFavoriteWaterContainerUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.UserGoal
import io.mockk.coEvery
import io.mockk.coVerify
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

@OptIn(ExperimentalCoroutinesApi::class)
class HydrationViewModelContainersTest {
    private val testDispatcher = UnconfinedTestDispatcher()

    private val hydrationRepo: HydrationRepository = mockk()
    private val userRepo: UserRepository = mockk()
    private val scheduler: WaterReminderScheduler = mockk(relaxed = true)

    private val sampleContainer = WaterContainer(
        id = "c1", name = "Gym Bottle", volumeMl = 750, iconName = "bottle", isFavorite = true,
    )

    private fun viewModel() = HydrationViewModel(
        hydrationRepository = hydrationRepo,
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        calculateWaterGoalUseCase = CalculateWaterGoalUseCase(),
        getWaterContainersUseCase = GetWaterContainersUseCase(hydrationRepo),
        addWaterContainerUseCase = AddWaterContainerUseCase(hydrationRepo),
        deleteWaterContainerUseCase = DeleteWaterContainerUseCase(hydrationRepo),
        toggleFavoriteWaterContainerUseCase = ToggleFavoriteWaterContainerUseCase(hydrationRepo),
        reminderScheduler = scheduler,
        userId = "u1",
    )

    private val aUser = User(
        id = "u1", email = "a@b.com", fullName = null,
        age = null, heightCm = null,
        weightKg = 70f, goal = UserGoal.WEIGHT_LOSS,
        activityLevel = ActivityLevel.SEDENTARY,
    )

    @BeforeTest fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { userRepo.getProfile("u1") } returns Result.success(aUser)
        coEvery { hydrationRepo.getTodayLogs("u1") } returns Result.success(emptyList())
        coEvery { hydrationRepo.getSettings("u1") } returns Result.success(HydrationSettings())
        coEvery { hydrationRepo.getContainers("u1") } returns Result.success(listOf(sampleContainer))
    }

    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `loadData populates containers`() = runTest {
        val vm = viewModel()
        assertEquals(listOf(sampleContainer), vm.state.value.containers)
    }

    @Test
    fun `LogFromContainer logs the container volume`() = runTest {
        val now = Instant.parse("2026-05-22T10:00:00Z")
        coEvery { hydrationRepo.logWater("u1", 750) } returns Result.success(
            WaterLog(id = "log1", amountMl = 750, loggedAt = now),
        )
        // viewModel created AFTER mocks are set; loadData uses setUp's getTodayLogs (empty list)
        val vm = viewModel()
        vm.onIntent(HydrationIntent.LogFromContainer("c1"))
        coVerify { hydrationRepo.logWater("u1", 750) }
        // ViewModel prepends the log to state optimistically
        assertEquals(750, vm.state.value.consumedMl)
    }

    @Test
    fun `DeleteContainer removes it from state`() = runTest {
        coEvery { hydrationRepo.deleteContainer("c1") } returns Result.success(Unit)
        coEvery { hydrationRepo.getContainers("u1") } returnsMany listOf(
            Result.success(listOf(sampleContainer)),
            Result.success(emptyList()),
        )
        val vm = viewModel()
        vm.onIntent(HydrationIntent.DeleteContainer("c1"))
        assertEquals(emptyList<WaterContainer>(), vm.state.value.containers)
    }
}
