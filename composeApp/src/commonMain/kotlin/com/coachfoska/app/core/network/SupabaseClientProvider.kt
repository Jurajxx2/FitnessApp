package com.coachfoska.app.core.network

import com.coachfoska.app.BuildKonfig
import com.coachfoska.app.core.logging.AppLogger
import io.github.jan.supabase.annotations.SupabaseInternal
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.storage.Storage
import io.ktor.client.plugins.logging.Logging

object SupabaseClientProvider {
    @OptIn(SupabaseInternal::class)
    val client by lazy {
        val (secureSessionManager, secureCodeVerifierCache) = createSecureSessionManagerPair()
        createSupabaseClient(
            supabaseUrl = BuildKonfig.SUPABASE_URL,
            supabaseKey = BuildKonfig.SUPABASE_ANON_KEY
        ) {
            httpConfig {
                install(Logging) {
                    logger = AppLogger.ktorLogger
                    level = AppLogger.networkLogLevel
                    sanitizeHeader { header -> AppLogger.shouldRedactHeader(header) }
                }
            }
            install(Auth) {
                alwaysAutoRefresh = true
                sessionManager = secureSessionManager
                codeVerifierCache = secureCodeVerifierCache
            }
            install(Postgrest)
            install(Realtime)
            install(Storage)
        }
    }
}
