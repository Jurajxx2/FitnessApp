package com.coachfoska.app.ui.recipe.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.recipe_fewer_servings_cd
import coachfoska.composeapp.generated.resources.recipe_more_servings_cd
import coachfoska.composeapp.generated.resources.recipe_servings_label
import org.jetbrains.compose.resources.stringResource

@Composable
fun ServingsAdjuster(
    servings: Int,
    onServingsChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    minServings: Int = 1,
    maxServings: Int = 12,
) {
    Row(
        modifier = modifier.padding(horizontal = 24.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = stringResource(Res.string.recipe_servings_label),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            letterSpacing = 1.5.sp,
            modifier = Modifier.weight(1f),
        )
        IconButton(
            onClick = { if (servings > minServings) onServingsChange(servings - 1) },
            modifier = Modifier.size(36.dp),
            enabled = servings > minServings,
            colors = IconButtonDefaults.iconButtonColors(
                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
            ),
        ) {
            Icon(Icons.Filled.Remove, contentDescription = stringResource(Res.string.recipe_fewer_servings_cd), modifier = Modifier.size(18.dp))
        }
        Text(
            text = servings.toString(),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        IconButton(
            onClick = { if (servings < maxServings) onServingsChange(servings + 1) },
            modifier = Modifier.size(36.dp),
            enabled = servings < maxServings,
            colors = IconButtonDefaults.iconButtonColors(
                containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
            ),
        ) {
            Icon(Icons.Filled.Add, contentDescription = stringResource(Res.string.recipe_more_servings_cd), modifier = Modifier.size(18.dp))
        }
    }
}
