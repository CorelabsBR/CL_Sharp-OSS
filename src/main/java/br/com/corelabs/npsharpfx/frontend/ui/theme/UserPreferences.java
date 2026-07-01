/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */


package br.com.corelabs.npsharpfx.frontend.ui.theme;

/**
 * Classe que representa as preferências do usuário
 * relacionadas à aparência do editor.
 *
 * Essa classe funciona como um modelo de dados simples
 * (POJO - Plain Old Java Object).
 *
 * Ela é serializada e desserializada para JSON pelo
 * PreferencesManager usando Gson.
 *
 * Ou seja:
 *
 * UserPreferences (objeto Java)
 *        ↓
 * PreferencesManager.save()
 *        ↓
 * config.json
 *
 * E o caminho inverso:
 *
 * config.json
 *        ↓
 * PreferencesManager.load()
 *        ↓
 * UserPreferences
 *
 * Essa classe guarda informações como:
 *
 * - qual tema está selecionado
 * - qual wallpaper personalizado está ativo
 * - opacidade do wallpaper
 * - se wallpaper está habilitado
 */
public class UserPreferences {

    /**
     * ID do tema atualmente selecionado.
     *
     * Esse ID corresponde a um tema registrado no ThemeRegistry.
     *
     * Exemplo:
     * "np-dark"
     * "vscode-dark"
     */
    private String selectedThemeId;

    /**
     * Caminho absoluto do wallpaper personalizado.
     *
     * Exemplo:
     * "C:/Users/Girelli/Pictures/wallpaper.png"
     */
    private String customWallpaperPath;

    /**
     * Opacidade do overlay aplicado sobre o wallpaper.
     *
     * Valor padrão: 0.18
     *
     * Isso significa que o overlay cobre 18% da imagem
     * para melhorar legibilidade da interface.
     *
     * Faixa esperada:
     * 0.0 → totalmente transparente
     * 1.0 → totalmente opaco
     */
    private double wallpaperOpacity = 0.38;

    /**
     * Define se o wallpaper está habilitado ou não.
     *
     * true  → wallpaper aparece
     * false → wallpaper ignorado
     */
    private boolean wallpaperEnabled = true;

    /**
     * Retorna o ID do tema selecionado.
     */
    public String getSelectedThemeId() {
        return selectedThemeId;
    }

    /**
     * Define o ID do tema selecionado.
     */
    public void setSelectedThemeId(String selectedThemeId) {
        this.selectedThemeId = selectedThemeId;
    }

    /**
     * Retorna o caminho do wallpaper personalizado.
     */
    public String getCustomWallpaperPath() {
        return customWallpaperPath;
    }

    /**
     * Define o caminho do wallpaper personalizado.
     */
    public void setCustomWallpaperPath(String customWallpaperPath) {
        this.customWallpaperPath = customWallpaperPath;
    }

    /**
     * Retorna a opacidade do wallpaper.
     */
    public double getWallpaperOpacity() {
        return wallpaperOpacity;
    }

    /**
     * Define a opacidade do wallpaper.
     */
    public void setWallpaperOpacity(double wallpaperOpacity) {
        this.wallpaperOpacity = wallpaperOpacity;
    }

    /**
     * Retorna se o wallpaper está habilitado.
     */
    public boolean isWallpaperEnabled() {
        return wallpaperEnabled;
    }

    /**
     * Define se o wallpaper está habilitado.
     */
    public void setWallpaperEnabled(boolean wallpaperEnabled) {
        this.wallpaperEnabled = wallpaperEnabled;
    }
}
