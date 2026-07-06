package com.coachfoska.app.ui.onboarding.screens

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.coachfoska.app.domain.model.Equipment
import com.coachfoska.app.presentation.onboarding.OnboardingIntent
import com.coachfoska.app.presentation.onboarding.OnboardingState
import com.coachfoska.app.ui.onboarding.components.SingleSelectStep
import org.jetbrains.compose.resources.stringResource
import coachfoska.composeapp.generated.resources.*

@Composable
fun EquipmentStep(state: OnboardingState, onSelectAdvance: (OnboardingIntent) -> Unit, modifier: Modifier = Modifier) {
    val titles = mapOf(
        Equipment.NO_EQUIPMENT to stringResource(Res.string.ob_equipment_none),
        Equipment.DUMBBELLS to stringResource(Res.string.ob_equipment_dumbbells),
        Equipment.HOME_GYM to stringResource(Res.string.ob_equipment_home_gym),
        Equipment.FULL_GYM to stringResource(Res.string.ob_equipment_full_gym)
    )
    val descs = mapOf(
        Equipment.NO_EQUIPMENT to stringResource(Res.string.ob_equipment_none_desc),
        Equipment.DUMBBELLS to stringResource(Res.string.ob_equipment_dumbbells_desc),
        Equipment.HOME_GYM to stringResource(Res.string.ob_equipment_home_gym_desc),
        Equipment.FULL_GYM to stringResource(Res.string.ob_equipment_full_gym_desc)
    )
    SingleSelectStep(
        title = stringResource(Res.string.ob_equipment_title),
        subtitle = stringResource(Res.string.ob_equipment_subtitle),
        options = listOf(Equipment.NO_EQUIPMENT, Equipment.DUMBBELLS, Equipment.HOME_GYM, Equipment.FULL_GYM),
        selected = state.data.equipment,
        onSelect = { onSelectAdvance(OnboardingIntent.SelectEquipment(it)) },
        modifier = modifier
    ) { eq ->
        Column {
            Text(titles.getValue(eq), style = MaterialTheme.typography.titleMedium, color = DsTheme.colors.textPrimary)
            Text(descs.getValue(eq), style = MaterialTheme.typography.bodySmall, color = DsTheme.colors.textSecondary)
        }
    }
}
