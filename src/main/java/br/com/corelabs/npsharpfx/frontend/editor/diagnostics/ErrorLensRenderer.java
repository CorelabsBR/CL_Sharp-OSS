/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.editor.diagnostics;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.IntFunction;
import java.util.function.Supplier;

import org.fxmisc.richtext.CodeArea;
import org.fxmisc.richtext.LineNumberFactory;

import javafx.beans.binding.Bindings;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.OverrunStyle;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;

public final class ErrorLensRenderer {

    /*
     * RichTextFX does not expose a stable public API for "append after visual line"
     * decorations without changing document segments. This renderer keeps the
     * message as an unmanaged virtual node anchored from the gutter, so nothing is
     * inserted into or saved with the user text.
     */
    private static final List<String> LINE_STYLE_CLASSES = List.of(
            "errorlens-line-error",
            "errorlens-line-warning",
            "errorlens-line-info",
            "errorlens-line-hint"
    );

    private final CodeArea editor;
    private final Supplier<List<EditorDiagnostic>> diagnosticsSupplier;
    private final IntFunction<Node> lineNumberFactory;

    public ErrorLensRenderer(CodeArea editor, Supplier<List<EditorDiagnostic>> diagnosticsSupplier) {
        this.editor = editor;
        this.diagnosticsSupplier = diagnosticsSupplier;
        this.lineNumberFactory = LineNumberFactory.get(editor);
    }

    public void render(boolean enabled) {
        applyParagraphStyles(enabled);
        editor.setParagraphGraphicFactory(enabled ? this::createErrorLensGraphic : lineNumberFactory);
        recreateParagraphGraphics();
    }

    public void clear() {
        render(false);
    }

    private void applyParagraphStyles(boolean enabled) {
        int paragraphCount = editor.getParagraphs().size();

        for (int paragraph = 0; paragraph < paragraphCount; paragraph++) {
            Collection<String> currentStyle = editor.getParagraph(paragraph).getParagraphStyle();
            List<String> nextStyle = withoutErrorLensStyles(currentStyle);

            if (enabled) {
                EditorDiagnostic diagnostic = primaryDiagnosticForLine(paragraph + 1);
                if (diagnostic != null) {
                    nextStyle.add(lineStyleClass(diagnostic.getSeverity()));
                }
            }

            editor.setParagraphStyle(paragraph, nextStyle);
        }
    }

    private Node createErrorLensGraphic(int paragraphIndex) {
        Node lineNumber = lineNumberFactory.apply(paragraphIndex);
        List<EditorDiagnostic> diagnostics = diagnosticsForLine(paragraphIndex + 1);

        if (diagnostics.isEmpty()) {
            return lineNumber;
        }

        EditorDiagnostic primary = diagnostics.get(0);
        Label icon = new Label(iconFor(primary.getSeverity()));
        icon.getStyleClass().add("errorlens-gutter-" + cssSeverity(primary.getSeverity()));
        icon.setMinWidth(14);
        icon.setAlignment(Pos.CENTER);

        HBox gutter = new HBox(lineNumber, icon);
        gutter.setAlignment(Pos.CENTER_LEFT);
        gutter.getStyleClass().add("errorlens-gutter");

        StackPane graphic = new StackPane(gutter);
        graphic.setAlignment(Pos.CENTER_LEFT);
        graphic.getStyleClass().add("errorlens-graphic");

        Label message = new Label(formatMessage(primary));
        message.getStyleClass().add("errorlens-message-" + cssSeverity(primary.getSeverity()));
        message.setMouseTransparent(true);
        message.setManaged(false);
        message.setTextOverrun(OverrunStyle.ELLIPSIS);
        message.setMaxWidth(520);
        message.translateXProperty().bind(Bindings.createDoubleBinding(
                () -> Math.max(180.0, editor.getWidth() * 0.42),
                editor.widthProperty()
        ));

        Tooltip.install(graphic, new Tooltip(formatTooltip(diagnostics)));
        graphic.getChildren().add(message);
        return graphic;
    }

    private void recreateParagraphGraphics() {
        int paragraphCount = editor.getParagraphs().size();
        for (int paragraph = 0; paragraph < paragraphCount; paragraph++) {
            editor.recreateParagraphGraphic(paragraph);
        }
    }

    private List<String> withoutErrorLensStyles(Collection<String> styles) {
        List<String> next = new ArrayList<>(styles == null ? List.of() : styles);
        next.removeIf(LINE_STYLE_CLASSES::contains);
        return next;
    }

    private EditorDiagnostic primaryDiagnosticForLine(int line) {
        List<EditorDiagnostic> diagnostics = diagnosticsForLine(line);
        return diagnostics.isEmpty() ? null : diagnostics.get(0);
    }

    private List<EditorDiagnostic> diagnosticsForLine(int line) {
        List<EditorDiagnostic> diagnostics = diagnosticsSupplier.get();
        return (diagnostics == null ? List.<EditorDiagnostic>of() : diagnostics).stream()
                .filter(diagnostic -> diagnostic.getLine() == line)
                .toList();
    }

    private String lineStyleClass(String severity) {
        return "errorlens-line-" + cssSeverity(severity);
    }

    private String cssSeverity(String severity) {
        if (EditorDiagnostic.ERROR.equals(severity)) {
            return "error";
        }
        if (EditorDiagnostic.WARNING.equals(severity)) {
            return "warning";
        }
        return "info";
    }

    private String iconFor(String severity) {
        return switch (severity) {
            case EditorDiagnostic.ERROR -> "!";
            case EditorDiagnostic.WARNING -> "!";
            default -> "i";
        };
    }

    private String formatMessage(EditorDiagnostic diagnostic) {
        String source = diagnostic.getSource();
        String suffix = "";

        if (!source.isBlank()) {
            suffix = " (" + source + ")";
        }

        return diagnostic.getMessage() + suffix;
    }

    private String formatTooltip(List<EditorDiagnostic> diagnostics) {
        return diagnostics.stream()
                .map(this::formatMessage)
                .reduce((left, right) -> left + System.lineSeparator() + right)
                .orElse("");
    }
}
