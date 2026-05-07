package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Classe File do Java usada para representar arquivos do sistema.
// Aqui ela é usada para lidar com o wallpaper personalizado escolhido pelo usuário.
import java.io.File;

import javafx.scene.image.Image;
import javafx.scene.layout.Background;
import javafx.scene.layout.BackgroundImage;
import javafx.scene.layout.BackgroundPosition;
import javafx.scene.layout.BackgroundRepeat;
import javafx.scene.layout.BackgroundSize;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;

/**
 * Classe responsável por gerenciar tema visual e wallpaper da aplicação.
 *
 * Esse cara é o "orquestrador" do sistema visual do editor.
 *
 * Responsabilidades:
 *
 * 1) Saber qual tema está ativo
 * 2) Aplicar cor de fundo da aplicação
 * 3) Aplicar wallpaper, se existir
 * 4) Controlar overlay sobre o wallpaper
 * 5) Persistir alterações nas preferências do usuário
 *
 * Estrutura visual que essa classe controla:
 *
 * StackPane wallpaperLayer  -> camada onde a imagem de fundo é aplicada
 * Rectangle overlay         -> camada semitransparente sobre o wallpaper
 * StackPane appRoot         -> raiz principal da aplicação
 *
 * Fluxo:
 *
 * UserPreferences
 *      ↓
 * ThemeManager
 *      ↓
 * EditorTheme + Wallpaper
 *      ↓
 * UI atualizada
 */
public class ThemeManager {

    /**
     * Registro de temas disponíveis.
     *
     * Provavelmente contém todos os temas carregáveis do sistema.
     */
    private final ThemeRegistry registry;

    /**
     * Preferências persistidas do usuário.
     *
     * Aqui ficam dados como:
     * - tema selecionado
     * - caminho do wallpaper
     * - opacidade do wallpaper
     * - se wallpaper está ativado
     */
    private final UserPreferences preferences;

    /**
     * Construtor padrão.
     *
     * Inicializa:
     * - registro de temas
     * - preferências carregadas do disco
     */
    public ThemeManager() {
        this.registry = new ThemeRegistry();
        this.preferences = PreferencesManager.load();
    }

    /**
     * Retorna o registro de temas.
     */
    public ThemeRegistry getRegistry() {
        return registry;
    }

    /**
     * Retorna as preferências atuais do usuário.
     */
    public UserPreferences getPreferences() {
        return preferences;
    }

    /**
     * Retorna o tema atualmente selecionado.
     *
     * O ID do tema vem das preferências,
     * e o ThemeRegistry resolve o objeto EditorTheme real.
     */
    public EditorTheme getCurrentTheme() {
        return (EditorTheme) registry.getTheme(preferences.getSelectedThemeId());
    }

    /**
     * Retorna a entrada do tema (metadados) do tema atualmente selecionado.
     *
     * Permite acessar informações como label, uiTheme, etc.
     */
    public VSCodeThemeEntry getCurrentThemeEntry() {
        for (VSCodeThemeEntry entry : registry.getEntries()) {
            if (entry.getId().equals(preferences.getSelectedThemeId())) {
                return entry;
            }
        }
        return null;
    }

    /**
     * Verifica se o tema com o ID fornecido é o tema ativo.
     *
     * @param themeId ID do tema para verificar
     * @return true se o tema é o ativo, false caso contrário
     */
    public boolean isThemeActive(String themeId) {
        return themeId.equals(preferences.getSelectedThemeId());
    }

