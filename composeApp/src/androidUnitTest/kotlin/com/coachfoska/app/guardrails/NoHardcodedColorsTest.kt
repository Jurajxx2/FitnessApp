package com.coachfoska.app.guardrails

import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Design-system guardrail: raw hex colors and lazy named colors are only
 * allowed inside :designsystem (tokens + brand files). Everything in
 * composeApp must read DsTheme semantic tokens.
 *
 * Allowlisted named colors (NOT flagged): Color.Black, Color.White,
 * Color.Transparent, Color.Unspecified — legitimate for scrims, shadows,
 * and gradient overlays that must not vary by brand.
 */
class NoHardcodedColorsTest {

    @Test
    fun composeAppContainsNoRawHexColors() {
        val root = findRepoRoot()
        val pattern = Regex("""Color\(0x|Color\.(Red|Green|Blue|Yellow|Magenta|Cyan|Gray|LightGray|DarkGray)\b""")
        val offenders = File(root, "composeApp/src").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { file -> file.readText().contains(pattern) }
            .map { it.relativeTo(root).path }
            .toList()
        assertTrue(
            offenders.isEmpty(),
            "Raw hex color constructor or named Compose color found — use DsTheme.colors tokens instead:\n" +
                offenders.joinToString("\n")
        )
    }

    private fun findRepoRoot(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        while (!File(dir, "settings.gradle.kts").exists()) {
            dir = dir.parentFile ?: error("Could not locate repo root from ${System.getProperty("user.dir")}")
        }
        return dir
    }
}
