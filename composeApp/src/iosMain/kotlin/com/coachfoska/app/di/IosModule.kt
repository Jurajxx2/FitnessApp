package com.coachfoska.app.di

import com.coachfoska.app.auth.IosSocialAuthProvider
import com.coachfoska.app.domain.auth.SocialAuthProvider
import org.koin.dsl.module

val iosModule = module {
    single<SocialAuthProvider> { IosSocialAuthProvider() }
}
