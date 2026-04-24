package com.coachfoska.app.hydration

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.coachfoska.app.core.util.currentInstant
import com.coachfoska.app.domain.repository.HydrationRepository
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

class HydrationWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params), KoinComponent {

    private val hydrationRepository: HydrationRepository by inject()

    override suspend fun doWork(): Result {
        val userId = inputData.getString(KEY_USER_ID)?.takeIf { it.isNotBlank() } ?: return Result.failure()
        val goalMl = inputData.getInt(KEY_GOAL_ML, 2000)
        val startHour = inputData.getInt(KEY_START_HOUR, 7)
        val endHour = inputData.getInt(KEY_END_HOUR, 22)
        val smartSuppress = inputData.getBoolean(KEY_SMART_SUPPRESS, true)
        val intervalMinutes = inputData.getInt(KEY_INTERVAL_MINUTES, 120)

        val currentHour = currentInstant().toLocalDateTime(TimeZone.currentSystemDefault()).hour
        if (currentHour < startHour || currentHour >= endHour) return Result.success()

        if (smartSuppress) {
            val logsResult = hydrationRepository.getTodayLogs(userId)
            val logs = logsResult.getOrNull()
            if (logs != null) {
                if (logs.sumOf { it.amountMl } >= goalMl) return Result.success()
                val lastLog = logs.firstOrNull()
                if (lastLog != null) {
                    val minutesSinceLast = (currentInstant() - lastLog.loggedAt).inWholeMinutes
                    if (minutesSinceLast < intervalMinutes / 2) return Result.success()
                }
            }
            // If network failed (logs == null), show notification anyway
        }

        showNotification()
        return Result.success()
    }

    private fun showNotification() {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Hydration Reminders", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Time to drink water 💧")
            .setContentText("Stay hydrated — log your water intake in Coach Foska.")
            .setAutoCancel(true)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val KEY_USER_ID = "user_id"
        const val KEY_GOAL_ML = "goal_ml"
        const val KEY_START_HOUR = "start_hour"
        const val KEY_END_HOUR = "end_hour"
        const val KEY_SMART_SUPPRESS = "smart_suppress"
        const val KEY_INTERVAL_MINUTES = "interval_minutes"
        const val WORK_NAME = "hydration_reminder"
        const val CHANNEL_ID = "hydration_reminders"
        const val NOTIFICATION_ID = 1001
    }
}
