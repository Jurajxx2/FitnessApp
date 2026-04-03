package com.coachfoska.app.presentation.auth

import com.coachfoska.app.domain.usecase.auth.SendOtpUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithAppleUseCase
import com.coachfoska.app.domain.usecase.auth.SignInWithGoogleUseCase
import com.coachfoska.app.domain.usecase.auth.VerifyOtpUseCase
import com.coachfoska.app.domain.usecase.auth.aUser
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val sendOtpUseCase: SendOtpUseCase = mockk()
    private val verifyOtpUseCase: VerifyOtpUseCase = mockk()
    private val signInWithGoogleUseCase: SignInWithGoogleUseCase = mockk()
    private val signInWithAppleUseCase: SignInWithAppleUseCase = mockk()

    private fun viewModel() = AuthViewModel(
        sendOtpUseCase, verifyOtpUseCase, signInWithGoogleUseCase, signInWithAppleUseCase
    )

    @BeforeTest
    fun setUp() = Dispatchers.setMain(testDispatcher)

    @AfterTest
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `initial state is empty`() {
        val vm = viewModel()
        assertEquals("", vm.state.value.email)
        assertEquals("", vm.state.value.otp)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `EmailChanged updates email and clears error`() {
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))
        assertEquals("test@example.com", vm.state.value.email)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `OtpChanged updates otp`() {
        val vm = viewModel()
        vm.onIntent(AuthIntent.OtpChanged("123456"))
        assertEquals("123456", vm.state.value.otp)
    }

    @Test
    fun `sendOtp success sets otpSent true and clears loading`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.success(Unit)
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))

        vm.onIntent(AuthIntent.SendOtp)

        assertTrue(vm.state.value.otpSent)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `sendOtp failure sets error message`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.failure(RuntimeException("Network error"))
        val vm = viewModel()
        vm.onIntent(AuthIntent.EmailChanged("test@example.com"))

        vm.onIntent(AuthIntent.SendOtp)

        assertFalse(vm.state.value.otpSent)
        assertFalse(vm.state.value.isLoading)
        assertEquals("Network error", vm.state.value.error)
    }

    @Test
    fun `verifyOtp success with onboarding complete navigates to home`() = runTest {
        val user = aUser(onboardingComplete = true)
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.success(user)
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertTrue(vm.state.value.navigateToHome)
        assertFalse(vm.state.value.navigateToOnboarding)
        assertEquals(user, vm.state.value.authenticatedUser)
    }

    @Test
    fun `verifyOtp success with onboarding incomplete navigates to onboarding`() = runTest {
        val user = aUser(onboardingComplete = false)
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.success(user)
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertFalse(vm.state.value.navigateToHome)
        assertTrue(vm.state.value.navigateToOnboarding)
    }

    @Test
    fun `verifyOtp failure sets error message`() = runTest {
        coEvery { verifyOtpUseCase(any(), any()) } returns Result.failure(RuntimeException("Invalid OTP"))
        val vm = viewModel()

        vm.onIntent(AuthIntent.VerifyOtp)

        assertEquals("Invalid OTP", vm.state.value.error)
        assertFalse(vm.state.value.isLoading)
        assertNull(vm.state.value.authenticatedUser)
    }

    @Test
    fun `DismissError clears error`() = runTest {
        coEvery { sendOtpUseCase(any()) } returns Result.failure(RuntimeException("err"))
        val vm = viewModel()
        vm.onIntent(AuthIntent.SendOtp)
        assertNotNull(vm.state.value.error)

        vm.onIntent(AuthIntent.DismissError)

        assertNull(vm.state.value.error)
    }
}
