/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Stream usado para ler arquivos internos do classpath
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Classe responsável por carregar arquivos de tema
 * compatíveis com formato de temas do VSCode.
 *
 * Fluxo de funcionamento:
 *
 * VSCodeThemeEntry
 *      ↓
 * caminho do arquivo .json
 *      ↓
 * ThemeFileLoader
 *      ↓
 * parse do JSON
 *      ↓
 * EditorTheme
 *
 * Ou seja:
 *
 * JSON do tema
 * → vira objeto EditorTheme usado pelo editor.
 *
 * Classe utilitária (somente métodos estáticos).
 */
public final class ThemeFileLoader {

    /**
     * Instância do Gson usada para converter JSON → objetos Java.
     */
    private static final Gson GSON = new Gson();

    /**
     * Construtor privado para impedir instanciação.
     */
    private ThemeFileLoader() {
    }

    /**
     * Carrega um tema baseado em uma entrada de registro.
     *
     * VSCodeThemeEntry contém metadados do tema:
     * - id
     * - nome
     * - caminho do arquivo
     * - tipo (dark / light)
     *
     * @param entry entrada registrada do tema
     * @return EditorTheme pronto para uso
     */
    public static EditorTheme load(VSCodeThemeEntry entry) {

        /**
         * Normaliza o caminho do arquivo do tema.
         *
         * Exemplo:
         *
         * "./dark.json"
         * →
         * "/themes/dark.json"
         */
        String normalizedPath = normalizeThemePath(entry.getPath());

        /**
         * Abre o arquivo de tema dentro do classpath.
         * Tenta múltiplas estratégias de classloader para garantir compatibilidade.
         */
        InputStream input = ThemeFileLoader.class.getResourceAsStream(normalizedPath);

        if (input == null) {
            String pathWithoutSlash = normalizedPath.startsWith("/")
                    ? normalizedPath.substring(1)
                    : normalizedPath;
            ClassLoader cl = Thread.currentThread().getContextClassLoader();
            if (cl != null) {
                input = cl.getResourceAsStream(pathWithoutSlash);
            }
        }

        if (input == null) {
            String pathWithoutSlash = normalizedPath.startsWith("/")
                    ? normalizedPath.substring(1)
                    : normalizedPath;
            input = ClassLoader.getSystemResourceAsStream(pathWithoutSlash);
        }

        /**
         * Caso o arquivo não exista lança erro.
         */
        if (input == null) {
            throw new IllegalStateException("Tema não encontrado: " + normalizedPath);
        }

        /**
         * Converte InputStream em leitor UTF-8.
         */
        try (BufferedReader br = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {

            /**
             * Lê conteúdo bruto e converte JSONC → JSON puro.
             * Remove comentários (//) e trailing commas
             * presentes nos temas VSCode.
             */
            String raw = br.lines().collect(Collectors.joining("\n"));
            String json = stripJsonc(raw);
            JsonObject root = GSON.fromJson(json, JsonObject.class);

            /**
             * Cria instância de EditorTheme
             * que será preenchida com dados do JSON.
             */
            EditorTheme theme = new EditorTheme();

            /**
             * Define propriedades básicas do tema.
             */
            theme.setId(entry.getId());
            theme.setName(entry.getLabel());

            /**
             * Define tipo do tema (dark ou light).
             */
            theme.setType(entry.isDark() ? "dark" : "light");

            /**
             * Guarda caminho do arquivo.
             */
            theme.setPath(normalizedPath);

            /**
             * Extrai objeto "colors" do JSON.
             *
             * Estrutura típica de tema VSCode:
             *
             * {
             *   "colors": {
             *       "editor.background": "#1e1e1e",
             *       "editor.foreground": "#d4d4d4"
             *   }
             * }
             */
            JsonObject colors = root.has("colors") && root.get("colors").isJsonObject()
                    ? root.getAsJsonObject("colors")
                    : new JsonObject();

            /**
             * Itera por todas as cores do tema.
             */
            for (Map.Entry<String, JsonElement> item : colors.entrySet()) {

                if (item.getValue().isJsonPrimitive()) {

                    theme.getColors().put(item.getKey(), item.getValue().getAsString());
                }
            }

            // Parse tokenColors array
            if (root.has("tokenColors") && root.get("tokenColors").isJsonArray()) {
                for (JsonElement elem : root.getAsJsonArray("tokenColors")) {
                    if (!elem.isJsonObject()) continue;
                    JsonObject tc = elem.getAsJsonObject();

                    // Parse scopes
                    List<String> scopes = new ArrayList<>();
                    if (tc.has("scope")) {
                        JsonElement scopeElem = tc.get("scope");
                        if (scopeElem.isJsonArray()) {
                            for (JsonElement s : scopeElem.getAsJsonArray()) {
                                if (s.isJsonPrimitive()) {
                                    scopes.add(s.getAsString());
                                }
                            }
                        } else if (scopeElem.isJsonPrimitive()) {
                            scopes.add(scopeElem.getAsString());
                        }
                    }

                    // Parse settings
                    String foreground = null;
                    String fontStyle = null;
                    if (tc.has("settings") && tc.get("settings").isJsonObject()) {
                        JsonObject settings = tc.getAsJsonObject("settings");
                        if (settings.has("foreground") && settings.get("foreground").isJsonPrimitive()) {
                            foreground = settings.get("foreground").getAsString();
                        }
                        if (settings.has("fontStyle") && settings.get("fontStyle").isJsonPrimitive()) {
                            fontStyle = settings.get("fontStyle").getAsString();
                        }
                    }

                    if (!scopes.isEmpty() && foreground != null) {
                        theme.getTokenColors().add(
                                new EditorTheme.TokenColorEntry(scopes, foreground, fontStyle)
                        );
                    }
                }
            }

            completeThemeColors(theme);

            return theme;

        } catch (Exception e) {

            /**
             * Caso qualquer erro ocorra durante leitura
             * ou parsing do JSON.
             */
            throw new IllegalStateException("Erro ao carregar tema " + normalizedPath, e);
        }
    }

    private static void completeThemeColors(EditorTheme theme) {
        boolean dark = theme.isDark();
        String bg = normalizeColor(theme.color("editor.background", dark ? "#0C1021" : "#FFFFFF"));
        String fg = normalizeColor(theme.color("editor.foreground", dark ? "#F8F8F8" : "#1F2328"));
        String panel = normalizeColor(theme.color("panel.background", shift(bg, dark ? 0.08 : -0.04)));
        String sidebar = normalizeColor(theme.color("sideBar.background", panel));
        String border = normalizeColor(theme.color("editorGroup.border", dark ? shift(bg, 0.18) : shift(bg, -0.16)));
        String accent = normalizeColor(theme.color("focusBorder", theme.color("activityBar.activeBorder", dark ? "#FCE94F" : "#007ACC")));
        String selection = normalizeColor(theme.color("editor.selectionBackground", dark ? "#253B76" : "#ADD6FF"));
        String input = normalizeColor(theme.color("input.background", shift(bg, dark ? 0.1 : -0.06)));
        String hover = normalizeColor(theme.color("list.hoverBackground", shift(bg, dark ? 0.12 : -0.08)));
        String inactiveTab = normalizeColor(theme.color("tab.inactiveBackground", shift(bg, dark ? 0.06 : -0.04)));
        String inactiveFg = normalizeColor(theme.color("tab.inactiveForeground", dark ? "#A7ADB7" : "#616161"));
        String button = normalizeColor(theme.color("button.background", accent));
        String buttonFg = normalizeColor(theme.color("button.foreground", readableText(button, dark)));

        putColor(theme, "editor.background", bg);
        putColor(theme, "editor.foreground", fg);
        putColor(theme, "editorCursor.foreground", fg);
        putColor(theme, "editorLineNumber.foreground", dark ? "#858585" : "#6E7681");
        putColor(theme, "editor.selectionBackground", selection);
        putColor(theme, "editor.lineHighlightBackground", hover);

        putColor(theme, "focusBorder", accent);
        putColor(theme, "errorForeground", "#EF2929");
        putColor(theme, "descriptionForeground", dark ? "#CCCCCC" : "#6F6F6F");
        putColor(theme, "input.placeholderForeground", dark ? "#8B949E" : "#767676");
        putColor(theme, "progressBar.background", accent);

        putColor(theme, "sideBar.background", sidebar);
        putColor(theme, "sideBar.foreground", fg);
        putColor(theme, "sideBar.border", border);

        putColor(theme, "titleBar.activeBackground", panel);
        putColor(theme, "titleBar.activeForeground", fg);
        putColor(theme, "titleBar.border", border);

        putColor(theme, "activityBar.background", panel);
        putColor(theme, "activityBar.foreground", fg);
        putColor(theme, "activityBar.activeBorder", accent);

        putColor(theme, "editorGroup.border", border);
        putColor(theme, "editorGroupHeader.tabsBackground", bg);
        putColor(theme, "editorGroupHeader.tabsBorder", border);

        putColor(theme, "tab.activeBackground", bg);
        putColor(theme, "tab.activeForeground", fg);
        putColor(theme, "tab.inactiveBackground", inactiveTab);
        putColor(theme, "tab.inactiveForeground", inactiveFg);
        putColor(theme, "tab.border", border);
        putColor(theme, "tab.activeBorderTop", accent);
        putColor(theme, "tab.hoverBackground", hover);

        putColor(theme, "statusBar.background", dark ? "#007ACC" : "#007ACC");
        putColor(theme, "statusBar.foreground", "#FFFFFF");

        putColor(theme, "input.background", input);
        putColor(theme, "input.border", border);
        putColor(theme, "input.foreground", fg);

        putColor(theme, "list.hoverBackground", hover);
        putColor(theme, "list.activeSelectionBackground", selection);
        putColor(theme, "list.activeSelectionForeground", readableText(selection, dark));

        putColor(theme, "panel.background", panel);
        putColor(theme, "panel.border", border);
        putColor(theme, "terminal.background", bg);
        putColor(theme, "terminal.foreground", fg);

        putColor(theme, "button.background", button);
        putColor(theme, "button.foreground", buttonFg);

        putTokenColor(theme, "string", dark ? "#CE9178" : "#A31515");
        putTokenColor(theme, "keyword", dark ? "#C586C0" : "#0000FF");
        putTokenColor(theme, "comment", dark ? "#6A9955" : "#008000");
        putTokenColor(theme, "number", dark ? "#B5CEA8" : "#098658");
        putTokenColor(theme, "function", dark ? "#DCDCAA" : "#795E26");
        putTokenColor(theme, "variable", fg);
        putTokenColor(theme, "type", dark ? "#4EC9B0" : "#267F99");
        putTokenColor(theme, "constant", dark ? "#4FC1FF" : "#0070C1");
        putTokenColor(theme, "punctuation", dark ? "#D4D4D4" : "#393A34");
        putTokenColor(theme, "invalid", "#FFFFFF");
    }

    private static void putColor(EditorTheme theme, String key, String value) {
        if (!theme.getColors().containsKey(key) && value != null && !value.isBlank()) {
            theme.getColors().put(key, value);
        }
    }

    private static void putTokenColor(EditorTheme theme, String scope, String foreground) {
        if (theme.tokenColor(scope, null) == null && foreground != null && !foreground.isBlank()) {
            theme.getTokenColors().add(
                    new EditorTheme.TokenColorEntry(List.of(scope), foreground, null)
            );
        }
    }

    private static String normalizeColor(String color) {
        if (color == null || color.isBlank()) {
            return "#000000";
        }

        String trimmed = color.trim();
        if (trimmed.matches("#[0-9A-Fa-f]{8}")) {
            return trimmed.substring(0, 7);
        }
        return trimmed;
    }

    private static String shift(String color, double amount) {
        String hex = normalizeColor(color);
        if (!hex.matches("#[0-9A-Fa-f]{6}")) {
            return hex;
        }

        int rgb = Integer.parseInt(hex.substring(1), 16);
        int r = (rgb >> 16) & 0xFF;
        int g = (rgb >> 8) & 0xFF;
        int b = rgb & 0xFF;

        if (amount >= 0) {
            r += (int) ((255 - r) * amount);
            g += (int) ((255 - g) * amount);
            b += (int) ((255 - b) * amount);
        } else {
            double factor = 1.0 + amount;
            r = (int) (r * factor);
            g = (int) (g * factor);
            b = (int) (b * factor);
        }

        return String.format("#%02X%02X%02X", clamp(r), clamp(g), clamp(b));
    }

    private static String readableText(String bg, boolean darkTheme) {
        String hex = normalizeColor(bg);
        if (!hex.matches("#[0-9A-Fa-f]{6}")) {
            return darkTheme ? "#FFFFFF" : "#000000";
        }

        int rgb = Integer.parseInt(hex.substring(1), 16);
        int r = (rgb >> 16) & 0xFF;
        int g = (rgb >> 8) & 0xFF;
        int b = rgb & 0xFF;
        double luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
        return luminance > 0.55 ? "#000000" : "#FFFFFF";
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(255, value));
    }

