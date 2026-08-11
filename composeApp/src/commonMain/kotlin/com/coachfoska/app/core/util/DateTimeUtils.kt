package com.coachfoska.app.core.util

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.toLocalDateTime

fun Instant.toDisplayDate(): String {
    val local = toLocalDateTime(TimeZone.currentSystemDefault())
    return "${local.dayOfMonth}.${local.monthNumber}.${local.year}"
}

fun Instant.toDisplayDateTime(): String {
    val local = toLocalDateTime(TimeZone.currentSystemDefault())
    val hour = local.hour.toString().padStart(2, '0')
    val minute = local.minute.toString().padStart(2, '0')
    return "${local.dayOfMonth}.${local.monthNumber}.${local.year} $hour:$minute"
}

fun LocalDate.toDisplayString(): String = "$dayOfMonth.$monthNumber.$year"

expect fun currentInstant(): kotlinx.datetime.Instant

fun todayDate(): LocalDate =
    currentInstant().toLocalDateTime(TimeZone.currentSystemDefault()).date

/** Monday in the single product timezone shared by web, KMP, and Storage RLS. */
fun currentCheckInWeekMonday(instant: Instant = currentInstant()): LocalDate {
    var date = instant.toLocalDateTime(TimeZone.of(CHECK_IN_TIME_ZONE_ID)).date
    while (date.dayOfWeek != DayOfWeek.MONDAY) date = date.minus(1, DateTimeUnit.DAY)
    return date
}
