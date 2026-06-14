package com.coachfoska.app.ui.onboarding.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import com.coachfoska.app.domain.model.MuscleGroup

/**
 * Simplified front-facing body map. Each muscle group maps to a normalized rectangle (0..1 in both
 * axes). Tapping inside a rect toggles that group. Selected rects fill with [selectedColor].
 */
private val REGIONS: List<Pair<MuscleGroup, Rect>> = listOf(
    MuscleGroup.SHOULDERS to Rect(0.20f, 0.18f, 0.80f, 0.26f),
    MuscleGroup.CHEST to Rect(0.28f, 0.26f, 0.72f, 0.36f),
    MuscleGroup.ARMS to Rect(0.10f, 0.26f, 0.24f, 0.50f),
    MuscleGroup.BACK to Rect(0.76f, 0.26f, 0.90f, 0.50f), // mirrored arm slot reused as "back" tap target
    MuscleGroup.ABS to Rect(0.34f, 0.36f, 0.66f, 0.52f),
    MuscleGroup.GLUTES to Rect(0.32f, 0.52f, 0.68f, 0.60f),
    MuscleGroup.LEGS to Rect(0.30f, 0.60f, 0.70f, 0.92f)
)

@Composable
fun BodyMapSelector(
    selected: Set<MuscleGroup>,
    onToggle: (MuscleGroup) -> Unit,
    modifier: Modifier = Modifier
) {
    val selectedColor = MaterialTheme.colorScheme.primary
    val baseColor = MaterialTheme.colorScheme.surface
    val outline = MaterialTheme.colorScheme.outline

    Canvas(
        modifier
            .fillMaxWidth()
            .aspectRatio(0.5f)
            .pointerInput(Unit) {
                detectTapGestures { tap ->
                    val nx = tap.x / size.width
                    val ny = tap.y / size.height
                    REGIONS.firstOrNull { (_, r) -> nx in r.left..r.right && ny in r.top..r.bottom }
                        ?.let { onToggle(it.first) }
                }
            }
    ) {
        REGIONS.forEach { (group, r) ->
            val isOn = group in selected || MuscleGroup.FULL_BODY in selected
            val topLeft = Offset(r.left * size.width, r.top * size.height)
            val rectSize = Size((r.right - r.left) * size.width, (r.bottom - r.top) * size.height)
            drawRect(color = if (isOn) selectedColor else baseColor, topLeft = topLeft, size = rectSize)
            drawRect(color = outline, topLeft = topLeft, size = rectSize, style = androidx.compose.ui.graphics.drawscope.Stroke(2f))
        }
    }
}
