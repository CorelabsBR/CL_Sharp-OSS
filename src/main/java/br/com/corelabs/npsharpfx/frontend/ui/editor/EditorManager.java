package br.com.corelabs.npsharpfx.frontend.ui.editor;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;

import org.fxmisc.richtext.CodeArea;
import org.fxmisc.richtext.model.StyleSpans;

import br.com.corelabs.npsharpfx.backend.engine.editor.SyntaxHighlighter;
import br.com.corelabs.npsharpfx.backend.models.WorkspaceSearchResult;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.IndexRange;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.StackPane;
import javafx.stage.FileChooser;
import javafx.stage.Stage;

/*
========================================================
EDITOR MANAGER
Gerenciador central dos editores/abas da aplicaÃ§Ã£o
========================================================

Responsabilidades:

- Criar novas abas
- Abrir arquivos em abas
- Salvar / salvar como / salvar todos
- Controlar abas sujas (dirty state)
- Fechar abas com confirmaÃ§Ã£o
- Mostrar tela inicial quando nÃ£o hÃ¡ abas
- Controlar arquivos recentes
- Atualizar status do editor
- Detectar linguagem e fim de linha
- Executar aÃ§Ãµes bÃ¡sicas de ediÃ§Ã£o
- Duplicar e deletar linha atual

Arquitetura:

EditorManager
 â”œ TabPane                  -> container visual das abas
 â”œ WelcomePane              -> tela inicial quando nÃ£o hÃ¡ arquivo
 â”œ openTabs                 -> mapa arquivo -> aba
 â”œ tabFiles                 -> mapa aba -> arquivo
 â”œ tabDirtyState            -> mapa aba -> alterado ou nÃ£o
 â”œ tabEditors               -> mapa aba -> TextArea
 â”œ tabSuggestedExtensions   -> extensÃ£o sugerida por aba
 â”œ tabInitialContent        -> conteÃºdo base para comparar dirty
 â”œ tabLineEndings           -> LF / CRLF por aba
 â”” recentFiles              -> lista de arquivos recentes
========================================================
*/

public class EditorManager {

    /* =========================================
       LIMITE DE ARQUIVOS RECENTES
    ========================================= */

    private static final int MAX_RECENT_FILES = 20;

    /* =========================================
       REFERÃŠNCIAS PRINCIPAIS
    ========================================= */

    private final Stage stage;
    private final Consumer<String> statusUpdater;

    /* =========================================
       COMPONENTES VISUAIS PRINCIPAIS
    ========================================= */

    private final TabPane tabPane;
    private final StackPane view;
    private final WelcomePane welcomePane;

    /* =========================================
       ESTRUTURAS DE CONTROLE DAS ABAS
    ========================================= */

    // caminho absoluto do arquivo -> aba aberta
    private final Map<String, Tab> openTabs = new HashMap<>();

    // aba -> arquivo associado
    private final Map<Tab, File> tabFiles = new HashMap<>();

    // aba -> se estÃ¡ modificada
    private final Map<Tab, Boolean> tabDirtyState = new HashMap<>();

    // aba -> editor visual
    private final Map<Tab, CodeArea> tabEditors = new HashMap<>();

    // aba -> extensÃ£o sugerida (ex: java, txt, js)
    private final Map<Tab, String> tabSuggestedExtensions = new HashMap<>();

    // aba -> conteÃºdo inicial/base para comparar dirty state
    private final Map<Tab, String> tabInitialContent = new HashMap<>();

    // aba -> tipo de quebra de linha (LF / CRLF)
    private final Map<Tab, String> tabLineEndings = new HashMap<>();

    /* =========================================
       LISTA DE ARQUIVOS RECENTES
    ========================================= */

    private final List<File> recentFiles = new ArrayList<>();

    /* =========================================
       CONTADOR PARA NOMES DE ARQUIVOS SEM NOME
    ========================================= */

    private int untitledCounter = 1;

    /* =========================================
       CONSTRUTOR
    ========================================= */

    public EditorManager(Stage stage, Consumer<String> statusUpdater) {
        this.stage = stage;
        this.statusUpdater = statusUpdater;

        // cria o container de abas
        this.tabPane = new TabPane();
        this.tabPane.getStyleClass().add("editor-tabs");
        this.tabPane.setTabClosingPolicy(TabPane.TabClosingPolicy.ALL_TABS);

        // sempre que muda a aba selecionada, atualiza status
        this.tabPane.getSelectionModel().selectedItemProperty().addListener((obs, oldTab, newTab) -> {
            refreshStatusFromSelectedTab();
        });

        // tela inicial mostrada quando nÃ£o hÃ¡ abas
        this.welcomePane = new WelcomePane(
                this::newTab,
                this::openFileFromDialog
        );

        // view final: abas + welcome pane em camadas
        this.view = new StackPane(tabPane, welcomePane);
        this.view.getStyleClass().add("editor-area");

        updateWelcomeVisibility();
    }

    /* =========================================
       RETORNA VIEW PRINCIPAL DO EDITOR
    ========================================= */

    public Node getView() {
        return view;
    }

    /* =========================================
       RETORNA O TABPANE
       Ãštil para foco e integraÃ§Ãµes externas
    ========================================= */

    public TabPane getTabPane() {
        return tabPane;
    }

