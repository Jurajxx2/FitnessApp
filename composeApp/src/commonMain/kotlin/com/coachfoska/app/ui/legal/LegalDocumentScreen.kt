package com.coachfoska.app.ui.legal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coachfoska.designsystem.theme.DsTheme

@Composable
fun LegalDocumentRoute(
    documentId: String,
    onBackClick: () -> Unit
) {
    LegalDocuments.get(documentId)?.let { document ->
        LegalDocumentScreen(document = document, onBackClick = onBackClick)
    } ?: LegalDocumentScreen(
        document = LegalDocument(
            id = "missing",
            title = "Legal document not found",
            updated = "",
            intro = "The selected legal document is not available in this build.",
            sections = emptyList()
        ),
        onBackClick = onBackClick
    )
}

@Composable
private fun LegalDocumentScreen(
    document: LegalDocument,
    onBackClick: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = DsTheme.colors.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = DsTheme.spacing.xl, vertical = DsTheme.spacing.lg),
            verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.lg)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null,
                        tint = DsTheme.colors.textPrimary
                    )
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.xs)
                ) {
                    Text(
                        text = document.title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = DsTheme.colors.textPrimary,
                        fontWeight = FontWeight.ExtraBold
                    )
                    if (document.updated.isNotBlank()) {
                        Text(
                            text = document.updated,
                            style = MaterialTheme.typography.bodySmall,
                            color = DsTheme.colors.textPrimary.copy(alpha = 0.5f)
                        )
                    }
                }
            }

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = DsTheme.colors.surfaceElevated.copy(alpha = 0.16f),
                border = BorderStroke(1.dp, DsTheme.colors.textPrimary.copy(alpha = 0.06f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = document.intro,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DsTheme.colors.textPrimary.copy(alpha = 0.75f),
                    lineHeight = 21.sp,
                    modifier = Modifier.padding(DsTheme.spacing.lg)
                )
            }

            document.sections.forEach { section ->
                Column(verticalArrangement = Arrangement.spacedBy(DsTheme.spacing.sm)) {
                    Text(
                        text = section.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = DsTheme.colors.textPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = section.body,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DsTheme.colors.textPrimary.copy(alpha = 0.72f),
                        lineHeight = 21.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(DsTheme.spacing.xl))
        }
    }
}
