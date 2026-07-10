package com.coachfoska.app.ui.checkin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.app.core.util.MediaCaptureMode
import com.coachfoska.designsystem.theme.DsTheme
import com.coachfoska.app.core.util.rememberGalleryPickerLauncher
import com.coachfoska.app.core.util.rememberUriBytesReader
import com.coachfoska.app.presentation.checkin.CheckInIntent
import com.coachfoska.app.presentation.checkin.CheckInState
import com.coachfoska.app.presentation.checkin.CheckInViewModel
import com.coachfoska.designsystem.components.DsButton
import com.coachfoska.designsystem.components.DsChip
import com.coachfoska.designsystem.components.DsSectionLabel
import com.coachfoska.designsystem.components.DsTextField
import com.coachfoska.designsystem.components.DsTopBar
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@Composable
fun CheckInFormRoute(
    userId: String,
    prefillExisting: Boolean,
    onBackClick: () -> Unit,
    onViewHistory: () -> Unit,
    viewModel: CheckInViewModel = koinViewModel { parametersOf(userId, prefillExisting) },
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    CheckInFormScreen(
        state = state,
        onIntent = viewModel::onIntent,
        onBackClick = onBackClick,
        onViewHistory = onViewHistory,
    )
}

@Composable
private fun CheckInFormScreen(
    state: CheckInState,
    onIntent: (CheckInIntent) -> Unit,
    onBackClick: () -> Unit,
    onViewHistory: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        DsTopBar(
            title = stringResource(Res.string.checkin_form_title),
            onBackClick = onBackClick,
            backContentDescription = stringResource(Res.string.back_cd),
            actions = {
                IconButton(onClick = onViewHistory, modifier = Modifier.size(DsTheme.sizes.touchTarget)) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = stringResource(Res.string.checkin_history_cd),
                        tint = DsTheme.colors.textPrimary,
                    )
                }
            },
        )

        if (state.submitted) {
            CheckInSuccessContent(onBackClick = onBackClick)
        } else {
            CheckInFormContent(state = state, onIntent = onIntent)
        }
    }
}

@Composable
private fun CheckInFormContent(
    state: CheckInState,
    onIntent: (CheckInIntent) -> Unit,
) {
    val form = state.form
    val readBytes = rememberUriBytesReader()
    val pickFront = rememberGalleryPickerLauncher(MediaCaptureMode.PHOTO) { uri ->
        uri?.let { readBytes(it)?.let { bytes -> onIntent(CheckInIntent.PhotoPicked("front", bytes)) } }
    }
    val pickSide = rememberGalleryPickerLauncher(MediaCaptureMode.PHOTO) { uri ->
        uri?.let { readBytes(it)?.let { bytes -> onIntent(CheckInIntent.PhotoPicked("side", bytes)) } }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = DsTheme.spacing.xl, vertical = DsTheme.spacing.xl),
            verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.xxl),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg)) {
                DsSectionLabel(text = stringResource(Res.string.checkin_section_body))
                DsTextField(
                    value = form.weightKg,
                    onValueChange = { onIntent(CheckInIntent.WeightChanged(it)) },
                    label = stringResource(Res.string.checkin_label_weight),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                DsTextField(
                    value = form.trainingAdherence,
                    onValueChange = { onIntent(CheckInIntent.TrainingAdherenceChanged(it)) },
                    label = stringResource(Res.string.checkin_label_training_sessions),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg)) {
                DsSectionLabel(text = stringResource(Res.string.checkin_section_feeling))
                RatingRow(
                    label = stringResource(Res.string.checkin_label_energy),
                    value = form.energyLevel,
                    onSelect = { onIntent(CheckInIntent.EnergyChanged(it)) },
                )
                RatingRow(
                    label = stringResource(Res.string.checkin_label_sleep),
                    value = form.sleepQuality,
                    onSelect = { onIntent(CheckInIntent.SleepChanged(it)) },
                )
                RatingRow(
                    label = stringResource(Res.string.checkin_label_stress),
                    value = form.stressLevel,
                    onSelect = { onIntent(CheckInIntent.StressChanged(it)) },
                )
                RatingRow(
                    label = stringResource(Res.string.checkin_label_nutrition_adherence),
                    value = form.nutritionAdherence,
                    onSelect = { onIntent(CheckInIntent.NutritionAdherenceChanged(it)) },
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg)) {
                DsSectionLabel(text = stringResource(Res.string.checkin_section_photos))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg),
                ) {
                    PhotoSlot(
                        label = stringResource(Res.string.checkin_photo_front),
                        isPicked = form.photoFrontPath != null,
                        modifier = Modifier.weight(1f),
                        onClick = { pickFront() },
                        enabled = !state.isUploadingPhoto && !state.isSubmitting,
                    )
                    PhotoSlot(
                        label = stringResource(Res.string.checkin_photo_side),
                        isPicked = form.photoSidePath != null,
                        modifier = Modifier.weight(1f),
                        onClick = { pickSide() },
                        enabled = !state.isUploadingPhoto && !state.isSubmitting,
                    )
                }
                if (state.isUploadingPhoto) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = DsTheme.colors.actionPrimary,
                            strokeWidth = 2.dp,
                        )
                        Text(
                            text = stringResource(Res.string.checkin_uploading_photo),
                            style = DsTheme.type.labelMedium,
                            color = DsTheme.colors.textSecondary,
                        )
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg)) {
                DsSectionLabel(text = stringResource(Res.string.checkin_section_notes))
                DsTextField(
                    value = form.notes,
                    onValueChange = { onIntent(CheckInIntent.NotesChanged(it)) },
                    label = stringResource(Res.string.checkin_notes_label),
                    singleLine = false,
                )
            }

            state.error?.let { error ->
                Text(
                    text = error,
                    style = DsTheme.type.bodySmall,
                    color = DsTheme.colors.error,
                )
            }

            DsButton(
                text = stringResource(Res.string.checkin_submit),
                onClick = { onIntent(CheckInIntent.Submit) },
                enabled = !state.isSubmitting && !state.isUploadingPhoto,
                isLoading = state.isSubmitting,
            )

            Spacer(modifier = Modifier.height(DsTheme.spacing.xxl))
        }
    }
}

