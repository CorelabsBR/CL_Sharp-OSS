package br.com.corelabs.npsharpfx.frontend.theme.mobile

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class ComposeThemeTokens(
    val model: ThemeModel,
    val background: Color,
    val surface: Color,
    val text: Color,
    val muted: Color,
    val primary: Color,
    val accent: Color,
    val border: Color,
    val terminalBackground: Color,
    val terminalText: Color,
    val editorBackground: Color,
    val editorSelection: Color,
    val cursor: Color
)

val LocalNpsharpTheme = staticCompositionLocalOf {
    ComposeThemeTokens(
        model = ThemeModel.Default,
        background = Color(ThemeModel.Default.background),
        surface = Color(ThemeModel.Default.surface),
        text = Color(ThemeModel.Default.text),
        muted = Color(ThemeModel.Default.textMuted),
        primary = Color(ThemeModel.Default.primary),
        accent = Color(ThemeModel.Default.accent),
        border = Color(ThemeModel.Default.border),
        terminalBackground = Color(ThemeModel.Default.terminalBackground),
        terminalText = Color(ThemeModel.Default.terminalForeground),
        editorBackground = Color(ThemeModel.Default.editorBackground),
        editorSelection = Color(ThemeModel.Default.editorSelection),
        cursor = Color(ThemeModel.Default.editorCursor)
    )
}

@Composable
fun NpsharpTheme(
    theme: ThemeModel,
    content: @Composable () -> Unit
) {
    val spec = tween<Color>(
        durationMillis = theme.animationDurationMs.toInt(),
        easing = FastOutSlowInEasing
    )
    val background = animateColorAsState(Color(theme.background), spec, label = "theme-background").value
    val surface = animateColorAsState(Color(theme.surface), spec, label = "theme-surface").value
    val text = animateColorAsState(Color(theme.text), spec, label = "theme-text").value
    val muted = animateColorAsState(Color(theme.textMuted), spec, label = "theme-muted").value
    val primary = animateColorAsState(Color(theme.primary), spec, label = "theme-primary").value
    val accent = animateColorAsState(Color(theme.accent), spec, label = "theme-accent").value
    val border = animateColorAsState(Color(theme.border), spec, label = "theme-border").value
    val terminalBackground = animateColorAsState(Color(theme.terminalBackground), spec, label = "theme-terminal-bg").value
    val terminalText = animateColorAsState(Color(theme.terminalForeground), spec, label = "theme-terminal-text").value
    val editorBackground = animateColorAsState(Color(theme.editorBackground), spec, label = "theme-editor-bg").value
    val editorSelection = animateColorAsState(Color(theme.editorSelection), spec, label = "theme-editor-selection").value
    val cursor = animateColorAsState(Color(theme.editorCursor), spec, label = "theme-cursor").value

    val colorScheme = if (theme.type == "light") {
        lightColorScheme(
            primary = primary,
            secondary = accent,
            background = background,
            surface = surface,
            onPrimary = Color(theme.buttonForeground),
            onSecondary = text,
            onBackground = text,
            onSurface = text,
            outline = border
        )
    } else {
        darkColorScheme(
            primary = primary,
            secondary = accent,
            background = background,
            surface = surface,
            onPrimary = Color(theme.buttonForeground),
            onSecondary = text,
            onBackground = text,
            onSurface = text,
            outline = border
        )
    }

    CompositionLocalProvider(
        LocalNpsharpTheme provides ComposeThemeTokens(
            model = theme,
            background = background,
            surface = surface,
            text = text,
            muted = muted,
            primary = primary,
            accent = accent,
            border = border,
            terminalBackground = terminalBackground,
            terminalText = terminalText,
            editorBackground = editorBackground,
            editorSelection = editorSelection,
            cursor = cursor
        )
    ) {
        MaterialTheme(colorScheme = colorScheme, content = content)
    }
}
