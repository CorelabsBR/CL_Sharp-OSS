package br.com.corelabs.npsharpfx.backend.editor.search;

public final class SearchMatch {
    private final int start;
    private final int end;

    public SearchMatch(int start, int end) {
        this.start = start;
        this.end = end;
    }

    public int getStart() {
        return start;
    }

    public int getEnd() {
        return end;
    }
}
