package br.com.corelabs.npsharpfx.backend.models;

public class WorkspaceSearchQuery {

    private final String text;
    private final boolean caseSensitive;
    private final boolean wholeWord;

    public WorkspaceSearchQuery(String text, boolean caseSensitive, boolean wholeWord) {
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