    /**
     * Converte JSONC (JSON with Comments) em JSON puro.
     *
     * Remove:
     * - Comentários de linha (//)
     * - Trailing commas antes de } ou ]
     */
    private static String stripJsonc(String raw) {
        StringBuilder sb = new StringBuilder(raw.length());
        boolean inString = false;
        boolean escape = false;

        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);

            if (escape) {
                sb.append(c);
                escape = false;
                continue;
            }

            if (inString) {
                if (c == '\\') {
                    escape = true;
                } else if (c == '"') {
                    inString = false;
                }
                sb.append(c);
                continue;
            }

            // Fora de string: checa comentários
            if (c == '"') {
                inString = true;
                sb.append(c);
            } else if (c == '/' && i + 1 < raw.length()) {
                char next = raw.charAt(i + 1);
                if (next == '/') {
                    // Pula até fim da linha
                    while (i < raw.length() && raw.charAt(i) != '\n') i++;
                    if (i < raw.length()) sb.append('\n');
                } else if (next == '*') {
                    // Pula bloco /* ... */
                    i += 2;
                    while (i + 1 < raw.length() && !(raw.charAt(i) == '*' && raw.charAt(i + 1) == '/')) i++;
                    i++; // pula o '/'
                } else {
                    sb.append(c);
                }
            } else {
                sb.append(c);
            }
        }

        // Remove trailing commas: , seguido de } ou ]
        return sb.toString().replaceAll(",\\s*([}\\]])", "$1");
    }

    /**
     * Normaliza o caminho do arquivo de tema.
     *
     * Objetivo:
     * garantir que todos os temas sejam carregados
     * a partir da pasta /themes.
     *
     * @param path caminho original
     * @return caminho normalizado
     */
    private static String normalizeThemePath(String path) {

        /**
         * Verifica se caminho está vazio.
         */
        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("Path do tema vazio");
        }

        /**
         * Remove espaços extras.
         */
        String normalized = path.trim();

        /**
         * Remove prefixo "./"
         */
        if (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }

        /**
         * Se não começar com "/" assume que é
         * relativo à pasta /themes.
         */
        if (!normalized.startsWith("/")) {
            normalized = "/themes/" + normalized;
        }

        return normalized;
    }
}

