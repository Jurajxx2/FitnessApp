package com.coachfoska.app.domain.repository

import com.coachfoska.app.domain.model.AppLinks

interface AppConfigRepository {
    suspend fun getAppLinks(): Result<AppLinks>
}
