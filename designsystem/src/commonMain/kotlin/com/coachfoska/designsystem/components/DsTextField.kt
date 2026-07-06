package com.coachfoska.designsystem.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun DsSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier.fillMaxWidth(),
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    enabled: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        enabled = enabled,
        placeholder = { Text(placeholder, style = DsTheme.type.bodyMedium) },
        leadingIcon = leadingIcon,
        trailingIcon = trailingIcon,
        singleLine = true,
        shape = DsTheme.shapes.xl,
        colors = DsTextFieldDefaults.colors(),
    )
}

object DsTextFieldDefaults {
    @Composable
    fun colors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = DsTheme.colors.textPrimary,
        unfocusedTextColor = DsTheme.colors.textPrimary,
        focusedBorderColor = DsTheme.colors.actionPrimary,
        unfocusedBorderColor = DsTheme.colors.outlineSubtle,
        cursorColor = DsTheme.colors.actionPrimary,
        disabledTextColor = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
        disabledBorderColor = DsTheme.colors.outlineSubtle.copy(alpha = 0.5f),
        focusedLabelColor = DsTheme.colors.actionPrimary,
        unfocusedLabelColor = DsTheme.colors.textSecondary,
        focusedPlaceholderColor = DsTheme.colors.textSecondary,
        unfocusedPlaceholderColor = DsTheme.colors.textSecondary,
    )
}

@Composable
fun DsTextField(
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
    val baseTextStyle = DsTheme.type.bodyLarge.copy(
        color = DsTheme.colors.textPrimary
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
        colors = DsTextFieldDefaults.colors(),
        enabled = enabled,
        shape = DsTheme.shapes.md
    )
}
