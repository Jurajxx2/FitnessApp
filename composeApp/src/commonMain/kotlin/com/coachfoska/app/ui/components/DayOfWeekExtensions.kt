package com.coachfoska.app.ui.components

import androidx.compose.runtime.Composable
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.day_friday
import coachfoska.composeapp.generated.resources.day_monday
import coachfoska.composeapp.generated.resources.day_saturday
import coachfoska.composeapp.generated.resources.day_short_friday
import coachfoska.composeapp.generated.resources.day_short_monday
import coachfoska.composeapp.generated.resources.day_short_saturday
import coachfoska.composeapp.generated.resources.day_short_sunday
import coachfoska.composeapp.generated.resources.day_short_thursday
import coachfoska.composeapp.generated.resources.day_short_tuesday
import coachfoska.composeapp.generated.resources.day_short_wednesday
import coachfoska.composeapp.generated.resources.day_sunday
import coachfoska.composeapp.generated.resources.day_thursday
import coachfoska.composeapp.generated.resources.day_tuesday
import coachfoska.composeapp.generated.resources.day_wednesday
import com.coachfoska.app.domain.model.DayOfWeek
import org.jetbrains.compose.resources.stringResource

@Composable
fun DayOfWeek.localizedName(): String = when (this) {
    DayOfWeek.MONDAY -> stringResource(Res.string.day_monday)
    DayOfWeek.TUESDAY -> stringResource(Res.string.day_tuesday)
    DayOfWeek.WEDNESDAY -> stringResource(Res.string.day_wednesday)
    DayOfWeek.THURSDAY -> stringResource(Res.string.day_thursday)
    DayOfWeek.FRIDAY -> stringResource(Res.string.day_friday)
    DayOfWeek.SATURDAY -> stringResource(Res.string.day_saturday)
    DayOfWeek.SUNDAY -> stringResource(Res.string.day_sunday)
}

@Composable
fun DayOfWeek.localizedShortName(): String = when (this) {
    DayOfWeek.MONDAY -> stringResource(Res.string.day_short_monday)
    DayOfWeek.TUESDAY -> stringResource(Res.string.day_short_tuesday)
    DayOfWeek.WEDNESDAY -> stringResource(Res.string.day_short_wednesday)
    DayOfWeek.THURSDAY -> stringResource(Res.string.day_short_thursday)
    DayOfWeek.FRIDAY -> stringResource(Res.string.day_short_friday)
    DayOfWeek.SATURDAY -> stringResource(Res.string.day_short_saturday)
    DayOfWeek.SUNDAY -> stringResource(Res.string.day_short_sunday)
}
