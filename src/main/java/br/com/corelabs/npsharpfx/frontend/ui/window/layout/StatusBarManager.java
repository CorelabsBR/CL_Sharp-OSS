/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.window.layout;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

public class StatusBarManager {

    private final HBox statusBar;
    private final Label statusLabelLeft;
    private final Label statusLabelRight;
    private final Label gitLabel;
    private final Label errorsLabel;
    private final Label warningsLabel;
    private final Label buildLabel;
    private final Label editorLocationLabel;
    private final Label debugLabel;
    private final Label terminalLabel;

    public StatusBarManager() {
        this.statusBar = new HBox();
        this.statusLabelLeft = new Label("");
        this.statusLabelRight = new Label("NPSharp");
        this.gitLabel = new Label("");
        this.errorsLabel = new Label("0 Errors");
        this.warningsLabel = new Label("0 Warnings");
        this.buildLabel = new Label("Idle");
        this.editorLocationLabel = new Label("");
        this.debugLabel = new Label("Debug");
        this.terminalLabel = new Label("Terminal");
    }

    public HBox createStatusBar() {
        statusBar.getStyleClass().add("status-bar");
        statusBar.setAlignment(Pos.CENTER_LEFT);
        statusBar.setPadding(new Insets(0, 10, 0, 10));

        statusBar.setPrefHeight(24);
        statusBar.setMinHeight(24);
        statusBar.setMaxHeight(24);

        statusLabelLeft.getStyleClass().add("status-label");
        statusLabelRight.getStyleClass().add("status-label");
        gitLabel.getStyleClass().addAll("status-label", "status-label-git");
        errorsLabel.getStyleClass().addAll("status-label", "status-label-errors");
        warningsLabel.getStyleClass().addAll("status-label", "status-label-warnings");
        buildLabel.getStyleClass().addAll("status-label", "status-label-build");
        editorLocationLabel.getStyleClass().addAll("status-label", "status-label-editor-location");
        debugLabel.getStyleClass().addAll("status-label", "status-label-debug");
        terminalLabel.getStyleClass().addAll("status-label", "status-label-terminal");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        statusBar.getChildren().addAll(
                gitLabel,
                errorsLabel,
                warningsLabel,
                buildLabel,
                statusLabelLeft,
                spacer,
                editorLocationLabel,
                debugLabel,
                terminalLabel,
                statusLabelRight
        );
        return statusBar;
    }

    public void updateStatusLeft(String text) {
        if (statusLabelLeft != null) {
            statusLabelLeft.setText(text != null ? text : "");
        }
    }

    public void updateStatusRight(String text) {
        if (statusLabelRight != null) {
            statusLabelRight.setText(text != null ? text : "");
        }
    }

    public String getStatusLeft() {
        return statusLabelLeft.getText();
    }

    public String getStatusRight() {
        return statusLabelRight.getText();
    }

    public void updateGitStatus(String text) {
        String normalized = text == null ? "" : text.trim();
        gitLabel.setText(normalized.contains("sem repo") ? "" : normalized);
    }

    public void updateDebugStatus(String text) {
        debugLabel.setText(text != null && !text.isBlank() ? text : "Debug");
    }

    public void updateTerminalStatus(String text) {
        terminalLabel.setText(text != null && !text.isBlank() ? text : "Terminal");
    }

    public void updateDiagnosticsCounts(int errors, int warnings) {
        errorsLabel.setText(errors + (errors == 1 ? " Error" : " Errors"));
        warningsLabel.setText(warnings + (warnings == 1 ? " Warning" : " Warnings"));
    }

    public void updateBuildStatus(String text) {
        buildLabel.setText(text != null && !text.isBlank() ? text : "Idle");
    }

    public void updateEditorLocation(String text) {
        editorLocationLabel.setText(text != null ? text : "");
    }

    public void setGitAction(Runnable action) {
        gitLabel.setOnMouseClicked(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void setDebugAction(Runnable action) {
        debugLabel.setOnMouseClicked(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void setTerminalAction(Runnable action) {
        terminalLabel.setOnMouseClicked(event -> {
            if (action != null) {
                action.run();
            }
        });
    }

    public void setProblemsAction(Runnable action) {
        errorsLabel.setOnMouseClicked(event -> {
            if (action != null) {
                action.run();
            }
        });
        warningsLabel.setOnMouseClicked(event -> {
            if (action != null) {
                action.run();
            }
        });
    }
}
