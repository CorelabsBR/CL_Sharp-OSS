package br.com.corelabs.npsharpfx.backend.editor.search;

public final class SearchOptions {
    private final boolean regex;
    private final boolean caseSensitive;
    private final boolean wholeWord;
    private final boolean multiline;

    public SearchOptions(boolean regex, boolean caseSensitive, boolean wholeWord, boolean multiline) {
        this.regex = regex;
        this.caseSensitive = caseSensitive;
        this.wholeWord = wholeWord;
        this.multiline = multiline;
    }

    public boolean isRegex() {
        return regex;
    }

    public boolean isCaseSensitive() {
        return caseSensitive;
    }

    public boolean isWholeWord() {
        return wholeWord;
    }

    public boolean isMultiline() {
        return multiline;
    }

    public static SearchOptions plainIgnoreCase() {
        return new SearchOptions(false, false, false, true);
    }
}
