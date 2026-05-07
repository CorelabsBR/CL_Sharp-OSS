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

            return theme;

        } catch (Exception e) {

            /**
             * Caso qualquer erro ocorra durante leitura
             * ou parsing do JSON.
             */
            throw new IllegalStateException("Erro ao carregar tema " + normalizedPath, e);
        }
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

