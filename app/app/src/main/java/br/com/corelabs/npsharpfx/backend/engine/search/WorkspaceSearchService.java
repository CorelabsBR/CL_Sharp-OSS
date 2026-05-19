package br.com.corelabs.npsharpfx.backend.engine.search;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import br.com.corelabs.npsharpfx.backend.engine.search.util.SearchTextAnalyzer;
import br.com.corelabs.npsharpfx.backend.engine.search.util.SearchableFileFilter;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchQuery;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchResult;

public class WorkspaceSearchService {

    /*
    ========================================
    CONFIG
    ========================================
    */

    private static final long MAX_FILE_SIZE_BYTES =
            5 * 1024 * 1024;

    private static final int MAX_RESULTS =
            5000;

    /*
    ========================================
    FILTERS
    ========================================
    */

    private final SearchableFileFilter fileFilter;

    private final SearchTextAnalyzer textAnalyzer;

    public WorkspaceSearchService() {

        this.fileFilter = new SearchableFileFilter();

        this.textAnalyzer = new SearchTextAnalyzer();
    }

    /*
    ========================================
    MAIN SEARCH
    ========================================
    */

    public List<WorkspaceSearchResult> search(
            Path workspaceRoot,
            WorkspaceSearchQuery query
    ) {

        if (workspaceRoot == null
                || query == null
                || query.getText() == null
                || query.getText().isBlank()) {

            return Collections.emptyList();
        }

        if (!Files.exists(workspaceRoot)
                || !Files.isDirectory(workspaceRoot)) {

            return Collections.emptyList();
        }

        ConcurrentLinkedQueue<WorkspaceSearchResult> results =
                new ConcurrentLinkedQueue<>();

        try (Stream<Path> stream = Files.walk(workspaceRoot)) {

            stream

                    .parallel()

                    .filter(Files::isRegularFile)

                    .filter(this::isAllowedPath)

                    .filter(fileFilter::isSearchableFile)

                    .filter(this::isTextLikeFile)

                    .forEach(path -> {

                        if (results.size() >= MAX_RESULTS) {
                            return;
                        }

                        searchFile(path, query, results);
                    });

        } catch (IOException e) {

            throw new IllegalStateException(
                    "Erro ao pesquisar workspace",
                    e
            );
        }

        List<WorkspaceSearchResult> sorted =
                new ArrayList<>(results);

        /*
        ========================================
        SORT:
        MELHORES RESULTADOS PRIMEIRO
        ========================================
        */

        sorted.sort(Comparator

                .comparingInt(
                        (WorkspaceSearchResult r) ->
                                scoreResult(r, query)
                )

                .reversed()
        );

        return sorted;
    }

