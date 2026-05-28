package com.coachfoska.app.ui.workout

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.coachfoska.app.presentation.workout.SetDraft
import com.coachfoska.app.ui.components.CoachTextField

@Composable
internal fun SetInputRow(
    setDraft: SetDraft,
    onActualReps: (Int?) -> Unit,
    onActualWeight: (Float?) -> Unit,
    onRpe: (Int?) -> Unit,
    onCompleted: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "SET ${setDraft.sortOrder}",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.width(56.dp),
        )
        CoachTextField(
            value = setDraft.actualReps?.toString() ?: "",
            onValueChange = { onActualReps(it.toIntOrNull()) },
            label = "Reps",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(72.dp),
        )
        Spacer(Modifier.width(8.dp))
        CoachTextField(
            value = setDraft.actualWeightKg?.toString() ?: "",
            onValueChange = { onActualWeight(it.toFloatOrNull()) },
            label = "kg",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.width(80.dp),
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Slider(
                value = (setDraft.rpe ?: 5).toFloat(),
                onValueChange = { onRpe(it.toInt()) },
                valueRange = 1f..10f,
                steps = 8,
            )
            Text(
                text = "RPE ${setDraft.rpe ?: "-"}",
                style = MaterialTheme.typography.labelSmall,
            )
        }
        Checkbox(checked = setDraft.completed, onCheckedChange = { onCompleted() })
    }
}
