package br.com.corelabs.npsharpfx.frontend.ui.window.panels;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import br.com.corelabs.npsharpfx.frontend.ui.editor.EditorManager;
import br.com.corelabs.npsharpfx.frontend.ui.search.SearchPane.SearchQuery;
import br.com.corelabs.npsharpfx.frontend.ui.search.SearchResult;
import javafx.scene.control.Tab;

public class SearchHelper {

    public List<SearchResult> searchInOpenTabs(EditorManager editorManager, SearchQuery query) {
        List<SearchResult> results = new ArrayList<>();

        if (editorManager == null || query == null || query.getText() == null || query.getText().isBlank()) {
            return results;
        }

        var tabs = editorManager.getAllTabs();

        for (var tab : tabs) {
            String content = editorManager.getTabContent(tab);
            if (content == null || content.isBlank()) {
                continue;
            }

            String needle = query.getText();
            String haystack = query.isCaseSensitive() ? content : content.toLowerCase(Locale.ROOT);
            String normalizedNeedle = query.isCaseSensitive() ? needle : needle.toLowerCase(Locale.ROOT);

            if (query.isWholeWord()) {
                searchWithWholeWord(content, needle, tab, query.isCaseSensitive(), results);
            } else {
                searchWithoutWholeWord(content, needle, haystack, normalizedNeedle, tab, results);
            }
        }

        return results;
    }

    private void searchWithWholeWord(String content, String needle, Tab tab, boolean caseSensitive, List<SearchResult> results) {
        String flags = caseSensitive ? "" : "(?i)";
        Pattern pattern = Pattern.compile(flags + "\\b" + Pattern.quote(needle) + "\\b");
        Matcher matcher = pattern.matcher(content);

        while (matcher.find()) {
            int start = matcher.start();
            int end = matcher.end();

            String fileName = tab.getText();
            int lineNumber = getLineNumber(content, start);
            int columnNumber = getColumnNumber(content, start);
            String preview = extractPreview(content, start, end);

            results.add(new SearchResult(
                    tab,
                    fileName,
                    lineNumber,
                    columnNumber,
                    preview,
                    start,
                    end
            ));
        }
    }

    private void searchWithoutWholeWord(String content, String needle, String haystack, String normalizedNeedle, Tab tab, List<SearchResult> results) {
        int from = 0;
        while (true) {
            int index = haystack.indexOf(normalizedNeedle, from);
            if (index < 0) {
                break;
            }

            int end = index + needle.length();

            String fileName = tab.getText();
            int lineNumber = getLineNumber(content, index);
            int columnNumber = getColumnNumber(content, index);
            String preview = extractPreview(content, index, end);

            results.add(new SearchResult(
                    tab,
                    fileName,
                    lineNumber,
                    columnNumber,
                    preview,
                    index,
                    end
            ));

            from = end;
        }
    }

    public int getLineNumber(String text, int position) {
        int lineNumber = 1;
        for (int i = 0; i < position && i < text.length(); i++) {
            if (text.charAt(i) == '\n') {
                lineNumber++;
            }
        }
        return lineNumber;
    }

    public int getColumnNumber(String text, int position) {
        int columnNumber = 1;
        for (int i = position - 1; i >= 0; i--) {
            if (text.charAt(i) == '\n') {
                break;
            }
            columnNumber++;
        }
        return columnNumber;
    }

    public String extractPreview(String text, int start, int end) {
        int lineStart = start;
        while (lineStart > 0 && text.charAt(lineStart - 1) != '\n') {
            lineStart--;
        }

        int lineEnd = end;
        while (lineEnd < text.length() && text.charAt(lineEnd) != '\n') {
            lineEnd++;
        }

        String preview = text.substring(lineStart, lineEnd).trim();

        if (preview.length() > 120) {
            preview = preview.substring(0, 117) + "...";
        }

        return preview;
    }
}


