package br.com.corelabs.npsharpfx.frontend.ui.theme;

public final class CSSThemeGenerator {

    private CSSThemeGenerator() {
    }

    public static String generateThemeCSS(EditorTheme theme) {
        if (theme == null) {
            return generateDefaultCSS();
        }

        StringBuilder css = new StringBuilder();

        String bg = theme.color("editor.background", "#0C1021");
        String fg = theme.color("editor.foreground", "#D4D4D4");

        String borderColor = theme.color(
                "editorGroup.border",
                theme.color("sideBar.border", "#2E3436")
        );

        String selectedBg = theme.color(
                "editor.selectionBackground",
                theme.color("list.activeSelectionBackground", "#253B76")
        );

        String accentColor = theme.color(
                "focusBorder",
                theme.color("activityBar.foreground", "#FAAA3C")
        );

        String tokenString = theme.tokenColor("string", "#D8A3FF");
        String tokenKeyword = theme.tokenColor("keyword", "#E085FF");
        String tokenComment = theme.tokenColor("comment", "#9B5FA8");
        String tokenNumber = theme.tokenColor("number", "#B48EFF");
        String tokenFunction = theme.tokenColor("function", "#AC7EFF");
        String tokenVariable = theme.tokenColor("variable", "#D899FF");
        String tokenType = theme.tokenColor("type", "#D899FF");
        String tokenConstant = theme.tokenColor("constant", "#E0A0FF");
        String tokenPunctuation = theme.tokenColor("punctuation", "#A48CBF");
        String tokenInvalid = theme.tokenColor("invalid", "#FFFFFF");

        boolean isDark = "dark".equalsIgnoreCase(theme.getType());

        String dimmedFg = isDark ? "#9DA5B4" : "#666666";
        String panelBg = theme.color("panel.background", adjustBrightness(bg, isDark ? 0.05 : -0.05));
        String buttonHoverBg = theme.color("list.hoverBackground", adjustBrightness(bg, isDark ? 0.1 : -0.1));

        appendBaseCss(css, bg, fg);
        appendWindowCss(css, theme, bg, fg, borderColor, selectedBg, accentColor, dimmedFg, panelBg, buttonHoverBg);
        appendEditorCss(css, theme, bg, fg, selectedBg);
        appendCodeAreaBaseCss(css, theme, bg, fg, selectedBg);
        appendTokenCss(css, tokenString, tokenKeyword, tokenComment, tokenNumber,
                tokenFunction, tokenVariable, tokenType, tokenConstant,
                tokenPunctuation, tokenInvalid);

        return css.toString();
    }

