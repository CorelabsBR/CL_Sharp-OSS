/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.search;

import javafx.scene.control.Tab;

public class SearchResult {

    private final Tab tab;
    private final String fileName;
    private final int line;
    private final int column;
    private final String preview;
    private final int startOffset;
    private final int endOffset;

    public SearchResult(
            Tab tab,
            String fileName,
            int line,
            int column,
            String preview,
            int startOffset,
            int endOffset
    ) {
        this.tab = tab;
        this.fileName = fileName;
        this.line = line;
        this.column = column;
        this.preview = preview;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
    }

    public Tab getTab() {
        return tab;
    }

    public String getFileName() {
        return fileName;
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
        return fileName + "  Ln " + line + ", Col " + column + "  " + preview;
    }
}
