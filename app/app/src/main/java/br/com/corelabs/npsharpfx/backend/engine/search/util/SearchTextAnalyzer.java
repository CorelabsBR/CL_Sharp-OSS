package br.com.corelabs.npsharpfx.backend.engine.search.util;

public class SearchTextAnalyzer {

    public int getLineNumber(String text, int offset) {
        int line = 1;
        int max = Math.min(offset, text.length());

        for (int i = 0; i < max; i++) {
            if (text.charAt(i) == '\n') {
                line++;
            }
        }

        return line;
    }

    public int getColumnNumber(String text, int offset) {
        int max = Math.min(offset, text.length());
        int lastBreak = -1;

        for (int i = 0; i < max; i++) {
            if (text.charAt(i) == '\n') {
                lastBreak = i;
            }
        }

        return max - lastBreak;
    }

    public String extractPreview(String text, int start, int end) {
        int previewStart = Math.max(0, start - 35);
        int previewEnd = Math.min(text.length(), end + 60);

        return text.substring(previewStart, previewEnd)
                .replace("\r", " ")
                .replace("\n", " ")
                .strip();
    }
}
