package com.coachfoska.app.di

import com.coachfoska.app.auth.IosSocialAuthProvider
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.data.repository.DeviceTokenRepositoryImpl
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.push.IosPushNotificationService
import org.koin.dsl.module

val iosModule = module {
    single<SocialAuthProvider> { IosSocialAuthProvider() }
    single<PushNotificationService> { IosPushNotificationService() }
    single<DeviceTokenRepository> {
        DeviceTokenRepositoryImpl(dataSource = get(), pushService = get(), platform = "ios")
    }
}
