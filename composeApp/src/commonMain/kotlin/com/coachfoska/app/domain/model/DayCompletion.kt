package com.coachfoska.app.domain.model

enum class CompletionStatus {
    COMPLETED,
    MISSED,
    UPCOMING,
    TODAY,
}

data class DayCompletion(
    val dayOfWeek: DayOfWeek,
    val status: CompletionStatus,
)

enum class TimePeriod {
    ONE_MONTH,
    THREE_MONTHS,
    SIX_MONTHS,
    ONE_YEAR,
    ALL,
}
