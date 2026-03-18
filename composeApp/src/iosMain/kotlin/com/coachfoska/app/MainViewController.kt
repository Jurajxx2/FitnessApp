package com.coachfoska.app

import androidx.compose.ui.window.ComposeUIViewController
import com.coachfoska.app.core.di.appModules
import com.coachfoska.app.di.iosModule
import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import org.koin.core.context.startKoin

/**
 * Call initKoin() from Swift before creating the ComposeUIViewController.
 * In your Swift entry point (e.g., CoachFoskaApp.swift):
 *
 *   @main
 *   struct CoachFoskaApp: App {
 *       init() {
 *           MainViewControllerKt.doInitKoin()
 *       }
 *       var body: some Scene {
 *           WindowGroup {
 *               ContentView()
 *           }
 *       }
 *   }
 */
fun initKoin() {
    Napier.base(DebugAntilog())
    startKoin {
        modules(appModules + iosModule)
    }
}

fun MainViewController() = ComposeUIViewController { App() }
