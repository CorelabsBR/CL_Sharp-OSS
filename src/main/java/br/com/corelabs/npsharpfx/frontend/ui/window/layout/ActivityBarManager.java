package br.com.corelabs.npsharpfx.frontend.ui.window.layout;

import java.util.Map;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public class ActivityBarManager {

    private static final double ACTIVITY_BAR_WIDTH = 48;
    private static final double BUTTON_SIZE = 40;

    private final VBox activityBar;
    private final Map<String, ActivityItem> activityItems;

    public ActivityBarManager(Map<String, ActivityItem> activityItems) {
        this.activityItems = activityItems;
        this.activityBar = new VBox();
    }

    public VBox createActivityBar() {
        activityBar.getStyleClass().add("activity-bar");
        activityBar.setPrefWidth(ACTIVITY_BAR_WIDTH);
        activityBar.setMinWidth(ACTIVITY_BAR_WIDTH);
        activityBar.setMaxWidth(ACTIVITY_BAR_WIDTH);
        activityBar.setAlignment(Pos.TOP_CENTER);

        ActivityItem explorer = activityItems.get("explorer");
        ActivityItem search = activityItems.get("search");
        ActivityItem git = activityItems.get("git");
        ActivityItem debug = activityItems.get("debug");
        ActivityItem extensions = activityItems.get("extensions");
        ActivityItem settings = activityItems.get("settings");

        Region spacer = new Region();
        VBox.setVgrow(spacer, Priority.ALWAYS);

        activityBar.getChildren().addAll(
                explorer.button,
                search.button,
                git.button,
                debug.button,
                extensions.button,
                spacer,
                settings.button
        );

        return activityBar;
    }

    public Button createActivityButton() {
        Button button = new Button();
        button.getStyleClass().add("activity-icon");
        button.setAlignment(Pos.CENTER);
        button.setFocusTraversable(false);
        button.setMaxWidth(Double.MAX_VALUE);

        button.setPrefWidth(BUTTON_SIZE);
        button.setMinWidth(BUTTON_SIZE);
        button.setMaxWidth(BUTTON_SIZE);

        button.setPrefHeight(BUTTON_SIZE);
        button.setMinHeight(BUTTON_SIZE);
        button.setMaxHeight(BUTTON_SIZE);

        return button;
    }

    public static class ActivityItem {
        public final String id;
        public final Button button;
        public final javafx.scene.Node content;

        public ActivityItem(String id, Button button, javafx.scene.Node content) {
            this.id = id;
            this.button = button;
            this.content = content;
            this.button.setId(this.id);
        }
    }
}


