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
import com.coachfoska.app.domain.usecase.checkin.RemoveCheckInPhotosUseCase
import com.coachfoska.app.domain.usecase.profile.GetUserProfileUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.slot
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

    private fun viewModel(prefillExisting: Boolean = true) = CheckInViewModel(
        submitCheckInUseCase = SubmitCheckInUseCase(checkInRepo, userRepo),
        getCheckInHistoryUseCase = GetCheckInHistoryUseCase(checkInRepo),
        getCurrentWeekCheckInUseCase = GetCurrentWeekCheckInUseCase(checkInRepo),
        uploadCheckInPhotoUseCase = UploadCheckInPhotoUseCase(checkInRepo),
        removeCheckInPhotosUseCase = RemoveCheckInPhotosUseCase(checkInRepo),
        getUserProfileUseCase = GetUserProfileUseCase(userRepo),
        userId = "u1",
        prefillExisting = prefillExisting,
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
        coEvery { checkInRepo.removePhotos(any()) } returns Result.success(Unit)
    }

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `load prefills weight from profile`() = runTest {
        val vm = viewModel()
        assertEquals("80.0", vm.state.value.form.weightKg)
    }

    @Test
    fun `load prefills existing weekly check-in by default`() = runTest {
        coEvery { checkInRepo.getForWeek(any(), any()) } returns Result.success(
            CheckIn(
                id = "ci1",
                userId = "u1",
                weekOf = com.coachfoska.app.core.util.todayDate(),
                weightKg = 81f,
                energyLevel = 4,
                notes = "felt good",
            )
        )

        val vm = viewModel()

        assertEquals("81.0", vm.state.value.form.weightKg)
        assertEquals(4, vm.state.value.form.energyLevel)
        assertEquals("felt good", vm.state.value.form.notes)
    }

    @Test
    fun `load keeps form empty when prefill is disabled`() = runTest {
        coEvery { checkInRepo.getForWeek(any(), any()) } returns Result.success(
            CheckIn(
                id = "ci1",
                userId = "u1",
                weekOf = com.coachfoska.app.core.util.todayDate(),
                weightKg = 81f,
                energyLevel = 4,
                notes = "felt good",
            )
        )

        val vm = viewModel(prefillExisting = false)

        assertEquals("", vm.state.value.form.weightKg)
        assertEquals(null, vm.state.value.form.energyLevel)
        assertEquals("", vm.state.value.form.notes)
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

    @Test
    fun `selecting a photo defers upload until submit`() = runTest {
        val vm = viewModel(prefillExisting = false)

        vm.onIntent(CheckInIntent.PhotoPicked("front", byteArrayOf(1, 2, 3)))

        assertTrue("front" in vm.state.value.selectedPhotoSlots)
        coVerify(exactly = 0) { checkInRepo.uploadPhoto(any(), any(), any(), any()) }
    }

    @Test
    fun `submit uploads selected photos before persisting their paths`() = runTest {
        val submitted = slot<CheckIn>()
        coEvery { checkInRepo.uploadPhoto("u1", any(), "front", any()) } answers {
            Result.success("u1/checkin_${secondArg<kotlinx.datetime.LocalDate>()}_front.jpg")
        }
        coEvery { checkInRepo.submit(capture(submitted)) } answers {
            Result.success(submitted.captured.copy(id = "ci1"))
        }
        val vm = viewModel(prefillExisting = false)
        vm.onIntent(CheckInIntent.PhotoPicked("front", byteArrayOf(1, 2, 3)))

        vm.onIntent(CheckInIntent.Submit)

        assertTrue(vm.state.value.submitted)
        assertTrue(submitted.captured.photoFrontPath?.endsWith("_front.jpg") == true)
        coVerify(exactly = 0) { checkInRepo.removePhotos(any()) }
    }

    @Test
    fun `a failed second upload removes only the new first object`() = runTest {
        coEvery { checkInRepo.uploadPhoto("u1", any(), "front", any()) } answers {
            Result.success("u1/checkin_${secondArg<kotlinx.datetime.LocalDate>()}_front.jpg")
        }
        coEvery { checkInRepo.uploadPhoto("u1", any(), "side", any()) } returns
            Result.failure(RuntimeException("side failed"))
        val vm = viewModel(prefillExisting = false)
        vm.onIntent(CheckInIntent.PhotoPicked("front", byteArrayOf(1)))
        vm.onIntent(CheckInIntent.PhotoPicked("side", byteArrayOf(2)))

        vm.onIntent(CheckInIntent.Submit)

        assertEquals("side failed", vm.state.value.error)
        coVerify { checkInRepo.removePhotos(match { it.size == 1 && it.single().endsWith("_front.jpg") }) }
        coVerify(exactly = 0) { checkInRepo.submit(any()) }
    }

    @Test
    fun `failed edit save does not delete a pre-existing referenced object`() = runTest {
        val existingPath = "u1/checkin_${com.coachfoska.app.core.util.currentCheckInWeekMonday()}_front.jpg"
        coEvery { checkInRepo.getForWeek(any(), any()) } returns Result.success(
            CheckIn(
                id = "ci1",
                userId = "u1",
                weekOf = com.coachfoska.app.core.util.currentCheckInWeekMonday(),
                photoFrontPath = existingPath,
            )
        )
        coEvery { checkInRepo.uploadPhoto("u1", any(), "front", any()) } returns Result.success(existingPath)
        coEvery { checkInRepo.submit(any()) } returns Result.failure(RuntimeException("save failed"))
        val vm = viewModel()
        vm.onIntent(CheckInIntent.PhotoPicked("front", byteArrayOf(9)))

        vm.onIntent(CheckInIntent.Submit)

        assertEquals("save failed", vm.state.value.error)
        assertEquals(existingPath, vm.state.value.form.photoFrontPath)
        assertTrue("front" in vm.state.value.selectedPhotoSlots)
        coVerify(exactly = 0) { checkInRepo.removePhotos(any()) }
    }
}
