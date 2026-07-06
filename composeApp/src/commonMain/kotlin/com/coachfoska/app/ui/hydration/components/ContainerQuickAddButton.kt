package com.coachfoska.app.ui.hydration.components

import com.coachfoska.designsystem.theme.DsTheme
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalDrink
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.common_favorite_cd
import coachfoska.composeapp.generated.resources.hydration_amount_ml_format
import com.coachfoska.app.domain.model.WaterContainer
import org.jetbrains.compose.resources.stringResource

@Composable
fun ContainerQuickAddButton(
    container: WaterContainer,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val gradient = Brush.verticalGradient(
        colors = listOf(
            DsTheme.colors.actionPrimary.copy(alpha = 0.18f),
            DsTheme.colors.actionPrimary.copy(alpha = 0.06f),
        ),
    )
    Surface(
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.clickable(onClick = onClick),
        color = DsTheme.colors.surface,
    ) {
        Column(
            modifier = Modifier
                .background(gradient, RoundedCornerShape(14.dp))
                .padding(vertical = 14.dp, horizontal = 8.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(
                imageVector = Icons.Outlined.LocalDrink,
                contentDescription = null,
                tint = DsTheme.colors.actionPrimary,
                modifier = Modifier.size(28.dp),
            )
            Text(
                text = container.name,
                style = MaterialTheme.typography.labelMedium,
                color = DsTheme.colors.textPrimary,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(Res.string.hydration_amount_ml_format, container.volumeMl),
                style = MaterialTheme.typography.labelSmall,
                color = DsTheme.colors.textPrimary.copy(alpha = 0.5f),
            )
            if (container.isFavorite) {
                Icon(
                    imageVector = Icons.Filled.Star,
                    contentDescription = stringResource(Res.string.common_favorite_cd),
                    tint = DsTheme.colors.actionPrimary,
                    modifier = Modifier.size(12.dp),
                )
            }
        }
    }
}
