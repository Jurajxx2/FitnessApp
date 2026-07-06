package com.coachfoska.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.coachfoska.designsystem.generated.resources.Res
import com.coachfoska.designsystem.theme.DsTheme
import io.github.alexzhirkevich.compottie.Compottie
import io.github.alexzhirkevich.compottie.LottieCompositionSpec
import io.github.alexzhirkevich.compottie.rememberLottieComposition
import io.github.alexzhirkevich.compottie.rememberLottiePainter

/** Brand loader animation (from BrandAssets), with a plain spinner fallback. */
@Composable
fun DsLoadingBox(modifier: Modifier = Modifier.fillMaxSize()) {
    val lottiePath = DsTheme.assets.loaderLottiePath
    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(
            Res.readBytes(lottiePath).decodeToString()
        )
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (composition != null) {
            Image(
                painter = rememberLottiePainter(
                    composition = composition,
                    iterations = Compottie.IterateForever
                ),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.sizeIn(maxWidth = 200.dp, maxHeight = 200.dp).fillMaxSize()
            )
        } else {
            CircularProgressIndicator(
                color = DsTheme.colors.textPrimary,
                strokeWidth = 2.dp,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
