package com.coachfoska.app.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import androidx.compose.foundation.Image
import io.github.alexzhirkevich.compottie.Compottie
import io.github.alexzhirkevich.compottie.LottieCompositionSpec
import io.github.alexzhirkevich.compottie.rememberLottieComposition
import io.github.alexzhirkevich.compottie.rememberLottiePainter

@Composable
fun CoachButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    enabled: Boolean = true,
    isLoading: Boolean = false
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.12f),
            disabledContentColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.38f)
        ),
        elevation = null,
        enabled = enabled && !isLoading
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge,
                letterSpacing = 1.sp
            )
        }
    }
}

@Composable
fun CoachTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    singleLine: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    textStyle: TextStyle? = null,
    enabled: Boolean = true
) {
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = MaterialTheme.colorScheme.onBackground,
        unfocusedTextColor = MaterialTheme.colorScheme.onBackground,
        focusedBorderColor = MaterialTheme.colorScheme.onBackground,
        unfocusedBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
        cursorColor = MaterialTheme.colorScheme.onBackground,
        disabledTextColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
        disabledBorderColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.05f),
        focusedLabelColor = MaterialTheme.colorScheme.onBackground,
        unfocusedLabelColor = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
    )
    
    val baseTextStyle = MaterialTheme.typography.bodyLarge.copy(
        color = MaterialTheme.colorScheme.onBackground
    )
    val combinedTextStyle = textStyle?.let { baseTextStyle.merge(it) } ?: baseTextStyle

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        label = { Text(label) },
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        textStyle = combinedTextStyle,
        colors = fieldColors,
        enabled = enabled,
        shape = RoundedCornerShape(8.dp)
    )
}

@Composable
fun CoachSectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
        letterSpacing = 1.5.sp,
        modifier = modifier
    )
}

@Composable
fun CoachLoadingBox(modifier: Modifier = Modifier.fillMaxSize()) {
    val composition by rememberLottieComposition {
        LottieCompositionSpec.JsonString(
            Res.readBytes("files/barbell_loader.json").decodeToString()
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
                contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                modifier = Modifier.sizeIn(maxWidth = 200.dp, maxHeight = 200.dp).fillMaxSize()
            )
        } else {
            CircularProgressIndicator(
                color = MaterialTheme.colorScheme.onBackground,
                strokeWidth = 2.dp,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}
