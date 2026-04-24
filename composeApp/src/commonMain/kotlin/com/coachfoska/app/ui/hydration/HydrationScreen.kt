package com.coachfoska.app.ui.hydration

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.domain.model.HydrationSettings
import com.coachfoska.app.domain.model.WaterLog
import com.coachfoska.app.presentation.hydration.HydrationIntent
import com.coachfoska.app.presentation.hydration.HydrationState
import com.coachfoska.app.presentation.hydration.HydrationViewModel
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(28.dp)
    ) {
        Text(
            text = "WATER",
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        WaterProgressRing(
            consumed = state.consumedMl,
            goal = state.goalMl,
            fraction = state.progressFraction,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )

        QuickAddButtons(onIntent = onIntent)

        if (state.todayLogs.isNotEmpty()) {
            TodayLogSection(logs = state.todayLogs, onDelete = { onIntent(HydrationIntent.DeleteLog(it)) })
        }

        ReminderSettingsSection(settings = state.settings, onUpdate = { onIntent(HydrationIntent.UpdateSettings(it)) })

        state.error?.let {
            Text(text = it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun WaterProgressRing(consumed: Int, goal: Int, fraction: Float, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(160.dp)) {
            CircularProgressIndicator(
                progress = { fraction },
                modifier = Modifier.fillMaxSize(),
                strokeWidth = 10.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.06f)
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = consumed.toString(),
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "/ $goal ml",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                )
                Text(
                    text = "${(fraction * 100).toInt()}%",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        val remaining = (goal - consumed).coerceAtLeast(0)
        Text(
            text = if (remaining > 0) "$remaining ml remaining" else "Goal reached!",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun QuickAddButtons(onIntent: (HydrationIntent) -> Unit) {
    Column {
        Text(
            text = "QUICK ADD",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            letterSpacing = 2.sp
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(150, 250, 500).forEach { amount ->
                val isPrimary = amount == 250
                Button(
                    onClick = { onIntent(HydrationIntent.LogWater(amount)) },
                    modifier = Modifier.weight(1f),
                    colors = if (isPrimary) ButtonDefaults.buttonColors()
                             else ButtonDefaults.outlinedButtonColors(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$amount", fontWeight = FontWeight.Bold)
                        Text("ml", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            OutlinedButton(
                onClick = { onIntent(HydrationIntent.ShowCustomAmountDialog) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("+", fontWeight = FontWeight.Bold)
                    Text("custom", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun TodayLogSection(logs: List<WaterLog>, onDelete: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "TODAY'S LOG",
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
                        text = "${log.amountMl} ml",
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
                            contentDescription = "Delete",
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
            text = "REMINDERS",
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
                    label = "Enable reminders",
                    checked = settings.remindersEnabled,
                    onCheckedChange = { onUpdate(settings.copy(remindersEnabled = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Remind every",
                    value = intervalLabel(settings.intervalMinutes),
                    enabled = settings.remindersEnabled,
                    options = listOf(30, 60, 120, 180, 240),
                    optionLabel = ::intervalLabel,
                    onSelect = { onUpdate(settings.copy(intervalMinutes = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Active from",
                    value = "${settings.startHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (5..12).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(startHour = it)) },
                    showDivider = true
                )
                SettingsPickerRow(
                    label = "Active until",
                    value = "${settings.endHour}:00",
                    enabled = settings.remindersEnabled,
                    options = (18..23).toList(),
                    optionLabel = { "$it:00" },
                    onSelect = { onUpdate(settings.copy(endHour = it)) },
                    showDivider = true
                )
                SettingsToggleRow(
                    label = "Smart suppress",
                    subtitle = "Skip if goal reached or recently logged",
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
        if (showDivider) HorizontalDivider(color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f))
    }
}

@Composable
private fun CustomAmountDialog(onConfirm: (Int) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Custom amount") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.filter { c -> c.isDigit() }.take(4) },
                label = { Text("ml") },
                singleLine = true
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(text.toIntOrNull() ?: 0) }) { Text("Add") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