    /* =========================================
       RETORNA CÃ“PIA IMUTÃVEL DOS RECENTES
    ========================================= */

    public List<File> getRecentFiles() {
        return List.copyOf(recentFiles);
    }

    /* =========================================
       CRIA NOVA ABA SEM NOME
    ========================================= */

    public void newTab() {
        createUntitledTab(nextUntitledName(), "", null);
        updateStatus("Novo arquivo");
    }

    /* =========================================
       CRIA NOVO ARQUIVO TEXTO
    ========================================= */

    public void newTextFile() {
        createUntitledTab(nextUntitledName() + ".txt", "", "txt");
        updateStatus("Novo arquivo de texto");
    }

    /* =========================================
       CRIA NOVO ARQUIVO COM EXTENSÃƒO ESPECÃFICA
       Ex: java, js, md, html
    ========================================= */

    public void newFileWithExtension(String extension) {
        String ext = normalizeExtension(extension);

        if (ext.isBlank()) {
            newTab();
            return;
        }

        createUntitledTab(nextUntitledName() + "." + ext, "", ext);
        updateStatus("Novo arquivo ." + ext);
    }

    /* =========================================
       ABRE SELETOR DE ARQUIVO
    ========================================= */

    public void openFileFromDialog() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Open File");

        File file = chooser.showOpenDialog(stage);
        if (file != null) {
            openFileInTab(file);
        }
    }

    /* =========================================
       ABRE ARQUIVO RECENTE
       Valida antes se ele ainda existe
    ========================================= */

    public void openRecentFile(File file) {
        if (file == null) {
            updateStatus("Arquivo recente invÃ¡lido");
            return;
        }

        if (!file.exists() || !file.isFile()) {
            recentFiles.removeIf(f -> sameFile(f, file));
            updateStatus("Arquivo recente nÃ£o existe mais");
            return;
        }

        openFileInTab(file);
    }

    /* =========================================
       ABRE ARQUIVO EM UMA ABA
       Se jÃ¡ estiver aberto, sÃ³ seleciona
    ========================================= */

    public void openFileInTab(File file) {
        if (file == null || !file.exists() || !file.isFile()) {
            updateStatus("Arquivo invÃ¡lido");
            return;
        }

        try {
            String path = file.getAbsolutePath();

            // se jÃ¡ estiver aberto, sÃ³ foca na aba
            if (openTabs.containsKey(path)) {
                Tab existingTab = openTabs.get(path);
                tabPane.getSelectionModel().select(existingTab);

                updateWelcomeVisibility();
                updateStatus("Arquivo jÃ¡ aberto: " + file.getName());
                addRecentFile(file);
                refreshStatusFromSelectedTab();
                return;
            }

            // lÃª conteÃºdo do arquivo
            String content = Files.readString(file.toPath());

            // detecta tipo de quebra de linha
            String lineEnding = detectLineEnding(content);

            // cria aba com editor
            Tab tab = createEditorTab(file.getName(), content, file, true, null, lineEnding);

            tabPane.getTabs().add(tab);
            tabPane.getSelectionModel().select(tab);

            // registra estruturas de controle
            openTabs.put(path, tab);
            tabDirtyState.put(tab, false);
            tabInitialContent.put(tab, content);
            tabLineEndings.put(tab, lineEnding);

            updateTabTitle(tab);

            updateWelcomeVisibility();
            addRecentFile(file);
            updateStatus("Arquivo aberto: " + file.getName());
            refreshStatusFromSelectedTab();

        } catch (IOException e) {
            updateStatus("Erro ao abrir arquivo");
        }
    }

    /* =========================================
       SALVA O ARQUIVO DA ABA ATUAL
       Se ainda nÃ£o tiver arquivo associado,
       chama "Salvar Como"
    ========================================= */

    public void saveCurrentFile() {
        Tab selectedTab = getSelectedEditableTab();
        if (selectedTab == null) {
            return;
        }

        CodeArea editor = tabEditors.get(selectedTab);
        File file = tabFiles.get(selectedTab);

        if (file == null) {
            saveCurrentFileAs();
            return;
        }

        writeTabToFile(selectedTab, editor, file);
    }

    /* =========================================
       SALVAR COMO...
       Permite escolher local/nome do arquivo
    ========================================= */

    public void saveCurrentFileAs() {
        Tab selectedTab = getSelectedEditableTab();
        if (selectedTab == null) {
            return;
        }

        CodeArea editor = tabEditors.get(selectedTab);

        FileChooser chooser = new FileChooser();
        chooser.setTitle("Salvar Arquivo");

        File currentFile = tabFiles.get(selectedTab);

        // define nome sugerido
        if (currentFile != null) {
            chooser.setInitialFileName(currentFile.getName());
        } else {
            chooser.setInitialFileName(buildSuggestedFileName(selectedTab));
        }

        File file = chooser.showSaveDialog(stage);
        if (file == null) {
            updateStatus("Salvar cancelado");
            return;
        }

        // remove associaÃ§Ã£o antiga, se havia
        File oldFile = tabFiles.get(selectedTab);
        if (oldFile != null) {
            openTabs.remove(oldFile.getAbsolutePath());
        }

        // associa novo arquivo
        tabFiles.put(selectedTab, file);
        openTabs.put(file.getAbsolutePath(), selectedTab);

        // guarda extensÃ£o sugerida
        String ext = getExtension(file.getName());
        if (!ext.isBlank()) {
            tabSuggestedExtensions.put(selectedTab, ext);
        }

        writeTabToFile(selectedTab, editor, file);
    }

    /* =========================================
       SALVA TODAS AS ABAS MODIFICADAS
    ========================================= */

    public void saveAll() {
        int saved = 0;

        for (Tab tab : new ArrayList<>(tabPane.getTabs())) {

            // ignora abas nÃ£o editÃ¡veis
            if (!tabEditors.containsKey(tab)) {
                continue;
            }

            // ignora abas nÃ£o modificadas
            if (!Boolean.TRUE.equals(tabDirtyState.get(tab))) {
                continue;
            }

            CodeArea editor = tabEditors.get(tab);
            File file = tabFiles.get(tab);

            // se nÃ£o tiver arquivo, pede salvar como
            if (file == null) {
                tabPane.getSelectionModel().select(tab);
                saveCurrentFileAs();

                if (!Boolean.TRUE.equals(tabDirtyState.get(tab))) {
                    saved++;
                }
            } else {
                writeTabToFile(tab, editor, file);
                saved++;
            }
        }

        refreshStatusFromSelectedTab();
        updateStatus(saved > 0 ? ("Arquivos salvos: " + saved) : "Nada para salvar");
    }

    /* =========================================
       RETORNA TODAS AS ABAS DO EDITOR
       Ãštil para bÃºsca entre todas as abas
    ========================================= */

    public List<Tab> getAllTabs() {
        return new ArrayList<>(tabPane.getTabs());
    }

    /* =========================================
       RETORNA O CONTEÃšDO DE TEXTO DE UMA ABA
    ========================================= */

    public String getTabContent(Tab tab) {
        if (tab == null) {
            return null;
        }

        CodeArea editor = tabEditors.get(tab);
        if (editor == null) {
            return null;
        }

        return editor.getText();
    }

    /* =========================================
       SELECIONA UMA ABA ESPECÃFICA
    ========================================= */

    public void selectTab(Tab tab) {
        if (tab != null && tabPane.getTabs().contains(tab)) {
            tabPane.getSelectionModel().select(tab);
        }
    }

    /* =========================================
       NAVEGA PARA UMA POSIÃ‡ÃƒO NO EDITOR
       Usada para ir a resultados de busca
    ========================================= */

    public void goToPosition(Tab tab, int line, int column) {
        if (tab == null) {
            return;
        }

        selectTab(tab);

        CodeArea editor = tabEditors.get(tab);
        if (editor == null) {
            return;
        }

        String text = editor.getText();
        if (text == null) {
            return;
        }

        editor.requestFocus();

        // converte linha/coluna para posiÃ§Ã£o absoluta
        int position = convertLineColumnToPosition(text, line, column);

        if (position >= 0 && position <= text.length()) {
            editor.moveTo(position);
        }

        refreshStatusFromSelectedTab();
    }

    /* =========================================
       CONVERTE LINHA/COLUNA PARA POSIÃ‡ÃƒO ABSOLUTA
    ========================================= */

    private int convertLineColumnToPosition(String text, int targetLine, int targetColumn) {
        int currentLine = 1;
        int position = 0;

        for (int i = 0; i < text.length(); i++) {
            if (currentLine == targetLine) {
                // estamos na linha correta, pula para a coluna
                return position + Math.min(targetColumn - 1, text.length() - i);
            }

            if (text.charAt(i) == '\n') {
                currentLine++;
                position = i + 1;
            }
        }

        // se chegou aqui e estÃ¡ na linha correta, retorna
        if (currentLine == targetLine) {
            return position + Math.min(targetColumn - 1, text.length() - position);
        }

        return -1;
    }

    /* =========================================
       REVERTE A ABA ATUAL
       Se for arquivo salvo, relÃª do disco
       Se for sem nome, limpa conteÃºdo
    ========================================= */

    public void revertCurrentFile() {
        Tab selectedTab = getSelectedEditableTab();
        if (selectedTab == null) {
            return;
        }

        File file = tabFiles.get(selectedTab);
        CodeArea editor = tabEditors.get(selectedTab);

        // aba sem arquivo fÃ­sico
        if (file == null) {
            editor.replaceText("");
            tabDirtyState.put(selectedTab, false);
            tabInitialContent.put(selectedTab, "");
            tabLineEndings.put(selectedTab, "LF");

            updateTabTitle(selectedTab);
            updateStatus("Arquivo sem nome revertido");
            refreshStatusFromSelectedTab();
            return;
        }

        try {
            String content = Files.readString(file.toPath());

            editor.replaceText(content);
            tabDirtyState.put(selectedTab, false);
            tabInitialContent.put(selectedTab, content);
            tabLineEndings.put(selectedTab, detectLineEnding(content));

            updateTabTitle(selectedTab);
            updateStatus("Arquivo revertido: " + file.getName());
            refreshStatusFromSelectedTab();

        } catch (IOException e) {
            updateStatus("Erro ao reverter arquivo");
        }
    }

    /* =========================================
       FECHA A ABA ATUAL
    ========================================= */

    public void closeCurrentTab() {
        Tab selectedTab = tabPane.getSelectionModel().getSelectedItem();

        if (selectedTab == null) {
            updateStatus("Nenhuma aba selecionada");
            return;
        }

        requestCloseTab(selectedTab);
    }

    /* =========================================
       FECHA TODAS AS ABAS MENOS A ATUAL
    ========================================= */

    public void closeOtherTabs() {
        Tab selectedTab = tabPane.getSelectionModel().getSelectedItem();

        if (selectedTab == null) {
            updateStatus("Nenhuma aba selecionada");
            return;
        }

        List<Tab> tabsToClose = new ArrayList<>(tabPane.getTabs());
        tabsToClose.remove(selectedTab);

        for (Tab tab : tabsToClose) {
            if (!requestCloseTab(tab)) {
                updateStatus("Fechamento cancelado");
                return;
            }
        }

        tabPane.getSelectionModel().select(selectedTab);
        refreshStatusFromSelectedTab();
        updateStatus("Outras abas fechadas");
    }

    /* =========================================
       FECHA TODAS AS ABAS
    ========================================= */

    public void closeAllTabs() {
        List<Tab> tabs = new ArrayList<>(tabPane.getTabs());

        for (Tab tab : tabs) {
            if (!requestCloseTab(tab)) {
                updateStatus("Fechamento cancelado");
                return;
            }
        }

        updateStatus("Todas as abas foram fechadas");
    }

    /* =========================================
       AÃ‡Ã•ES BÃSICAS DE EDIÃ‡ÃƒO
    ========================================= */

    public void undo() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.undo();
            refreshStatusFromSelectedTab();
        }
    }

    public void redo() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.redo();
            refreshStatusFromSelectedTab();
        }
    }

    public void copy() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.copy();
            refreshStatusFromSelectedTab();
        }
    }

    public void cut() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.cut();
            refreshStatusFromSelectedTab();
        }
    }

    public void paste() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.paste();
            refreshStatusFromSelectedTab();
        }
    }

    public void selectAll() {
        CodeArea editor = getSelectedEditor();
        if (editor != null) {
            editor.selectAll();
            refreshStatusFromSelectedTab();
        }
    }

    /* =========================================
       DUPLICA A LINHA ATUAL
    ========================================= */

    public void duplicateCurrentLine() {
        CodeArea editor = getSelectedEditor();
        if (editor == null) {
            return;
        }

        String text = editor.getText();
        int caret = editor.getCaretPosition();

        int lineStart = findLineStart(text, caret);
        int lineEnd = findLineEnd(text, caret);

        String line = text.substring(lineStart, lineEnd);
        String insertion = line;

        // se a linha jÃ¡ termina com \n, duplica mantendo estrutura
        if (lineEnd < text.length() && text.charAt(lineEnd) == '\n') {
            insertion += "\n";
            lineEnd++;
        } else if (!line.isEmpty()) {
            // se nÃ£o tem quebra no fim, insere quebra + linha
            insertion = System.lineSeparator() + line;
        }

        editor.insertText(lineEnd, insertion);
        editor.moveTo(lineEnd + insertion.length());

        refreshStatusFromSelectedTab();
    }

    /* =========================================
       DELETA A LINHA ATUAL
    ========================================= */

    public void deleteCurrentLine() {
        CodeArea editor = getSelectedEditor();
        if (editor == null) {
            return;
        }

        String text = editor.getText();
        if (text.isEmpty()) {
            return;
        }

        int caret = editor.getCaretPosition();

        int lineStart = findLineStart(text, caret);
        int lineEnd = findLineEnd(text, caret);

        // inclui a quebra de linha final, se existir
        if (lineEnd < text.length() && text.charAt(lineEnd) == '\n') {
            lineEnd++;
        } else if (lineStart > 0) {
            // se estÃ¡ na Ãºltima linha sem \n, tambÃ©m remove quebra anterior
            lineStart = Math.max(0, lineStart - 1);
        }

        editor.deleteText(lineStart, lineEnd);
        editor.moveTo(Math.min(lineStart, editor.getLength()));

        refreshStatusFromSelectedTab();
    }

    /* =========================================
       CRIA UMA ABA "SEM NOME"
    ========================================= */

    private void createUntitledTab(String title, String content, String suggestedExtension) {
        Tab tab = createEditorTab(title, content, null, true, suggestedExtension, "LF");

        tabPane.getTabs().add(tab);
        tabPane.getSelectionModel().select(tab);

        tabDirtyState.put(tab, false);
        tabInitialContent.put(tab, content);
        tabLineEndings.put(tab, "LF");

        updateTabTitle(tab);
        updateWelcomeVisibility();
        refreshStatusFromSelectedTab();
    }

    /* =========================================
       CRIA UMA ABA DE EDIÃ‡ÃƒO COMPLETA
       Aqui nasce o editor real da aba
    ========================================= */

    private Tab createEditorTab(
            String title,
            String content,
            File file,
            boolean closable,
            String suggestedExtension,
            String lineEnding
    ) {
        // cria editor base (RichTextFX CodeArea)
        CodeArea editor = new CodeArea();
        editor.getStyleClass().add("editor-textarea");
        editor.setWrapText(false);

        // remove o background branco hardcoded do GenericStyledArea
        // para que o CSS consiga controlar a cor de fundo
        editor.setBackground(null);

        // cria aba
        Tab tab = new Tab(title);
        tab.setClosable(closable);
        tab.setContent(editor);

        // registra editor
        tabEditors.put(tab, editor);

        // associa arquivo se existir
        if (file != null) {
            tabFiles.put(tab, file);
        }

        // define extensÃ£o sugerida
        if (suggestedExtension != null && !suggestedExtension.isBlank()) {
            tabSuggestedExtensions.put(tab, normalizeExtension(suggestedExtension));
        } else if (file != null) {
            String ext = getExtension(file.getName());
            if (!ext.isBlank()) {
                tabSuggestedExtensions.put(tab, ext);
            }
        }

        tabLineEndings.put(tab, lineEnding);
        tabDirtyState.put(tab, false);

        /* -----------------------------------------
           Listener principal de texto:
           compara conteÃºdo atual com o conteÃºdo
           inicial para saber se a aba estÃ¡ suja
        ----------------------------------------- */
        editor.textProperty().addListener((obs, oldValue, newValue) -> {
            boolean shouldBeDirty = !Objects.equals(tabInitialContent.get(tab), newValue);
            boolean currentDirty = Boolean.TRUE.equals(tabDirtyState.get(tab));

            if (shouldBeDirty != currentDirty) {
                tabDirtyState.put(tab, shouldBeDirty);
                updateTabTitle(tab);
            }

            refreshStatusFromSelectedTab();
        });

        // listeners para atualizar status
        editor.caretPositionProperty().addListener((obs, oldValue, newValue) -> refreshStatusFromSelectedTab());
        editor.addEventFilter(KeyEvent.KEY_RELEASED, event -> refreshStatusFromSelectedTab());
        editor.setOnMouseClicked(event -> refreshStatusFromSelectedTab());

        // define conteÃºdo inicial
        editor.replaceText(content);
        tabInitialContent.put(tab, content);
        tabDirtyState.put(tab, false);
        updateTabTitle(tab);

        // aplica syntax highlighting inicial
        String lang = detectLanguage(tab, title);
        applyHighlighting(editor, lang);

        // re-aplica highlighting com debounce ao editar
        editor.multiPlainChanges()
                .successionEnds(Duration.ofMillis(100))
                .subscribe(ignore -> {
                    String currentLang = detectLanguage(tab, buildSuggestedFileName(tab));
                    applyHighlighting(editor, currentLang);
                });

        // fechamento com confirmaÃ§Ã£o
        tab.setOnCloseRequest(event -> {
            if (!confirmCloseTab(tab)) {
                event.consume();
            }
        });

        // quando a aba fecha de fato, limpa todos os mapas
        tab.setOnClosed(event -> {
            cleanupTab(tab);
            updateWelcomeVisibility();
            refreshStatusFromSelectedTab();
        });

        return tab;
    }

    /* =========================================
       APLICA SYNTAX HIGHLIGHTING NO EDITOR
    ========================================= */

    private void applyHighlighting(CodeArea editor, String language) {
        try {
            String text = editor.getText();
            StyleSpans<Collection<String>> spans = SyntaxHighlighter.computeHighlighting(text, language);
            if (spans != null) {
                editor.setStyleSpans(0, spans);
            }
        } catch (Exception ignored) {
            // ignora erros de highlighting para nÃ£o afetar ediÃ§Ã£o
        }
    }
    
    /* =========================================
   ABRE RESULTADO DE BUSCA DO WORKSPACE
   Usado pelo SearchPane
========================================= */

