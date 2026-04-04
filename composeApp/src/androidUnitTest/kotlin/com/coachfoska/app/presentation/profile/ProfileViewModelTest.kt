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

        vm.onIntent(ProfileIntent.UpdateProfile(fullName = "Updated Name"))

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
