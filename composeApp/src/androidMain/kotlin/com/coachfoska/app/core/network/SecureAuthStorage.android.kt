package com.coachfoska.app.core.network

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.russhwolf.settings.Settings
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val KEY_ALIAS = "coach_foska_auth_storage_v1"
private const val VALUE_PREFIX = "secure_auth_"
private const val FORMAT_VERSION = "v1"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val GCM_TAG_LENGTH_BITS = 128

internal actual fun createPlatformSecureAuthStore(): SecureAuthStore = AndroidKeystoreAuthStore()

private class AndroidKeystoreAuthStore(
    private val settings: Settings = Settings(),
) : SecureAuthStore {

    override fun read(key: String): String? {
        val encoded = settings.getStringOrNull(VALUE_PREFIX + key) ?: return null
        return try {
            decrypt(encoded)
        } catch (_: Exception) {
            settings.remove(VALUE_PREFIX + key)
            null
        }
    }

    override fun write(key: String, value: String) {
        settings.putString(VALUE_PREFIX + key, encrypt(value))
    }

    override fun remove(key: String) {
        settings.remove(VALUE_PREFIX + key)
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(value.encodeToByteArray())
        return listOf(
            FORMAT_VERSION,
            Base64.encodeToString(cipher.iv, Base64.NO_WRAP),
            Base64.encodeToString(ciphertext, Base64.NO_WRAP),
        ).joinToString(":")
    }

    private fun decrypt(encoded: String): String {
        val parts = encoded.split(':', limit = 3)
        require(parts.size == 3 && parts[0] == FORMAT_VERSION) { "Unsupported secure auth format" }
        val iv = Base64.decode(parts[1], Base64.NO_WRAP)
        val ciphertext = Base64.decode(parts[2], Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        return cipher.doFinal(ciphertext).decodeToString()
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }
}
