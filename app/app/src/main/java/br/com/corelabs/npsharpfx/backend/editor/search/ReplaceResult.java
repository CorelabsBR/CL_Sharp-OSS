package br.com.corelabs.npsharpfx.backend.editor.search;

public final class ReplaceResult {
    private final String text;
    private final int replacements;
    private final int cursor;
    private final String error;

    public ReplaceResult(String text, int replacements, int cursor, String error) {
        this.text = text == null ? "" : text;
        this.replacements = replacements;
        this.cursor = cursor;
        this.error = error;
    }

    public String getText() {
        return text;
    }

    public int getReplacements() {
        return replacements;
    }

    public int getCursor() {
        return cursor;
    }

    public String getError() {
        return error;
    }
}
