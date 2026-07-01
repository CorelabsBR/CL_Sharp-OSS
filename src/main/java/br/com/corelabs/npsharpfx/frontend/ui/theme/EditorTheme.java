/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class EditorTheme {

    private String id;
    private String name;
    private String type;
    private String path;

    private final Map<String, String> colors = new HashMap<>();
    private final List<TokenColorEntry> tokenColors = new ArrayList<>();

    public static class TokenColorEntry {
        private final List<String> scopes;
        private final String foreground;
        private final String fontStyle;

        public TokenColorEntry(List<String> scopes, String foreground, String fontStyle) {
            this.scopes = scopes != null ? scopes : new ArrayList<>();
            this.foreground = foreground;
            this.fontStyle = fontStyle;
        }

        public List<String> getScopes() {
            return scopes;
        }

        public String getForeground() {
            return foreground;
        }

        public String getFontStyle() {
            return fontStyle;
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public Map<String, String> getColors() {
        return colors;
    }

    public List<TokenColorEntry> getTokenColors() {
        return tokenColors;
    }

    public String color(String key, String fallback) {
        String value = colors.get(key);
        return value != null && !value.isBlank() ? value : fallback;
    }

    public String tokenColor(String scope, String fallback) {
        if (scope == null || scope.isBlank()) {
            return fallback;
        }

        for (TokenColorEntry entry : tokenColors) {
            if (entry == null || entry.getScopes() == null) {
                continue;
            }

            for (String s : entry.getScopes()) {
                if (s == null || s.isBlank()) {
                    continue;
                }

                if (
                    s.equals(scope)
                    || scope.startsWith(s + ".")
                    || s.startsWith(scope + ".")
                ) {
                    String foreground = entry.getForeground();
                    if (foreground != null && !foreground.isBlank()) {
                        return foreground;
                    }
                }
            }
        }

        return fallback;
    }

    public boolean isDark() {
        return "dark".equalsIgnoreCase(type);
    }
}