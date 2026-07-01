/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.editor.diagnostics;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class EditorDiagnosticsManager {

    private static final String DEFAULT_OWNER = "__default__";

    private final Map<String, List<EditorDiagnostic>> diagnosticsByOwner = new HashMap<>();
    private String activeOwner = DEFAULT_OWNER;

    public void setActiveOwner(String owner) {
        activeOwner = normalizeOwner(owner);
    }

    public void setDiagnostics(List<EditorDiagnostic> diagnostics) {
        setDiagnostics(activeOwner, diagnostics);
    }

    public void setDiagnostics(String owner, List<EditorDiagnostic> diagnostics) {
        String normalizedOwner = normalizeOwner(owner);
        List<EditorDiagnostic> sorted = new ArrayList<>(
                diagnostics == null ? Collections.emptyList() : diagnostics
        );

        sorted.removeIf(Objects::isNull);
        sorted.sort(Comparator
                .comparingInt(EditorDiagnostic::getLine)
                .thenComparingInt(diagnostic -> severityRank(diagnostic.getSeverity()))
                .thenComparingInt(EditorDiagnostic::getColumn));

        if (sorted.isEmpty()) {
            diagnosticsByOwner.remove(normalizedOwner);
            return;
        }

        diagnosticsByOwner.put(normalizedOwner, List.copyOf(sorted));
    }

    public void clear() {
        clear(activeOwner);
    }

    public void clear(String owner) {
        diagnosticsByOwner.remove(normalizeOwner(owner));
    }

    public void clearAll() {
        diagnosticsByOwner.clear();
    }

    public List<EditorDiagnostic> getDiagnosticsForLine(int line) {
        return getDiagnosticsForLine(activeOwner, line);
    }

    public List<EditorDiagnostic> getDiagnosticsForLine(String owner, int line) {
        if (line < 1) {
            return List.of();
        }

        return diagnosticsByOwner.getOrDefault(normalizeOwner(owner), List.of())
                .stream()
                .filter(diagnostic -> diagnostic.getLine() == line)
                .toList();
    }

    public boolean hasDiagnostics() {
        return hasDiagnostics(activeOwner);
    }

    public boolean hasDiagnostics(String owner) {
        return !diagnosticsByOwner.getOrDefault(normalizeOwner(owner), List.of()).isEmpty();
    }

    public Map<String, Integer> countBySeverity() {
        return countBySeverity(activeOwner);
    }

    public Map<String, Integer> countBySeverity(String owner) {
        Map<String, Integer> counts = new HashMap<>();
        counts.put(EditorDiagnostic.ERROR, 0);
        counts.put(EditorDiagnostic.WARNING, 0);
        counts.put(EditorDiagnostic.INFO, 0);

        for (EditorDiagnostic diagnostic : diagnosticsByOwner.getOrDefault(normalizeOwner(owner), List.of())) {
            counts.compute(diagnostic.getSeverity(), (severity, count) -> count == null ? 1 : count + 1);
        }

        return counts;
    }

    private String normalizeOwner(String owner) {
        return owner == null || owner.isBlank() ? DEFAULT_OWNER : owner;
    }

    private int severityRank(String severity) {
        return switch (severity) {
            case EditorDiagnostic.ERROR -> 0;
            case EditorDiagnostic.WARNING -> 1;
            case EditorDiagnostic.INFO -> 2;
            default -> 3;
        };
    }
}
