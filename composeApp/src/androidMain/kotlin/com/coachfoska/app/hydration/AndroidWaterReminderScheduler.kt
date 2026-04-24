package com.coachfoska.app.hydration

import android.content.Context
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings

class AndroidWaterReminderScheduler(private val context: Context) : WaterReminderScheduler {
    override fun schedule(settings: HydrationSettings, goalMl: Int) { /* implemented in Task 14 */ }
    override fun cancel() { /* implemented in Task 14 */ }
}
