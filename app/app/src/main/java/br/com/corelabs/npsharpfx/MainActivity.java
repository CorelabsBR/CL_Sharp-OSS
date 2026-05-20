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
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.TextWatcher;
import android.text.style.BackgroundColorSpan;
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
import android.widget.ImageView;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import br.com.corelabs.npsharpfx.backend.editor.search.EditorSearchEngine;
import br.com.corelabs.npsharpfx.backend.editor.search.ReplaceResult;
import br.com.corelabs.npsharpfx.backend.editor.search.SearchMatch;
import br.com.corelabs.npsharpfx.backend.editor.search.SearchOptions;
import br.com.corelabs.npsharpfx.backend.editor.search.SearchResult;
import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;
import br.com.corelabs.npsharpfx.backend.runtime.AndroidRuntimeManager;
import br.com.corelabs.npsharpfx.backend.runtime.LanguageRuntime;
import br.com.corelabs.npsharpfx.backend.shell.ShellOutputListener;
import br.com.corelabs.npsharpfx.backend.shell.ShellResult;
import br.com.corelabs.npsharpfx.backend.shell.ShellRuntime;
import br.com.corelabs.npsharpfx.backend.shell.ShellRuntimeInfo;
import br.com.corelabs.npsharpfx.backend.terminal.AnsiTerminalRenderer;
import br.com.corelabs.npsharpfx.backend.terminal.TerminalProcessListener;
import br.com.corelabs.npsharpfx.backend.terminal.TerminalProcessManager;
import br.com.corelabs.npsharpfx.backend.terminal.TerminalProcessState;
import br.com.corelabs.npsharpfx.frontend.theme.mobile.ThemeInterpolation;
import br.com.corelabs.npsharpfx.frontend.theme.mobile.ThemeJsonParser;
import br.com.corelabs.npsharpfx.frontend.theme.mobile.ThemeManager;
import br.com.corelabs.npsharpfx.frontend.theme.mobile.ThemeModel;
import br.com.corelabs.npsharpfx.frontend.theme.mobile.ThemeObserver;

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
    private TextView commandBarText;
    private TextView console;
    private ScrollView consoleScroll;
    private EditText terminalInput;
    private View editorScrollView;
    private LinearLayout welcomePane;
    private LinearLayout statusBarView;
    private TextView statusLeft;
    private TextView statusRight;
    private TextView bottomTitle;
    private LinearLayout.LayoutParams bottomPanelParams;

    private DocumentFile workspace;
    private DocumentFile currentFile;
    private AndroidRuntimeManager runtimeManager;
    private TerminalProcessManager terminalProcessManager;
    private final ExecutorService searchExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "npsharp-search");
        thread.setDaemon(true);
        return thread;
    });
    private final EditorSearchEngine searchEngine = new EditorSearchEngine();
    private SearchResult activeSearchResult = new SearchResult("", List.of(), -1, null);
    private String activeSearchQuery = "";
    private String activeReplacement = "";
    private SearchOptions activeSearchOptions = SearchOptions.plainIgnoreCase();
    private TextView searchCounter;
    private final Runnable thisSearchRefresh = this::pesquisarEditorAtual;
    private boolean applyingHighlight;
    private boolean programaRodando;
    private boolean compactLayout;
    private boolean bottomExpanded;
    private ThemeModel currentTheme = ThemeModel.Default;
    private ThemeObserver themeObserver;
    private final LinkedBlockingQueue<String> entradasPrograma = new LinkedBlockingQueue<>();
    private final List<DocumentFile> openFiles = new ArrayList<>();
    private String activePanel = "explorer";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        compactLayout = false;
        runtimeManager = new AndroidRuntimeManager(this);
        ShellRuntime.initialize(this);
        terminalProcessManager = new TerminalProcessManager(this);
        restoreWorkspace();
        ThemeManager.initialize(this);
        //a um dois, Xingú, três quatro,Brasil!
        restaurarTema();
        setContentView(buildUi());
        themeObserver = theme -> runOnUiThread(() -> animateThemeTo(theme));
        ThemeManager.addObserver(themeObserver, false);
        showPanel("explorer");
        if (workspace == null) {
            showNoWorkspace();
        } else {
            restaurarArquivoAtual();
        }
    }

    @Override
    protected void onDestroy() {
        if (themeObserver != null) {
            ThemeManager.removeObserver(themeObserver);
        }
        if (terminalProcessManager != null) terminalProcessManager.shutdown();
        searchExecutor.shutdownNow();
        super.onDestroy();
    }

    private View buildUi() {
        root = vertical();
        root.setBackgroundColor(bg);
        root.addView(buildTop(), matchWrap());
        root.addView(buildWorkArea(), new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(buildStatusBar(), new LinearLayout.LayoutParams(-1, dp(24)));
        return root;
    }

    private View buildTop() {
        LinearLayout top = horizontal();
        top.setBackgroundColor(titleBg);
        top.setMinimumHeight(dp(36));
        top.setPadding(dp(8), 0, dp(4), 0);
        topBar = top;
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout menu = topBar;
        //QUANDO EU MORRER QUERO IR DE FALL E DE BERETTA!

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.npsharp_app);
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        menu.addView(logo, new LinearLayout.LayoutParams(dp(24), dp(24)));

        menu.addView(titleMenuButton("File", v -> menuArquivo()));
        menu.addView(titleMenuButton("Edit", v -> menuEditar()));
        menu.addView(titleMenuButton("Selection", v -> menuEditar()));
        menu.addView(titleMenuButton("View", v -> menuExibir()));
        menu.addView(titleMenuButton("Go To", v -> abrirRapido()));
        menu.addView(titleMenuButton("More", v -> menuExecutar()));

        menu.addView(titleIconText("<", v -> status("Voltar", "NPSharp")));
        menu.addView(titleIconText(">", v -> status("Avancar", "NPSharp")));

        View leftSpacer = new View(this);
        menu.addView(leftSpacer, new LinearLayout.LayoutParams(0, 1, 1));

        commandBar = horizontal();
        LinearLayout command = commandBar;
        command.setGravity(Gravity.CENTER_VERTICAL);
        command.setPadding(dp(10), 0, dp(10), 0);
        command.setBackground(borderBg(Color.rgb(26, 26, 26), accent, dp(4), 1));
        command.setMinimumHeight(dp(28));
        command.setOnClickListener(v -> abrirRapido());
        commandBarText = label(workspace == null ? "Nenhuma pasta aberta" : caminho(workspace), 13, text, Typeface.NORMAL);
        commandBarText.setSingleLine(true);
        command.addView(commandBarText, new LinearLayout.LayoutParams(-1, -2));
        menu.addView(command, new LinearLayout.LayoutParams(dp(520), dp(28)));

        View rightSpacer = new View(this);
        menu.addView(rightSpacer, new LinearLayout.LayoutParams(0, 1, 1));
        //CHEGAR NO INFERNO E DAR UM TIRO NO CAPETAAAA!
        menu.addView(titleIconText("|", v -> status("Split editor", "Layout")));
        menu.addView(titleIconText("[]", v -> status("Editor layout", "Layout")));
        menu.addView(titleIconText("[_]", v -> showPanel("explorer")));
        menu.addView(titleIconText("||", v -> bottom("TERMINAL")));

        menu.addView(titleIconText("-", v -> status("Minimizar indisponivel no Android", "Janela")));
        menu.addView(titleIconText("[]", v -> status("Maximizar indisponivel no Android", "Janela")));
        menu.addView(titleIconText("X", v -> finish()));
        return top;
    }

    private View buildWorkArea() {
        workArea = horizontal();
        workArea.addView(buildActivityBar(), new LinearLayout.LayoutParams(dp(48), -1));

        View side = buildSidePanel();
        editorArea = buildEditorArea();
        if (compactLayout) {
            workArea.addView(side, new LinearLayout.LayoutParams(0, -1, 1));
            workArea.addView(editorArea, new LinearLayout.LayoutParams(0, -1, 1));
            sidePanel.setVisibility(View.GONE);
        } else {
            workArea.addView(side, new LinearLayout.LayoutParams(dp(320), -1));
            workArea.addView(editorArea, new LinearLayout.LayoutParams(0, -1, 1));
        }
        return workArea;
    }
    // E O CAPETA VAI GRITAR DESESPERADOO

    private View buildActivityBar() {
        activityBar = vertical();
        activityBar.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        activityBar.setBackgroundColor(Color.rgb(24, 24, 24));
        activityBar.setPadding(0, dp(2), 0, dp(8));
        activityBar.addView(activity(R.drawable.ic_np_files, "explorer", "Explorer"));
        activityBar.addView(activity(R.drawable.ic_np_search, "search", "Busca"));
        activityBar.addView(activity(R.drawable.ic_np_branch, "git", "Git"));
        activityBar.addView(activity(R.drawable.ic_np_debug, "debug", "Executar"));
        activityBar.addView(activity(R.drawable.ic_np_extensions, "extensions", "Extensoes"));
        View spacer = new View(this);
        activityBar.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1));
        activityBar.addView(activity(R.drawable.ic_np_settings, "settings", "Config"));
        return activityBar;
    }

    private View buildSidePanel() {
        sidePanel = vertical();
        sidePanel.setPadding(0, 0, 0, 0);
        sidePanel.setBackgroundColor(sideBg);
        sideTitle = label("EXPLORER", 12, muted, Typeface.BOLD);
        sideTitle.setGravity(Gravity.CENTER_VERTICAL);
        sideTitle.setPadding(dp(14), 0, dp(8), 0);
        sideTitle.setBackgroundColor(sideBg);
        sideContent = vertical();
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(sideBg);
        scroll.addView(sideContent);
        sidePanel.addView(sideTitle, new LinearLayout.LayoutParams(-1, dp(35)));
        sidePanel.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        return sidePanel;
    }
    //MEU DEUS DO CÉU TIRA DAQUI ESSE SOLDADOO!

    
    private View buildEditorArea() {
        LinearLayout area = vertical();
        area.setBackgroundColor(bg);
        tabRow = horizontal();
        tabRow.setBackgroundColor(sideBg);
        if (compactLayout) tabRow.setVisibility(View.GONE);
        fileTitle = label("Sem arquivo", 12, text, Typeface.BOLD);
        fileTitle.setSingleLine(true);
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
                if (activeSearchQuery != null && !activeSearchQuery.isBlank()) {
                    editor.removeCallbacks(thisSearchRefresh);
                    editor.postDelayed(thisSearchRefresh, 320);
                }
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
        editorScrollView = h;
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
        welcomePane = buildWelcomePane();
        area.addView(tabRow, matchWrap());
        area.addView(fileTitle, matchWrap());
        area.addView(welcomePane, new LinearLayout.LayoutParams(-1, 0, 1));
        area.addView(h, new LinearLayout.LayoutParams(-1, 0, 1));
        bottomPanelParams = new LinearLayout.LayoutParams(-1, 0);
        area.addView(bottomPanel, bottomPanelParams);
        setBottomExpanded(false);
        atualizarNumerosLinha();
        updateEditorSurface();
        return area;
    }

    private LinearLayout buildWelcomePane() {
        LinearLayout welcome = vertical();
        welcome.setGravity(Gravity.CENTER);
        welcome.setBackgroundColor(bg);
        welcome.setPadding(dp(40), dp(24), dp(40), dp(24));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.npsharp_wlclogo);
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        welcome.addView(logo, new LinearLayout.LayoutParams(dp(128), dp(128)));

        TextView title = label("NPSharp", 28, text, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(12), 0, 0);
        welcome.addView(title, wrapWrap());

        TextView subtitle = label("Tecnologia sem limites.", 14, text, Typeface.NORMAL);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setTextColor(muted);
        subtitle.setPadding(0, dp(6), 0, dp(32));
        welcome.addView(subtitle, wrapWrap());

        welcome.addView(welcomeAction("Novo Arquivo", "Ctrl+N", v -> novoArquivo()), new LinearLayout.LayoutParams(dp(280), dp(36)));
        welcome.addView(welcomeAction("Abrir Arquivo", "Ctrl+O", v -> abrirWorkspace()), new LinearLayout.LayoutParams(dp(280), dp(36)));
        TextView save = label("Salvar Arquivo      Ctrl+S", 13, muted, Typeface.NORMAL);
        save.setGravity(Gravity.CENTER);
        save.setPadding(0, dp(18), 0, 0);
        welcome.addView(save, wrapWrap());
        return welcome;
    }

    private View welcomeAction(String action, String shortcut, View.OnClickListener listener) {
        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(10), 0, dp(10), 0);
        row.setOnClickListener(listener);
        TextView left = label(action, 14, text, Typeface.NORMAL);
        TextView right = label(shortcut, 14, text, Typeface.NORMAL);
        right.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        row.addView(left, new LinearLayout.LayoutParams(0, -2, 1));
        row.addView(right, new LinearLayout.LayoutParams(0, -2, 1));
        return row;
    }

    private View buildStatusBar() {
        LinearLayout status = horizontal();
        statusBarView = status;
        status.setGravity(Gravity.CENTER_VERTICAL);
        status.setPadding(dp(10), 0, dp(10), 0);
        status.setBackgroundColor(Color.rgb(13, 13, 13));
        TextView git = label("$(git) sem repo", 12, Color.WHITE, Typeface.NORMAL);
        git.setGravity(Gravity.CENTER_VERTICAL);
        git.setPadding(dp(8), 0, dp(8), 0);
        git.setBackgroundColor(Color.rgb(25, 25, 25));
        statusLeft = label("Pronto", 12, Color.WHITE, Typeface.NORMAL);
        statusRight = label("Debug    Terminal    NPSharp", 12, Color.WHITE, Typeface.NORMAL);
        status.addView(git, new LinearLayout.LayoutParams(-2, -1));
        status.addView(statusLeft, new LinearLayout.LayoutParams(0, -2, 1));
        status.addView(statusRight, wrapWrap());
        return status;
    }

    private void updateEditorSurface() {
        boolean hasFile = currentFile != null;
        if (welcomePane != null) welcomePane.setVisibility(hasFile ? View.GONE : View.VISIBLE);
        if (editorScrollView != null) editorScrollView.setVisibility(hasFile ? View.VISIBLE : View.GONE);
        if (fileTitle != null) fileTitle.setVisibility(hasFile ? View.VISIBLE : View.GONE);
        if (tabRow != null) tabRow.setVisibility(hasFile ? View.VISIBLE : View.GONE);
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
        tb.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        tb.setPadding(dp(8), 0, dp(8), 0);
        tb.setBackgroundColor(sideBg);
        View spacer = new View(this);
        tb.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        tb.addView(iconPanel(R.drawable.ic_np_add_file, "Novo arquivo", v -> novoArquivo()), new LinearLayout.LayoutParams(dp(30), dp(32)));
        tb.addView(iconPanel(R.drawable.ic_np_new_folder, "Nova pasta", v -> novaPasta()), new LinearLayout.LayoutParams(dp(30), dp(32)));
        tb.addView(iconPanel(R.drawable.ic_np_folder_open, "Abrir workspace", v -> abrirWorkspace()), new LinearLayout.LayoutParams(dp(30), dp(32)));
        tb.addView(iconPanel(R.drawable.ic_np_refresh, "Atualizar", v -> showPanel("explorer")), new LinearLayout.LayoutParams(dp(30), dp(32)));
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
            row.setSingleLine(true);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setMinHeight(dp(23));
            row.setPadding(dp(10 + depth * 14), 0, dp(6), 0);
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
        LinearLayout options = horizontal();
        Button regex = toggleButton(".*", false);
        Button cs = toggleButton("Aa", false);
        Button word = toggleButton("\\b", false);
        options.addView(regex, new LinearLayout.LayoutParams(0, dp(34), 1));
        options.addView(cs, new LinearLayout.LayoutParams(0, dp(34), 1));
        options.addView(word, new LinearLayout.LayoutParams(0, dp(34), 1));
        searchCounter = panelText("0 de 0", muted);
        p.addView(busca, matchWrap());
        p.addView(subst, matchWrap());
        p.addView(options, matchWrap());
        p.addView(searchCounter, matchWrap());
        p.addView(panelButton("Buscar proximo", v -> buscarProximo()), matchWrap());
        p.addView(panelButton("Buscar anterior", v -> buscarAnterior()), matchWrap());
        p.addView(panelButton("Substituir", v -> substituirAtual()), matchWrap());
        p.addView(panelButton("Substituir tudo", v -> substituirTudoEditor()), matchWrap());
        Runnable schedule = () -> {
            activeSearchQuery = busca.getText().toString();
            activeReplacement = subst.getText().toString();
            activeSearchOptions = new SearchOptions(regex.isSelected(), cs.isSelected(), word.isSelected(), true);
            editor.removeCallbacks(this::pesquisarEditorAtual);
            editor.postDelayed(this::pesquisarEditorAtual, 260);
        };
        TextWatcher watcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { schedule.run(); }
            @Override public void afterTextChanged(Editable s) {}
        };
        busca.addTextChangedListener(watcher);
        subst.addTextChangedListener(watcher);
        View.OnClickListener refreshOptions = v -> {
            v.setSelected(!v.isSelected());
            v.setBackgroundColor(v.isSelected() ? accent : titleBg);
            schedule.run();
        };
        regex.setOnClickListener(refreshOptions);
        cs.setOnClickListener(refreshOptions);
        word.setOnClickListener(refreshOptions);
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
        p.addView(panelButton("Parar", v -> {
            cancelarTerminal();
            appendConsole("[Debug] parado");
        }), matchWrap());
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
        p.addView(panelButton("Runtime shell", v -> mostrarShellRuntime()), matchWrap());
        p.addView(panelButton("Tema", v -> escolherTema()), matchWrap());
        p.addView(panelText("Pressione e segure arquivo/pasta para abrir o menu.", muted), matchWrap());
        p.addView(panelText("Shell atual: " + shellRuntimeLabel(), muted), matchWrap());
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
            if (commandBarText != null) commandBarText.setText(caminho(workspace));
            updateEditorSurface();
            showPanel("explorer");
            status("Workspace salvo: " + nome(workspace), "Explorer");
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
            fileTitle.setText(tituloArquivo(file));
            updateEditorSurface();
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
        if (runtime == LanguageRuntime.SHELL || nome(currentFile).toLowerCase(Locale.ROOT).endsWith(".sh")) {
            bottom("TERMINAL");
            appendConsole("[Shell] executando arquivo: " + tituloArquivo(currentFile));
            executarShellAndroid(editor.getText().toString());
            return;
        }
        AndroidRuntimeManager.RuntimeStatus runtimeStatus = runtimeManager.status(runtime);
        appendConsole("[Runtime] " + runtimeStatus.language().displayName() + ": " + runtimeStatus.message());
        appendConsole("[Android] Abra este workspace no desktop para executar/debugar esse runtime externo.");
    }

    private void buscar(String query) {
        activeSearchQuery = query == null ? "" : query;
        pesquisarEditorAtual();
    }

    private void substituirTudo(String search, String replace) {
        activeSearchQuery = search == null ? "" : search;
        activeReplacement = replace == null ? "" : replace;
        substituirTudoEditor();
    }

    private void pesquisarEditorAtual() {
        String query = activeSearchQuery;
        String textSnapshot = editor == null ? "" : editor.getText().toString();
        int cursor = editor == null ? 0 : Math.max(0, editor.getSelectionStart());
        SearchOptions options = activeSearchOptions;
        searchExecutor.submit(() -> {
            SearchResult result = searchEngine.find(textSnapshot, query, options, cursor);
            runOnUiThread(() -> {
                activeSearchResult = result;
                aplicarHighlight();
                aplicarSearchHighlights(result);
                atualizarSearchCounter();
                if (result.hasError()) status("Busca invalida: " + result.getError(), "Busca");
                else status(result.getMatches().size() + " resultado(s)", "Busca");
            });
        });
    }

    private void buscarProximo() {
        if (activeSearchResult == null || activeSearchResult.getMatches().isEmpty()) return;
        int next = activeSearchResult.getSelectedIndex() + 1;
        if (next >= activeSearchResult.getMatches().size()) next = 0;
        selecionarMatch(next);
    }

    private void buscarAnterior() {
        if (activeSearchResult == null || activeSearchResult.getMatches().isEmpty()) return;
        int prev = activeSearchResult.getSelectedIndex() - 1;
        if (prev < 0) prev = activeSearchResult.getMatches().size() - 1;
        selecionarMatch(prev);
    }

    private void selecionarMatch(int index) {
        if (activeSearchResult == null || index < 0 || index >= activeSearchResult.getMatches().size()) return;
        SearchMatch match = activeSearchResult.getMatches().get(index);
        activeSearchResult = new SearchResult(activeSearchResult.getQuery(), activeSearchResult.getMatches(), index, activeSearchResult.getError());
        editor.requestFocus();
        editor.setSelection(match.getStart(), match.getEnd());
        atualizarSearchCounter();
    }

    private void substituirAtual() {
        if (activeSearchResult == null || activeSearchResult.getMatches().isEmpty()) return;
        int selected = Math.max(0, activeSearchResult.getSelectedIndex());
        ReplaceResult result = searchEngine.replaceCurrent(editor.getText().toString(), activeSearchResult, activeReplacement, selected, activeSearchOptions);
        if (result.getReplacements() > 0) {
            editor.getText().replace(0, editor.length(), result.getText());
            editor.setSelection(Math.min(result.getCursor(), editor.length()));
            pesquisarEditorAtual();
        }
    }

    private void substituirTudoEditor() {
        String query = activeSearchQuery;
        String replacement = activeReplacement;
        String textSnapshot = editor == null ? "" : editor.getText().toString();
        int cursor = editor == null ? 0 : Math.max(0, editor.getSelectionStart());
        SearchOptions options = activeSearchOptions;
        searchExecutor.submit(() -> {
            ReplaceResult result = searchEngine.replaceAll(textSnapshot, query, replacement, options, cursor);
            runOnUiThread(() -> {
                if (result.getError() != null) {
                    status("Substituir falhou: " + result.getError(), "Substituir");
                    return;
                }
                editor.getText().replace(0, editor.length(), result.getText());
                editor.setSelection(Math.min(result.getCursor(), editor.length()));
                pesquisarEditorAtual();
                status(result.getReplacements() + " substituicao(oes)", "Substituir");
            });
        });
    }

    private void aplicarSearchHighlights(SearchResult result) {
        if (editor == null || result == null) return;
        Editable editable = editor.getText();
        BackgroundColorSpan[] oldSpans = editable.getSpans(0, editable.length(), BackgroundColorSpan.class);
        for (BackgroundColorSpan span : oldSpans) editable.removeSpan(span);
        int normal = shade(currentTheme.getEditorSelection(), -0.30f);
        int active = currentTheme.getEditorSelection();
        List<SearchMatch> matches = result.getMatches();
        for (int i = 0; i < matches.size(); i++) {
            SearchMatch match = matches.get(i);
            if (match.getStart() >= 0 && match.getEnd() <= editable.length()) {
                editable.setSpan(new BackgroundColorSpan(i == result.getSelectedIndex() ? active : normal),
                        match.getStart(), match.getEnd(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
        }
    }

    private void atualizarSearchCounter() {
        if (searchCounter == null || activeSearchResult == null) return;
        int total = activeSearchResult.getMatches().size();
        int selected = total == 0 ? 0 : activeSearchResult.getSelectedIndex() + 1;
        searchCounter.setText(selected + " de " + total);
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
            String[] finalThemes = ThemeManager.availableThemeNames();
            new AlertDialog.Builder(this)
                    .setTitle("Tema de cores")
                    .setItems(finalThemes, (d, which) -> aplicarTema(ThemeManager.assetNameAt(which)))
                    .show();
        } catch (Exception e) {
            status("Erro ao listar temas", "Tema");
        }
    }

    private void aplicarTema(String assetName) {
        try {
            if (!ThemeManager.setThemeByAsset(assetName)) {
                status("Tema nao encontrado: " + assetName, "Tema");
            }
        } catch (Exception e) {
            applyDefaultTheme();
            refreshColors();
            status("Erro ao aplicar tema", "Tema");
        }
    }

    private void restaurarTema() {
        applyThemeModel(ThemeManager.getCurrentTheme());
    }

    private void applyDefaultTheme() {
        applyThemeModel(ThemeModel.Default);
    }

    private void applyThemeJson(String json) {
        applyThemeModel(ThemeJsonParser.parse("inline.json", json));
    }

    private void animateThemeTo(ThemeModel theme) {
        if (root == null) {
            applyThemeModel(theme);
            return;
        }
        ThemeModel from = currentTheme == null ? ThemeModel.Default : currentTheme;
        ThemeInterpolation.animate(from, theme, frame -> runOnUiThread(() -> {
            applyThemeModel(frame);
            refreshColors();
            aplicarHighlight();
        }));
        status("Tema aplicado: " + theme.getName(), "Tema");
    }

    private void applyThemeModel(ThemeModel theme) {
        currentTheme = theme;
        bg = theme.getEditorBackground();
        text = ensureContrast(theme.getEditorForeground(), bg);
        sideBg = theme.getSideBarBackground();
        titleBg = theme.getTitleBarBackground();
        panelBg = theme.getTerminalBackground();
        accent = theme.getFocusBorder();
        muted = theme.getTextMuted();
    }

    private void refreshColors() {
        root.setBackgroundColor(bg);
        if (topBar != null) topBar.setBackgroundColor(titleBg);
        if (commandBar != null) commandBar.setBackground(borderBg(currentTheme.getSurfaceElevated(), currentTheme.getFocusBorder(), dp((int) currentTheme.getInputRadius()), 1));
        if (commandBarText != null) commandBarText.setTextColor(text);
        if (activityBar != null) activityBar.setBackgroundColor(currentTheme.getNavBarBackground());
        sidePanel.setBackgroundColor(sideBg);
        if (sideTitle != null) {
            sideTitle.setBackgroundColor(sideBg);
            sideTitle.setTextColor(currentTheme.getSideBarForeground());
        }
        tabRow.setBackgroundColor(sideBg);
        if (welcomePane != null) welcomePane.setBackgroundColor(bg);
        editor.setBackgroundColor(bg);
        editor.setTextColor(text);
        editor.setHighlightColor(currentTheme.getEditorSelection());
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            if (editor.getTextCursorDrawable() != null) {
                editor.getTextCursorDrawable().setTint(currentTheme.getEditorCursor());
            }
        }
        if (lineNumbers != null) {
            lineNumbers.setBackgroundColor(currentTheme.getEditorGutterBackground());
            lineNumbers.setTextColor(currentTheme.getEditorLineNumber());
        }
        fileTitle.setBackgroundColor(currentTheme.getTabActiveBackground());
        fileTitle.setTextColor(currentTheme.getTabActiveForeground());
        bottomPanel.setBackgroundColor(panelBg);
        if (consoleScroll != null) consoleScroll.setBackgroundColor(panelBg);
        console.setBackgroundColor(panelBg);
        console.setTextColor(currentTheme.getTerminalForeground());
        console.setHighlightColor(currentTheme.getTerminalSelection());
        terminalInput.setBackgroundColor(currentTheme.getSurfaceElevated());
        terminalInput.setTextColor(currentTheme.getTerminalForeground());
        terminalInput.setHintTextColor(muted);
        if (statusBarView != null) statusBarView.setBackgroundColor(currentTheme.getStatusBarBackground());
        if (statusLeft != null) statusLeft.setTextColor(currentTheme.getStatusBarForeground());
        if (statusRight != null) statusRight.setTextColor(currentTheme.getStatusBarForeground());
        recolorChildren(root);
        boolean editorVisible = editorArea != null && editorArea.getVisibility() == View.VISIBLE;
        if (!compactLayout || !editorVisible) {
            showPanel(activePanel);
        }
    }

    private void recolorChildren(View view) {
        if (view instanceof Button) {
            Button button = (Button) view;
            button.setTextColor(currentTheme.getButtonForeground());
        } else if (view instanceof ImageButton) {
            ((ImageButton) view).setColorFilter(currentTheme.getSideBarForeground());
        } else if (view instanceof TextView
                && view != editor
                && view != console
                && view != statusLeft
                && view != statusRight
                && view != sideTitle
                && view != lineNumbers
                && view != fileTitle
                && view != commandBarText) {
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
                updateEditorSurface();
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
        if (commandBarText != null) commandBarText.setText("Nenhuma pasta aberta");
        updateEditorSurface();
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
        AndroidSyntax.apply(editable, currentTheme);
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
        menu("Terminal", new String[] {"Mostrar terminal", "Cancelar processo", "Ocultar painel", "Focar entrada", "Limpar", "Listar workspace", "Runtime shell", "Ajuda"},
                new Runnable[] {this::focarTerminal, this::cancelarTerminal, () -> setBottomExpanded(false), this::focarTerminal, () -> console.setText(""), this::listarWorkspaceNoConsole, this::mostrarShellRuntime, this::ajudaTerminal});
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
        } else if ("shell".equals(lower)) {
            mostrarShellRuntime();
        } else if ("shell redetect".equals(lower) || "shell detectar".equals(lower)) {
            ShellRuntimeInfo info = br.com.corelabs.npsharpfx.backend.shell.ShellRuntimeManager.getInstance(this).redetectRuntime();
            appendConsole("[Terminal] Runtime shell redetectado: " + info.getName() + " (" + info.getExecutablePath() + ")");
        } else if (lower.startsWith("shell ")) {
            appendConsole("[Terminal] Configurar shell por caminho foi removido.");
            appendConsole("[Terminal] Android bloqueia exec cross-app, incluindo /data/data/com.termux/.");
            appendConsole("[Terminal] Use o runtime detectado automaticamente: " + shellRuntimeLabel());
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
        appendConsole("[Terminal] ativo. Comandos: ajuda, limpar, ls, pwd, cat, abrir <nome>, code <arquivo>, salvar, executar, runtimes, instalar runtimes, editor, terminal, explorer, append <texto>, shell.");
        appendConsole("[Terminal] Comandos desconhecidos rodam via runtime NPSharp: " + shellRuntimeLabel() + ".");
        appendConsole("[Terminal] Termux/caminhos privados de outros apps nao sao usados: Android sandbox + SELinux bloqueiam exec cross-app.");
        appendConsole("[Terminal] Durante leia() do Portugol, o texto digitado vira entrada do programa.");
    }

    private void executarShellAndroid(String comando) {
        appendConsole("[Shell:" + shellRuntimeLabel() + "] " + comando);
        terminalProcessManager.execute(comando, new TerminalProcessListener() {
            @Override public void onStdout(String output) {
                appendConsoleAnsi(output);
            }
            @Override public void onStderr(String output) {
                appendConsoleAnsi(output);
            }
            @Override public void onLog(String text) {
                appendConsole(text);
            }
            @Override public void onStateChanged(TerminalProcessState state) {
                status("Terminal: " + state, "Terminal");
                if (state != TerminalProcessState.RUNNING) {
                    terminalInput.setHint("> terminal ativo");
                }
            }
            @Override public void onFinished(ShellResult result) {
                appendConsole("[Shell] codigo de saida: " + result.getExitCode() + " (" + result.getExecutionTimeMs() + "ms)");
            }
        }, 60_000L);
    }

    private void cancelarTerminal() {
        if (terminalProcessManager != null && terminalProcessManager.isAlive()) {
            terminalProcessManager.sendCtrlC();
            appendConsole("[Terminal] processo cancelado.");
        } else {
            appendConsole("[Terminal] nenhum processo ativo.");
        }
        terminalInput.setHint("> terminal ativo");
        status("Terminal parado", "Terminal");
    }

    private String shellRuntimeLabel() {
        ShellRuntimeInfo info = ShellRuntime.runtimeInfo();
        return info.getName() + " @ " + info.getExecutablePath();
    }

    private void mostrarShellRuntime() {
        ShellRuntimeInfo info = ShellRuntime.runtimeInfo();
        bottom("TERMINAL");
        appendConsole("[Terminal] Runtime ativo: " + info.getName());
        appendConsole("[Terminal] Caminho: " + info.getExecutablePath());
        appendConsole("[Terminal] Tipo: " + info.getType());
        appendConsole("[Terminal] ABI: " + (android.os.Build.SUPPORTED_ABIS.length == 0 ? "desconhecida" : android.os.Build.SUPPORTED_ABIS[0]));
        appendConsole("[Terminal] Ordem de fallback: /system/bin/sh -> /system/bin/toybox sh -> assets/bin -> shell interno.");
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

    private String tituloArquivo(DocumentFile file) {
        if (file == null) return "Sem arquivo";
        String relative = caminhoRelativo(file);
        return abreviarMeio(relative == null || relative.isBlank() ? nome(file) : relative, 64);
    }

    private String caminhoRelativo(DocumentFile file) {
        String filePath = ultimoSegmentoUri(file);
        if (filePath.isBlank()) return nome(file);
        String workspacePath = ultimoSegmentoUri(workspace);
        if (!workspacePath.isBlank() && filePath.startsWith(workspacePath)) {
            String relative = filePath.substring(workspacePath.length());
            while (relative.startsWith("/") || relative.startsWith(":")) {
                relative = relative.substring(1);
            }
            return relative.isBlank() ? nome(file) : relative;
        }
        int slash = filePath.lastIndexOf('/');
        return slash >= 0 && slash + 1 < filePath.length() ? filePath.substring(slash + 1) : filePath;
    }

    private String ultimoSegmentoUri(DocumentFile file) {
        if (file == null || file.getUri() == null || file.getUri().getLastPathSegment() == null) return "";
        return Uri.decode(file.getUri().getLastPathSegment()).replace('\\', '/');
    }

    private String abreviarMeio(String value, int max) {
        if (value == null || value.length() <= max) return value == null ? "" : value;
        int keep = Math.max(12, (max - 3) / 2);
        return value.substring(0, keep) + "..." + value.substring(value.length() - keep);
    }

    private boolean uriEquals(DocumentFile a, DocumentFile b) {
        return a != null && b != null && a.getUri().equals(b.getUri());
    }

    private String linguagem(DocumentFile f) {
        String n = nome(f).toLowerCase(Locale.ROOT);
        if (n.endsWith(".gol") || n.endsWith(".por") || n.endsWith(".portugol") || n.endsWith(".alg")) return "Portugol";
        if (n.endsWith(".sh")) return "Shell";
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

    private void appendConsoleAnsi(String text) {
        if (text == null || text.isEmpty()) return;
        SpannableStringBuilder builder = new SpannableStringBuilder(console.getText());
        AnsiTerminalRenderer.appendAnsi(builder, text, currentTheme.getTerminalForeground());
        console.setText(builder);
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

    private TextView titleMenuButton(String s, View.OnClickListener l) {
        TextView b = label(s, 13, text, Typeface.NORMAL);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(8), 0, dp(8), 0);
        b.setMinHeight(dp(34));
        b.setOnClickListener(l);
        return b;
    }

    private TextView titleIconText(String s, View.OnClickListener l) {
        TextView b = label(s, 14, muted, Typeface.NORMAL);
        b.setGravity(Gravity.CENTER);
        b.setPadding(0, 0, 0, 0);
        b.setMinWidth(dp(32));
        b.setMinHeight(dp(34));
        b.setOnClickListener(l);
        return b;
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

    private Button toggleButton(String s, boolean selected) {
        Button b = button(s, null, 12, selected ? accent : titleBg);
        b.setSelected(selected);
        return b;
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

    private GradientDrawable borderBg(int fill, int stroke, int radius, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        drawable.setStroke(strokeWidth, stroke);
        return drawable;
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

        static void apply(Spannable text, ThemeModel theme) {
            ForegroundColorSpan[] oldSpans = text.getSpans(0, text.length(), ForegroundColorSpan.class);
            for (ForegroundColorSpan span : oldSpans) {
                text.removeSpan(span);
            }
            Matcher m = TOKEN.matcher(text.toString());
            while (m.find()) {
                int c = theme.getEditorForeground();
                if (m.group(1) != null) c = theme.getSyntaxComment();
                else if (m.group(2) != null) c = theme.getSyntaxString();
                else if (m.group(3) != null) c = theme.getSyntaxNumber();
                else if (m.group(4) != null) c = theme.getSyntaxKeyword();
                else if (m.group(6) != null) c = theme.getSyntaxFunction();
                text.setSpan(new ForegroundColorSpan(c), m.start(), m.end(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
        }
    }
}
