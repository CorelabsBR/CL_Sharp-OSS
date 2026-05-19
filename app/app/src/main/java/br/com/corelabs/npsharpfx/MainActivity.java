package br.com.corelabs.npsharpfx;

import android.app.AlertDialog;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;

public class MainActivity extends Activity {

    private static final int BG = Color.rgb(30, 30, 30);
    private static final int SIDE_BG = Color.rgb(37, 37, 38);
    private static final int PANEL_BG = Color.rgb(24, 24, 24);
    private static final int TEXT = Color.rgb(220, 220, 220);
    private static final int MUTED = Color.rgb(150, 150, 150);
    private static final int ACCENT = Color.rgb(0, 122, 204);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AtomicInteger inputCounter = new AtomicInteger(0);
    private final Runnable highlightRunnable = this::applyHighlight;

    private LinearLayout explorerList;
    private LinearLayout sidePanel;
    private LinearLayout sideContent;
    private TextView sideTitle;
    private EditText editor;
    private TextView statusLeft;
    private TextView statusRight;
    private TextView fileTitle;
    private TextView console;
    private FrameLayout wallpaperLayer;

    private File workspaceRoot;
    private File currentFile;
    private boolean applyingHighlight;
    private boolean lightTheme;
    private String activePanel = "explorer";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        workspaceRoot = new File(getFilesDir(), "workspace");
        if (!workspaceRoot.exists()) {
            workspaceRoot.mkdirs();
        }
        seedWorkspace();

