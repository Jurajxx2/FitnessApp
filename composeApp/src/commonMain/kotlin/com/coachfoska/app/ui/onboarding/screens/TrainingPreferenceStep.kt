package com.coachfoska.app.ui.onboarding.screens

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.domain.model.TrainingPreference
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.onboarding.components.SingleSelectStep
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun TrainingPreferenceStep(state: OnboardingState, onSelectAdvance: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val titles = mapOf(
        TrainingPreference.WITH_COACH to stringResource(Res.string.ob_training_with_coach),
        TrainingPreference.SELF_GUIDED to stringResource(Res.string.ob_training_self),
        TrainingPreference.BOTH to stringResource(Res.string.ob_training_both)
    )
    val descs = mapOf(
        TrainingPreference.WITH_COACH to stringResource(Res.string.ob_training_with_coach_desc),
        TrainingPreference.SELF_GUIDED to stringResource(Res.string.ob_training_self_desc),
        TrainingPreference.BOTH to stringResource(Res.string.ob_training_both_desc)
    )
    SingleSelectStep(
        title = stringResource(Res.string.ob_training_title),
        subtitle = stringResource(Res.string.ob_training_subtitle),
        options = listOf(TrainingPreference.WITH_COACH, TrainingPreference.SELF_GUIDED, TrainingPreference.BOTH),
        selected = state.data.trainingPreference,
        onSelect = { onSelectAdvance(OnboardingIntent.SelectTrainingPreference(it)) },
        modifier = modifier
    ) { pref ->
        Column {
            Text(titles.getValue(pref), style = MaterialTheme.typography.titleMedium, color = DsTheme.colors.textPrimary)
            Text(descs.getValue(pref), style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
        }
    }
}
