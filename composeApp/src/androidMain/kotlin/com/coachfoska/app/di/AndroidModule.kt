package com.coachfoska.app.di

import com.coachfoska.app.auth.AndroidSocialAuthProvider
import com.coachfoska.app.domain.auth.SocialAuthProvider
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val androidModule = module {
    single<SocialAuthProvider> { AndroidSocialAuthProvider(androidContext()) }
}