@Composable
private fun CheckInSuccessContent(onBackClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(DsTheme.spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = DsTheme.colors.actionPrimary.copy(alpha = 0.12f),
            modifier = Modifier.size(72.dp),
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    tint = DsTheme.colors.actionPrimary,
                    modifier = Modifier.size(36.dp),
                )
            }
        }
        Spacer(modifier = Modifier.height(DsTheme.spacing.xl))
        Text(
            text = stringResource(Res.string.checkin_submitted_title),
            style = DsTheme.type.titleMedium,
            fontWeight = FontWeight.Bold,
            color = DsTheme.colors.textPrimary,
        )
        Spacer(modifier = Modifier.height(DsTheme.spacing.sm))
        Text(
            text = stringResource(Res.string.checkin_submitted_message),
            style = DsTheme.type.bodyMedium,
            color = DsTheme.colors.textSecondary,
        )
        Spacer(modifier = Modifier.height(DsTheme.spacing.xxl))
        DsButton(
            text = stringResource(Res.string.checkin_done),
            onClick = onBackClick,
        )
    }
}

@Composable
private fun RatingRow(
    label: String,
    value: Int?,
    onSelect: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
        Text(
            text = label,
            style = DsTheme.type.bodyMedium,
            color = DsTheme.colors.textPrimary,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm),
        ) {
            (1..5).forEach { rating ->
                DsChip(
                    selected = value == rating,
                    label = rating.toString(),
                    onClick = { onSelect(rating) },
                )
            }
        }
    }
}

@Composable
private fun PhotoSlot(
    label: String,
    isPicked: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(120.dp),
        shape = DsTheme.shapes.md,
        color = if (isPicked) DsTheme.colors.actionPrimary.copy(alpha = 0.08f) else DsTheme.colors.surface,
        border = BorderStroke(
            width = 1.dp,
            color = if (isPicked) DsTheme.colors.actionPrimary.copy(alpha = 0.4f) else DsTheme.colors.outlineSubtle,
        ),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = if (isPicked) Icons.Default.Check else Icons.Default.Image,
                contentDescription = null,
                tint = if (isPicked) DsTheme.colors.actionPrimary else DsTheme.colors.textPrimary.copy(alpha = 0.4f),
                modifier = Modifier.size(28.dp),
            )
            Spacer(modifier = Modifier.height(DsTheme.spacing.sm))
            Text(
                text = if (isPicked) {
                    stringResource(Res.string.checkin_photo_added_format, label)
                } else {
                    stringResource(Res.string.checkin_photo_pick_format, label)
                },
                style = DsTheme.type.labelSmall,
                color = if (isPicked) DsTheme.colors.actionPrimary else DsTheme.colors.textSecondary,
            )
        }
    }
}
