package com.coachfoska.app.ui.hydration

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_cancel
import coachfoska.composeapp.generated.resources.common_delete
import coachfoska.composeapp.generated.resources.common_favorite_cd
import coachfoska.composeapp.generated.resources.home_water_label
import coachfoska.composeapp.generated.resources.hydration_active_from
import coachfoska.composeapp.generated.resources.hydration_active_until
import coachfoska.composeapp.generated.resources.hydration_add
import coachfoska.composeapp.generated.resources.hydration_custom
import coachfoska.composeapp.generated.resources.hydration_custom_amount_title
import coachfoska.composeapp.generated.resources.hydration_enable_reminders
import coachfoska.composeapp.generated.resources.hydration_manage
import coachfoska.composeapp.generated.resources.hydration_amount_ml_format
import coachfoska.composeapp.generated.resources.hydration_ml
import coachfoska.composeapp.generated.resources.hydration_quick_add
import coachfoska.composeapp.generated.resources.hydration_remind_every
import coachfoska.composeapp.generated.resources.hydration_reminders
import coachfoska.composeapp.generated.resources.hydration_smart_suppress
import coachfoska.composeapp.generated.resources.hydration_smart_suppress_subtitle
import coachfoska.composeapp.generated.resources.hydration_todays_log
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.presentation.hydration.HydrationIntent
import com.coachfoska.app.presentation.hydration.HydrationState
import com.coachfoska.app.presentation.hydration.HydrationViewModel
import com.coachfoska.app.ui.components.CoachTopBar
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun HydrationRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: HydrationViewModel = koinViewModel { parametersOf(userId) }
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HydrationScreen(state = state, onIntent = viewModel::onIntent, onBackClick = onBackClick)
}

@Composable
fun HydrationScreen(
    state: HydrationState,
    onIntent: (HydrationIntent) -> Unit,
    onBackClick: () -> Unit
) {
    if (state.showCustomAmountDialog) {
        CustomAmountDialog(
            onConfirm = { amount ->
                onIntent(HydrationIntent.DismissCustomAmountDialog)
                if (amount > 0) onIntent(HydrationIntent.LogWater(amount))
            },
            onDismiss = { onIntent(HydrationIntent.DismissCustomAmountDialog) }
        )
    }
    if (state.showManageContainersSheet) {
        com.coachfoska.app.ui.hydration.components.ManageContainersSheet(
            containers = state.containers,
            onAdd = { name, volume -> onIntent(HydrationIntent.AddContainer(name, volume)) },
            onDelete = { id -> onIntent(HydrationIntent.DeleteContainer(id)) },
            onToggleFavorite = { id, fav -> onIntent(HydrationIntent.ToggleFavoriteContainer(id, fav)) },
            onDismiss = { onIntent(HydrationIntent.DismissManageContainersSheet) },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        CoachTopBar(title = stringResource(Res.string.home_water_label), onBackClick = onBackClick)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp)
        ) {
            com.coachfoska.app.ui.hydration.components.WaterFillAnimation(
                fraction = state.progressFraction,
                consumedMl = state.consumedMl,
                goalMl = state.goalMl,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
            ContainerQuickAddSection(
                containers = state.containers,
                onIntent = onIntent,
            )
            if (state.todayLogs.isNotEmpty()) {
                TodayLogSection(logs = state.todayLogs, onDelete = { onIntent(HydrationIntent.DeleteLog(it)) })
            }
            ReminderSettingsSection(settings = state.settings, onUpdate = { onIntent(HydrationIntent.UpdateSettings(it)) })
            state.error?.let {
                Text(text = it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TodayLogSection(logs: List<WaterLog>, onDelete: (String) -> Unit) {
    val deleteLabel = stringResource(Res.string.common_delete)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = stringResource(Res.string.hydration_todays_log),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        logs.forEach { log ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(Res.string.hydration_amount_ml_format, log.amountMl),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    val local = log.loggedAt.toLocalDateTime(TimeZone.currentSystemDefault())
                    Text(
                        text = "${local.hour.toString().padStart(2,'0')}:${local.minute.toString().padStart(2,'0')}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)
                    )
                    IconButton(onClick = { onDelete(log.id) }) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = deleteLabel,
                            tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReminderSettingsSection(settings: HydrationSettings, onUpdate: (HydrationSettings) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Text(
            text = stringResource(Res.string.hydration_reminders),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        Spacer(Modifier.height(10.dp))
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.03f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column {
                SettingsToggleRow(
                    label = stringResource(Res.string.hydration_enable_reminders),
                    checked = settings.remindersEnabled,
                    onCheckedChange = { onUpdate(settings.copy(remindersEnabled = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = stringResource(Res.string.hydration_remind_every),
                    value = intervalLabel(settings.intervalMinutes),
                    enabled = settings.remindersEnabled,
                    options = listOf(30, 60, 120, 180, 240),
                    optionLabel = ::intervalLabel,
                    onSelect = { onUpdate(settings.copy(intervalMinutes = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = stringResource(Res.string.hydration_active_from),
                    value = "${settings.startHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (5..12).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(startHour = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = stringResource(Res.string.hydration_active_until),
                    value = "${settings.endHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (18..23).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(endHour = it)) },
                    showDivider = true
                )
                SettingsToggleRow(
                    label = stringResource(Res.string.hydration_smart_suppress),
                    subtitle = stringResource(Res.string.hydration_smart_suppress_subtitle),
                    checked = settings.smartSuppress,
                    onCheckedChange = { onUpdate(settings.copy(smartSuppress = it)) },
                    enabled = settings.remindersEnabled,
                    showDivider = false
                )
            }
        }
    }
}

private fun intervalLabel(minutes: Int): String = when {
    minutes < 60 -> "$minutes min"
    minutes == 60 -> "1 hour"
    else -> "${minutes / 60} hours"
}

@Composable
private fun SettingsToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    enabled: Boolean = true,
    showDivider: Boolean = true
) {
    Column {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = if (enabled) 1f else 0.4f))
                subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f)) }
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
        }
        if (showDivider) HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}

@Composable
private fun <T> SettingsPickerRow(
    label: String,
    value: String,
    enabled: Boolean,
    options: List<T>,
    optionLabel: (T) -> String,
    onSelect: (T) -> Unit,
    showDivider: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onBackground.copy(alpha = if (enabled) 1f else 0.4f))
            Box {
                TextButton(onClick = { if (enabled) expanded = true }) {
                    Text(value, color = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f))
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(optionLabel(option)) },
                            onClick = { onSelect(option); expanded = false }
                        )
                    }
                }
            }
        }
        if (showDivider) HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}

