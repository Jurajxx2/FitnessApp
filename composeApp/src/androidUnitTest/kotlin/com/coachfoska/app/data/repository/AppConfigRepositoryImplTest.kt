package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.AppConfigRemoteDataSource
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AppConfigRepositoryImplTest {

    private val dataSource: AppConfigRemoteDataSource = mockk()
    private val repository = AppConfigRepositoryImpl(dataSource)

    @Test
    fun `getAppLinks maps config map to AppLinks`() = runTest {
        coEvery { dataSource.getAllConfig() } returns mapOf(
            "privacy_policy_url" to "https://coachfoska.com/privacy",
            "terms_of_service_url" to "https://coachfoska.com/terms",
            "account_deletion_url" to "https://coachfoska.com/delete",
        )

        val result = repository.getAppLinks()

        assertTrue(result.isSuccess)
        val links = result.getOrThrow()
        assertEquals("https://coachfoska.com/privacy", links.privacyPolicyUrl)
        assertEquals("https://coachfoska.com/terms", links.termsOfServiceUrl)
        assertEquals("https://coachfoska.com/delete", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks defaults missing keys to empty string`() = runTest {
        coEvery { dataSource.getAllConfig() } returns mapOf(
            "privacy_policy_url" to "https://coachfoska.com/privacy"
        )

        val links = repository.getAppLinks().getOrThrow()

        assertEquals("https://coachfoska.com/privacy", links.privacyPolicyUrl)
        assertEquals("", links.termsOfServiceUrl)
        assertEquals("", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks returns empty strings when config is empty`() = runTest {
        coEvery { dataSource.getAllConfig() } returns emptyMap()

        val links = repository.getAppLinks().getOrThrow()

        assertEquals("", links.privacyPolicyUrl)
        assertEquals("", links.termsOfServiceUrl)
        assertEquals("", links.accountDeletionUrl)
    }

    @Test
    fun `getAppLinks wraps data source exception as failure`() = runTest {
        coEvery { dataSource.getAllConfig() } throws RuntimeException("Network error")

        val result = repository.getAppLinks()

        assertTrue(result.isFailure)
        assertEquals("Network error", result.exceptionOrNull()?.message)
    }
}
