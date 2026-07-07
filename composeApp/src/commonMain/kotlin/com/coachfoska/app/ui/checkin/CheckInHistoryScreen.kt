package com.coachfoska.app.ui.checkin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.coachfoska.app.core.util.toDisplayDateTime
import com.coachfoska.app.core.util.toDisplayString
import com.coachfoska.app.domain.model.CheckIn
import com.coachfoska.app.presentation.checkin.CheckInState
import com.coachfoska.app.presentation.checkin.CheckInViewModel
import com.coachfoska.designsystem.components.DsCard
import com.coachfoska.designsystem.components.DsEmptyState
import com.coachfoska.designsystem.components.DsLoadingBox
import com.coachfoska.designsystem.components.DsTopBar
import com.coachfoska.designsystem.theme.DsTheme
import kotlinx.datetime.Instant
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun CheckInHistoryRoute(
    userId: String,
    onBackClick: () -> Unit,
    viewModel: CheckInViewModel = koinViewModel { parametersOf(userId) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    CheckInHistoryScreen(state = state, onBackClick = onBackClick)
}

@Composable
fun CheckInHistoryScreen(
    state: CheckInState,
    onBackClick: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        DsTopBar(
            title = "Check-in history",
            onBackClick = onBackClick,
            backContentDescription = "Back",
        )
        when {
            state.isLoading -> DsLoadingBox(Modifier.weight(1f))
            state.history.isEmpty() -> DsEmptyState(
                icon = Icons.Default.History,
                title = "No check-ins yet",
                message = "Submit your first weekly check-in to start building your history.",
                modifier = Modifier.padding(top = DsTheme.spacing.xl),
            )
            else -> LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = DsTheme.spacing.xl, vertical = DsTheme.spacing.xl),
                verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg),
            ) {
                items(state.history, key = { it.id }) { checkIn ->
                    CheckInHistoryCard(checkIn = checkIn)
                }
            }
        }
    }
}

@Composable
private fun CheckInHistoryCard(checkIn: CheckIn) {
    DsCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(DsTheme.spacing.lg),
            verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.md),
        ) {
            Text(
                text = checkIn.weekOf.toDisplayString(),
                style = DsTheme.type.titleMedium,
                color = DsTheme.colors.textPrimary,
            )

            Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                MetricRow(label = "Energy", value = checkIn.energyLevel?.let { "$it/5" })
                MetricRow(label = "Sleep quality", value = checkIn.sleepQuality?.let { "$it/5" })
                MetricRow(label = "Stress", value = checkIn.stressLevel?.let { "$it/5" })
                MetricRow(label = "Training adherence", value = checkIn.trainingAdherence?.let { "$it sessions" })
                MetricRow(label = "Nutrition adherence", value = checkIn.nutritionAdherence?.let { "$it/5" })
            }

            checkIn.notes?.takeIf { it.isNotBlank() }?.let { notes ->
                Text(
                    text = notes,
                    style = DsTheme.type.bodyMedium,
                    color = DsTheme.colors.textSecondary,
                )
            }

            if (checkIn.photoFrontPath != null || checkIn.photoSidePath != null) {
                Text(
                    text = "📷 Photos attached",
                    style = DsTheme.type.labelMedium,
                    color = DsTheme.colors.textSecondary,
                )
            }

            checkIn.coachResponse?.let { response ->
                CoachResponseBlock(response = response, respondedAt = checkIn.coachResponseAt)
            }
        }
    }
}

@Composable
private fun MetricRow(label: String, value: String?) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = DsTheme.type.bodySmall,
            color = DsTheme.colors.textSecondary,
        )
        Text(
            text = value ?: "—",
            style = DsTheme.type.bodySmall,
            color = DsTheme.colors.textPrimary,
        )
    }
}

@Composable
private fun CoachResponseBlock(response: String, respondedAt: Instant?) {
    DsCard(
        modifier = Modifier.fillMaxWidth(),
        containerColor = DsTheme.colors.surfaceElevated,
    ) {
        Column(
            modifier = Modifier.padding(DsTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.xs),
        ) {
            Text(
                text = "Coach response",
                style = DsTheme.type.labelSmall,
                color = DsTheme.colors.textAccent,
            )
            Text(
                text = response,
                style = DsTheme.type.bodyMedium,
                color = DsTheme.colors.textPrimary,
            )
            respondedAt?.let {
                Text(
                    text = it.toDisplayDateTime(),
                    style = DsTheme.type.labelSmall,
                    color = DsTheme.colors.textSecondary,
                )
            }
        }
    }
}
