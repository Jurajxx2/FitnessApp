package com.coachfoska.app.guardrails

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals

class LoggingBoundaryTest {

    @Test
    fun napierIsOnlyUsedByLoggingGatewayAndPlatformBootstrap() {
        val root = findRepoRoot()
        val allowed = setOf(
            "composeApp/src/commonMain/kotlin/com/coachfoska/app/core/logging/AppLogger.kt",
            "composeApp/src/androidMain/kotlin/com/coachfoska/app/CoachFoskaApplication.kt",
            "composeApp/src/iosMain/kotlin/com/coachfoska/app/MainViewController.kt",
            "composeApp/src/androidUnitTest/kotlin/com/coachfoska/app/guardrails/LoggingBoundaryTest.kt",
        )
        val offenders = File(root, "composeApp/src").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { "io.github.aakira.napier" in it.readText() }
            .map { it.relativeTo(root).invariantSeparatorsPath }
            .filterNot { it in allowed }
            .toList()

        assertEquals(emptyList(), offenders, "Call AppLogger instead of Napier directly")
    }

    private fun findRepoRoot(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("Could not locate repo root")
        }
        return dir
    }
}
