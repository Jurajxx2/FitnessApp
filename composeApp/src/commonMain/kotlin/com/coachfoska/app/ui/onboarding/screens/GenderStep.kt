package com.coachfoska.app.ui.onboarding.screens

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.domain.model.Gender
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.onboarding.components.SingleSelectStep
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.ob_gender_title
import coachfoska.composeapp.generated.resources.ob_gender_subtitle
import coachfoska.composeapp.generated.resources.ob_gender_male
import coachfoska.composeapp.generated.resources.ob_gender_female

@Composable
fun GenderStep(state: OnboardingState, onSelectAdvance: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val labels = mapOf(Gender.MALE to stringResource(Res.string.ob_gender_male), Gender.FEMALE to stringResource(Res.string.ob_gender_female))
    SingleSelectStep(
        title = stringResource(Res.string.ob_gender_title),
        subtitle = stringResource(Res.string.ob_gender_subtitle),
        options = listOf(Gender.MALE, Gender.FEMALE),
        selected = state.data.gender,
        onSelect = { onSelectAdvance(OnboardingIntent.SelectGender(it)) },
        modifier = modifier
    ) { gender ->
        Text(labels.getValue(gender), style = MaterialTheme.typography.titleMedium, color = DsTheme.colors.textPrimary, modifier = Modifier.fillMaxWidth())
    }
}
