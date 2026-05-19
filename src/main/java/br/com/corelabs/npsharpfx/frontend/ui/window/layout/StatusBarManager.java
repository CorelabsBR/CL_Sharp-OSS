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
    private final Label debugLabel;
    private final Label terminalLabel;

    public StatusBarManager() {
        this.statusBar = new HBox();
        this.statusLabelLeft = new Label("Pronto");
        this.statusLabelRight = new Label("NPSharp");
        this.gitLabel = new Label("$(git) sem repo");
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
        gitLabel.getStyleClass().add("status-label");
        debugLabel.getStyleClass().add("status-label");
        terminalLabel.getStyleClass().add("status-label");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        statusBar.getChildren().addAll(
                gitLabel,
                statusLabelLeft,
                spacer,
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
        gitLabel.setText(text != null && !text.isBlank() ? text : "$(git) sem repo");
    }

    public void updateDebugStatus(String text) {
        debugLabel.setText(text != null && !text.isBlank() ? text : "Debug");
    }

    public void updateTerminalStatus(String text) {
        terminalLabel.setText(text != null && !text.isBlank() ? text : "Terminal");
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
}


