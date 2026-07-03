package com.coachfoska.app.ui.onboarding.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import com.coachfoska.app.domain.model.MuscleGroup
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.theme.Spacing
import com.coachfoska.app.ui.components.CoachButton
import com.coachfoska.app.ui.onboarding.components.BodyMapSelector
import com.coachfoska.app.ui.onboarding.components.SelectableChip
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun FocusAreasStep(state: OnboardingState, onIntent: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val labels: Map<MuscleGroup, String> = mapOf(
        MuscleGroup.CHEST to stringResource(Res.string.ob_focus_chest),
        MuscleGroup.BACK to stringResource(Res.string.ob_focus_back),
        MuscleGroup.SHOULDERS to stringResource(Res.string.ob_focus_shoulders),
        MuscleGroup.ARMS to stringResource(Res.string.ob_focus_arms),
        MuscleGroup.ABS to stringResource(Res.string.ob_focus_abs),
        MuscleGroup.LEGS to stringResource(Res.string.ob_focus_legs),
        MuscleGroup.GLUTES to stringResource(Res.string.ob_focus_glutes),
        MuscleGroup.FULL_BODY to stringResource(Res.string.ob_focus_full_body)
    )
    Column(modifier.fillMaxSize().padding(top = Spacing.lg, bottom = Spacing.xl)) {
        Text(stringResource(Res.string.ob_focus_title), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
        Text(stringResource(Res.string.ob_focus_subtitle), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = Spacing.sm, bottom = Spacing.lg))
        Row(Modifier.weight(1f)) {
            BodyMapSelector(
                selected = state.data.focusAreas,
                onToggle = { onIntent(OnboardingIntent.ToggleFocusArea(it)) },
                modifier = Modifier.weight(1f)
            )
            FlowRow(Modifier.weight(1f).padding(start = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                MuscleGroup.entries.forEach { group ->
                    SelectableChip(
                        text = labels.getValue(group),
                        selected = group in state.data.focusAreas,
                        onClick = { onIntent(OnboardingIntent.ToggleFocusArea(group)) }
                    )
                }
            }
        }
        CoachButton(
            text = stringResource(Res.string.ob_continue),
            onClick = { onIntent(OnboardingIntent.NextStep) },
            enabled = state.data.focusAreas.isNotEmpty(),
            shape = RectangleShape,
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.lg)
        )
    }
}
