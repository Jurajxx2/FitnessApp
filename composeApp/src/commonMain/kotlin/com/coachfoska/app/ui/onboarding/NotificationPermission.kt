package com.coachfoska.app.ui.onboarding

import androidx.compose.runtime.Composable

/** Requests the OS notification permission. [onResult] receives whether it is (now) granted. */
fun interface NotificationPermissionRequester {
    fun request(onResult: (Boolean) -> Unit)
}

@Composable
expect fun rememberNotificationPermissionRequester(): NotificationPermissionRequester
