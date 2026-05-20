package com.coachfoska.app.data.repository

import com.coachfoska.app.data.remote.datasource.AppConfigRemoteDataSource
import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository

class AppConfigRepositoryImpl(
    private val dataSource: AppConfigRemoteDataSource
) : AppConfigRepository {

    override suspend fun getAppLinks(): Result<AppLinks> = runCatching {
        val config = dataSource.getAllConfig()
        AppLinks(
            privacyPolicyUrl = config["privacy_policy_url"].orEmpty(),
            termsOfServiceUrl = config["terms_of_service_url"].orEmpty(),
            accountDeletionUrl = config["account_deletion_url"].orEmpty()
        )
    }
}