    /**
     * Aplica o tema completo na interface.
     *
     * Esse método faz duas coisas principais:
     *
     * 1) Aplica cor de fundo da aplicação
     * 2) Aplica wallpaper + overlay
     *
     * @param wallpaperLayer camada do wallpaper
     * @param overlay camada de overlay sobre o wallpaper
     * @param appRoot raiz principal da aplicação
     */
    public void applyTheme(StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {
        EditorTheme theme = getCurrentTheme();
        boolean dark = theme.isDark();
        String defaultBg = dark ? "#0C1021" : "#FFFFFF";
        String defaultFg = dark ? "#F8F8F8" : "#333333";
        String rootColor = theme.color("editor.background", defaultBg);

        // Gera estilo com looked-up colors para cascata CSS
        StringBuilder style = new StringBuilder();
        style.append("-fx-background-color: ").append(rootColor).append(";");

        // Define looked-up colors que o CSS referencia
        appendColor(style, theme, "theme-bg", "editor.background", defaultBg);
        appendColor(style, theme, "theme-fg", "editor.foreground", defaultFg);
        appendColor(style, theme, "theme-sidebar-bg", "sideBar.background", rootColor);
        // Fallbacks variam conforme tipo do tema (claro vs escuro)
        String fgFallback = defaultFg;
        String borderFallback = dark ? "#2E3436" : "#E0E0E0";
        String accentFallback = dark ? "#FCE94F" : "#007ACC";
        String selectionFallback = dark ? "#253B76" : "#ADD6FF";
        String buttonBgFallback = dark ? "#2E3436" : "#007ACC";
        String buttonFgFallback = dark ? "#F8F8F8" : "#FFFFFF";
        String descFgFallback = dark ? "#CCCCCC" : "#6F6F6F";
        String promptFgFallback = dark ? "#555753" : "#767676";

        appendColor(style, theme, "theme-sidebar-fg", "sideBar.foreground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-sidebar-border", "sideBar.border", borderFallback);
        appendColor(style, theme, "theme-titlebar-bg", "titleBar.activeBackground", rootColor);
        appendColor(style, theme, "theme-titlebar-fg", "titleBar.activeForeground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-titlebar-border", "titleBar.border", borderFallback);
        appendColor(style, theme, "theme-activitybar-bg", "activityBar.background", rootColor);
        appendColor(style, theme, "theme-activitybar-fg", "activityBar.foreground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-activitybar-active", "activityBar.activeBorder", accentFallback);
        appendColor(style, theme, "theme-tab-active-bg", "tab.activeBackground", rootColor);
        appendColor(style, theme, "theme-tab-active-fg", "tab.activeForeground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-tab-inactive-bg", "tab.inactiveBackground", darkenOrLighten(rootColor, dark));
        appendColor(style, theme, "theme-tab-inactive-fg", "tab.inactiveForeground", "#808080");
        appendColor(style, theme, "theme-tab-border", "tab.border", borderFallback);
        appendColor(style, theme, "theme-tab-active-top", "tab.activeBorderTop", accentFallback);
        appendColor(style, theme, "theme-tab-hover-bg", "tab.hoverBackground", darkenOrLighten(rootColor, dark));
        appendColor(style, theme, "theme-statusbar-bg", "statusBar.background", "#007ACC");
        appendColor(style, theme, "theme-statusbar-fg", "statusBar.foreground", "#FFFFFF");
        appendColor(style, theme, "theme-border", "editorGroup.border", borderFallback);
        appendColor(style, theme, "theme-input-bg", "input.background", darkenOrLighten(rootColor, dark));
        appendColor(style, theme, "theme-input-border", "input.border", borderFallback);
        appendColor(style, theme, "theme-input-fg", "input.foreground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-list-hover-bg", "list.hoverBackground", darkenOrLighten(rootColor, dark));
        appendColor(style, theme, "theme-list-active-bg", "list.activeSelectionBackground", selectionFallback);
        appendColor(style, theme, "theme-list-active-fg", "list.activeSelectionForeground", "#FFFFFF");
        appendColor(style, theme, "theme-selection-bg", "editor.selectionBackground", selectionFallback);
        appendColor(style, theme, "theme-panel-bg", "panel.background", rootColor);
        appendColor(style, theme, "theme-panel-border", "panel.border", borderFallback);
        appendColor(style, theme, "theme-terminal-bg", "terminal.background", rootColor);
        appendColor(style, theme, "theme-terminal-fg", "terminal.foreground", theme.color("editor.foreground", fgFallback));
        appendColor(style, theme, "theme-button-bg", "button.background", buttonBgFallback);
        appendColor(style, theme, "theme-button-fg", "button.foreground", buttonFgFallback);
        appendColor(style, theme, "theme-accent", "focusBorder", accentFallback);
        appendColor(style, theme, "theme-highlight", "editor.lineHighlightBackground", darkenOrLighten(rootColor, dark));

        // Cores adicionais para eliminar hardcoded do CSS
        appendColor(style, theme, "theme-brand", "progressBar.background", theme.color("activityBar.activeBorder", accentFallback));
        String brandColor = theme.color("progressBar.background", theme.color("activityBar.activeBorder", accentFallback));
        style.append("theme-brand-hover: ").append(lighten(brandColor, 0.2)).append(";");
        appendColor(style, theme, "theme-description-fg", "descriptionForeground", descFgFallback);
        appendColor(style, theme, "theme-prompt-fg", "input.placeholderForeground", promptFgFallback);
        appendColor(style, theme, "theme-error", "errorForeground", "#EF2929");

        appRoot.setBackground(null);
        appRoot.setStyle(style.toString());

        // Classe CSS para wallpaper ativo
        appRoot.getStyleClass().remove("wallpaper-active");
        String wpPath = preferences.getCustomWallpaperPath();
        if (preferences.isWallpaperEnabled() && wpPath != null && !wpPath.isBlank()) {
            appRoot.getStyleClass().add("wallpaper-active");
        }

        // WallpaperLayer sempre transparente
        if (wallpaperLayer != null) {
            wallpaperLayer.setBackground(null);
            wallpaperLayer.setStyle("-fx-background-color: transparent;");
        }
        if (overlay != null) {
            overlay.setFill(Color.TRANSPARENT);
        }

        applyWallpaper(theme, wallpaperLayer, overlay);
    }

    private void appendColor(StringBuilder sb, EditorTheme theme, String varName, String themeKey, String fallback) {
        String color = theme.color(themeKey, fallback);
        sb.append(varName).append(": ").append(color).append(";");
    }

    private String darkenOrLighten(String hexColor, boolean isDark) {
        try {
            Color c = Color.web(hexColor);
            if (isDark) {
                return toHex(c.deriveColor(0, 1, 1.15, 1));
            } else {
                return toHex(c.deriveColor(0, 1, 0.93, 1));
            }
        } catch (Exception e) {
            return isDark ? "#121830" : "#E8E8E8";
        }
    }

    private String lighten(String hexColor, double amount) {
        try {
            Color c = Color.web(hexColor);
            double r = Math.min(1.0, c.getRed() + amount);
            double g = Math.min(1.0, c.getGreen() + amount);
            double b = Math.min(1.0, c.getBlue() + amount);
            return toHex(new Color(r, g, b, 1.0));
        } catch (Exception e) {
            return "#FFC266";
        }
    }

    private String toHex(Color c) {
        return String.format("#%02X%02X%02X",
                (int) (c.getRed() * 255),
                (int) (c.getGreen() * 255),
                (int) (c.getBlue() * 255));
    }

    /**
     * Define um novo tema.
     *
     * Processo:
     * 1) Atualiza preferência
     * 2) Salva no disco
     * 3) Reaplica a interface
     *
     * @param themeId ID do novo tema
     */
    public void setTheme(String themeId, StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {
        preferences.setSelectedThemeId(themeId);
        PreferencesManager.save(preferences);
        applyTheme(wallpaperLayer, overlay, appRoot);
    }

    /**
     * Define um wallpaper personalizado.
     *
     * Processo:
     * 1) Valida arquivo
     * 2) Salva caminho absoluto
     * 3) Ativa wallpaper
     * 4) Salva preferências
     * 5) Reaplica a interface
     *
     * @param sourceFile arquivo de imagem escolhido pelo usuário
     */
    public void setWallpaper(File sourceFile, StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {

        // Validação básica do arquivo
        if (sourceFile == null || !sourceFile.exists() || !sourceFile.isFile()) {
            return;
        }

        // Salva caminho absoluto do wallpaper
        preferences.setCustomWallpaperPath(sourceFile.getAbsolutePath());

        // Ativa uso do wallpaper
        preferences.setWallpaperEnabled(true);

        // Persiste no disco
        PreferencesManager.save(preferences);

        // Reaplica tema
        applyTheme(wallpaperLayer, overlay, appRoot);
    }

    /**
     * Remove wallpaper atual das preferências.
     *
     * Não apaga o arquivo do disco.
     * Apenas remove a referência ao caminho salvo.
     */
    public void clearWallpaper(StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {
        preferences.setCustomWallpaperPath(null);
        PreferencesManager.save(preferences);
        applyTheme(wallpaperLayer, overlay, appRoot);
    }

    /**
     * Ativa ou desativa o uso de wallpaper.
     */
    public void setWallpaperEnabled(boolean enabled, StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {
        preferences.setWallpaperEnabled(enabled);
        PreferencesManager.save(preferences);
        applyTheme(wallpaperLayer, overlay, appRoot);
    }

    /**
     * Define opacidade do overlay do wallpaper.
     *
     * O valor é normalizado entre 0.0 e 1.0.
     *
     * @param opacity opacidade desejada
     */
    public void setWallpaperOpacity(double opacity, StackPane wallpaperLayer, Rectangle overlay, StackPane appRoot) {

        // Garante faixa válida
        double normalized = Math.max(0.0, Math.min(1.0, opacity));

        preferences.setWallpaperOpacity(normalized);
        PreferencesManager.save(preferences);
        applyTheme(wallpaperLayer, overlay, appRoot);
    }

    /**
     * Aplica o wallpaper e o overlay visual.
     *
     * Funcionamento:
     *
     * - limpa background antigo
     * - verifica se wallpaper está habilitado
     * - verifica se caminho é válido
     * - aplica imagem centralizada e redimensionada
     * - aplica overlay escuro ou claro dependendo do tema
     *
     * @param theme tema atual
     * @param wallpaperLayer camada onde a imagem será aplicada
     * @param overlay retângulo usado para escurecer/clariar o wallpaper
     */
    private void applyWallpaper(EditorTheme theme, StackPane wallpaperLayer, Rectangle overlay) {

        /**
         * Limpa background anterior do wallpaper.
         */
        wallpaperLayer.setBackground(null);
        wallpaperLayer.setStyle("-fx-background-color: transparent;");

        /**
         * Obtém caminho configurado nas preferências.
         */
        String path = preferences.getCustomWallpaperPath();

        /**
         * Se wallpaper estiver desativado, ou não houver caminho válido,
         * o overlay fica transparente e nada é desenhado.
         */
        if (!preferences.isWallpaperEnabled() || path == null || path.isBlank()) {
            overlay.setFill(Color.TRANSPARENT);
            return;
        }

        /**
         * Cria objeto File baseado no caminho salvo.
         */
        File file = new File(path);

        /**
         * Se arquivo não existir ou não for arquivo válido,
         * não aplica wallpaper.
         */
        if (!file.exists() || !file.isFile()) {
            overlay.setFill(Color.TRANSPARENT);
            return;
        }

        /**
         * Carrega a imagem do wallpaper.
         *
         * O "true" no final ativa carregamento em background.
         */
        Image image = new Image(file.toURI().toString(), true);

        /**
         * Aplica a imagem como background do wallpaperLayer.
         *
         * Configurações:
         * - sem repetição
         * - centralizada
         * - escala para cobrir área disponível
         */
        wallpaperLayer.setBackground(new Background(new BackgroundImage(
                image,
                BackgroundRepeat.NO_REPEAT,
                BackgroundRepeat.NO_REPEAT,
                BackgroundPosition.CENTER,
                new BackgroundSize(
                        100, 100,
                        true, true,
                        true, true
                )
        )));

        /**
         * Define cor do overlay baseada no tipo do tema.
         *
         * Tema escuro -> overlay preto
         * Tema claro  -> overlay branco
         *
         * Isso ajuda a harmonizar a imagem com a UI.
         */
        String overlayColor = theme.isDark() ? "#000000" : "#FFFFFF";

        /**
         * Obtém opacidade configurada e garante faixa válida.
         */
        double opacity = Math.max(0.0, Math.min(1.0, preferences.getWallpaperOpacity()));

        /**
         * Aplica cor + opacidade no overlay.
         */
        overlay.setFill(Color.web(overlayColor, opacity));
    }
}

