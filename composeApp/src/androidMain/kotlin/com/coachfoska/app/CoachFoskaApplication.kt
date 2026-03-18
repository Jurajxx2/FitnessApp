package com.coachfoska.app

import android.app.Application
import com.coachfoska.app.core.di.appModules
import com.coachfoska.app.di.androidModule
import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.core.logger.Level

class CoachFoskaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Napier.base(DebugAntilog())
        startKoin {
            androidLogger(Level.DEBUG)
            androidContext(this@CoachFoskaApplication)
            modules(appModules + androidModule)
        }
    }
}
