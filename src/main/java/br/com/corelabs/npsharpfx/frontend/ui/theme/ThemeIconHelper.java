/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Locale usado para normalização segura de strings
// (evita problemas de idioma ao converter para lowercase)
import java.util.Locale;

import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.paint.Color;
import javafx.scene.shape.Shape;

/**
 * Classe utilitária responsável por resolver e aplicar cores de ícones
 * baseadas no tema atual do editor.
 *
 * Responsabilidades principais:
 *
 * 1) Normalizar nomes de temas
 * 2) Interpretar cores customizadas para ícones
 * 3) Resolver cor correta de ícone baseada no tema
 * 4) Aplicar cor nos ícones da UI
 * 5) Aplicar cores recursivamente em containers
 *
 * Essa classe é usada principalmente para manter os ícones visíveis
 * quando o usuário troca entre temas claros e escuros.
 */
public final class ThemeIconHelper {

    // Constantes que representam os tipos de tema suportados
    public static final String THEME_NP = "np";
    public static final String THEME_NP_DARK = "np-dark";
    public static final String THEME_VSCODE_DARK = "vscode-dark";
    public static final String THEME_VSCODE_LIGHT = "vscode-light";
    public static final String THEME_CUSTOM = "custom";

    /**
     * Construtor privado para impedir instanciação da classe.
     */
    private ThemeIconHelper() {
    }

    /**
     * Normaliza o valor de tema recebido.
     *
     * Aceita várias variações e converte para um valor padrão.
     *
     * Exemplos:
     *
     * "dark" → np-dark
     * "dark+" → np-dark
     * "vs-dark" → vscode-dark
     * "light" → vscode-light
     */
    public static String normalizeTheme(String raw) {

        // Se tema não foi informado usa dark padrão
        if (raw == null || raw.isBlank()) {
            return THEME_NP_DARK;
        }

        // Remove espaços e converte para lowercase seguro
        String value = raw.trim().toLowerCase(Locale.ROOT);

        // Remove prefixos possíveis
        if (value.startsWith("theme:")) {
            value = value.substring("theme:".length()).trim();
        } else if (value.startsWith("theme=")) {
            value = value.substring("theme=".length()).trim();
        }

        // Mapeia aliases de tema para constantes internas
        return switch (value) {
            case "np" -> THEME_NP;
            case "np-dark", "dark", "dark+" -> THEME_NP_DARK;
            case "vscode", "vscode-dark", "vs-dark", "dark-vscode" -> THEME_VSCODE_DARK;
            case "vscode-light", "vs", "vs-light", "light" -> THEME_VSCODE_LIGHT;
            case "custom" -> THEME_CUSTOM;
            default -> THEME_NP_DARK;
        };
    }

    /**
     * Interpreta valor de cor customizada para ícones.
     *
     * Aceita formatos como:
     *
     * iconColor=#FF0000
     * iconColor:#FF0000
     * color=#FF0000
     */
    public static String normalizeIconColor(String raw) {

        if (raw == null) {
            return null;
        }

        String value = raw.trim();

        if (value.isEmpty()) {
            return null;
        }

        String lower = value.toLowerCase(Locale.ROOT);

        // Remove prefixos possíveis
        if (lower.startsWith("iconcolor=")) {
            value = value.substring("iconcolor=".length()).trim();
        } else if (lower.startsWith("iconcolor:")) {
            value = value.substring("iconcolor:".length()).trim();
        } else if (lower.startsWith("color=")) {
            value = value.substring("color=".length()).trim();
        } else if (lower.startsWith("color:")) {
            value = value.substring("color:".length()).trim();
        }

        // Se não começar com # não é cor válida
        if (!value.startsWith("#")) {
            return null;
        }

        try {

            // Testa se a cor é válida
            Color parsed = Color.web(value);

            // Retorna versão padronizada HEX
            return toHex(parsed);

        } catch (Exception e) {

            // Caso não seja cor válida
            return null;
        }
    }

    /**
     * Resolve qual cor o ícone deve ter baseado no tema.
     */
    public static Color resolveIconColor(String themeValue, String iconColorValue) {

        // Primeiro verifica se usuário definiu cor customizada
        String custom = normalizeIconColor(iconColorValue);
        if (custom != null) {
            return Color.web(custom);
        }

        // Normaliza tema
        String normalizedTheme = normalizeTheme(themeValue);

        // Resolve cor baseada no tema
        return switch (normalizedTheme) {

            case THEME_NP -> Color.BLACK;

            case THEME_VSCODE_LIGHT -> Color.web("#424242");

            case THEME_CUSTOM -> Color.WHITE;

            case THEME_NP_DARK, THEME_VSCODE_DARK -> Color.WHITE;

            default -> Color.WHITE;
        };
    }

    /**
     * Retorna cor de ícone em formato CSS (#RRGGBB)
     */
    public static String resolveIconColorCss(String themeValue, String iconColorValue) {
        return toHex(resolveIconColor(themeValue, iconColorValue));
    }

    /**
     * Aplica cor de ícone em um Node.
     */
    public static void applyIconColor(Node node, String themeValue, String iconColorValue) {
        applyIconColor(node, resolveIconColor(themeValue, iconColorValue));
    }

    /**
     * Aplica cor de ícone diretamente.
     */
    public static void applyIconColor(Node node, Color color) {

        if (node == null || color == null) {
            return;
        }

        // Só aplica se o node for marcado como ícone temático
        if (node.getStyleClass().contains("themed-icon")) {
            applyColor(node, color);
        }
    }

    /**
     * Aplica cor em todos os ícones dentro de um container.
     *
     * Útil quando troca de tema.
     */
    public static void applyIconColorRecursively(Node node, String themeValue, String iconColorValue) {
        applyIconColorRecursively(node, resolveIconColor(themeValue, iconColorValue));
    }

    /**
     * Versão recursiva que aplica cor em todos os filhos.
     */
    public static void applyIconColorRecursively(Node node, Color color) {

        if (node == null || color == null) {
            return;
        }

        // Se o node é ícone temático aplica cor
        if (node.getStyleClass().contains("themed-icon")) {
            applyColor(node, color);
        }

        // Se node é container percorre filhos
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                applyIconColorRecursively(child, color);
            }
        }
    }

    /**
     * Verifica se o tema atual é escuro.
     */
    public static boolean isDarkTheme(String themeValue) {

        String normalized = normalizeTheme(themeValue);

        return switch (normalized) {
            case THEME_NP_DARK, THEME_VSCODE_DARK, THEME_CUSTOM -> true;
            case THEME_NP, THEME_VSCODE_LIGHT -> false;
            default -> true;
        };
    }

    /**
     * Converte objeto Color para string HEX (#RRGGBB).
     */
    public static String toHex(Color color) {

        if (color == null) {
            return "#FFFFFF";
        }

        int r = (int) Math.round(color.getRed() * 255);
        int g = (int) Math.round(color.getGreen() * 255);
        int b = (int) Math.round(color.getBlue() * 255);

        return String.format("#%02X%02X%02X", r, g, b);
    }

    /**
     * Aplica cor diretamente no Node.
     */
    private static void applyColor(Node node, Color color) {

        // Se for Shape (SVGPath etc)
        if (node instanceof Shape shape) {
            shape.setFill(color);
            return;
        }

        // Caso contrário aplica via CSS
        if (node != null && color != null) {
            node.setStyle("-fx-fill: " + toHex(color) + ";");
        }
    }
}

