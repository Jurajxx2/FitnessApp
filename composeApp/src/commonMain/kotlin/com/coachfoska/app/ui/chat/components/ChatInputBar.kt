package com.coachfoska.app.ui.chat.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.*
import com.coachfoska.designsystem.components.DsTextFieldDefaults
import org.jetbrains.compose.resources.stringResource

@Composable
fun ChatInputBar(
    text: String,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onImageAttach: () -> Unit,
    isSending: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(DsTheme.colors.background)
            .padding(horizontal = 8.dp, vertical = 8.dp)
            .imePadding(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onImageAttach, enabled = !isSending) {
            Icon(
                imageVector = Icons.Default.AttachFile,
                contentDescription = stringResource(Res.string.attach_image_cd),
                tint = DsTheme.colors.textPrimary.copy(alpha = 0.6f)
            )
        }

        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text(stringResource(Res.string.message_placeholder), style = MaterialTheme.typography.bodyMedium) },
            singleLine = false,
            maxLines = 4,
            shape = MaterialTheme.shapes.extraLarge,
            colors = DsTextFieldDefaults.colors(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Default),
            keyboardActions = KeyboardActions.Default
        )

        IconButton(
            onClick = onSend,
            enabled = text.isNotBlank() && !isSending
        ) {
            if (isSending) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = DsTheme.colors.actionPrimary
                )
            } else {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = stringResource(Res.string.send_cd),
                    tint = if (text.isNotBlank()) DsTheme.colors.actionPrimary
                           else DsTheme.colors.textPrimary.copy(alpha = 0.3f)
                )
            }
        }
    }
}
