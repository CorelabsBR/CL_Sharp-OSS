package br.com.corelabs.npsharpfx.frontend.ui.search;

import java.io.File;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

import br.com.corelabs.npsharpfx.backend.engine.search.WorkspaceSearchService;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchQuery;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchResult;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public class SearchPane {

    private final Function<SearchQuery, List<SearchResult>> searchProvider;
    private final Consumer<SearchResult> resultOpener;

    private final VBox view;
    private final TextField queryField;
    private final CheckBox caseSensitiveCheck;
    private final CheckBox wholeWordCheck;
    private final Label resultSummary;
    private final ListView<SearchResult> resultList;
    
    private final WorkspaceSearchService workspaceSearchService;
    private File currentWorkspaceRoot;
    private boolean searchInWorkspace = false;
    private final ToggleButton openFilesToggle;
    private final ToggleButton workspaceToggle;

    public SearchPane(
            Function<SearchQuery, List<SearchResult>> searchProvider,
            Consumer<SearchResult> resultOpener
    ) {
        this.searchProvider = searchProvider;
        this.resultOpener = resultOpener;
        this.workspaceSearchService = new WorkspaceSearchService();

        queryField = new TextField();
        queryField.setPromptText("Search");
        queryField.getStyleClass().add("search-input");

        caseSensitiveCheck = new CheckBox("Match Case");
        caseSensitiveCheck.getStyleClass().add("search-check");

        wholeWordCheck = new CheckBox("Whole Word");
        wholeWordCheck.getStyleClass().add("search-check");

        // Toggle buttons para alternar entre abordagens de busca
        ToggleGroup searchScope = new ToggleGroup();
        
        openFilesToggle = new ToggleButton("Open Files");
        openFilesToggle.setToggleGroup(searchScope);
        openFilesToggle.setSelected(true);
        openFilesToggle.getStyleClass().add("search-scope-button");
        openFilesToggle.setOnAction(e -> {
            searchInWorkspace = false;
            runSearch();
        });

        workspaceToggle = new ToggleButton("Workspace");
        workspaceToggle.setToggleGroup(searchScope);
        workspaceToggle.getStyleClass().add("search-scope-button");
        workspaceToggle.setOnAction(e -> {
            searchInWorkspace = true;
            runSearch();
        });

        Button searchButton = new Button("Search");
        searchButton.getStyleClass().add("search-action-button");
        searchButton.setOnAction(e -> runSearch());

        resultSummary = new Label("No results");
        resultSummary.getStyleClass().add("search-summary");

        resultList = new ListView<>();
        resultList.getStyleClass().add("search-result-list");
        resultList.setCellFactory(list -> new ListCell<>() {
            @Override
            protected void updateItem(SearchResult item, boolean empty) {
                super.updateItem(item, empty);

                if (empty || item == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }

                Label title = new Label(item.getFileName() + "  Ln " + item.getLine() + ", Col " + item.getColumn());
                title.getStyleClass().add("search-result-title");

                Label preview = new Label(item.getPreview());
                preview.getStyleClass().add("search-result-preview");
                preview.setWrapText(true);

                VBox box = new VBox(3, title, preview);
                box.setAlignment(Pos.CENTER_LEFT);
                box.getStyleClass().add("search-result-item");

                setGraphic(box);
            }
        });

        resultList.setOnMouseClicked(e -> {
            if (e.getClickCount() >= 2) {
                SearchResult selected = resultList.getSelectionModel().getSelectedItem();
                if (selected != null) {
                    resultOpener.accept(selected);
                }
            }
        });

        resultList.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                SearchResult selected = resultList.getSelectionModel().getSelectedItem();
                if (selected != null) {
                    resultOpener.accept(selected);
                }
            }
        });

        queryField.setOnAction(e -> runSearch());

        VBox.setVgrow(resultList, Priority.ALWAYS);

        // Toolbar com toggle buttons
        HBox scopeToolbar = new HBox(8, openFilesToggle, workspaceToggle);
        scopeToolbar.getStyleClass().add("search-scope-toolbar");
        scopeToolbar.setPadding(new Insets(5, 10, 5, 10));

        view = new VBox(8,
                queryField,
                scopeToolbar,
                caseSensitiveCheck,
                wholeWordCheck,
                searchButton,
                resultSummary,
                resultList
        );
        view.getStyleClass().add("search-pane");
        view.setPadding(new Insets(10));
    }

    public Node getView() {
        return view;
    }

    public void focusSearchField() {
        queryField.requestFocus();
        queryField.selectAll();
    }

    public void setWorkspaceRoot(File root) {
        this.currentWorkspaceRoot = root;
    }

    public void runSearch() {
        String raw = queryField.getText();
        if (raw == null || raw.isBlank()) {
            resultList.setItems(FXCollections.observableArrayList());
            resultSummary.setText("Type something to search");
            return;
        }

        SearchQuery query = new SearchQuery(
                raw,
                caseSensitiveCheck.isSelected(),
                wholeWordCheck.isSelected()
        );

        List<SearchResult> results;
        
        if (searchInWorkspace && currentWorkspaceRoot != null) {
            // Buscar em todo o workspace
            List<WorkspaceSearchResult> workspaceResults = workspaceSearchService.search(
                    currentWorkspaceRoot.toPath(),
                    new WorkspaceSearchQuery(
                            query.getText(),
                            query.isCaseSensitive(),
                            query.isWholeWord()
                    )
            );
            
            results = workspaceResults.stream()
                    .map(wr -> new SearchResult(
                            null,
                            wr.getFile().getFileName().toString(),
                            wr.getLine(),
                            wr.getColumn(),
                            wr.getPreview(),
                            wr.getStartOffset(),
                            wr.getEndOffset()
                    ))
                    .collect(Collectors.toList());
            
            // Desabilitar abra de arquivo para resultados do workspace
            resultList.setOnMouseClicked(e -> {
                if (e.getClickCount() >= 2) {
                    SearchResult selected = resultList.getSelectionModel().getSelectedItem();
                    if (selected != null && selected.getTab() != null) {
                        resultOpener.accept(selected);
                    }
                }
            });
        } else {
            // Buscar nos arquivos abertos
            results = searchProvider.apply(query);
            
            resultList.setOnMouseClicked(e -> {
                if (e.getClickCount() >= 2) {
                    SearchResult selected = resultList.getSelectionModel().getSelectedItem();
                    if (selected != null) {
                        resultOpener.accept(selected);
                    }
                }
            });
        }
        
        resultList.setItems(FXCollections.observableArrayList(results));
        resultSummary.setText(results.size() + " result(s)");
    }

    public static class SearchQuery {
        private final String text;
        private final boolean caseSensitive;
        private final boolean wholeWord;

        public SearchQuery(String text, boolean caseSensitive, boolean wholeWord) {
            this.text = text;
            this.caseSensitive = caseSensitive;
            this.wholeWord = wholeWord;
        }

        public String getText() {
            return text;
        }

        public boolean isCaseSensitive() {
            return caseSensitive;
        }

        public boolean isWholeWord() {
            return wholeWord;
        }
    }
}
