package br.com.corelabs.npsharpfx.frontend.ui.search;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Comparator;
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
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

public class SearchPane {

    private static final int MIN_SEARCH_LENGTH = 1;
    private static final int SEARCH_DELAY_MS = 300;

    private final Function<SearchQuery, List<SearchResult>> searchProvider;
    private final Consumer<SearchResult> resultOpener;
    private final WorkspaceSearchService workspaceSearchService = new WorkspaceSearchService();
    private final AtomicLong searchVersion = new AtomicLong(0);

    private final VBox view;
    private final TextField queryField;
    private final TextField replaceField;
    private final CheckBox caseSensitiveCheck;
    private final CheckBox wholeWordCheck;
    private final Label resultSummary;
    private final ListView<SearchResult> resultList;

    private File currentWorkspaceRoot;

    public SearchPane(
            Function<SearchQuery, List<SearchResult>> searchProvider,
            Consumer<SearchResult> resultOpener) {

        this.searchProvider = searchProvider;
        this.resultOpener = resultOpener;

        queryField = new TextField();
        queryField.setPromptText("Search");
        queryField.getStyleClass().add("search-input");

        replaceField = new TextField();
        replaceField.setPromptText("Replace");
        replaceField.getStyleClass().add("search-input");

        caseSensitiveCheck = new CheckBox("Match Case");
        caseSensitiveCheck.getStyleClass().add("search-check");

        wholeWordCheck = new CheckBox("Whole Word");
        wholeWordCheck.getStyleClass().add("search-check");

        Button replaceAllButton = new Button("Replace All");
        replaceAllButton.getStyleClass().add("search-action-button");
        replaceAllButton.setMaxWidth(Double.MAX_VALUE);
        replaceAllButton.setOnAction(e -> replaceAllOccurrences());

        resultSummary = new Label("Type to search");
        resultSummary.getStyleClass().add("search-summary");

        resultList = new ListView<>();
        resultList.getStyleClass().add("search-result-list");
        resultList.setCellFactory(list -> new SearchResultCell());
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
        VBox.setVgrow(resultList, Priority.ALWAYS);

        PauseTransition debounce = new PauseTransition(Duration.millis(SEARCH_DELAY_MS));
        queryField.textProperty().addListener((obs, oldValue, newValue) -> {
            debounce.stop();
            if (clearIfQueryIsEmpty(newValue)) {
                return;
            }
            resultSummary.setText("Searching...");
            debounce.setOnFinished(event -> runSearchAsync());
            debounce.playFromStart();
        });
        queryField.setOnKeyPressed(e -> {
            if (e.getCode() == KeyCode.ENTER) {
                openFirstResult();
            }
        });
        caseSensitiveCheck.selectedProperty().addListener((obs, oldValue, newValue) -> runSearchAsync());
        wholeWordCheck.selectedProperty().addListener((obs, oldValue, newValue) -> runSearchAsync());

        HBox options = new HBox(10, caseSensitiveCheck, wholeWordCheck);
        options.setAlignment(Pos.CENTER_LEFT);

        view = new VBox(
                8,
                queryField,
                replaceField,
                replaceAllButton,
                options,
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
        runSearchAsync();
    }

    public void runSearch() {
        runSearchAsync();
    }

    private void runSearchAsync() {
        String raw = normalizedQuery();
        if (clearIfQueryIsEmpty(raw)) {
            return;
        }

        SearchQuery query = new SearchQuery(
                raw,
                caseSensitiveCheck.isSelected(),
                wholeWordCheck.isSelected()
        );

        File workspaceSnapshot = currentWorkspaceRoot;
        long version = searchVersion.incrementAndGet();
        resultSummary.setText("Searching...");

        Thread searchThread = new Thread(() -> {
            List<SearchResult> results = doSearch(query, workspaceSnapshot);

            Platform.runLater(() -> {
                if (version != searchVersion.get()) {
                    return;
                }

                resultList.setItems(FXCollections.observableArrayList(results));
                resultSummary.setText(formatSummary(results.size(), workspaceSnapshot));
                if (!results.isEmpty()) {
                    resultList.getSelectionModel().select(0);
                }
            });
        }, "npsharp-search-thread");
        searchThread.setDaemon(true);
        searchThread.start();
    }

    private List<SearchResult> doSearch(SearchQuery query, File workspaceRootSnapshot) {
        List<SearchResult> results = new ArrayList<>();

        try {
            results.addAll(searchProvider.apply(query));
        } catch (Exception ignored) {
        }

        if (workspaceRootSnapshot != null
                && workspaceRootSnapshot.exists()
                && workspaceRootSnapshot.isDirectory()) {
            try {
                List<WorkspaceSearchResult> workspaceResults = workspaceSearchService.search(
                        workspaceRootSnapshot.toPath(),
                        new WorkspaceSearchQuery(
                                query.getText(),
                                query.isCaseSensitive(),
                                query.isWholeWord()
                        )
                );

                workspaceResults.stream()
                        .map(this::mapWorkspaceResult)
                        .forEach(results::add);
            } catch (Exception ignored) {
            }
        }

        results.sort(Comparator
                .comparing((SearchResult result) -> result.getTab() == null)
                .thenComparing(SearchResult::getFileName, Comparator.nullsLast(String::compareToIgnoreCase))
                .thenComparingInt(SearchResult::getLine)
                .thenComparingInt(SearchResult::getColumn));

        return results;
    }

    private SearchResult mapWorkspaceResult(WorkspaceSearchResult result) {
        return new SearchResult(
                null,
                result.getFile().toAbsolutePath().toString(),
                result.getLine(),
                result.getColumn(),
                result.getPreview(),
                result.getStartOffset(),
                result.getEndOffset()
        );
    }

    private void openSelectedResult() {
        SearchResult selected = resultList.getSelectionModel().getSelectedItem();
        if (selected != null) {
            resultOpener.accept(selected);
        }
    }

    private void openFirstResult() {
        SearchResult first = resultList.getItems().stream().findFirst().orElse(null);
        if (first != null) {
            resultOpener.accept(first);
        }
    }

    private void replaceAllOccurrences() {
        String search = normalizedQuery();
        if (search.isBlank()) {
            resultSummary.setText("Nothing to replace");
            return;
        }

        if (currentWorkspaceRoot == null || !currentWorkspaceRoot.isDirectory()) {
            resultSummary.setText("Open a folder to replace across files");
            return;
        }

        try {
            int replaced = workspaceSearchService.replaceAll(
                    currentWorkspaceRoot.toPath(),
                    search,
                    replaceField.getText(),
                    caseSensitiveCheck.isSelected(),
                    wholeWordCheck.isSelected()
            );
            resultSummary.setText(replaced + " occurrence(s) replaced");
            runSearchAsync();
        } catch (Exception e) {
            resultSummary.setText("Replace failed: " + firstLine(e.getMessage()));
        }
    }

    private void replaceSingleOccurrence(SearchResult result) {
        String search = normalizedQuery();
        if (result == null || search.isBlank()) {
            resultSummary.setText("Nothing to replace");
            return;
        }

        try {
            File file = new File(result.getFileName());
            if (!file.isFile()) {
                resultSummary.setText("File not found");
                return;
            }

            String content = Files.readString(file.toPath());
            int start = result.getStartOffset();
            int end = result.getEndOffset();

            if (start < 0 || end <= start || end > content.length()) {
                resultSummary.setText("Invalid result position");
                return;
            }

            String replacement = replaceField.getText() == null ? "" : replaceField.getText();
            String newContent = content.substring(0, start) + replacement + content.substring(end);
            Files.writeString(file.toPath(), newContent);

            resultSummary.setText("1 occurrence replaced");
            runSearchAsync();
        } catch (Exception e) {
            resultSummary.setText("Replace failed: " + firstLine(e.getMessage()));
        }
    }

    private boolean clearIfQueryIsEmpty(String value) {
        if (value == null || value.trim().length() < MIN_SEARCH_LENGTH) {
            searchVersion.incrementAndGet();
            resultList.setItems(FXCollections.observableArrayList());
            resultSummary.setText("Type to search");
            return true;
        }
        return false;
    }

    private String normalizedQuery() {
        String text = queryField.getText();
        return text == null ? "" : text.trim();
    }

    private String formatSummary(int count, File workspace) {
        String scope = workspace == null ? "open editors" : workspace.getName();
        return count + " result(s) in " + scope;
    }

    private String firstLine(String text) {
        if (text == null || text.isBlank()) {
            return "unknown error";
        }
        return text.lines().findFirst().orElse(text);
    }

    private final class SearchResultCell extends ListCell<SearchResult> {
        @Override
        protected void updateItem(SearchResult item, boolean empty) {
            super.updateItem(item, empty);

            if (empty || item == null) {
                setText(null);
                setGraphic(null);
                return;
            }

            Label title = new Label(resultTitle(item));
            title.getStyleClass().add("search-result-title");

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);

            Button replaceButton = new Button("Replace");
            replaceButton.getStyleClass().add("search-action-small");
            replaceButton.setOnAction(event -> {
                event.consume();
                replaceSingleOccurrence(item);
            });

            HBox titleRow = new HBox(8, title, spacer, replaceButton);
            titleRow.setAlignment(Pos.CENTER_LEFT);

            Label preview = new Label(item.getPreview() == null ? "" : item.getPreview());
            preview.getStyleClass().add("search-result-preview");
            preview.setWrapText(true);

            VBox box = new VBox(3, titleRow, preview);
            box.setAlignment(Pos.CENTER_LEFT);
            box.getStyleClass().add("search-result-item");

            setGraphic(box);
        }

        private String resultTitle(SearchResult item) {
            String displayName = item.getFileName() == null
                    ? "Untitled"
                    : new File(item.getFileName()).getName();
            return displayName + "  Ln " + item.getLine() + ", Col " + item.getColumn();
        }
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
