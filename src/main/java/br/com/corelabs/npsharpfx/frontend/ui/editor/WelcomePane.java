/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.editor;

import br.com.corelabs.npsharpfx.frontend.ui.theme.ThemeManager;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

/*
========================================================
WELCOME PANE
Tela inicial do editor quando nÃ£o hÃ¡ abas abertas
========================================================

Responsabilidades:

- Mostrar logo da aplicaÃ§Ã£o
- Mostrar nome e slogan
- Exibir atalhos visuais de aÃ§Ãµes principais
- Permitir clicar em:
  - New File
  - Open File

Estrutura visual:

WelcomePane (VBox)
 â”œ logo
 â”œ tÃ­tulo
 â”œ subtÃ­tulo
 â”œ botÃ£o "New File"
 â”œ botÃ£o "Open File"
 â”” dica "Save File"
========================================================
*/

public class WelcomePane extends VBox {

    /* =========================================
       CONSTRUTOR
       Monta toda a tela inicial
    ========================================= */
    private final ThemeManager themeManager;
    
    public WelcomePane(Runnable onNewFile, Runnable onOpenFile, ThemeManager themeManager) {
        this.themeManager = themeManager;

        getStyleClass().add("welcome-pane");
        setAlignment(Pos.CENTER);
        setSpacing(18);

        ImageView logo = new ImageView(this.themeManager.getWelcomeLogo());
        logo.setFitWidth(120);
        logo.setFitHeight(120);
        logo.setPreserveRatio(true);
        logo.getStyleClass().add("welcome-logo");

        Label title = new Label("NPSharp");
        title.getStyleClass().add("welcome-title");

        Label subtitle = new Label("Tecnologia sem limites.");
        subtitle.getStyleClass().add("welcome-subtitle");

        HBox actionNew = createActionButton("Novo Arquivo", "Ctrl+N", onNewFile);
        HBox actionOpen = createActionButton("Abrir Arquivo", "Ctrl+O", onOpenFile);

        Label actionSave = new Label("Salvar Arquivo    Ctrl+S");
        actionSave.getStyleClass().add("welcome-hint");

        getChildren().addAll(
                logo,
                title,
                subtitle,
                actionNew,
                actionOpen,
                actionSave
        );
    }

    private HBox createActionButton(String text, String shortcut, Runnable action) {

        // container horizontal do botÃ£o
        HBox button = new HBox();
        button.getStyleClass().add("welcome-action");

        // alinhamento dos elementos internos
        button.setAlignment(Pos.CENTER_LEFT);

        // espaÃ§o entre texto principal e atalho
        button.setSpacing(24);

        // largura mÃ¡xima visual do botÃ£o
        button.setMaxWidth(280);

        /* -----------------------------------------
           TEXTO PRINCIPAL DA AÃ‡ÃƒO
        ----------------------------------------- */

        Label labelText = new Label(text);
        labelText.getStyleClass().add("welcome-action-text");

        /* -----------------------------------------
           TEXTO DO ATALHO
        ----------------------------------------- */

        Label labelShortcut = new Label(shortcut);
        labelShortcut.getStyleClass().add("welcome-action-shortcut");

        /* -----------------------------------------
           ADICIONA TEXTO + ATALHO NO BOTÃƒO
        ----------------------------------------- */

        button.getChildren().addAll(labelText, labelShortcut);

        /* -----------------------------------------
           AÃ‡ÃƒO DE CLIQUE
           Executa o Runnable recebido no construtor
        ----------------------------------------- */

        button.setOnMouseClicked(event -> action.run());

        return button;
    }
}

