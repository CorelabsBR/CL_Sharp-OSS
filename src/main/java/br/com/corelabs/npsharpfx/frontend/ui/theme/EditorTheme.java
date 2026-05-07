package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Estruturas de mapa usadas para armazenar pares chave → valor.
// Aqui será usado para armazenar cores do tema.
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Classe que representa um tema do editor.
 *
 * Um tema contém informações como:
 *
 * - id único
 * - nome do tema
 * - tipo (dark / light)
 * - caminho do arquivo do tema
 * - mapa de cores utilizadas na interface
 *
 * Esse modelo provavelmente corresponde a um tema estilo VSCode,
 * onde cores são definidas por chaves:
 *
 * "editor.background"
 * "editor.foreground"
 * "editorLineNumber.foreground"
 *
 * Estrutura geral:
 *
 * EditorTheme
 *    ├ id
 *    ├ name
 *    ├ type
 *    ├ path
 *    └ colors (Map)
 */
public class EditorTheme {

    /**
     * Identificador único do tema.
     *
     * Exemplo:
     * "dark_plus"
     */
    private String id;

    /**
     * Nome amigável do tema exibido na UI.
     *
     * Exemplo:
     * "Dark+ (VSCode)"
     */
    private String name;

    /**
     * Tipo do tema.
     *
     * Normalmente:
     *
     * "dark"
     * ou
     * "light"
     */
    private String type;

    /**
     * Caminho do arquivo que define o tema.
     *
     * Exemplo:
     *
     * /themes/dark_plus.json
     */
    private String path;

    /**
     * Mapa contendo todas as cores do tema.
     *
     * Estrutura:
     *
     * chave → valor
     *
     * Exemplo:
     *
     * "editor.background" → "#1E1E1E"
     * "editor.foreground" → "#D4D4D4"
     */
    private final Map<String, String> colors = new HashMap<>();

    private final List<TokenColorEntry> tokenColors = new ArrayList<>();

    public static class TokenColorEntry {
        private final List<String> scopes;
        private final String foreground;
        private final String fontStyle;

        public TokenColorEntry(List<String> scopes, String foreground, String fontStyle) {
            this.scopes = scopes;
            this.foreground = foreground;
            this.fontStyle = fontStyle;
        }

        public List<String> getScopes() { return scopes; }
        public String getForeground() { return foreground; }
        public String getFontStyle() { return fontStyle; }
    }

    /**
     * Retorna o ID do tema.
     */
    public String getId() {
        return id;
    }

    /**
     * Define o ID do tema.
     */
    public void setId(String id) {
        this.id = id;
    }

    /**
     * Retorna o nome amigável do tema.
     */
    public String getName() {
        return name;
    }

    /**
     * Define o nome do tema.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Retorna o tipo do tema.
     */
    public String getType() {
        return type;
    }

    /**
     * Define o tipo do tema.
     *
     * Esperado:
     * "dark" ou "light"
     */
    public void setType(String type) {
        this.type = type;
    }

    /**
     * Retorna o caminho do arquivo do tema.
     */
    public String getPath() {
        return path;
    }

    /**
     * Define o caminho do arquivo do tema.
     */
    public void setPath(String path) {
        this.path = path;
    }

    /**
     * Retorna o mapa completo de cores do tema.
     *
     * Isso permite iterar ou acessar diretamente
     * todas as cores carregadas.
     */
    public Map<String, String> getColors() {
        return colors;
    }

    public List<TokenColorEntry> getTokenColors() {
        return tokenColors;
    }

    /**
     * Retorna a cor de foreground para um determinado escopo de token.
     * Procura por correspondência exata ou parcial nos escopos registrados.
     */
    public String tokenColor(String scope, String fallback) {
        for (TokenColorEntry entry : tokenColors) {
            for (String s : entry.getScopes()) {
                if (s.equals(scope) || scope.startsWith(s + ".") || scope.startsWith(s)) {
                    if (entry.getForeground() != null && !entry.getForeground().isBlank()) {
                        return entry.getForeground();
                    }
                }
            }
        }
        return fallback;
    }

    /**
     * Retorna uma cor do tema baseada em chave.
     *
     * Caso a chave não exista, retorna fallback.
     *
     * Exemplo de uso:
     *
     * theme.color("editor.background", "#000000")
     *
     * @param key chave da cor
     * @param fallback valor padrão caso não exista
     *
     * @return cor do tema ou fallback
     */
    public String color(String key, String fallback) {

        // procura valor no mapa
        String value = colors.get(key);

        // se existir e não estiver vazio retorna
        // caso contrário usa fallback
        return value != null && !value.isBlank() ? value : fallback;
    }

    /**
     * Verifica se o tema é escuro.
     *
     * Isso é usado para aplicar comportamento
     * específico da interface.
     *
     * Exemplo:
     *
     * if(theme.isDark()) {
     *     usar icones claros
     * }
     */
    public boolean isDark() {

        // comparação ignorando maiúsculas/minúsculas
        return "dark".equalsIgnoreCase(type);
    }
}

