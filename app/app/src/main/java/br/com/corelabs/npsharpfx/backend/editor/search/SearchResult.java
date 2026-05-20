package br.com.corelabs.npsharpfx.backend.editor.search;

import java.util.Collections;
import java.util.List;

public final class SearchResult {
    private final String query;
    private final List<SearchMatch> matches;
    private final int selectedIndex;
    private final String error;

    public SearchResult(String query, List<SearchMatch> matches, int selectedIndex, String error) {
        this.query = query == null ? "" : query;
        this.matches = Collections.unmodifiableList(matches);
        this.selectedIndex = selectedIndex;
        this.error = error;
    }

    public String getQuery() {
        return query;
    }

    public List<SearchMatch> getMatches() {
        return matches;
    }

    public int getSelectedIndex() {
        return selectedIndex;
    }

    public String getError() {
        return error;
    }

    public boolean hasError() {
        return error != null && !error.isBlank();
    }
}