public void openWorkspaceSearchResult(WorkspaceSearchResult result) {

    if (result == null || result.getFile() == null) {
        return;
    }

    File file = result.getFile().toFile();

    // abre o arquivo se ainda nÃ£o estiver aberto
    openFileInTab(file);

    Tab selectedTab = tabPane.getSelectionModel().getSelectedItem();

    if (selectedTab == null) {
        return;
    }

    CodeArea editor = tabEditors.get(selectedTab);

    if (editor == null) {
        return;
    }

    editor.requestFocus();

    int start = result.getStartOffset();
    int end = result.getEndOffset();

    if (start >= 0 && end >= start && end <= editor.getLength()) {
        editor.selectRange(start, end);
        editor.moveTo(end);
    }

    refreshStatusFromSelectedTab();
}
    /* =========================================
       ESCREVE O CONTEÃšDO DA ABA EM DISCO
    ========================================= */

    private void writeTabToFile(Tab tab, CodeArea editor, File file) {
        try {
            String text = editor.getText();

            // reaplica o tipo original de quebra de linha
            String normalized = applyStoredLineEnding(text, tabLineEndings.getOrDefault(tab, "LF"));

            Files.writeString(file.toPath(), normalized);

            // apÃ³s salvar, conteÃºdo atual vira conteÃºdo base
            tabDirtyState.put(tab, false);
            tabInitialContent.put(tab, normalized);
            tabLineEndings.put(tab, detectLineEnding(normalized));

            String ext = getExtension(file.getName());
            if (!ext.isBlank()) {
                tabSuggestedExtensions.put(tab, ext);
            }

            updateTabTitle(tab);
            addRecentFile(file);

            updateStatus("Arquivo salvo: " + file.getName());
            refreshStatusFromSelectedTab();

        } catch (IOException e) {
            updateStatus("Erro ao salvar arquivo");
        }
    }

    /* =========================================
       ADICIONA ARQUIVO Ã€ LISTA DE RECENTES
       Move para o topo se jÃ¡ existir
    ========================================= */

    private void addRecentFile(File file) {
        if (file == null) {
            return;
        }

        recentFiles.removeIf(f -> sameFile(f, file));
        recentFiles.add(0, file);

        if (recentFiles.size() > MAX_RECENT_FILES) {
            recentFiles.remove(recentFiles.size() - 1);
        }
    }

    /* =========================================
       MONTA NOME SUGERIDO PARA "SALVAR COMO"
    ========================================= */

    private String buildSuggestedFileName(Tab tab) {
        File file = tabFiles.get(tab);
        if (file != null) {
            return file.getName();
        }

        String currentTitle = tab.getText();
        if (currentTitle == null || currentTitle.isBlank()) {
            currentTitle = "untitled";
        }

        // remove prefixos visuais de dirty
        if (currentTitle.startsWith("â— ")) {
            currentTitle = currentTitle.substring(2);
        }
        if (currentTitle.startsWith("*")) {
            currentTitle = currentTitle.substring(1);
        }

        String extension = tabSuggestedExtensions.get(tab);
        if (extension == null || extension.isBlank()) {
            return currentTitle;
        }

        String lowerTitle = currentTitle.toLowerCase(Locale.ROOT);
        String suffix = "." + extension.toLowerCase(Locale.ROOT);

        if (lowerTitle.endsWith(suffix)) {
            return currentTitle;
        }

        return currentTitle + suffix;
    }

    /* =========================================
       NORMALIZA EXTENSÃƒO
       remove pontos e forÃ§a minÃºsculo
    ========================================= */

    private String normalizeExtension(String extension) {
        if (extension == null) {
            return "";
        }

        String ext = extension.trim().toLowerCase(Locale.ROOT);

        while (ext.startsWith(".")) {
            ext = ext.substring(1);
        }

        return ext;
    }

    /* =========================================
       EXTRAI EXTENSÃƒO DO NOME DO ARQUIVO
    ========================================= */

    private String getExtension(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "";
        }

        int idx = fileName.lastIndexOf('.');
        if (idx < 0 || idx == fileName.length() - 1) {
            return "";
        }

        return normalizeExtension(fileName.substring(idx + 1));
    }

    /* =========================================
       GERA O PRÃ“XIMO NOME UNTITLED
    ========================================= */

    private String nextUntitledName() {
        return "untitled-" + untitledCounter++;
    }

    /* =========================================
       RETORNA A ABA ATUAL SE ELA FOR EDITÃVEL
    ========================================= */

    private Tab getSelectedEditableTab() {
        Tab selectedTab = tabPane.getSelectionModel().getSelectedItem();

        if (selectedTab == null) {
            updateStatus("Nenhuma aba selecionada");
            return null;
        }

        if (!tabEditors.containsKey(selectedTab)) {
            updateStatus("Esta aba nÃ£o Ã© editÃ¡vel");
            return null;
        }

        return selectedTab;
    }

    /* =========================================
       RETORNA O EDITOR DA ABA SELECIONADA
    ========================================= */

    private CodeArea getSelectedEditor() {
        Tab selectedTab = getSelectedEditableTab();
        if (selectedTab == null) {
            return null;
        }
        return tabEditors.get(selectedTab);
    }

    /* =========================================
       PEDE FECHAMENTO DE UMA ABA
       SÃ³ fecha se a confirmaÃ§Ã£o permitir
    ========================================= */

    private boolean requestCloseTab(Tab tab) {
        if (tab == null) {
            return true;
        }

        if (!confirmCloseTab(tab)) {
            return false;
        }

        cleanupTab(tab);
        tabPane.getTabs().remove(tab);

        updateWelcomeVisibility();
        refreshStatusFromSelectedTab();
        return true;
    }

    /* =========================================
       CONFIRMA FECHAMENTO DE ABA SUJA
       OpÃ§Ãµes:
       - Salvar
       - Descartar
       - Cancelar
    ========================================= */

    private boolean confirmCloseTab(Tab tab) {
        if (!Boolean.TRUE.equals(tabDirtyState.get(tab))) {
            return true;
        }

        String name = buildSuggestedFileName(tab);

        ButtonType saveButton = new ButtonType("Salvar");
        ButtonType discardButton = new ButtonType("Descartar");
        ButtonType cancelButton = new ButtonType("Cancelar", ButtonBar.ButtonData.CANCEL_CLOSE);

        Alert alert = new Alert(Alert.AlertType.WARNING);
        alert.initOwner(stage);
        alert.setTitle("AlteraÃ§Ãµes nÃ£o salvas");
        alert.setHeaderText("Deseja salvar antes de fechar?");
        alert.setContentText("O arquivo \"" + name + "\" possui alteraÃ§Ãµes nÃ£o salvas.");
        alert.getButtonTypes().setAll(saveButton, discardButton, cancelButton);

        Optional<ButtonType> result = alert.showAndWait();

        if (result.isEmpty() || result.get() == cancelButton) {
            return false;
        }

        if (result.get() == saveButton) {
            tabPane.getSelectionModel().select(tab);

            File file = tabFiles.get(tab);
            if (file == null) {
                saveCurrentFileAs();
            } else {
                writeTabToFile(tab, tabEditors.get(tab), file);
            }

            // sÃ³ permite fechar se deixou de estar dirty
            return !Boolean.TRUE.equals(tabDirtyState.get(tab));
        }

        // descarte
        return true;
    }

    /* =========================================
       LIMPA TODOS OS REGISTROS DA ABA
    ========================================= */

    private void cleanupTab(Tab tab) {
        File associatedFile = tabFiles.remove(tab);

        tabDirtyState.remove(tab);
        tabEditors.remove(tab);
        tabSuggestedExtensions.remove(tab);
        tabInitialContent.remove(tab);
        tabLineEndings.remove(tab);

        if (associatedFile != null) {
            openTabs.remove(associatedFile.getAbsolutePath());
        }
    }

    /* =========================================
       MOSTRA/OCULTA WELCOME PANE
       Se nÃ£o houver abas, mostra tela inicial
    ========================================= */

    private void updateWelcomeVisibility() {
        boolean hasEditorTabs = !tabPane.getTabs().isEmpty();

        welcomePane.setVisible(!hasEditorTabs);
        welcomePane.setManaged(!hasEditorTabs);

        tabPane.setVisible(hasEditorTabs);
        tabPane.setManaged(hasEditorTabs);

        if (!hasEditorTabs) {
            updateStatus("Tela inicial");
        }
    }

    /* =========================================
       ATUALIZA O TÃTULO DA ABA
       Coloca indicador de dirty: â—
    ========================================= */

    private void updateTabTitle(Tab tab) {
        File file = tabFiles.get(tab);
        boolean dirty = Boolean.TRUE.equals(tabDirtyState.get(tab));

        String baseName;

        if (file != null) {
            baseName = file.getName();
        } else {
            String text = tab.getText();

            if (text == null || text.isBlank()) {
                baseName = "untitled";
            } else {
                if (text.startsWith("â— ")) {
                    text = text.substring(2);
                }
                if (text.startsWith("*")) {
                    text = text.substring(1);
                }
                baseName = text;
            }
        }

        tab.setText(dirty ? "â— " + baseName : baseName);
    }

    /* =========================================
       RECONSTRÃ“I TEXTO DE STATUS DA ABA ATUAL
       Mostra:
       - encoding
       - linguagem
       - fim de linha
       - linha/coluna
       - seleÃ§Ã£o
       - nome
       - salvo/modificado
    ========================================= */

    private void refreshStatusFromSelectedTab() {
        Tab selectedTab = tabPane.getSelectionModel().getSelectedItem();

        if (selectedTab == null) {
            if (tabPane.getTabs().isEmpty()) {
                updateStatus("Tela inicial");
            } else {
                updateStatus("Sem arquivo");
            }
            return;
        }

        if (!tabEditors.containsKey(selectedTab)) {
            updateStatus("Tela inicial");
            return;
        }

        CodeArea editor = tabEditors.get(selectedTab);
        File file = tabFiles.get(selectedTab);

        String fileName = (file != null) ? file.getName() : buildSuggestedFileName(selectedTab);
        boolean dirty = Boolean.TRUE.equals(tabDirtyState.get(selectedTab));

        int caret = editor.getCaretPosition();
        int line = getLineNumber(editor.getText(), caret);
        int column = getColumnNumber(editor.getText(), caret);

        IndexRange selection = editor.getSelection();
        int selectedChars = Math.max(0, selection.getLength());

        String language = detectLanguage(selectedTab, fileName);
        String lineEnding = tabLineEndings.getOrDefault(selectedTab, "LF");

        String status = "UTF-8"
                + "    " + language
                + "    " + lineEnding
                + "    Ln " + line + ", Col " + column
                + (selectedChars > 0 ? ("    Sel " + selectedChars) : "")
                + "    " + fileName
                + "    " + (dirty ? "modificado" : "salvo");

        updateStatus(status);
    }

    /* =========================================
       CALCULA NÃšMERO DA LINHA PELO CARET
    ========================================= */

    private int getLineNumber(String text, int caret) {
        int line = 1;
        int max = Math.min(caret, text.length());

        for (int i = 0; i < max; i++) {
            if (text.charAt(i) == '\n') {
                line++;
            }
        }

        return line;
    }

    /* =========================================
       CALCULA COLUNA ATUAL PELO CARET
    ========================================= */

    private int getColumnNumber(String text, int caret) {
        int max = Math.min(caret, text.length());
        int lastBreak = -1;

        for (int i = 0; i < max; i++) {
            if (text.charAt(i) == '\n') {
                lastBreak = i;
            }
        }

        return max - lastBreak;
    }

    /* =========================================
       DETECTA LINGUAGEM COM BASE NA EXTENSÃƒO
    ========================================= */

    private String detectLanguage(Tab tab, String fileName) {

    String ext = tabSuggestedExtensions.get(tab);

    if (ext == null || ext.isBlank()) {
        ext = getExtension(fileName);
    }

    if (ext != null && !ext.isBlank()) {
        return switch (ext.toLowerCase(Locale.ROOT)) {

            case "java" -> "Java";
            case "kt" -> "Kotlin";

            case "js", "mjs", "cjs" -> "JavaScript";
            case "ts" -> "TypeScript";

            case "json" -> "JSON";

            case "html", "htm" -> "HTML";
            case "css" -> "CSS";
            case "scss" -> "SCSS";

            case "xml" -> "XML";

            case "md" -> "Markdown";

            case "txt", "log", "conf", "cfg", "ini" -> "Plain Text";

            case "sql" -> "SQL";

            case "yml", "yaml" -> "YAML";

            case "properties" -> "Properties";

            case "sh", "bash", "zsh" -> "Shell Script";

            case "bat", "cmd" -> "Batch";

            case "ps1" -> "PowerShell";

            case "c" -> "C";

            case "cpp", "cc", "cxx", "hpp", "h" -> "C++";

            case "cs" -> "C#";

            case "py" -> "Python";

            case "php" -> "PHP";

            case "go" -> "Go";

            case "rs" -> "Rust";

            case "lua" -> "Lua";

            case "toml" -> "TOML";

            case "dockerfile" -> "Docker";

            default -> "Plain Text";
        };
    }

    CodeArea editor = tabEditors.get(tab);

    if (editor == null) {
        return "Plain Text";
    }

    String text = editor.getText();

    if (text == null || text.isBlank()) {
        return "Plain Text";
    }

    String firstLine = text.lines().findFirst().orElse("").trim();

    if (firstLine.startsWith("#!/")) {

        String lower = firstLine.toLowerCase(Locale.ROOT);

        if (lower.contains("python")) {
            return "Python";
        }

        if (lower.contains("bash")
                || lower.contains("sh")
                || lower.contains("zsh")) {
            return "Shell Script";
        }

        if (lower.contains("node")) {
            return "JavaScript";
        }

        if (lower.contains("php")) {
            return "PHP";
        }
    }

    return detectLanguageFromContent(text);
}
    /* =========================================
       DETECTA TIPO DE QUEBRA DE LINHA
       CRLF -> Windows
       LF   -> Unix/Linux
    ========================================= */

    private String detectLineEnding(String content) {
        if (content.contains("\r\n")) {
            return "CRLF";
        }
        if (content.contains("\n")) {
            return "LF";
        }
        return "LF";
    }

    /* =========================================
       REAPLICA O TIPO DE QUEBRA DE LINHA
       ANTES DE SALVAR
    ========================================= */

    private String applyStoredLineEnding(String text, String lineEnding) {
        String normalized = text.replace("\r\n", "\n").replace("\r", "\n");

        if ("CRLF".equalsIgnoreCase(lineEnding)) {
            return normalized.replace("\n", "\r\n");
        }

        return normalized;
    }

    /* =========================================
       ENCONTRA INÃCIO DA LINHA PELO CARET
    ========================================= */

    private int findLineStart(String text, int caret) {
        int pos = Math.min(caret, text.length());

        while (pos > 0 && text.charAt(pos - 1) != '\n') {
            pos--;
        }

        return pos;
    }

    /* =========================================
       ENCONTRA FIM DA LINHA PELO CARET
    ========================================= */

    private int findLineEnd(String text, int caret) {
        int pos = Math.min(caret, text.length());

        while (pos < text.length() && text.charAt(pos) != '\n') {
            pos++;
        }

        return pos;
    }

    /* =========================================
       COMPARA DOIS ARQUIVOS PELO CAMINHO
    ========================================= */

    private boolean sameFile(File a, File b) {
        if (a == null || b == null) {
            return false;
        }

        return a.getAbsolutePath().equalsIgnoreCase(b.getAbsolutePath());
    }

    /* =========================================
       ENVIA STATUS PARA FORA
    ========================================= */

    private void updateStatus(String text) {
        if (statusUpdater != null) {
            statusUpdater.accept(text);
        }
    }
    private String detectLanguageFromContent(String text) {

    String lower = text.toLowerCase(Locale.ROOT);

    if (lower.contains("public class")
            || lower.contains("system.out.println")) {
        return "Java";
    }

    if (lower.contains("fun main(")
            || lower.contains("val ")
            || lower.contains("var ")) {
        return "Kotlin";
    }

    if (lower.contains("console.log")
            || lower.contains("function ")
            || lower.contains("=>")) {
        return "JavaScript";
    }

    if (lower.contains("import react")
            || lower.contains("export default")) {
        return "JavaScript";
    }

    if (lower.contains("def ")
            || lower.contains("print(")
            || lower.contains("import os")) {
        return "Python";
    }

    if (lower.contains("<?php")) {
        return "PHP";
    }

    if (lower.contains("#include")) {
        return "C++";
    }

    if (lower.contains("fn main(")
            || lower.contains("println!")) {
        return "Rust";
    }

    if (lower.contains("<html")
            || lower.contains("<body")) {
        return "HTML";
    }

    if (lower.contains("{")
            && lower.contains("}")
            && lower.contains(":")) {

        try {
            text.trim();

            if (text.trim().startsWith("{")
                    || text.trim().startsWith("[")) {
                return "JSON";
            }

        } catch (Exception ignored) {
        }
    }

    return "Plain Text";
}
}

