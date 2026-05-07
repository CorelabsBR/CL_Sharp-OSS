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

    public StatusBarManager() {
        this.statusBar = new HBox();
        this.statusLabelLeft = new Label("Pronto");
        this.statusLabelRight = new Label("NPSharp");
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

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        statusBar.getChildren().addAll(statusLabelLeft, spacer, statusLabelRight);
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
}


