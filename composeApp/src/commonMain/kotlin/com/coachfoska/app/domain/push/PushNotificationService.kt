package com.coachfoska.app.domain.push

interface PushNotificationService {
    /** Returns the FCM/APNs device token, or null if Firebase is not yet configured. */
    suspend fun getToken(): String?
}
