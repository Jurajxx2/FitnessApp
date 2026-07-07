package com.coachfoska.app.core.logging

import com.coachfoska.app.BuildKonfig
import io.github.aakira.napier.Napier
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.http.HttpHeaders

object AppLogger {
    private const val APP_TAG = "CoachFoska"
    private val sensitiveBodyFields = Regex(
        "(\"(?:access_token|refresh_token|id_token|token|password|email|authorization|apikey)\"\\s*:\\s*\")([^\"]+)(\")",
        RegexOption.IGNORE_CASE
    )
    private val bearerToken = Regex("Bearer\\s+[A-Za-z0-9._~+/-]+=*", RegexOption.IGNORE_CASE)
    private val jwtLikeToken = Regex("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b")

    val ktorLogger: Logger = object : Logger {
        override fun log(message: String) {
            verbose(tag = "Network", message = sanitize(message))
        }
    }

    val networkLogLevel: LogLevel
        get() = if (BuildKonfig.DEBUG) LogLevel.BODY else LogLevel.HEADERS

    fun appStarted(platform: String) {
        info(tag = APP_TAG, message = "App started platform=$platform debug=${BuildKonfig.DEBUG}")
    }

    fun screenViewed(route: String?) {
        info(tag = "Screen", message = "Viewed ${route.toScreenName()}")
    }

    fun debug(tag: String, message: String) {
        if (BuildKonfig.DEBUG) Napier.d(message, tag = tag)
    }

    fun verbose(tag: String, message: String) {
        if (BuildKonfig.DEBUG) Napier.v(message, tag = tag)
    }

    fun info(tag: String, message: String) {
        Napier.i(message, tag = tag)
    }

    fun warn(tag: String, message: String, throwable: Throwable? = null) {
        Napier.w(message, throwable, tag = tag)
    }

    fun error(tag: String, message: String, throwable: Throwable? = null) {
        Napier.e(message, throwable, tag = tag)
    }

    fun shouldRedactHeader(header: String): Boolean =
        header.equals(HttpHeaders.Authorization, ignoreCase = true) ||
            header.equals("apikey", ignoreCase = true) ||
            header.equals("x-supabase-auth", ignoreCase = true)

    private fun sanitize(message: String): String =
        message
            .replace(sensitiveBodyFields, "$1***$3")
            .replace(bearerToken, "Bearer ***")
            .replace(jwtLikeToken, "***")

    private fun String?.toScreenName(): String {
        if (this.isNullOrBlank()) return "Unknown"
        return substringBefore("?")
            .substringAfterLast(".")
            .substringAfterLast("/")
            .substringBefore("/")
            .ifBlank { this }
    }
}
