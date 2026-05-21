package com.coachfoska.app.domain.model

import kotlinx.datetime.Instant

// IMPORTANT: storage values (enum.name) must stay in sync with the CHECK constraint in
// supabase/migrations/20260521000000_general_activities.sql.
// Adding a new value requires a migration.
enum class ActivityType(val displayName: String) {
    WALKING("Walking"),
    RUNNING("Running"),
    CYCLING("Cycling"),
    YOGA("Yoga"),
    SWIMMING("Swimming"),
    OTHER("Other");

    companion object {
        fun fromStorageValue(v: String?): ActivityType =
            entries.firstOrNull { it.name == v } ?: OTHER
    }
}

data class GeneralActivityLog(
    val id: String,
    val userId: String,
    val type: ActivityType,
    val durationMinutes: Int,
    val distanceKm: Double?,
    val rpe: Int?,
    val loggedAt: Instant,
    val notes: String?,
)
