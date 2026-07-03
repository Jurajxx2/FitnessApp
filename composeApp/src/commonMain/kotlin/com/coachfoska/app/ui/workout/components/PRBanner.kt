package com.coachfoska.app.ui.workout.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coachfoska.composeapp.generated.resources.Res
import coachfoska.composeapp.generated.resources.pr_banner_record_format
import coachfoska.composeapp.generated.resources.pr_banner_title
import com.coachfoska.app.domain.model.SessionPR
import org.jetbrains.compose.resources.stringResource

@Composable
fun PRBanner(
    pr: SessionPR?,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = pr != null,
        enter = expandVertically() + fadeIn(),
        exit = shrinkVertically() + fadeOut(),
        modifier = modifier,
    ) {
        pr?.let { record ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFF3CD), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("🏆", fontSize = 20.sp)
                Column {
                    Text(
                        text = stringResource(Res.string.pr_banner_title),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color(0xFF856404),
                    )
                    Text(
                        text = stringResource(Res.string.pr_banner_record_format, record.exerciseName, record.record),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF856404),
                    )
                }
            }
        }
    }
}