    private static void appendBaseCss(StringBuilder css, String bg, String fg) {
        css.append(".root, .root-pane {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-font-family: \"JetBrains Mono\", \"Consolas\";\n");
        css.append("}\n\n");

        css.append(".label {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".wallpaper-layer {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("}\n\n");
    }

    private static void appendWindowCss(
            StringBuilder css,
            EditorTheme theme,
            String bg,
            String fg,
            String borderColor,
            String selectedBg,
            String accentColor,
            String dimmedFg,
            String panelBg,
            String buttonHoverBg
    ) {
        css.append(".title-bar {\n");
        css.append("    -fx-background-color: ").append(theme.color("titleBar.activeBackground", panelBg)).append(";\n");
        css.append("    -fx-border-color: ").append(theme.color("titleBar.border", borderColor)).append(";\n");
        css.append("    -fx-border-width: 0 0 1 0;\n");
        css.append("}\n\n");

        css.append(".title-menu, .title-toolbar-button, .window-button {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".title-menu:hover, .title-toolbar-button:hover, .window-button:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        css.append(".title-toolbar-button-disabled {\n");
        css.append("    -fx-opacity: 0.5;\n");
        css.append("}\n\n");

        css.append(".command-bar {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        css.append(".command-bar:focused {\n");
        css.append("    -fx-border-color: ").append(accentColor).append(";\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        css.append(".window-button-close:hover {\n");
        css.append("    -fx-background-color: ").append(theme.color("errorForeground", "#EF2929")).append(";\n");
        css.append("}\n\n");

        css.append(".activity-bar {\n");
        css.append("    -fx-background-color: ").append(theme.color("activityBar.background", panelBg)).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        css.append(".activity-icon {\n");
        css.append("    -fx-background-color: transparent;\n");
        css.append("}\n\n");

        css.append(".activity-icon:hover, .activity-icon.active {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        css.append(".activity-icon.active {\n");
        css.append("    -fx-border-color: ").append(accentColor).append(";\n");
        css.append("}\n\n");

        css.append(".side-panel-host, .side-panel-header {\n");
        css.append("    -fx-background-color: ").append(theme.color("sideBar.background", panelBg)).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        css.append(".panel-title {\n");
        css.append("    -fx-text-fill: ").append(dimmedFg).append(";\n");
        css.append("}\n\n");

        css.append(".file-tree .tree-cell {\n");
        css.append("    -fx-background-color: transparent;\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".file-tree .tree-cell:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        css.append(".file-tree .tree-cell:selected {\n");
        css.append("    -fx-background-color: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        css.append(".button {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".button-primary {\n");
        css.append("    -fx-background-color: ").append(theme.color("button.background", accentColor)).append(";\n");
        css.append("    -fx-text-fill: ").append(theme.color("button.foreground", bg)).append(";\n");
        css.append("}\n\n");

        css.append(".scroll-pane, .scroll-pane .viewport {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n\n");

        css.append(".context-menu {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        css.append(".context-menu-item {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".context-menu-row:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        css.append(".separator {\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        css.append(".settings-menu-item {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-padding: 8 12 8 12;\n");
        css.append("    -fx-cursor: hand;\n");
        css.append("}\n\n");

        css.append(".settings-menu-item:hover {\n");
        css.append("    -fx-background-color: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        css.append(".theme-chooser-content, .theme-chooser-scroll {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n\n");
    }

    private static void appendEditorCss(
            StringBuilder css,
            EditorTheme theme,
            String bg,
            String fg,
            String selectedBg
    ) {
        css.append(".editor-tabs {\n");
        css.append("    -fx-background-color: ").append(theme.color("editorGroupHeader.tabsBackground", bg)).append(";\n");
        css.append("}\n\n");

        css.append(".editor-tabs .tab-header-area,\n");
        css.append(".editor-tabs .tab-header-background {\n");
        css.append("    -fx-background-color: ").append(theme.color("editorGroupHeader.tabsBackground", bg)).append(";\n");
        css.append("    -fx-border-color: ").append(theme.color("editorGroupHeader.tabsBorder", "#2E3436")).append(";\n");
        css.append("}\n\n");

        css.append(".editor-tabs .tab {\n");
        css.append("    -fx-background-color: ").append(theme.color("tab.inactiveBackground", bg)).append(";\n");
        css.append("    -fx-border-color: ").append(theme.color("tab.border", "#2E3436")).append(";\n");
        css.append("}\n\n");

        css.append(".editor-tabs .tab:selected {\n");
        css.append("    -fx-background-color: ").append(theme.color("tab.activeBackground", bg)).append(";\n");
        css.append("}\n\n");

        css.append(".editor-tabs .tab-label {\n");
        css.append("    -fx-text-fill: ").append(theme.color("tab.inactiveForeground", fg)).append(";\n");
        css.append("}\n\n");

        css.append(".editor-tabs .tab:selected .tab-label {\n");
        css.append("    -fx-text-fill: ").append(theme.color("tab.activeForeground", fg)).append(";\n");
        css.append("}\n\n");

        css.append(".editor-textarea {\n");
        css.append("    -fx-control-inner-background: ").append(bg).append(";\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-highlight-fill: ").append(selectedBg).append(";\n");
        css.append("}\n\n");
    }

    private static void appendCodeAreaBaseCss(
            StringBuilder css,
            EditorTheme theme,
            String bg,
            String fg,
            String selectedBg
    ) {
        css.append(".code-area {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-control-inner-background: ").append(bg).append(";\n");
        css.append("}\n\n");

        css.append(".code-area .virtual-flow,\n");
        css.append(".code-area .virtual-flow .clipped-container,\n");
        css.append(".code-area .virtual-flow .sheet,\n");
        css.append(".code-area .paragraph-box,\n");
        css.append(".code-area .paragraph-text {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("}\n\n");

        css.append(".code-area .paragraph-text {\n");
        css.append("    -fx-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        css.append(".code-area .caret {\n");
        css.append("    -fx-stroke: ").append(theme.color("editorCursor.foreground", fg)).append(";\n");
        css.append("}\n\n");

        css.append(".code-area .selection {\n");
        css.append("    -fx-fill: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        css.append(".code-area .lineno {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-text-fill: ").append(theme.color("editorLineNumber.foreground", "#858585")).append(";\n");
        css.append("}\n\n");
    }

    private static void appendTokenCss(
        StringBuilder css,
        String tokenString,
        String tokenKeyword,
        String tokenComment,
        String tokenNumber,
        String tokenFunction,
        String tokenVariable,
        String tokenType,
        String tokenConstant,
        String tokenPunctuation,
        String tokenInvalid
) {

    css.append(".editor-textarea .syntax-string,\n");
    css.append(".code-area .syntax-string,\n");
    css.append(".syntax-string {\n");
    css.append("    -fx-fill: ").append(tokenString).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-keyword,\n");
    css.append(".code-area .syntax-keyword,\n");
    css.append(".syntax-keyword {\n");
    css.append("    -fx-fill: ").append(tokenKeyword).append(";\n");
    css.append("    -fx-font-weight: bold;\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-comment,\n");
    css.append(".code-area .syntax-comment,\n");
    css.append(".syntax-comment {\n");
    css.append("    -fx-fill: ").append(tokenComment).append(";\n");
    css.append("    -fx-font-style: italic;\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-number,\n");
    css.append(".code-area .syntax-number,\n");
    css.append(".syntax-number {\n");
    css.append("    -fx-fill: ").append(tokenNumber).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-function,\n");
    css.append(".code-area .syntax-function,\n");
    css.append(".syntax-function {\n");
    css.append("    -fx-fill: ").append(tokenFunction).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-variable,\n");
    css.append(".code-area .syntax-variable,\n");
    css.append(".syntax-variable {\n");
    css.append("    -fx-fill: ").append(tokenVariable).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-type,\n");
    css.append(".code-area .syntax-type,\n");
    css.append(".syntax-type {\n");
    css.append("    -fx-fill: ").append(tokenType).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-constant,\n");
    css.append(".code-area .syntax-constant,\n");
    css.append(".syntax-constant {\n");
    css.append("    -fx-fill: ").append(tokenConstant).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-punctuation,\n");
    css.append(".code-area .syntax-punctuation,\n");
    css.append(".syntax-punctuation {\n");
    css.append("    -fx-fill: ").append(tokenPunctuation).append(";\n");
    css.append("}\n\n");

    css.append(".editor-textarea .syntax-invalid,\n");
    css.append(".code-area .syntax-invalid,\n");
    css.append(".syntax-invalid {\n");
    css.append("    -fx-fill: ").append(tokenInvalid).append(";\n");
    css.append("}\n\n");
}

    private static String generateDefaultCSS() {
        return generateThemeCSS(createDefaultTheme());
    }

    private static EditorTheme createDefaultTheme() {
        EditorTheme theme = new EditorTheme();
        theme.setId("default");
        theme.setName("Default");
        theme.setType("dark");
        theme.getColors().put("editor.background", "#0C1021");
        theme.getColors().put("editor.foreground", "#D4D4D4");
        return theme;
    }

    private static String adjustBrightness(String color, double factor) {
        if (color == null || !color.matches("#[0-9A-Fa-f]{6}")) {
            return color != null ? color : "#000000";
        }

        try {
            int rgb = Integer.parseInt(color.substring(1), 16);
            int r = (rgb >> 16) & 0xFF;
            int g = (rgb >> 8) & 0xFF;
            int b = rgb & 0xFF;

            r = Math.max(0, Math.min(255, (int) (r + factor * 255)));
            g = Math.max(0, Math.min(255, (int) (g + factor * 255)));
            b = Math.max(0, Math.min(255, (int) (b + factor * 255)));

            return String.format("#%02X%02X%02X", r, g, b);
        } catch (Exception e) {
            return color;
        }
    }
}