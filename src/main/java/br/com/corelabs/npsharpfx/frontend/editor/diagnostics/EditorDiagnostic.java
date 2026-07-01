/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.editor.diagnostics;

import java.nio.file.Path;
import java.util.Objects;

public final class EditorDiagnostic {

    public static final String ERROR = "ERROR";
    public static final String WARNING = "WARNING";
    public static final String INFO = "INFO";

    private final Path file;
    private final int line;
    private final int column;
    private final String severity;
    private final String message;
    private final String source;

    public EditorDiagnostic(
            Path file,
            int line,
            int column,
            String severity,
            String message,
            String source
    ) {
        this.file = file == null ? null : file.toAbsolutePath().normalize();
        this.line = Math.max(1, line);
        this.column = Math.max(1, column);
        this.severity = normalizeSeverity(severity);
        this.message = Objects.requireNonNullElse(message, "");
        this.source = Objects.requireNonNullElse(source, "");
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

    public String getSeverity() {
        return severity;
    }

    public String getMessage() {
        return message;
    }

    public String getSource() {
        return source;
    }

    public boolean isError() {
        return ERROR.equals(severity);
    }

    public boolean isWarning() {
        return WARNING.equals(severity);
    }

    private String normalizeSeverity(String value) {
        if (value == null || value.isBlank()) {
            return INFO;
        }

        String normalized = value.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case ERROR, WARNING, INFO -> normalized;
            default -> INFO;
        };
    }
}
