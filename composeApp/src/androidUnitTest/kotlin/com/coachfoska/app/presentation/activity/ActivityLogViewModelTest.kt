package com.coachfoska.app.presentation.activity

import com.coachfoska.app.domain.model.ActivityType
import com.coachfoska.app.domain.usecase.activity.GetActivityHistoryUseCase
import com.coachfoska.app.domain.usecase.activity.LogGeneralActivityUseCase
import com.coachfoska.app.fixtures.aGeneralActivityLog
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class ActivityLogViewModelTest {

    private val logUseCase: LogGeneralActivityUseCase = mockk()
    private val historyUseCase: GetActivityHistoryUseCase = mockk()
    private val testDispatcher = StandardTestDispatcher()

    @BeforeTest fun setUp() { 
        Dispatchers.setMain(testDispatcher)
        coEvery { historyUseCase(any()) } returns Result.success(emptyList())
    }
    @AfterTest fun tearDown() { Dispatchers.resetMain() }

    @Test
    fun `loadHistory success populates state`() = runTest {
        val history = listOf(aGeneralActivityLog())
        coEvery { historyUseCase("u1") } returns Result.success(history)

        val vm = ActivityLogViewModel(logUseCase, historyUseCase, "u1")
        advanceUntilIdle()

        assertEquals(history, vm.state.value.history)
        assertFalse(vm.state.value.isLoading)
    }

    @Test
    fun `UpdateDuration validates canSubmit`() = runTest {
        val vm = ActivityLogViewModel(logUseCase, historyUseCase, "u1")
        
        vm.onIntent(ActivityLogIntent.UpdateDuration("30"))
        assertTrue(vm.state.value.canSubmit)

        vm.onIntent(ActivityLogIntent.UpdateDuration("0"))
        assertFalse(vm.state.value.canSubmit)

        vm.onIntent(ActivityLogIntent.UpdateDuration("abc"))
        assertFalse(vm.state.value.canSubmit)
    }

    @Test
    fun `Submit success reloads history and clears form`() = runTest {
        coEvery { logUseCase(any(), any(), any(), any(), any(), any(), any()) } returns Result.success(aGeneralActivityLog())

        val vm = ActivityLogViewModel(logUseCase, historyUseCase, "u1")
        vm.onIntent(ActivityLogIntent.UpdateDuration("30"))
        vm.onIntent(ActivityLogIntent.Submit)
        advanceUntilIdle()

        assertTrue(vm.state.value.success)
        assertEquals("", vm.state.value.durationMinutesText)
    }
}
