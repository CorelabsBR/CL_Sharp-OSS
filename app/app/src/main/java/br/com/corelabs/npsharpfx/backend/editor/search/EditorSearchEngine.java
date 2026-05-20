package br.com.corelabs.npsharpfx.backend.editor.search;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class EditorSearchEngine {
    private static final int MAX_MATCHES = 20_000;

    public SearchResult find(String text, String query, SearchOptions options, int cursor) {
        String source = text == null ? "" : text;
        if (query == null || query.isEmpty()) {
            return new SearchResult("", List.of(), -1, null);
        }
        try {
            Pattern pattern = compile(query, options);
            Matcher matcher = pattern.matcher(source);
            List<SearchMatch> matches = new ArrayList<>();
            int selected = -1;
            while (matcher.find()) {
                if (matcher.start() == matcher.end()) {
                    if (matcher.end() < source.length()) matcher.region(matcher.end() + 1, source.length());
                    continue;
                }
                SearchMatch match = new SearchMatch(matcher.start(), matcher.end());
                if (selected < 0 && matcher.end() >= cursor) selected = matches.size();
                matches.add(match);
                if (matches.size() >= MAX_MATCHES) break;
            }
            if (selected < 0 && !matches.isEmpty()) selected = 0;
            return new SearchResult(query, matches, selected, null);
        } catch (Exception e) {
            return new SearchResult(query, List.of(), -1, e.getMessage());
        }
    }

    public ReplaceResult replaceCurrent(String text, SearchResult result, String replacement, int selectedIndex, SearchOptions options) {
        if (result == null || result.getMatches().isEmpty() || selectedIndex < 0 || selectedIndex >= result.getMatches().size()) {
            return new ReplaceResult(text, 0, Math.max(0, selectedIndex), null);
        }
        SearchMatch match = result.getMatches().get(selectedIndex);
        String source = text == null ? "" : text;
        String safeReplacement = replacement == null ? "" : replacement;
        String next = source.substring(0, match.getStart()) + safeReplacement + source.substring(match.getEnd());
        return new ReplaceResult(next, 1, match.getStart() + safeReplacement.length(), null);
    }

    public ReplaceResult replaceAll(String text, String query, String replacement, SearchOptions options, int cursor) {
        String source = text == null ? "" : text;
        if (query == null || query.isEmpty()) {
            return new ReplaceResult(source, 0, cursor, null);
        }
        try {
            Pattern pattern = compile(query, options);
            Matcher matcher = pattern.matcher(source);
            String safeReplacement = replacement == null ? "" : replacement;
            StringBuffer buffer = new StringBuffer(source.length());
            int count = 0;
            while (matcher.find()) {
                if (matcher.start() == matcher.end()) {
                    continue;
                }
                matcher.appendReplacement(buffer, options.isRegex() ? safeReplacement : Matcher.quoteReplacement(safeReplacement));
                count++;
                if (count >= MAX_MATCHES) break;
            }
            matcher.appendTail(buffer);
            int nextCursor = Math.min(Math.max(0, cursor), buffer.length());
            return new ReplaceResult(buffer.toString(), count, nextCursor, null);
        } catch (Exception e) {
            return new ReplaceResult(source, 0, cursor, e.getMessage());
        }
    }

    private Pattern compile(String query, SearchOptions options) {
        SearchOptions safe = options == null ? SearchOptions.plainIgnoreCase() : options;
        String pattern = safe.isRegex() ? query : Pattern.quote(query);
        if (safe.isWholeWord()) {
            pattern = "\\b(?:" + pattern + ")\\b";
        }
        int flags = Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS;
        if (!safe.isCaseSensitive()) flags |= Pattern.CASE_INSENSITIVE;
        if (safe.isMultiline()) flags |= Pattern.MULTILINE | Pattern.DOTALL;
        return Pattern.compile(pattern, flags);
    }
}
