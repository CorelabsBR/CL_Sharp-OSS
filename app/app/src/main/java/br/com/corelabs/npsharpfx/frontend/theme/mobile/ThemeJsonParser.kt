package br.com.corelabs.npsharpfx.frontend.theme.mobile

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

object ThemeJsonParser {
    @JvmStatic
    fun parse(assetName: String, json: String): ThemeModel {
        val root = JSONObject(json)
        val colors = root.optJSONObject("colors") ?: root
        val base = ThemeModel.Default
        val name = root.optString("name", assetName.removeSuffix(".json"))
        val type = root.optString("type", inferType(colors, base))

        val background = color(root, colors, "background", "editor.background", base.background)
        val text = color(root, colors, "text", "editor.foreground", readableOn(background))
        val surface = color(root, colors, "surface", "sideBar.background", shade(background, 0.12f))
        val primary = color(root, colors, "primary", "button.background", base.primary)
        val accent = color(root, colors, "accent", "focusBorder", primary)
        val border = color(root, colors, "border", "contrastBorder", shade(surface, 0.18f))
        val muted = color(root, colors, "textMuted", "descriptionForeground", ensureContrast(shade(text, if (isDark(text)) 0.35f else -0.35f), surface))

        val syntax = parseSyntax(root.optJSONArray("tokenColors"), base, text)

        return ThemeModel(
            id = root.optString("id", assetName.removeSuffix(".json")),
            assetName = assetName,
            name = name,
            type = type,
            background = background,
            surface = surface,
            surfaceElevated = color(root, colors, "surfaceElevated", "dropdown.background", shade(surface, 0.08f)),
            card = color(root, colors, "card", "panel.background", shade(surface, 0.03f)),
            cardHover = color(root, colors, "cardHover", "list.hoverBackground", shade(surface, 0.12f)),
            cardPressed = color(root, colors, "cardPressed", "list.activeSelectionBackground", shade(surface, 0.20f)),
            primary = primary,
            secondary = color(root, colors, "secondary", "textLink.foreground", base.secondary),
            accent = accent,
            error = color(root, colors, "error", "errorForeground", base.error),
            warning = color(root, colors, "warning", "editorWarning.foreground", base.warning),
            success = color(root, colors, "success", "testing.iconPassed", base.success),
            text = ensureContrast(text, background),
            textMuted = muted,
            textDisabled = color(root, colors, "textDisabled", "disabledForeground", shade(muted, -0.20f)),
            border = border,
            focusBorder = color(root, colors, "focusBorder", "focusBorder", accent),
            divider = color(root, colors, "divider", "sideBarSectionHeader.border", border),
            titleBarBackground = color(root, colors, "titleBarBackground", "titleBar.activeBackground", shade(surface, -0.08f)),
            titleBarForeground = color(root, colors, "titleBarForeground", "titleBar.activeForeground", text),
            navBarBackground = color(root, colors, "navBarBackground", "activityBar.background", shade(surface, -0.08f)),
            navBarForeground = color(root, colors, "navBarForeground", "activityBar.foreground", muted),
            navBarActive = color(root, colors, "navBarActive", "activityBar.activeBorder", accent),
            sideBarBackground = color(root, colors, "sideBarBackground", "sideBar.background", surface),
            sideBarForeground = color(root, colors, "sideBarForeground", "sideBar.foreground", text),
            sideBarBorder = color(root, colors, "sideBarBorder", "sideBar.border", border),
            statusBarBackground = color(root, colors, "statusBarBackground", "statusBar.background", shade(surface, -0.12f)),
            statusBarForeground = color(root, colors, "statusBarForeground", "statusBar.foreground", text),
            buttonBackground = color(root, colors, "buttonBackground", "button.background", shade(surface, 0.12f)),
            buttonForeground = color(root, colors, "buttonForeground", "button.foreground", text),
            buttonHover = color(root, colors, "buttonHover", "button.hoverBackground", shade(surface, 0.18f)),
            buttonPressed = color(root, colors, "buttonPressed", "list.activeSelectionBackground", shade(surface, 0.24f)),
            menuBackground = color(root, colors, "menuBackground", "menu.background", surface),
            menuForeground = color(root, colors, "menuForeground", "menu.foreground", text),
            menuHover = color(root, colors, "menuHover", "menu.selectionBackground", shade(surface, 0.18f)),
            tabActiveBackground = color(root, colors, "tabActiveBackground", "tab.activeBackground", background),
            tabActiveForeground = color(root, colors, "tabActiveForeground", "tab.activeForeground", text),
            tabInactiveBackground = color(root, colors, "tabInactiveBackground", "tab.inactiveBackground", surface),
            tabInactiveForeground = color(root, colors, "tabInactiveForeground", "tab.inactiveForeground", muted),
            tabBorder = color(root, colors, "tabBorder", "tab.border", border),
            editorBackground = color(root, colors, "editorBackground", "editor.background", background),
            editorForeground = color(root, colors, "editorForeground", "editor.foreground", text),
            editorGutterBackground = color(root, colors, "editorGutterBackground", "editorGutter.background", background),
            editorLineNumber = color(root, colors, "editorLineNumber", "editorLineNumber.foreground", muted),
            editorActiveLineNumber = color(root, colors, "editorActiveLineNumber", "editorLineNumber.activeForeground", text),
            editorSelection = color(root, colors, "editorSelection", "editor.selectionBackground", base.editorSelection),
            editorSelectionInactive = color(root, colors, "editorSelectionInactive", "editor.inactiveSelectionBackground", base.editorSelectionInactive),
            editorCursor = color(root, colors, "cursorColor", "editorCursor.foreground", accent),
            editorCurrentLine = color(root, colors, "editorCurrentLine", "editor.lineHighlightBackground", shade(background, 0.08f)),
            terminalBackground = color(root, colors, "terminalBackground", "terminal.background", background),
            terminalForeground = color(root, colors, "terminalText", "terminal.foreground", text),
            terminalCursor = color(root, colors, "terminalCursor", "terminalCursor.foreground", accent),
            terminalSelection = color(root, colors, "terminalSelection", "terminal.selectionBackground", base.terminalSelection),
            terminalAnsiBlack = color(root, colors, "terminalAnsiBlack", "terminal.ansiBlack", base.terminalAnsiBlack),
            terminalAnsiRed = color(root, colors, "terminalAnsiRed", "terminal.ansiRed", base.terminalAnsiRed),
            terminalAnsiGreen = color(root, colors, "terminalAnsiGreen", "terminal.ansiGreen", base.terminalAnsiGreen),
            terminalAnsiYellow = color(root, colors, "terminalAnsiYellow", "terminal.ansiYellow", base.terminalAnsiYellow),
            terminalAnsiBlue = color(root, colors, "terminalAnsiBlue", "terminal.ansiBlue", base.terminalAnsiBlue),
            terminalAnsiMagenta = color(root, colors, "terminalAnsiMagenta", "terminal.ansiMagenta", base.terminalAnsiMagenta),
            terminalAnsiCyan = color(root, colors, "terminalAnsiCyan", "terminal.ansiCyan", base.terminalAnsiCyan),
            terminalAnsiWhite = color(root, colors, "terminalAnsiWhite", "terminal.ansiWhite", base.terminalAnsiWhite),
            terminalAnsiBrightBlack = color(root, colors, "terminalAnsiBrightBlack", "terminal.ansiBrightBlack", base.terminalAnsiBrightBlack),
            terminalAnsiBrightRed = color(root, colors, "terminalAnsiBrightRed", "terminal.ansiBrightRed", base.terminalAnsiBrightRed),
            terminalAnsiBrightGreen = color(root, colors, "terminalAnsiBrightGreen", "terminal.ansiBrightGreen", base.terminalAnsiBrightGreen),
            terminalAnsiBrightYellow = color(root, colors, "terminalAnsiBrightYellow", "terminal.ansiBrightYellow", base.terminalAnsiBrightYellow),
            terminalAnsiBrightBlue = color(root, colors, "terminalAnsiBrightBlue", "terminal.ansiBrightBlue", base.terminalAnsiBrightBlue),
            terminalAnsiBrightMagenta = color(root, colors, "terminalAnsiBrightMagenta", "terminal.ansiBrightMagenta", base.terminalAnsiBrightMagenta),
            terminalAnsiBrightCyan = color(root, colors, "terminalAnsiBrightCyan", "terminal.ansiBrightCyan", base.terminalAnsiBrightCyan),
            terminalAnsiBrightWhite = color(root, colors, "terminalAnsiBrightWhite", "terminal.ansiBrightWhite", base.terminalAnsiBrightWhite),
            syntaxKeyword = color(root, colors, "syntaxKeyword", "editor.tokenColor.keyword", syntax.keyword),
            syntaxType = color(root, colors, "syntaxType", "editor.tokenColor.type", syntax.type),
            syntaxComment = color(root, colors, "syntaxComment", "editor.tokenColor.comment", syntax.comment),
            syntaxString = color(root, colors, "syntaxString", "editor.tokenColor.string", syntax.string),
            syntaxNumber = color(root, colors, "syntaxNumber", "editor.tokenColor.number", syntax.number),
            syntaxFunction = color(root, colors, "syntaxFunction", "editor.tokenColor.function", syntax.function),
            syntaxVariable = color(root, colors, "syntaxVariable", "editor.tokenColor.variable", syntax.variable),
            syntaxConstant = color(root, colors, "syntaxConstant", "editor.tokenColor.constant", syntax.constant),
            syntaxPunctuation = color(root, colors, "syntaxPunctuation", "editor.tokenColor.punctuation", syntax.punctuation),
            syntaxInvalid = color(root, colors, "syntaxInvalid", "editor.tokenColor.invalid", syntax.invalid),
            scrollbarTrack = color(root, colors, "scrollbarTrack", "scrollbarSlider.background", Color.TRANSPARENT),
            scrollbarThumb = color(root, colors, "scrollbarThumb", "scrollbarSlider.activeBackground", base.scrollbarThumb),
            scrollbarThumbHover = color(root, colors, "scrollbarThumbHover", "scrollbarSlider.hoverBackground", base.scrollbarThumbHover),
            selectionText = color(root, colors, "selectionText", "editor.selectionForeground", Color.WHITE),
            borderRadius = root.optDouble("borderRadius", 4.0).toFloat(),
            cardRadius = root.optDouble("cardRadius", root.optDouble("borderRadius", 4.0)).toFloat(),
            buttonRadius = root.optDouble("buttonRadius", 4.0).toFloat(),
            inputRadius = root.optDouble("inputRadius", 5.0).toFloat(),
            blur = root.optBoolean("blur", false),
            shadow = root.optBoolean("shadow", true),
            transparentEditor = root.optBoolean("transparentEditor", false),
            wallpaperOpacity = root.optDouble("wallpaperOpacity", 0.0).toFloat(),
            elevation = root.optDouble("elevation", 8.0).toFloat(),
            animationDurationMs = root.optLong("animationDurationMs", 220L),
            animationEasing = root.optString("animationEasing", "fastOutSlowIn")
        )
    }

