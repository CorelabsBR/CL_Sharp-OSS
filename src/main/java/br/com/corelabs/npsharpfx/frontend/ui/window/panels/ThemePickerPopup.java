/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.window.panels;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Supplier;

import br.com.corelabs.npsharpfx.frontend.ui.theme.ThemeManager;
import br.com.corelabs.npsharpfx.frontend.ui.theme.VSCodeThemeEntry;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.VSCodeLayoutAnimator;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.shape.Rectangle;
import javafx.stage.Popup;
import javafx.stage.Stage;

public class ThemePickerPopup {

    private final Stage stage;
    private final ThemeManager themeManager;
    private final String promptText;
    private final Supplier<Collection<VSCodeThemeEntry>> themesSupplier;
    private final Supplier<String> styleSupplier;
    private final Supplier<StackPane> wallpaperLayerSupplier;
    private final Supplier<Rectangle> wallpaperOverlaySupplier;
    private final Supplier<StackPane> appRootSupplier;
    private final Consumer<String> statusUpdater;

    private Popup popup;
    private TextField input;
    private ListView<VSCodeThemeEntry> list;

    public ThemePickerPopup(
            Stage stage,
            ThemeManager themeManager,
            String promptText,
            Supplier<Collection<VSCodeThemeEntry>> themesSupplier,
            Supplier<String> styleSupplier,
            Supplier<StackPane> wallpaperLayerSupplier,
            Supplier<Rectangle> wallpaperOverlaySupplier,
            Supplier<StackPane> appRootSupplier,
            Consumer<String> statusUpdater) {

        this.stage = stage;
        this.themeManager = themeManager;
        this.promptText = promptText;
        this.themesSupplier = themesSupplier;
        this.styleSupplier = styleSupplier;
        this.wallpaperLayerSupplier = wallpaperLayerSupplier;
        this.wallpaperOverlaySupplier = wallpaperOverlaySupplier;
        this.appRootSupplier = appRootSupplier;
        this.statusUpdater = statusUpdater;
    }

    public boolean isShowing() {
        return popup != null && popup.isShowing();
    }

    public void show() {
        if (isShowing()) {
            hide();
            return;
        }

        input = new TextField();
        input.getStyleClass().add("command-palette-input");
        input.setPromptText(promptText);

        list = new ListView<>();
        list.getStyleClass().add("command-palette-list");
        list.setPrefHeight(340);
        Label placeholder = new Label("Nenhum tema encontrado");
        placeholder.getStyleClass().add("quick-open-placeholder");
        list.setPlaceholder(placeholder);
        list.setCellFactory(items -> new ListCell<>() {
            @Override
            protected void updateItem(VSCodeThemeEntry item, boolean empty) {
                super.updateItem(item, empty);

                if (empty || item == null) {
                    setText(null);
                    return;
                }

                String marker = themeManager.isThemeActive(item.getId()) ? "* " : "  ";
                String type = item.isDark() ? "Dark" : "Light";
                setText(marker + item.getLabel() + "    " + type);
            }
        });

        input.textProperty().addListener((obs, oldValue, newValue) -> updateResults(newValue));
        input.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                applySelectedTheme();
                event.consume();
            } else if (event.getCode() == KeyCode.ESCAPE) {
                hide();
                event.consume();
            } else if (event.getCode() == KeyCode.DOWN) {
                moveSelection(1);
                list.requestFocus();
                event.consume();
            } else if (event.getCode() == KeyCode.UP) {
                moveSelection(-1);
                list.requestFocus();
                event.consume();
            }
        });

        list.setOnMouseClicked(event -> {
            if (list.getSelectionModel().getSelectedItem() != null) {
                applySelectedTheme();
                event.consume();
            }
        });
        list.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                applySelectedTheme();
                event.consume();
            } else if (event.getCode() == KeyCode.ESCAPE) {
                hide();
                event.consume();
            } else if (event.getCode() == KeyCode.DOWN) {
                moveSelection(1);
                event.consume();
            } else if (event.getCode() == KeyCode.UP) {
                moveSelection(-1);
                event.consume();
            }
        });

        VBox content = new VBox(input, list);
        content.getStyleClass().add("command-palette");
        content.setStyle(resolveStyle());
        content.setPrefWidth(Math.min(720, Math.max(520, stage.getWidth() * 0.55)));

        popup = new Popup();
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(content);

        updateResults("");
        popup.show(
                stage,
                stage.getX() + (stage.getWidth() - content.getPrefWidth()) / 2,
                stage.getY() + 58
        );
        VSCodeLayoutAnimator.fadeSlideIn(content, 0, -8);
        input.requestFocus();
    }

    public void hide() {
        if (popup != null) {
            popup.hide();
        }
    }

    private void updateResults(String query) {
        if (list == null) {
            return;
        }

        String normalizedQuery = normalize(query);
        List<VSCodeThemeEntry> filtered = getThemes().stream()
                .filter(entry -> normalizedQuery.isBlank() || matches(entry, normalizedQuery))
                .toList();

        list.getItems().setAll(filtered);
        selectActiveOrFirstTheme();
    }

    private Collection<VSCodeThemeEntry> getThemes() {
        Collection<VSCodeThemeEntry> themes = themesSupplier == null ? null : themesSupplier.get();
        return themes == null ? List.of() : themes;
    }

    private boolean matches(VSCodeThemeEntry entry, String query) {
        String searchable = normalize(entry.getLabel())
                + " " + normalize(entry.getId())
                + " " + normalize(entry.getUiTheme())
                + " " + normalize(entry.getCategory())
                + " " + normalize(String.join(" ", entry.getCategories()))
                + " " + normalize(entry.getImage())
                + " " + normalize(entry.getPreview())
                + " " + normalize(String.join(" ", entry.getPreviews()))
                + (entry.isDark() ? " dark escuro" : " light claro");
        return searchable.contains(query);
    }

    private void selectActiveOrFirstTheme() {
        if (list == null || list.getItems().isEmpty()) {
            return;
        }

        int activeIndex = -1;
        for (int i = 0; i < list.getItems().size(); i++) {
            if (themeManager.isThemeActive(list.getItems().get(i).getId())) {
                activeIndex = i;
                break;
            }
        }

        int index = activeIndex >= 0 ? activeIndex : 0;
        list.getSelectionModel().select(index);
        list.scrollTo(index);
    }

    private void moveSelection(int delta) {
        if (list == null || list.getItems().isEmpty()) {
            return;
        }

        int current = list.getSelectionModel().getSelectedIndex();
        int max = list.getItems().size() - 1;
        int next = current < 0 ? 0 : Math.max(0, Math.min(max, current + delta));

        list.getSelectionModel().select(next);
        list.getFocusModel().focus(next);
        list.scrollTo(next);
    }

    private void applySelectedTheme() {
        VSCodeThemeEntry selected = list == null
                ? null
                : list.getSelectionModel().getSelectedItem();

        if (selected == null) {
            return;
        }

        themeManager.setTheme(
                selected.getId(),
                wallpaperLayerSupplier.get(),
                wallpaperOverlaySupplier.get(),
                appRootSupplier.get()
        );
        hide();

        if (statusUpdater != null) {
            statusUpdater.accept("Tema aplicado: " + selected.getLabel());
        }
    }

    private String resolveStyle() {
        String style = styleSupplier == null ? null : styleSupplier.get();
        return style == null ? "" : style;
    }

    private String normalize(String text) {
        return text == null
                ? ""
                : text.toLowerCase(Locale.ROOT).replace(':', ' ').trim();
    }
}
