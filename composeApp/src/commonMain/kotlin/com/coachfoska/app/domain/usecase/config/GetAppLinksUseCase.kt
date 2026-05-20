package com.coachfoska.app.domain.usecase.config

import com.coachfoska.app.domain.model.AppLinks
import com.coachfoska.app.domain.repository.AppConfigRepository

class GetAppLinksUseCase(private val repository: AppConfigRepository) {
    suspend operator fun invoke(): Result<AppLinks> = repository.getAppLinks()
}
