package com.coachfoska.app.core.debug

import com.russhwolf.settings.Settings
import com.russhwolf.settings.set
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val KEY_COACH_SUBSCRIBED = "debug_coach_subscribed"

class DebugCoachSubscriptionRepository(private val settings: Settings) {

    private val _isCoachSubscribed = MutableStateFlow(settings.getBoolean(KEY_COACH_SUBSCRIBED, defaultValue = true))
    val isCoachSubscribed: StateFlow<Boolean> = _isCoachSubscribed.asStateFlow()

    fun setCoachSubscribed(subscribed: Boolean) {
        settings[KEY_COACH_SUBSCRIBED] = subscribed
        _isCoachSubscribed.value = subscribed
    }
}
