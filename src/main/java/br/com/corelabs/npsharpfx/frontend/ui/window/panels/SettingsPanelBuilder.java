/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.window.panels;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Separator;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.VBox;

public class SettingsPanelBuilder {
    
    

public Node buildSettingsPanel(
        Runnable openCommandPalette,
        Runnable onAppearanceClick,
        Runnable openSettingsView,
        Runnable onThemesClick,
        Runnable onWallpaperClick,
        Runnable onRemoveWallpaperClick) {

    VBox content = new VBox();
    content.setSpacing(0);
    content.getStyleClass().add("settings-panel-content");

    VBox appearanceSubmenu = new VBox();
    appearanceSubmenu.setSpacing(0);
    appearanceSubmenu.getStyleClass().add("settings-submenu");
    appearanceSubmenu.setVisible(false);
    appearanceSubmenu.setManaged(false);
    Button commandPaletteButton = createSettingsMenuItem("Command Palette...", "Ctrl+Shift+P", openCommandPalette);

    Button colorThemeButton = createSettingsMenuItem("Color Theme...", "Escolher", onThemesClick);
    Button wallpaperButton = createSettingsMenuItem("Wallpaper...", "Escolher", onWallpaperClick);
    Button clearWallpaperButton = createSettingsMenuItem("Clear Wallpaper", null, onRemoveWallpaperClick);

    colorThemeButton.getStyleClass().add("settings-submenu-item");
    wallpaperButton.getStyleClass().add("settings-submenu-item");
    clearWallpaperButton.getStyleClass().add("settings-submenu-item");

    appearanceSubmenu.getChildren().addAll(
            commandPaletteButton,
            colorThemeButton,
            wallpaperButton,
            clearWallpaperButton
    );
// sabemos que me motivou. presente no commit f0655d6.
    Button appearanceButton = createSettingsMenuItem("Aparencia", "›", onAppearanceClick);

    content.getChildren().addAll(
        commandPaletteButton,
        createSettingsMenuItem("Settings", "Ctrl+,", openSettingsView),
        createSettingsMenuItem("Keyboard Shortcuts", "Ctrl+K Ctrl+S"),
        createSettingsMenuItem("Snippets"),
        createSettingsMenuItem("Tasks"),

        new Separator(),

        appearanceButton,
        appearanceSubmenu,

        new Separator(),

        createSettingsMenuItem("Backup and Sync Settings..."),
        createSettingsMenuItem("Download Update (1)")
)       ;
    ScrollPane scrollPane = new ScrollPane(content);
    scrollPane.setFitToWidth(true);
    scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
    scrollPane.getStyleClass().add("settings-scroll");

    return scrollPane;
}

    private Label createSectionTitle(String text) {
        Label label = new Label(text.toUpperCase());
        label.getStyleClass().add("settings-section-title");
        label.setMaxWidth(Double.MAX_VALUE);
        return label;
    }

    private Button createSettingsMenuItem(String text) {
        return createSettingsMenuItem(text, null, null);
    }

    private Button createSettingsMenuItem(String text, String shortcut) {
        return createSettingsMenuItem(text, shortcut, null);
    }
    

    private Button createSettingsMenuItem(String text, String shortcut, Runnable action) {
        Button button = new Button();
        button.getStyleClass().add("settings-menu-item");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setPrefHeight(42);
        button.setFocusTraversable(false);

        BorderPane row = new BorderPane();
        row.setMaxWidth(Double.MAX_VALUE);

        Label left = new Label(text);
        left.getStyleClass().add("settings-menu-text");
        row.setLeft(left);

        if (shortcut != null && !shortcut.isBlank()) {
            Label right = new Label(shortcut);
            right.getStyleClass().add("settings-menu-shortcut");
            row.setRight(right);
        }

        button.setGraphic(row);

        if (action != null) {
            button.setOnAction(event -> action.run());
        }

        return button;
    }

    public Node buildPlaceholderPanel(String title, String message) {
        VBox content = new VBox();
        content.setSpacing(10);
        content.setPadding(new Insets(12, 14, 14, 14));
        content.setAlignment(javafx.geometry.Pos.TOP_LEFT);

        Label description = new Label(message);
        description.setWrapText(true);
        description.getStyleClass().add("panel-section-title");

        content.getChildren().add(description);

        return content;
    }
}