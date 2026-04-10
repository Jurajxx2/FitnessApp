package com.coachfoska.app.core.theme

import com.russhwolf.settings.Settings
import com.russhwolf.settings.set
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val KEY_IS_DARK = "theme_is_dark"

class ThemeRepository(private val settings: Settings) {

    private val _isDarkTheme = MutableStateFlow(settings.getBoolean(KEY_IS_DARK, defaultValue = true))
    val isDarkTheme: StateFlow<Boolean> = _isDarkTheme.asStateFlow()

    fun setDarkTheme(dark: Boolean) {
        settings[KEY_IS_DARK] = dark
        _isDarkTheme.value = dark
    }

    fun toggle() = setDarkTheme(!_isDarkTheme.value)
}
