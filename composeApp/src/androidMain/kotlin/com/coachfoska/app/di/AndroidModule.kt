package com.coachfoska.app.di

import com.coachfoska.app.auth.AndroidSocialAuthProvider
import com.coachfoska.app.data.remote.datasource.DeviceTokenDataSource
import com.coachfoska.app.data.repository.DeviceTokenRepositoryImpl
import com.coachfoska.app.domain.auth.SocialAuthProvider
import com.coachfoska.app.domain.push.PushNotificationService
import com.coachfoska.app.domain.repository.DeviceTokenRepository
import com.coachfoska.app.push.AndroidPushNotificationService
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.hydration.AndroidWaterReminderScheduler
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    single<SocialAuthProvider> { AndroidSocialAuthProvider(androidContext()) }
    single<PushNotificationService> { AndroidPushNotificationService() }
    single<DeviceTokenRepository> {
        DeviceTokenRepositoryImpl(dataSource = get(), pushService = get(), platform = "android")
    }
    single<WaterReminderScheduler> { AndroidWaterReminderScheduler(androidContext()) }
}
