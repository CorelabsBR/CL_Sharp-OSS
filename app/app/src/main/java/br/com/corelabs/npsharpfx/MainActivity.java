package br.com.corelabs.npsharpfx;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.Spannable;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ArrayAdapter;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.documentfile.provider.DocumentFile;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import br.com.corelabs.npsharpfx.backend.runtime.AndroidRuntimeManager;
import br.com.corelabs.npsharpfx.backend.runtime.LanguageRuntime;

public class MainActivity extends Activity {

    private static final int REQ_WORKSPACE = 4001;
    private static final String PREFS = "npsharp";
    private static final String PREF_WORKSPACE_URI = "workspace_uri";
    private static final String PREF_CURRENT_FILE_URI = "current_file_uri";
    private static final String PREF_CURSOR = "cursor";
    private static final String PREF_THEME = "theme";
    private static final int DEFAULT_BG = 0xff1e1e1e;
    private static final int DEFAULT_SIDE_BG = 0xff252526;
    private static final int DEFAULT_PANEL_BG = 0xff181818;
    private static final int DEFAULT_TITLE_BG = 0xff2d2d30;
    private static final int DEFAULT_TEXT = 0xffdcdcdc;
    private static final int DEFAULT_MUTED = 0xff969696;
    private static final int DEFAULT_ACCENT = 0xff007acc;

    private int bg = DEFAULT_BG;
    private int sideBg = DEFAULT_SIDE_BG;
    private int panelBg = DEFAULT_PANEL_BG;
    private int titleBg = DEFAULT_TITLE_BG;
    private int text = DEFAULT_TEXT;
    private int muted = DEFAULT_MUTED;
    private int accent = DEFAULT_ACCENT;

    private LinearLayout root;
    private LinearLayout topBar;
    private LinearLayout commandBar;
    private LinearLayout workArea;
    private LinearLayout activityBar;
    private LinearLayout sidePanel;
    private View editorArea;
    private LinearLayout sideContent;
    private LinearLayout tabRow;
    private LinearLayout bottomPanel;
    private EditText editor;
    private TextView lineNumbers;
    private TextView sideTitle;
    private TextView fileTitle;
    private TextView console;
    private ScrollView consoleScroll;
    private EditText terminalInput;
    private LinearLayout statusBarView;
    private TextView statusLeft;
    private TextView statusRight;
    private TextView bottomTitle;
    private LinearLayout.LayoutParams bottomPanelParams;

