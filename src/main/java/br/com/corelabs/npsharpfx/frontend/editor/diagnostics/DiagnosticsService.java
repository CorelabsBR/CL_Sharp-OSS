/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.editor.diagnostics;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DiagnosticsService {

    private final Map<Path, List<EditorDiagnostic>> diagnosticsByFile = new HashMap<>();
    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    public synchronized void setDiagnostics(Path file, List<EditorDiagnostic> diagnostics) {
        Path normalizedFile = normalize(file);
        if (normalizedFile == null) {
            return;
        }

        List<EditorDiagnostic> sorted = new ArrayList<>(diagnostics == null ? List.of() : diagnostics);
        sorted.removeIf(diagnostic -> diagnostic == null || diagnostic.getFile() == null);
        sorted.sort(Comparator
                .comparing(EditorDiagnostic::getSeverity)
                .thenComparingInt(EditorDiagnostic::getLine)
                .thenComparingInt(EditorDiagnostic::getColumn));

        if (sorted.isEmpty()) {
            diagnosticsByFile.remove(normalizedFile);
        } else {
            diagnosticsByFile.put(normalizedFile, List.copyOf(sorted));
        }

        notifyListeners();
    }

    public synchronized void setProjectDiagnostics(Path projectRoot, List<EditorDiagnostic> diagnostics) {
        Path normalizedRoot = normalize(projectRoot);
        if (normalizedRoot == null) {
            return;
        }

        clearDiagnosticsUnderLocked(normalizedRoot);
        Map<Path, List<EditorDiagnostic>> grouped = new HashMap<>();
        for (EditorDiagnostic diagnostic : diagnostics == null ? List.<EditorDiagnostic>of() : diagnostics) {
            if (diagnostic == null || diagnostic.getFile() == null) {
                continue;
            }
            grouped.computeIfAbsent(normalize(diagnostic.getFile()), ignored -> new ArrayList<>()).add(diagnostic);
        }

        for (Map.Entry<Path, List<EditorDiagnostic>> entry : grouped.entrySet()) {
            List<EditorDiagnostic> sorted = new ArrayList<>(entry.getValue());
            sorted.sort(Comparator
                    .comparing(EditorDiagnostic::getSeverity)
                    .thenComparingInt(EditorDiagnostic::getLine)
                    .thenComparingInt(EditorDiagnostic::getColumn));
            diagnosticsByFile.put(entry.getKey(), List.copyOf(sorted));
        }

        notifyListeners();
    }

    public synchronized void clearDiagnostics(Path file) {
        Path normalizedFile = normalize(file);
        if (normalizedFile != null) {
            diagnosticsByFile.remove(normalizedFile);
            notifyListeners();
        }
    }

    public synchronized void clearDiagnosticsUnder(Path root) {
        Path normalizedRoot = normalize(root);
        if (normalizedRoot != null) {
            clearDiagnosticsUnderLocked(normalizedRoot);
            notifyListeners();
        }
    }

    public synchronized List<EditorDiagnostic> getAllDiagnostics() {
        return diagnosticsByFile.values().stream()
                .flatMap(List::stream)
                .sorted(Comparator
                        .comparing((EditorDiagnostic diagnostic) -> diagnostic.getFile().toString())
                        .thenComparingInt(EditorDiagnostic::getLine)
                        .thenComparingInt(EditorDiagnostic::getColumn))
                .toList();
    }

    public synchronized List<EditorDiagnostic> getDiagnosticsForFile(Path file) {
        Path normalizedFile = normalize(file);
        if (normalizedFile == null) {
            return List.of();
        }
        return diagnosticsByFile.getOrDefault(normalizedFile, List.of());
    }

    public synchronized int countErrors() {
        return (int) getAllDiagnostics().stream().filter(EditorDiagnostic::isError).count();
    }

    public synchronized int countWarnings() {
        return (int) getAllDiagnostics().stream().filter(EditorDiagnostic::isWarning).count();
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    private void clearDiagnosticsUnderLocked(Path root) {
        Set<Path> toRemove = new HashSet<>();
        for (Path file : diagnosticsByFile.keySet()) {
            if (file.startsWith(root)) {
                toRemove.add(file);
            }
        }
        toRemove.forEach(diagnosticsByFile::remove);
    }

    private Path normalize(Path path) {
        return path == null ? null : path.toAbsolutePath().normalize();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
