package br.com.corelabs.npsharpfx.frontend.ui.window.layout;

import java.util.Map;
import java.util.Objects;

import br.com.corelabs.npsharpfx.frontend.ui.icons.Codicon;
import br.com.corelabs.npsharpfx.frontend.ui.window.layout.ActivityBarManager.ActivityItem;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;

public class SidePanelManager {

    private static final double SIDE_PANEL_PREF_WIDTH = 300;
    private static final double SIDE_PANEL_MIN_WIDTH = 260;

    private final StackPane sidePanelHost;
    private final Map<String, ActivityItem> activityItems;

    private String activePanelId;
    private String lastPanelId = "explorer";
    private Button activeActivityButton;

    public SidePanelManager(Map<String, ActivityItem> activityItems) {
        this.activityItems = activityItems;
        this.sidePanelHost = createSidePanelHost();
    }

    private StackPane createSidePanelHost() {

        StackPane host = new StackPane();

        host.getStyleClass().add("side-panel-host");

        /*
        ========================================
        TAMANHO LIVRE
        ========================================
        */

        host.setPrefWidth(SIDE_PANEL_PREF_WIDTH);

        host.setMinWidth(0);

        host.setMaxWidth(Double.MAX_VALUE);

        /*
        ========================================
        RESPONSIVO
        ========================================
        */

        HBox.setHgrow(host, Priority.ALWAYS);

        host.setVisible(false);

        host.setManaged(false);

        return host;
    }

    public double getPreferredWidth() {
        return SIDE_PANEL_PREF_WIDTH;
    }

    public double getMinWidth() {
        return SIDE_PANEL_MIN_WIDTH;
    }

    public StackPane getSidePanelHost() {
        return sidePanelHost;
    }

    public void toggleActivityPanel(String panelId, Runnable onStatusUpdate) {
        boolean samePanelAlreadyOpen = Objects.equals(panelId, activePanelId) && sidePanelHost.isVisible();

        if (samePanelAlreadyOpen) {
            hideSidePanel(onStatusUpdate);
            return;
        }

        showSidePanel(panelId, onStatusUpdate);
    }

    public void showSidePanel(String panelId, Runnable onStatusUpdate) {
        ActivityItem item = activityItems.get(panelId);

        if (item == null) {
            return;
        }

        sidePanelHost.getChildren().setAll(item.content);
        sidePanelHost.setManaged(true);
        sidePanelHost.setVisible(true);

        setActiveActivityButton(item.button);
        activePanelId = panelId;
        lastPanelId = panelId;
        VSCodeLayoutAnimator.fadeSlideIn(sidePanelHost, -10, 0);

        if (onStatusUpdate != null) {
            onStatusUpdate.run();
        }
    }

    public void hideSidePanel(Runnable onStatusUpdate) {
        if (!sidePanelHost.isVisible()) {
            clearActiveActivityButton();
            activePanelId = null;
            if (onStatusUpdate != null) {
                onStatusUpdate.run();
            }
            return;
        }

        clearActiveActivityButton();
        activePanelId = null;

        VSCodeLayoutAnimator.fadeSlideOut(sidePanelHost, -10, 0, () -> {
            sidePanelHost.getChildren().clear();
            sidePanelHost.setManaged(false);
            sidePanelHost.setVisible(false);

            if (onStatusUpdate != null) {
                onStatusUpdate.run();
            }
        });
    }

    public void toggleSidebarVisibility(Runnable onStatusUpdate) {
        if (sidePanelHost.isVisible()) {
            hideSidePanel(onStatusUpdate);
        } else {
            String panelToOpen = activePanelId != null ? activePanelId : lastPanelId;
            showSidePanel(panelToOpen, onStatusUpdate);
        }
    }

    private void setActiveActivityButton(Button button) {
        clearActiveActivityButton();
        activeActivityButton = button;

        if (activeActivityButton != null && !activeActivityButton.getStyleClass().contains("active")) {
            activeActivityButton.getStyleClass().add("active");
        }
    }

    private void clearActiveActivityButton() {
        if (activeActivityButton != null) {
            activeActivityButton.getStyleClass().remove("active");
            activeActivityButton = null;
        }
    }

    public javafx.scene.Node wrapSidePanel(String title, javafx.scene.Node content, Runnable onCollapse) {
        BorderPane panel = new BorderPane();
        panel.getStyleClass().add("side-panel");

        HBox header = new HBox();
        header.getStyleClass().add("side-panel-header");
        header.setAlignment(Pos.CENTER_LEFT);
        header.setPadding(new Insets(10, 12, 10, 12));

        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("panel-title");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Button collapseButton = new Button();
        collapseButton.getStyleClass().add("side-panel-collapse-button");
        collapseButton.setGraphic(Codicon.icon("/icons/codicons/chevron-left.svg"));
        collapseButton.setFocusTraversable(false);
        collapseButton.setOnAction(event -> {
            if (onCollapse != null) {
                onCollapse.run();
            }
        });

        header.getChildren().addAll(titleLabel, spacer, collapseButton);

        BorderPane.setMargin(content, new Insets(0));
        panel.setTop(header);
        panel.setCenter(content);

        return panel;
    }

    public String getActivePanelId() {
        return activePanelId;
    }

    public boolean isSidePanelVisible() {
        return sidePanelHost.isVisible();
    }
}


