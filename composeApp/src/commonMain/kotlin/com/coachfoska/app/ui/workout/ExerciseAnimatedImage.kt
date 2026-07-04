package com.coachfoska.app.ui.workout

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage

enum class AnimatedImageMode { ANIMATED, STATIC, NONE }

fun animatedImageMode(startUrl: String?, endUrl: String?): AnimatedImageMode =
    when {
        startUrl != null && endUrl != null -> AnimatedImageMode.ANIMATED
        startUrl != null || endUrl != null -> AnimatedImageMode.STATIC
        else -> AnimatedImageMode.NONE
    }

@Composable
fun ExerciseAnimatedImage(
    startUrl: String?,
    endUrl: String?,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    val box = @Composable { content: @Composable () -> Unit ->
        Box(
            modifier = modifier
                .aspectRatio(1f)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f))
        ) { content() }
    }

    when (animatedImageMode(startUrl, endUrl)) {
        AnimatedImageMode.NONE -> Unit

        AnimatedImageMode.STATIC -> box {
            AsyncImage(
                model = startUrl ?: endUrl,
                contentDescription = contentDescription,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }

        AnimatedImageMode.ANIMATED -> {
            val transition = rememberInfiniteTransition(label = "rep")
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 0f,
                animationSpec = infiniteRepeatable(
                    animation = keyframes {
                        durationMillis = 3600
                        0f at 0
                        0f at 600
                        1f at 1800 using FastOutSlowInEasing
                        1f at 2400
                        0f at 3600 using FastOutSlowInEasing
                    },
                    repeatMode = RepeatMode.Restart
                ),
                label = "progress"
            )
            box {
                AsyncImage(
                    model = startUrl,
                    contentDescription = contentDescription,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
                AsyncImage(
                    model = endUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer { alpha = progress }
                )
            }
        }
    }
}
