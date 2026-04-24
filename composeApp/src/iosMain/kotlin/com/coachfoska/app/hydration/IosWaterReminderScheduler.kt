package com.coachfoska.app.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings

class IosWaterReminderScheduler : WaterReminderScheduler {
    override fun setUserId(userId: String) { /* implemented in Task 15 */ }
    override fun schedule(settings: HydrationSettings, goalMl: Int) { /* implemented in Task 15 */ }
    override fun cancel() { /* implemented in Task 15 */ }
}
