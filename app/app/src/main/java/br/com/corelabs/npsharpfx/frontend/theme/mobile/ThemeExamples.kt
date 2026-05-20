package br.com.corelabs.npsharpfx.frontend.theme.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ThemeSwitcherExample() {
    val theme by ThemeManager.currentThemeFlow.collectAsState()
    NpsharpTheme(theme) {
        val tokens = LocalNpsharpTheme.current
        Column(
            modifier = Modifier
                .background(tokens.background)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ThemeManager.availableThemes().forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(tokens.surface, RoundedCornerShape(tokens.model.cardRadius.dp))
                        .border(1.dp, tokens.border, RoundedCornerShape(tokens.model.cardRadius.dp))
                        .clickable { ThemeManager.setThemeByAsset(item.assetName) }
                        .padding(12.dp)
                ) {
                    Text(text = item.name, color = tokens.text)
                }
            }
        }
    }
}