    private fun color(root: JSONObject, colors: JSONObject, simpleKey: String, desktopKey: String, fallback: Int): Int {
        return parseColor(root.optNullableString(simpleKey))
            ?: parseColor(colors.optNullableString(desktopKey))
            ?: fallback
    }

    private fun parseColor(value: String?): Int? {
        if (value.isNullOrBlank()) return null
        return try {
            var clean = value.trim()
            if (clean.length == 9 && clean.startsWith("#")) {
                clean = "#" + clean.substring(7, 9) + clean.substring(1, 7)
            }
            Color.parseColor(clean)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseSyntax(tokenColors: JSONArray?, base: ThemeModel, fallbackText: Int): Syntax {
        val syntax = Syntax(
            keyword = base.syntaxKeyword,
            type = base.syntaxType,
            comment = base.syntaxComment,
            string = base.syntaxString,
            number = base.syntaxNumber,
            function = base.syntaxFunction,
            variable = base.syntaxVariable,
            constant = base.syntaxConstant,
            punctuation = base.syntaxPunctuation,
            invalid = base.syntaxInvalid
        )
        if (tokenColors == null) return syntax
        for (i in 0 until tokenColors.length()) {
            val item = tokenColors.optJSONObject(i) ?: continue
            val settings = item.optJSONObject("settings") ?: continue
            val foreground = parseColor(settings.optNullableString("foreground")) ?: continue
            val scopeText = scopeText(item.opt("scope")).lowercase()
            when {
                "invalid" in scopeText -> syntax.invalid = foreground
                "comment" in scopeText -> syntax.comment = foreground
                "string" in scopeText -> syntax.string = foreground
                "constant.numeric" in scopeText || "number" in scopeText -> syntax.number = foreground
                "entity.name.function" in scopeText || "support.function" in scopeText -> syntax.function = foreground
                "variable" in scopeText -> syntax.variable = foreground
                "constant" in scopeText -> syntax.constant = foreground
                "storage.type" in scopeText || "entity.name.type" in scopeText -> syntax.type = foreground
                "keyword" in scopeText || "storage" in scopeText -> syntax.keyword = foreground
                "punctuation" in scopeText || "operator" in scopeText -> syntax.punctuation = foreground
            }
        }
        if (syntax.punctuation == base.syntaxPunctuation) syntax.punctuation = fallbackText
        return syntax
    }

    private fun scopeText(scope: Any?): String {
        return when (scope) {
            is JSONArray -> buildString {
                for (i in 0 until scope.length()) append(scope.optString(i)).append(' ')
            }
            null -> ""
            else -> scope.toString()
        }
    }

    private fun inferType(colors: JSONObject, base: ThemeModel): String {
        val background = parseColor(colors.optNullableString("editor.background")) ?: base.background
        return if (isDark(background)) "dark" else "light"
    }

    private fun JSONObject.optNullableString(key: String): String? {
        return if (has(key) && !isNull(key)) optString(key) else null
    }

    private data class Syntax(
        var keyword: Int,
        var type: Int,
        var comment: Int,
        var string: Int,
        var number: Int,
        var function: Int,
        var variable: Int,
        var constant: Int,
        var punctuation: Int,
        var invalid: Int
    )

    private fun shade(color: Int, amount: Float): Int {
        val r = Color.red(color)
        val g = Color.green(color)
        val b = Color.blue(color)
        val nextR: Int
        val nextG: Int
        val nextB: Int
        if (amount >= 0f) {
            nextR = r + ((255 - r) * amount).toInt()
            nextG = g + ((255 - g) * amount).toInt()
            nextB = b + ((255 - b) * amount).toInt()
        } else {
            val factor = 1f + amount
            nextR = (r * factor).toInt()
            nextG = (g * factor).toInt()
            nextB = (b * factor).toInt()
        }
        return Color.rgb(clamp(nextR), clamp(nextG), clamp(nextB))
    }

    private fun clamp(value: Int): Int = max(0, min(255, value))
    private fun readableOn(background: Int): Int = if (isDark(background)) Color.rgb(245, 245, 245) else Color.rgb(32, 32, 32)
    private fun isDark(color: Int): Boolean = luminance(color) < 0.5
    private fun luminance(color: Int): Double = (0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)) / 255.0
    private fun ensureContrast(foreground: Int, background: Int): Int {
        val diff = kotlin.math.abs(luminance(foreground) - luminance(background))
        return if (diff >= 0.42) foreground else readableOn(background)
    }
}