@Composable
private fun ContainerQuickAddSection(
    containers: List<com.coachfoska.app.domain.model.WaterContainer>,
    onIntent: (HydrationIntent) -> Unit,
) {
    val mlLabel = stringResource(Res.string.hydration_ml)
    val customLabel = stringResource(Res.string.hydration_custom)
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(Res.string.hydration_quick_add),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
                letterSpacing = 2.sp,
            )
            TextButton(onClick = { onIntent(HydrationIntent.ShowManageContainersSheet) }) {
                Text(stringResource(Res.string.hydration_manage), style = MaterialTheme.typography.labelMedium)
            }
        }
        Spacer(Modifier.height(10.dp))
        if (containers.isEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(150, 250, 500).forEach { amount ->
                    OutlinedButton(
                        onClick = { onIntent(HydrationIntent.LogWater(amount)) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$amount", fontWeight = FontWeight.Bold)
                            Text(mlLabel, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                OutlinedButton(
                    onClick = { onIntent(HydrationIntent.ShowCustomAmountDialog) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("+", fontWeight = FontWeight.Bold)
                        Text(customLabel, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                containers.take(3).forEach { container ->
                    com.coachfoska.app.ui.hydration.components.ContainerQuickAddButton(
                        container = container,
                        onClick = { onIntent(HydrationIntent.LogFromContainer(container.id)) },
                        modifier = Modifier.weight(1f),
                    )
                }
                OutlinedButton(
                    onClick = { onIntent(HydrationIntent.ShowCustomAmountDialog) },
                    modifier = Modifier.weight(1f).height(96.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("+", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                        Text(customLabel, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomAmountDialog(onConfirm: (Int) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(Res.string.hydration_custom_amount_title)) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.filter { c -> c.isDigit() }.take(4) },
                label = { Text(stringResource(Res.string.hydration_ml)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(text.toIntOrNull() ?: 0) }) {
                Text(stringResource(Res.string.hydration_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(Res.string.common_cancel)) }
        }
    )
}
