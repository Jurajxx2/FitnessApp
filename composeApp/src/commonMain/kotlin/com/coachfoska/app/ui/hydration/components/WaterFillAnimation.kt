package com.coachfoska.app.ui.hydration.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.sin
import kotlinx.coroutines.delay

@Composable
fun WaterFillAnimation(
    fraction: Float,
    consumedMl: Int,
    goalMl: Int,
    modifier: Modifier = Modifier,
    waterColor: Color = MaterialTheme.colorScheme.primary,
    trackColor: Color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.06f),
) {
    val targetFraction = fraction.coerceIn(0f, 1f)
    val animatedFraction by animateFloatAsState(
        targetValue = targetFraction,
        animationSpec = tween(durationMillis = 800),
        label = "fill",
    )

    val phaseState = remember { mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) {
        var currentPhase = 0f
        while (true) {
            currentPhase = (currentPhase + 0.05f) % (2 * PI).toFloat()
            phaseState.floatValue = currentPhase
            delay(16)
        }
    }

    Box(modifier = modifier.size(180.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(180.dp)) {
            val w = size.width
            val h = size.height
            val cornerRadius = w * 0.3f

            val bottlePath = Path().apply {
                addRoundRect(
                    androidx.compose.ui.geometry.RoundRect(
                        rect = androidx.compose.ui.geometry.Rect(Offset.Zero, Size(w, h)),
                        radiusX = cornerRadius,
                        radiusY = cornerRadius,
                    ),
                )
            }

            drawPath(path = bottlePath, color = trackColor)

            clipPath(bottlePath) {
                val baseline = h * (1f - animatedFraction)
                val amplitude = h * 0.04f
                val wavelength = w * 1.1f

                val wave = Path().apply {
                    moveTo(0f, baseline)
                    var x = 0f
                    val step = 4f
                    while (x <= w) {
                        val y = baseline + amplitude * sin((x / wavelength) * 2f * PI.toFloat() + phaseState.floatValue).toFloat()
                        lineTo(x, y)
                        x += step
                    }
                    lineTo(w, h)
                    lineTo(0f, h)
                    close()
                }
                drawPath(path = wave, color = waterColor)

                val wave2 = Path().apply {
                    moveTo(0f, baseline + amplitude * 0.5f)
                    var x = 0f
                    val step = 4f
                    while (x <= w) {
                        val y = baseline + amplitude * 0.5f * sin((x / wavelength) * 2f * PI.toFloat() - phaseState.floatValue * 1.3f).toFloat()
                        lineTo(x, y)
                        x += step
                    }
                    lineTo(w, h)
                    lineTo(0f, h)
                    close()
                }
                drawPath(path = wave2, color = waterColor.copy(alpha = 0.55f))
            }
        }

        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = consumedMl.toString(),
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "/ $goalMl ml",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            )
        }
    }
}