    private DocumentFile workspace;
    private DocumentFile currentFile;
    private AndroidRuntimeManager runtimeManager;
    private boolean applyingHighlight;
    private boolean programaRodando;
    private boolean compactLayout;
    private boolean bottomExpanded;
    private final LinkedBlockingQueue<String> entradasPrograma = new LinkedBlockingQueue<>();
    private final List<DocumentFile> openFiles = new ArrayList<>();
    private String activePanel = "explorer";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        compactLayout = getResources().getConfiguration().screenWidthDp < 700;
        runtimeManager = new AndroidRuntimeManager(this);
        restoreWorkspace();
        restaurarTema();
        setContentView(buildUi());
        showPanel("explorer");
        if (workspace == null) {
            showNoWorkspace();
        } else {
            restaurarArquivoAtual();
        }
    }

    private View buildUi() {
        root = vertical();
        root.setBackgroundColor(bg);
        root.addView(buildTop(), matchWrap());
        root.addView(buildWorkArea(), new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(buildStatusBar(), new LinearLayout.LayoutParams(-1, dp(compactLayout ? 20 : 24)));
        return root;
    }

    private View buildTop() {
        LinearLayout top = vertical();
        top.setBackgroundColor(titleBg);

        topBar = horizontal();
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(compactLayout ? 2 : 6), dp(2), dp(compactLayout ? 2 : 6), dp(1));
        LinearLayout menu = topBar;
        if (compactLayout) {
            menu.addView(iconButton(R.drawable.ic_np_menu, "Arquivo", v -> menuArquivo()));
            menu.addView(iconButton(R.drawable.ic_np_add_file, "Novo arquivo", v -> novoArquivo()));
            menu.addView(iconButton(R.drawable.ic_np_folder_open, "Abrir workspace", v -> abrirWorkspace()));
            menu.addView(iconButton(R.drawable.ic_np_save, "Salvar", v -> salvarArquivo()));
            menu.addView(iconButton(R.drawable.ic_np_play, "Executar", v -> executarArquivo()));
            menu.addView(iconButton(R.drawable.ic_np_terminal, "Terminal", v -> focarTerminal()));
            TextView compactTitle = label("NPSharp", 12, muted, Typeface.BOLD);
            compactTitle.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
            menu.addView(compactTitle, new LinearLayout.LayoutParams(0, -2, 1));
            menu.addView(iconButton(R.drawable.ic_np_more, "Paleta", v -> paletaComandos()));
            top.addView(menu, matchWrap());
            return top;
        }
        menu.addView(menuButton("Arquivo", v -> menuArquivo()));
        menu.addView(menuButton("Editar", v -> menuEditar()));
        menu.addView(menuButton("Exibir", v -> menuExibir()));
        menu.addView(menuButton("Executar", v -> menuExecutar()));
        menu.addView(menuButton("Terminal", v -> menuTerminal()));
        TextView title = label("NPSharp", 13, muted, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        menu.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        menu.addView(menuButton("Ajuda", v -> mostrarSobre()));

        commandBar = horizontal();
        LinearLayout command = commandBar;
        command.setGravity(Gravity.CENTER_VERTICAL);
        command.setPadding(dp(compactLayout ? 2 : 8), dp(2), dp(compactLayout ? 2 : 8), dp(compactLayout ? 2 : 5));
        TextView center = label("Comandos e arquivos", 13, text, Typeface.NORMAL);
        center.setGravity(Gravity.CENTER_VERTICAL);
        center.setPadding(dp(compactLayout ? 6 : 12), dp(compactLayout ? 3 : 6), dp(compactLayout ? 6 : 12), dp(compactLayout ? 3 : 6));
        center.setBackgroundColor(Color.rgb(60, 60, 64));
        center.setOnClickListener(v -> paletaComandos());
        command.addView(center, new LinearLayout.LayoutParams(0, -2, 1));
        command.addView(iconButton(R.drawable.ic_np_add_file, "Novo arquivo", v -> novoArquivo()));
        command.addView(iconButton(R.drawable.ic_np_folder_open, "Abrir workspace", v -> abrirWorkspace()));
        command.addView(iconButton(R.drawable.ic_np_save, "Salvar", v -> salvarArquivo()));
        command.addView(iconButton(R.drawable.ic_np_play, "Executar", v -> executarArquivo()));
        command.addView(iconButton(R.drawable.ic_np_more, "Paleta", v -> paletaComandos()));

        top.addView(menu, matchWrap());
        top.addView(command, matchWrap());
        return top;
    }

    private View buildWorkArea() {
        workArea = horizontal();
        workArea.addView(buildActivityBar(), new LinearLayout.LayoutParams(dp(compactLayout ? 38 : 50), -1));

        View side = buildSidePanel();
        editorArea = buildEditorArea();
        if (compactLayout) {
            workArea.addView(side, new LinearLayout.LayoutParams(0, -1, 1));
            workArea.addView(editorArea, new LinearLayout.LayoutParams(0, -1, 1));
            sidePanel.setVisibility(View.GONE);
        } else {
            workArea.addView(side, new LinearLayout.LayoutParams(dp(270), -1));
            workArea.addView(editorArea, new LinearLayout.LayoutParams(0, -1, 1));
        }
        return workArea;
    }

    private View buildActivityBar() {
        activityBar = vertical();
        activityBar.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        activityBar.setBackgroundColor(Color.rgb(51, 51, 51));
        activityBar.setPadding(0, dp(6), 0, 0);
        activityBar.addView(activity(R.drawable.ic_np_files, "explorer", "Explorer"));
        activityBar.addView(activity(R.drawable.ic_np_search, "search", "Busca"));
        activityBar.addView(activity(R.drawable.ic_np_branch, "git", "Git"));
        activityBar.addView(activity(R.drawable.ic_np_debug, "debug", "Executar"));
        activityBar.addView(activity(R.drawable.ic_np_extensions, "extensions", "Extensoes"));
        activityBar.addView(activity(R.drawable.ic_np_settings, "settings", "Config"));
        return activityBar;
    }

    private View buildSidePanel() {
        sidePanel = vertical();
        sidePanel.setPadding(dp(7), dp(8), dp(7), dp(8));
        sidePanel.setBackgroundColor(sideBg);
        sideTitle = label("EXPLORER", 12, muted, Typeface.BOLD);
        sideTitle.setPadding(dp(4), 0, 0, dp(6));
        sideContent = vertical();
        ScrollView scroll = new ScrollView(this);
        scroll.addView(sideContent);
        sidePanel.addView(sideTitle, matchWrap());
        sidePanel.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        return sidePanel;
    }

    private View buildEditorArea() {
        LinearLayout area = vertical();
        area.setBackgroundColor(bg);
        tabRow = horizontal();
        tabRow.setBackgroundColor(sideBg);
        if (compactLayout) tabRow.setVisibility(View.GONE);
        fileTitle = label("Sem arquivo", 12, text, Typeface.BOLD);
        fileTitle.setPadding(dp(compactLayout ? 6 : 10), dp(compactLayout ? 3 : 6), dp(compactLayout ? 6 : 10), dp(compactLayout ? 3 : 6));
        fileTitle.setBackgroundColor(titleBg);
        lineNumbers = label("1", compactLayout ? 13 : 14, muted, Typeface.NORMAL);
        lineNumbers.setTypeface(Typeface.MONOSPACE);
        lineNumbers.setGravity(Gravity.TOP | Gravity.RIGHT);
        lineNumbers.setPadding(dp(6), dp(compactLayout ? 6 : 10), dp(6), dp(compactLayout ? 6 : 10));
        lineNumbers.setBackgroundColor(shade(bg, -0.08f));
        lineNumbers.setMinWidth(dp(38));
        editor = new EditText(this);
        editor.setGravity(Gravity.START | Gravity.TOP);
        editor.setMinLines(24);
        editor.setSingleLine(false);
        editor.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editor.setImeOptions(EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        editor.setFocusable(true);
        editor.setFocusableInTouchMode(true);
        editor.setCursorVisible(true);
        editor.setOnClickListener(v -> editor.requestFocus());
        editor.setTextSize(compactLayout ? 13 : 14);
        editor.setTypeface(Typeface.MONOSPACE);
        editor.setTextColor(text);
        editor.setHintTextColor(muted);
        editor.setBackgroundColor(bg);
        editor.setPadding(dp(compactLayout ? 6 : 12), dp(compactLayout ? 6 : 10), dp(compactLayout ? 6 : 12), dp(compactLayout ? 6 : 10));
        editor.setHorizontallyScrolling(true);
        editor.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (!applyingHighlight) {
                    editor.removeCallbacks(MainActivity.this::aplicarHighlight);
                    editor.postDelayed(MainActivity.this::aplicarHighlight, 180);
                }
                atualizarCursor();
                atualizarNumerosLinha();
            }
            @Override public void afterTextChanged(Editable s) {}
        });
        HorizontalScrollView h = new HorizontalScrollView(this);
        ScrollView v = new ScrollView(this);
        v.setFillViewport(true);
        h.setFillViewport(true);
        LinearLayout editorLine = horizontal();
        editorLine.setBaselineAligned(false);
        editorLine.setBackgroundColor(bg);
        editorLine.addView(lineNumbers, new LinearLayout.LayoutParams(dp(compactLayout ? 38 : 46), -2));
        editorLine.addView(editor, new LinearLayout.LayoutParams(-2, -2));
        v.addView(editorLine);
        h.addView(v);
        bottomPanel = vertical();
        bottomPanel.setBackgroundColor(panelBg);
        LinearLayout tabs = horizontal();
        for (String t : new String[] {"PROBLEMAS", "SAIDA", "DEBUG", "TERMINAL", "PORTAS", "GIT"}) {
            tabs.addView(bottomTab(t));
        }
        bottomTitle = label("TERMINAL", 11, muted, Typeface.BOLD);
        bottomTitle.setPadding(dp(10), dp(2), dp(10), dp(2));
        console = label("", 12, text, Typeface.NORMAL);
        console.setTypeface(Typeface.MONOSPACE);
        console.setPadding(dp(10), dp(6), dp(10), dp(8));
        console.setTextIsSelectable(true);
        consoleScroll = new ScrollView(this);
        consoleScroll.setFillViewport(true);
        consoleScroll.addView(console, matchWrap());
        terminalInput = new EditText(this);
        terminalInput.setSingleLine(true);
        terminalInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        terminalInput.setImeOptions(EditorInfo.IME_ACTION_SEND | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        terminalInput.setTextColor(text);
        terminalInput.setHintTextColor(muted);
        terminalInput.setTextSize(13);
        terminalInput.setTypeface(Typeface.MONOSPACE);
        terminalInput.setHint("> terminal ativo");
        terminalInput.setBackgroundColor(Color.rgb(35, 35, 35));
        terminalInput.setOnEditorActionListener((vInput, actionId, event) -> {
            enviarTerminal();
            return true;
        });
        bottomPanel.addView(tabs, matchWrap());
        bottomPanel.addView(bottomTitle, matchWrap());
        bottomPanel.addView(consoleScroll, new LinearLayout.LayoutParams(-1, 0, 1));
        bottomPanel.addView(terminalInput, matchWrap());
        area.addView(tabRow, matchWrap());
        area.addView(fileTitle, matchWrap());
        area.addView(h, new LinearLayout.LayoutParams(-1, 0, 1));
        bottomPanelParams = new LinearLayout.LayoutParams(-1, 0);
        area.addView(bottomPanel, bottomPanelParams);
        setBottomExpanded(false);
        atualizarNumerosLinha();
        return area;
    }

    private View buildStatusBar() {
        LinearLayout status = horizontal();
        statusBarView = status;
        status.setGravity(Gravity.CENTER_VERTICAL);
        status.setPadding(dp(8), 0, dp(8), 0);
        status.setBackgroundColor(accent);
        statusLeft = label("Pronto", 11, Color.WHITE, Typeface.NORMAL);
        statusRight = label("NPSharp Android", 11, Color.WHITE, Typeface.NORMAL);
        status.addView(statusLeft, new LinearLayout.LayoutParams(0, -2, 1));
        status.addView(statusRight, wrapWrap());
        return status;
    }

    private void showPanel(String panel) {
        activePanel = panel;
        if (sideContent == null) return;
        if (compactLayout) {
            sidePanel.setVisibility(View.VISIBLE);
            if (editorArea != null) editorArea.setVisibility(View.GONE);
        }
        sideContent.removeAllViews();
        if ("search".equals(panel)) {
            sideTitle.setText("BUSCA");
            sideContent.addView(painelBusca(), matchWrap());
        } else if ("git".equals(panel)) {
            sideTitle.setText("CONTROLE DE CODIGO");
            sideContent.addView(painelGit(), matchWrap());
        } else if ("debug".equals(panel)) {
            sideTitle.setText("EXECUTAR E DEBUG");
            sideContent.addView(painelDebug(), matchWrap());
        } else if ("extensions".equals(panel)) {
            sideTitle.setText("EXTENSOES");
            sideContent.addView(painelExtensoes(), matchWrap());
        } else if ("settings".equals(panel)) {
            sideTitle.setText("CONFIGURACOES");
            sideContent.addView(painelConfiguracoes(), matchWrap());
        } else {
            sideTitle.setText("EXPLORER");
            sideContent.addView(toolbarExplorer(), matchWrap());
            listarExplorer();
        }
        status("Painel: " + sideTitle.getText(), "");
    }

    private View toolbarExplorer() {
        LinearLayout tb = horizontal();
        tb.addView(iconPanel(R.drawable.ic_np_add_file, "Novo arquivo", v -> novoArquivo()), new LinearLayout.LayoutParams(0, dp(34), 1));
        tb.addView(iconPanel(R.drawable.ic_np_new_folder, "Nova pasta", v -> novaPasta()), new LinearLayout.LayoutParams(0, dp(34), 1));
        tb.addView(iconPanel(R.drawable.ic_np_folder_open, "Abrir workspace", v -> abrirWorkspace()), new LinearLayout.LayoutParams(0, dp(34), 1));
        tb.addView(iconPanel(R.drawable.ic_np_refresh, "Atualizar", v -> showPanel("explorer")), new LinearLayout.LayoutParams(0, dp(34), 1));
        return tb;
    }

    private void listarExplorer() {
        if (workspace == null) {
            showNoWorkspace();
            return;
        }
        listarFilhos(workspace, 0);
    }

    private void listarFilhos(DocumentFile dir, int depth) {
        DocumentFile[] files = dir.listFiles();
        Arrays.sort(files, Comparator
                .comparing(DocumentFile::isFile)
                .thenComparing(f -> nome(f).toLowerCase(Locale.ROOT)));
        for (DocumentFile f : files) {
            TextView row = label((f.isDirectory() ? "▸ " : "  ") + nome(f), 13, text, Typeface.NORMAL);
            row.setPadding(dp(6 + depth * 14), dp(7), dp(6), dp(7));
            row.setBackgroundColor(uriEquals(f, currentFile) ? Color.rgb(55, 55, 60) : sideBg);
            row.setOnClickListener(v -> {
                if (f.isFile()) abrirArquivo(f);
                else status("Pasta: " + nome(f), "");
            });
            row.setOnLongClickListener(v -> {
                menuArquivoExplorer(f);
                return true;
            });
            sideContent.addView(row, matchWrap());
            if (f.isDirectory()) listarFilhos(f, depth + 1);
        }
    }

    private void showNoWorkspace() {
        if (sideContent != null) {
            if (compactLayout) {
                sidePanel.setVisibility(View.VISIBLE);
                if (editorArea != null) editorArea.setVisibility(View.GONE);
            }
            sideContent.removeAllViews();
            sideContent.addView(panelText("Nenhum workspace aberto.", text), matchWrap());
            sideContent.addView(panelText("Use o icone de pasta para escolher uma pasta do Android.", muted), matchWrap());
            sideContent.addView(panelButton("Abrir workspace", v -> abrirWorkspace()), matchWrap());
        }
        fileTitle.setText("Sem workspace");
        editor.setText("");
        status("Abra uma pasta para comecar", "Sem workspace");
    }

    private View painelBusca() {
        LinearLayout p = vertical();
        EditText busca = input("Buscar");
        EditText subst = input("Substituir");
        p.addView(busca, matchWrap());
        p.addView(subst, matchWrap());
        p.addView(panelButton("Buscar", v -> buscar(busca.getText().toString())), matchWrap());
        p.addView(panelButton("Substituir tudo", v -> substituirTudo(busca.getText().toString(), subst.getText().toString())), matchWrap());
        return p;
    }

    private View painelGit() {
        LinearLayout p = vertical();
        p.addView(panelText("Git desktop nao existe dentro do Android.", text), matchWrap());
        p.addView(panelText("Workspace atual: " + workspaceNome(), muted), matchWrap());
        p.addView(panelButton("Listar arquivos", v -> listarWorkspaceNoConsole()), matchWrap());
        p.addView(panelButton("Salvar", v -> salvarArquivo()), matchWrap());
        return p;
    }

    private View painelDebug() {
        LinearLayout p = vertical();
        p.addView(panelButton("Executar arquivo atual", v -> executarArquivo()), matchWrap());
        p.addView(panelButton("Reiniciar", v -> executarArquivo()), matchWrap());
        p.addView(panelButton("Parar", v -> appendConsole("[Debug] parado")), matchWrap());
        p.addView(panelButton("Limpar console", v -> console.setText("")), matchWrap());
        p.addView(panelButton("Status dos runtimes", v -> mostrarRuntimesNoConsole()), matchWrap());
        p.addView(panelButton("Instalar/registrar runtimes", v -> instalarRuntimesAndroid()), matchWrap());
        p.addView(panelText("Portugol roda internamente. Runtimes desktop externos ficam marcados como limitados no Android.", muted), matchWrap());
        return p;
    }

    private View painelExtensoes() {
        LinearLayout p = vertical();
        p.addView(panelText("Servicos Android ativos", text), matchWrap());
        for (String s : new String[] {"Portugol interno", "Highlighter multi-linguagem", "Busca/substituicao em workspace", "Temas em assets", "Explorer SAF", "Terminal integrado"}) {
            p.addView(panelText("- " + s, muted), matchWrap());
        }
        p.addView(panelButton("Status dos runtimes", v -> mostrarRuntimesNoConsole()), matchWrap());
        p.addView(panelButton("Escolher tema", v -> escolherTema()), matchWrap());
        return p;
    }

    private View painelConfiguracoes() {
        LinearLayout p = vertical();
        p.addView(panelButton("Abrir workspace", v -> abrirWorkspace()), matchWrap());
        p.addView(panelButton("Paleta de comandos", v -> paletaComandos()), matchWrap());
        p.addView(panelButton("Abrir rapido", v -> abrirRapido()), matchWrap());
        p.addView(panelButton("Tema", v -> escolherTema()), matchWrap());
        p.addView(panelText("Pressione e segure arquivo/pasta para abrir o menu.", muted), matchWrap());
        return p;
    }

    private void abrirWorkspace() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(intent, REQ_WORKSPACE);
    }

    @Override
    public void onBackPressed() {
        if (compactLayout && sidePanel != null && sidePanel.getVisibility() == View.VISIBLE && editorArea != null) {
            sidePanel.setVisibility(View.GONE);
            editorArea.setVisibility(View.VISIBLE);
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_WORKSPACE && resultCode == RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri == null) return;
            int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContentResolver().takePersistableUriPermission(uri, flags);
            prefs().edit().putString(PREF_WORKSPACE_URI, uri.toString()).apply();
            workspace = DocumentFile.fromTreeUri(this, uri);
            currentFile = null;
            openFiles.clear();
            prefs().edit().remove(PREF_CURRENT_FILE_URI).remove(PREF_CURSOR).apply();
            showPanel("explorer");
            openFirstFile();
        }
    }

    @Override
    protected void onPause() {
        salvarArquivo();
        salvarSessao();
        super.onPause();
    }

    private void restoreWorkspace() {
        String raw = prefs().getString(PREF_WORKSPACE_URI, null);
        if (raw != null) {
            workspace = DocumentFile.fromTreeUri(this, Uri.parse(raw));
            if (workspace != null && !workspace.exists()) workspace = null;
        }
    }

    private void novoArquivo() {
        criarDialog(false, workspace);
    }

    private void novaPasta() {
        criarDialog(true, workspace);
    }

    private void criarDialog(boolean folder, DocumentFile parent) {
        if (parent == null || !parent.isDirectory()) {
            status("Abra um workspace primeiro", "Explorer");
            return;
        }
        EditText input = input(folder ? "Nome da pasta" : "Nome do arquivo");
        new AlertDialog.Builder(this)
                .setTitle(folder ? "Nova pasta" : "Novo arquivo")
                .setView(input)
                .setPositiveButton("Criar", (d, w) -> criar(parent, input.getText().toString(), folder))
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void criar(DocumentFile parent, String name, boolean folder) {
        if (name == null || name.isBlank()) return;
        String cleanName = name.trim();
        DocumentFile created = folder
                ? parent.createDirectory(cleanName)
                : parent.createFile(mimeForFile(cleanName), displayNameForNewFile(cleanName));
        if (created != null && created.isFile()) {
            abrirArquivo(created);
            return;
        }
        showPanel("explorer");
    }

    private void abrirArquivo(DocumentFile file) {
        try {
            salvarArquivo();
            currentFile = file;
            rememberOpenFile(file);
            editor.setText(read(file));
            fileTitle.setText(caminho(file));
            restaurarCursorSeMesmoArquivo(file);
            atualizarAbas();
            aplicarHighlight();
            showPanel("explorer");
            mostrarEditor();
            salvarSessao();
            status("Aberto: " + nome(file), linguagem(file));
        } catch (Exception e) {
            status("Erro ao abrir: " + primeiraLinha(e.getMessage()), "Erro");
        }
    }

    private void mostrarEditor() {
        if (compactLayout) {
            sidePanel.setVisibility(View.GONE);
            if (editorArea != null) editorArea.setVisibility(View.VISIBLE);
            setBottomExpanded(false);
        }
        hideKeyboard();
    }

    private void focarEditor() {
        mostrarEditor();
        editor.clearFocus();
    }

    private void focarTerminal() {
        if (compactLayout) {
            sidePanel.setVisibility(View.GONE);
            if (editorArea != null) editorArea.setVisibility(View.VISIBLE);
        }
        bottom("TERMINAL");
        terminalInput.clearFocus();
        hideKeyboard();
    }

    private void salvarArquivo() {
        if (currentFile == null) return;
        try {
            write(currentFile, editor.getText().toString());
            salvarSessao();
            status("Salvo: " + nome(currentFile), linguagem(currentFile));
        } catch (Exception e) {
            status("Erro ao salvar: " + primeiraLinha(e.getMessage()), "Erro");
        }
    }

    private void executarArquivo() {
        salvarArquivo();
        console.setText("");
        if (currentFile == null) {
            appendConsole("[Erro] Nenhum arquivo aberto.");
            return;
        }
        LanguageRuntime runtime = runtimeManager.detectFromName(nome(currentFile));
        if ("Portugol".equals(linguagem(currentFile))) {
            String codigo = editor.getText().toString();
            entradasPrograma.clear();
            programaRodando = true;
            bottom("DEBUG");
            terminalInput.setHint("> entrada do programa ou comando");
            new Thread(() -> {
                try {
                    PortugolInterpreter interpreter = new PortugolInterpreter();
                    interpreter.setInputProvider(() -> {
                        runOnUiThread(() -> appendConsole("[Entrada] aguardando valor..."));
                        try {
                            return entradasPrograma.take();
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            return "";
                        }
                    });
                    interpreter.executeWithOutput(codigo, line -> runOnUiThread(() -> appendConsole("[Portugol] " + line)));
                } finally {
                    programaRodando = false;
                    runOnUiThread(() -> {
                        terminalInput.setHint("> terminal ativo");
                        status("Execucao finalizada", "Portugol");
                    });
                }
            }, "npsharp-android-portugol").start();
            return;
        }
        AndroidRuntimeManager.RuntimeStatus runtimeStatus = runtimeManager.status(runtime);
        appendConsole("[Runtime] " + runtimeStatus.language().displayName() + ": " + runtimeStatus.message());
        appendConsole("[Android] Abra este workspace no desktop para executar/debugar esse runtime externo.");
    }

    private void buscar(String query) {
        if (query == null || query.isBlank() || workspace == null) return;
        console.setText("");
        int[] count = {0};
        for (DocumentFile file : arquivosTexto(workspace)) {
            try {
                String[] lines = read(file).split("\\R", -1);
                for (int i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))) {
                        count[0]++;
                        appendConsole(caminho(file) + ":" + (i + 1) + "  " + lines[i].trim());
                    }
                }
            } catch (Exception ignored) {
            }
        }
        status(count[0] + " resultado(s)", "Busca");
    }

    private void substituirTudo(String search, String replace) {
        if (search == null || search.isBlank() || workspace == null) return;
        int changed = 0;
        for (DocumentFile file : arquivosTexto(workspace)) {
            try {
                String old = read(file);
                String next = old.replace(search, replace == null ? "" : replace);
                if (!old.equals(next)) {
                    write(file, next);
                    changed++;
                }
            } catch (Exception ignored) {
            }
        }
        if (currentFile != null) abrirArquivo(currentFile);
        status(changed + " arquivo(s) alterado(s)", "Substituir");
    }

    private void menuArquivoExplorer(DocumentFile file) {
        String[] labels = {"Abrir", "Renomear", "Excluir", "Copiar caminho", "Novo arquivo aqui", "Nova pasta aqui"};
        new AlertDialog.Builder(this)
                .setTitle(nome(file))
                .setItems(labels, (d, which) -> {
                    if (which == 0 && file.isFile()) abrirArquivo(file);
                    if (which == 1) renomearDialog(file);
                    if (which == 2) excluir(file);
                    if (which == 3) copiar(caminho(file));
                    if (which == 4) criarDialog(false, file.isDirectory() ? file : file.getParentFile());
                    if (which == 5) criarDialog(true, file.isDirectory() ? file : file.getParentFile());
                })
                .show();
    }

    private void renomearDialog(DocumentFile file) {
        EditText input = input(nome(file));
        input.setText(nome(file));
        input.selectAll();
        new AlertDialog.Builder(this)
                .setTitle("Renomear")
                .setView(input)
                .setPositiveButton("Renomear", (d, w) -> {
                    file.renameTo(input.getText().toString());
                    showPanel("explorer");
                    atualizarAbas();
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void excluir(DocumentFile file) {
        new AlertDialog.Builder(this)
                .setTitle("Excluir")
                .setMessage("Excluir " + nome(file) + "?")
                .setPositiveButton("Excluir", (d, w) -> {
                    file.delete();
                    openFiles.removeIf(open -> uriEquals(open, file));
                    if (uriEquals(file, currentFile)) {
                        currentFile = null;
                        editor.setText("");
                        fileTitle.setText("Sem arquivo");
                    }
                    showPanel("explorer");
                    atualizarAbas();
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void paletaComandos() {
        List<CommandAction> commands = new ArrayList<>();
        commands.add(new CommandAction("Arquivo: Novo arquivo", this::novoArquivo));
        commands.add(new CommandAction("Arquivo: Nova pasta", this::novaPasta));
        commands.add(new CommandAction("Arquivo: Abrir workspace", this::abrirWorkspace));
        commands.add(new CommandAction("Arquivo: Fechar workspace", this::fecharWorkspace));
        commands.add(new CommandAction("Arquivo: Abrir rapido", this::abrirRapido));
        commands.add(new CommandAction("Arquivo: Salvar", this::salvarArquivo));
        commands.add(new CommandAction("Editar: Ir para linha", this::irParaLinha));
        commands.add(new CommandAction("Exibir: Focar editor", this::focarEditor));
        commands.add(new CommandAction("Exibir: Focar terminal", this::focarTerminal));
        commands.add(new CommandAction("Exibir: Explorer", () -> showPanel("explorer")));
        commands.add(new CommandAction("Exibir: Busca", () -> showPanel("search")));
        commands.add(new CommandAction("Exibir: Git", () -> showPanel("git")));
        commands.add(new CommandAction("Exibir: Executar e Debug", () -> showPanel("debug")));
        commands.add(new CommandAction("Exibir: Extensoes", () -> showPanel("extensions")));
        commands.add(new CommandAction("Exibir: Configuracoes", () -> showPanel("settings")));
        commands.add(new CommandAction("Terminal: Limpar", () -> console.setText("")));
        commands.add(new CommandAction("Terminal: Listar workspace", this::listarWorkspaceNoConsole));
        commands.add(new CommandAction("Terminal: Ajuda", this::ajudaTerminal));
        commands.add(new CommandAction("Tema: Escolher tema", this::escolherTema));
        commands.add(new CommandAction("Runtime: Status", this::mostrarRuntimesNoConsole));
        commands.add(new CommandAction("Runtime: Instalar/registrar", this::instalarRuntimesAndroid));
        commands.add(new CommandAction("Executar: Iniciar debug", this::executarArquivo));
        searchableDialog("Paleta de comandos", commands);
    }

    private void abrirRapido() {
        List<DocumentFile> files = workspace == null ? new ArrayList<>() : arquivosTexto(workspace);
        List<CommandAction> actions = new ArrayList<>();
        for (DocumentFile file : files) {
            actions.add(new CommandAction(caminho(file), () -> abrirArquivo(file)));
        }
        searchableDialog("Abrir rapido", actions);
    }

    private void escolherTema() {
        try {
            String[] allThemes = getAssets().list("themes");
            List<String> themes = new ArrayList<>();
            if (allThemes != null) {
                for (String theme : allThemes) {
                    if (theme.endsWith(".json") && !"package.json".equals(theme)) themes.add(theme);
                }
            }
            themes.sort(String::compareTo);
            String[] finalThemes = themes.toArray(new String[0]);
            new AlertDialog.Builder(this)
                    .setTitle("Tema de cores")
                    .setItems(finalThemes, (d, which) -> aplicarTema(finalThemes[which]))
                    .show();
        } catch (Exception e) {
            status("Erro ao listar temas", "Tema");
        }
    }

    private void aplicarTema(String assetName) {
        try {
            String json = readAsset("themes/" + assetName);
            applyThemeJson(json);
            prefs().edit().putString(PREF_THEME, assetName).apply();
            refreshColors();
            aplicarHighlight();
            status("Tema aplicado: " + assetName, "Tema");
        } catch (Exception e) {
            applyDefaultTheme();
            refreshColors();
            status("Erro ao aplicar tema", "Tema");
        }
    }

    private void restaurarTema() {
        String theme = prefs().getString(PREF_THEME, null);
        if (theme == null) return;
        try {
            String json = readAsset("themes/" + theme);
            applyThemeJson(json);
        } catch (Exception ignored) {
            applyDefaultTheme();
        }
    }

    private void applyDefaultTheme() {
        bg = DEFAULT_BG;
        sideBg = DEFAULT_SIDE_BG;
        panelBg = DEFAULT_PANEL_BG;
        titleBg = DEFAULT_TITLE_BG;
        text = DEFAULT_TEXT;
        muted = DEFAULT_MUTED;
        accent = DEFAULT_ACCENT;
    }

    private void applyThemeJson(String json) {
        int nextBg = color(json, "editor.background", DEFAULT_BG);
        int nextText = color(json, "editor.foreground", readableOn(nextBg));
        int nextSide = color(json, "sideBar.background", shade(nextBg, 0.12f));
        int nextTitle = color(json, "titleBar.activeBackground", shade(nextBg, 0.20f));
        int nextPanel = color(json, "panel.background", shade(nextBg, -0.06f));
        int nextAccent = color(json, "statusBar.background", color(json, "focusBorder", DEFAULT_ACCENT));

        bg = nextBg;
        text = ensureContrast(nextText, bg);
        sideBg = nextSide;
        titleBg = nextTitle;
        panelBg = nextPanel;
        accent = nextAccent;
        muted = ensureContrast(shade(text, textIsDark(text) ? 0.35f : -0.35f), sideBg);
    }

    private void refreshColors() {
        root.setBackgroundColor(bg);
        if (topBar != null) topBar.setBackgroundColor(titleBg);
        if (commandBar != null) commandBar.setBackgroundColor(titleBg);
        if (activityBar != null) activityBar.setBackgroundColor(shade(sideBg, -0.10f));
        sidePanel.setBackgroundColor(sideBg);
        tabRow.setBackgroundColor(sideBg);
        editor.setBackgroundColor(bg);
        editor.setTextColor(text);
        if (lineNumbers != null) {
            lineNumbers.setBackgroundColor(shade(bg, -0.08f));
            lineNumbers.setTextColor(muted);
        }
        fileTitle.setBackgroundColor(titleBg);
        fileTitle.setTextColor(text);
        bottomPanel.setBackgroundColor(panelBg);
        if (consoleScroll != null) consoleScroll.setBackgroundColor(panelBg);
        console.setBackgroundColor(panelBg);
        console.setTextColor(text);
        terminalInput.setBackgroundColor(shade(panelBg, 0.08f));
        terminalInput.setTextColor(text);
        terminalInput.setHintTextColor(muted);
        if (statusBarView != null) statusBarView.setBackgroundColor(accent);
        recolorChildren(root);
        boolean editorVisible = editorArea != null && editorArea.getVisibility() == View.VISIBLE;
        if (!compactLayout || !editorVisible) {
            showPanel(activePanel);
        }
    }

    private void recolorChildren(View view) {
        if (view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(text);
        } else if (view instanceof ImageButton) {
            ((ImageButton) view).setColorFilter(text);
        } else if (view instanceof TextView
                && view != editor
                && view != console
                && view != statusLeft
                && view != statusRight) {
            ((TextView) view).setTextColor(text);
        }
        if (view instanceof LinearLayout) {
            LinearLayout layout = (LinearLayout) view;
            for (int i = 0; i < layout.getChildCount(); i++) recolorChildren(layout.getChildAt(i));
        } else if (view instanceof ScrollView) {
            ScrollView scroll = (ScrollView) view;
            if (scroll.getChildCount() > 0) recolorChildren(scroll.getChildAt(0));
        } else if (view instanceof HorizontalScrollView) {
            HorizontalScrollView scroll = (HorizontalScrollView) view;
            if (scroll.getChildCount() > 0) recolorChildren(scroll.getChildAt(0));
        }
    }

    private void atualizarAbas() {
        tabRow.removeAllViews();
        if (workspace == null || openFiles.isEmpty()) return;
        List<DocumentFile> files = new ArrayList<>(openFiles);
        int max = Math.min(6, files.size());
        for (int i = 0; i < max; i++) {
            DocumentFile f = files.get(i);
            TextView tab = label(nome(f), 12, uriEquals(f, currentFile) ? text : muted, uriEquals(f, currentFile) ? Typeface.BOLD : Typeface.NORMAL);
            tab.setPadding(dp(12), dp(7), dp(12), dp(7));
            tab.setBackgroundColor(uriEquals(f, currentFile) ? bg : titleBg);
            tab.setOnClickListener(v -> abrirArquivo(f));
            tab.setOnLongClickListener(v -> {
                fecharAba(f);
                return true;
            });
            tabRow.addView(tab, wrapWrap());
        }
    }

    private void rememberOpenFile(DocumentFile file) {
        if (file == null) return;
        for (DocumentFile open : openFiles) {
            if (uriEquals(open, file)) return;
        }
        openFiles.add(file);
    }

    private void fecharAba(DocumentFile file) {
        if (file == null) return;
        if (uriEquals(file, currentFile)) salvarArquivo();
        openFiles.removeIf(open -> uriEquals(open, file));
        if (uriEquals(file, currentFile)) {
            currentFile = openFiles.isEmpty() ? null : openFiles.get(openFiles.size() - 1);
            if (currentFile == null) {
                editor.setText("");
                fileTitle.setText("Sem arquivo");
            } else {
                abrirArquivo(currentFile);
                return;
            }
        }
        atualizarAbas();
        salvarSessao();
    }

    private void openFirstFile() {
        if (workspace == null) return;
        List<DocumentFile> files = arquivosTexto(workspace);
        if (!files.isEmpty()) abrirArquivo(files.get(0));
    }

    private void fecharWorkspace() {
        salvarArquivo();
        workspace = null;
        currentFile = null;
        openFiles.clear();
        prefs().edit()
                .remove(PREF_WORKSPACE_URI)
                .remove(PREF_CURRENT_FILE_URI)
                .remove(PREF_CURSOR)
                .apply();
        editor.setText("");
        tabRow.removeAllViews();
        console.setText("");
        showNoWorkspace();
    }

    private void irParaLinha() {
        EditText input = input("Numero da linha");
        new AlertDialog.Builder(this)
                .setTitle("Ir para linha")
                .setView(input)
                .setPositiveButton("Ir", (dialog, which) -> {
                    try {
                        int line = Math.max(1, Integer.parseInt(input.getText().toString().trim()));
                        moverCursorParaLinha(line);
                    } catch (Exception e) {
                        status("Linha invalida", "Editor");
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void moverCursorParaLinha(int targetLine) {
        String value = editor.getText().toString();
        int line = 1;
        int offset = 0;
        while (offset < value.length() && line < targetLine) {
            if (value.charAt(offset) == '\n') line++;
            offset++;
        }
        editor.setSelection(Math.min(offset, editor.length()));
        focarEditor();
        status("Linha " + targetLine, linguagem(currentFile));
    }

    private void restaurarArquivoAtual() {
        String raw = prefs().getString(PREF_CURRENT_FILE_URI, null);
        if (raw != null) {
            DocumentFile file = DocumentFile.fromSingleUri(this, Uri.parse(raw));
            if (file != null && file.exists() && file.isFile()) {
                abrirArquivo(file);
                return;
            }
            DocumentFile found = procurarPorUri(workspace, Uri.parse(raw));
            if (found != null) {
                abrirArquivo(found);
                return;
            }
        }
        openFirstFile();
    }

    private DocumentFile procurarPorUri(DocumentFile root, Uri uri) {
        if (root == null || uri == null) return null;
        if (root.getUri().equals(uri)) return root;
        if (!root.isDirectory()) return null;
        for (DocumentFile child : root.listFiles()) {
            DocumentFile found = procurarPorUri(child, uri);
            if (found != null) return found;
        }
        return null;
    }

    private void salvarSessao() {
        SharedPreferences.Editor edit = prefs().edit();
        if (currentFile != null) {
            edit.putString(PREF_CURRENT_FILE_URI, currentFile.getUri().toString());
            edit.putInt(PREF_CURSOR, Math.max(0, editor.getSelectionStart()));
        }
        edit.apply();
    }

    private void restaurarCursorSeMesmoArquivo(DocumentFile file) {
        String raw = prefs().getString(PREF_CURRENT_FILE_URI, null);
        if (raw == null || file == null || !file.getUri().toString().equals(raw)) return;
        int cursor = prefs().getInt(PREF_CURSOR, 0);
        editor.post(() -> editor.setSelection(Math.min(Math.max(0, cursor), editor.length())));
    }

    private List<DocumentFile> arquivosTexto(DocumentFile root) {
        List<DocumentFile> out = new ArrayList<>();
        collect(root, out);
        return out;
    }

    private void collect(DocumentFile dir, List<DocumentFile> out) {
        for (DocumentFile f : dir.listFiles()) {
            if (f.isDirectory()) collect(f, out);
            else if (isTexto(f)) out.add(f);
        }
    }

    private boolean isTexto(DocumentFile f) {
        String n = nome(f).toLowerCase(Locale.ROOT);
        return n.endsWith(".java") || n.endsWith(".kt") || n.endsWith(".xml") || n.endsWith(".json")
                || n.endsWith(".css") || n.endsWith(".html") || n.endsWith(".js") || n.endsWith(".ts")
                || n.endsWith(".md") || n.endsWith(".txt") || n.endsWith(".gol") || n.endsWith(".por")
                || n.endsWith(".portugol") || n.endsWith(".alg");
    }

    private String read(DocumentFile file) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(file.getUri());
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line).append('\n');
            return sb.toString();
        }
    }

    private void write(DocumentFile file, String content) throws Exception {
        try (OutputStream out = getContentResolver().openOutputStream(file.getUri(), "wt")) {
            out.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
        }
    }

    private String readAsset(String path) throws Exception {
        try (InputStream in = getAssets().open(path)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private void aplicarHighlight() {
        if (editor == null) return;
        applyingHighlight = true;
        Editable editable = editor.getText();
        AndroidSyntax.apply(editable, text);
        applyingHighlight = false;
    }

    private void atualizarCursor() {
        if (statusRight == null) return;
        int pos = Math.max(0, editor.getSelectionStart());
        String s = editor.getText().toString();
        int line = 1, col = 1;
        for (int i = 0; i < Math.min(pos, s.length()); i++) {
            if (s.charAt(i) == '\n') { line++; col = 1; } else col++;
        }
        statusRight.setText(linguagem(currentFile) + "  Ln " + line + ", Col " + col);
    }

    private void atualizarNumerosLinha() {
        if (lineNumbers == null || editor == null) return;
        String value = editor.getText().toString();
        int lines = 1;
        for (int i = 0; i < value.length(); i++) {
            if (value.charAt(i) == '\n') {
                lines++;
            }
        }
        StringBuilder numbers = new StringBuilder(lines * 4);
        for (int i = 1; i <= lines; i++) {
            if (i > 1) numbers.append('\n');
            numbers.append(i);
        }
        lineNumbers.setText(numbers);
    }

    private void menuArquivo() {
        menu("Arquivo", new String[] {"Novo arquivo", "Nova pasta", "Abrir workspace", "Fechar workspace", "Abrir rapido", "Salvar", "Executar"},
                new Runnable[] {this::novoArquivo, this::novaPasta, this::abrirWorkspace, this::fecharWorkspace, this::abrirRapido, this::salvarArquivo, this::executarArquivo});
    }

    private void menuEditar() {
        menu("Editar", new String[] {"Paleta de comandos", "Buscar", "Substituir", "Ir para linha", "Selecionar tudo", "Copiar caminho"},
                new Runnable[] {this::paletaComandos, () -> showPanel("search"), () -> showPanel("search"), this::irParaLinha, () -> editor.selectAll(), () -> { if (currentFile != null) copiar(caminho(currentFile)); }});
    }

    private void menuExibir() {
        menu("Exibir", new String[] {"Editor", "Terminal", "Explorer", "Busca", "Git", "Executar e debug", "Extensoes", "Configuracoes", "Tema"},
                new Runnable[] {this::focarEditor, this::focarTerminal, () -> showPanel("explorer"), () -> showPanel("search"), () -> showPanel("git"), () -> showPanel("debug"), () -> showPanel("extensions"), () -> showPanel("settings"), this::escolherTema});
    }

    private void menuExecutar() {
        menu("Executar", new String[] {"Iniciar debug", "Reiniciar", "Parar", "Console de debug"},
                new Runnable[] {this::executarArquivo, this::executarArquivo, () -> appendConsole("[Debug] parado"), () -> bottom("DEBUG")});
    }

    private void menuTerminal() {
        menu("Terminal", new String[] {"Mostrar terminal", "Ocultar painel", "Focar entrada", "Limpar", "Listar workspace", "Ajuda"},
                new Runnable[] {this::focarTerminal, () -> setBottomExpanded(false), this::focarTerminal, () -> console.setText(""), this::listarWorkspaceNoConsole, this::ajudaTerminal});
    }

    private void mostrarSobre() {
        new AlertDialog.Builder(this).setTitle("NPSharp Android")
                .setMessage("Editor Android com layout inspirado no NPSharp para PC.")
                .setPositiveButton("OK", null).show();
    }

    private void bottom(String name) {
        if (compactLayout) {
            sidePanel.setVisibility(View.GONE);
            if (editorArea != null) editorArea.setVisibility(View.VISIBLE);
        }
        setBottomExpanded(true);
        bottomTitle.setText(name);
        if ("PROBLEMAS".equals(name)) console.setText("[Problemas] Nenhum problema encontrado.\n");
        if ("PORTAS".equals(name)) console.setText("[Portas] Nenhuma porta encaminhada.\n");
        if ("GIT".equals(name)) listarWorkspaceNoConsole();
        if ("TERMINAL".equals(name) && console.getText().length() == 0) ajudaTerminal();
        hideKeyboard();
    }

    private void setBottomExpanded(boolean expanded) {
        bottomExpanded = expanded;
        if (console == null || terminalInput == null || bottomPanelParams == null) return;
        bottomPanel.setVisibility(expanded ? View.VISIBLE : View.GONE);
        if (consoleScroll != null) consoleScroll.setVisibility(expanded ? View.VISIBLE : View.GONE);
        terminalInput.setVisibility(expanded ? View.VISIBLE : View.GONE);
        bottomPanelParams.height = expanded ? dp(compactLayout ? 170 : 220) : 0;
        bottomPanel.setLayoutParams(bottomPanelParams);
    }

    private void hideKeyboard() {
        View focused = getCurrentFocus();
        if (focused == null) {
            focused = root;
        }
        if (focused == null) return;
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) {
            imm.hideSoftInputFromWindow(focused.getWindowToken(), 0);
        }
    }

    private void enviarTerminal() {
        if (terminalInput == null) return;
        String comando = terminalInput.getText().toString();
        terminalInput.setText("");
        if (comando.isBlank()) return;
        appendConsole("> " + comando);
        if (programaRodando) {
            entradasPrograma.offer(comando);
            return;
        }
        executarComandoTerminal(comando.trim());
    }

    private void executarComandoTerminal(String comando) {
        String lower = comando.toLowerCase(Locale.ROOT);
        if ("ajuda".equals(lower) || "help".equals(lower)) {
            ajudaTerminal();
        } else if ("limpar".equals(lower) || "clear".equals(lower) || "cls".equals(lower)) {
            console.setText("");
        } else if ("ls".equals(lower) || "dir".equals(lower)) {
            listarWorkspaceNoConsole();
        } else if ("runtimes".equals(lower) || "runtime".equals(lower)) {
            mostrarRuntimesNoConsole();
        } else if ("instalar runtimes".equals(lower) || "install runtimes".equals(lower)) {
            instalarRuntimesAndroid();
        } else if ("salvar".equals(lower) || "save".equals(lower)) {
            salvarArquivo();
        } else if ("executar".equals(lower) || "run".equals(lower)) {
            executarArquivo();
        } else if ("editor".equals(lower) || "foco".equals(lower)) {
            focarEditor();
        } else if ("terminal".equals(lower)) {
            focarTerminal();
        } else if ("explorer".equals(lower) || "arquivos".equals(lower)) {
            showPanel("explorer");
        } else if (lower.startsWith("abrir ")) {
            abrirPorNome(comando.substring(6).trim());
        } else if (lower.startsWith("open ")) {
            abrirPorNome(comando.substring(5).trim());
        } else if (lower.startsWith("code ")) {
            abrirOuCriarPorNome(comando.substring(5).trim());
        } else if (lower.startsWith("novo ")) {
            abrirOuCriarPorNome(comando.substring(5).trim());
        } else if (lower.startsWith("append ")) {
            editor.append(comando.substring(7));
            editor.append("\n");
            status("Texto inserido pelo terminal", linguagem(currentFile));
        } else if ("pwd".equals(lower)) {
            appendConsole(workspace == null ? "Sem workspace aberto" : caminho(workspace));
        } else if ("cat".equals(lower) || "type".equals(lower)) {
            if (currentFile == null) {
                appendConsole("[Terminal] Nenhum arquivo aberto.");
            } else {
                appendConsole(editor.getText().toString());
            }
        } else {
            executarShellAndroid(comando);
        }
    }

    private void ajudaTerminal() {
        appendConsole("[Terminal] ativo. Comandos: ajuda, limpar, ls, pwd, cat, abrir <nome>, code <arquivo>, salvar, executar, runtimes, instalar runtimes, editor, terminal, explorer, append <texto>.");
        appendConsole("[Terminal] Comandos desconhecidos tentam rodar via /system/bin/sh -c.");
        appendConsole("[Terminal] Durante leia() do Portugol, o texto digitado vira entrada do programa.");
    }

    private void executarShellAndroid(String comando) {
        appendConsole("[Shell] " + comando);
        new Thread(() -> {
            Process process = null;
            try {
                process = new ProcessBuilder("/system/bin/sh", "-c", comando)
                        .redirectErrorStream(true)
                        .start();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String output = line;
                        runOnUiThread(() -> appendConsole(output));
                    }
                }
                boolean finished = process.waitFor(8, TimeUnit.SECONDS);
                if (!finished) {
                    process.destroy();
                    runOnUiThread(() -> appendConsole("[Shell] interrompido por timeout."));
                    return;
                }
                int exitCode = process.exitValue();
                runOnUiThread(() -> appendConsole("[Shell] codigo de saida: " + exitCode));
            } catch (Exception e) {
                String message = primeiraLinha(e.getMessage());
                runOnUiThread(() -> appendConsole("[Shell] falhou: " + message));
            } finally {
                if (process != null) {
                    process.destroy();
                }
            }
        }, "npsharp-android-shell").start();
    }

    private void mostrarRuntimesNoConsole() {
        bottom("DEBUG");
        console.setText("");
        for (AndroidRuntimeManager.RuntimeStatus runtimeStatus : runtimeManager.list()) {
            appendConsole(runtimeStatus.language().displayName() + " [" + runtimeStatus.state() + "] " + runtimeStatus.version());
            appendConsole("  " + runtimeStatus.message());
        }
        status("Runtimes atualizados", "Runtime");
    }

    private void instalarRuntimesAndroid() {
        bottom("DEBUG");
        console.setText("");
        for (String line : runtimeManager.installAllCommon()) {
            appendConsole(line);
        }
        status("Registro de runtimes concluido", "Runtime");
    }

    private void abrirPorNome(String nome) {
        DocumentFile arquivo = procurarArquivo(nome);
        if (arquivo == null) {
            appendConsole("[Terminal] Arquivo nao encontrado: " + nome);
            return;
        }
        abrirArquivo(arquivo);
    }

    private void abrirOuCriarPorNome(String nome) {
        if (nome == null || nome.isBlank()) return;
        DocumentFile arquivo = procurarArquivo(nome);
        if (arquivo != null) {
            abrirArquivo(arquivo);
            return;
        }
        if (workspace == null) {
            appendConsole("[Terminal] Abra um workspace primeiro.");
            return;
        }
        String cleanName = nome.trim();
        DocumentFile novo = workspace.createFile(mimeForFile(cleanName), displayNameForNewFile(cleanName));
        if (novo != null) {
            abrirArquivo(novo);
        }
    }

    private String displayNameForNewFile(String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) return "novo.txt";
        return clean.contains(".") ? clean : clean + ".txt";
    }

    private String mimeForFile(String name) {
        String n = displayNameForNewFile(name).toLowerCase(Locale.ROOT);
        if (n.endsWith(".txt")) return "text/plain";
        if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".xml")) return "application/xml";
        if (n.endsWith(".md")) return "text/markdown";
        return "application/octet-stream";
    }

    private DocumentFile procurarArquivo(String query) {
        if (workspace == null || query == null) return null;
        String q = query.toLowerCase(Locale.ROOT);
        for (DocumentFile f : arquivosTexto(workspace)) {
            if (nome(f).toLowerCase(Locale.ROOT).equals(q) || caminho(f).toLowerCase(Locale.ROOT).contains(q)) {
                return f;
            }
        }
        return null;
    }

    private void listarWorkspaceNoConsole() {
        console.setText("");
        if (workspace == null) return;
        for (DocumentFile f : arquivosTexto(workspace)) appendConsole(caminho(f));
    }

    private void menu(String title, String[] labels, Runnable[] actions) {
        new AlertDialog.Builder(this).setTitle(title)
                .setItems(labels, (d, which) -> actions[which].run()).show();
    }

    private void searchableDialog(String title, List<CommandAction> actions) {
        LinearLayout box = vertical();
        box.setPadding(dp(12), dp(8), dp(12), dp(4));

        EditText search = input("Digite para filtrar");
        ListView list = new ListView(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, new ArrayList<>());
        list.setAdapter(adapter);
        box.addView(search, matchWrap());
        box.addView(list, new LinearLayout.LayoutParams(-1, dp(360)));

        final List<CommandAction> filtered = new ArrayList<>();
        Runnable refresh = () -> {
            String query = search.getText().toString().toLowerCase(Locale.ROOT).trim();
            filtered.clear();
            adapter.clear();
            for (CommandAction action : actions) {
                if (query.isBlank() || action.label.toLowerCase(Locale.ROOT).contains(query)) {
                    filtered.add(action);
                    adapter.add(action.label);
                }
            }
            adapter.notifyDataSetChanged();
        };
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { refresh.run(); }
            @Override public void afterTextChanged(Editable s) {}
        });
        refresh.run();

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(title)
                .setView(box)
                .setNegativeButton("Cancelar", null)
                .create();
        list.setOnItemClickListener((parent, view, position, id) -> {
            if (position >= 0 && position < filtered.size()) {
                dialog.dismiss();
                filtered.get(position).action.run();
            }
        });
        dialog.setOnShowListener(d -> search.requestFocus());
        dialog.show();
    }

    private void copiar(String value) {
        ClipboardManager cb = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (cb != null) cb.setPrimaryClip(ClipData.newPlainText("NPSharp", value));
        status("Copiado", "Clipboard");
    }

    private String workspaceNome() {
        return workspace == null ? "Nenhum" : nome(workspace);
    }

    private String nome(DocumentFile f) {
        return f == null || f.getName() == null ? "" : f.getName();
    }

    private String caminho(DocumentFile f) {
        return f == null ? "" : f.getUri().toString().replace("%2F", "/");
    }

    private boolean uriEquals(DocumentFile a, DocumentFile b) {
        return a != null && b != null && a.getUri().equals(b.getUri());
    }

    private String linguagem(DocumentFile f) {
        String n = nome(f).toLowerCase(Locale.ROOT);
        if (n.endsWith(".gol") || n.endsWith(".por") || n.endsWith(".portugol") || n.endsWith(".alg")) return "Portugol";
        if (n.endsWith(".java")) return "Java";
        if (n.endsWith(".kt")) return "Kotlin";
        if (n.endsWith(".js")) return "JavaScript";
        if (n.endsWith(".ts")) return "TypeScript";
        if (n.endsWith(".json")) return "JSON";
        if (n.endsWith(".css")) return "CSS";
        if (n.endsWith(".html")) return "HTML";
        if (n.endsWith(".md")) return "Markdown";
        return "Texto";
    }

    private int color(String json, String key, int fallback) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"(#[0-9a-fA-F]{6,8})\"").matcher(json);
        if (!m.find()) return fallback;
        try {
            String value = m.group(1);
            if (value.length() == 9) value = "#" + value.substring(3);
            return Color.parseColor(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private int shade(int color, float amount) {
        int r = Color.red(color);
        int g = Color.green(color);
        int b = Color.blue(color);
        if (amount >= 0) {
            r += Math.round((255 - r) * amount);
            g += Math.round((255 - g) * amount);
            b += Math.round((255 - b) * amount);
        } else {
            float factor = 1f + amount;
            r = Math.round(r * factor);
            g = Math.round(g * factor);
            b = Math.round(b * factor);
        }
        return Color.rgb(clampColor(r), clampColor(g), clampColor(b));
    }

    private int readableOn(int background) {
        return textIsDark(background) ? Color.rgb(245, 245, 245) : Color.rgb(32, 32, 32);
    }

    private int ensureContrast(int foreground, int background) {
        double diff = Math.abs(luminance(foreground) - luminance(background));
        if (diff >= 0.42d) {
            return foreground;
        }
        return readableOn(background);
    }

    private boolean textIsDark(int color) {
        return luminance(color) < 0.5d;
    }

    private double luminance(int color) {
        return (0.2126d * Color.red(color) + 0.7152d * Color.green(color) + 0.0722d * Color.blue(color)) / 255d;
    }

    private int clampColor(int value) {
        return Math.max(0, Math.min(255, value));
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private void appendConsole(String line) {
        console.append(line + "\n");
        if (consoleScroll != null) {
            consoleScroll.post(() -> consoleScroll.fullScroll(View.FOCUS_DOWN));
        }
    }

    private void status(String left, String right) {
        if (statusLeft != null) statusLeft.setText(left == null ? "" : left);
        if (statusRight != null && right != null && !right.isBlank()) statusRight.setText(right);
    }

    private String primeiraLinha(String text) {
        return text == null || text.isBlank() ? "erro desconhecido" : text.split("\\R", 2)[0];
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        return input;
    }

    private Button menuButton(String s, View.OnClickListener l) {
        return button(s, l, 12, Color.TRANSPARENT);
    }

    private ImageButton iconButton(int drawableRes, String desc, View.OnClickListener l) {
        return imageButton(drawableRes, desc, Color.TRANSPARENT, l);
    }

    private ImageButton iconPanel(int drawableRes, String desc, View.OnClickListener l) {
        return imageButton(drawableRes, desc, titleBg, l);
    }

    private ImageButton imageButton(int drawableRes, String desc, int background, View.OnClickListener l) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(drawableRes);
        button.setColorFilter(text);
        button.setBackgroundColor(background);
        button.setContentDescription(desc);
        button.setPadding(dp(8), dp(6), dp(8), dp(6));
        button.setScaleType(ImageButton.ScaleType.CENTER);
        button.setOnClickListener(l);
        button.setMinimumWidth(dp(34));
        button.setMinimumHeight(dp(32));
        return button;
    }

    private Button panelButton(String s, View.OnClickListener l) {
        return button(s, l, 12, titleBg);
    }

    private Button button(String s, View.OnClickListener l, int sp, int color) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(sp);
        b.setTextColor(text);
        b.setBackgroundColor(color);
        b.setOnClickListener(l);
        return b;
    }

    private ImageButton activity(int drawableRes, String panel, String desc) {
        ImageButton button = imageButton(drawableRes, desc, Color.TRANSPARENT, x -> showPanel(panel));
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        button.setMinimumHeight(dp(44));
        return button;
    }

    private TextView bottomTab(String s) {
        TextView v = label(s, 10, text, Typeface.BOLD);
        v.setPadding(dp(8), dp(4), dp(8), dp(4));
        v.setOnClickListener(x -> {
            if (bottomExpanded && s.contentEquals(bottomTitle.getText())) {
                setBottomExpanded(false);
            } else {
                bottom(s);
            }
        });
        return v;
    }

    private TextView panelText(String s, int c) {
        TextView v = label(s, 12, c, Typeface.NORMAL);
        v.setPadding(dp(6), dp(7), dp(6), dp(7));
        return v;
    }

    private TextView label(String s, int sp, int color, int style) {
        TextView v = new TextView(this);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setTypeface(Typeface.DEFAULT, style);
        return v;
    }

    private LinearLayout vertical() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    private LinearLayout horizontal() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);
        return l;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(-2, -2);
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private static final class CommandAction {
        private final String label;
        private final Runnable action;

        private CommandAction(String label, Runnable action) {
            this.label = label;
            this.action = action;
        }
    }

    private static final class AndroidSyntax {
        private static final Pattern TOKEN = Pattern.compile(
                "(//[^\\n]*|/\\*[\\s\\S]*?\\*/|#[^\\n]*)"
                        + "|(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')"
                        + "|(\\b\\d+(?:\\.\\d+)?\\b)"
                        + "|(\\b(algoritmo|var|inicio|fimalgoritmo|se|entao|senao|fimse|enquanto|fimenquanto|escreva|escreval|leia|inteiro|real|literal|logico|caractere|class|public|private|return|if|else|for|while|function|const|let|var|import|package|new|null|true|false)\\b)"
                        + "|(\\b[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\())",
                Pattern.CASE_INSENSITIVE);

        static void apply(Spannable text, int defaultColor) {
            ForegroundColorSpan[] oldSpans = text.getSpans(0, text.length(), ForegroundColorSpan.class);
            for (ForegroundColorSpan span : oldSpans) {
                text.removeSpan(span);
            }
            Matcher m = TOKEN.matcher(text.toString());
            while (m.find()) {
                int c = defaultColor;
                if (m.group(1) != null) c = Color.rgb(106, 153, 85);
                else if (m.group(2) != null) c = Color.rgb(206, 145, 120);
                else if (m.group(3) != null) c = Color.rgb(181, 206, 168);
                else if (m.group(4) != null) c = Color.rgb(86, 156, 214);
                else if (m.group(6) != null) c = Color.rgb(220, 220, 170);
                text.setSpan(new ForegroundColorSpan(c), m.start(), m.end(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
        }
    }
}
