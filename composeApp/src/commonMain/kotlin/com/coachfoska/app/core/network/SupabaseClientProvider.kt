package com.coachfoska.app.core.network

import com.coachfoska.app.BuildKonfig
import io.github.aakira.napier.Napier
import io.github.jan.supabase.annotations.SupabaseInternal
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.storage.Storage
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging

private const val TAG = "Supabase"

object SupabaseClientProvider {
    @OptIn(SupabaseInternal::class)
    val client by lazy {
        createSupabaseClient(
            supabaseUrl = BuildKonfig.SUPABASE_URL,
            supabaseKey = BuildKonfig.SUPABASE_ANON_KEY
        ) {
            httpConfig {
                install(Logging) {
                    logger = object : Logger {
                        override fun log(message: String) = Napier.v(message, tag = TAG)
                    }
                    level = LogLevel.BODY
                }
            }
            install(Auth) {
                alwaysAutoRefresh = true
            }
            install(Postgrest)
            install(Realtime)
            install(Storage)
        }
    }
}
