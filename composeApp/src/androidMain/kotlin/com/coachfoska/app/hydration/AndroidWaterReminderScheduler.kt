package com.coachfoska.app.hydration

import android.content.Context
import androidx.work.*
import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings
import java.util.concurrent.TimeUnit

class AndroidWaterReminderScheduler(private val context: Context) : WaterReminderScheduler {

    private val workManager = WorkManager.getInstance(context)
    private var userId: String = ""

    override fun setUserId(userId: String) { this.userId = userId }

    override fun schedule(settings: HydrationSettings, goalMl: Int) {
        val inputData = workDataOf(
            HydrationWorker.KEY_USER_ID to userId,
            HydrationWorker.KEY_GOAL_ML to goalMl,
            HydrationWorker.KEY_START_HOUR to settings.startHour,
            HydrationWorker.KEY_END_HOUR to settings.endHour,
            HydrationWorker.KEY_SMART_SUPPRESS to settings.smartSuppress,
            HydrationWorker.KEY_INTERVAL_MINUTES to settings.intervalMinutes
        )
        val request = PeriodicWorkRequestBuilder<HydrationWorker>(
            settings.intervalMinutes.toLong(), TimeUnit.MINUTES
        )
            .setInputData(inputData)
            .setConstraints(Constraints(requiredNetworkType = NetworkType.CONNECTED))
            .build()

        workManager.enqueueUniquePeriodicWork(
            HydrationWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    override fun cancel() {
        workManager.cancelUniqueWork(HydrationWorker.WORK_NAME)
    }
}
