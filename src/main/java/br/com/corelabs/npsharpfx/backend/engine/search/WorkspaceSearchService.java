package br.com.corelabs.npsharpfx.backend.engine.search;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import br.com.corelabs.npsharpfx.backend.engine.search.util.SearchTextAnalyzer;
import br.com.corelabs.npsharpfx.backend.engine.search.util.SearchableFileFilter;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchQuery;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchResult;

public class WorkspaceSearchService {

    private static final long MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

    private final SearchableFileFilter fileFilter;
    private final SearchTextAnalyzer textAnalyzer;

    public WorkspaceSearchService() {
        this.fileFilter = new SearchableFileFilter();
        this.textAnalyzer = new SearchTextAnalyzer();
    }

    public List<WorkspaceSearchResult> search(Path workspaceRoot, WorkspaceSearchQuery query) {
        if (workspaceRoot == null || query == null || query.getText() == null || query.getText().isBlank()) {
            return Collections.emptyList();
        }

        if (!Files.exists(workspaceRoot) || !Files.isDirectory(workspaceRoot)) {
            return Collections.emptyList();
        }

        List<WorkspaceSearchResult> results = new ArrayList<>();

        try (Stream<Path> stream = Files.walk(workspaceRoot)) {
            stream.filter(Files::isRegularFile)
                    .filter(fileFilter::isSearchableFile)
                    .forEach(path -> searchFile(path, query, results));
        } catch (IOException e) {
            throw new IllegalStateException("Erro ao pesquisar no workspace", e);
        }

        return results;
    }

    private void searchFile(Path file, WorkspaceSearchQuery query, List<WorkspaceSearchResult> results) {
        try {
            long size = Files.size(file);
            if (size > MAX_FILE_SIZE_BYTES) {
                return;
            }

            String text = Files.readString(file, StandardCharsets.UTF_8);
            if (text.indexOf('\0') >= 0) {
                return;
            }

            String needle = query.getText();

            if (query.isWholeWord()) {
                searchWithWholeWord(text, needle, file, query.isCaseSensitive(), results);
                return;
            }

            searchWithoutWholeWord(text, needle, file, query.isCaseSensitive(), results);

        } catch (IOException ignored) {
            // ignora arquivo ilegível, binário, encoding zoado, etc.
        }
    }

    private void searchWithWholeWord(String text, String needle, Path file, boolean caseSensitive, 
                                     List<WorkspaceSearchResult> results) {
        String flags = caseSensitive ? "" : "(?i)";
        Pattern pattern = Pattern.compile(flags + "\\b" + Pattern.quote(needle) + "\\b");
        Matcher matcher = pattern.matcher(text);

        while (matcher.find()) {
            int start = matcher.start();
            int end = matcher.end();

            results.add(new WorkspaceSearchResult(
                    file,
                    textAnalyzer.getLineNumber(text, start),
                    textAnalyzer.getColumnNumber(text, start),
                    textAnalyzer.extractPreview(text, start, end),
                    start,
                    end
            ));
        }
    }

    private void searchWithoutWholeWord(String text, String needle, Path file, boolean caseSensitive, 
                                        List<WorkspaceSearchResult> results) {
        String haystack = caseSensitive ? text : text.toLowerCase(Locale.ROOT);
        String normalizedNeedle = caseSensitive ? needle : needle.toLowerCase(Locale.ROOT);

        int from = 0;
        while (true) {
            int index = haystack.indexOf(normalizedNeedle, from);
            if (index < 0) {
                break;
            }

            int end = index + needle.length();

            results.add(new WorkspaceSearchResult(
                    file,
                    textAnalyzer.getLineNumber(text, index),
                    textAnalyzer.getColumnNumber(text, index),
                    textAnalyzer.extractPreview(text, index, end),
                    index,
                    end
            ));

            from = end;
        }
    }
}
