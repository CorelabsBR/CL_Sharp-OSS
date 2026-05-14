package br.com.corelabs.npsharpfx.frontend.ui.theme;

/**
 * Gerador de CSS dinâmico baseado em temas do VSCode.
 *
 * Responsabilidades:
 * 1) Ler cores de um EditorTheme (do JSON)
 * 2) Gerar CSS válido para JavaFX
 * 3) Mapear cores do VSCode para componentes JavaFX
 *
 * Fluxo:
 *
 * EditorTheme (cores do JSON)
 *      ↓
 * CSSThemeGenerator
 *      ↓
 * String CSS formatada
 *      ↓
 * Aplicada na Scene
 *
 * A geração de CSS permite que toda a interface
 * mude de cores dinamicamente sem recarregar
 * ou reiniciar a aplicação.
 *
 * Classe utilitária (somente métodos estáticos).
 */
public final class CSSThemeGenerator {

    /**
     * Construtor privado para impedir instanciação.
     */
    private CSSThemeGenerator() {
    }

    /**
     * Gera CSS completo para um tema.
     *
     * @param theme EditorTheme com as cores
     * @return String contendo CSS válido para JavaFX
     */
    public static String generateThemeCSS(EditorTheme theme) {
        if (theme == null) {
            return generateDefaultCSS();
        }

        StringBuilder css = new StringBuilder();

        // Obtém cores principais do tema
        String bg = theme.color("editor.background", "#0C1021");
        String fg = theme.color("editor.foreground", "#D4D4D4");
        String borderColor = theme.color("editorGutter.background", "#2E3436");
        String selectedBg = theme.color("editorBracketMatch.background", "#253B76");
        
        // Cores de temas especiais
        String accentColor = theme.color("activityBar.foreground", "#FAAA3C");

        // Determina se é tema claro ou escuro
        String type = theme.getType();
        boolean isDark = "dark".equalsIgnoreCase(type);

        // Calcula cores derivadas
        String dimmedFg = isDark ? "#9DA5B4" : "#666666";
        String panelBg = adjustBrightness(bg, isDark ? 0.05 : -0.05);
        String buttonHoverBg = adjustBrightness(bg, isDark ? 0.1 : -0.1);

        // ROOT
        css.append(".root, .root-pane {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-font-family: \"JetBrains Mono\", \"Consolas\"\n");
        css.append("}\n\n");

        // LABEL
        css.append(".label {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n\n");

        // WALLPAPER LAYER
        css.append(".wallpaper-layer {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("}\n\n");

        // TITLE BAR
        css.append(".title-bar {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("    -fx-border-width: 0 0 1 0;\n");
        css.append("}\n\n");

        // TITLE MENU
        css.append(".title-menu {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".title-menu:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        // TITLE TOOLBAR BUTTON
        css.append(".title-toolbar-button {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".title-toolbar-button:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n");
        css.append(".title-toolbar-button-disabled {\n");
        css.append("    -fx-opacity: 0.5;\n");
        css.append("}\n\n");

        // COMMAND BAR
        css.append(".command-bar {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".command-bar:focused {\n");
        css.append("    -fx-border-color: ").append(accentColor).append(";\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        // WINDOW BUTTONS
        css.append(".window-button {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".window-button:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n");
        css.append(".window-button-close:hover {\n");
        css.append("    -fx-background-color: #EF2929;\n");
        css.append("}\n\n");

        // ACTIVITY BAR
        css.append(".activity-bar {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".activity-icon {\n");
        css.append("    -fx-background-color: transparent;\n");
        css.append("}\n");
        css.append(".activity-icon:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n");
        css.append(".activity-icon.active {\n");
        css.append("    -fx-border-color: ").append(accentColor).append(";\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        // SIDE PANEL
        css.append(".side-panel-host {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".side-panel-header {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".panel-title {\n");
        css.append("    -fx-text-fill: ").append(dimmedFg).append(";\n");
        css.append("}\n\n");

        // FILE TREE
        css.append(".file-tree .tree-cell {\n");
        css.append("    -fx-background-color: transparent;\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".file-tree .tree-cell:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n");
        css.append(".file-tree .tree-cell:selected {\n");
        css.append("    -fx-background-color: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        // EDITOR TABS
        css.append(".editor-tabs {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab-header-area,\n");
        css.append(".editor-tabs .tab-header-background {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab:selected {\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-border-color: ").append(accentColor).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab-label {\n");
        css.append("    -fx-text-fill: ").append(dimmedFg).append(";\n");
        css.append("}\n");
        css.append(".editor-tabs .tab:selected .tab-label {\n");
        css.append("    -fx-text-fill: ").append(accentColor).append(";\n");
        css.append("}\n\n");

        // TEXT AREA / EDITOR
        css.append(".editor-textarea {\n");
        css.append("    -fx-control-inner-background: ").append(bg).append(";\n");
        css.append("    -fx-background-color: ").append(bg).append(";\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-highlight-fill: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        // BUTTON
        css.append(".button {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".button-primary {\n");
        css.append("    -fx-background-color: ").append(accentColor).append(";\n");
        css.append("    -fx-text-fill: ").append(bg).append(";\n");
        css.append("}\n\n");

        // SCROLLPANE
        css.append(".scroll-pane {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n");
        css.append(".scroll-pane .viewport {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n\n");

        // CONTEXT MENU / POPUP
        css.append(".context-menu {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n");
        css.append(".context-menu-item {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("}\n");
        css.append(".context-menu-row:hover {\n");
        css.append("    -fx-background-color: ").append(buttonHoverBg).append(";\n");
        css.append("}\n\n");

        // SEPARADOR
        css.append(".separator {\n");
        css.append("    -fx-border-color: ").append(borderColor).append(";\n");
        css.append("}\n\n");

        // SETTINGS MENU (para tema chooser)
        css.append(".settings-menu-item {\n");
        css.append("    -fx-text-fill: ").append(fg).append(";\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("    -fx-padding: 8 12 8 12;\n");
        css.append("    -fx-cursor: hand;\n");
        css.append("}\n");
        css.append(".settings-menu-item:hover {\n");
        css.append("    -fx-background-color: ").append(selectedBg).append(";\n");
        css.append("}\n\n");

        css.append(".theme-chooser-content {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n");
        css.append(".theme-chooser-scroll {\n");
        css.append("    -fx-background-color: ").append(panelBg).append(";\n");
        css.append("}\n");

        return css.toString();
    }

    /**
     * Gera CSS padrão (fallback).
     */
    private static String generateDefaultCSS() {
        return generateThemeCSS(createDefaultTheme());
    }

    /**
     * Cria um tema padrão como fallback.
     */
    private static EditorTheme createDefaultTheme() {
        EditorTheme theme = new EditorTheme();
        theme.setId("default");
        theme.setName("Default");
        theme.setType("dark");
        theme.getColors().put("editor.background", "#0C1021");
        theme.getColors().put("editor.foreground", "#D4D4D4");
        return theme;
    }

    /**
     * Ajusta o brilho de uma cor hex.
     *
     * @param color cor em formato #RRGGBB
     * @param factor fator de ajuste (-1.0 a 1.0)
     * @return cor ajustada em formato #RRGGBB
     */
    private static String adjustBrightness(String color, double factor) {
        if (color == null || !color.matches("#[0-9A-Fa-f]{6}")) {
            return color;
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


