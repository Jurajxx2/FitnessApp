package com.coachfoska.app.presentation.home

sealed interface HomeIntent {
    data object LoadData : HomeIntent
    data object Refresh : HomeIntent
}