        setContentView(buildUi());
        refreshExplorer();
        openFirstFile();
        setStatus("Ready", "NPSharp Android");
    }

    private View buildUi() {
        LinearLayout root = vertical();
        root.setBackgroundColor(BG);

        root.addView(buildTitleBar(), matchWrap());
        root.addView(buildMainArea(), new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        ));
        root.addView(buildStatusBar(), new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(24)
        ));

        return root;
    }

    private View buildTitleBar() {
        LinearLayout bar = horizontal();
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8), dp(4), dp(8), dp(4));
        bar.setBackgroundColor(Color.rgb(45, 45, 48));

        TextView title = label("NPSharp Android", 15, TEXT, Typeface.BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        bar.addView(toolbarButton("New", v -> createFileDialog(false)));
        bar.addView(toolbarButton("Folder", v -> createFileDialog(true)));
        bar.addView(toolbarButton("Save", v -> saveCurrentFile()));
        bar.addView(toolbarButton("Run", v -> runCurrentFile()));
        bar.addView(toolbarButton("Search", v -> showPanel("search")));
        bar.addView(toolbarButton("Theme", v -> toggleTheme()));
        bar.addView(toolbarButton("Git", v -> showPanel("git")));

        return bar;
    }

    private View buildMainArea() {
        LinearLayout main = horizontal();

        LinearLayout editorColumn = vertical();
        editorColumn.setBackgroundColor(BG);

        fileTitle = label("Untitled", 12, TEXT, Typeface.BOLD);
        fileTitle.setPadding(dp(10), dp(6), dp(10), dp(6));
        fileTitle.setBackgroundColor(Color.rgb(43, 43, 43));
        editorColumn.addView(fileTitle, matchWrap());

        wallpaperLayer = new FrameLayout(this);
        wallpaperLayer.setBackgroundColor(BG);

        HorizontalScrollView horizontalScroll = new HorizontalScrollView(this);
        ScrollView verticalScroll = new ScrollView(this);
        editor = new EditText(this);
        editor.setMinLines(24);
        editor.setGravity(Gravity.START | Gravity.TOP);
        editor.setTextColor(TEXT);
        editor.setTextSize(14);
        editor.setTypeface(Typeface.MONOSPACE);
        editor.setBackgroundColor(BG);
        editor.setPadding(dp(12), dp(10), dp(12), dp(10));
        editor.setHorizontallyScrolling(true);
        editor.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (!applyingHighlight) {
                    handler.removeCallbacks(highlightRunnable);
                    handler.postDelayed(highlightRunnable, 180);
                }
                updateCursorStatus();
            }
            @Override public void afterTextChanged(Editable s) {}
        });
        editor.setOnClickListener(v -> updateCursorStatus());

        verticalScroll.addView(editor);
        horizontalScroll.addView(verticalScroll);
        wallpaperLayer.addView(horizontalScroll);
        editorColumn.addView(wallpaperLayer, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        ));

        console = label("", 12, TEXT, Typeface.NORMAL);
        console.setTypeface(Typeface.MONOSPACE);
        console.setPadding(dp(10), dp(8), dp(10), dp(8));
        console.setMinLines(4);
        console.setBackgroundColor(PANEL_BG);
        editorColumn.addView(console, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(116)
        ));

        main.addView(buildActivityBar(), new LinearLayout.LayoutParams(dp(48), LinearLayout.LayoutParams.MATCH_PARENT));
        main.addView(buildSidePanel(), new LinearLayout.LayoutParams(dp(250), LinearLayout.LayoutParams.MATCH_PARENT));
        main.addView(editorColumn, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1));
        return main;
    }

    private View buildActivityBar() {
        LinearLayout bar = vertical();
        bar.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        bar.setBackgroundColor(Color.rgb(51, 51, 51));
        bar.setPadding(0, dp(6), 0, 0);

        bar.addView(activityButton("EX", "explorer"));
        bar.addView(activityButton("SE", "search"));
        bar.addView(activityButton("SC", "git"));
        bar.addView(activityButton("RU", "debug"));
        bar.addView(activityButton("XT", "extensions"));
        bar.addView(activityButton("ST", "settings"));
        return bar;
    }

    private TextView activityButton(String text, String panel) {
        TextView button = label(text, 11, TEXT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0, dp(12), 0, dp(12));
        button.setOnClickListener(v -> showPanel(panel));
        return button;
    }

    private View buildSidePanel() {
        sidePanel = vertical();
        sidePanel.setBackgroundColor(SIDE_BG);
        sidePanel.setPadding(dp(6), dp(8), dp(6), dp(8));

        sideTitle = label("EXPLORER", 12, MUTED, Typeface.BOLD);
        sideTitle.setPadding(dp(4), 0, 0, dp(6));
        sidePanel.addView(sideTitle, matchWrap());

        ScrollView scroll = new ScrollView(this);
        sideContent = vertical();
        scroll.addView(sideContent);
        sidePanel.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        ));

        showPanel("explorer");
        return sidePanel;
    }

    private View buildStatusBar() {
        LinearLayout status = horizontal();
        status.setGravity(Gravity.CENTER_VERTICAL);
        status.setBackgroundColor(ACCENT);
        status.setPadding(dp(8), 0, dp(8), 0);

        statusLeft = label("Ready", 11, Color.WHITE, Typeface.NORMAL);
        statusRight = label("NPSharp Android", 11, Color.WHITE, Typeface.NORMAL);
        status.addView(statusLeft, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        status.addView(statusRight, wrapWrap());
        return status;
    }

    private void refreshExplorer() {
        if (explorerList == null) {
            return;
        }
        explorerList.removeAllViews();
        addFileRows(workspaceRoot, 0);
    }

    private void showPanel(String panel) {
        activePanel = panel;
        if (sideContent == null || sideTitle == null) {
            return;
        }

        sideContent.removeAllViews();
        switch (panel) {
            case "search":
                sideTitle.setText("SEARCH");
                sideContent.addView(buildSearchPanel(), matchWrap());
                break;
            case "git":
                sideTitle.setText("SOURCE CONTROL");
                sideContent.addView(buildGitPanel(), matchWrap());
                break;
            case "debug":
                sideTitle.setText("RUN AND DEBUG");
                sideContent.addView(buildDebugPanel(), matchWrap());
                break;
            case "extensions":
                sideTitle.setText("EXTENSIONS");
                sideContent.addView(buildExtensionsPanel(), matchWrap());
                break;
            case "settings":
                sideTitle.setText("SETTINGS");
                sideContent.addView(buildSettingsPanel(), matchWrap());
                break;
            case "explorer":
            default:
                sideTitle.setText("EXPLORER");
                explorerList = vertical();
                sideContent.addView(explorerList, matchWrap());
                refreshExplorer();
                break;
        }
        if (statusLeft != null && statusRight != null) {
            setStatus("Panel: " + sideTitle.getText(), statusRight.getText().toString());
        }
    }

    private View buildSearchPanel() {
        LinearLayout panel = vertical();
        panel.setPadding(0, dp(4), 0, 0);

        EditText search = input("Search");
        EditText replace = input("Replace");
        Button searchButton = panelButton("Search", v -> searchInWorkspace(search.getText().toString()));
        Button replaceButton = panelButton("Replace All", v -> replaceAll(search.getText().toString(), replace.getText().toString()));

        panel.addView(search, matchWrap());
        panel.addView(replace, matchWrap());
        panel.addView(searchButton, matchWrap());
        panel.addView(replaceButton, matchWrap());
        panel.addView(panelText("Results open in the bottom console.", MUTED), matchWrap());
        return panel;
    }

    private View buildGitPanel() {
        LinearLayout panel = vertical();
        panel.addView(panelText("Android does not embed desktop Git.", TEXT), matchWrap());
        panel.addView(panelText("Workspace: " + workspaceRoot.getAbsolutePath(), MUTED), matchWrap());
        panel.addView(panelButton("Show Git Info", v -> showGitInfo()), matchWrap());
        panel.addView(panelButton("Save All", v -> saveCurrentFile()), matchWrap());
        return panel;
    }

    private View buildDebugPanel() {
        LinearLayout panel = vertical();
        panel.addView(panelButton("Run current file", v -> runCurrentFile()), matchWrap());
        panel.addView(panelButton("Clear console", v -> console.setText("")), matchWrap());
        panel.addView(panelText("Portugol runs inside the app. Other runtimes need Android-specific toolchains.", MUTED), matchWrap());
        return panel;
    }

    private View buildExtensionsPanel() {
        LinearLayout panel = vertical();
        panel.addView(panelText("Bundled language support", TEXT), matchWrap());
        String[] runtimes = {"Portugol internal", "Syntax: Java/Kotlin/JS/TS/JSON/CSS/HTML/Markdown", "Workspace search", "Theme assets"};
        for (String runtime : runtimes) {
            panel.addView(panelText("- " + runtime, MUTED), matchWrap());
        }
        panel.addView(panelButton("List theme assets", v -> listThemeAssets()), matchWrap());
        return panel;
    }

    private View buildSettingsPanel() {
        LinearLayout panel = vertical();
        panel.addView(panelButton("Toggle Theme", v -> toggleTheme()), matchWrap());
        panel.addView(panelButton("New File", v -> createFileDialog(false)), matchWrap());
        panel.addView(panelButton("New Folder", v -> createFileDialog(true)), matchWrap());
        panel.addView(panelButton("Search / Replace Dialog", v -> showSearchDialog()), matchWrap());
        panel.addView(panelText("Long press a file in Explorer to rename it.", MUTED), matchWrap());
        return panel;
    }

    private void listThemeAssets() {
        console.setText("");
        try {
            String[] themes = getAssets().list("themes");
            if (themes == null || themes.length == 0) {
                appendConsole("[Themes] No bundled themes.");
                return;
            }
            for (String theme : themes) {
                appendConsole("[Theme] " + theme);
            }
            setStatus(themes.length + " theme asset(s)", "Extensions");
        } catch (Exception e) {
            setStatus("Theme list failed: " + firstLine(e.getMessage()), "Extensions");
        }
    }

    private void addFileRows(File dir, int depth) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }

        Arrays.sort(files, Comparator
                .comparing(File::isFile)
                .thenComparing(File::getName, String.CASE_INSENSITIVE_ORDER));

        for (File file : files) {
            TextView row = label((file.isDirectory() ? "> " : "  ") + file.getName(), 13, TEXT, Typeface.NORMAL);
            row.setPadding(dp(6 + depth * 12), dp(7), dp(6), dp(7));
            row.setBackgroundColor(file.equals(currentFile) ? Color.rgb(55, 55, 60) : SIDE_BG);
            row.setOnClickListener(v -> {
                if (file.isFile()) {
                    openFile(file);
                } else {
                    setStatus("Folder selected: " + file.getName(), relative(file));
                }
            });
            row.setOnLongClickListener(v -> {
                renameFileDialog(file);
                return true;
            });
            explorerList.addView(row, matchWrap());
            if (file.isDirectory()) {
                addFileRows(file, depth + 1);
            }
        }
    }

    private void openFirstFile() {
        List<File> files = listTextFiles(workspaceRoot);
        if (!files.isEmpty()) {
            openFile(files.get(0));
        }
    }

    private void openFile(File file) {
        try {
            saveCurrentFile();
            currentFile = file;
            editor.setText(readFile(file));
            fileTitle.setText(relative(file));
            applyHighlight();
            refreshExplorer();
            setStatus("Opened " + file.getName(), languageFor(file));
        } catch (Exception e) {
            setStatus("Open failed: " + firstLine(e.getMessage()), "Error");
        }
    }

    private void saveCurrentFile() {
        if (currentFile == null) {
            return;
        }

        try {
            writeFile(currentFile, editor.getText().toString());
            setStatus("Saved " + currentFile.getName(), languageFor(currentFile));
        } catch (Exception e) {
            setStatus("Save failed: " + firstLine(e.getMessage()), "Error");
        }
    }

    private void runCurrentFile() {
        saveCurrentFile();
        console.setText("");

        if (currentFile == null) {
            appendConsole("[ERRO] Nenhum arquivo aberto.");
            return;
        }

        String name = currentFile.getName().toLowerCase(Locale.ROOT);
        if (name.endsWith(".gol") || name.endsWith(".por") || name.endsWith(".portugol") || name.endsWith(".alg")) {
            runPortugol();
            return;
        }

        appendConsole("[DEBUG] Android nao executa runtimes desktop diretamente.");
        appendConsole("[DEBUG] Edicao, busca, temas e Portugol interno estao ativos.");
        setStatus("Runtime externo indisponivel no Android", languageFor(currentFile));
    }

    private void runPortugol() {
        try {
            appendConsole("[DEBUG] Runtime Portugol selecionado");
            PortugolInterpreter interpreter = new PortugolInterpreter();
            interpreter.setInputProvider(() -> "");
            interpreter.executeWithOutput(
                    editor.getText().toString(),
                    line -> runOnUiThread(() -> appendConsole("[PORTUGOL] " + line))
            );
            setStatus("Debug finalizado", "Portugol");
        } catch (Exception e) {
            appendConsole("[ERRO] " + firstLine(e.getMessage()));
            setStatus("Debug erro", "Portugol");
        }
    }

    private void showSearchDialog() {
        LinearLayout box = vertical();
        box.setPadding(dp(14), dp(8), dp(14), dp(4));

        EditText search = input("Search");
        EditText replace = input("Replace");
        box.addView(search, matchWrap());
        box.addView(replace, matchWrap());

        new AlertDialog.Builder(this)
                .setTitle("Search / Replace")
                .setView(box)
                .setPositiveButton("Search", (dialog, which) -> searchInWorkspace(search.getText().toString()))
                .setNegativeButton("Replace All", (dialog, which) ->
                        replaceAll(search.getText().toString(), replace.getText().toString()))
                .setNeutralButton("Cancel", null)
                .show();
    }

    private void searchInWorkspace(String query) {
        if (query == null || query.isBlank()) {
            setStatus("Type to search", "Search");
            return;
        }

        List<File> files = listTextFiles(workspaceRoot);
        List<String> matches = new ArrayList<>();
        for (File file : files) {
            try {
                List<String> lines = Files.readAllLines(file.toPath());
                for (int i = 0; i < lines.size(); i++) {
                    if (lines.get(i).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))) {
                        matches.add(relative(file) + ":" + (i + 1) + "  " + lines.get(i).trim());
                    }
                }
            } catch (Exception ignored) {
            }
        }

        console.setText("");
        matches.stream().limit(80).forEach(this::appendConsole);
        setStatus(matches.size() + " result(s)", "Search");
    }

    private void replaceAll(String search, String replace) {
        if (search == null || search.isBlank()) {
            setStatus("Nothing to replace", "Search");
            return;
        }

        int changed = 0;
        for (File file : listTextFiles(workspaceRoot)) {
            try {
                String content = readFile(file);
                String next = content.replace(search, replace == null ? "" : replace);
                if (!content.equals(next)) {
                    writeFile(file, next);
                    changed++;
                }
            } catch (Exception ignored) {
            }
        }

        if (currentFile != null) {
            openFile(currentFile);
        }
        setStatus(changed + " file(s) changed", "Replace");
    }

    private void createFileDialog(boolean folder) {
        EditText input = input(folder ? "Folder name" : "File name");
        new AlertDialog.Builder(this)
                .setTitle(folder ? "New Folder" : "New File")
                .setView(input)
                .setPositiveButton("Create", (dialog, which) -> createPath(input.getText().toString(), folder))
                .setNegativeButton("Cancel", null)
                .show();
        input.requestFocus();
    }

    private void createPath(String name, boolean folder) {
        if (name == null || name.isBlank()) {
            return;
        }

        try {
            File target = new File(workspaceRoot, name.trim());
            if (folder) {
                target.mkdirs();
            } else {
                if (target.getParentFile() != null) {
                    target.getParentFile().mkdirs();
                }
                if (!target.exists()) {
                    writeFile(target, "");
                }
                openFile(target);
            }
            refreshExplorer();
            setStatus("Created " + name, folder ? "Folder" : "File");
        } catch (Exception e) {
            setStatus("Create failed: " + firstLine(e.getMessage()), "Error");
        }
    }

    private void renameFileDialog(File file) {
        EditText input = input(file.getName());
        input.setText(file.getName());
        input.selectAll();

        new AlertDialog.Builder(this)
                .setTitle("Rename")
                .setView(input)
                .setPositiveButton("Rename", (dialog, which) -> renameFile(file, input.getText().toString()))
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void renameFile(File file, String name) {
        if (name == null || name.isBlank()) {
            return;
        }

        File target = new File(file.getParentFile(), name.trim());
        if (file.renameTo(target)) {
            if (file.equals(currentFile)) {
                currentFile = target;
                fileTitle.setText(relative(target));
            }
            refreshExplorer();
            setStatus("Renamed to " + target.getName(), "Explorer");
        } else {
            setStatus("Rename failed", "Explorer");
        }
    }

    private void showGitInfo() {
        console.setText("");
        appendConsole("[Git] Android build nao embute git desktop.");
        appendConsole("[Git] O workspace local fica em: " + workspaceRoot.getAbsolutePath());
        appendConsole("[Git] Use export/sync depois para versionar fora do app.");
        setStatus("Git info", "Source Control");
    }

    private void toggleTheme() {
        lightTheme = !lightTheme;
        int bg = lightTheme ? Color.rgb(245, 245, 245) : BG;
        int fg = lightTheme ? Color.rgb(30, 30, 30) : TEXT;
        editor.setBackgroundColor(bg);
        editor.setTextColor(fg);
        wallpaperLayer.setBackgroundColor(bg);
        setStatus(lightTheme ? "Light theme" : "Dark theme", "Theme");
        applyHighlight();
    }

    private void applyHighlight() {
        if (editor == null) {
            return;
        }

        String text = editor.getText().toString();
        int selection = Math.max(0, editor.getSelectionStart());
        SpannableStringBuilder builder = new SpannableStringBuilder(text);
        AndroidSyntax.apply(builder, languageFor(currentFile), lightTheme);

        applyingHighlight = true;
        editor.setText(builder);
        editor.setSelection(Math.min(selection, editor.length()));
        applyingHighlight = false;
    }

    private void updateCursorStatus() {
        int pos = Math.max(0, editor.getSelectionStart());
        String text = editor.getText().toString();
        int line = 1;
        int col = 1;
        for (int i = 0; i < Math.min(pos, text.length()); i++) {
            if (text.charAt(i) == '\n') {
                line++;
                col = 1;
            } else {
                col++;
            }
        }
        statusRight.setText(languageFor(currentFile) + "  Ln " + line + ", Col " + col);
    }

    private void seedWorkspace() {
        File sample = new File(workspaceRoot, "main.gol");
        if (sample.exists()) {
            return;
        }

        String code = "algoritmo \"mobile\"\n"
                + "var\n"
                + "    nome: literal\n"
                + "inicio\n"
                + "    escreval(\"NPSharp Android\")\n"
                + "    escreval(\"Editor pronto\")\n"
                + "fimalgoritmo\n";
        try {
            writeFile(sample, code);
            writeFile(new File(workspaceRoot, "README.md"),
                    "# NPSharp Android\n\nEditor Android portado do NPSharp desktop.\n"
            );
        } catch (Exception ignored) {
        }
    }

    private List<File> listTextFiles(File root) {
        List<File> out = new ArrayList<>();
        File[] files = root.listFiles();
        if (files == null) {
            return out;
        }
        for (File file : files) {
            if (file.isDirectory()) {
                out.addAll(listTextFiles(file));
            } else if (isTextFile(file)) {
                out.add(file);
            }
        }
        return out;
    }

    private boolean isTextFile(File file) {
        String name = file.getName().toLowerCase(Locale.ROOT);
        return name.endsWith(".java")
                || name.endsWith(".kt")
                || name.endsWith(".xml")
                || name.endsWith(".json")
                || name.endsWith(".css")
                || name.endsWith(".html")
                || name.endsWith(".js")
                || name.endsWith(".ts")
                || name.endsWith(".md")
                || name.endsWith(".txt")
                || name.endsWith(".gol")
                || name.endsWith(".por")
                || name.endsWith(".portugol")
                || name.endsWith(".alg");
    }

    private String readFile(File file) throws Exception {
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
    }

    private void writeFile(File file, String text) throws Exception {
        if (file.getParentFile() != null) {
            file.getParentFile().mkdirs();
        }
        Files.write(file.toPath(), (text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
    }

    private String languageFor(File file) {
        if (file == null) {
            return "Plain Text";
        }
        String name = file.getName().toLowerCase(Locale.ROOT);
        if (name.endsWith(".gol") || name.endsWith(".por") || name.endsWith(".portugol") || name.endsWith(".alg")) return "Portugol";
        if (name.endsWith(".java")) return "Java";
        if (name.endsWith(".kt")) return "Kotlin";
        if (name.endsWith(".js")) return "JavaScript";
        if (name.endsWith(".ts")) return "TypeScript";
        if (name.endsWith(".json")) return "JSON";
        if (name.endsWith(".css")) return "CSS";
        if (name.endsWith(".html")) return "HTML";
        if (name.endsWith(".md")) return "Markdown";
        return "Plain Text";
    }

    private String relative(File file) {
        String root = workspaceRoot.getAbsolutePath();
        String path = file.getAbsolutePath();
        return path.startsWith(root) ? path.substring(root.length()).replace(File.separatorChar, '/').replaceFirst("^/", "") : file.getName();
    }

    private void appendConsole(String line) {
        console.append(line + "\n");
    }

    private void setStatus(String left, String right) {
        statusLeft.setText(left == null ? "" : left);
        statusRight.setText(right == null ? "" : right);
    }

    private String firstLine(String text) {
        if (text == null || text.isBlank()) {
            return "unknown error";
        }
        return text.split("\\R", 2)[0];
    }

    private EditText input(String hint) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setSingleLine(true);
        return input;
    }

    private Button toolbarButton(String text, View.OnClickListener action) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextSize(11);
        button.setTextColor(TEXT);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setOnClickListener(action);
        return button;
    }

    private Button panelButton(String text, View.OnClickListener action) {
        Button button = toolbarButton(text, action);
        button.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        button.setPadding(dp(8), dp(6), dp(8), dp(6));
        button.setBackgroundColor(Color.rgb(45, 45, 48));
        return button;
    }

    private TextView panelText(String text, int color) {
        TextView view = label(text, 12, color, Typeface.NORMAL);
        view.setPadding(dp(6), dp(8), dp(6), dp(8));
        return view;
    }

    private TextView label(String text, int sp, int color, int style) {
        TextView label = new TextView(this);
        label.setText(text);
        label.setTextSize(sp);
        label.setTextColor(color);
        label.setTypeface(Typeface.DEFAULT, style);
        return label;
    }

    private LinearLayout vertical() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams wrapWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private static final class AndroidSyntax {
        private static final Pattern TOKEN = Pattern.compile(
                "(//[^\\n]*|/\\*[\\s\\S]*?\\*/|#[^\\n]*)"
                        + "|(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')"
                        + "|(\\b\\d+(?:\\.\\d+)?\\b)"
                        + "|(\\b(algoritmo|var|inicio|fimalgoritmo|se|entao|senao|fimse|enquanto|fimenquanto|escreva|escreval|leia|inteiro|real|literal|logico|caractere|class|public|private|return|if|else|for|while|function|const|let|var|import|package|new|null|true|false)\\b)"
                        + "|(\\b[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\())",
                Pattern.CASE_INSENSITIVE
        );

        static void apply(SpannableStringBuilder builder, String language, boolean light) {
            Matcher matcher = TOKEN.matcher(builder.toString());
            while (matcher.find()) {
                int color = colorFor(matcher, light);
                builder.setSpan(
                        new ForegroundColorSpan(color),
                        matcher.start(),
                        matcher.end(),
                        Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                );
            }
        }

        private static int colorFor(Matcher matcher, boolean light) {
            if (matcher.group(1) != null) return light ? Color.rgb(0, 128, 0) : Color.rgb(106, 153, 85);
            if (matcher.group(2) != null) return light ? Color.rgb(163, 21, 21) : Color.rgb(206, 145, 120);
            if (matcher.group(3) != null) return light ? Color.rgb(9, 134, 88) : Color.rgb(181, 206, 168);
            if (matcher.group(4) != null) return light ? Color.rgb(0, 0, 255) : Color.rgb(86, 156, 214);
            if (matcher.group(6) != null) return light ? Color.rgb(121, 94, 38) : Color.rgb(220, 220, 170);
            return light ? Color.rgb(30, 30, 30) : Color.rgb(220, 220, 220);
        }
    }
}
