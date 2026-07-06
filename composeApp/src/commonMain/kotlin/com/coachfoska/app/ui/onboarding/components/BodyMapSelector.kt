package com.coachfoska.app.ui.onboarding.components

import com.coachfoska.designsystem.theme.DsTheme

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathHitTester
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.app.domain.model.MuscleGroup
import kotlin.math.min

/** A region with its SVG path pre-parsed into a [Path] (in 0..724 / 0..1448 viewBox space). */
private class ParsedRegion(
    val group: MuscleGroup?,
    val path: Path,
    val hitTester: PathHitTester?, // non-null only for selectable (group != null) regions
)

private fun parseRegions(view: BodyView): List<ParsedRegion> =
    BODY_REGIONS.filter { it.view == view }.map { region ->
        val combined = Path()
        region.paths.forEach { svg ->
            val p = PathParser().parsePathString(svg).toPath()
            if (view == BodyView.BACK) p.translate(Offset(-BODY_BACK_OFFSET_X, 0f))
            combined.addPath(p)
        }
        ParsedRegion(
            group = region.group,
            path = combined,
            hitTester = if (region.group != null) PathHitTester(combined) else null,
        )
    }

/**
 * Anatomical front/back body map. Muscle regions come from MIT-licensed SVG path data
 * (see [BodyRegions]); taps are resolved with [PathHitTester]. Selecting a region toggles its
 * [MuscleGroup]. Non-muscle regions (head, hands, feet…) are drawn as a static silhouette.
 */
@Composable
fun BodyMapSelector(
    selected: Set<MuscleGroup>,
    onToggle: (MuscleGroup) -> Unit,
    modifier: Modifier = Modifier,
) {
    var view by remember { mutableStateOf(BodyView.FRONT) }
    val regions = remember(view) { parseRegions(view) }

    // Derive from onBackground so contrast holds in both themes (surfaceVariant is nearly
    // invisible on the dark background). Tiers: faint silhouette < visible base < bright selected.
    val onBg = MaterialTheme.colorScheme.onBackground
    val selectedColor = MaterialTheme.colorScheme.primary
    val baseColor = onBg.copy(alpha = 0.20f)
    val silhouetteColor = onBg.copy(alpha = 0.08f)
    val outlineColor = onBg.copy(alpha = 0.38f)
    val fullBody = MuscleGroup.FULL_BODY in selected

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        ViewToggle(view = view, onViewChange = { view = it })

        Canvas(
            Modifier
                .weight(1f)
                .padding(top = DsTheme.spacing.sm)
                // Size from the available height so the tall figure never overflows its row.
                .aspectRatio(BODY_VIEWBOX_WIDTH / BODY_VIEWBOX_HEIGHT, matchHeightConstraintsFirst = true)
                .pointerInput(regions) {
                    detectTapGestures { tap ->
                        val scale = min(size.width / BODY_VIEWBOX_WIDTH, size.height / BODY_VIEWBOX_HEIGHT)
                        val offsetX = (size.width - BODY_VIEWBOX_WIDTH * scale) / 2f
                        val offsetY = (size.height - BODY_VIEWBOX_HEIGHT * scale) / 2f
                        val vb = Offset((tap.x - offsetX) / scale, (tap.y - offsetY) / scale)
                        regions.firstOrNull { it.hitTester != null && vb in it.hitTester }
                            ?.group?.let(onToggle)
                    }
                }
        ) {
            val scale = min(size.width / BODY_VIEWBOX_WIDTH, size.height / BODY_VIEWBOX_HEIGHT)
            val offsetX = (size.width - BODY_VIEWBOX_WIDTH * scale) / 2f
            val offsetY = (size.height - BODY_VIEWBOX_HEIGHT * scale) / 2f
            val strokeVb = 1.5.dp.toPx() / scale

            translate(offsetX, offsetY) {
                scale(scale, scale, pivot = Offset.Zero) {
                    regions.forEach { r ->
                        val fill = when {
                            r.group == null -> silhouetteColor
                            r.group in selected || fullBody -> selectedColor
                            else -> baseColor
                        }
                        drawPath(r.path, color = fill)
                        drawPath(r.path, color = outlineColor, style = Stroke(width = strokeVb))
                    }
                }
            }
        }
    }
}

@Composable
private fun ViewToggle(view: BodyView, onViewChange: (BodyView) -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        ToggleSegment("FRONT", view == BodyView.FRONT) { onViewChange(BodyView.FRONT) }
        ToggleSegment("BACK", view == BodyView.BACK) { onViewChange(BodyView.BACK) }
    }
}

@Composable
private fun ToggleSegment(label: String, active: Boolean, onClick: () -> Unit) {
    val bg by animateColorAsState(
        if (active) MaterialTheme.colorScheme.primary else Color.Transparent,
        animationSpec = tween(150),
    )
    val fg = if (active) MaterialTheme.colorScheme.onPrimary
    else MaterialTheme.colorScheme.onSurfaceVariant
    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = fg,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 6.dp),
    )
}
