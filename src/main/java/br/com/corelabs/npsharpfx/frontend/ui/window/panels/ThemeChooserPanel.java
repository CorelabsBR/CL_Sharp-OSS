package br.com.corelabs.npsharpfx.frontend.ui.window.panels;

import br.com.corelabs.npsharpfx.frontend.ui.theme.ThemeManager;
import br.com.corelabs.npsharpfx.frontend.ui.theme.VSCodeThemeEntry;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.shape.Rectangle;

public class ThemeChooserPanel {

    private final ThemeManager themeManager;

    public ThemeChooserPanel(ThemeManager themeManager) {
        this.themeManager = themeManager;
    }

    public javafx.scene.Node buildThemeChooserPanel(
            StackPane wallpaperLayer,
            Rectangle wallpaperOverlay,
            StackPane appRoot,
            Runnable onThemeSelected) {

        VBox content = new VBox();
        content.getStyleClass().add("theme-chooser-content");
        content.setSpacing(4);
        content.setPadding(new Insets(10));

        for (VSCodeThemeEntry entry : themeManager.getRegistry().getEntries()) {
            HBox themeRow = new HBox();
            themeRow.setSpacing(8);
            themeRow.setAlignment(Pos.CENTER_LEFT);
            themeRow.getStyleClass().add("theme-row-container");

            Button button = new Button();
            button.getStyleClass().add("settings-menu-item");
            button.setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(button, Priority.ALWAYS);

            String themeType = entry.isDark() ? " [Dark]" : " [Light]";
            String themeLabel = entry.getLabel() + themeType;

            if (themeManager.isThemeActive(entry.getId())) {
                themeLabel = "● " + themeLabel;
                button.getStyleClass().add("theme-active");
            }

            BorderPane row = new BorderPane();
            row.setMaxWidth(Double.MAX_VALUE);
            Label nameLabel = new Label(themeLabel);
            nameLabel.getStyleClass().add("settings-menu-text");
            row.setLeft(nameLabel);

            button.setGraphic(row);

            button.setOnAction(e -> {
                themeManager.setTheme(entry.getId(), wallpaperLayer, wallpaperOverlay, appRoot);
                if (onThemeSelected != null) {
                    onThemeSelected.run();
                }
            });

            themeRow.getChildren().add(button);
            content.getChildren().add(themeRow);
        }

        ScrollPane scrollPane = new ScrollPane(content);
        scrollPane.setFitToWidth(true);
        scrollPane.getStyleClass().add("theme-chooser-scroll");

        return scrollPane;
    }
}


