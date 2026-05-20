package br.com.corelabs.npsharpfx.frontend.theme.mobile

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.view.animation.AccelerateDecelerateInterpolator

object ThemeInterpolation {
    private val evaluator = ArgbEvaluator()

    @JvmStatic
    fun animate(from: ThemeModel, to: ThemeModel, onFrame: ThemeObserver) {
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = to.animationDurationMs
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { animator ->
                val fraction = animator.animatedFraction
                onFrame.onThemeChanged(lerp(from, to, fraction))
            }
            start()
        }
    }

    @JvmStatic
    fun lerp(from: ThemeModel, to: ThemeModel, fraction: Float): ThemeModel {
        fun c(a: Int, b: Int): Int = evaluator.evaluate(fraction, a, b) as Int
        fun f(a: Float, b: Float): Float = a + (b - a) * fraction
        fun l(a: Long, b: Long): Long = (a + (b - a) * fraction).toLong()
        return to.copy(
            background = c(from.background, to.background),
            surface = c(from.surface, to.surface),
            surfaceElevated = c(from.surfaceElevated, to.surfaceElevated),
            card = c(from.card, to.card),
            cardHover = c(from.cardHover, to.cardHover),
            cardPressed = c(from.cardPressed, to.cardPressed),
            primary = c(from.primary, to.primary),
            secondary = c(from.secondary, to.secondary),
            accent = c(from.accent, to.accent),
            error = c(from.error, to.error),
            warning = c(from.warning, to.warning),
            success = c(from.success, to.success),
            text = c(from.text, to.text),
            textMuted = c(from.textMuted, to.textMuted),
            textDisabled = c(from.textDisabled, to.textDisabled),
            border = c(from.border, to.border),
            focusBorder = c(from.focusBorder, to.focusBorder),
            divider = c(from.divider, to.divider),
            titleBarBackground = c(from.titleBarBackground, to.titleBarBackground),
            titleBarForeground = c(from.titleBarForeground, to.titleBarForeground),
            navBarBackground = c(from.navBarBackground, to.navBarBackground),
            navBarForeground = c(from.navBarForeground, to.navBarForeground),
            navBarActive = c(from.navBarActive, to.navBarActive),
            sideBarBackground = c(from.sideBarBackground, to.sideBarBackground),
            sideBarForeground = c(from.sideBarForeground, to.sideBarForeground),
            sideBarBorder = c(from.sideBarBorder, to.sideBarBorder),
            statusBarBackground = c(from.statusBarBackground, to.statusBarBackground),
            statusBarForeground = c(from.statusBarForeground, to.statusBarForeground),
            buttonBackground = c(from.buttonBackground, to.buttonBackground),
            buttonForeground = c(from.buttonForeground, to.buttonForeground),
            buttonHover = c(from.buttonHover, to.buttonHover),
            buttonPressed = c(from.buttonPressed, to.buttonPressed),
            menuBackground = c(from.menuBackground, to.menuBackground),
            menuForeground = c(from.menuForeground, to.menuForeground),
            menuHover = c(from.menuHover, to.menuHover),
            tabActiveBackground = c(from.tabActiveBackground, to.tabActiveBackground),
            tabActiveForeground = c(from.tabActiveForeground, to.tabActiveForeground),
            tabInactiveBackground = c(from.tabInactiveBackground, to.tabInactiveBackground),
            tabInactiveForeground = c(from.tabInactiveForeground, to.tabInactiveForeground),
            tabBorder = c(from.tabBorder, to.tabBorder),
            editorBackground = c(from.editorBackground, to.editorBackground),
            editorForeground = c(from.editorForeground, to.editorForeground),
            editorGutterBackground = c(from.editorGutterBackground, to.editorGutterBackground),
            editorLineNumber = c(from.editorLineNumber, to.editorLineNumber),
            editorActiveLineNumber = c(from.editorActiveLineNumber, to.editorActiveLineNumber),
            editorSelection = c(from.editorSelection, to.editorSelection),
            editorSelectionInactive = c(from.editorSelectionInactive, to.editorSelectionInactive),
            editorCursor = c(from.editorCursor, to.editorCursor),
            editorCurrentLine = c(from.editorCurrentLine, to.editorCurrentLine),
            terminalBackground = c(from.terminalBackground, to.terminalBackground),
            terminalForeground = c(from.terminalForeground, to.terminalForeground),
            terminalCursor = c(from.terminalCursor, to.terminalCursor),
            terminalSelection = c(from.terminalSelection, to.terminalSelection),
            syntaxKeyword = c(from.syntaxKeyword, to.syntaxKeyword),
            syntaxType = c(from.syntaxType, to.syntaxType),
            syntaxComment = c(from.syntaxComment, to.syntaxComment),
            syntaxString = c(from.syntaxString, to.syntaxString),
            syntaxNumber = c(from.syntaxNumber, to.syntaxNumber),
            syntaxFunction = c(from.syntaxFunction, to.syntaxFunction),
            syntaxVariable = c(from.syntaxVariable, to.syntaxVariable),
            syntaxConstant = c(from.syntaxConstant, to.syntaxConstant),
            syntaxPunctuation = c(from.syntaxPunctuation, to.syntaxPunctuation),
            syntaxInvalid = c(from.syntaxInvalid, to.syntaxInvalid),
            scrollbarTrack = c(from.scrollbarTrack, to.scrollbarTrack),
            scrollbarThumb = c(from.scrollbarThumb, to.scrollbarThumb),
            scrollbarThumbHover = c(from.scrollbarThumbHover, to.scrollbarThumbHover),
            selectionText = c(from.selectionText, to.selectionText),
            borderRadius = f(from.borderRadius, to.borderRadius),
            cardRadius = f(from.cardRadius, to.cardRadius),
            buttonRadius = f(from.buttonRadius, to.buttonRadius),
            inputRadius = f(from.inputRadius, to.inputRadius),
            wallpaperOpacity = f(from.wallpaperOpacity, to.wallpaperOpacity),
            elevation = f(from.elevation, to.elevation),
            animationDurationMs = l(from.animationDurationMs, to.animationDurationMs)
        )
    }
}
