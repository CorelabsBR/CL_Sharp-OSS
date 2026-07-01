package br.com.corelabs.npsharpfx.frontend.ui.window.shortcuts;

import javafx.scene.Scene;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyCodeCombination;
import javafx.scene.input.KeyCombination;

public class ShortcutManager {

    public interface EditorActions {
        void newTab();
        void openFileFromDialog();
        void saveCurrentFile();
        void saveCurrentFileAs();
        void closeCurrentTab();
        void closeAllTabs();
        void goToStartOfFile();
        void goToEndOfFile();
    }

    public interface WindowActions {
        void openFolderInExplorer();
        void toggleSidebarVisibility();
        void toggleActivityPanel(String panelId);
        void showTerminal();
        void focusEditor();
        void splitTerminal();
        void runCurrentFile();
        void showCommandPalette();
        void showQuickOpen();
    }

    public ShortcutManager() {
    }

    public void configureShortcuts(
            Scene scene,
            EditorActions editorActions,
            WindowActions windowActions) {

        // File operations
        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.N, KeyCombination.CONTROL_DOWN),
                editorActions::newTab
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.O, KeyCombination.CONTROL_DOWN),
                editorActions::openFileFromDialog
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.S, KeyCombination.CONTROL_DOWN),
                editorActions::saveCurrentFile
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.S, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                editorActions::saveCurrentFileAs
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.W, KeyCombination.CONTROL_DOWN),
                editorActions::closeCurrentTab
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.W, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                editorActions::closeAllTabs
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.HOME, KeyCombination.CONTROL_DOWN),
                editorActions::goToStartOfFile
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.END, KeyCombination.CONTROL_DOWN),
                editorActions::goToEndOfFile
        );

        // Window operations
        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.O, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                windowActions::openFolderInExplorer
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.B, KeyCombination.CONTROL_DOWN),
                windowActions::toggleSidebarVisibility
        );

        // Panel toggles
        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.E, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                () -> windowActions.toggleActivityPanel("explorer")
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.F, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                () -> windowActions.toggleActivityPanel("search")
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.G, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                () -> windowActions.toggleActivityPanel("git")
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.D, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                () -> windowActions.toggleActivityPanel("debug")
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.X, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                () -> windowActions.toggleActivityPanel("extensions")
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.COMMA, KeyCombination.CONTROL_DOWN),
                () -> windowActions.toggleActivityPanel("settings")
        );

        // Terminal operations
        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.BACK_QUOTE, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                windowActions::showTerminal
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.DIGIT5, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                windowActions::splitTerminal
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.P, KeyCombination.CONTROL_DOWN, KeyCombination.SHIFT_DOWN),
                windowActions::showCommandPalette
        );

        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.P, KeyCombination.CONTROL_DOWN),
                windowActions::showQuickOpen
        );

        // Portugol execution
        scene.getAccelerators().put(
                new KeyCodeCombination(KeyCode.F5),
                windowActions::runCurrentFile
        );

        // Tab focus
        scene.setOnKeyPressed(event -> {
            if (event.isControlDown() && event.getCode() == KeyCode.TAB) {
                windowActions.focusEditor();
                event.consume();
            }
        });
    }
}

