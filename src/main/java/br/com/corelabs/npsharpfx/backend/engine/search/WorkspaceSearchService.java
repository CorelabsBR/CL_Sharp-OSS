/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
        
package br.com.corelabs.npsharpfx.backend.engine.search;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    private static final int MAX_SCANNED_FILES =
            50000;

    private static final List<String> IGNORED_DIRECTORY_NAMES =
            List.of(
                    ".git",
                    ".hg",
                    ".svn",
                    ".idea",
                    ".gradle",
                    ".settings",
                    "node_modules",
                    "target",
                    "build",
                    "dist",
                    "out",
                    "bin",
                    "obj",
                    "vendor",
                    "coverage"
            );

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
        return search(workspaceRoot, query, () -> false);
    }

    public List<WorkspaceSearchResult> search(
            Path workspaceRoot,
            WorkspaceSearchQuery query,
            BooleanSupplier shouldCancel
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
        AtomicInteger resultCount = new AtomicInteger();
        AtomicInteger scannedFiles = new AtomicInteger();

        try {
            Files.walkFileTree(workspaceRoot, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (isCancelled(shouldCancel) || resultCount.get() >= MAX_RESULTS) {
                        return FileVisitResult.TERMINATE;
                    }
                    if (!dir.equals(workspaceRoot) && isIgnoredDirectory(dir)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (isCancelled(shouldCancel) || resultCount.get() >= MAX_RESULTS) {
                        return FileVisitResult.TERMINATE;
                    }
                    if (scannedFiles.incrementAndGet() > MAX_SCANNED_FILES) {
                        return FileVisitResult.TERMINATE;
                    }
                    if (attrs != null
                            && attrs.isRegularFile()
                            && attrs.size() <= MAX_FILE_SIZE_BYTES
                            && isSearchablePath(file)) {
                        searchFile(file, query, results, resultCount, shouldCancel);
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
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
        Path workspace,
        String search,
        String replace,
        boolean caseSensitive,
        boolean wholeWord
) throws IOException {
    return replaceAll(workspace, search, replace, caseSensitive, wholeWord, () -> false);
}

public int replaceAll(
        Path workspace,
        String search,
        String replace,
        boolean caseSensitive,
        boolean wholeWord,
        BooleanSupplier shouldCancel
) throws IOException {

    if (workspace == null || search == null || search.isBlank()) {
        return 0;
    }

    final String finalReplace = replace == null ? "" : replace;
    final int[] replacedCount = {0};

    Files.walkFileTree(workspace, new SimpleFileVisitor<>() {
        @Override
        public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
            if (isCancelled(shouldCancel)) {
                return FileVisitResult.TERMINATE;
            }
            if (!dir.equals(workspace) && isIgnoredDirectory(dir)) {
                return FileVisitResult.SKIP_SUBTREE;
            }
            return FileVisitResult.CONTINUE;
        }

        @Override
        public FileVisitResult visitFile(Path path, BasicFileAttributes attrs) {
            if (isCancelled(shouldCancel)) {
                return FileVisitResult.TERMINATE;
            }
            if (attrs == null
                    || !attrs.isRegularFile()
                    || attrs.size() > MAX_FILE_SIZE_BYTES
                    || !isSearchablePath(path)) {
                return FileVisitResult.CONTINUE;
            }

            replacedCount[0] += replaceInFile(path, search, finalReplace, caseSensitive, wholeWord);
            return FileVisitResult.CONTINUE;
        }

        @Override
        public FileVisitResult visitFileFailed(Path file, IOException exc) {
            return FileVisitResult.CONTINUE;
        }
    });

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

private int replaceInFile(
        Path path,
        String search,
        String replace,
        boolean caseSensitive,
        boolean wholeWord
) {
    try {
        String content = Files.readString(path, StandardCharsets.UTF_8);
        if (content.indexOf('\0') >= 0 || content.isBlank()) {
            return 0;
        }

        String newContent;
        int count;

        if (wholeWord) {
            int flags = caseSensitive ? 0 : Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
            Pattern pattern = Pattern.compile("\\b" + Pattern.quote(search) + "\\b", flags);
            Matcher matcher = pattern.matcher(content);
            count = countMatches(matcher);
            matcher.reset();
            newContent = matcher.replaceAll(Matcher.quoteReplacement(replace));
        } else if (caseSensitive) {
            count = countOccurrences(content, search);
            newContent = content.replace(search, replace);
        } else {
            Pattern pattern = Pattern.compile(Pattern.quote(search), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            Matcher matcher = pattern.matcher(content);
            count = countMatches(matcher);
            matcher.reset();
            newContent = matcher.replaceAll(Matcher.quoteReplacement(replace));
        }

        if (count > 0 && !content.equals(newContent)) {
            Files.writeString(path, newContent, StandardCharsets.UTF_8);
        }

        return count;
    } catch (Exception ignored) {
        return 0;
    }
}

private static int countMatches(Matcher matcher) {
    int count = 0;
    while (matcher.find()) {
        count++;
    }
    return count;
}

    private void searchFile(
            Path file,
            WorkspaceSearchQuery query,
            ConcurrentLinkedQueue<WorkspaceSearchResult> results,
            AtomicInteger resultCount,
            BooleanSupplier shouldCancel
    ) {

        try {

            long size = Files.size(file);

            if (size > MAX_FILE_SIZE_BYTES) {
                return;
            }

            String text =
                    Files.readString(
                            file,
                            StandardCharsets.UTF_8
                    );

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
                        results,
                        resultCount,
                        shouldCancel
                );

                return;
            }

            searchNormal(
                    text,
                    needle,
                    file,
                    query.isCaseSensitive(),
                    results,
                    resultCount,
                    shouldCancel
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
            ConcurrentLinkedQueue<WorkspaceSearchResult> results,
            AtomicInteger resultCount,
            BooleanSupplier shouldCancel
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
            if (isCancelled(shouldCancel) || resultCount.get() >= MAX_RESULTS) {
                return;
            }

            int start = matcher.start();

            int end = matcher.end();

            addResult(results, resultCount, buildResult(file, text, start, end));
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
            ConcurrentLinkedQueue<WorkspaceSearchResult> results,
            AtomicInteger resultCount,
            BooleanSupplier shouldCancel
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
            if (isCancelled(shouldCancel) || resultCount.get() >= MAX_RESULTS) {
                return;
            }

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

            addResult(results, resultCount, buildResult(file, text, index, end));

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

    private void addResult(
            ConcurrentLinkedQueue<WorkspaceSearchResult> results,
            AtomicInteger resultCount,
            WorkspaceSearchResult result
    ) {
        if (resultCount.get() >= MAX_RESULTS) {
            return;
        }

        results.add(result);
        resultCount.incrementAndGet();
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

    private boolean isSearchablePath(Path path) {
        return isAllowedPath(path)
                && fileFilter.isSearchableFile(path)
                && isTextLikeFile(path);
    }

    private boolean isIgnoredDirectory(Path directory) {
        Path fileName = directory == null ? null : directory.getFileName();
        String name = fileName == null ? "" : fileName.toString().toLowerCase(Locale.ROOT);
        return IGNORED_DIRECTORY_NAMES.contains(name);
    }

    private boolean isCancelled(BooleanSupplier shouldCancel) {
        return Thread.currentThread().isInterrupted()
                || (shouldCancel != null && shouldCancel.getAsBoolean());
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
