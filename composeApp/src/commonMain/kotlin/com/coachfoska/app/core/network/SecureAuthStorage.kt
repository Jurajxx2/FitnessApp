package com.coachfoska.app.core.network

import com.russhwolf.settings.Settings
import io.github.jan.supabase.auth.CodeVerifierCache
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.SettingsCodeVerifierCache
import io.github.jan.supabase.auth.SettingsSessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json

/** Platform storage that must encrypt values at rest and never persist its encryption key. */
internal interface SecureAuthStore {
    fun read(key: String): String?
    fun write(key: String, value: String)
    fun remove(key: String)
}

internal expect fun createPlatformSecureAuthStore(): SecureAuthStore

private const val SECURE_SESSION_KEY = "auth_session_v1"
private const val SECURE_CODE_VERIFIER_KEY = "auth_code_verifier_v1"

private val authJson = Json {
    encodeDefaults = true
    ignoreUnknownKeys = true
}

internal class SecureSessionManager(
    private val secureStore: SecureAuthStore,
    private val legacySettings: Settings = Settings(),
) : SessionManager {

    override suspend fun saveSession(session: UserSession) {
        secureStore.write(SECURE_SESSION_KEY, authJson.encodeToString(session))
    }

    override suspend fun loadSession(): UserSession? {
        val encryptedSession = try {
            secureStore.read(SECURE_SESSION_KEY)
        } catch (_: Exception) {
            clearAllSessionState()
            return null
        }

        if (encryptedSession != null) {
            return try {
                authJson.decodeFromString<UserSession>(encryptedSession)
            } catch (_: Exception) {
                clearAllSessionState()
                null
            }
        }

        val legacySession = legacySettings.getStringOrNull(SettingsSessionManager.SETTINGS_KEY)
            ?: return null
        val decoded = try {
            authJson.decodeFromString<UserSession>(legacySession)
        } catch (_: Exception) {
            clearAllSessionState()
            return null
        }

        return try {
            secureStore.write(SECURE_SESSION_KEY, legacySession)
            check(secureStore.read(SECURE_SESSION_KEY) == legacySession) {
                "Secure session verification failed"
            }
            legacySettings.remove(SettingsSessionManager.SETTINGS_KEY)
            decoded
        } catch (_: Exception) {
            clearAllSessionState()
            null
        }
    }

    override suspend fun deleteSession() {
        clearAllSessionState()
    }

    private fun clearAllSessionState() {
        runCatching { secureStore.remove(SECURE_SESSION_KEY) }
        legacySettings.remove(SettingsSessionManager.SETTINGS_KEY)
    }
}

internal class SecureCodeVerifierCache(
    private val secureStore: SecureAuthStore,
    private val legacySettings: Settings = Settings(),
) : CodeVerifierCache {

    override suspend fun saveCodeVerifier(codeVerifier: String) {
        require(codeVerifier.isValidCodeVerifier()) { "Invalid PKCE code verifier" }
        secureStore.write(SECURE_CODE_VERIFIER_KEY, codeVerifier)
    }

    override suspend fun loadCodeVerifier(): String? {
        val encryptedVerifier = try {
            secureStore.read(SECURE_CODE_VERIFIER_KEY)
        } catch (_: Exception) {
            clearAllVerifierState()
            return null
        }

        if (encryptedVerifier != null) {
            return encryptedVerifier.takeIf { it.isValidCodeVerifier() }
                ?: run {
                    clearAllVerifierState()
                    null
                }
        }

        val legacyVerifier = legacySettings.getStringOrNull(SettingsCodeVerifierCache.SETTINGS_KEY)
            ?: return null
        if (!legacyVerifier.isValidCodeVerifier()) {
            clearAllVerifierState()
            return null
        }

        return try {
            secureStore.write(SECURE_CODE_VERIFIER_KEY, legacyVerifier)
            check(secureStore.read(SECURE_CODE_VERIFIER_KEY) == legacyVerifier) {
                "Secure code verifier verification failed"
            }
            legacySettings.remove(SettingsCodeVerifierCache.SETTINGS_KEY)
            legacyVerifier
        } catch (_: Exception) {
            clearAllVerifierState()
            null
        }
    }

    override suspend fun deleteCodeVerifier() {
        clearAllVerifierState()
    }

    private fun clearAllVerifierState() {
        runCatching { secureStore.remove(SECURE_CODE_VERIFIER_KEY) }
        legacySettings.remove(SettingsCodeVerifierCache.SETTINGS_KEY)
    }
}

private fun String.isValidCodeVerifier(): Boolean =
    length in 43..128 && all { it.isLetterOrDigit() || it == '-' || it == '.' || it == '_' || it == '~' }

internal fun createSecureSessionManagerPair(): Pair<SessionManager, CodeVerifierCache> {
    val store = createPlatformSecureAuthStore()
    return SecureSessionManager(store) to SecureCodeVerifierCache(store)
}
