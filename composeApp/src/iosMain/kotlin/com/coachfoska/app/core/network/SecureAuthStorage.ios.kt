@file:OptIn(kotlinx.cinterop.BetaInteropApi::class, kotlinx.cinterop.ExperimentalForeignApi::class)

package com.coachfoska.app.core.network

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.interpretCPointer
import kotlinx.cinterop.interpretObjCPointer
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.objcPtr
import kotlinx.cinterop.rawValue
import kotlinx.cinterop.ptr
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryRef
import platform.CoreFoundation.CFStringRef
import platform.CoreFoundation.CFTypeRefVar
import platform.Foundation.NSData
import platform.Foundation.NSMutableDictionary
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecItemNotFound
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleWhenUnlockedThisDeviceOnly
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

private const val KEYCHAIN_SERVICE = "com.coachfoska.app.auth"

internal actual fun createPlatformSecureAuthStore(): SecureAuthStore = IosKeychainAuthStore()

private class IosKeychainAuthStore : SecureAuthStore {

    override fun read(key: String): String? = memScoped {
        val result = alloc<CFTypeRefVar>()
        val status = SecItemCopyMatching(readQuery(key), result.ptr)
        if (status == errSecItemNotFound) return null
        check(status == errSecSuccess) { "Keychain read failed ($status)" }
        val dataPointer = result.value ?: error("Keychain returned invalid data")
        val data = interpretObjCPointer<NSData>(dataPointer.rawValue)
        NSString.create(data = data, encoding = NSUTF8StringEncoding)?.toString()
            ?: error("Keychain value is not UTF-8")
    }

    override fun write(key: String, value: String) {
        remove(key)
        val data = value.encodeToByteArray().toNSData()
        val query = baseQuery(key).apply {
            setObject(data, forKey = kSecValueData.asNSString())
            setObject(
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly.asNSString(),
                forKey = kSecAttrAccessible.asNSString(),
            )
        }
        val status = SecItemAdd(query.asCfDictionary(), null)
        check(status == errSecSuccess) { "Keychain write failed ($status)" }
    }

    override fun remove(key: String) {
        val status = SecItemDelete(baseQuery(key).asCfDictionary())
        check(status == errSecSuccess || status == errSecItemNotFound) {
            "Keychain delete failed ($status)"
        }
    }

    private fun readQuery(key: String): CFDictionaryRef = baseQuery(key).apply {
        setObject(true, forKey = kSecReturnData.asNSString())
        setObject(kSecMatchLimitOne.asNSString(), forKey = kSecMatchLimit.asNSString())
    }.asCfDictionary()

    private fun baseQuery(key: String): NSMutableDictionary = NSMutableDictionary().apply {
        setObject(kSecClassGenericPassword.asNSString(), forKey = kSecClass.asNSString())
        setObject(KEYCHAIN_SERVICE, forKey = kSecAttrService.asNSString())
        setObject(key, forKey = kSecAttrAccount.asNSString())
    }
}

/** NSMutableDictionary and CFDictionary are toll-free bridged by Apple. */
private fun NSMutableDictionary.asCfDictionary(): CFDictionaryRef =
    checkNotNull(interpretCPointer(objcPtr())) { "Unable to bridge Keychain query dictionary" }

/** CoreFoundation strings are toll-free bridged to NSString at runtime. */
private fun CFStringRef?.asNSString(): NSString {
    val value = requireNotNull(this) { "Required Security framework constant is unavailable" }
    return interpretObjCPointer(value.rawValue)
}

private fun ByteArray.toNSData(): NSData =
    if (isEmpty()) {
        NSData()
    } else {
        usePinned {
            NSData.create(bytes = it.addressOf(0), length = size.toULong())
        }
    }
