package com.coachfoska.app.core.logging

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
        get() = if (isDebugBuild) LogLevel.BODY else LogLevel.NONE

    val isDebugBuild: Boolean
        get() = platformIsDebugBuild

    fun appStarted(platform: String) {
        info(tag = APP_TAG, message = "App started platform=$platform")
    }

    fun screenViewed(route: String?) {
        info(tag = "Screen", message = "Viewed ${route.toScreenName()}")
    }

    fun debug(tag: String, message: String) {
        d(message, tag = tag)
    }

    fun verbose(tag: String, message: String) {
        v(message, tag = tag)
    }

    fun info(tag: String, message: String) {
        i(message, tag = tag)
    }

    fun warn(tag: String, message: String, throwable: Throwable? = null) {
        w(message, throwable, tag = tag)
    }

    fun error(tag: String, message: String, throwable: Throwable? = null) {
        e(message, throwable, tag = tag)
    }

    fun d(message: String, throwable: Throwable? = null, tag: String = APP_TAG) {
        if (isDebugBuild) Napier.d(sanitize(message), throwable, tag)
    }

    fun d(message: () -> String) {
        if (isDebugBuild) Napier.d(sanitize(message()), tag = APP_TAG)
    }

    fun v(message: String, throwable: Throwable? = null, tag: String = APP_TAG) {
        if (isDebugBuild) Napier.v(sanitize(message), throwable, tag)
    }

    fun i(message: String, throwable: Throwable? = null, tag: String = APP_TAG) {
        if (isDebugBuild) Napier.i(sanitize(message), throwable, tag)
    }

    fun w(message: String, throwable: Throwable? = null, tag: String = APP_TAG) {
        if (isDebugBuild) Napier.w(sanitize(message), throwable, tag)
    }

    fun e(message: String, throwable: Throwable? = null, tag: String = APP_TAG) {
        if (isDebugBuild) Napier.e(sanitize(message), throwable, tag)
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
