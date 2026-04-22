package com.coachfoska.app.push

import com.coachfoska.app.domain.push.PushNotificationService

// Stub — replace getToken() body with APNs/FCM token retrieval once
// GoogleService-Info.plist and Firebase credentials are added.
class IosPushNotificationService : PushNotificationService {
    override suspend fun getToken(): String? = null
}
