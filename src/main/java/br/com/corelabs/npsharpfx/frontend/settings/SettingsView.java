/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.settings;

import br.com.corelabs.npsharpfx.config.AppSettings;
import br.com.corelabs.npsharpfx.config.SettingsService;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public class SettingsView {
    private final SettingsService service = SettingsService.getInstance();

    public Node build(Runnable onClose) {
        AppSettings current = copy(service.getSettings());

        BorderPane root = new BorderPane();
        root.getStyleClass().add("settings-view-root");

        TextField search = new TextField();
        search.setPromptText("Search settings");
        search.getStyleClass().add("settings-search");

        ListView<String> categories = new ListView<>();
        categories.getItems().addAll(
                "Appearance",
                "Editor",
                "Terminal",
                "Diagnostics",
                "Build",
                "Workbench"
        );
        categories.setPrefWidth(210);
        categories.getStyleClass().add("settings-category-list");

        VBox left = new VBox(10, search, categories);
        left.setPadding(new Insets(12));
        left.getStyleClass().add("settings-sidebar");

        VBox page = new VBox(14);
        page.setPadding(new Insets(18));
        page.getStyleClass().add("settings-page");

        ScrollPane pageScroll = new ScrollPane(page);
        pageScroll.setFitToWidth(true);
        pageScroll.getStyleClass().add("settings-page-scroll");

        categories.getSelectionModel().selectedItemProperty().addListener((obs, old, selected) -> {
            renderCategory(page, selected, current);
        });

        search.textProperty().addListener((obs, old, value) -> {
            renderSearch(page, value, current);
        });

        categories.getSelectionModel().selectFirst();

        Button save = new Button("Save");
        save.setOnAction(e -> service.update(current));

        Button reset = new Button("Reset");
        reset.setOnAction(e -> {
            service.reset();
            renderCategory(page, categories.getSelectionModel().getSelectedItem(), copy(service.getSettings()));
        });

        Button close = new Button("Close");
        close.setOnAction(e -> {
            if (onClose != null) {
                onClose.run();
            }
        });

        Label path = new Label(service.getSettingsPath().toString());
        path.getStyleClass().add("settings-path");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox footer = new HBox(8, path, spacer, save, reset, close);
        footer.setAlignment(Pos.CENTER_RIGHT);
        footer.setPadding(new Insets(10, 16, 16, 16));
        footer.getStyleClass().add("settings-footer");

        root.setLeft(left);
        root.setCenter(pageScroll);
        root.setBottom(footer);

        return root;
    }

    private void renderCategory(VBox page, String category, AppSettings s) {
        if (category == null) {
            category = "Appearance";
        }

        switch (category) {
            case "Appearance" -> renderAppearance(page, s);
            case "Editor" -> renderEditor(page, s);
            case "Terminal" -> renderTerminal(page, s);
            case "Diagnostics" -> renderDiagnostics(page, s);
            case "Build" -> renderBuild(page, s);
            case "Workbench" -> renderWorkbench(page, s);
            default -> renderAppearance(page, s);
        }
    }

    private void renderSearch(VBox page, String query, AppSettings s) {
        String q = query == null ? "" : query.trim().toLowerCase();

        if (q.isBlank()) {
            return;
        }

        page.getChildren().clear();
        page.getChildren().add(title("Search results"));

        addIfMatch(page, q, "theme", () -> choice(page, "Theme", "UI theme.", s.theme, new String[]{"np-dark", "np-light"}, v -> s.theme = v));
        addIfMatch(page, q, "font", () -> text(page, "Editor Font Family", "Editor font.", s.editorFontFamily, v -> s.editorFontFamily = v));
        addIfMatch(page, q, "font size", () -> integer(page, "Editor Font Size", "Editor font size.", s.editorFontSize, 8, 40, v -> s.editorFontSize = v));
        addIfMatch(page, q, "word wrap", () -> bool(page, "Word Wrap", "Wrap long lines.", s.editorWordWrap, v -> s.editorWordWrap = v));
        addIfMatch(page, q, "terminal", () -> bool(page, "Terminal Enabled", "Enable integrated terminal.", s.terminalEnabled, v -> s.terminalEnabled = v));
        addIfMatch(page, q, "errorlens", () -> bool(page, "ErrorLens Enabled", "Show diagnostics inline.", s.errorLensEnabled, v -> s.errorLensEnabled = v));
        addIfMatch(page, q, "compile", () -> bool(page, "Compile On Save", "Compile Java on save.", s.compileOnSave, v -> s.compileOnSave = v));
        addIfMatch(page, q, "build", () -> text(page, "Build Command", "Build command.", s.buildCommand, v -> s.buildCommand = v));
    }

    private void addIfMatch(VBox page, String query, String keywords, Runnable add) {
        if (keywords.toLowerCase().contains(query)) {
            add.run();
        }
    }

    private void renderAppearance(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Appearance"));

        choice(page, "Theme", "Tema visual principal.", s.theme, new String[]{"np-dark", "np-light"}, v -> s.theme = v);
        text(page, "Icon Theme", "Tema dos ícones.", s.iconTheme, v -> s.iconTheme = v);
        text(page, "Icon Color", "Cor dos ícones, se o tema permitir.", s.iconColor, v -> s.iconColor = v);
        text(page, "Wallpaper Path", "Caminho da imagem de fundo.", s.wallpaperPath, v -> s.wallpaperPath = v);
        decimal(page, "Wallpaper Opacity", "Opacidade do wallpaper.", s.wallpaperOpacity, 0, 1, v -> s.wallpaperOpacity = v);
    }

    private void renderEditor(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Editor"));

        text(page, "Font Family", "Fonte usada no editor.", s.editorFontFamily, v -> s.editorFontFamily = v);
        integer(page, "Font Size", "Tamanho da fonte.", s.editorFontSize, 8, 40, v -> s.editorFontSize = v);
        integer(page, "Tab Size", "Tamanho do tab.", s.editorTabSize, 1, 12, v -> s.editorTabSize = v);
        bool(page, "Word Wrap", "Quebra linhas longas.", s.editorWordWrap, v -> s.editorWordWrap = v);
        bool(page, "Line Numbers", "Mostra números de linha.", s.editorLineNumbers, v -> s.editorLineNumbers = v);
        bool(page, "Auto Save", "Salva automaticamente.", s.editorAutoSave, v -> s.editorAutoSave = v);
        bool(page, "Format On Save", "Formata ao salvar.", s.editorFormatOnSave, v -> s.editorFormatOnSave = v);
    }

    private void renderTerminal(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Terminal"));

        bool(page, "Terminal Enabled", "Ativa terminal integrado.", s.terminalEnabled, v -> s.terminalEnabled = v);
        text(page, "Linux Shell", "Shell padrão no Linux.", s.terminalShellLinux, v -> s.terminalShellLinux = v);
        text(page, "Windows Shell", "Shell padrão no Windows.", s.terminalShellWindows, v -> s.terminalShellWindows = v);
        text(page, "Initial Directory", "Diretório inicial do terminal.", s.terminalInitialDirectory, v -> s.terminalInitialDirectory = v);
    }

    private void renderDiagnostics(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Diagnostics"));

        bool(page, "Diagnostics Enabled", "Ativa sistema de diagnósticos.", s.diagnosticsEnabled, v -> s.diagnosticsEnabled = v);
        bool(page, "ErrorLens Enabled", "Mostra erros inline no editor.", s.errorLensEnabled, v -> s.errorLensEnabled = v);
        bool(page, "Compile On Save", "Compila ao salvar.", s.compileOnSave, v -> s.compileOnSave = v);
        bool(page, "Problems Auto Open", "Abre Problems quando build falhar.", s.problemsAutoOpen, v -> s.problemsAutoOpen = v);
    }

    private void renderBuild(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Build"));

        text(page, "Build Command", "Comando usado para build.", s.buildCommand, v -> s.buildCommand = v);
        bool(page, "Skip Tests", "Pula testes no build.", s.buildSkipTests, v -> s.buildSkipTests = v);
    }

    private void renderWorkbench(VBox page, AppSettings s) {
        page.getChildren().clear();
        page.getChildren().add(title("Workbench"));

        bool(page, "Status Bar Visible", "Mostra barra inferior.", s.statusBarVisible, v -> s.statusBarVisible = v);
        bool(page, "Activity Bar Visible", "Mostra barra lateral de atividades.", s.activityBarVisible, v -> s.activityBarVisible = v);
        bool(page, "Side Bar Visible", "Mostra painel lateral.", s.sideBarVisible, v -> s.sideBarVisible = v);
    }

    private Label title(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("settings-page-title");
        return label;
    }

    private void bool(VBox page, String name, String description, boolean value, java.util.function.Consumer<Boolean> setter) {
        CheckBox control = new CheckBox();
        control.setSelected(value);
        control.selectedProperty().addListener((obs, old, val) -> setter.accept(val));
        page.getChildren().add(row(name, description, control));
    }

    private void text(VBox page, String name, String description, String value, java.util.function.Consumer<String> setter) {
        TextField control = new TextField(value == null ? "" : value);
        control.textProperty().addListener((obs, old, val) -> setter.accept(val));
        page.getChildren().add(row(name, description, control));
    }

    private void integer(VBox page, String name, String description, int value, int min, int max, java.util.function.Consumer<Integer> setter) {
        Spinner<Integer> control = new Spinner<>(min, max, value);
        control.valueProperty().addListener((obs, old, val) -> setter.accept(val));
        page.getChildren().add(row(name, description, control));
    }

    private void decimal(VBox page, String name, String description, double value, double min, double max, java.util.function.Consumer<Double> setter) {
        Spinner<Double> control = new Spinner<>(min, max, value, 0.05);
        control.valueProperty().addListener((obs, old, val) -> setter.accept(val));
        page.getChildren().add(row(name, description, control));
    }

    private void choice(VBox page, String name, String description, String value, String[] options, java.util.function.Consumer<String> setter) {
        ComboBox<String> control = new ComboBox<>();
        control.getItems().addAll(options);
        control.setValue(value);
        control.valueProperty().addListener((obs, old, val) -> setter.accept(val));
        page.getChildren().add(row(name, description, control));
    }

    private Node row(String name, String description, Node control) {
        VBox labels = new VBox(3);

        Label title = new Label(name);
        title.getStyleClass().add("settings-row-title");

        Label desc = new Label(description);
        desc.setWrapText(true);
        desc.getStyleClass().add("settings-row-description");

        labels.getChildren().addAll(title, desc);

        BorderPane row = new BorderPane();
        row.setLeft(labels);
        row.setRight(control);
        row.setPadding(new Insets(10, 0, 12, 0));
        row.getStyleClass().add("settings-row");

        BorderPane.setAlignment(control, Pos.CENTER_RIGHT);
        return row;
    }

    private AppSettings copy(AppSettings s) {
        AppSettings c = new AppSettings();

        c.theme = s.theme;
        c.iconTheme = s.iconTheme;
        c.iconColor = s.iconColor;
        c.wallpaperPath = s.wallpaperPath;
        c.wallpaperOpacity = s.wallpaperOpacity;

        c.editorFontFamily = s.editorFontFamily;
        c.editorFontSize = s.editorFontSize;
        c.editorTabSize = s.editorTabSize;
        c.editorWordWrap = s.editorWordWrap;
        c.editorLineNumbers = s.editorLineNumbers;
        c.editorAutoSave = s.editorAutoSave;
        c.editorFormatOnSave = s.editorFormatOnSave;

        c.terminalEnabled = s.terminalEnabled;
        c.terminalShellLinux = s.terminalShellLinux;
        c.terminalShellWindows = s.terminalShellWindows;
        c.terminalInitialDirectory = s.terminalInitialDirectory;

        c.diagnosticsEnabled = s.diagnosticsEnabled;
        c.errorLensEnabled = s.errorLensEnabled;
        c.compileOnSave = s.compileOnSave;
        c.problemsAutoOpen = s.problemsAutoOpen;

        c.buildCommand = s.buildCommand;
        c.buildSkipTests = s.buildSkipTests;

        c.statusBarVisible = s.statusBarVisible;
        c.activityBarVisible = s.activityBarVisible;
        c.sideBarVisible = s.sideBarVisible;

        return c;
    }
}