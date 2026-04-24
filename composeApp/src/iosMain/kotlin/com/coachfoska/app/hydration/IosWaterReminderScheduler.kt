package com.coachfoska.app.hydration

import com.coachfoska.app.domain.hydration.WaterReminderScheduler
import com.coachfoska.app.domain.model.HydrationSettings
import platform.UserNotifications.UNAuthorizationOptionAlert
import platform.UserNotifications.UNAuthorizationOptionSound
import platform.UserNotifications.UNCalendarNotificationTrigger
import platform.UserNotifications.UNMutableNotificationContent
import platform.UserNotifications.UNNotificationRequest
import platform.UserNotifications.UNNotificationSound
import platform.UserNotifications.UNUserNotificationCenter
import platform.Foundation.NSDateComponents

class IosWaterReminderScheduler : WaterReminderScheduler {

    private val center = UNUserNotificationCenter.currentNotificationCenter()

    override fun setUserId(userId: String) { /* not needed on iOS */ }

    override fun schedule(settings: HydrationSettings, goalMl: Int) {
        center.requestAuthorizationWithOptions(
            UNAuthorizationOptionAlert or UNAuthorizationOptionSound
        ) { granted, _ ->
            if (!granted) return@requestAuthorizationWithOptions
            scheduleNotifications(settings)
        }
    }

    override fun cancel() {
        center.removeAllPendingNotificationRequests()
    }

    private fun scheduleNotifications(settings: HydrationSettings) {
        center.removeAllPendingNotificationRequests()

        val content = UNMutableNotificationContent().apply {
            setTitle("Time to drink water 💧")
            setBody("Stay hydrated — log your water intake in Coach Foska.")
            setSound(UNNotificationSound.defaultSound())
        }

        var hour = settings.startHour
        var requestIndex = 0
        while (hour < settings.endHour) {
            val components = NSDateComponents().apply {
                setHour(hour.toLong())
                setMinute(0)
            }
            val trigger = UNCalendarNotificationTrigger.triggerWithDateMatchingComponents(
                components, repeats = true
            )
            val request = UNNotificationRequest.requestWithIdentifier(
                "hydration_$requestIndex",
                content,
                trigger
            )
            center.addNotificationRequest(request) { _ -> }
            hour += settings.intervalMinutes / 60
            requestIndex++
        }
    }
}
