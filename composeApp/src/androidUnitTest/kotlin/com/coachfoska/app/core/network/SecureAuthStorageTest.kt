package com.coachfoska.app.core.network

import com.russhwolf.settings.Settings
import io.github.jan.supabase.auth.SettingsCodeVerifierCache
import io.github.jan.supabase.auth.SettingsSessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class SecureAuthStorageTest {

    private val json = Json { encodeDefaults = true }

    @Test
    fun legacySessionMovesOnlyAfterVerifiedSecureWrite() = runTest {
        val legacy = TestSettings()
        val session = session()
        legacy.putString(SettingsSessionManager.SETTINGS_KEY, json.encodeToString(session))
        val store = FakeSecureStore()

        val loaded = SecureSessionManager(store, legacy).loadSession()

        assertEquals(session.accessToken, loaded?.accessToken)
        assertFalse(legacy.hasKey(SettingsSessionManager.SETTINGS_KEY))
        assertEquals(1, store.values.size)
    }

    @Test
    fun failedSecureMigrationDeletesPlaintextAndSignsOut() = runTest {
        val legacy = TestSettings()
        legacy.putString(SettingsSessionManager.SETTINGS_KEY, json.encodeToString(session()))
        val store = FakeSecureStore(failWrites = true)

        assertNull(SecureSessionManager(store, legacy).loadSession())
        assertFalse(legacy.hasKey(SettingsSessionManager.SETTINGS_KEY))
    }

    @Test
    fun malformedLegacySessionIsDeleted() = runTest {
        val legacy = TestSettings()
        legacy.putString(SettingsSessionManager.SETTINGS_KEY, "not-json")

        assertNull(SecureSessionManager(FakeSecureStore(), legacy).loadSession())
        assertFalse(legacy.hasKey(SettingsSessionManager.SETTINGS_KEY))
    }

    @Test
    fun pkceVerifierMigratesAndInvalidValueFailsClosed() = runTest {
        val validLegacy = TestSettings()
        val verifier = "a".repeat(43)
        validLegacy.putString(SettingsCodeVerifierCache.SETTINGS_KEY, verifier)
        val cache = SecureCodeVerifierCache(FakeSecureStore(), validLegacy)

        assertEquals(verifier, cache.loadCodeVerifier())
        assertFalse(validLegacy.hasKey(SettingsCodeVerifierCache.SETTINGS_KEY))

        val invalidLegacy = TestSettings()
        invalidLegacy.putString(SettingsCodeVerifierCache.SETTINGS_KEY, "short")
        assertNull(SecureCodeVerifierCache(FakeSecureStore(), invalidLegacy).loadCodeVerifier())
        assertFalse(invalidLegacy.hasKey(SettingsCodeVerifierCache.SETTINGS_KEY))
    }

    private fun session() = UserSession(
        accessToken = "access-canary",
        refreshToken = "refresh-canary",
        expiresIn = 3_600,
        tokenType = "bearer",
    )
}

private class FakeSecureStore(
    private val failWrites: Boolean = false,
) : SecureAuthStore {
    val values = mutableMapOf<String, String>()

    override fun read(key: String): String? = values[key]

    override fun write(key: String, value: String) {
        if (failWrites) error("secure write failed")
        values[key] = value
    }

    override fun remove(key: String) {
        values.remove(key)
    }
}

private class TestSettings : Settings {
    private val values = mutableMapOf<String, Any>()
    override val keys: Set<String> get() = values.keys
    override val size: Int get() = values.size
    override fun clear() = values.clear()
    override fun remove(key: String) { values.remove(key) }
    override fun hasKey(key: String) = key in values
    override fun putInt(key: String, value: Int) { values[key] = value }
    override fun getInt(key: String, defaultValue: Int) = getIntOrNull(key) ?: defaultValue
    override fun getIntOrNull(key: String) = values[key] as? Int
    override fun putLong(key: String, value: Long) { values[key] = value }
    override fun getLong(key: String, defaultValue: Long) = getLongOrNull(key) ?: defaultValue
    override fun getLongOrNull(key: String) = values[key] as? Long
    override fun putString(key: String, value: String) { values[key] = value }
    override fun getString(key: String, defaultValue: String) = getStringOrNull(key) ?: defaultValue
    override fun getStringOrNull(key: String) = values[key] as? String
    override fun putFloat(key: String, value: Float) { values[key] = value }
    override fun getFloat(key: String, defaultValue: Float) = getFloatOrNull(key) ?: defaultValue
    override fun getFloatOrNull(key: String) = values[key] as? Float
    override fun putDouble(key: String, value: Double) { values[key] = value }
    override fun getDouble(key: String, defaultValue: Double) = getDoubleOrNull(key) ?: defaultValue
    override fun getDoubleOrNull(key: String) = values[key] as? Double
    override fun putBoolean(key: String, value: Boolean) { values[key] = value }
    override fun getBoolean(key: String, defaultValue: Boolean) = getBooleanOrNull(key) ?: defaultValue
    override fun getBooleanOrNull(key: String) = values[key] as? Boolean
}
