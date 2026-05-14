package br.com.corelabs.npsharpfx.frontend.ui.search;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Function;

import br.com.corelabs.npsharpfx.backend.engine.search.WorkspaceSearchService;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchQuery;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchResult;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

public class SearchPane {

    private static final int MIN_SEARCH_LENGTH = 2;
    private static final int SEARCH_DELAY_MS = 450;

    private final Function<SearchQuery, List<SearchResult>> searchProvider;
    private final Consumer<SearchResult> resultOpener;

    private final VBox view;
    private final TextField queryField;
    private final CheckBox caseSensitiveCheck;
    private final CheckBox wholeWordCheck;
    private final Label resultSummary;
    private final ListView<SearchResult> resultList;
    private final WorkspaceSearchService workspaceSearchService;
    private final AtomicLong searchVersion = new AtomicLong(0);

    private File currentWorkspaceRoot;

    public SearchPane(
            Function<SearchQuery, List<SearchResult>> searchProvider,
            Consumer<SearchResult> resultOpener
    ) {
        this.searchProvider = searchProvider;
        this.resultOpener = resultOpener;
        this.workspaceSearchService = new WorkspaceSearchService();

        System.out.println("SEARCH PANE CREATED");

        queryField = new TextField();
        queryField.setPromptText("Search");
        queryField.getStyleClass().add("search-input");

        caseSensitiveCheck = new CheckBox("Match Case");
        caseSensitiveCheck.getStyleClass().add("search-check");

        wholeWordCheck = new CheckBox("Whole Word");
        wholeWordCheck.getStyleClass().add("search-check");

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

                String displayName = new File(item.getFileName()).getName();

                Label title = new Label(
                        displayName
                                + "  Ln "
                                + item.getLine()
                                + ", Col "
                                + item.getColumn()
                );
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
                openSelectedResult();
            }
        });

        resultList.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                openSelectedResult();
            }
        });

        PauseTransition debounce = new PauseTransition(Duration.millis(SEARCH_DELAY_MS));

        queryField.textProperty().addListener((obs, oldValue, newValue) -> {
            debounce.stop();

            if (newValue == null || newValue.isBlank()) {
                searchVersion.incrementAndGet();
                resultList.setItems(FXCollections.observableArrayList());
                resultSummary.setText("Digite para buscar");
                return;
            }

            if (newValue.trim().length() < MIN_SEARCH_LENGTH) {
                searchVersion.incrementAndGet();
                resultList.setItems(FXCollections.observableArrayList());
                resultSummary.setText("Escreva pelo menos 2 caracteres");
                return;
            }

            resultSummary.setText("Buscando...");

            debounce.setOnFinished(event -> runSearchAsync());
            debounce.playFromStart();
        });

        queryField.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                SearchResult first = resultList.getItems()
                        .stream()
                        .findFirst()
                        .orElse(null);

                if (first != null) {
                    resultOpener.accept(first);
                }
            }
        });

        VBox.setVgrow(resultList, Priority.ALWAYS);

        view = new VBox(
                8,
                queryField,
                caseSensitiveCheck,
                wholeWordCheck,
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
        System.out.println("WORKSPACE SET: " + root);
        this.currentWorkspaceRoot = root;
        runSearchAsync();
    }

    public void runSearch() {
        runSearchAsync();
    }

    private void runSearchAsync() {
        String raw = queryField.getText();

        if (raw == null || raw.isBlank()) {
            searchVersion.incrementAndGet();
            resultList.setItems(FXCollections.observableArrayList());
            resultSummary.setText("Digite para buscar");
            return;
        }

        raw = raw.trim();

        if (raw.length() < MIN_SEARCH_LENGTH) {
            searchVersion.incrementAndGet();
            resultList.setItems(FXCollections.observableArrayList());
            resultSummary.setText("Escreva pelo menos 2 caracteres");
            return;
        }

        SearchQuery query = new SearchQuery(
                raw,
                caseSensitiveCheck.isSelected(),
                wholeWordCheck.isSelected()
        );

        File workspaceRootSnapshot = currentWorkspaceRoot;
        long version = searchVersion.incrementAndGet();

        resultSummary.setText("Buscando...");

new Thread(() -> {
    List<SearchResult> finalResults = doSearch(query, workspaceRootSnapshot);

    Platform.runLater(() -> {
        if (version != searchVersion.get()) {
            return;
        }

        resultList.setItems(FXCollections.observableArrayList(finalResults));
        resultSummary.setText(finalResults.size() + " result(s)");
    });
}, "npsharp-search-thread").start();
    }

    private List<SearchResult> doSearch(SearchQuery query, File workspaceRootSnapshot) {
        List<SearchResult> finalResults = new ArrayList<>();

        try {
            List<SearchResult> openFileResults = searchProvider.apply(query);
            finalResults.addAll(openFileResults);
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (workspaceRootSnapshot != null
                && workspaceRootSnapshot.exists()
                && workspaceRootSnapshot.isDirectory()) {

            try {
                List<WorkspaceSearchResult> workspaceResults =
                        workspaceSearchService.search(
                                workspaceRootSnapshot.toPath(),
                                new WorkspaceSearchQuery(
                                        query.getText(),
                                        query.isCaseSensitive(),
                                        query.isWholeWord()
                                )
                        );

                List<SearchResult> mapped = workspaceResults.stream()
                        .map(wr -> new SearchResult(
                                null,
                                wr.getFile().toAbsolutePath().toString(),
                                wr.getLine(),
                                wr.getColumn(),
                                wr.getPreview(),
                                wr.getStartOffset(),
                                wr.getEndOffset()
                        ))
                        .toList();

                finalResults.addAll(mapped);

            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        finalResults.sort((a, b) -> {
            boolean aOpen = a.getTab() != null;
            boolean bOpen = b.getTab() != null;

            if (aOpen && !bOpen) {
                return -1;
            }

            if (!aOpen && bOpen) {
                return 1;
            }

            return 0;
        });

        return finalResults;
    }

    private void openSelectedResult() {
        SearchResult selected = resultList.getSelectionModel().getSelectedItem();

        if (selected != null) {
            resultOpener.accept(selected);
        }
    }

    public static class SearchQuery {

        private final String text;
        private final boolean caseSensitive;
        private final boolean wholeWord;

        public SearchQuery(
                String text,
                boolean caseSensitive,
                boolean wholeWord
        ) {
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