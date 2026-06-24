package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.onboarding.components.WeekdayPicker
import com.coachfoska.app.ui.onboarding.rememberNotificationPermissionRequester
import kotlinx.datetime.DayOfWeek
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun FrequencyStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val dayLabels = listOf(
        DayOfWeek.MONDAY to stringResource(Res.string.ob_day_mon),
        DayOfWeek.TUESDAY to stringResource(Res.string.ob_day_tue),
        DayOfWeek.WEDNESDAY to stringResource(Res.string.ob_day_wed),
        DayOfWeek.THURSDAY to stringResource(Res.string.ob_day_thu),
        DayOfWeek.FRIDAY to stringResource(Res.string.ob_day_fri),
        DayOfWeek.SATURDAY to stringResource(Res.string.ob_day_sat),
        DayOfWeek.SUNDAY to stringResource(Res.string.ob_day_sun)
    )
    val freq = state.data.frequencyPerWeek
    // Czech plural: 1 -> den, 2..4 -> dny, 0 and 5+ -> dní.
    val countCaption = when (freq) {
        1 -> stringResource(Res.string.ob_days_count_one, freq)
        in 2..4 -> stringResource(Res.string.ob_days_count_few, freq)
        else -> stringResource(Res.string.ob_days_count_many, freq)
    }
    val permissionRequester = rememberNotificationPermissionRequester()

    Column(modifier.fillMaxSize().padding(top = 16.dp, bottom = 24.dp)) {
        Text(
            stringResource(Res.string.ob_frequency_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            stringResource(Res.string.ob_frequency_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
        )
        WeekdayPicker(
            selected = state.data.trainingDays,
            dayLabels = dayLabels,
            onToggle = { onIntent(OnboardingIntent.ToggleTrainingDay(it)) }
        )
        Text(
            countCaption,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        )
        Spacer(Modifier.height(24.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val wantOn = !state.data.notificationsEnabled
                    if (wantOn) {
                        permissionRequester.request { granted ->
                            onIntent(OnboardingIntent.SetNotificationsEnabled(granted))
                        }
                    } else {
                        onIntent(OnboardingIntent.SetNotificationsEnabled(false))
                    }
                }
        ) {
            Checkbox(
                checked = state.data.notificationsEnabled,
                onCheckedChange = null
            )
            Text(
                stringResource(Res.string.ob_days_notify),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
        Spacer(Modifier.weight(1f))
        CoachButton(
            text = stringResource(Res.string.ob_continue),
            onClick = { onIntent(OnboardingIntent.NextStep) },
            enabled = state.data.trainingDays.isNotEmpty(),
            shape = RectangleShape,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
