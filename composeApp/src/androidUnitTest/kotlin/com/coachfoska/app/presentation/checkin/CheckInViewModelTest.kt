package com.coachfoska.app.presentation.checkin

import com.coachfoska.app.domain.model.ActivityLevel
import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.domain.model.FitnessGoal
import com.coachfoska.app.domain.model.User
import com.coachfoska.app.domain.model.WeightEntry
import com.coachfoska.app.domain.repository.CheckInRepository
import com.coachfoska.app.domain.repository.UserRepository
import com.coachfoska.app.domain.usecase.checkin.GetCheckInHistoryUseCase
import com.coachfoska.app.domain.usecase.checkin.GetCurrentWeekCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.SubmitCheckInUseCase
import com.coachfoska.app.domain.usecase.checkin.UploadCheckInPhotoUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
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
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class CheckInViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val checkInRepo: CheckInRepository = mockk(relaxed = true)
    private val userRepo: UserRepository = mockk()

    private val aUser = User(
        id = "u1", email = "a@b.com", fullName = null, age = null,
        heightCm = null, weightKg = 80f, goal = FitnessGoal.BUILD_MUSCLE,
        activityLevel = ActivityLevel.ACTIVE,
    )

    private fun viewModel() = CheckInViewModel(
        submitCheckInUseCase = SubmitCheckInUseCase(checkInRepo, userRepo),
        getCheckInHistoryUseCase = GetCheckInHistoryUseCase(checkInRepo),
        getCurrentWeekCheckInUseCase = GetCurrentWeekCheckInUseCase(checkInRepo),
        uploadCheckInPhotoUseCase = UploadCheckInPhotoUseCase(checkInRepo),
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        userId = "u1",
    )

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        coEvery { userRepo.getProfile("u1") } returns Result.success(aUser)
        coEvery { userRepo.logWeight(any(), any(), any(), any()) } returns Result.success(
            WeightEntry(id = "we1", userId = "u1", weightKg = 80f, recordedAt = com.coachfoska.app.core.util.todayDate(), notes = null)
        )
        coEvery { checkInRepo.getHistory("u1") } returns Result.success(emptyList())
        coEvery { checkInRepo.getForWeek(any(), any()) } returns Result.success(null)
    }

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `load prefills weight from profile`() = runTest {
        val vm = viewModel()
        assertEquals("80.0", vm.state.value.form.weightKg)
    }

    @Test
    fun `energy change updates form`() = runTest {
        val vm = viewModel()
        vm.onIntent(CheckInIntent.EnergyChanged(4))
        assertEquals(4, vm.state.value.form.energyLevel)
    }

    @Test
    fun `submit sets submitted flag on success`() = runTest {
        coEvery { checkInRepo.submit(any()) } returns Result.success(
            CheckIn(id = "ci1", userId = "u1", weekOf = com.coachfoska.app.core.util.todayDate())
        )
        val vm = viewModel()
        vm.onIntent(CheckInIntent.EnergyChanged(3))
        vm.onIntent(CheckInIntent.Submit)
        assertTrue(vm.state.value.submitted)
    }

    @Test
    fun `submit surfaces error on failure`() = runTest {
        coEvery { checkInRepo.submit(any()) } returns Result.failure(RuntimeException("nope"))
        val vm = viewModel()
        vm.onIntent(CheckInIntent.Submit)
        assertEquals("nope", vm.state.value.error)
    }

    @Test
    fun `submit falls back to a generic error when exception message is null`() = runTest {
        coEvery { checkInRepo.submit(any()) } returns Result.failure(RuntimeException(null as String?))
        val vm = viewModel()
        vm.onIntent(CheckInIntent.Submit)
        assertTrue(vm.state.value.error != null)
    }
}
