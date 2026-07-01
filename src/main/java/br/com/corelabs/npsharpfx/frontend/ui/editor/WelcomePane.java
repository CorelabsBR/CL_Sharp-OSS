/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.editor;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
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

    public WelcomePane(Runnable onNewFile, Runnable onOpenFile) {

        // classe CSS principal da tela
        getStyleClass().add("welcome-pane");

        // centraliza tudo no meio
        setAlignment(Pos.CENTER);

        // espaÃ§amento vertical entre elementos
        setSpacing(18);

        /* -----------------------------------------
           LOGO DA TELA INICIAL
        ----------------------------------------- */

        ImageView logo = new ImageView(
                new Image(getClass().getResourceAsStream("/icons/wlclogo.png"))
        );

        logo.setFitWidth(120);
        logo.setFitHeight(120);
        logo.setPreserveRatio(true);
        logo.getStyleClass().add("welcome-logo");

        /* -----------------------------------------
           TÃTULO PRINCIPAL
        ----------------------------------------- */

        Label title = new Label("NPSharp");
        title.getStyleClass().add("welcome-title");

        /* -----------------------------------------
           SUBTÃTULO / SLOGAN
        ----------------------------------------- */

        Label subtitle = new Label("Tecnologia sem limites.");
        subtitle.getStyleClass().add("welcome-subtitle");

        /* -----------------------------------------
           AÃ‡Ã•ES PRINCIPAIS CLICÃVEIS
        ----------------------------------------- */

        // botÃ£o visual para criar novo arquivo
        HBox actionNew = createActionButton("Novo Arquivo", "Ctrl+N", onNewFile);

        // botÃ£o visual para abrir arquivo existente
        HBox actionOpen = createActionButton("Abrir Arquivo", "Ctrl+O", onOpenFile);

        /* -----------------------------------------
           DICA VISUAL ADICIONAL
           NÃ£o Ã© clicÃ¡vel, sÃ³ informativa
        ----------------------------------------- */

        Label actionSave = new Label("Salvar Arquivo    Ctrl+S");
        actionSave.getStyleClass().add("welcome-hint");

        /* -----------------------------------------
           MONTA A ORDEM DOS ELEMENTOS NA TELA
        ----------------------------------------- */

        getChildren().addAll(
                logo,
                title,
                subtitle,
                actionNew,
                actionOpen,
                actionSave
        );
    }

    /* =========================================
       CRIA UM BOTÃƒO VISUAL DE AÃ‡ÃƒO
       Estrutura:
       [ texto da aÃ§Ã£o ]   [ atalho ]
    ========================================= */

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

