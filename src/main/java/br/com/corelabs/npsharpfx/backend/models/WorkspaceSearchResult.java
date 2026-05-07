package br.com.corelabs.npsharpfx.backend.models;

import java.nio.file.Path;

public class WorkspaceSearchResult {

    private final Path file;
    private final int line;
    private final int column;
    private final String preview;
    private final int startOffset;
    private final int endOffset;

    public WorkspaceSearchResult(
            Path file,
            int line,
            int column,
            String preview,
            int startOffset,
            int endOffset
    ) {
        this.file = file;
        this.line = line;
        this.column = column;
        this.preview = preview;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
    }

    public Path getFile() {
        return file;
    }

    public int getLine() {
        return line;
    }

    public int getColumn() {
        return column;
    }

    public String getPreview() {
        return preview;
    }

    public int getStartOffset() {
        return startOffset;
    }

    public int getEndOffset() {
        return endOffset;
    }

    @Override
    public String toString() {
        String fileName = file != null ? file.getFileName().toString() : "unknown";
        return fileName + "  Ln " + line + ", Col " + column + "  " + preview;
    }
}