    /*
    ========================================
    FILE SEARCH
    ========================================
    */

public int replaceAll(
        java.nio.file.Path workspace,
        String search,
        String replace,
        boolean caseSensitive,
        boolean wholeWord
) throws java.io.IOException {

    if (workspace == null || search == null || search.isBlank()) {
        return 0;
    }

    if (replace == null) {
        replace = "";
    }

    final String finalReplace = replace;
    final int[] replacedCount = {0};

    try (java.util.stream.Stream<java.nio.file.Path> paths = java.nio.file.Files.walk(workspace)) {
        paths.filter(java.nio.file.Files::isRegularFile)
                .filter(path -> {
                    String name = path.getFileName().toString().toLowerCase();

                    return name.endsWith(".java")
                            || name.endsWith(".txt")
                            || name.endsWith(".xml")
                            || name.endsWith(".json")
                            || name.endsWith(".css")
                            || name.endsWith(".html")
                            || name.endsWith(".js")
                            || name.endsWith(".ts")
                            || name.endsWith(".md")
                            || name.endsWith(".gol")
                            || name.endsWith(".por")
                            || name.endsWith(".portugol");
                })
                .forEach(path -> {
                    try {
                        String content = new String(
                                java.nio.file.Files.readAllBytes(path),
                                java.nio.charset.StandardCharsets.UTF_8
                        );
                        String newContent;

                        if (wholeWord) {
                            String flags = caseSensitive ? "" : "(?i)";
                            String regex = flags + "\\b" + java.util.regex.Pattern.quote(search) + "\\b";

                            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(regex);
                            java.util.regex.Matcher matcher = pattern.matcher(content);

                            int count = 0;
                            while (matcher.find()) {
                                count++;
                            }

                            newContent = matcher.replaceAll(
                                    java.util.regex.Matcher.quoteReplacement(finalReplace)
                            );

                            replacedCount[0] += count;
                        } else if (caseSensitive) {
                            int count = countOccurrences(content, search);
                            newContent = content.replace(search, finalReplace);
                            replacedCount[0] += count;
                        } else {
                            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                                    java.util.regex.Pattern.quote(search),
                                    java.util.regex.Pattern.CASE_INSENSITIVE
                            );

                            java.util.regex.Matcher matcher = pattern.matcher(content);

                            int count = 0;
                            while (matcher.find()) {
                                count++;
                            }

                            newContent = matcher.replaceAll(
                                    java.util.regex.Matcher.quoteReplacement(finalReplace)
                            );

                            replacedCount[0] += count;
                        }

                        if (!content.equals(newContent)) {
                            java.nio.file.Files.write(
                                    path,
                                    newContent.getBytes(java.nio.charset.StandardCharsets.UTF_8)
                            );
                        }

                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
    }

    return replacedCount[0];
}

private static int countOccurrences(String text, String search) {
    int count = 0;
    int index = 0;

    while ((index = text.indexOf(search, index)) != -1) {
        count++;
        index += search.length();
    }

    return count;
}

    private void searchFile(
            Path file,
            WorkspaceSearchQuery query,
            ConcurrentLinkedQueue<WorkspaceSearchResult> results
    ) {

        try {

            long size = Files.size(file);

            if (size > MAX_FILE_SIZE_BYTES) {
                return;
            }

            String text = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);

            /*
            ========================================
            BINÁRIO
            ========================================
            */

            if (text.indexOf('\0') >= 0) {
                return;
            }

            if (text.isBlank()) {
                return;
            }

            String needle = query.getText();

            if (query.isWholeWord()) {

                searchWholeWord(
                        text,
                        needle,
                        file,
                        query.isCaseSensitive(),
                        results
                );

                return;
            }

            searchNormal(
                    text,
                    needle,
                    file,
                    query.isCaseSensitive(),
                    results
            );

        } catch (Exception ignored) {

            /*
            ========================================
            IGNORA:
            - encoding zoado
            - permission denied
            - binário
            - lock
            ========================================
            */
        }
    }

    /*
    ========================================
    WHOLE WORD SEARCH
    ========================================
    */

    private void searchWholeWord(
            String text,
            String needle,
            Path file,
            boolean caseSensitive,
            ConcurrentLinkedQueue<WorkspaceSearchResult> results
    ) {

        String flags =
                caseSensitive
                        ? ""
                        : "(?i)";

        Pattern pattern =
                Pattern.compile(
                        flags
                                + "\\b"
                                + Pattern.quote(needle)
                                + "\\b"
                );

        Matcher matcher =
                pattern.matcher(text);

        while (matcher.find()) {

            int start = matcher.start();

            int end = matcher.end();

            results.add(buildResult(
                    file,
                    text,
                    start,
                    end
            ));
        }
    }

    /*
    ========================================
    NORMAL SEARCH
    ========================================
    */

    private void searchNormal(
            String text,
            String needle,
            Path file,
            boolean caseSensitive,
            ConcurrentLinkedQueue<WorkspaceSearchResult> results
    ) {

        String haystack =
                caseSensitive
                        ? text
                        : text.toLowerCase(Locale.ROOT);

        String normalizedNeedle =
                caseSensitive
                        ? needle
                        : needle.toLowerCase(Locale.ROOT);

        int from = 0;

        while (true) {

            int index =
                    haystack.indexOf(
                            normalizedNeedle,
                            from
                    );

            if (index < 0) {
                break;
            }

            int end =
                    index + needle.length();

            results.add(buildResult(
                    file,
                    text,
                    index,
                    end
            ));

            /*
            ========================================
            EVITA LOOP
            ========================================
            */

            from = Math.max(
                    end,
                    from + 1
            );
        }
    }

    /*
    ========================================
    RESULT BUILDER
    ========================================
    */

    private WorkspaceSearchResult buildResult(
            Path file,
            String text,
            int start,
            int end
    ) {

        return new WorkspaceSearchResult(

                file,

                textAnalyzer.getLineNumber(
                        text,
                        start
                ),

                textAnalyzer.getColumnNumber(
                        text,
                        start
                ),

                textAnalyzer.extractPreview(
                        text,
                        start,
                        end
                ),

                start,

                end
        );
    }

    /*
    ========================================
    PATH FILTER
    ========================================
    */

    private boolean isAllowedPath(Path path) {

        String normalized =
                path.toString()
                        .replace("\\", "/")
                        .toLowerCase();

        return !normalized.contains("/.git/")
                && !normalized.contains("/node_modules/")
                && !normalized.contains("/target/")
                && !normalized.contains("/build/")
                && !normalized.contains("/dist/")
                && !normalized.contains("/out/")
                && !normalized.contains("/bin/")
                && !normalized.contains("/.idea/")
                && !normalized.contains("/.gradle/")
                && !normalized.contains("/.settings/")
                && !normalized.contains("/vendor/")
                && !normalized.contains("/coverage/");
    }

    /*
    ========================================
    TEXT FILE FILTER
    ========================================
    */

    private boolean isTextLikeFile(Path path) {

        String name =
                path.getFileName()
                        .toString()
                        .toLowerCase();

        return !name.endsWith(".png")
                && !name.endsWith(".jpg")
                && !name.endsWith(".jpeg")
                && !name.endsWith(".gif")
                && !name.endsWith(".webp")
                && !name.endsWith(".mp4")
                && !name.endsWith(".mp3")
                && !name.endsWith(".wav")
                && !name.endsWith(".ogg")
                && !name.endsWith(".jar")
                && !name.endsWith(".class")
                && !name.endsWith(".dll")
                && !name.endsWith(".so")
                && !name.endsWith(".exe")
                && !name.endsWith(".zip")
                && !name.endsWith(".7z")
                && !name.endsWith(".rar")
                && !name.endsWith(".pdf")
                && !name.endsWith(".ttf")
                && !name.endsWith(".woff")
                && !name.endsWith(".woff2");
    }

    /*
    ========================================
    RESULT SCORE
    ========================================
    */

    private int scoreResult(
            WorkspaceSearchResult result,
            WorkspaceSearchQuery query
    ) {

        int score = 0;

        String preview =
                result.getPreview()
                        .toLowerCase();

        String needle =
                query.getText()
                        .toLowerCase();

        if (preview.startsWith(needle)) {
            score += 100;
        }

        if (preview.contains(needle)) {
            score += 50;
        }

        String fileName =
                result.getFile()
                        .getFileName()
                        .toString()
                        .toLowerCase();

        if (fileName.contains(needle)) {
            score += 200;
        }

        if (fileName.equals(needle)) {
            score += 500;
        }

        return score;
    }
}
