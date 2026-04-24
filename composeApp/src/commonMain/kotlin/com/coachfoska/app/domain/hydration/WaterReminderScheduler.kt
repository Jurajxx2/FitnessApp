package com.coachfoska.app.domain.hydration

import com.coachfoska.app.domain.model.HydrationSettings

interface WaterReminderScheduler {
    fun schedule(settings: HydrationSettings, goalMl: Int)
    fun cancel()
}
