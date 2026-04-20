package com.coachfoska.app.ui.splash

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coachfoska.composeapp.generated.resources.Res
import com.coachfoska.app.presentation.splash.SplashNavState
import com.coachfoska.app.presentation.splash.SplashViewModel
import io.github.alexzhirkevich.compottie.Compottie
import io.github.alexzhirkevich.compottie.LottieCompositionSpec
import io.github.alexzhirkevich.compottie.rememberLottieComposition
import io.github.alexzhirkevich.compottie.rememberLottiePainter
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun SplashRoute(
    onNavigateToHome: (userId: String) -> Unit,
    onNavigateToOnboarding: (userId: String) -> Unit,
    onNavigateToWelcome: () -> Unit,
    viewModel: SplashViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state) {
        when (val s = state) {
            is SplashNavState.NavigateToHome -> onNavigateToHome(s.userId)
            is SplashNavState.NavigateToOnboarding -> onNavigateToOnboarding(s.userId)
            SplashNavState.NavigateToWelcome -> onNavigateToWelcome()
            SplashNavState.Loading -> Unit
        }
    }

    SplashScreen()
}

@Composable
fun SplashScreen() {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(
            Res.readBytes("files/barbell_loader.json").decodeToString()
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(tween(600)) + scaleIn(
                initialScale = 0.88f,
                animationSpec = tween(600, easing = FastOutSlowInEasing)
            )
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "COACH",
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 8.sp
                )
                Text(
                    text = "FOŠKA",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 8.sp
                )
                Spacer(modifier = Modifier.height(24.dp))
                Image(
                    painter = rememberLottiePainter(
                        composition = composition,
                        iterations = Compottie.IterateForever
                    ),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(160.dp)
                )
            }
        }
    }
}
