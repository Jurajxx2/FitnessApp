package com.coachfoska.app.push

import com.coachfoska.app.domain.push.PushNotificationService

// Stub — replace getToken() body with FirebaseMessaging.getInstance().token once
// google-services.json and the firebase-messaging dependency are added.
class AndroidPushNotificationService : PushNotificationService {
    override suspend fun getToken(): String? = null
}
